import type { Request } from 'express';
import { auditLog } from '../audit/audit.service.js';

export const auditAuthEvent = (req: Request, action: string, metadata?: Record<string, unknown>) =>
  auditLog({
    actorUserId: req.user?.id,
    action,
    entityType: 'auth',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    metadata
  });
