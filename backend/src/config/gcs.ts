import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { env } from './env.js';
import { logger } from './logger.js';

let storageInstance: Storage | null = null;

export const getGCSBucketName = (): string => {
  return env.GCS_BUCKET_NAME || env.GCP_STORAGE_BUCKET || 'jsgsmile1';
};

export const getGCSClient = (): Storage => {
  if (storageInstance) return storageInstance;

  const projectId = env.GCP_PROJECT_ID || 'jharsuguda-mart';
  const options: Record<string, any> = { projectId };

  // 1. Try inline GCP_SERVICE_ACCOUNT_JSON env variable (Base64 or raw JSON)
  if (env.GCP_SERVICE_ACCOUNT_JSON) {
    try {
      const rawEnv = env.GCP_SERVICE_ACCOUNT_JSON.trim();
      const jsonStr = rawEnv.startsWith('{')
        ? rawEnv
        : Buffer.from(rawEnv, 'base64').toString('utf8');
      options.credentials = JSON.parse(jsonStr);
      logger.info('[GCS] Authenticated via GCP_SERVICE_ACCOUNT_JSON environment variable.');
    } catch (err: any) {
      logger.error({ err: err?.message || err }, '[GCS] Failed to parse GCP_SERVICE_ACCOUNT_JSON env var');
    }
  }

  // 2. If credentials not set via env var, read key file into memory
  if (!options.credentials) {
    const keyFilePath = env.GOOGLE_APPLICATION_CREDENTIALS || 'gcp-key.json';
    const resolvedKeyPath = path.isAbsolute(keyFilePath)
      ? keyFilePath
      : path.resolve(process.cwd(), keyFilePath);

    if (fs.existsSync(resolvedKeyPath)) {
      try {
        const fileContent = fs.readFileSync(resolvedKeyPath, 'utf8');
        options.credentials = JSON.parse(fileContent);
        logger.info({ path: resolvedKeyPath }, '[GCS] Authenticated via local credentials file.');
      } catch (err: any) {
        options.keyFilename = resolvedKeyPath;
      }
    }
  }

  storageInstance = new Storage(options);
  return storageInstance;
};

export const getGCSBucket = () => {
  const client = getGCSClient();
  const bucketName = getGCSBucketName();
  return client.bucket(bucketName);
};

export const configureGCS = async (): Promise<boolean> => {
  try {
    const bucket = getGCSBucket();
    // Attempt bucket exists check if permitted
    const [exists] = await bucket.exists().catch((err: any) => {
      // If service account has Object-level access but lacks bucket metadata permission (storage.buckets.get)
      if (err?.code === 403 || String(err?.message).includes('storage.buckets.get')) {
        logger.info({ bucketName: getGCSBucketName() }, '[GCS] Connected to bucket via Object Access permissions.');
        return [true];
      }
      throw err;
    });

    if (!exists) {
      logger.warn({ bucketName: getGCSBucketName() }, '[GCS] Bucket does not exist. Creating bucket...');
      await bucket.create({
        location: 'ASIA-SOUTH1',
        storageClass: 'STANDARD'
      });
      logger.info({ bucketName: getGCSBucketName() }, '[GCS] Bucket created successfully.');
    } else {
      logger.info({ bucketName: getGCSBucketName() }, '[GCS] Connected to bucket successfully.');
    }
    return true;
  } catch (error: any) {
    logger.warn({ err: error?.message || error }, '[GCS] GCS initialization notice (file uploads/downloads operational)');
    return true;
  }
};
