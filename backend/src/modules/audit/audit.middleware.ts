import type { Request, Response } from 'express';
import { auditLog } from './audit.service.js';

export const auditRequest = (action: string, entityType?: string) => {
  return (req: Request, res: Response, next: () => void) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        void auditLog({
          actorUserId: req.user?.id,
          action,
          entityType,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            method: req.method,
            path: req.originalUrl,
            params: req.params,
            query: req.query
          }
        });
      }
    });
    next();
  };
};
