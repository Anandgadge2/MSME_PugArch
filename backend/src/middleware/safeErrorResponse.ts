import type { NextFunction, Request, Response } from 'express';
import { maskSensitive } from '../utils/maskSensitive.js';

export const safeErrorResponse = (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = (body?: any) => {
    if (res.statusCode >= 500) {
      const safeMessage = typeof body?.message === 'string' && (
        body.message.includes('Database schema is not up to date') ||
        body.message.includes('Database is temporarily unavailable')
      )
        ? body.message
        : 'Internal server error';

      const safeBody = {
        success: false,
        message: safeMessage,
        ...(typeof body?.code === 'string' ? { code: body.code } : {})
      };
      return originalJson(maskSensitive(safeBody));
    }

    if (res.statusCode >= 400) {
      return originalJson(maskSensitive(body));
    }

    return originalJson(body);
  };

  next();
};
