import { ApiError } from '../../utils/ApiError.js';
import type { StorageProvider } from './storage.service.js';

export const gcpStorageProvider: StorageProvider = {
  name: 'gcp',

  async uploadFile() {
    throw new ApiError(501, 'GCP storage provider is not configured yet', 'GCP_STORAGE_NOT_CONFIGURED');
  },

  async deleteFile() {
    throw new ApiError(501, 'GCP storage provider is not configured yet', 'GCP_STORAGE_NOT_CONFIGURED');
  },

  async getSignedUrl() {
    throw new ApiError(501, 'GCP storage provider is not configured yet', 'GCP_STORAGE_NOT_CONFIGURED');
  }
};
