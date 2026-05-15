import { Readable } from 'stream';
import { cloudinary } from '../../config/cloudinary.js';
import { ApiError } from '../../utils/ApiError.js';
import type { StorageProvider, StorageUploadInput, StorageUploadResult } from './storage.service.js';

const uploadBuffer = (input: StorageUploadInput) =>
  new Promise<StorageUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: input.key,
        folder: input.folder,
        resource_type: input.resourceType,
        type: 'authenticated',
        overwrite: false,
        use_filename: false,
        unique_filename: false,
        access_mode: 'authenticated',
        context: {
          ownerId: String(input.context.ownerId),
          ownerRole: input.context.ownerRole,
          entityType: input.context.entityType,
          entityId: input.context.entityId ? String(input.context.entityId) : ''
        }
      },
      (error, result) => {
        if (error || !result) return reject(error || new ApiError(500, 'Cloudinary upload failed'));
        resolve({
          provider: 'cloudinary',
          bucket: input.folder,
          key: result.public_id,
          url: result.secure_url
        });
      }
    );

    Readable.from(input.buffer).pipe(stream);
  });

export const cloudinaryStorageProvider: StorageProvider = {
  name: 'cloudinary',

  uploadFile(input) {
    return uploadBuffer(input);
  },

  async deleteFile(key, resourceType = 'raw') {
    await cloudinary.uploader.destroy(key, {
      resource_type: resourceType,
      type: 'authenticated'
    });
  },

  async getSignedUrl(key, options) {
    return cloudinary.url(key, {
      resource_type: options.resourceType,
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + options.expiresInSeconds,
      transformation: options.resourceType === 'image' ? [{ flags: 'attachment' }] : undefined
    });
  }
};
