import type { NextFunction, Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { verifyAccessToken } from '../services/token.service.js';
import { apiResponse } from '../utils/apiResponse.js';
import { auditLog } from '../modules/audit/audit.service.js';

export type AuthenticatedUser = {
  id: number;
  role: string;
  sessionVersion: number;
};

export type AuthRequest = Request & {
  user?: AuthenticatedUser;
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    void auditLog({
      action: 'security.unauthorized_access',
      entityType: 'api',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { path: req.originalUrl, method: req.method, reason: 'missing_token' }
    });
    return apiResponse.error(res, 401, 'Authentication token is required', 'AUTH_TOKEN_MISSING');
  }

  try {
    const decoded = verifyAccessToken(token);
    const userId = Number(decoded.id);
    const sessionVersion = Number(decoded.sessionVersion);
    if (!userId || !decoded.role || Number.isNaN(sessionVersion)) {
      return apiResponse.error(res, 401, 'Invalid authentication token', 'AUTH_TOKEN_INVALID');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, sessionVersion: true, lockedUntil: true }
    });

    if (!user || user.role !== decoded.role || user.sessionVersion !== sessionVersion) {
      void auditLog({
        actorUserId: userId || undefined,
        actorRole: String(decoded.role || ''),
        action: 'security.unauthorized_access',
        entityType: 'api',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { path: req.originalUrl, method: req.method, reason: 'invalid_session' }
      });
      return apiResponse.error(res, 401, 'Session expired. Please sign in again.', 'SESSION_INVALID');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return apiResponse.error(res, 423, 'Account is temporarily locked', 'ACCOUNT_LOCKED');
    }

    req.user = { id: user.id, role: user.role, sessionVersion: user.sessionVersion };
    return next();
  } catch {
    void auditLog({
      action: 'security.unauthorized_access',
      entityType: 'api',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { path: req.originalUrl, method: req.method, reason: 'invalid_token' }
    });
    return apiResponse.error(res, 401, 'Invalid authentication token', 'AUTH_TOKEN_INVALID');
  }
};
