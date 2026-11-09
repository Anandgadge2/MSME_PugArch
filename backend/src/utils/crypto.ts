import crypto from 'crypto';
import { env } from '../config/env.js';

const CIPHER_ALGORITHM = 'aes-256-gcm';
const GCM_IV_LENGTH = 12; // 96-bit IV recommended by NIST SP 800-38D
const GCM_TAG_LENGTH = 16; // 128-bit authentication tag
const ENCRYPTED_PREFIX = 'enc:v1:';

export const isEncrypted = (value: unknown): boolean =>
  typeof value === 'string' && (value.startsWith(ENCRYPTED_PREFIX) || value.startsWith('ENC:V1:') || value.toLowerCase().startsWith('enc:v1:'));

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
  try {
    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv, { authTagLength: GCM_TAG_LENGTH });

    const ciphertext = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();
    const keyId = 'kid-2026a';

    return `${ENCRYPTED_PREFIX}${keyId}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  } finally {
    // CWE-226: Zero out memory buffer immediately after cryptographic use
    key.fill(0);
  }
};

export const decryptField = (encryptedValue: string | null | undefined, customKeyHex?: string): string => {
  if (encryptedValue === null || encryptedValue === undefined || encryptedValue === '') {
    return encryptedValue as any;
  }

  let text = String(encryptedValue).trim();
  // If not encrypted, return as-is for transparent backward compatibility
  if (!isEncrypted(text)) {
    return text;
  }

  if (text.startsWith('ENC:V1:')) {
    text = 'enc:v1:' + text.slice('ENC:V1:'.length);
  }

  const parts = text.split(':');
  let ivB64: string, tagB64: string, cipherB64: string;

  if (parts.length === 5) {
    // Legacy 5-part format: enc:v1:<iv>:<tag>:<ciphertext>
    [, , ivB64, tagB64, cipherB64] = parts;
  } else if (parts.length === 6) {
    // Key-versioned 6-part format: enc:v1:<keyId>:<iv>:<tag>:<ciphertext>
    [, , , ivB64, tagB64, cipherB64] = parts;
  } else {
    return text;
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');

  const defaultDerivedKey = crypto.createHash('sha256').update(env.JWT_SECRET || 'dev_master_key_msme_pugarch_2026').digest('hex');
  const legacyFallbackKey = '18f6417f99fffab68c3c6c039b47a5dfd148b746550e51f6766afddae8fed7bc';

  const keysToTry = [
    customKeyHex || env.FIELD_ENCRYPTION_KEY,
    env.FIELD_ENCRYPTION_KEY_FALLBACK,
    defaultDerivedKey,
    legacyFallbackKey
  ].filter((k): k is string => Boolean(k && k.length === 64));

  for (const keyHex of keysToTry) {
    const key = Buffer.from(keyHex, 'hex');
    try {
      const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, key, iv, { authTagLength: GCM_TAG_LENGTH });
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch {
      // Try next key if fallback key exists (e.g. during key rotation)
    } finally {
      // CWE-226: Zero out ephemeral key buffer in memory
      key.fill(0);
    }
  }

  console.error('[DecryptionError] Authentication tag verification failed or invalid key.');
  return text;
};

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const SEARCH_INDEX_PEPPER = process.env.SEARCH_INDEX_PEPPER || env.FIELD_ENCRYPTION_KEY || 'msme_search_pepper_default_2026';

/**
 * Keyed HMAC-SHA256 Blind Index / Deterministic Search Fingerprint (NIST SP 800-107)
 * Eliminates offline precomputed rainbow table and dictionary attacks.
 */
export const createKeyedBlindIndex = (value: unknown, namespace = 'global'): string => {
  const normalized = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!normalized) return '';
  return crypto.createHmac('sha256', SEARCH_INDEX_PEPPER).update(`${namespace}:${normalized}`).digest('hex');
};

export const createHashFingerprint = (value: unknown, namespace = 'global'): string => {
  return createKeyedBlindIndex(value, namespace);
};

export const createLegacyHashFingerprint = (value: unknown, namespace = 'global'): string => {
  const normalized = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!normalized) return '';
  return sha256(`${namespace}:${normalized}`);
};

export const getSearchFingerprints = (value: unknown, namespace = 'global'): string[] => {
  const keyed = createKeyedBlindIndex(value, namespace);
  const legacy = createLegacyHashFingerprint(value, namespace);
  return [keyed, legacy].filter(Boolean);
};


/**
 * NIST SP 800-108 / RFC 5869: Context-separated subkey derivation via HKDF-SHA256
 */
export const deriveSubkey = (masterKey: Buffer | string, context: string): Buffer => {
  const isString = typeof masterKey === 'string';
  const masterKeyBuf = isString ? Buffer.from(masterKey, 'hex') : masterKey;
  try {
    return Buffer.from(crypto.hkdfSync('sha256', masterKeyBuf, Buffer.alloc(0), Buffer.from(context, 'utf8'), 32));
  } finally {
    if (isString) {
      masterKeyBuf.fill(0);
    }
  }
};

/**
 * Pluggable KMS Key Provider Interface (NIST SP 800-57 / FIPS 140-3)
 * Decouples master cryptographic key management from local OS environment variables.
 */
export interface KmsKeyProvider {
  getKey(keyId?: string): Promise<Buffer> | Buffer;
  encryptDek(dek: Buffer): Promise<string> | string;
  decryptDek(encryptedDek: string): Promise<Buffer> | Buffer;
}

export class EnvironmentKmsProvider implements KmsKeyProvider {
  private keyHex: string;

  constructor(keyHex?: string) {
    this.keyHex = keyHex || env.FIELD_ENCRYPTION_KEY;
  }

  getKey(_keyId = 'kid-2026a'): Buffer {
    if (!this.keyHex || this.keyHex.length !== 64) {
      throw new Error('KMS provider: Master key must be 64 hexadecimal characters.');
    }
    return Buffer.from(this.keyHex, 'hex');
  }

  encryptDek(dek: Buffer): string {
    const masterKey = this.getKey();
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, masterKey, iv, { authTagLength: GCM_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decryptDek(encryptedDek: string): Buffer {
    const parts = encryptedDek.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted DEK format.');
    const [ivB64, tagB64, cipherB64] = parts;
    const masterKey = this.getKey();
    const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, masterKey, Buffer.from(ivB64, 'base64'), { authTagLength: GCM_TAG_LENGTH });
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(cipherB64, 'base64')), decipher.final()]);
  }
}

let activeKmsProvider: KmsKeyProvider = new EnvironmentKmsProvider();

export const setKmsProvider = (provider: KmsKeyProvider) => {
  activeKmsProvider = provider;
};

export const getKmsProvider = (): KmsKeyProvider => activeKmsProvider;

/**
 * Compute cryptographic HMAC audit log chain hash (CERT-In Directions 2022 / OWASP ASVS 7.1)
 */
export const computeAuditLogChainHash = (
  prevHash: string,
  entry: { action: string; userId?: number | null; entityType?: string | null; entityId?: number | null; timestamp: number | string },
  pepper?: string
): string => {
  const chainPepper = pepper || process.env.AUDIT_CHAIN_PEPPER || env.FIELD_ENCRYPTION_KEY || 'audit_merkle_chain_pepper_2026';
  const serialized = `${prevHash}:${entry.action}:${entry.userId || 0}:${entry.entityType || ''}:${entry.entityId || 0}:${entry.timestamp}`;
  return crypto.createHmac('sha256', chainPepper).update(serialized).digest('hex');
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
export const reencryptField = (ciphertext: string, targetKeyHex?: string): string => {
  if (!isEncrypted(ciphertext)) return ciphertext;
  const plaintext = decryptField(ciphertext);
  return encryptField(plaintext, targetKeyHex);
};
