import prisma from '../lib/prisma.js';
import { legacyRoleToAccountType } from '../constants/dynamic-rbac.js';
import { FALLBACK_ORG_ROLE_PERMISSIONS, type OrgPermissionKey } from '../constants/org-permissions.js';

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

const legacyOrgPermissionMap: Partial<Record<OrgPermissionKey, string[]>> = {
  CATALOG_VIEW: ['catalogue.product.view', 'catalogue.service.view'],
  CATALOG_CREATE: ['catalogue.product.create', 'catalogue.service.create'],
  CATALOG_EDIT: ['catalogue.product.update', 'catalogue.service.update'],
  CATALOG_DELETE: ['catalogue.product.delete', 'catalogue.service.delete'],
  MARKETPLACE_VIEW: ['marketplace.view'],
  MARKETPLACE_COMPARE: ['marketplace.view'],
  CART_ADD: ['cart.view', 'cart.add'],
  CART_SUBMIT_FOR_APPROVAL: ['cart.submit_for_approval'],
  REQUIREMENT_VIEW: ['requirement.view'],
  REQUIREMENT_CREATE: ['requirement.create'],
  REQUIREMENT_EDIT: ['requirement.create'],
  REQUIREMENT_PUBLISH: ['requirement.publish'],
  REQUIREMENT_RESPONSE_COMPARE: ['requirement.view'],
  RFQ_CREATE: ['requirement.create'],
  RFQ_MANAGE: ['requirement.view', 'requirement.publish'],
  TENDER_VIEW: ['tender.view'],
  TENDER_CREATE: ['tender.create', 'tender.update'],
  TENDER_PUBLISH: ['tender.publish'],
  BID_EVALUATE_TECHNICAL: ['bid.technical.evaluate'],
  BID_EVALUATE_FINANCIAL: ['bid.financial.evaluate'],
  AWARD_RECOMMEND: ['award.recommend'],
  PURCHASE_ORDER_VIEW: ['purchase_order.view'],
  PURCHASE_ORDER_APPROVE: ['purchase_order.approve'],
  REVERSE_AUCTION_VIEW: ['reverse_auction.view'],
  REVERSE_AUCTION_CREATE: ['reverse_auction.create'],
  REVERSE_AUCTION_MANAGE: ['reverse_auction.update', 'reverse_auction.publish', 'reverse_auction.close'],
  REVERSE_AUCTION_BID: ['reverse_auction.bid.submit'],
  REVERSE_AUCTION_AWARD: ['reverse_auction.award'],
  INVOICE_VIEW: ['invoice.view'],
  INVOICE_APPROVE: ['invoice.approve'],
  PAYMENT_VIEW: ['payment.view'],
  PAYMENT_INITIATE: ['payment.initiate'],
  PAYMENT_OFFLINE_PROOF_UPLOAD: ['payment.initiate'],
  PAYMENT_VERIFY: ['payment.verify'],
  ESCROW_VIEW: ['escrow.view'],
  ESCROW_RELEASE: ['escrow.release'],
  DELIVERY_VIEW: ['delivery.view'],
  DELIVERY_UPDATE: ['delivery.update'],
  GRN_VIEW: ['grn.view'],
  GRN_CREATE: ['grn.create'],
  GRN_APPROVE: ['grn.approve'],
  INSPECTION_APPROVE: ['inspection.approve'],
  DISPUTE_VIEW: ['dispute.view'],
  DISPUTE_RAISE: ['dispute.manage'],
  DISPUTE_RESPOND: ['dispute.manage'],
  DISPUTE_RESOLVE_ORG_SIDE: ['dispute.manage'],
  TEAM_VIEW: ['team.member.view', 'team.role.view'],
  TEAM_INVITE: ['team.member.invite'],
  TEAM_ROLE_MANAGE: ['team.role.manage', 'team.role.assign'],
  TEAM_MEMBER_DISABLE: ['team.member.disable'],
  ORG_SETTINGS_VIEW: ['organization.view'],
  ORG_SETTINGS_EDIT: ['organization.update'],
  REPORTS_VIEW: ['report.view'],
  REPORTS_EXPORT: ['report.export']
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
    select: { role: true, organizationId: true }
  });

  const defaults: string[] = [];
  if (user) {
    let organizationMembership: any = null;
    if (normalized.scopeType === 'ORGANIZATION' && normalized.scopeId) {
      organizationMembership = await prisma.orgMembership.findUnique({
        where: { userId_organizationId: { userId, organizationId: Number(normalized.scopeId) } },
        select: {
          orgRole: true,
          isActive: true,
          invitedById: true,
          customRole: {
            select: { permissions: { where: { allowed: true }, select: { permissionKey: true } } }
          }
        }
      }).catch(() => null);
      const isPrimaryOrganizationAdmin = organizationMembership?.isActive
        && organizationMembership.orgRole === 'ORG_ADMIN'
        && !organizationMembership.invitedById;
      if (isPrimaryOrganizationAdmin) {
        defaults.push(
          'team.member.view',
          'team.member.invite',
          'team.member.disable',
          'team.role.view',
          'team.role.manage',
          'team.role.assign',
          'organization.view',
          'organization.update'
        );
      } else if (organizationMembership?.isActive && organizationMembership.orgRole !== 'ORG_ADMIN' && assigned.length === 0) {
        const legacyKeys = organizationMembership.customRole?.permissions?.length
          ? organizationMembership.customRole.permissions.map((row: any) => row.permissionKey as OrgPermissionKey)
          : FALLBACK_ORG_ROLE_PERMISSIONS[organizationMembership.orgRole as keyof typeof FALLBACK_ORG_ROLE_PERMISSIONS] || [];
        defaults.push(...legacyKeys.flatMap((key: OrgPermissionKey) => legacyOrgPermissionMap[key] || []));
      }
    }

    const isLegacyOrganizationOwner = normalized.scopeType === 'ORGANIZATION'
      && normalized.scopeId
      && String(user.organizationId || '') === normalized.scopeId
      && !organizationMembership;
    const isPrimaryOrganizationAdmin = organizationMembership?.isActive
      && organizationMembership.orgRole === 'ORG_ADMIN'
      && !organizationMembership.invitedById;
    const shouldApplyPrimaryDefaults = normalized.scopeType === 'ORGANIZATION'
      ? Boolean(isPrimaryOrganizationAdmin || isLegacyOrganizationOwner)
      : !user.organizationId;

    if (shouldApplyPrimaryDefaults && (user.role === 'seller' || user.role === 'shg')) {
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
    } else if (shouldApplyPrimaryDefaults && user.role === 'buyer') {
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
    } else if (user.role === 'master_admin') {
      defaults.push('*');
    }
  }

  return Array.from(new Set<string>([...assigned, ...defaults]));
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
