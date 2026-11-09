import type { NextFunction, Request, Response } from 'express';
import { getAccessTokenFromRequest, getCsrfTokenFromRequest } from '../services/auth-cookie.service.js';
import crypto from 'crypto';
import { verifyAccessToken } from '../services/token.service.js';
import { timingSafeEqual } from '../utils/crypto.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/csrf-token',
  '/api/auth/login',
  '/api/auth/2fa/verify',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/send-email-otp',
  '/api/auth/verify-email-otp',
  '/api/auth/send-mobile-otp',
  '/api/auth/verify-mobile-otp',
  '/api/auth/forgot-password',
  '/api/auth/forgot-password/send-otp',
  '/api/auth/forgot-password/verify-otp',
  '/api/auth/reset-password',
  '/api/seller/register',
  '/api/buyer/register',
  '/api/shg/register',
  '/api/org/invite/signup'
]);

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'msme_csrf_hmac_secret_2026';

const rejectCsrf = (res: Response, message = 'Session CSRF verification failed') => {
  return res.status(403).json({
    success: false,
    error: 'CSRF_TOKEN_INVALID',
    code: 'CSRF_TOKEN_INVALID',
    errorCode: 'CSRF_TOKEN_INVALID',
    message,
    instruction: 'Please refresh the page and try again.'
  });
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.path.startsWith('/api')) return next();
  const requestPath = (req.originalUrl || req.path).split('?')[0].replace(/\/+$/, '');
  if ([...CSRF_EXEMPT_PATHS].some(path => requestPath === path || requestPath.endsWith(path))) return next();
  // Custom header protection: cross-site requests cannot set custom Authorization headers under CORS
  const authHeader = String(req.headers['authorization'] || '');
  if (authHeader.startsWith('Bearer ') && authHeader.slice(7).trim().length > 20) {
    return next();
  }

  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) return next();

  const cookieToken = getCsrfTokenFromRequest(req);
  const headerToken = String(req.headers['x-csrf-token'] || '');

  if (!cookieToken || !headerToken) {
    return rejectCsrf(res);
  }

  // 1. Double-submit cookie verification: match header token against cookie
  if (!timingSafeEqual(cookieToken, headerToken)) {
    return rejectCsrf(res);
  }

  // 2. Cryptographic session binding: verify HMAC-SHA256(userId:sessionVersion, CSRF_SECRET)
  try {
    const claims = verifyAccessToken(accessToken);
    if (!claims || !claims.id) {
      return rejectCsrf(res);
    }
    const sessionVersion = claims.sessionVersion !== undefined ? claims.sessionVersion : 1;
    const expectedSessionCsrf = crypto
      .createHmac('sha256', CSRF_SECRET)
      .update(`${claims.id}:${sessionVersion}`)
      .digest('hex');

    if (!timingSafeEqual(headerToken, expectedSessionCsrf) || !timingSafeEqual(cookieToken, expectedSessionCsrf)) {
      return rejectCsrf(res);
    }

    return next();
  } catch {
    return rejectCsrf(res);
  }


  /*
    return next();
  }

  // 2. Custom header protection: cross-site requests cannot set custom Authorization headers under CORS
  const authHeader = String(req.headers['authorization'] || '');
  if (authHeader.startsWith('Bearer ') && authHeader.slice(7).trim().length > 20) {
    return next();
  }

  // 3. Ambient cookie session with missing or mismatched CSRF token
  if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken)) {
    return apiResponse.error(res, 403, 'Invalid CSRF token', 'CSRF_TOKEN_INVALID');
  }

  */
};
