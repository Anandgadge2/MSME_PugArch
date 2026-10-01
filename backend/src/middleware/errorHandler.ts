import type { ErrorRequestHandler } from 'express';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { apiResponse } from '../utils/apiResponse.js';

export const notFoundHandler: ErrorRequestHandler = (err, _req, _res, next) => next(err);

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : Number(err?.statusCode || 500);
  const message = err instanceof ApiError || statusCode < 500 ? err.message : 'Internal server error';
  const reqId = (req as any)?.id || (req as any)?.requestId || res.getHeader('x-request-id');

  if (statusCode >= 500) {
    const errorPayload = {
      timestamp: new Date().toISOString(),
      level: 'error',
      requestId: reqId,
      path: req.originalUrl || req.url,
      method: req.method,
      statusCode,
      code: err?.code || 'INTERNAL_ERROR',
      message: err?.message || 'Internal server error',
      stack: isProduction ? undefined : err?.stack
    };
    console.error('[ErrorHandler]', JSON.stringify(errorPayload));
  }

  return apiResponse.error(
    res,
    statusCode,
    message,
    err?.code,
    (isProduction && statusCode >= 500) ? undefined : err?.details
  );
};
