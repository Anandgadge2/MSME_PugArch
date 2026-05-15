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
  'pugarch123',
  'msme123456'
]);

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

export const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_COST);

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
