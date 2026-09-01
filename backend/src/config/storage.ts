import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/m4a',
  'audio/mp4',
  'audio/aac'
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new ApiError(400, 'Unsupported file type'));
    }
    callback(null, true);
  }
});
