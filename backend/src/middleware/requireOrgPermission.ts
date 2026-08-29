import type { NextFunction, Response } from 'express';
import prisma from '../lib/prisma.js';
import { apiResponse } from '../utils/apiResponse.js';
import type { OrgPermissionKey } from '../constants/org-permissions.js';
import type { AuthRequest } from './authenticate.js';
import { getActivePermissionCodes, isMasterAdmin } from '../services/rbac.service.js';

const ORG_PERMISSION_TO_RBAC: Partial<Record<OrgPermissionKey, string>> = {
  TEAM_VIEW: 'team.member.view',
  TEAM_INVITE: 'team.member.invite',
  TEAM_ROLE_MANAGE: 'team.role.manage',
  TEAM_MEMBER_DISABLE: 'team.member.disable',
  ORG_SETTINGS_VIEW: 'organization.view',
  ORG_SETTINGS_EDIT: 'organization.update',
  CATALOG_VIEW: 'catalogue.product.view',
  CATALOG_CREATE: 'catalogue.product.create',
  CATALOG_EDIT: 'catalogue.product.update',
  CATALOG_DELETE: 'catalogue.product.delete',
  MARKETPLACE_VIEW: 'marketplace.view',
  MARKETPLACE_COMPARE: 'marketplace.view',
  CART_ADD: 'cart.add',
  CART_SUBMIT_FOR_APPROVAL: 'cart.submit_for_approval',
  REQUIREMENT_VIEW: 'requirement.view',
  REQUIREMENT_CREATE: 'requirement.create',
  REQUIREMENT_EDIT: 'requirement.create',
  REQUIREMENT_PUBLISH: 'requirement.publish',
  REQUIREMENT_RESPONSE_COMPARE: 'requirement.view',
  RFQ_CREATE: 'requirement.create',
  RFQ_MANAGE: 'requirement.publish',
  TENDER_VIEW: 'tender.view',
  TENDER_CREATE: 'tender.create',
  TENDER_PUBLISH: 'tender.publish',
  BID_EVALUATE_TECHNICAL: 'bid.technical.evaluate',
  BID_EVALUATE_FINANCIAL: 'bid.financial.evaluate',
  AWARD_RECOMMEND: 'award.recommend',
  PURCHASE_ORDER_VIEW: 'purchase_order.view',
  PURCHASE_ORDER_APPROVE: 'purchase_order.approve',
  REVERSE_AUCTION_VIEW: 'reverse_auction.view',
  REVERSE_AUCTION_CREATE: 'reverse_auction.create',
  REVERSE_AUCTION_MANAGE: 'reverse_auction.update',
  REVERSE_AUCTION_BID: 'reverse_auction.bid.submit',
  REVERSE_AUCTION_AWARD: 'reverse_auction.award',
  DELIVERY_VIEW: 'delivery.view',
  DELIVERY_UPDATE: 'delivery.update',
  GRN_VIEW: 'grn.view',
  INVOICE_VIEW: 'invoice.view',
  INVOICE_APPROVE: 'invoice.approve',
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_INITIATE: 'payment.initiate',
  PAYMENT_OFFLINE_PROOF_UPLOAD: 'payment.initiate',
  PAYMENT_VERIFY: 'payment.verify',
  ESCROW_VIEW: 'escrow.view',
  ESCROW_RELEASE: 'escrow.release',
  GRN_CREATE: 'grn.create',
  GRN_APPROVE: 'grn.approve',
  INSPECTION_APPROVE: 'inspection.approve',
  DISPUTE_VIEW: 'dispute.view',
  DISPUTE_RAISE: 'dispute.manage',
  DISPUTE_RESPOND: 'dispute.manage',
  DISPUTE_RESOLVE_ORG_SIDE: 'dispute.manage',
  REPORTS_VIEW: 'report.view',
  REPORTS_EXPORT: 'report.export',
  BANNER_ELIGIBILITY_VIEW: 'organization.view',
  BANNER_UPLOAD: 'settings.manage'
};

export const getDynamicPermissionForOrgKey = (permissionKey: OrgPermissionKey | string) =>
  ORG_PERMISSION_TO_RBAC[permissionKey as OrgPermissionKey] || null;

export const getOrgPermissionKeys = async (userId: number, organizationId: number): Promise<{ membership: any; permissions: string[] }> => {
  const membership = await prisma.orgMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: {
      customRole: {
        include: { permissions: true }
      }
    }
  });

  if (!membership || !membership.isActive) return { membership, permissions: [] };
  const scope = { scopeType: 'ORGANIZATION' as const, scopeId: organizationId };
  return { membership, permissions: await getActivePermissionCodes(userId, scope) };
};

export const requireOrgPermission = (permissionKey: OrgPermissionKey | string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return apiResponse.error(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    if (isMasterAdmin(req.user)) return next();

    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return apiResponse.error(res, 403, 'You must belong to an organisation to perform this action.', 'ORG_REQUIRED');
    }

    const { membership, permissions } = await getOrgPermissionKeys(req.user.id, organizationId);
    if (!membership || !membership.isActive) {
      return apiResponse.error(res, 403, 'You are not an active member of this organisation.', 'ORG_MEMBERSHIP_INACTIVE');
    }

    const dynamicPermission = ORG_PERMISSION_TO_RBAC[permissionKey as OrgPermissionKey] || String(permissionKey);
    if (!dynamicPermission) {
      return apiResponse.error(res, 403, `No dynamic permission mapping exists for organization permission: ${permissionKey}`, 'ORG_PERMISSION_UNMAPPED');
    }

    (req as any).orgMembership = membership;
    (req as any).orgPermissions = permissions;
    if (!permissions.includes('*') && !permissions.includes(dynamicPermission)) {
      return apiResponse.error(res, 403, `Missing permission: ${dynamicPermission}`, 'PERMISSION_DENIED', { requiredPermission: dynamicPermission });
    }
    return next();
  };
};
