import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const weakPasswords = new Set([
  'password',
  'password123',
  'password123!',
  'admin123',
  'admin@123',
  'qwerty123',
  'welcome123',
  'letmein123',
  'jsgsmile123',
  'msme123456'
]);

const SERVER_PEPPER = process.env.PASSWORD_PEPPER || env.FIELD_ENCRYPTION_KEY || 'msme_auth_pepper_default_2026';

export const preHashWithPepper = (password: string): string => {
  return crypto.createHmac('sha256', SERVER_PEPPER).update(password).digest('hex');
};

export const validatePasswordStrength = (password: string) => {
  const errors: string[] = [];
  const normalized = password.trim();

  if (normalized.length < 12) errors.push('Password must be at least 12 characters');
  if (!/[A-Z]/.test(normalized)) errors.push('Password must include an uppercase letter');
  if (!/[a-z]/.test(normalized)) errors.push('Password must include a lowercase letter');
  if (!/\d/.test(normalized)) errors.push('Password must include a number');
  if (!/[^A-Za-z0-9]/.test(normalized)) errors.push('Password must include a special character');
  if (weakPasswords.has(normalized.toLowerCase())) errors.push('Password is too common');
  if (/(.)\1{3,}/.test(normalized)) errors.push('Password cannot contain repeated character runs');

  return {
    ok: errors.length === 0,
    errors
  };
};

export const hashPassword = (password: string) => bcrypt.hash(preHashWithPepper(password), env.BCRYPT_COST);

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  // Primary check: against modern peppered hash (anti-GPU rainbow table)
  const matchesPeppered = await bcrypt.compare(preHashWithPepper(password), hash);
  if (matchesPeppered) return true;
  // Fallback check: transparently verify legacy unpeppered bcrypt hash
  return bcrypt.compare(password, hash);
};
