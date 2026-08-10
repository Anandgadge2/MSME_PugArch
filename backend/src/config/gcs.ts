import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import { env, isProduction } from './env.js';
import { logger } from './logger.js';

let storageInstance: Storage | null = null;

export const getGCSBucketName = (): string =>
  env.GCS_BUCKET_NAME || env.GCP_STORAGE_BUCKET || 'jsgsmile1';

const inlineCredentials = () => {
  if (!env.GCP_SERVICE_ACCOUNT_JSON) return undefined;

  const raw = env.GCP_SERVICE_ACCOUNT_JSON.trim();
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const credentials = JSON.parse(decoded);
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON is missing client_email or private_key');
  }
  return credentials;
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
      logger.info('[GCS] Using service-account credentials from the protected environment.');
    }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, '[GCS] Invalid service-account environment configuration');
    throw error;
  }

  if (!options.credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const resolvedPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS points to a missing file');
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
    logger.error({ err: error?.message || error }, '[GCS] Storage configuration failed.');
    return false;
  }
};
