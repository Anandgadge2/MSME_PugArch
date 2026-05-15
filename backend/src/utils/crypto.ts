import crypto from 'crypto';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const createHashFingerprint = (value: unknown, namespace = 'global') => {
  const normalized = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!normalized) return '';
  return sha256(`${namespace}:${normalized}`);
};

export const timingSafeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};
