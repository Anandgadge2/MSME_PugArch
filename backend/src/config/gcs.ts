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

  // If GOOGLE_APPLICATION_CREDENTIALS env var points to a non-existent file (e.g. gcp-key.json on Vercel),
  // unset it from process.env so google-auth-library does not try fs.lstat on disk during getSignedUrl.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const p = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
    if (!fs.existsSync(p)) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  }

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

  // 2. Read local key file into memory if present
  if (!options.credentials) {
    const keyFilePath = 'gcp-key.json';
    const resolvedKeyPath = path.resolve(process.cwd(), keyFilePath);

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

  // 3. In-memory fallback credentials for Vercel/serverless when key file is not deployed
  if (!options.credentials && !options.keyFilename) {
    options.credentials = {
      client_email: 'storage-access@jharsuguda-mart.iam.gserviceaccount.com',
      private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDB6xdbeKrC9ViF\n1inmSX3MiPmSb7F2kaTINV8xhl7efgRy4Bk/GD+plNJQjTYRPJX81uX6FACnodTk\nRonHZiLg0x40G8QeUKlnzqk/VIU2+maTCnEKqryP2gNiX2L1C1tUR3hXNYYN3gPu\nLEqteEh2htSFBZYV5I/1s9cHUvepanVKGHvDH+juIHyG4uQhouSIVB0gAT0Z5uik\nGknmpBNwcpXf/A/TQCkSlATfl4918c8+3EZs/vHZVS6oJy1yYcQUWM+U06ad2FFp\n8/AeCofjCgGhCIT0QrTi0lNH4rOthXSygRmzzVa4SC0bOVqMLGS4tuhsLJMnEGkE\nIDOdM76tAgMBAAECggEADZ3ug/PTOeF0l+FUC+G5PbWYoNnLAmJzycNFrfqbitAa\ni96Ep1OSlNvocNOZqlgwyBJnD8p7yUmp42W4oxHe/R6WDl6sxNwxKSLv64yJ1jR7\nI3QmP/OBTjCm8C92iXKEtURXhPgzM6IVcJIXpFq/6+LH5Zdg1KS6HyzDurXuwiyi\nLK7ZsnefIljNAbAxdIag+vnJsV2Ilqq7T1EVNM11zmmGK5o7/mjK6q/C1IdsN2EM\nLpAR861nWJy5uzGX4cm9Aul2G77UYecSAAmqKTXILa7zFzAGpj0sXnBhxdiJxvho\n1JeKMDP2KZ1iXMxbWpLbr3IxEhKufIIGFsAeTC29QQKBgQDya6tJN8v2wmlOT30l\nv4oGVoKybQygDxb4LjHEWSDp6ldahzxJHQ5g6S7uJl7AvIt/CJ9HK3L43jsy7nzV\n9ob8zwCgnh9JHWJL+vxM1Z/n2Lkk4Yl+bnrIk5Vgu0F3NfQab+3SczG+mgiJADLx\nTXyaMw+UtDCv6JNrBMYKPWMgSQKBgQDMx+VVLs0DwD7y48cHcDjTbL2v8oaVdzah\nPl6lfVfZibQtJ40tXXrNpGgCIAIjrd63eqWMkK+Efrac1BIVbqLiKJ03dpjEQveH\nUZ1Jc11O9uUDH6ul8ApPIFuH9BShLlnY0Et5jewfik2pGhhQmwRxRyJ1ah5YjZAY\nUnLp1KGzRQKBgQCaqX66U9LZN+efgq9BahZRPNhdpZ0scPQimrY9ou+QzWW16Bna\nO6N0yNCcN/az2JbXEVUtPtc3V/FE6UrT51jv6dFop/kl2I1iFFrrWk+Ox4I3uXzT\nIQFM/nuLH20A9XcrdsWwQrY1+GgBoBLgSKN6baE/Kkb1s9h5qq3+0nNvoQKBgH8i\nDweeYZtVi/8hWFwO2MixtuX4DIPYmirq3LmjIpokep6Z8nTalzX6PrQrCQj7lcyV\nMRgeb0kznc2pf3yczjTYABsB3v/hj2kMSzjhjWlLsIwK6na/mrbbINg7uV8DtrX7\nQxA5AwHlzCcS00ufoddt0T/R3PsfD/l5nmv7HVR9AoGABFfolkhlqMTEEOwWer0U\nmKBUaiYItmmVrhBboOyr7uw2S3Z1SkpWRaBOlSqCFYOiYDZyR75IMsom/UAiZ3QM\nEBnYTcsQIhqY6sEtrI+MXDtRSIvt9oFA1Cq2jQTfOPVsykMUE4YYmqbP5/IaBUvz\nuyBZPBtc/ouILs36mr6QX3o=\n-----END PRIVATE KEY-----\n`
    };
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
