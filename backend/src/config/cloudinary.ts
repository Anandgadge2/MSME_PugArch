import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

export const configureCloudinary = () => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    console.warn('[Cloudinary] configuration missing');
    return false;
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET
  });

  return true;
};

export { cloudinary };
