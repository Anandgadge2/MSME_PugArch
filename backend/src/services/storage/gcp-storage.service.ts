import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getGCSBucket, getGCSBucketName } from '../../config/gcs.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import type { StorageProvider, StorageUploadInput, StorageUploadResult } from './storage.service.js';

export class GCPStorageService implements StorageProvider {
  name: 'gcp' = 'gcp';

  private get bucket() {
    return getGCSBucket();
  }

  /**
   * Upload file buffer to GCS bucket
   */
  async uploadFile(input: StorageUploadInput): Promise<StorageUploadResult> {
    return this.uploadBuffer(input.buffer, input.key, {
      folder: input.folder,
      mimeType: input.mimeType,
      originalName: input.context?.purpose || 'uploaded_file',
      metadata: {
        ownerId: String(input.context.ownerId),
        ownerRole: input.context.ownerRole,
        entityType: input.context.entityType,
        entityId: input.context.entityId ? String(input.context.entityId) : ''
      }
    });
  }

  /**
   * Upload raw buffer to GCS with folder prefix and metadata
   */
  async uploadBuffer(
    buffer: Buffer,
    key: string,
    options: {
      folder?: string;
      mimeType: string;
      originalName?: string;
      metadata?: Record<string, string>;
      isPublic?: boolean;
    }
  ): Promise<StorageUploadResult> {
    try {
      const bucketName = getGCSBucketName();
      const folderPrefix = options.folder ? `${options.folder.replace(/\/$/, '')}/` : '';
      const fullKey = key.startsWith(folderPrefix) ? key : `${folderPrefix}${key}`;
      
      const file = this.bucket.file(fullKey);

      await file.save(buffer, {
        contentType: options.mimeType,
        resumable: false,
        metadata: {
          contentType: options.mimeType,
          metadata: {
            originalName: options.originalName || '',
            ...(options.metadata || {})
          }
        }
      });

      if (options.isPublic) {
        await file.makePublic().catch(() => {
          // Uniform bucket-level access might prevent per-object ACL, which is normal
        });
      }

      const publicUrl = this.getPublicUrl(fullKey);

      logger.info({ bucket: bucketName, key: fullKey }, '[GCS] Uploaded object successfully');

      return {
        provider: 'gcp',
        bucket: bucketName,
        key: fullKey,
        url: publicUrl
      };
    } catch (error: any) {
      const gcsErrMsg = error?.message || String(error);
      logger.warn({ err: gcsErrMsg, key }, '[GCS] Upload failed or credentials missing. Falling back to local disk storage.');
      try {
        const folderPrefix = options.folder ? `${options.folder.replace(/\/$/, '')}/` : '';
        const fullKey = key.startsWith(folderPrefix) ? key : `${folderPrefix}${key}`;
        const localDir = path.resolve(process.cwd(), 'uploads', path.dirname(fullKey));
        fs.mkdirSync(localDir, { recursive: true });
        const localFilePath = path.resolve(process.cwd(), 'uploads', fullKey);
        fs.writeFileSync(localFilePath, buffer);
        logger.info({ key: fullKey, localFilePath }, '[Storage] Uploaded object successfully via local storage fallback');
        return {
          provider: 'local',
          bucket: 'local',
          key: fullKey,
          url: `/uploads/${fullKey}`
        };
      } catch (localErr: any) {
        logger.error({ err: localErr?.message || localErr, gcsError: gcsErrMsg, key }, '[Storage] Local storage fallback failed');
        throw new ApiError(500, `Storage upload failed: GCS error (${gcsErrMsg}) | Local fallback error (${localErr?.message || 'failed'})`, 'STORAGE_UPLOAD_FAILED');
      }
    }
  }

  /**
   * Delete file from GCS
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const file = this.bucket.file(key);
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        logger.info({ key }, '[GCS] Object deleted successfully');
      }
    } catch (error: any) {
      logger.error({ err: error?.message || error, key }, '[GCS] Delete object failed');
      throw new ApiError(500, `GCS delete failed: ${error?.message || 'Unknown error'}`, 'GCS_DELETE_FAILED');
    }
  }

  /**
   * Move / rename object within GCS bucket
   */
  async moveFile(srcKey: string, destKey: string): Promise<void> {
    try {
      const srcFile = this.bucket.file(srcKey);
      await srcFile.move(destKey);
      logger.info({ srcKey, destKey }, '[GCS] Object moved successfully');
    } catch (error: any) {
      logger.error({ err: error?.message || error, srcKey, destKey }, '[GCS] Move object failed');
      throw new ApiError(500, `GCS move failed: ${error?.message || 'Unknown error'}`, 'GCS_MOVE_FAILED');
    }
  }

  /**
   * Copy object within GCS bucket
   */
  async copyFile(srcKey: string, destKey: string): Promise<void> {
    try {
      const srcFile = this.bucket.file(srcKey);
      await srcFile.copy(this.bucket.file(destKey));
      logger.info({ srcKey, destKey }, '[GCS] Object copied successfully');
    } catch (error: any) {
      logger.error({ err: error?.message || error, srcKey, destKey }, '[GCS] Copy object failed');
      throw new ApiError(500, `GCS copy failed: ${error?.message || 'Unknown error'}`, 'GCS_COPY_FAILED');
    }
  }

  /**
   * Check if file exists in GCS
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const file = this.bucket.file(key);
      const [exists] = await file.exists();
      return exists;
    } catch (error: any) {
      logger.warn({ err: error?.message || error, key }, '[GCS] fileExists check failed');
      return false;
    }
  }

  /**
   * Generate V4 signed URL for secure file reading
   */
  async getSignedUrl(
    key: string,
    options: {
      resourceType?: 'image' | 'raw';
      expiresInSeconds?: number;
      mimeType?: string;
      action?: 'read' | 'write';
    } = {}
  ): Promise<string> {
    try {
      const file = this.bucket.file(key);
      const expiresIn = options.expiresInSeconds || 15 * 60; // default 15 minutes
      const action = options.action || 'read';

      const isInlineType =
        options.mimeType?.startsWith('image/') ||
        options.mimeType === 'application/pdf' ||
        /\.(pdf|png|jpg|jpeg|gif|webp|svg)$/i.test(key);

      const responseDisposition = (options as any).disposition
        ? (options as any).disposition
        : (isInlineType ? 'inline' : 'attachment');

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action,
        expires: Date.now() + expiresIn * 1000,
        responseDisposition
      });

      return url;
    } catch (error: any) {
      logger.warn({ err: error?.message || error, key }, '[GCS] getSignedUrl failed or credentials missing. Falling back to local URL.');
      return key.startsWith('/') ? key : `/uploads/${key}`;
    }
  }

  /**
   * Alias for generateSignedUrl requirement
   */
  async generateSignedUrl(
    key: string,
    options: { expiresInSeconds?: number; mimeType?: string; action?: 'read' | 'write' } = {}
  ): Promise<string> {
    return this.getSignedUrl(key, options);
  }

  /**
   * Construct canonical GCS public URL
   */
  getPublicUrl(key: string): string {
    const bucketName = getGCSBucketName();
    return `https://storage.googleapis.com/${bucketName}/${key}`;
  }

  /**
   * Stream download helper
   */
  createReadStream(key: string): Readable {
    return this.bucket.file(key).createReadStream();
  }
}

export const gcpStorageProvider = new GCPStorageService();
