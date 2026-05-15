import type { NextFunction, Request, Response } from 'express';
import { can, ROLE_PERMISSIONS, type Permission } from '../constants/permissions.js';
import { apiResponse } from '../utils/apiResponse.js';

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return apiResponse.error(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    }

    if (!roles.includes(req.user.role)) {
      return apiResponse.error(res, 403, 'Access denied', 'ACCESS_DENIED');
    }

    return next();
  };
};

export const requireRole = authorize;

export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return apiResponse.error(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    }

    if (!can(req.user, permission)) {
      return apiResponse.error(res, 403, 'Permission denied', 'PERMISSION_DENIED');
    }

    return next();
  };
};

export const authorizeAdmin = authorize('admin');
