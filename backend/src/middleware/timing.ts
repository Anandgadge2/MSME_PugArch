import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export const timingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  // Store performance markers on res.locals
  res.locals.perf = {
    start,
    dbDurationMs: 0,
    cacheHit: false
  };

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Math.round(Number(end - start) / 1_000_000);
    const dbDurationMs = res.locals.perf?.dbDurationMs || 0;
    const cacheStatus = res.locals.perf?.cacheHit ? 'HIT' : 'MISS';

    // Set Server-Timing response header if headers not yet sent
    try {
      if (!res.headersSent) {
        res.setHeader('Server-Timing', `total;dur=${durationMs}, db;dur=${dbDurationMs}, cache;desc=${cacheStatus}`);
      }
    } catch {
      // Ignore if headers sent
    }

    // Log structured timing for API routes taking longer than 300ms or in development
    if (durationMs > 300 && req.originalUrl?.startsWith('/api')) {
      logger.info({
        route: req.originalUrl?.split('?')[0],
        durationMs,
        dbDurationMs,
        cache: cacheStatus,
        statusCode: res.statusCode,
        method: req.method
      }, '[PerformanceTiming] API Route Duration');
    }
  });

  next();
};
