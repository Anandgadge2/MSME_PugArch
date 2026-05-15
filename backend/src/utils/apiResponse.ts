import type { Response } from 'express';

export const apiResponse = {
  success<T>(res: Response, data: T, statusCode = 200, message = 'OK') {
    return res.status(statusCode).json({ success: true, message, data });
  },

  created<T>(res: Response, data: T, message = 'Created') {
    return this.success(res, data, 201, message);
  },

  error(res: Response, statusCode: number, message: string, code?: string, details?: unknown) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(code ? { code } : {}),
      ...(details ? { details } : {})
    });
  }
};
