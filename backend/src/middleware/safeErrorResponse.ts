import type { NextFunction, Request, Response } from 'express';
import { maskSensitive } from '../utils/maskSensitive.js';

export const safeErrorResponse = (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = (body?: any) => {
    if (res.statusCode >= 500) {
      const safeBody = {
        success: false,
        message: 'Internal server error'
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
