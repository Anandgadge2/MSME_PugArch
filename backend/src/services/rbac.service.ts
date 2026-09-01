import prisma from '../lib/prisma.js';
import { legacyRoleToAccountType } from '../constants/dynamic-rbac.js';

export type RbacScope = {
  scopeType?: 'PLATFORM' | 'DISTRICT' | 'ORGANIZATION' | 'GLOBAL' | 'COMPANY';
  scopeId?: string | number | null;
};

export const normalizeScope = (scope?: RbacScope) => {
  const scopeType = scope?.scopeType || undefined;
  const scopeId = scope?.scopeId === undefined || scope?.scopeId === null || scope?.scopeId === ''
    ? null
    : String(scope.scopeId);
  return { scopeType, scopeId };
};

const accountTypeCode = (accountType: unknown) => {
  if (!accountType) return null;
  if (typeof accountType === 'string') return accountType;
  if (typeof accountType === 'object' && 'code' in accountType) return String((accountType as any).code);
  return null;
};

export const getAccountTypeForUser = (user: { role?: string; accountType?: unknown; accountTypeId?: number | null }) => {
  if (user.role && ['seller', 'shg', 'buyer', 'admin', 'master_admin', 'financier'].includes(user.role)) {
    return legacyRoleToAccountType(user.role);
  }
  const code = accountTypeCode(user.accountType);
  if (code && typeof user.accountTypeId === 'number') {
    return { accountType: code, accountTypeId: user.accountTypeId };
  }
  return legacyRoleToAccountType(user.role);
};

export const isMasterAdmin = (user?: { role?: string; accountType?: unknown; accountTypeId?: number | null }) => {
  if (!user) return false;
  const account = getAccountTypeForUser(user);
  return user.role === 'master_admin' || account.accountType === 'MASTER_ADMIN' || account.accountTypeId === 0;
};

import { ALL_ORG_PERMISSION_KEYS, FALLBACK_ORG_ROLE_PERMISSIONS, expandOrgPermissions } from '../constants/org-permissions.js';
import { deleteCache, invalidateByPattern } from './cache.service.js';

export const invalidateUserAuthCache = async (userId: number | string) => {
  await invalidateByPattern(`*cache:auth:user:${userId}*`);
  await invalidateByPattern(`*user:${userId}*`);
  await invalidateByPattern(`*org:status*`);
  await invalidateByPattern(`*org:members*`);
  await invalidateByPattern(`*org:roles*`);
  await invalidateByPattern(`*permissions*`);
  await deleteCache(`/api/auth/me`).catch(() => undefined);
  await deleteCache(`/api/auth/me/permissions`).catch(() => undefined);
  await deleteCache(`/api/org/status`).catch(() => undefined);
  await deleteCache(`/api/org/members`).catch(() => undefined);
  await deleteCache(`/api/org/me`).catch(() => undefined);
};

export const invalidateRoleMembersAuthCache = async (roleId: number) => {
  try {
    const members = await prisma.orgMembership.findMany({
      where: { customRoleId: roleId },
      select: { userId: true }
    });
    for (const m of members) {
      await invalidateUserAuthCache(m.userId);
    }
  } catch (err) {
    console.error('[invalidateRoleMembersAuthCache] Failed to invalidate role members cache:', err);
  }
};

export const getCurrentUserPermissions = async (userId: number, scope?: RbacScope) => {
  const normalized = normalizeScope(scope);
  const now = new Date();
  const scopeFilters: any[] = [{ scopeType: 'PLATFORM', scopeId: null }, { scopeType: 'GLOBAL', scopeId: null }];

  if (normalized.scopeType) {
    scopeFilters.push({
      scopeType: normalized.scopeType,
      ...(normalized.scopeId === null ? { scopeId: null } : { scopeId: normalized.scopeId })
    });
  }

  const assignments = await (prisma as any).userRole.findMany({
    where: {
      userId,
      isActive: true,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ...(normalized.scopeType ? [{ OR: scopeFilters }] : [])
      ]
    },
    include: {
      role: {
        include: {
          permissions: {
            where: { allowed: true },
            include: { permission: true }
          }
        }
      }
    }
  });

  const assigned = assignments.flatMap((assignment: any) => {
    if (!assignment.role || assignment.role.status !== 'ACTIVE') return [];
    return assignment.role.permissions.map((rp: any) => rp.permission?.code).filter(Boolean);
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isSubUser: true, organizationId: true }
  });

  const orgPermissions: string[] = [];
  const defaults: string[] = [];

  if (user) {
    const orgIdNum = normalized.scopeType === 'ORGANIZATION' && normalized.scopeId
      ? Number(normalized.scopeId)
      : user.organizationId;

    let isOrgSubUser = Boolean(user.isSubUser);

    if (orgIdNum) {
      const membership = await prisma.orgMembership.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgIdNum } },
        include: {
          customRole: {
            include: {
              permissions: {
                where: { allowed: true }
              }
            }
          }
        }
      }).catch(() => null);

      if (membership && membership.isActive) {
        if (membership.customRoleId && membership.customRole && membership.customRole.isActive) {
          // Custom Role assigned to member: extract exactly the configured permissions from OrgRolePermission
          isOrgSubUser = true;
          const assignedKeys = membership.customRole.permissions.map((p: any) => p.permissionKey);
          orgPermissions.push('dashboard.view', ...expandOrgPermissions(assignedKeys));
        } else if (membership.orgRole === 'ORG_ADMIN' && !user.isSubUser && !membership.customRoleId) {
          // Organization Admin / Owner has full organization access
          orgPermissions.push('*', ...expandOrgPermissions(ALL_ORG_PERMISSION_KEYS));
        } else if (FALLBACK_ORG_ROLE_PERMISSIONS[membership.orgRole as keyof typeof FALLBACK_ORG_ROLE_PERMISSIONS]) {
          isOrgSubUser = true;
          const fallbackKeys = FALLBACK_ORG_ROLE_PERMISSIONS[membership.orgRole as keyof typeof FALLBACK_ORG_ROLE_PERMISSIONS];
          orgPermissions.push('dashboard.view', ...expandOrgPermissions(fallbackKeys));
        }
      }
    }

    if (user.role === 'master_admin') {
      defaults.push('*');
    } else if (user.role === 'admin') {
      defaults.push('dashboard.view', 'report.view', 'audit.view');
    } else if (!user.organizationId && !isOrgSubUser) {
      // Standalone single-user buyers/sellers (without organization) receive baseline default permissions
      if (user.role === 'seller' || user.role === 'shg') {
        defaults.push(
          'dashboard.view',
          'catalogue.product.view',
          'catalogue.product.create',
          'catalogue.product.update',
          'catalogue.product.delete',
          'catalogue.service.view',
          'catalogue.service.create',
          'catalogue.service.update',
          'catalogue.service.delete',
          'marketplace.view',
          'bid.submit',
          'delivery.view',
          'delivery.create',
          'delivery.update',
          'delivery.dispatch',
          'grn.view',
          'invoice.view',
          'invoice.approve',
          'payment.view',
          'escrow.view',
          'dispute.view',
          'reverse_auction.view',
          'reverse_auction.bid.submit'
        );
      } else if (user.role === 'buyer') {
        defaults.push(
          'dashboard.view',
          'marketplace.view',
          'requirement.view',
          'requirement.create',
          'requirement.publish',
          'tender.view',
          'tender.create',
          'tender.update',
          'tender.publish',
          'bid.technical.evaluate',
          'bid.financial.evaluate',
          'award.recommend',
          'approval.view',
          'approval.submit',
          'purchase_order.view',
          'purchase_order.create',
          'purchase_order.approve',
          'cart.view',
          'cart.add',
          'cart.submit_for_approval',
          'checkout.initiate',
          'checkout.approve',
          'delivery.view',
          'delivery.confirm',
          'grn.view',
          'grn.create',
          'grn.approve',
          'inspection.view',
          'inspection.create',
          'inspection.approve',
          'invoice.view',
          'invoice.approve',
          'payment.view',
          'payment.initiate',
          'escrow.release',
          'dispute.view',
          'dispute.manage',
          'reverse_auction.view',
          'reverse_auction.create',
          'reverse_auction.update',
          'reverse_auction.publish',
          'reverse_auction.close',
          'reverse_auction.invite_seller',
          'reverse_auction.award'
        );
      }
    }
  }

  return Array.from(new Set<string>([...assigned, ...orgPermissions, ...defaults]));
};

export const getActivePermissionCodes = getCurrentUserPermissions;

export const userHasPermission = async (
  user: { id: number; role?: string; accountType?: unknown; accountTypeId?: number | null },
  permissionCode: string,
  scope?: RbacScope
) => {
  if (isMasterAdmin(user)) return true;

  const dbPermissions = await getCurrentUserPermissions(user.id, scope);
  if (dbPermissions.includes('*') || dbPermissions.includes(permissionCode)) return true;
  const upper = permissionCode.toUpperCase().replace(/\./g, '_');
  if (dbPermissions.includes(upper)) return true;
  const lower = permissionCode.toLowerCase().replace(/_/g, '.');
  if (dbPermissions.includes(lower)) return true;
  return false;
};

export const ensureAssignablePermissions = async (
  actor: { id: number; role?: string; accountType?: unknown; accountTypeId?: number | null },
  permissionCodes: string[],
  scope?: RbacScope
) => {
  if (isMasterAdmin(actor)) return;
  const actorPermissions = await getCurrentUserPermissions(actor.id, scope);
  const missing = permissionCodes.filter(code => !actorPermissions.includes(code));
  if (missing.length > 0) {
    const error = new Error(`You cannot assign permissions you do not have: ${missing.join(', ')}`);
    (error as any).statusCode = 403;
    (error as any).code = 'PERMISSION_ESCALATION_DENIED';
    throw error;
  }
};

const rbacError = (message: string, statusCode = 403, code = 'RBAC_SCOPE_DENIED') => {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  (error as any).code = code;
  return error;
};

export const assertCanManageRole = async (
  actor: { id: number; role?: string; accountType?: unknown; accountTypeId?: number | null; organizationId?: number | null; companyId?: number | null },
  targetScopeType: string,
  targetScopeId?: string | number | null
) => {
  if (isMasterAdmin(actor)) return;
  const scope = normalizeScope({ scopeType: targetScopeType as any, scopeId: targetScopeId });
  const account = getAccountTypeForUser(actor);

  if (scope.scopeType === 'PLATFORM') {
    throw rbacError('Only Master Admin can manage platform roles.', 403, 'PLATFORM_SCOPE_DENIED');
  }

  if (scope.scopeType === 'DISTRICT') {
    if (account.accountType !== 'SUPERADMIN' && account.accountTypeId !== 1) {
      throw rbacError('Only Collector/Superadmin users can manage district roles.', 403, 'DISTRICT_SCOPE_DENIED');
    }
    if (scope.scopeId && actor.companyId && String(scope.scopeId) !== String(actor.companyId)) {
      throw rbacError('Cannot manage another district scope.', 403, 'CROSS_SCOPE_DENIED');
    }
    if (!(await userHasPermission(actor, 'team.role.manage', scope))) {
      throw rbacError('Missing permission: team.role.manage', 403, 'PERMISSION_DENIED');
    }
    return;
  }

  if (scope.scopeType === 'ORGANIZATION') {
    if (!actor.organizationId || !scope.scopeId || String(actor.organizationId) !== String(scope.scopeId)) {
      throw rbacError('Cannot manage roles outside your organization.', 403, 'CROSS_SCOPE_DENIED');
    }
    if (!(await userHasPermission(actor, 'team.role.manage', scope))) {
      throw rbacError('Missing permission: team.role.manage', 403, 'PERMISSION_DENIED');
    }
    return;
  }

  throw rbacError('Unsupported RBAC scope.', 400, 'INVALID_RBAC_SCOPE');
};

export const assertCanAssignRole = async (
  actor: { id: number; role?: string; accountType?: unknown; accountTypeId?: number | null; organizationId?: number | null; companyId?: number | null },
  targetUserId: number,
  targetRoleId: number,
  scopeType: string,
  scopeId?: string | number | null
) => {
  if (actor.id === targetUserId && !isMasterAdmin(actor)) {
    throw rbacError('You cannot change your own role assignments.', 403, 'SELF_ESCALATION_DENIED');
  }

  await assertCanManageRole(actor, scopeType, scopeId);

  const role = await (prisma as any).rbacRole.findUnique({
    where: { id: targetRoleId },
    include: { permissions: { where: { allowed: true }, include: { permission: true } } }
  });
  if (!role || role.status !== 'ACTIVE') {
    throw rbacError('Role not found or inactive.', 404, 'ROLE_NOT_FOUND');
  }
  if (role.scopeType !== scopeType || String(role.scopeId || '') !== String(scopeId || '')) {
    throw rbacError('Cannot assign a role across scopes.', 403, 'CROSS_SCOPE_DENIED');
  }

  await ensureAssignablePermissions(
    actor,
    role.permissions.map((rp: any) => rp.permission.code),
    { scopeType: scopeType as any, scopeId }
  );

  return role;
};
