import type { NextFunction, Request, Response } from 'express';
import type { Permission } from '../constants/permissions.js';
import { apiResponse } from '../utils/apiResponse.js';
import prisma from '../lib/prisma.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { getAccountTypeForUser, getCurrentUserPermissions, isMasterAdmin, userHasPermission, type RbacScope } from '../services/rbac.service.js';

const LEGACY_ROLE_TO_ACCOUNT_TYPE: Record<string, string> = {
  master_admin: 'MASTER_ADMIN',
  admin: 'SUPERADMIN',
  superadmin: 'SUPERADMIN',
  collector: 'SUPERADMIN',
  seller: 'SELLER',
  buyer: 'BUYER',
  shg: 'SHG'
};

const normalizeAccountType = (value: string) => LEGACY_ROLE_TO_ACCOUNT_TYPE[value] || value;

export const requireAccountType = (...accountTypes: string[]) => {
  const allowed = accountTypes.map(normalizeAccountType);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return apiResponse.error(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    }

    const account = getAccountTypeForUser(req.user);
    const currentAccountType = account.accountType || '';
    // SHGs are supplier accounts throughout catalogue, bidding, fulfilment,
    // payments, and messaging. A SELLER gate therefore includes SHG while an
    // SHG-only gate remains restricted to dedicated SHG workflows.
    const isShgSupplier = currentAccountType === 'SHG' && allowed.includes('SELLER');
    if (!isMasterAdmin(req.user) && !allowed.includes(currentAccountType) && !isShgSupplier) {
      return apiResponse.error(res, 403, 'Access denied', 'ACCESS_DENIED');
    }

    return next();
  };
};

/**
 * Compatibility alias for broad account-category gates only. Business actions
 * must use requirePermission() so authorization is resolved from RBAC tables.
 */
export const authorize = requireAccountType;
export const requireRole = authorize;
export const checkRole = authorize;

type PermissionOptions = {
  scopeType?: 'PLATFORM' | 'DISTRICT' | 'ORGANIZATION';
  getScopeId?: (req: Request) => string | number | null | undefined;
};

const resolvePermissionScope = (req: Request, options?: PermissionOptions): RbacScope | undefined => {
  if (!options?.scopeType) return (req as any).rbacScope || req.user?.activeScope;
  return {
    scopeType: options.scopeType,
    scopeId: options.getScopeId ? options.getScopeId(req) ?? null : null
  };
};

export const requirePermission = (permission: Permission | string, options?: PermissionOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return apiResponse.error(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    }

    try {
      const scope = resolvePermissionScope(req, options);
      const permissions = await getCurrentUserPermissions(req.user.id, scope);
      const permStr = String(permission);
      const permUpper = permStr.toUpperCase().replace(/\./g, '_');
      const permLower = permStr.toLowerCase().replace(/_/g, '.');
      const allowed = isMasterAdmin(req.user) ||
        permissions.includes('*') ||
        permissions.includes(permStr) ||
        permissions.includes(permUpper) ||
        permissions.includes(permLower);
      if (!allowed) {
        return apiResponse.error(res, 403, `Missing permission: ${permission}`, 'PERMISSION_DENIED', { requiredPermission: permission });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const checkPermission = requirePermission;

export const requireScopedPermission = (permission: Permission | string, scopeResolver?: (req: Request) => RbacScope | undefined) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return apiResponse.error(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    try {
      const scope = scopeResolver?.(req) || (req as any).rbacScope || req.user.activeScope;
      if (!(await userHasPermission(req.user as any, String(permission), scope))) {
        return apiResponse.error(res, 403, `Missing permission: ${permission}`, 'PERMISSION_DENIED', { requiredPermission: permission });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const authorizeAdmin = requireAccountType('SUPERADMIN', 'MASTER_ADMIN');

export const checkFeatureEnabled = (featureCode: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return apiResponse.error(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    if (isMasterAdmin(req.user) || req.user.role === 'admin') return next();

    try {
      if (featureCode === 'admin-bid-approval') {
        const disabledRecord = await prisma.platformFeature.findFirst({
          where: { enabled: false, feature: { code: featureCode } },
          select: { featureId: true }
        });
        if (disabledRecord) return apiResponse.error(res, 403, 'Feature is disabled for this platform', 'FEATURE_DISABLED');
        return next();
      }

      const enabled = await prisma.platformFeature.findFirst({
        where: { enabled: true, feature: { code: featureCode } },
        select: { featureId: true }
      });
      if (!enabled) return apiResponse.error(res, 403, 'Feature is disabled for this platform', 'FEATURE_DISABLED');
      return next();
    } catch (err) {
      console.warn(`[checkFeatureEnabled] Feature check failed for '${featureCode}', allowing request:`, (err as any)?.message || err);
      return next();
    }
  };
};

export const getCurrentCompany = async (req: Request) => {
  return null;
};

export const canAccessOrganization = async (req: Request, organizationId: number) => {
  if (!req.user) return false;
  if (isMasterAdmin(req.user)) return true;
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, district: true }
  });
  if (!organization) return false;
  if (req.user.organizationId && req.user.organizationId === organizationId) return true;
  // A district administrator may only access organisations assigned to the
  // same district. Missing scope fails closed instead of granting every
  // legacy admin platform-wide access.
  if (req.user.role !== 'admin' || !organization.district) return false;
  const districtAssignment = await prisma.userRole.findFirst({
    where: {
      userId: req.user.id,
      isActive: true,
      scopeType: 'DISTRICT',
      scopeId: organization.district,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    select: { id: true }
  });
  return Boolean(districtAssignment);
};

export const createAuditLog = (req: Request, payload: {
  action: string;
  entityType?: string;
  entityId?: number | string;
  metadata?: Record<string, unknown>;
}) =>
  auditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: {  ...(payload.metadata || {}) }
  });
