/**
 * Helper that uploads a single file to the existing /api/upload endpoint and
 * returns the FileAsset row, which can then be attached to a delivery.
 */

import { authHeaders } from '../shared/apiClient';

export interface UploadedFileAsset {
  id: number;
  originalName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
}

export const uploadDeliveryFile = async (file: File): Promise<UploadedFileAsset> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', 'delivery');
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error || 'File upload failed');
  }
  const asset = body?.data ?? body;
  if (!asset?.id) throw new Error('Upload response did not include a file id');
  return asset as UploadedFileAsset;
};
