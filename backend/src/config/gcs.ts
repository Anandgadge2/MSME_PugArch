import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import { env, isProduction } from './env.js';
import { logger } from './logger.js';

let storageInstance: Storage | null = null;

export const getGCSBucketName = (): string =>
  env.GCS_BUCKET_NAME || env.GCP_STORAGE_BUCKET || 'jsgsmile1';

const inlineCredentials = (): Record<string, any> | undefined => {
  const rawCandidate = env.GCP_SERVICE_ACCOUNT_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_CREDENTIALS;
  
  // If GCP_SERVICE_ACCOUNT_JSON is not set, check if GOOGLE_APPLICATION_CREDENTIALS contains inline JSON/base64
  let raw = rawCandidate?.trim();
  if (!raw && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const gCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    if (gCreds.startsWith('{') || (!path.isAbsolute(gCreds) && !gCreds.endsWith('.json') && gCreds.length > 100)) {
      raw = gCreds;
    }
  }

  if (!raw) return undefined;

  // Strip accidental outer quotes from env vars
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }

  let decoded = raw;
  if (!raw.startsWith('{')) {
    try {
      decoded = Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      decoded = raw;
    }
  }

  try {
    const credentials = JSON.parse(decoded);
    if (!credentials?.client_email || !credentials?.private_key) {
      throw new Error('GCP Service Account JSON is missing client_email or private_key');
    }

    // Fix double-escaped newlines in private key if present
    if (typeof credentials.private_key === 'string') {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    return credentials;
  } catch (parseErr: any) {
    throw new Error(`Failed to parse GCP service account credentials: ${parseErr?.message || parseErr}`);
  }
};

export const getGCSClient = (): Storage => {
  if (storageInstance) return storageInstance;

  const options: Record<string, unknown> = {
    projectId: env.GCP_PROJECT_ID || 'jharsuguda-mart'
  };

  try {
    const credentials = inlineCredentials();
    if (credentials) {
      options.credentials = credentials;
      if (credentials.project_id && (!env.GCP_PROJECT_ID || env.GCP_PROJECT_ID === 'jharsuguda-mart')) {
        options.projectId = credentials.project_id;
      }
      logger.info('[GCS] Using service-account credentials from environment variable.');
    }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, '[GCS] Invalid service-account environment configuration');
    throw error;
  }

  if (!options.credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    const resolvedPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
    if (!fs.existsSync(resolvedPath)) {
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || isProduction);
      if (isServerless) {
        logger.warn(`[GCS] GOOGLE_APPLICATION_CREDENTIALS points to a missing file (${configuredPath}). In serverless/cloud environments, configure GCP_SERVICE_ACCOUNT_JSON with your base64 or JSON credentials.`);
      }
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS points to a missing file: ${configuredPath}`);
    }
    if (isProduction) {
      logger.info('[GCS] Using a configured credential file. Prefer workload identity in managed production environments.');
    }
  }

  // With no explicit credential, google-auth-library uses Application Default
  // Credentials / workload identity. Secrets are never embedded in source.
  storageInstance = new Storage(options);
  return storageInstance;
};

export const getGCSBucket = () => getGCSClient().bucket(getGCSBucketName());

export const configureGCS = async (): Promise<boolean> => {
  try {
    const bucket = getGCSBucket();
    const [exists] = await bucket.exists().catch((error: any) => {
      // Object-only service accounts commonly lack storage.buckets.get. Treat
      // that as usable without granting broader bucket-administration rights.
      if (error?.code === 403 || String(error?.message).includes('storage.buckets.get')) {
        logger.info({ bucketName: getGCSBucketName() }, '[GCS] Object-level credentials configured.');
        return [true];
      }
      throw error;
    });

    if (!exists) {
      logger.error({ bucketName: getGCSBucketName() }, '[GCS] Configured bucket does not exist; automatic creation is disabled.');
      return false;
    }

    logger.info({ bucketName: getGCSBucketName() }, '[GCS] Connected to bucket successfully.');
    return true;
  } catch (error: any) {
    logger.warn({ err: error?.message || error }, '[GCS] Storage configuration failed or credentials missing. Local disk storage fallback is enabled.');
    return false;
  }
};
