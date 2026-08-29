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

