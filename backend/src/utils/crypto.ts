import crypto from 'crypto';
import { env } from '../config/env.js';

const CIPHER_ALGORITHM = 'aes-256-gcm';
const GCM_IV_LENGTH = 12; // 96-bit IV recommended by NIST SP 800-38D
const GCM_TAG_LENGTH = 16; // 128-bit authentication tag
const ENCRYPTED_PREFIX = 'enc:v1:';

export const isEncrypted = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);

export const encryptField = (plaintext: string | null | undefined, customKeyHex?: string): string => {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return plaintext as any;
  }

  const text = String(plaintext);
  // Avoid double-encryption
  if (isEncrypted(text)) {
    return text;
  }

  const keyHex = customKeyHex || env.FIELD_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('Encryption key must be exactly 64 hexadecimal characters (32 bytes).');
  }

  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv, { authTagLength: GCM_TAG_LENGTH });

  const ciphertext = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
};

export const decryptField = (encryptedValue: string | null | undefined, customKeyHex?: string): string => {
  if (encryptedValue === null || encryptedValue === undefined || encryptedValue === '') {
    return encryptedValue as any;
  }

  const text = String(encryptedValue);
  // If not encrypted, return as-is for transparent backward compatibility
  if (!isEncrypted(text)) {
    return text;
  }

  const parts = text.split(':');
  if (parts.length !== 5) {
    return text;
  }

  const [, , ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');

  const keysToTry = [
    customKeyHex || env.FIELD_ENCRYPTION_KEY,
    env.FIELD_ENCRYPTION_KEY_FALLBACK
  ].filter((k): k is string => Boolean(k && k.length === 64));

  for (const keyHex of keysToTry) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, key, iv, { authTagLength: GCM_TAG_LENGTH });
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch {
      // Try next key if fallback key exists (e.g. during key rotation)
    }
  }

  console.error('[DecryptionError] Authentication tag verification failed or invalid key.');
  return text;
};

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

export const generateSecureTemporaryPassword = (length = 12): string => {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%&*';
  const allChars = uppers + lowers + digits + specials;

  const randomBytesArr = crypto.randomBytes(length);
  const passwordChars = [
    uppers[randomBytesArr[0] % uppers.length],
    lowers[randomBytesArr[1] % lowers.length],
    digits[randomBytesArr[2] % digits.length],
    specials[randomBytesArr[3] % specials.length],
  ];

  for (let i = 4; i < length; i++) {
    passwordChars.push(allChars[randomBytesArr[i] % allChars.length]);
  }

  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomBytes(1)[0] % (i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
};

