import type { NextFunction, Request, Response } from 'express';
import { stripControlCharacters } from '../utils/sanitize.js';

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') return stripControlCharacters(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, nestedValue]) => {
    if (key.includes('\0') || key.startsWith('$') || key.includes('.')) return acc;
    acc[key] = sanitizeValue(nestedValue);
    return acc;
  }, {});
};

export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  req.body = sanitizeValue(req.body) as any;
  req.params = sanitizeValue(req.params) as any;
  req.query = sanitizeValue(req.query) as any;
  next();
};
