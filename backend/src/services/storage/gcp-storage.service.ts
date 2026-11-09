import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable, PassThrough } from 'stream';
import { getGCSBucket, getGCSBucketName } from '../../config/gcs.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import { getKmsProvider } from '../../utils/crypto.js';
import type { StorageProvider, StorageUploadInput, StorageUploadResult } from './storage.service.js';

export interface StorageUploadOptions {
  folder?: string;
  mimeType: string;
  originalName?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

export const ENVELOPE_MAGIC_PREFIX = 'MSME_ENV:v1:';
export const ALT_ENVELOPE_MAGIC_PREFIX = 'ENC:V1:';

const PUBLIC_PREFIXES = new Set([
  'banners',
  'company-logos',
  'products',
  'org-logos',
  'category-photos',
  'videos'
]);

const PUBLIC_ENTITY_TYPES = new Set([
  'banner',
  'organization_banner',
  'logo',
  'organization_logo',
  'company_logo',
  'product',
  'product_image',
  'catalogue',
  'catalogue_product',
  'catalogue_service',
  'category_photo',
  'video',
  'stamp',
  'signature',
  'invoice-branding',
  'public'
]);

const PRIVATE_CATEGORIES = new Set([
  'kyc',
  'document',
  'documents',
  'purchase-orders',
  'purchase_orders',
  'invoices',
  'quotations',
  'bank',
  'pbg',
  'cheques',
  'gst',
  'cancelled_cheque',
  'gst_certificate',
  'performance_guarantee',
  'aadhaar',
  'pan',
  'buyer',
  'buyers',
  'buyer_document',
  'seller',
  'sellers',
  'seller_document',
  'tax_filing',
  'contract',
  'contracts',
  'po',
  'quote',
  'billing',
  'bank_guarantee',
  'bank_cheque',
  'bank_passbook'
]);

/**
 * Determine whether a document falls under private categories requiring envelope encryption.
 * Private documents: KYC, GST certificates, cancelled cheques, PBG, invoices, POs, quotations, bank records.
 * Public documents: banners, company-logos, products, org-logos, etc.
 */
export function isPrivateDocument(
  options: Partial<StorageUploadOptions> = {},
  key: string = ''
): boolean {
  if (!options) options = {};
  if (options.isPublic === true) return false;

  const folder = (options.folder || '').toLowerCase().trim().replace(/\\/g, '/').replace(/^\/+/, '');
  const folderFirst = folder.split('/')[0].trim().replace(/\/+$/, '');
  const entityType = (options.metadata?.entityType || '').toLowerCase().trim();
  const cleanKey = (key || '').toLowerCase().trim().replace(/\\/g, '/').replace(/^\/+/, '');
  const keyFirst = cleanKey.split('/')[0].trim().replace(/\/+$/, '');

  // Explicit public check
  if (PUBLIC_PREFIXES.has(folderFirst) || PUBLIC_PREFIXES.has(keyFirst) || PUBLIC_ENTITY_TYPES.has(entityType)) {
    return false;
  }

  // Exact private match
  if (
    PRIVATE_CATEGORIES.has(folderFirst) ||
    PRIVATE_CATEGORIES.has(keyFirst) ||
    PRIVATE_CATEGORIES.has(entityType)
  ) {
    return true;
  }

  // Substring checks for compound identifiers
  const privateKeywords = [
    'kyc',
    'document',
    'documents',
    'purchase-orders',
    'purchase_orders',
    'invoices',
    'quotations',
    'bank',
    'pbg',
    'cheques',
    'gst',
    'cancelled_cheque',
    'gst_certificate',
    'performance_guarantee',
    'aadhaar',
    'pan',
    'seller',
    'sellers',
    'seller_document',
    'buyer',
    'buyers',
    'buyer_document'
  ];

  if (privateKeywords.some(kw => folderFirst.includes(kw) || keyFirst.includes(kw) || entityType.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Detect whether buffer starts with envelope encryption header
 */
export function isEnvelopeEncrypted(buffer: Buffer): boolean {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 7) return false;
  return (
    buffer.subarray(0, ENVELOPE_MAGIC_PREFIX.length).toString('utf8') === ENVELOPE_MAGIC_PREFIX ||
    buffer.subarray(0, ALT_ENVELOPE_MAGIC_PREFIX.length).toString('utf8') === ALT_ENVELOPE_MAGIC_PREFIX
  );
}

/**
 * Encrypt a plaintext buffer using AES-256-GCM envelope encryption with master KEK.
 * Header format: MSME_ENV:v1:<encDek>:<ivHex>:<tagHex>\n<ciphertext>
 */
export async function encryptBufferEnvelope(buffer: Buffer): Promise<Buffer> {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv, { authTagLength: 16 });
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    const kms = getKmsProvider();
    const encDek = await Promise.resolve(kms.encryptDek(dek));

    const headerStr = `MSME_ENV:v1:${encDek}:${iv.toString('hex')}:${tag.toString('hex')}\n`;
    const header = Buffer.from(headerStr, 'utf8');

    return Buffer.concat([header, ciphertext]);
  } finally {
    // CWE-226: Overwrite ephemeral DEK memory buffer with zeros
    dek.fill(0);
  }
}

/**
 * Decrypt an envelope-encrypted buffer transparently.
 * Unwraps DEK via kmsProvider.decryptDek, deciphers AES-256-GCM ciphertext, verifies auth tag.
 * Legacy and unencrypted buffers pass through untouched.
 */
export async function decryptBufferEnvelope(buffer: Buffer): Promise<Buffer> {
  if (!buffer || !Buffer.isBuffer(buffer) || !isEnvelopeEncrypted(buffer)) {
    return buffer;
  }

  const newlineIdx = buffer.indexOf('\n');
  if (newlineIdx === -1) {
    throw new ApiError(500, 'Invalid envelope encryption header format: newline delimiter missing', 'DECRYPTION_FAILED');
  }

  const headerStr = buffer.subarray(0, newlineIdx).toString('utf8').replace(/[\r\n]+$/, '');
  const tokens = headerStr.split(':').filter(t => t.length > 0);

  // Expected tokens:
  // tokens[0] = 'MSME_ENV' or 'ENC'
  // tokens[1] = 'v1' or 'V1'
  // tokens[tokens.length - 2] = ivHex (24 hex characters)
  // tokens[tokens.length - 1] = tagHex (32 hex characters)
  // tokens in between: encDek components (ivB64:tagB64:cipherB64)
  if (tokens.length < 5) {
    throw new ApiError(500, 'Corrupted envelope encryption header', 'DECRYPTION_FAILED');
  }

  const tagHex = tokens[tokens.length - 1];
  const ivHex = tokens[tokens.length - 2];
  const encDek = tokens.slice(2, tokens.length - 2).join(':');

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = buffer.subarray(newlineIdx + 1);

  const kms = getKmsProvider();
  const dek = await Promise.resolve(kms.decryptDek(encDek));

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return plaintext;
  } catch (err: any) {
    logger.error({ err: err?.message || err }, '[EnvelopeDecryption] Failed to decrypt envelope ciphertext');
    throw new ApiError(500, 'Envelope decryption failed: Authentication tag verification failed or key invalid', 'DECRYPTION_FAILED');
  } finally {
    // CWE-226: Overwrite unwrapped ephemeral DEK memory buffer with zeros
    if (Buffer.isBuffer(dek)) {
      dek.fill(0);
    }
  }
}

let cachedClockSkewMs = 0;
let lastSkewCheck = 0;

export async function getGcsClockSkewMs(): Promise<number> {
  const now = Date.now();
  if (now - lastSkewCheck < 10 * 60 * 1000 && lastSkewCheck > 0) {
    return cachedClockSkewMs;
  }
  try {
    const res = await fetch('https://storage.googleapis.com', { method: 'HEAD' });
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      if (!isNaN(serverTime)) {
        cachedClockSkewMs = serverTime - Date.now();
        lastSkewCheck = now;
      }
    }
  } catch {
    // Keep existing cachedClockSkewMs if fetch fails
  }
  return cachedClockSkewMs;
}

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
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const bucketName = getGCSBucketName();
      const folderPrefix = options.folder ? `${options.folder.replace(/\/$/, '')}/` : '';
      const fullKey = key.startsWith(folderPrefix) ? key : `${folderPrefix}${key}`;
      
      const file = this.bucket.file(fullKey);

      const isPrivate = isPrivateDocument(options, fullKey);
      const saveBuffer = isPrivate && !isEnvelopeEncrypted(buffer)
        ? await encryptBufferEnvelope(buffer)
        : buffer;

      await file.save(saveBuffer, {
        contentType: options.mimeType,
        resumable: false,
        metadata: {
          contentType: options.mimeType,
          metadata: {
            originalName: options.originalName || '',
            ...(options.metadata || {}),
            ...(isPrivate ? { encrypted: 'true', encryptionScheme: 'AES-256-GCM-ENVELOPE-v1' } : {})
          }
        }
      });

      if (options.isPublic) {
        await file.makePublic().catch(() => {
          // Uniform bucket-level access might prevent per-object ACL, which is normal
        });
      }

      // Persist local disk copy for fast retrieval and hybrid local fallback
      try {
        const localDir = path.resolve(process.cwd(), 'uploads', path.dirname(fullKey));
        fs.mkdirSync(localDir, { recursive: true });
        const localFilePath = path.resolve(process.cwd(), 'uploads', fullKey);
        fs.writeFileSync(localFilePath, saveBuffer);
      } catch (_diskErr) {
        // Non-fatal local cache mirror write failure
      }

      const publicUrl = this.getPublicUrl(fullKey);

      logger.info({ bucket: bucketName, key: fullKey, encrypted: isPrivate }, '[GCS] Uploaded object successfully');

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

        const isPrivate = isPrivateDocument(options, fullKey);
        const saveBuffer = isPrivate && !isEnvelopeEncrypted(buffer)
          ? await encryptBufferEnvelope(buffer)
          : buffer;

        fs.writeFileSync(localFilePath, saveBuffer);
        logger.info({ key: fullKey, localFilePath, encrypted: isPrivate }, '[Storage] Uploaded object successfully via local storage fallback');
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

      const clockSkew = await getGcsClockSkewMs();
      const expirationTime = Date.now() + clockSkew + expiresIn * 1000;

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action,
        expires: expirationTime,
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
   * Helper to obtain raw byte stream from local disk or GCS bucket
   */
  getRawReadStream(key: string): Readable {
    const localCandidates = [
      path.resolve(process.cwd(), 'uploads', key),
      path.resolve(process.cwd(), 'backend/uploads', key),
      path.resolve(process.cwd(), key)
    ];
    for (const cand of localCandidates) {
      if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
        return fs.createReadStream(cand);
      }
    }
    return this.bucket.file(key).createReadStream();
  }

  /**
   * Stream download helper with transparent envelope decryption.
   * If envelope encrypted: unwraps DEK via kmsProvider, verifies auth tag, decrypts ciphertext,
   * zeroizes ephemeral DEK, and streams plaintext.
   * Unencrypted legacy and public files pass through untouched.
   */
  createReadStream(key: string): Readable {
    const outStream = new PassThrough();

    (async () => {
      try {
        const rawStream = this.getRawReadStream(key);
        rawStream.on('error', (err) => outStream.destroy(err));

        const chunks: Buffer[] = [];
        for await (const chunk of rawStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const fullBuffer = Buffer.concat(chunks);

        if (isEnvelopeEncrypted(fullBuffer)) {
          const decrypted = await decryptBufferEnvelope(fullBuffer);
          outStream.end(decrypted);
        } else {
          outStream.end(fullBuffer);
        }
      } catch (err: any) {
        outStream.destroy(err);
      }
    })();

    return outStream;
  }

  /**
   * Helper to retrieve decrypted file buffer directly
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    const stream = this.createReadStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

export const gcpStorageProvider = new GCPStorageService();
