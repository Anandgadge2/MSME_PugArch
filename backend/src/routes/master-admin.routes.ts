import { Router, type Response, type NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/authenticate.js';
import { invalidateByPattern } from '../services/cache.service.js';
import { authorize, requirePermission, createAuditLog } from '../middleware/authorize.js';
import { getPagination } from '../utils/pagination.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { hashPassword } from '../services/password.service.js';
import { randomToken } from '../utils/crypto.js';
import { generateAlphanumericUserId } from '../utils/userId.js';

import { createOrUpdatePendingOrganization } from '../services/onboarding-organization.service.js';
import { getDefaultCompanyId } from '../services/default-company.service.js';
import { upload } from '../config/storage.js';
import { uploadFile } from '../services/storage/storage.service.js';

const router = Router();

const wrap = (handler: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

const masterOnly = [authenticate, authorize('master_admin')] as const;

const companySelect = {
  id: true,
  name: true,
  shortName: true,
  portalDisplayName: true,
  logoUrl: true,
  contactEmail: true,
  contactPhone: true,
  address: true,
  district: true,
  state: true,
  themeSettings: true,
  homepageContent: true,
  aboutContent: true,
  footerContent: true,
  grievanceContent: true,
  procurementPolicy: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

const companyListSelect = {
  id: true,
  name: true,
  shortName: true,
  portalDisplayName: true,
  contactEmail: true,
  contactPhone: true,
  district: true,
  state: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, organizations: true, features: true, buyerRequirements: true } }
};

const textOrNull = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numberOrUndefined = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};
const numberOrNullOrUndefined = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};
const jsonOk = (res: Response, data: unknown, message = 'Operation successful', status = 200) =>
  res.status(status).json({ success: true, message, data });
const jsonError = (res: Response, status: number, message: string, errorCode: string) =>
  res.status(status).json({ success: false, message, errorCode });

const checkNotMasterAdmin = async (id: number, res: Response): Promise<boolean> => {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, userId: true } });
  if (user && (user.role === 'master_admin' || user.userId === 'MASTER_ADMIN')) {
    jsonError(res, 403, 'Master Admin user cannot be modified or deleted.', 'MASTER_ADMIN_LOCKED');
    return false;
  }
  return true;
};

const allowedRoles = new Set(['master_admin', 'admin', 'buyer', 'seller', 'financier']);
const allowedUserStatuses = new Set(['PENDING', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'DELETED']);
const allowedVerificationStatuses = new Set(['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'FAILED', 'MANUAL_REVIEW_REQUIRED', 'EXPIRED']);
const allowedOrganizationTypes = new Set(['MSME', 'PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'TRUST', 'SOCIETY', 'STARTUP', 'NGO', 'EDUCATIONAL_INSTITUTION', 'GOVERNMENT', 'PSU']);
const allowedMarketplaceStatuses = new Set(['DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED']);
const allowedOrderStatuses = new Set(['generated', 'issued', 'accepted', 'in_fulfillment', 'delivered', 'completed', 'closed', 'cancelled', 'escrow_held']);
const allowedInvoiceStatuses = new Set(['submitted', 'under_review', 'approved', 'rejected', 'paid', 'cancelled']);
const allowedPaymentStatuses = new Set(['initiated', 'pending', 'processing', 'success', 'failed', 'refunded', 'cancelled', 'settled', 'escrow_released', 'on_hold', 'dispute']);
const allowedPaymentStatusEnums = new Set(['INITIATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED', 'PAYMENT_PENDING', 'PORTAL_PAYMENT_INITIATED', 'PORTAL_PAYMENT_SUCCESS', 'PORTAL_PAYMENT_FAILED', 'OFFLINE_PROOF_UPLOADED', 'OFFLINE_PROOF_UNDER_REVIEW', 'OFFLINE_PROOF_VERIFIED', 'OFFLINE_PROOF_REJECTED', 'SETTLEMENT_PENDING', 'SETTLED']);
const allowedEscrowStatuses = new Set(['held', 'funded', 'frozen', 'released', 'dispute', 'cancelled']);
const allowedEscrowStatusEnums = new Set(['HELD', 'FUNDED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'FROZEN']);

const normalizedEnum = (value: unknown) => textOrNull(value)?.toUpperCase().replace(/[\s-]+/g, '_');
const requiredReason = (body: any) => textOrNull(body?.reason);

const ensureReason = (res: Response, body: any, action: string) => {
  const reason = requiredReason(body);
  if (!reason) {
    jsonError(res, 400, `Reason is required to ${action}.`, 'VALIDATION_ERROR');
    return null;
  }
  return reason;
};

const sortableOrder = (query: Record<string, unknown>, allowed: Record<string, string>, fallback: Record<string, 'asc' | 'desc'>) => {
  const sortBy = textOrNull(query.sortBy);
  const sortOrder = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const mapped = sortBy ? allowed[sortBy] : undefined;
  return mapped ? { [mapped]: sortOrder } : fallback;
};

const safeCount = async (delegate: any, args?: any) => {
  if (!delegate?.count) return 0;
  try {
    return await delegate.count(args);
  } catch {
    return 0;
  }
};

const safeFindMany = async <T>(delegate: any, args: any, fallback: T[] = []) => {
  if (!delegate?.findMany) return fallback;
  try {
    return await delegate.findMany(args);
  } catch {
    return fallback;
  }
};

const searchText = (value: unknown) => textOrNull(value) || '';
const searchLimit = (value: unknown) => Math.min(Math.max(Number(value) || 5, 1), 10);
const searchItem = (type: string, item: Record<string, any>, title: string, subtitle?: string | null, href?: string, status?: string | null) => ({
  id: item.id,
  type,
  title,
  subtitle: subtitle || null,
  status: status || null,
  company: item.company?.portalDisplayName || item.company?.name || null,
  updatedAt: item.updatedAt || item.createdAt || null,
  href
});

const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
};

const sendCsv = (res: Response, filename: string, rows: Array<Record<string, unknown>>) => {
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set<string>()));
  const csv = [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
};

const flattenRecord = (record: Record<string, any>) => {
  const flattened: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) flattened[key] = value.toISOString();
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        flattened[`${key}_${nestedKey}`] = nestedValue instanceof Date ? nestedValue.toISOString() : nestedValue;
      }
    } else flattened[key] = value;
  }
  return flattened;
};

const exportDateWhere = (query: Record<string, unknown>) => {
  const from = textOrNull(query.from);
  const to = textOrNull(query.to);
  if (!from && !to) return {};
  return {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    }
  };
};

const withAadhaarKyc = <T extends { kycVerifications?: any[] }>(record: T) => {
  const { kycVerifications, ...rest } = record as any;
  const primaryUser = rest.users?.[0] || {};
  const regDetails = primaryUser.registrationDetails || {};
  const gstDetails = regDetails.gstDetails || {};
  const sellerProf = rest.sellerProfiles?.[0] || {};
  const sellerOffice = sellerProf.offices?.[0] || {};
  const buyerProf = rest.buyerProfiles?.[0] || {};

  return {
    ...rest,
    aadhaarKyc: kycVerifications?.[0] || null,
    email: rest.email || primaryUser.email || '',
    mobile: rest.mobile || rest.phone || primaryUser.mobile || '',
    address: rest.address || rest.addressLine1 || sellerOffice.addressLine1 || sellerProf.registeredAddress || buyerProf.address || gstDetails.address || '',
    addressLine1: rest.addressLine1 || rest.address || sellerOffice.addressLine1 || sellerProf.registeredAddress || buyerProf.address || gstDetails.address || '',
    state: rest.state || sellerProf.state || sellerOffice.state || buyerProf.state || regDetails.state || gstDetails.state || '',
    district: rest.district || sellerProf.district || sellerOffice.district || buyerProf.city || regDetails.district || gstDetails.district || '',
    pincode: rest.pincode || sellerOffice.pincode || buyerProf.pincode || regDetails.pincode || gstDetails.pincode || '',
    panNumber: rest.panNumber || rest.pan || sellerProf.pan || regDetails.pan || gstDetails.pan || '',
    gstin: rest.gstin || sellerProf.gst || regDetails.gstin || gstDetails.gstin || ''
  };
};

export const permanentlyDeleteUser = async (req: AuthRequest | null, id: number, reason: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('User not found');
  if (user.role === 'master_admin' || user.userId === 'MASTER_ADMIN') {
    throw new Error('MASTER_ADMIN_LOCKED');
  }

  const activePayments = await safeCount((prisma as any).paymentTransaction, {
    where: { OR: [{ payerId: id }, { payeeId: id }], status: { in: ['INITIATED', 'PENDING', 'PROCESSING'] } }
  });
  const activeEscrows = await safeCount((prisma as any).escrowAccount, {
    where: { OR: [{ buyerId: id }, { sellerId: id }], status: { in: ['HELD', 'FUNDED'] } }
  });

  if (activePayments > 0 || activeEscrows > 0) {
    throw new Error(`Cannot delete user: ${activePayments} active payment(s) and ${activeEscrows} active escrow(s) exist. Resolve them first.`);
  }

  const summary = await prisma.$transaction(async (tx: any) => {
    const counts: Record<string, number> = {};
    let spIdx = 0;

    const rawSql = async (label: string, sql: string) => {
      const sp = `csd_u_${++spIdx}`;
      try {
        await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
        const result = await tx.$executeRawUnsafe(sql);
        counts[label] = (counts[label] || 0) + (typeof result === 'number' ? result : 0);
        await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('Transaction already closed') || msg.includes('expired transaction')) {
          throw err;
        }
        if (req?.log) req.log.warn?.({ label, err: msg }, '[UserDelete] rawSql failed');
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {});
      }
    };

    const uIn = `IN (${id})`;
    const sqlIn = (ids: number[]) => ids.length > 0 ? `IN (${ids.join(',')})` : 'IN (NULL)';
    const resolveIds = async (sql: string): Promise<number[]> => {
      try {
        const rows: any[] = await tx.$queryRawUnsafe(sql);
        return rows.map((r: any) => r.id);
      } catch { return []; }
    };

    const procBidSub = `SELECT id FROM "ProcurementBid" WHERE "buyerId" ${uIn}`;
    const procBidClarSub = `SELECT id FROM "ProcurementBidClarification" WHERE "bidId" IN (${procBidSub})`;
    const procBidPartSub = `SELECT id FROM "ProcurementBidParticipation" WHERE "bidId" IN (${procBidSub})`;

    const tenderSub = `SELECT id FROM "Tender" WHERE "buyerId" ${uIn}`;
    const bidSub = `SELECT id FROM "Bid" WHERE "tenderId" IN (${tenderSub}) OR "sellerId" ${uIn}`;

    const poIds = await resolveIds(`SELECT id FROM "PurchaseOrder" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
    const deliveryIds = poIds.length > 0 ? await resolveIds(`SELECT id FROM "DeliveryTracking" WHERE "purchaseOrderId" ${sqlIn(poIds)}`) : [];
    const invoiceIds = poIds.length > 0 ? await resolveIds(`SELECT id FROM "Invoice" WHERE "purchaseOrderId" ${sqlIn(poIds)}`) : [];
    const poPaymentIds = poIds.length > 0 ? await resolveIds(`SELECT id FROM "PaymentTransaction" WHERE "purchaseOrderId" ${sqlIn(poIds)}`) : [];
    const poEscrowIds = poPaymentIds.length > 0 ? await resolveIds(`SELECT id FROM "EscrowAccount" WHERE "paymentTransactionId" ${sqlIn(poPaymentIds)}`) : [];
    const poMilestoneIds = poEscrowIds.length > 0 ? await resolveIds(`SELECT id FROM "Milestone" WHERE "escrowAccountId" ${sqlIn(poEscrowIds)}`) : [];
    const poItemIds = poIds.length > 0 ? await resolveIds(`SELECT id FROM "PurchaseOrderItem" WHERE "purchaseOrderId" ${sqlIn(poIds)}`) : [];

    const userPaymentIds = await resolveIds(`SELECT id FROM "PaymentTransaction" WHERE "payerId" ${uIn} OR "payeeId" ${uIn}`);
    const uEscrowIds = userPaymentIds.length > 0 ? await resolveIds(`SELECT id FROM "EscrowAccount" WHERE "paymentTransactionId" ${sqlIn(userPaymentIds)}`) : [];
    const uMilestoneIds = uEscrowIds.length > 0 ? await resolveIds(`SELECT id FROM "Milestone" WHERE "escrowAccountId" ${sqlIn(uEscrowIds)}`) : [];

    const disputeSub = `SELECT id FROM "Dispute" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn} OR "raisedById" ${uIn}`;
    const convSub = `SELECT id FROM "Conversation" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`;
    const msgSub = `SELECT id FROM "Message" WHERE "conversationId" IN (${convSub}) OR "senderId" ${uIn}`;
    const grievanceSub = `SELECT id FROM "GrievanceTicket" WHERE "userId" ${uIn} OR "assignedAdminId" ${uIn}`;
    const auctionSub = `SELECT id FROM "Auction" WHERE "currentWinnerId" ${uIn} OR "winnerSellerId" ${uIn} OR "createdByUserId" ${uIn}`;
    const catBatchSub = `SELECT id FROM "CatalogueImportBatch" WHERE "sellerId" ${uIn}`;
    const sellerProfileSub = `SELECT id FROM "SellerProfile" WHERE "userId" ${uIn}`;

    await rawSql('MarketplaceInteraction', `DELETE FROM "MarketplaceInteraction" WHERE "userId" ${uIn}`);
    await rawSql('ProcurementBidClarificationFile', `DELETE FROM "ProcurementBidClarificationFile" WHERE "clarificationId" IN (${procBidClarSub}) OR "uploadedById" ${uIn}`);
    await rawSql('ProcurementBidClarification', `DELETE FROM "ProcurementBidClarification" WHERE "bidId" IN (${procBidSub}) OR "requestedById" ${uIn} OR "respondedById" ${uIn} OR "sellerId" ${uIn} OR "buyerId" ${uIn}`);
    await rawSql('ProcurementBidParticipationDocument', `DELETE FROM "ProcurementBidParticipationDocument" WHERE "participationId" IN (${procBidPartSub}) OR "sellerId" ${uIn}`);
    await rawSql('ProcurementBidEvaluation', `DELETE FROM "ProcurementBidEvaluation" WHERE "bidId" IN (${procBidSub}) OR "evaluatorId" ${uIn}`);
    await rawSql('ProcurementBidAward', `DELETE FROM "ProcurementBidAward" WHERE "bidId" IN (${procBidSub}) OR "sellerId" ${uIn} OR "awardedById" ${uIn}`);
    await rawSql('ProcurementBidParticipation', `DELETE FROM "ProcurementBidParticipation" WHERE "bidId" IN (${procBidSub}) OR "sellerId" ${uIn}`);
    await rawSql('ProcurementBidDocument', `DELETE FROM "ProcurementBidDocument" WHERE "bidId" IN (${procBidSub}) OR "uploadedById" ${uIn}`);
    await rawSql('ProcurementAuditLog', `DELETE FROM "ProcurementAuditLog" WHERE "userId" ${uIn}`);
    await rawSql('ComparativeStatement', `DELETE FROM "ComparativeStatement" WHERE "bidId" IN (${procBidSub})`);
    await rawSql('ProcurementBid_nullify', `UPDATE "ProcurementBid" SET "approvedById" = NULL WHERE "approvedById" ${uIn}`);
    await rawSql('ProcurementBidInvitation', `DELETE FROM "ProcurementBidInvitation" WHERE "sellerUserId" ${uIn}`);
    await rawSql('ProcurementBid', `DELETE FROM "ProcurementBid" WHERE "buyerId" ${uIn}`);
    await rawSql('ProcurementApproval', `DELETE FROM "ProcurementApproval" WHERE "approverId" ${uIn}`);
    await rawSql('ProcurementRequest', `DELETE FROM "ProcurementRequest" WHERE "buyerId" ${uIn}`);

    await rawSql('BuyerRequirement', `DELETE FROM "BuyerRequirement" WHERE "createdById" ${uIn} OR "approvedById" ${uIn}`);
    await rawSql('RequirementResponse', `DELETE FROM "RequirementResponse" WHERE "sellerUserId" ${uIn}`);

    await rawSql('CartItem_user', `DELETE FROM "CartItem" WHERE "sellerId" ${uIn}`);
    await rawSql('Cart_nullify_approved', `UPDATE "Cart" SET "approvedById" = NULL WHERE "approvedById" ${uIn}`);
    await rawSql('Cart_nullify_rejected', `UPDATE "Cart" SET "rejectedById" = NULL WHERE "rejectedById" ${uIn}`);
    await rawSql('CartItem_nullify', `UPDATE "CartItem" SET "technicalApprovedById" = NULL WHERE "technicalApprovedById" ${uIn}`);
    await rawSql('Cart_user', `DELETE FROM "Cart" WHERE "createdById" ${uIn}`);

    await rawSql('GRN_nullify_approved', `UPDATE "GoodsReceiptNote" SET "approvedById" = NULL WHERE "approvedById" ${uIn}`);
    await rawSql('GRN_nullify_rejected', `UPDATE "GoodsReceiptNote" SET "rejectedById" = NULL WHERE "rejectedById" ${uIn}`);
    await rawSql('GrnDocument', `DELETE FROM "GrnDocument" WHERE "uploadedById" ${uIn}`);
    await rawSql('GoodsReceiptNote', `DELETE FROM "GoodsReceiptNote" WHERE "receivedById" ${uIn}`);

    await rawSql('OrgMembership_nullify_transferred', `UPDATE "OrgMembership" SET "accessTransferredFromUserId" = NULL WHERE "accessTransferredFromUserId" ${uIn}`);
    await rawSql('OrgMembership_nullify_deactivated', `UPDATE "OrgMembership" SET "deactivatedByUserId" = NULL WHERE "deactivatedByUserId" ${uIn}`);
    await rawSql('OrgMembership_nullify_invited', `UPDATE "OrgMembership" SET "invitedById" = NULL WHERE "invitedById" ${uIn}`);
    await rawSql('OrgInvitation_user', `DELETE FROM "OrgInvitation" WHERE "invitedById" ${uIn}`);
    await rawSql('OrgCustomRole_user', `DELETE FROM "OrgCustomRole" WHERE "createdByUserId" ${uIn}`);
    await rawSql('OrgMembership', `DELETE FROM "OrgMembership" WHERE "userId" ${uIn}`);
    await rawSql('AccessTransferLog', `DELETE FROM "AccessTransferLog" WHERE "fromUserId" ${uIn} OR "toUserId" ${uIn} OR "performedByUserId" ${uIn}`);

    await rawSql('DeliveryAddress', `DELETE FROM "DeliveryAddress" WHERE "buyerId" ${uIn}`);
    await rawSql('AddressGroup', `DELETE FROM "AddressGroup" WHERE "buyerId" ${uIn}`);

    await rawSql('QuoteRequestClarification', `DELETE FROM "QuoteRequestClarification" WHERE "askedById" ${uIn} OR "answeredById" ${uIn}`);
    await rawSql('QuoteResponse', `DELETE FROM "QuoteResponse" WHERE "sellerId" ${uIn}`);
    await rawSql('QuoteRequest', `DELETE FROM "QuoteRequest" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
    await rawSql('RequirementClarification', `DELETE FROM "RequirementClarification" WHERE "askedById" ${uIn} OR "answeredById" ${uIn}`);
    await rawSql('DirectPurchase', `DELETE FROM "DirectPurchase" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);

    await rawSql('BidItem', `DELETE FROM "BidItem" WHERE "bidId" IN (${bidSub})`);
    await rawSql('TechnicalEvaluationResult', `DELETE FROM "TechnicalEvaluationResult" WHERE "tenderId" IN (${tenderSub}) OR "evaluatorId" ${uIn}`);
    await rawSql('TechnicalEvaluationCriteria', `DELETE FROM "TechnicalEvaluationCriteria" WHERE "tenderId" IN (${tenderSub})`);
    await rawSql('FinancialEvaluation', `DELETE FROM "FinancialEvaluation" WHERE "tenderId" IN (${tenderSub}) OR "evaluatorId" ${uIn}`);
    await rawSql('TenderDocument', `DELETE FROM "TenderDocument" WHERE "tenderId" IN (${tenderSub})`);
    await rawSql('TenderItem', `DELETE FROM "TenderItem" WHERE "tenderId" IN (${tenderSub})`);
    await rawSql('TenderParticipant', `DELETE FROM "TenderParticipant" WHERE "tenderId" IN (${tenderSub})`);

    if (deliveryIds.length > 0) {
      await rawSql('DeliveryTrackingEvent', `DELETE FROM "DeliveryTrackingEvent" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
      await rawSql('DeliveryStatusLog', `DELETE FROM "DeliveryStatusLog" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
      await rawSql('DeliveryDocument', `DELETE FROM "DeliveryDocument" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
      await rawSql('DeliveryParticipant', `DELETE FROM "DeliveryParticipant" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
      await rawSql('BuyerAcceptance_delivery', `DELETE FROM "BuyerAcceptance" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
      await rawSql('PaymentSettlement_nullify_d', `UPDATE "PaymentSettlement" SET "invoiceVerifiedById" = NULL, "approvedById" = NULL, "releasedById" = NULL, "rejectedById" = NULL WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
      await rawSql('PaymentSettlement_delivery', `DELETE FROM "PaymentSettlement" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
    }
    if (poIds.length > 0) {
      await rawSql('DeliveryTracking', `DELETE FROM "DeliveryTracking" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
      await rawSql('DeliveryWorkflow', `DELETE FROM "DeliveryWorkflow" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
    }
    if (invoiceIds.length > 0) {
      await rawSql('MilestonePayment_inv', `DELETE FROM "MilestonePayment" WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
      await rawSql('InvoiceItem', `DELETE FROM "InvoiceItem" WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
      await rawSql('InvoiceFactoring_inv', `DELETE FROM "InvoiceFactoring" WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
      await rawSql('PaymentSettlement_nullify_i', `UPDATE "PaymentSettlement" SET "invoiceVerifiedById" = NULL, "approvedById" = NULL, "releasedById" = NULL, "rejectedById" = NULL WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
      await rawSql('PaymentSettlement_inv', `DELETE FROM "PaymentSettlement" WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
      await rawSql('PaymentTransaction_nullify_inv', `UPDATE "PaymentTransaction" SET "invoiceId" = NULL WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
    }
    if (poIds.length > 0) await rawSql('Invoice', `DELETE FROM "Invoice" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
    if (poIds.length > 0) {
      await rawSql('InspectionReport', `DELETE FROM "InspectionReport" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
      await rawSql('InspectionRecord', `DELETE FROM "InspectionRecord" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
      await rawSql('ProvisionalReceiptCertificate_po', `DELETE FROM "ProvisionalReceiptCertificate" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
      await rawSql('ConsigneeReceiptAcceptanceCertificate_po', `DELETE FROM "ConsigneeReceiptAcceptanceCertificate" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
    }
    if (poMilestoneIds.length > 0) {
      await rawSql('MilestoneApproval_po', `DELETE FROM "MilestoneApproval" WHERE "milestoneId" ${sqlIn(poMilestoneIds)}`);
      await rawSql('MilestonePayment_po', `DELETE FROM "MilestonePayment" WHERE "milestoneId" ${sqlIn(poMilestoneIds)}`);
      await rawSql('EscrowTransaction_ms_po', `DELETE FROM "EscrowTransaction" WHERE "milestoneId" ${sqlIn(poMilestoneIds)}`);
    }
    if (poEscrowIds.length > 0) {
      await rawSql('Milestone_po', `DELETE FROM "Milestone" WHERE "escrowAccountId" ${sqlIn(poEscrowIds)}`);
      await rawSql('EscrowTransaction_esc_po', `DELETE FROM "EscrowTransaction" WHERE "escrowAccountId" ${sqlIn(poEscrowIds)}`);
    }
    if (poPaymentIds.length > 0) {
      await rawSql('EscrowAccount_po', `DELETE FROM "EscrowAccount" WHERE "paymentTransactionId" ${sqlIn(poPaymentIds)}`);
      await rawSql('FinancialLedgerEntry_po', `DELETE FROM "FinancialLedgerEntry" WHERE "transactionId" ${sqlIn(poPaymentIds)}`);
      await rawSql('OfflinePaymentProof_po', `DELETE FROM "OfflinePaymentProof" WHERE "paymentTransactionId" ${sqlIn(poPaymentIds)}`);
      await rawSql('PaymentSettlement_po', `DELETE FROM "PaymentSettlement" WHERE "paymentTransactionId" ${sqlIn(poPaymentIds)}`);
    }
    if (poIds.length > 0) await rawSql('PaymentTransaction_po', `DELETE FROM "PaymentTransaction" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
    if (poItemIds.length > 0) {
      await rawSql('InvoiceItem_nullify_poi', `UPDATE "InvoiceItem" SET "purchaseOrderItemId" = NULL WHERE "purchaseOrderItemId" ${sqlIn(poItemIds)}`);
      await rawSql('GrnItem_poi', `DELETE FROM "GrnItem" WHERE "purchaseOrderItemId" ${sqlIn(poItemIds)}`);
    }
    if (poIds.length > 0) {
      await rawSql('PurchaseOrderItem', `DELETE FROM "PurchaseOrderItem" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
      await rawSql('PurchaseOrder', `DELETE FROM "PurchaseOrder" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
    }

    if (uMilestoneIds.length > 0) {
      await rawSql('MilestoneApproval_u', `DELETE FROM "MilestoneApproval" WHERE "milestoneId" ${sqlIn(uMilestoneIds)}`);
      await rawSql('MilestonePayment_u', `DELETE FROM "MilestonePayment" WHERE "milestoneId" ${sqlIn(uMilestoneIds)}`);
      await rawSql('EscrowTransaction_ms_u', `DELETE FROM "EscrowTransaction" WHERE "milestoneId" ${sqlIn(uMilestoneIds)}`);
    }
    if (uEscrowIds.length > 0) {
      await rawSql('Milestone_u', `DELETE FROM "Milestone" WHERE "escrowAccountId" ${sqlIn(uEscrowIds)}`);
      await rawSql('EscrowTransaction_esc_u', `DELETE FROM "EscrowTransaction" WHERE "escrowAccountId" ${sqlIn(uEscrowIds)}`);
    }
    await rawSql('EscrowAccount_u', `DELETE FROM "EscrowAccount" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
    if (userPaymentIds.length > 0) {
      await rawSql('FinancialLedgerEntry_u', `DELETE FROM "FinancialLedgerEntry" WHERE "transactionId" ${sqlIn(userPaymentIds)}`);
      await rawSql('OfflinePaymentProof_u', `DELETE FROM "OfflinePaymentProof" WHERE "paymentTransactionId" ${sqlIn(userPaymentIds)}`);
      await rawSql('PaymentSettlement_u', `DELETE FROM "PaymentSettlement" WHERE "paymentTransactionId" ${sqlIn(userPaymentIds)}`);
    }
    await rawSql('PaymentTransaction_u', `DELETE FROM "PaymentTransaction" WHERE "payerId" ${uIn} OR "payeeId" ${uIn}`);

    await rawSql('DisputeAttachment', `DELETE FROM "DisputeAttachment" WHERE "disputeId" IN (${disputeSub}) OR "uploadedByUserId" ${uIn}`);
    await rawSql('DisputeEvidence', `DELETE FROM "DisputeEvidence" WHERE "disputeId" IN (${disputeSub}) OR "uploadedById" ${uIn}`);
    await rawSql('DisputeMessage_d', `DELETE FROM "DisputeMessage" WHERE "disputeId" IN (${disputeSub})`);
    await rawSql('Dispute_nullify_assigned', `UPDATE "Dispute" SET "assignedAdminId" = NULL WHERE "assignedAdminId" ${uIn}`);
    await rawSql('Dispute_nullify_resolved', `UPDATE "Dispute" SET "resolvedById" = NULL WHERE "resolvedById" ${uIn}`);
    await rawSql('Dispute', `DELETE FROM "Dispute" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn} OR "raisedById" ${uIn}`);

    await rawSql('MessageAttachment', `DELETE FROM "MessageAttachment" WHERE "messageId" IN (${msgSub})`);
    await rawSql('Message', `DELETE FROM "Message" WHERE "conversationId" IN (${convSub}) OR "senderId" ${uIn}`);
    await rawSql('Conversation', `DELETE FROM "Conversation" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);

    await rawSql('GrievanceAttachment', `DELETE FROM "GrievanceAttachment" WHERE "grievanceId" IN (${grievanceSub}) OR "uploadedById" ${uIn}`);
    await rawSql('GrievanceComment', `DELETE FROM "GrievanceComment" WHERE "grievanceId" IN (${grievanceSub}) OR "authorId" ${uIn}`);
    await rawSql('GrievanceTicket', `DELETE FROM "GrievanceTicket" WHERE "userId" ${uIn} OR "assignedAdminId" ${uIn}`);

    await rawSql('AuctionEventLog', `DELETE FROM "AuctionEventLog" WHERE "auctionId" IN (${auctionSub})`);
    await rawSql('AuctionQualificationDocument', `DELETE FROM "AuctionQualificationDocument" WHERE "auctionId" IN (${auctionSub})`);
    await rawSql('AuctionParticipant', `DELETE FROM "AuctionParticipant" WHERE "auctionId" IN (${auctionSub})`);
    await rawSql('AuctionBid', `DELETE FROM "AuctionBid" WHERE "auctionId" IN (${auctionSub}) OR "sellerId" ${uIn}`);
    await rawSql('Auction_nullify_winner', `UPDATE "Auction" SET "currentWinnerId" = NULL WHERE "currentWinnerId" ${uIn}`);
    await rawSql('Auction_nullify_winnerSeller', `UPDATE "Auction" SET "winnerSellerId" = NULL WHERE "winnerSellerId" ${uIn}`);

    await rawSql('Contract', `DELETE FROM "Contract" WHERE "bidId" IN (${bidSub}) OR "tenderId" IN (${tenderSub})`);
    await rawSql('ComparativeStatement_t', `DELETE FROM "ComparativeStatement" WHERE "tenderId" IN (${tenderSub})`);
    await rawSql('Bid', `DELETE FROM "Bid" WHERE "sellerId" ${uIn}`);
    await rawSql('Tender', `DELETE FROM "Tender" WHERE "buyerId" ${uIn}`);

    await rawSql('SupplierRating', `DELETE FROM "SupplierRating" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
    await rawSql('BuyerRating', `DELETE FROM "BuyerRating" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
    await rawSql('ComplianceViolation', `DELETE FROM "ComplianceViolation" WHERE "userId" ${uIn}`);
    await rawSql('InvoiceFactoring_u', `DELETE FROM "InvoiceFactoring" WHERE "sellerId" ${uIn} OR "financierId" ${uIn}`);

    await rawSql('CatalogueImportError', `DELETE FROM "CatalogueImportError" WHERE "batchId" IN (${catBatchSub})`);
    await rawSql('CatalogueImportBatch', `DELETE FROM "CatalogueImportBatch" WHERE "sellerId" ${uIn}`);
    await rawSql('BuyerItemUploadBatch', `DELETE FROM "BuyerItemUploadBatch" WHERE "buyerId" ${uIn}`);
    await rawSql('BuyerFrequentlyBoughtItem', `DELETE FROM "BuyerFrequentlyBoughtItem" WHERE "buyerId" ${uIn}`);

    await rawSql('BidWizardDraft', `DELETE FROM "BidWizardDraft" WHERE "buyerId" ${uIn}`);
    await rawSql('Approval', `DELETE FROM "Approval" WHERE "userId" ${uIn}`);
    await rawSql('PasswordHistory', `DELETE FROM "PasswordHistory" WHERE "userId" ${uIn}`);
    await rawSql('ScopedInvitation', `DELETE FROM "ScopedInvitation" WHERE "invitedById" ${uIn}`);
    await rawSql('BuyerAcceptance', `DELETE FROM "BuyerAcceptance" WHERE "acceptedById" ${uIn}`);

    await rawSql('BuyerProfile', `DELETE FROM "BuyerProfile" WHERE "userId" ${uIn}`);
    await rawSql('SellerDocument', `DELETE FROM "SellerDocument" WHERE "sellerProfileId" IN (${sellerProfileSub})`);
    await rawSql('SellerBankAccount', `DELETE FROM "SellerBankAccount" WHERE "sellerProfileId" IN (${sellerProfileSub})`);
    await rawSql('SellerOffice', `DELETE FROM "SellerOffice" WHERE "sellerProfileId" IN (${sellerProfileSub})`);
    await rawSql('SellerDocument_nullify', `UPDATE "SellerDocument" SET "verifiedById" = NULL WHERE "verifiedById" ${uIn}`);
    await rawSql('SellerProfile', `DELETE FROM "SellerProfile" WHERE "userId" ${uIn}`);
    await rawSql('ShgProfile', `DELETE FROM "ShgProfile" WHERE "userId" ${uIn}`);
    await rawSql('ShgApplicationAuditLog', `DELETE FROM "ShgApplicationAuditLog" WHERE "actorUserId" ${uIn}`);

    await rawSql('MarketplaceBanner_nullify', `UPDATE "MarketplaceBanner" SET "uploadedByUserId" = NULL, "approvedByUserId" = NULL WHERE "uploadedByUserId" ${uIn} OR "approvedByUserId" ${uIn}`);
    await rawSql('BannerEligibility_nullify', `UPDATE "BannerEligibility" SET "grantedByUserId" = NULL, "revokedByUserId" = NULL WHERE "grantedByUserId" ${uIn} OR "revokedByUserId" ${uIn}`);

    await rawSql('ProvisionalReceiptCertificate_u', `DELETE FROM "ProvisionalReceiptCertificate" WHERE "generatedById" ${uIn}`);
    await rawSql('ConsigneeReceiptAcceptanceCertificate_u', `DELETE FROM "ConsigneeReceiptAcceptanceCertificate" WHERE "generatedById" ${uIn}`);

    await rawSql('UserRole', `DELETE FROM "UserRole" WHERE "userId" ${uIn}`);
    await rawSql('UserRole_nullify', `UPDATE "UserRole" SET "assignedById" = NULL WHERE "assignedById" ${uIn}`);
    await rawSql('UserSession', `DELETE FROM "UserSession" WHERE "userId" ${uIn}`);
    await rawSql('LoginEvent', `DELETE FROM "LoginEvent" WHERE "userId" ${uIn}`);
    await rawSql('Notification', `DELETE FROM "Notification" WHERE "userId" ${uIn}`);
    await rawSql('NotificationPreference', `DELETE FROM "NotificationPreference" WHERE "userId" ${uIn}`);
    await rawSql('IdempotencyKey', `DELETE FROM "IdempotencyKey" WHERE "userId" ${uIn}`);
    await rawSql('ApiLog', `DELETE FROM "ApiLog" WHERE "userId" ${uIn}`);
    await rawSql('ApiVerificationLog', `DELETE FROM "ApiVerificationLog" WHERE "userId" ${uIn}`);
    await rawSql('AuditLog', `DELETE FROM "AuditLog" WHERE "userId" ${uIn}`);
    await rawSql('FileAsset', `DELETE FROM "FileAsset" WHERE "ownerId" ${uIn}`);
    await rawSql('KycAuditLog', `DELETE FROM "KycAuditLog" WHERE "userId" ${uIn}`);
    await rawSql('KycAuthSession', `DELETE FROM "KycAuthSession" WHERE "userId" ${uIn}`);
    await rawSql('UserKycVerification', `DELETE FROM "UserKycVerification" WHERE "userId" ${uIn}`);

    await rawSql('User', `DELETE FROM "User" WHERE "id" = ${id}`);

    return counts;
  }, { timeout: 60_000, maxWait: 10_000 });

  if (req) {
    await createAuditLog(req, {
      action: 'user.permanent_delete',
      entityType: 'user',
      entityId: id,
      metadata: { reason, userName: user.name, userEmail: user.email, deletedCounts: summary }
    });
  }

  return user;
};

const companyPayload = (body: Record<string, unknown>) => ({
  name: textOrNull(body.name) || textOrNull(body.companyName) || 'Untitled Company',
  shortName: textOrNull(body.shortName),
  portalDisplayName: textOrNull(body.portalDisplayName) || textOrNull(body.name) || 'MSME Portal',
  logoUrl: textOrNull(body.logoUrl),
  contactEmail: textOrNull(body.contactEmail),
  contactPhone: textOrNull(body.contactPhone),
  address: textOrNull(body.address),
  district: textOrNull(body.district),
  state: textOrNull(body.state),
  themeSettings: body.themeSettings && typeof body.themeSettings === 'object' ? body.themeSettings : undefined,
  homepageContent: textOrNull(body.homepageContent),
  aboutContent: textOrNull(body.aboutContent),
  footerContent: textOrNull(body.footerContent),
  grievanceContent: textOrNull(body.grievanceContent),
  procurementPolicy: textOrNull(body.procurementPolicy),
  isActive: typeof body.isActive === 'boolean' ? body.isActive : true
});

const organizationSelect = {
  id: true,
  organizationName: true,
  organizationType: true,
  gstin: true,
  panNumber: true,
  cinNumber: true,
  udyamNumber: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  district: true,
  state: true,
  pincode: true,
  website: true,
  verificationStatus: true,
  isBlacklisted: true,
  blacklistReason: true,
  createdAt: true,
  updatedAt: true,
  users: {
    select: { id: true, email: true, mobile: true, name: true, role: true }
  },
  sellerProfiles: {
    include: {
      offices: true
    }
  },
  buyerProfiles: {
    select: { address: true, city: true, state: true, pincode: true }
  },
  kycVerifications: {
    where: { provider: 'MERIPEHCHAAN' as const, verificationType: 'AADHAAR' as const },
    take: 1,
    select: { status: true, provider: true, verificationType: true, verifiedName: true, verifiedAt: true, referenceKey: true, idTokenSubject: true }
  }
};

const organizationListSelect = {
  ...organizationSelect,
  _count: { select: { users: true } }
};

const userSelect = {
  id: true,
  userId: true,
  name: true,
  email: true,
  mobile: true,
  role: true,
  
  organizationId: true,
  onboardingStatus: true,
  accountStatus: true,
  emailVerified: true,
  lastLoginAt: true,
  failedLoginCount: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
  
  organization: { select: { id: true, organizationName: true, organizationType: true } },
  kycVerifications: {
    where: { provider: 'MERIPEHCHAAN' as const, verificationType: 'AADHAAR' as const },
    take: 1,
    select: { status: true, provider: true, verificationType: true, verifiedName: true, verifiedAt: true, referenceKey: true, idTokenSubject: true }
  }
};

const organizationPayload = (body: Record<string, unknown>, partial = false) => {
  const type = normalizedEnum(body.organizationType) || 'MSME';
  const verificationStatus = normalizedEnum(body.verificationStatus);
  if (!allowedOrganizationTypes.has(type)) throw new Error('INVALID_ORGANIZATION_TYPE');
  if (verificationStatus && !allowedVerificationStatuses.has(verificationStatus)) throw new Error('INVALID_STATUS');
  const data: any = {
    organizationName: textOrNull(body.organizationName) || textOrNull(body.name),
    organizationType: type,
    gstin: textOrNull(body.gstin) || textOrNull(body.gstNumber),
    panNumber: textOrNull(body.panNumber) || textOrNull(body.pan),
    cinNumber: textOrNull(body.cinNumber) || textOrNull(body.cin),
    udyamNumber: textOrNull(body.udyamNumber),
    addressLine1: textOrNull(body.addressLine1) || textOrNull(body.address),
    addressLine2: textOrNull(body.addressLine2),
    city: textOrNull(body.city),
    district: textOrNull(body.district),
    state: textOrNull(body.state),
    pincode: textOrNull(body.pincode),
    website: textOrNull(body.website),
    
    verificationStatus: verificationStatus || undefined,
    isBlacklisted: typeof body.isBlacklisted === 'boolean' ? body.isBlacklisted : undefined,
    blacklistReason: textOrNull(body.blacklistReason)
  };
  Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
  if (!partial && !data.organizationName) throw new Error('ORGANIZATION_NAME_REQUIRED');
  return data;
};



const userPayload = async (body: Record<string, unknown>, partial = false) => {
  const role = textOrNull(body.role);
  const status = normalizedEnum(body.accountStatus || body.status);
  if (role && !allowedRoles.has(role)) throw new Error('INVALID_ROLE');
  if (status && !allowedUserStatuses.has(status)) throw new Error('INVALID_STATUS');
  const password = textOrNull(body.password);
  const data: any = {
    name: textOrNull(body.name),
    email: textOrNull(body.email)?.toLowerCase(),
    mobile: textOrNull(body.mobile),
    role: role || undefined,
    
    organizationId: numberOrNullOrUndefined(body.organizationId),
    accountStatus: status || undefined
  };
  if (password) data.password = await hashPassword(password);
  Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
  if (!partial) {
    if (!data.name) throw new Error('USER_NAME_REQUIRED');
    if (!data.email) throw new Error('USER_EMAIL_REQUIRED');
    if (!data.role) throw new Error('INVALID_ROLE');
    if (!data.password) data.password = await hashPassword(`JsgSmile@${randomToken(8)}Aa1!`);
  }
  return data;
};

router.get('/master-admin/dashboard', ...masterOnly, wrap(async (_req, res) => {
  const [
    totalCompanies,
    activeCompanies,
    totalBuyers,
    totalSellers,
    totalAdmins,
    totalUsers,
    activeUsers,
    pendingApprovals,
    activeFeatures,
    totalOrganizations,
    activeOrganizations,
    pendingOrganizations,
    suspendedOrganizations,
    activeBids,
    totalOrders,
    totalPayments,
    pendingSettlements,
    openFraudAlerts,
    recentAuditLogs
  ] = await Promise.all([
    safeCount((prisma as any).company),
    safeCount((prisma as any).company, { where: { isActive: true } }),
    safeCount(prisma.user, { where: { role: 'buyer' } }),
    safeCount(prisma.user, { where: { role: 'seller' } }),
    safeCount(prisma.user, { where: { role: { in: ['admin', 'master_admin'] } } }),
    safeCount(prisma.user, { where: { accountStatus: { not: 'DELETED' as any } } }),
    safeCount(prisma.user, { where: { accountStatus: 'ACTIVE' as any } }),
    safeCount(prisma.user, { where: { onboardingStatus: { in: ['pending', 'pending_validation', 'under_compliance_review'] as any } } }),
    safeCount((prisma as any).platformFeature, { where: { enabled: true } }),
    safeCount(prisma.organization, { where: { verificationStatus: { notIn: ['CLOSED', 'ARCHIVED'] as any }, deletedAt: null } }),
    safeCount(prisma.organization, { where: { verificationStatus: 'VERIFIED' as any } }),
    safeCount(prisma.organization, { where: { verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] as any } } }),
    safeCount(prisma.organization, { where: { OR: [{ isBlacklisted: true }, { verificationStatus: 'SUSPENDED' as any }] } }),
    safeCount((prisma as any).procurementBid, { where: { status: { in: ['OPEN', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'L1_GENERATED', 'AWARD_RECOMMENDED'] } } }),
    safeCount((prisma as any).purchaseOrder),
    safeCount((prisma as any).paymentTransaction),
    safeCount((prisma as any).paymentSettlement, { where: { status: 'PENDING' } }),
    safeCount((prisma as any).fraudAlert, { where: { status: 'OPEN' } }),
    safeFindMany(prisma.auditLog, {
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        User: { select: { id: true, name: true, email: true, role: true } }
      }
    })
  ]);
  const databaseHealthy = [
    totalCompanies,
    totalOrganizations,
    totalUsers,
    activeBids,
    totalOrders,
    totalPayments,
    recentAuditLogs.length
  ].some(Boolean);

  res.json({
    summary: {
      totalCompanies,
      activeCompanies,
      totalOrganizations,
      activeOrganizations,
      pendingOrganizations,
      suspendedOrganizations,
      totalBuyers,
      totalSellers,
      totalAdmins,
      totalUsers,
      activeUsers,
      pendingApprovals,
      activeFeatures,
      activeBids,
      totalOrders,
      totalPayments,
      pendingSettlements,
      openFraudAlerts
    },
    systemHealth: { api: 'ok', database: databaseHealthy ? 'ok' : 'degraded' },
    recentAuditLogs
  });
}));

router.get('/master-admin/overview', ...masterOnly, wrap(async (_req, res) => {
  const [
    totalOrganizations,
    activeOrganizations,
    suspendedOrganizations,
    totalUsers,
    activeUsers,
    suspendedUsers,
    activeBids,
    totalOrders,
    totalPayments,
    pendingSettlements,
    fraudAlerts,
    pendingApprovals
  ] = await Promise.all([
    safeCount(prisma.organization, { where: { verificationStatus: { notIn: ['CLOSED', 'ARCHIVED'] as any }, deletedAt: null } }),
    safeCount(prisma.organization, { where: { verificationStatus: 'VERIFIED' as any, isBlacklisted: false, deletedAt: null } }),
    safeCount(prisma.organization, { where: { OR: [{ verificationStatus: 'SUSPENDED' as any }, { isBlacklisted: true }], deletedAt: null } }),
    safeCount(prisma.user, { where: { accountStatus: { not: 'DELETED' as any } } }),
    safeCount(prisma.user, { where: { accountStatus: 'ACTIVE' as any } }),
    safeCount(prisma.user, { where: { accountStatus: 'SUSPENDED' as any } }),
    safeCount((prisma as any).procurementBid, { where: { status: { in: ['OPEN', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'L1_GENERATED', 'AWARD_RECOMMENDED'] } } }),
    safeCount((prisma as any).purchaseOrder),
    safeCount((prisma as any).paymentTransaction),
    safeCount((prisma as any).paymentSettlement, { where: { status: 'PENDING' } }),
    safeCount((prisma as any).fraudAlert, { where: { status: 'OPEN' } }),
    safeCount((prisma as any).procurementBid, { where: { approvalStatus: 'PENDING' } })
  ]);
  jsonOk(res, {
    summary: {
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalUsers,
      activeUsers,
      suspendedUsers,
      activeBids,
      totalOrders,
      totalPayments,
      pendingSettlements,
      fraudAlerts,
      pendingApprovals
    }
  });
}));

router.get('/master-admin/companies', ...masterOnly, wrap(async (req, res) => {
  const { page, pageSize } = getPagination(req.query as Record<string, unknown>);
  res.json({
    items: [{
      id: 1,
      name: 'Collectorate Jharsuguda',
      shortName: 'Jharsuguda',
      portalDisplayName: 'Collectorate Jharsuguda Portal',
      logoUrl: '/brand/logo.png',
      contactEmail: 'admin@jharsuguda.gov.in',
      contactPhone: '+91 6645 272101',
      address: 'District Magistrate & Collectorate Office, Jharsuguda',
      district: 'Jharsuguda',
      state: 'Odisha',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }],
    total: 1,
    page,
    pageSize
  });
}));

router.post('/master-admin/companies', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), wrap(async (req, res) => {
  res.status(201).json({ id: 1, name: 'Collectorate Jharsuguda' });
}));

router.put('/master-admin/companies/:id', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), wrap(async (req, res) => {
  res.json({ id: 1, name: 'Collectorate Jharsuguda' });
}));

const companyStatusAction = (action: 'activate' | 'inactivate' | 'suspend' | 'reactivate' | 'archive') =>
  wrap(async (req, res) => {
    res.json({ success: true, message: `Single tenant portal operation ${action} noted` });
  });

router.post('/master-admin/companies/:id/activate', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), companyStatusAction('activate'));
router.post('/master-admin/companies/:id/inactivate', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), companyStatusAction('inactivate'));
router.post('/master-admin/companies/:id/suspend', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), companyStatusAction('suspend'));
router.post('/master-admin/companies/:id/reactivate', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), companyStatusAction('reactivate'));
router.post('/master-admin/companies/:id/archive', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), companyStatusAction('archive'));

router.delete('/master-admin/companies/:id', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'archive company');
  if (!reason) return;
  const company = await (prisma as any).company.update({ where: { id }, data: { isActive: false }, select: companySelect });
  await createAuditLog(req, { action: 'company.archive', entityType: 'company', entityId: id, metadata: { reason, requestedVia: 'DELETE' } });
  jsonOk(res, company, 'Company archived successfully. Historical records were preserved.');
}));

// ── Cascade-delete a company and ALL related data ──────────────────────
router.delete('/master-admin/companies/:id/cascade', ...masterOnly, requirePermission(PERMISSIONS.COMPANY_MANAGE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'permanently delete company');
  if (!reason) return;
  const confirmPhrase = textOrNull(req.body?.confirmPhrase);
  if (confirmPhrase !== 'DELETE PERMANENTLY') {
    return jsonError(res, 400, 'You must type "DELETE PERMANENTLY" to confirm this destructive action.', 'CONFIRM_REQUIRED');
  }

  const company = await (prisma as any).company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      organizations: { select: { id: true } }
    }
  });

  if (!company) return jsonError(res, 404, 'Company not found.', 'NOT_FOUND');

  const orgIds = company.organizations.map((o: any) => o.id);

  // Get all users associated with this company (either directly or via its organizations)
  const users = await prisma.user.findMany({
    where: {
      organizationId: { in: orgIds }
    },
    select: { id: true, role: true, userId: true }
  });

  // Block deletion if any user is master_admin
  const hasMasterAdmin = users.some(u => u.role === 'master_admin' || u.userId === 'MASTER_ADMIN');
  if (hasMasterAdmin) {
    return jsonError(res, 403, 'Cannot delete a company that contains the Master Admin user.', 'MASTER_ADMIN_LOCKED');
  }

  // Check for active financials
  const userIds = users.map(u => u.id);
  const activePayments = userIds.length > 0 ? await safeCount((prisma as any).paymentTransaction, {
    where: { OR: [{ payerId: { in: userIds } }, { payeeId: { in: userIds } }], status: { in: ['INITIATED', 'PENDING', 'PROCESSING'] } }
  }) : 0;
  const activeEscrows = userIds.length > 0 ? await safeCount((prisma as any).escrowAccount, {
    where: { OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }], status: { in: ['HELD', 'FUNDED'] } }
  }) : 0;

  if (activePayments > 0 || activeEscrows > 0) {
    return jsonError(res, 409, `Cannot delete: ${activePayments} active payment(s) and ${activeEscrows} active escrow(s) exist under this company's organizations/users. Resolve them first.`, 'ACTIVE_FINANCIALS');
  }

  // Perform cascade deletion in a transaction
  const summary = await prisma.$transaction(async (tx: any) => {
    const counts: Record<string, number> = {};
    const del = async (model: string, where: any) => {
      try {
        const result = await tx[model].deleteMany({ where });
        counts[model] = (counts[model] || 0) + result.count;
      } catch { counts[model] = counts[model] || 0; }
    };

    // If there are organizations, clean up their tables first
    if (orgIds.length > 0) {
      // 1. KYC records
      await del('kycAuditLog', { organizationId: { in: orgIds } });
      await del('kycAuthSession', { organizationId: { in: orgIds } });
      await del('userKycVerification', { organizationId: { in: orgIds } });

      // 2. Marketplace interactions
      await del('marketplaceInteraction', { organizationId: { in: orgIds } });

      // 3. Procurement
      const procBids = await tx.procurementBid.findMany({
        where: {
          OR: [
            { buyerOrganizationId: { in: orgIds } },
            { buyerId: { in: userIds } }
          ]
        },
        select: { id: true }
      }).catch(() => []);
      const procBidIds = procBids.map((b: any) => b.id);
      if (procBidIds.length > 0) {
        await del('procurementBidClarificationFile', { clarification: { bidId: { in: procBidIds } } });
        await del('procurementBidClarification', { bidId: { in: procBidIds } });
        await del('procurementBidParticipationDocument', { participation: { bidId: { in: procBidIds } } });
        await del('procurementBidParticipation', { bidId: { in: procBidIds } });
        await del('procurementBidDocument', { bidId: { in: procBidIds } });
        await del('procurementBidEvaluation', { bidId: { in: procBidIds } });
        await del('procurementBidAward', { bidId: { in: procBidIds } });
        await del('procurementAuditLog', { bidId: { in: procBidIds } });
        await del('comparativeStatement', { bidId: { in: procBidIds } });
        await del('l1Comparison', { organizationId: { in: orgIds } });
      }
      await del('procurementBid', {
        OR: [
          { buyerOrganizationId: { in: orgIds } },
          { buyerId: { in: userIds } }
        ]
      });
      await del('procurementApproval', { organizationId: { in: orgIds } });
      await del('procurementRequest', { organizationId: { in: orgIds } });
      await del('procurementModeSetting', { organizationId: { in: orgIds } });

      // 4. Cart / guest cart items referencing products/services
      const orgProducts = await tx.product.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } }).catch(() => []);
      const orgServices = await tx.service.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } }).catch(() => []);
      const productIds = orgProducts.map((p: any) => p.id);
      const serviceIds = orgServices.map((s: any) => s.id);
      if (productIds.length > 0) {
        await del('cartItem', { productId: { in: productIds } });
        await del('guestCartItem', { productId: { in: productIds } });
        await del('productImage', { productId: { in: productIds } });
        await del('productSpecification', { productId: { in: productIds } });
        await del('certification', { productId: { in: productIds } });
      }
      if (serviceIds.length > 0) {
        await del('cartItem', { serviceId: { in: serviceIds } });
        await del('guestCartItem', { serviceId: { in: serviceIds } });
        await del('serviceSpecification', { serviceId: { in: serviceIds } });
        await del('certification', { serviceId: { in: serviceIds } });
      }

      // 5. Marketplace products/services/requirements
      await del('product', { organizationId: { in: orgIds } });
      await del('service', { organizationId: { in: orgIds } });
      await del('requirement', { organizationId: { in: orgIds } });
      await del('category', { organizationId: { in: orgIds } });

      // 6. Buyer/seller data
      await del('buyerRequirement', { buyerOrganizationId: { in: orgIds } });
      await del('requirementResponse', { organizationId: { in: orgIds } });

      // 7. Carts
      const orgCarts = await tx.cart.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } }).catch(() => []);
      const cartIds = orgCarts.map((c: any) => c.id);
      if (cartIds.length > 0) {
        await del('cartItem', { cartId: { in: cartIds } });
      }
      await del('cart', { organizationId: { in: orgIds } });
      await del('guestCartItem', { organizationId: { in: orgIds } });

      // 8. GRNs
      const orgGrns = await tx.goodsReceiptNote.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } }).catch(() => []);
      const grnIds = orgGrns.map((g: any) => g.id);
      if (grnIds.length > 0) {
        await del('grnItem', { grnId: { in: grnIds } });
        await del('grnDocument', { grnId: { in: grnIds } });
      }
      await del('goodsReceiptNote', { organizationId: { in: orgIds } });

      // 9. Disputes where these orgs are involved
      await del('disputeMessage', { organizationId: { in: orgIds } });

      // 10. Fraud alerts
      await del('fraudAlert', { organizationId: { in: orgIds } });

      // 11. Org memberships, invitations, custom roles
      const orgCustomRoles = await tx.orgCustomRole.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } }).catch(() => []);
      const customRoleIds = orgCustomRoles.map((r: any) => r.id);
      if (customRoleIds.length > 0) {
        await del('orgRolePermission', { roleId: { in: customRoleIds } });
      }
      await del('orgMembership', { organizationId: { in: orgIds } });
      await del('orgInvitation', { organizationId: { in: orgIds } });
      await del('orgCustomRole', { organizationId: { in: orgIds } });
      await del('accessTransferLog', { organizationId: { in: orgIds } });

      // 12. Addresses
      await del('deliveryAddress', { organizationId: { in: orgIds } });
      await del('addressGroup', { organizationId: { in: orgIds } });

      // 13. Organization profiles
      await del('organizationProfile', { organizationId: { in: orgIds } });

      // 14. Monthly ranks and banners
      await del('organizationMonthlyRank', { organizationId: { in: orgIds } });
      await del('bannerEligibility', { organizationId: { in: orgIds } });
    }

    // Direct company tables cleanup
    // 15. Buyer requirements directly under company
    await del('buyerRequirement', { companyId: id });

    // 16. Guest carts under company
    const compGuestCarts = await tx.guestCart.findMany({ where: { companyId: id }, select: { id: true } }).catch(() => []);
    const compGuestCartIds = compGuestCarts.map((gc: any) => gc.id);
    if (compGuestCartIds.length > 0) {
      await del('guestCartItem', { guestCartId: { in: compGuestCartIds } });
    }
    await del('guestCart', { companyId: id });

    // 17. RbacRole permissions & RbacRole
    const rbacRoles = await tx.rbacRole.findMany({ where: { companyId: id }, select: { id: true } }).catch(() => []);
    const rbacRoleIds = rbacRoles.map((rr: any) => rr.id);
    if (rbacRoleIds.length > 0) {
      await del('rolePermission', { roleId: { in: rbacRoleIds } });
    }
    await del('rbacRole', { companyId: id });

    // 18. CompanyFeatures, CompanySettings, ContentPages, Banners, Notices, Settings
    await del('platformFeature', { companyId: id });
    await del('companySetting', { companyId: id });
    await del('contentPage', { companyId: id });
    await del('marketplaceBanner', { companyId: id });
    await del('marketplaceNotice', { companyId: id });
    await del('marketplaceSetting', { companyId: id });

    // 19. User profiles & data for company users
    if (userIds.length > 0) {
      await del('buyerProfile', { userId: { in: userIds } });
      const sellerProfiles = await tx.sellerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } }).catch(() => []);
      const sellerProfileIds = sellerProfiles.map((sp: any) => sp.id);
      if (sellerProfileIds.length > 0) {
        await del('sellerDocument', { sellerProfileId: { in: sellerProfileIds } });
        await del('sellerBankAccount', { sellerProfileId: { in: sellerProfileIds } });
        await del('sellerOffice', { sellerProfileId: { in: sellerProfileIds } });
      }
      await del('sellerProfile', { userId: { in: userIds } });
      await del('shgProfile', { primaryUserId: { in: userIds } });

      await del('userRole', { userId: { in: userIds } });
      await del('userSession', { userId: { in: userIds } });
      await del('loginEvent', { userId: { in: userIds } });
      await del('notification', { userId: { in: userIds } });
      await del('notificationPreference', { userId: { in: userIds } });
      await del('idempotencyKey', { userId: { in: userIds } });
      await del('apiLog', { userId: { in: userIds } });
      await del('apiVerificationLog', { userId: { in: userIds } });
      await del('auditLog', { userId: { in: userIds } });
      await del('fileAsset', { ownerId: { in: userIds } });

      const deletedUsers = await tx.user.deleteMany({ where: { id: { in: userIds } } });
      counts['user'] = deletedUsers.count;
    }

    // 20. Finally, delete the organizations & company itself
    if (orgIds.length > 0) {
      const deletedOrgs = await tx.organization.deleteMany({ where: { companyId: id } });
      counts['organization'] = deletedOrgs.count;
    }
    await tx.company['delete']({ where: { id } });
    counts['company'] = 1;

    return counts;
  }, { timeout: 300_000, maxWait: 60_000 });

  await createAuditLog(req, {
    action: 'company.cascade_delete',
    entityType: 'company',
    entityId: id,
    metadata: { reason, companyName: company.name, deletedCounts: summary }
  });

  await invalidateByPattern('master-admin:*');

  jsonOk(res, { deleted: summary, companyName: company.name }, `Company "${company.name}" and all related data permanently deleted.`);
}));

router.get('/master-admin/features', ...masterOnly, wrap(async (_req, res) => {
  const features = await (prisma as any).feature.findMany({ orderBy: [{ module: 'asc' }, { name: 'asc' }] });
  res.json({ items: features });
}));

router.get('/master-admin/companies/:id/features', ...masterOnly, wrap(async (req, res) => {
  const companyId = Number(req.params.id);
  const features = await (prisma as any).feature.findMany({
    orderBy: [{ module: 'asc' }, { name: 'asc' }],
    include: { companies: { where: { companyId } } }
  });
  res.json({
    items: features.map((feature: any) => ({
      id: feature.id,
      code: feature.code,
      name: feature.name,
      module: feature.module,
      description: feature.description,
      enabled: feature.companies[0]?.enabled ?? (feature.code === 'admin-bid-approval' ? true : false)
    }))
  });
}));

router.put('/master-admin/companies/:id/features', ...masterOnly, requirePermission(PERMISSIONS.FEATURE_TOGGLE), wrap(async (req, res) => {
  const companyId = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'update feature controls');
  if (!reason) return;
  const features = Array.isArray(req.body?.features) ? req.body.features : [];
  for (const row of features) {
    const featureId = Number(row.featureId || row.id);
    if (!Number.isFinite(featureId)) continue;
    await (prisma as any).platformFeature.upsert({
      where: { companyId_featureId: { companyId, featureId } },
      update: { enabled: Boolean(row.enabled), updatedById: req.user?.id },
      create: { companyId, featureId, enabled: Boolean(row.enabled), updatedById: req.user?.id }
    });
  }
  await createAuditLog(req, { action: 'feature.toggle', entityType: 'company', entityId: companyId, metadata: { count: features.length, reason } });
  res.json({ success: true });
}));

router.post('/master-admin/companies/:id/features/:featureKey/enable', ...masterOnly, requirePermission(PERMISSIONS.FEATURE_TOGGLE), wrap(async (req, res) => {
  const companyId = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'enable feature');
  if (!reason) return;
  const feature = await (prisma as any).feature.findUnique({ where: { code: req.params.featureKey } });
  if (!feature) return jsonError(res, 404, 'Feature not found.', 'ACTION_NOT_ALLOWED');
  await (prisma as any).platformFeature.upsert({
    where: { companyId_featureId: { companyId, featureId: feature.id } },
    update: { enabled: true, updatedById: req.user?.id },
    create: { companyId, featureId: feature.id, enabled: true, updatedById: req.user?.id }
  });
  await createAuditLog(req, { action: 'feature.enable', entityType: 'company', entityId: companyId, metadata: { featureKey: feature.code, reason } });
  jsonOk(res, { featureKey: feature.code, enabled: true }, 'Feature enabled');
}));

router.post('/master-admin/companies/:id/features/:featureKey/disable', ...masterOnly, requirePermission(PERMISSIONS.FEATURE_TOGGLE), wrap(async (req, res) => {
  const companyId = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'disable feature');
  if (!reason) return;
  const feature = await (prisma as any).feature.findUnique({ where: { code: req.params.featureKey } });
  if (!feature) return jsonError(res, 404, 'Feature not found.', 'ACTION_NOT_ALLOWED');
  await (prisma as any).platformFeature.upsert({
    where: { companyId_featureId: { companyId, featureId: feature.id } },
    update: { enabled: false, updatedById: req.user?.id },
    create: { companyId, featureId: feature.id, enabled: false, updatedById: req.user?.id }
  });
  await createAuditLog(req, { action: 'feature.disable', entityType: 'company', entityId: companyId, metadata: { featureKey: feature.code, reason } });
  jsonOk(res, { featureKey: feature.code, enabled: false }, 'Feature disabled');
}));

router.get('/master-admin/roles', ...masterOnly, wrap(async (req, res) => {
  const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
  const roles = await (prisma as any).rbacRole.findMany({
    where: companyId ? { OR: [{ }, { companyId }] } : {},
    include: { permissions: { include: { permission: true } }, },
    orderBy: [{ scope: 'asc' }, { name: 'asc' }]
  });
  res.json({ items: roles });
}));

router.post('/master-admin/roles', ...masterOnly, requirePermission(PERMISSIONS.PERMISSION_MANAGE), wrap(async (req, res) => {
  const code = String(req.body?.code || req.body?.name || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
  if (!code) return res.status(400).json({ message: 'Role code is required' });
  const role = await (prisma as any).rbacRole.create({
    data: {
      code,
      name: textOrNull(req.body?.name) || code,
      description: textOrNull(req.body?.description),
      
      scope: req.body?.organizationScoped ? 'ORGANIZATION' : req.body?.companyId ? 'COMPANY' : 'GLOBAL',
      isSystemRole: false
    }
  });
  await createAuditLog(req, { action: 'role.create', entityType: 'role', entityId: role.id, metadata: { code } });
  res.status(201).json(role);
}));

router.put('/master-admin/roles/:id/permissions', ...masterOnly, requirePermission(PERMISSIONS.PERMISSION_MANAGE), wrap(async (req, res) => {
  const roleId = Number(req.params.id);
  const permissionIds = (Array.isArray(req.body?.permissionIds) ? req.body.permissionIds : []).map(Number).filter(Number.isFinite);
  await (prisma as any).rolePermission.deleteMany({ where: { roleId } });
  await (prisma as any).rolePermission.createMany({
    data: permissionIds.map((permissionId: number) => ({ roleId, permissionId })),
    skipDuplicates: true
  });
  await createAuditLog(req, { action: 'permission.manage', entityType: 'role', entityId: roleId, metadata: { permissionIds } });
  res.json({ success: true });
}));

router.get('/master-admin/permissions', ...masterOnly, wrap(async (_req, res) => {
  const permissions = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  res.json({ items: permissions });
}));

router.get('/master-admin/users', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const companyId = numberOrUndefined(req.query.companyId);
  const role = textOrNull(req.query.role);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(companyId ? { companyId } : {}),
    ...(role ? (role === 'master_admin' ? { id: -1 } : { role }) : { role: { not: 'master_admin' } }),
    userId: { not: 'MASTER_ADMIN' },
    accountStatus: status ? (status as any) : { not: 'DELETED' },
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { userId: { contains: q, mode: 'insensitive' } }] } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    name: 'name',
    email: 'email',
    role: 'role',
    accountStatus: 'accountStatus',
    onboardingStatus: 'onboardingStatus',
    createdAt: 'createdAt'
  }, { createdAt: 'desc' });
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy,
      select: userSelect
    }),
    prisma.user.count({ where })
  ]);
  res.json({ items: (items as any[]).map(withAadhaarKyc), total, page, pageSize });
}));

router.post('/master-admin/users/:id/roles', ...masterOnly, requirePermission(PERMISSIONS.ROLE_ASSIGN), wrap(async (req, res) => {
  const userId = Number(req.params.id);
  const roleId = Number(req.body?.roleId);
  if (!Number.isFinite(roleId)) return res.status(400).json({ message: 'roleId is required' });
  const assignment = await (prisma as any).userRole.create({
    data: {
      userId,
      roleId,
      
      organizationId: req.body?.organizationId ? Number(req.body.organizationId) : null,
      assignedById: req.user?.id,
      isActive: true
    }
  });
  await createAuditLog(req, { action: 'role.assign', entityType: 'user', entityId: userId, metadata: { roleId } });
  res.status(201).json(assignment);
}));

router.get('/master-admin/organizations', ...masterOnly, wrap(async (req, res) => {
  // Dynamically backfill/ensure organizations for registered users who are in review but don't have organization linked yet
  const pendingUsers = await prisma.user.findMany({
    where: {
      role: { in: ['buyer', 'seller'] },
      onboardingStatus: 'under_compliance_review',
      organizationId: null
    },
    select: { id: true }
  });

  if (pendingUsers.length > 0) {
    for (const pendingUser of pendingUsers) {
      try {
        await createOrUpdatePendingOrganization(pendingUser.id);
      } catch (err) {
        console.error(`[Organizations API] Dynamic pending organization backfill failed for user ${pendingUser.id}:`, err);
      }
    }
  }

  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const companyId = numberOrUndefined(req.query.companyId);
  const verificationStatus = textOrNull(req.query.status);
  const organizationType = textOrNull(req.query.organizationType);
  const where: any = {
    ...(companyId ? { companyId } : {}),
    ...(verificationStatus ? { verificationStatus: verificationStatus as any } : {}),
    ...(organizationType ? { organizationType: { contains: organizationType, mode: 'insensitive' } } : {}),
    ...(q ? {
      OR: [
        { organizationName: { contains: q, mode: 'insensitive' } },
        { gstin: { contains: q, mode: 'insensitive' } },
        { pan: { contains: q, mode: 'insensitive' } },
        { district: { contains: q, mode: 'insensitive' } },
        { state: { contains: q, mode: 'insensitive' } }
      ]
    } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    organizationName: 'organizationName',
    organizationType: 'organizationType',
    verificationStatus: 'verificationStatus',
    state: 'state',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }, { updatedAt: 'desc' });
  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip,
      take,
      orderBy,
      select: organizationListSelect as any
    }),
    prisma.organization.count({ where })
  ]);
  res.json({ items: (items as any[]).map(withAadhaarKyc), total, page, pageSize });
}));

router.put('/master-admin/companies/:id/content', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), wrap(async (req, res) => {
  const companyId = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'update branding content');
  if (!reason) return;
  const company = await (prisma as any).company.update({
    where: { id: companyId },
    data: {
      logoUrl: textOrNull(req.body?.logoUrl),
      portalDisplayName: textOrNull(req.body?.portalDisplayName) || undefined,
      homepageContent: textOrNull(req.body?.homepageContent),
      aboutContent: textOrNull(req.body?.aboutContent),
      footerContent: textOrNull(req.body?.footerContent),
      grievanceContent: textOrNull(req.body?.grievanceContent),
      procurementPolicy: textOrNull(req.body?.procurementPolicy),
      contactEmail: textOrNull(req.body?.contactEmail),
      contactPhone: textOrNull(req.body?.contactPhone)
    },
    select: companySelect
  });
  await createAuditLog(req, { action: 'content.update', entityType: 'company', entityId: companyId, metadata: { reason } });
  res.json(company);
}));

router.get('/master-admin/audit-logs', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const companyId = numberOrUndefined(req.query.companyId);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const action = textOrNull(req.query.action);
  const entityType = textOrNull(req.query.entityType);
  const where: any = {
    ...(companyId ? { companyId } : {}),
    ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
    ...(entityType ? { entityType: { contains: entityType, mode: 'insensitive' } } : {}),
    ...(q ? { OR: [{ action: { contains: q, mode: 'insensitive' } }, { entityType: { contains: q, mode: 'insensitive' } }] } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    action: 'action',
    entityType: 'entityType',
    entityId: 'entityId',
    createdAt: 'createdAt'
  }, { createdAt: 'desc' });
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        
        ipAddress: true,
        createdAt: true,
        User: { select: { id: true, name: true, email: true, role: true } }
      }
    }),
    prisma.auditLog.count({ where })
  ]);
  res.json({ items, total, page, pageSize });
}));

router.post('/master-admin/organizations', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), wrap(async (req, res) => {
  const reason = ensureReason(res, req.body, 'create organization');
  if (!reason) return;
  try {
    const data = organizationPayload(req.body || {});
    if (data.companyId === undefined || data.companyId === null) {
      data.companyId = await getDefaultCompanyId();
    }
    const duplicate = await prisma.organization.findFirst({
      where: {
        OR: [
          { organizationName: data.organizationName },
          ...(data.gstin ? [{ gstin: data.gstin }] : []),
          ...(data.panNumber ? [{ panNumber: data.panNumber }] : [])
        ]
      },
      select: { id: true }
    });
    if (duplicate) return jsonError(res, 409, 'An organization with matching name, GST, or PAN already exists.', 'DUPLICATE_ORGANIZATION');
    const organization: any = await prisma.organization.create({ data, select: organizationSelect as any });
    await createAuditLog(req, { action: 'organization.create', entityType: 'organization', entityId: organization.id, metadata: { name: organization.organizationName, reason } });
    jsonOk(res, organization, 'Organization created successfully', 201);
  } catch (error: any) {
    const code = String(error?.message || '');
    if (code === 'INVALID_ORGANIZATION_TYPE') return jsonError(res, 400, 'Invalid organization type selected.', 'VALIDATION_ERROR');
    if (code === 'INVALID_STATUS') return jsonError(res, 400, 'Invalid organization status selected.', 'INVALID_STATUS');
    return jsonError(res, 400, 'Organization name is required.', 'VALIDATION_ERROR');
  }
}));

router.get('/master-admin/organizations/:id', ...masterOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const organization = await prisma.organization.findUnique({ where: { id }, select: organizationSelect as any });
  if (!organization) return jsonError(res, 404, 'Organization not found.', 'ORGANIZATION_NOT_FOUND');
  jsonOk(res, withAadhaarKyc(organization as any));
}));

router.put('/master-admin/organizations/:id', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'update organization');
  if (!reason) return;
  try {
    const data = organizationPayload(req.body || {}, true);
    const organization: any = await prisma.organization.update({ where: { id }, data, select: organizationSelect as any });
    await createAuditLog(req, { action: 'organization.update', entityType: 'organization', entityId: id, metadata: { name: organization.organizationName, reason } });
    jsonOk(res, organization, 'Organization updated successfully');
  } catch (error: any) {
    const code = String(error?.message || '');
    if (code === 'INVALID_ORGANIZATION_TYPE') return jsonError(res, 400, 'Invalid organization type selected.', 'VALIDATION_ERROR');
    if (code === 'INVALID_STATUS') return jsonError(res, 400, 'Invalid organization status selected.', 'INVALID_STATUS');
    return jsonError(res, 404, 'Organization not found or update is invalid.', 'ORGANIZATION_NOT_FOUND');
  }
}));

const organizationStatusAction = (action: 'activate' | 'inactivate' | 'suspend' | 'reactivate' | 'archive') =>
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const reason = ensureReason(res, req.body, action);
    if (!reason) return;
    const data: any = action === 'activate' || action === 'reactivate'
      ? { verificationStatus: 'VERIFIED', isBlacklisted: false, blacklistReason: null }
      : action === 'inactivate'
        ? { verificationStatus: 'UNDER_REVIEW', blacklistReason: reason }
        : { verificationStatus: 'SUSPENDED', isBlacklisted: true, blacklistReason: reason };
    const organization = await prisma.organization.update({ where: { id }, data, select: organizationSelect as any });
    await createAuditLog(req, { action: `organization.${action}`, entityType: 'organization', entityId: id, metadata: { reason } });
    jsonOk(res, organization, `Organization ${action} successful`);
  });

router.post('/master-admin/organizations/:id/activate', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), organizationStatusAction('activate'));
router.post('/master-admin/organizations/:id/inactivate', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), organizationStatusAction('inactivate'));
router.post('/master-admin/organizations/:id/suspend', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), organizationStatusAction('suspend'));
router.post('/master-admin/organizations/:id/reactivate', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), organizationStatusAction('reactivate'));
router.post('/master-admin/organizations/:id/archive', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), organizationStatusAction('archive'));

// PATCH /master-admin/organizations/:id/close
router.patch('/master-admin/organizations/:id/close', ...masterOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { reason, confirm, documentNote } = req.body || {};
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Reason is required for this action.' });
  }
  if (confirm !== true) {
    return res.status(400).json({ error: 'CONFIRMATION_REQUIRED', message: 'Confirmation is required for this action.' });
  }

  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) {
    return res.status(404).json({ error: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
  }

  const { getOrganizationClosureBlockers } = await import('../utils/closureBlockers.js');
  const blockers = await getOrganizationClosureBlockers(id);
  if (blockers) {
    return res.status(409).json(blockers);
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      verificationStatus: 'CLOSED' as any,
      closedAt: new Date(),
      closedBy: req.user?.id,
      closureReason: reason,
      blacklistReason: reason
    },
    select: organizationSelect as any
  });

  await createAuditLog(req, {
    action: 'ORGANIZATION_CLOSED',
    entityType: 'organization',
    entityId: id,
    metadata: {
      reason,
      documentNote,
      oldValue: { verificationStatus: organization.verificationStatus },
      newValue: { verificationStatus: 'CLOSED' }
    }
  });

  return res.json({ success: true, organization: updated, message: 'Organization closed successfully.' });
}));

// PATCH /master-admin/organizations/:id/archive
router.patch('/master-admin/organizations/:id/archive', ...masterOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { reason, confirm, documentNote } = req.body || {};
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Reason is required for this action.' });
  }
  if (confirm !== true) {
    return res.status(400).json({ error: 'CONFIRMATION_REQUIRED', message: 'Confirmation is required for this action.' });
  }

  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) {
    return res.status(404).json({ error: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
  }

  const { getOrganizationClosureBlockers } = await import('../utils/closureBlockers.js');
  const blockers = await getOrganizationClosureBlockers(id);
  if (blockers) {
    return res.status(409).json(blockers);
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      verificationStatus: 'ARCHIVED' as any,
      archivedAt: new Date(),
      archivedBy: req.user?.id,
      closureReason: reason
    },
    select: organizationSelect as any
  });

  await createAuditLog(req, {
    action: 'ORGANIZATION_ARCHIVED',
    entityType: 'organization',
    entityId: id,
    metadata: {
      reason,
      documentNote,
      oldValue: { verificationStatus: organization.verificationStatus },
      newValue: { verificationStatus: 'ARCHIVED' }
    }
  });

  return res.json({ success: true, organization: updated, message: 'Organization archived successfully.' });
}));

// PATCH /master-admin/organizations/:id/restore
router.patch('/master-admin/organizations/:id/restore', ...masterOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { reason, documentNote } = req.body || {};
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Reason is required for this action.' });
  }

  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) {
    return res.status(404).json({ error: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      verificationStatus: 'VERIFIED' as any,
      closedAt: null,
      closedBy: null,
      archivedAt: null,
      archivedBy: null,
      closureReason: null
    },
    select: organizationSelect as any
  });

  await createAuditLog(req, {
    action: 'ORGANIZATION_RESTORED',
    entityType: 'organization',
    entityId: id,
    metadata: {
      reason,
      documentNote,
      oldValue: { verificationStatus: organization.verificationStatus },
      newValue: { verificationStatus: 'VERIFIED' }
    }
  });

  return res.json({ success: true, organization: updated, message: 'Organization restored successfully.' });
}));

// PATCH /master-admin/organizations/:id/allow-gst-reuse
router.patch('/master-admin/organizations/:id/allow-gst-reuse', ...masterOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { reason, confirm, documentNote } = req.body || {};
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Reason is required for this action.' });
  }
  if (confirm !== true) {
    return res.status(400).json({ error: 'CONFIRMATION_REQUIRED', message: 'Confirmation is required for this action.' });
  }

  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) {
    return res.status(404).json({ error: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
  }

  if (organization.verificationStatus !== 'CLOSED' && organization.verificationStatus !== 'ARCHIVED') {
    return res.status(400).json({ error: 'GST_REUSE_NOT_ALLOWED', message: 'GST reuse can only be allowed for CLOSED or ARCHIVED organizations.' });
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      gstReuseAllowed: true,
      gstReuseAllowedBy: req.user?.id,
      gstReuseAllowedAt: new Date(),
      gstReuseReason: reason
    },
    select: organizationSelect as any
  });

  await createAuditLog(req, {
    action: 'ORGANIZATION_GST_REUSE_ALLOWED',
    entityType: 'organization',
    entityId: id,
    metadata: {
      reason,
      documentNote,
      oldValue: { gstReuseAllowed: organization.gstReuseAllowed },
      newValue: { gstReuseAllowed: true }
    }
  });

  return res.json({ success: true, organization: updated, message: 'GST reuse allowed successfully.' });
}));

// PATCH /master-admin/organizations/:id/revoke-gst-reuse
router.patch('/master-admin/organizations/:id/revoke-gst-reuse', ...masterOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { reason, confirm, documentNote } = req.body || {};
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Reason is required for this action.' });
  }
  if (confirm !== true) {
    return res.status(400).json({ error: 'CONFIRMATION_REQUIRED', message: 'Confirmation is required for this action.' });
  }

  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) {
    return res.status(404).json({ error: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      gstReuseAllowed: false,
      gstReuseAllowedBy: null,
      gstReuseAllowedAt: null,
      gstReuseReason: null
    },
    select: organizationSelect as any
  });

  await createAuditLog(req, {
    action: 'ORGANIZATION_GST_REUSE_REVOKED',
    entityType: 'organization',
    entityId: id,
    metadata: {
      reason,
      documentNote,
      oldValue: { gstReuseAllowed: organization.gstReuseAllowed },
      newValue: { gstReuseAllowed: false }
    }
  });

  return res.json({ success: true, organization: updated, message: 'GST reuse revoked successfully.' });
}));

// ── GET /master-admin/organizations/:id/documents ──────────────────────────
router.get('/master-admin/organizations/:id/documents', ...masterOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return jsonError(res, 400, 'Invalid organization ID.', 'VALIDATION_ERROR');

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, mobile: true, role: true } },
      sellerProfiles: {
        include: {
          sellerDocuments: { include: { fileAsset: true } },
          certifications: { include: { fileAsset: true } }
        }
      }
    }
  });

  if (!organization) return jsonError(res, 404, 'Organization not found.', 'NOT_FOUND');

  const userIds = (organization.users || []).map(u => u.id);

  // Fetch all FileAsset records linked to organization or any of its users
  const fileAssets = await (prisma as any).fileAsset.findMany({
    where: {
      OR: [
        { entityType: 'organization', entityId: id },
        ...(userIds.length > 0 ? [
          { ownerId: { in: userIds } }
        ] : [])
      ],
      status: 'active'
    },
    orderBy: { createdAt: 'desc' }
  });

  const sellerDocs = (organization.sellerProfiles || []).flatMap(sp => sp.sellerDocuments || []);
  const sellerCerts = (organization.sellerProfiles || []).flatMap(sp => sp.certifications || []);

  const documentsMap = new Map<string, any>();

  const addDoc = (doc: {
    id: number | string;
    source: string;
    documentType: string;
    verificationStatus?: string;
    remarks?: string;
    uploadedAt?: Date | string;
    fileAssetId?: number | null;
    originalName: string;
    url: string;
    mimeType?: string;
    size?: number;
    isUserUploaded?: boolean;
  }) => {
    const key = doc.fileAssetId ? `asset_${doc.fileAssetId}` : `${doc.source}_${doc.id}`;
    if (!documentsMap.has(key)) {
      documentsMap.set(key, doc);
    }
  };

  const CORE_ONBOARDING_TYPES = new Set(['PAN_COPY', 'PAN', 'GST_CERTIFICATE', 'GST', 'UDYAM_CERTIFICATE', 'UDYAM', 'BANK_PASSBOOK', 'CHEQUE', 'ADDRESS_PROOF', 'INCORPORATION_CERTIFICATE', 'DIPP_CERTIFICATE', 'NSIC_CERTIFICATE']);

  // Add SellerDocuments first for precise documentType labels (PAN, GST, Udyam, etc.)
  for (const sd of sellerDocs) {
    if (sd.fileAssetId) {
      const typeUpper = (sd.documentType || '').toUpperCase().replace(/[\s-]+/g, '_');
      const isCoreOnboardingDoc = CORE_ONBOARDING_TYPES.has(typeUpper) || Array.from(CORE_ONBOARDING_TYPES).some(t => typeUpper.includes(t));
      const isAdminExtraUpload = String(sd.remarks || '').toLowerCase().includes('uploaded by master admin') && !isCoreOnboardingDoc;
      addDoc({
        id: sd.id,
        source: 'sellerDocument',
        documentType: sd.documentType || 'Seller Document',
        verificationStatus: sd.verificationStatus || 'VERIFIED',
        remarks: sd.remarks || undefined,
        uploadedAt: sd.uploadedAt || (sd as any).createdAt,
        fileAssetId: sd.fileAssetId,
        originalName: sd.fileAsset?.originalName || sd.documentType || 'Document',
        url: `/api/files/${sd.fileAssetId}/view`,
        mimeType: sd.fileAsset?.mimeType,
        size: sd.fileAsset?.size,
        isUserUploaded: !isAdminExtraUpload
      });
    }
  }

  // Add Certifications
  for (const cert of sellerCerts) {
    const c = cert as any;
    if (c.fileAssetId) {
      addDoc({
        id: c.id,
        source: 'certification',
        documentType: c.certificateType || c.category || 'Certificate',
        verificationStatus: c.verificationStatus || 'VERIFIED',
        remarks: c.remarks || undefined,
        uploadedAt: c.issuedAt || c.issueDate || c.createdAt,
        fileAssetId: c.fileAssetId,
        originalName: c.fileAsset?.originalName || c.certificateName || c.certificateNumber || 'Certificate File',
        url: `/api/files/${c.fileAssetId}/view`,
        mimeType: c.fileAsset?.mimeType,
        size: c.fileAsset?.size,
        isUserUploaded: true
      });
    }
  }

  // Add FileAssets (onboarding, PAN, GST, passbook, udyam, certificates, etc.)
  for (const asset of fileAssets) {
    const nameUpper = (asset.originalName || '').toUpperCase();
    let docType = 'SUPPORTING_DOCUMENT';

    if (nameUpper.includes('PAN')) docType = 'PAN_COPY';
    else if (nameUpper.includes('GST')) docType = 'GST_CERTIFICATE';
    else if (nameUpper.includes('UDYAM')) docType = 'UDYAM_CERTIFICATE';
    else if (nameUpper.includes('PASSBOOK') || nameUpper.includes('CHEQUE') || nameUpper.includes('BANK') || nameUpper.includes('STATEMENT') || nameUpper.includes('SBI')) docType = 'BANK_PASSBOOK';
    else if (nameUpper.includes('ADHAR') || nameUpper.includes('AADHAAR') || nameUpper.includes('ADDRESS')) docType = 'ADDRESS_PROOF';
    else if (nameUpper.includes('ITR') || nameUpper.includes('FINANCIAL') || nameUpper.includes('TAX') || nameUpper.includes('AUDIT') || nameUpper.includes('TURNOVER')) docType = 'FINANCIAL_AUDIT';
    else if (nameUpper.includes('INCORPORATION')) docType = 'INCORPORATION_CERTIFICATE';
    else if (nameUpper.includes('NSIC')) docType = 'NSIC_CERTIFICATE';
    else if (nameUpper.includes('DIPP') || nameUpper.includes('STARTUP')) docType = 'DIPP_CERTIFICATE';
    else docType = (asset.entityType || 'DOCUMENT').toUpperCase().replace(/[\s-]+/g, '_');

    const isCoreDoc = CORE_ONBOARDING_TYPES.has(docType);
    const isUserOwner = userIds.includes(asset.ownerId);

    addDoc({
      id: asset.id,
      source: 'fileAsset',
      documentType: docType,
      verificationStatus: 'VERIFIED',
      remarks: asset.entityType ? `Uploaded asset (${asset.entityType})` : 'Uploaded Document',
      uploadedAt: asset.createdAt,
      fileAssetId: asset.id,
      originalName: asset.originalName || 'Document File',
      url: `/api/files/${asset.id}/view`,
      mimeType: asset.mimeType,
      size: asset.size,
      isUserUploaded: isCoreDoc || isUserOwner
    });
  }




  const documents = Array.from(documentsMap.values());


  jsonOk(res, { documents, organizationId: id, organizationName: organization.organizationName });
}));


const mapDocTypeToJsonKey = (typeStr: string) => {
  const u = (typeStr || '').toUpperCase();
  if (u.includes('PAN')) return 'pan';
  if (u.includes('GST')) return 'gstCert';
  if (u.includes('UDYAM') || u.includes('MSME')) return 'udyamCert';
  if (u.includes('PASSBOOK') || u.includes('CHEQUE') || u.includes('BANK')) return 'bankPassbook';
  if (u.includes('INCORPORATION')) return 'regCert';
  if (u.includes('ADDRESS')) return 'addressProof';
  if (u.includes('AUTH') || u.includes('LETTER')) return 'authLetter';
  return 'uploaded_files';
};

// ── POST /master-admin/organizations/:id/documents/upload ──────────────────
router.post('/master-admin/organizations/:id/documents/upload', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), upload.single('file'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return jsonError(res, 400, 'Invalid organization ID.', 'VALIDATION_ERROR');

  if (!req.file) {
    return jsonError(res, 400, 'File is required.', 'VALIDATION_ERROR');
  }

  const reason = ensureReason(res, req.body, 'upload organization document');
  if (!reason) return;

  const documentType = textOrNull(req.body?.documentType) || 'OTHER';
  const replaceDocId = Number(req.body?.replaceDocId);
  const replaceFileAssetId = Number(req.body?.replaceFileAssetId);
  const remarks = textOrNull(req.body?.remarks) || `Uploaded by Master Admin: ${reason}`;
  const verificationStatus = textOrNull(req.body?.verificationStatus) || 'VERIFIED';

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: { sellerProfiles: true }
  });

  if (!organization) return jsonError(res, 404, 'Organization not found.', 'NOT_FOUND');

  const fileAsset = await uploadFile(req.file, {
    ownerId: req.user!.id,
    ownerRole: req.user!.role,
    entityType: 'organization',
    entityId: id,
    ipAddress: req.ip
  });

  let sellerDoc = null;
  const sellerProfile = organization.sellerProfiles?.[0];
  if (sellerProfile) {
    // Robustly find the existing seller document to replace in-place
    const orConditions: any[] = [];
    if (replaceDocId && replaceDocId > 0) orConditions.push({ id: replaceDocId });
    if (replaceFileAssetId && replaceFileAssetId > 0) orConditions.push({ fileAssetId: replaceFileAssetId });
    if (documentType) {
      orConditions.push({ documentType });
      orConditions.push({ documentType: { contains: documentType, mode: 'insensitive' } });
      const u = documentType.toUpperCase();
      if (u.includes('PAN')) orConditions.push({ documentType: { contains: 'PAN', mode: 'insensitive' } });
      if (u.includes('GST')) orConditions.push({ documentType: { contains: 'GST', mode: 'insensitive' } });
      if (u.includes('UDYAM') || u.includes('MSME')) orConditions.push({ documentType: { contains: 'UDYAM', mode: 'insensitive' } });
      if (u.includes('BANK') || u.includes('PASSBOOK') || u.includes('CHEQUE')) orConditions.push({ documentType: { contains: 'BANK', mode: 'insensitive' } });
      if (u.includes('ADDRESS')) orConditions.push({ documentType: { contains: 'ADDRESS', mode: 'insensitive' } });
    }

    const existingSellerDoc = await (prisma as any).sellerDocument.findFirst({
      where: {
        sellerProfileId: sellerProfile.id,
        OR: orConditions
      }
    });

    if (existingSellerDoc) {
      sellerDoc = await (prisma as any).sellerDocument.update({
        where: { id: existingSellerDoc.id },
        data: {
          fileAssetId: fileAsset.id,
          verificationStatus: verificationStatus as any,
          remarks,
          verifiedById: req.user!.id,
          verifiedAt: new Date(),
          uploadedAt: new Date()
        },
        include: { fileAsset: true }
      });
    } else {
      sellerDoc = await (prisma as any).sellerDocument.create({
        data: {
          sellerProfileId: sellerProfile.id,
          documentType,
          fileAssetId: fileAsset.id,
          verificationStatus: verificationStatus as any,
          remarks,
          verifiedById: req.user!.id,
          verifiedAt: new Date()
        },
        include: { fileAsset: true }
      });
    }

    // Sync SellerProfile.documents JSON so Admin Onboarding Review dialog sees the update immediately
    const jsonKey = mapDocTypeToJsonKey(sellerDoc.documentType || documentType);
    const currentDocs = typeof sellerProfile.documents === 'object' && sellerProfile.documents ? { ...(sellerProfile.documents as any) } : {};
    currentDocs[jsonKey] = {
      fileId: fileAsset.id,
      url: `/api/files/${fileAsset.id}/view`,
      originalName: fileAsset.originalName,
      mimeType: fileAsset.mimeType,
      uploadedAt: fileAsset.createdAt
    };

    await (prisma as any).sellerProfile.update({
      where: { id: sellerProfile.id },
      data: { documents: currentDocs }
    }).catch(() => null);
  }


  await createAuditLog(req, {
    action: 'ORGANIZATION_DOCUMENT_UPLOADED',
    entityType: 'organization',
    entityId: id,
    metadata: {
      reason,
      documentType,
      fileAssetId: fileAsset.id,
      fileName: fileAsset.originalName
    }
  });

  jsonOk(res, {
    success: true,
    fileAsset,
    sellerDocument: sellerDoc,
    message: `Document "${fileAsset.originalName}" uploaded successfully for ${organization.organizationName}.`
  });
}));

// ── DELETE /master-admin/organizations/:id/documents/:docId ────────────────
router.delete('/master-admin/organizations/:id/documents/:docId', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const docId = Number(req.params.docId);
  const reason = ensureReason(res, req.body, 'remove organization document');
  if (!reason) return;

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: { sellerProfiles: true }
  });

  const sellerProfile = organization?.sellerProfiles?.[0];

  const doc = await (prisma as any).sellerDocument.findUnique({ where: { id: docId } });
  if (doc) {
    const isAdminUpload = String(doc.remarks || '').toLowerCase().includes('uploaded by master admin');
    if (!isAdminUpload) {
      return jsonError(res, 400, 'User onboarding documents cannot be deleted. You can only replace them.', 'CANNOT_DELETE_USER_DOCUMENT');
    }
    if (sellerProfile && typeof sellerProfile.documents === 'object' && sellerProfile.documents) {
      const currentDocs = { ...(sellerProfile.documents as any) };
      const jsonKey = mapDocTypeToJsonKey(doc.documentType);
      delete currentDocs[jsonKey];
      await (prisma as any).sellerProfile.update({
        where: { id: sellerProfile.id },
        data: { documents: currentDocs }
      }).catch(() => null);
    }
    await (prisma as any).sellerDocument.delete({ where: { id: docId } });
  } else {
    const asset = await (prisma as any).fileAsset.findUnique({ where: { id: docId } });
    if (asset) {
      const isAdminAsset = asset.ownerRole === 'master_admin' || String(asset.entityType).toLowerCase() === 'organization';
      if (!isAdminAsset) {
        return jsonError(res, 400, 'User onboarding documents cannot be deleted. You can only replace them.', 'CANNOT_DELETE_USER_DOCUMENT');
      }
      await (prisma as any).fileAsset.update({ where: { id: docId }, data: { status: 'deleted' } });

      if (sellerProfile && typeof sellerProfile.documents === 'object' && sellerProfile.documents) {
        const currentDocs = { ...(sellerProfile.documents as any) };
        Object.keys(currentDocs).forEach(key => {
          const item = currentDocs[key];
          const itemFileId = Number(item?.fileId || item?.fileAssetId);
          if (itemFileId === docId || String(item?.url).includes(`/files/${docId}/`)) {
            delete currentDocs[key];
          }
        });
        await (prisma as any).sellerProfile.update({
          where: { id: sellerProfile.id },
          data: { documents: currentDocs }
        }).catch(() => null);
      }
    }
  }

  await createAuditLog(req, {
    action: 'ORGANIZATION_DOCUMENT_REMOVED',
    entityType: 'organization',
    entityId: id,
    metadata: { reason, docId }
  });

  jsonOk(res, { success: true }, 'Organization document removed successfully.');
}));


router.delete('/master-admin/organizations/:id', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'archive organization');
  if (!reason) return;
  const organization = await prisma.organization.update({
    where: { id },
    data: { verificationStatus: 'SUSPENDED' as any, isBlacklisted: true, blacklistReason: reason },
    select: organizationSelect as any
  });
  await createAuditLog(req, { action: 'organization.archive', entityType: 'organization', entityId: id, metadata: { reason, requestedVia: 'DELETE' } });
  jsonOk(res, organization, 'Organization archived successfully. Historical records were preserved.');
}));

// ── Cascade-delete an organization and ALL related data ──────────────────────
router.delete('/master-admin/organizations/:id/cascade', ...masterOnly, requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'permanently delete organization');
  if (!reason) return;
  const confirmPhrase = textOrNull(req.body?.confirmPhrase);
  if (confirmPhrase !== 'DELETE PERMANENTLY') {
    return jsonError(res, 400, 'You must type "DELETE PERMANENTLY" to confirm this destructive action.', 'CONFIRM_REQUIRED');
  }

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      organizationName: true,
      users: { select: { id: true, role: true, userId: true } },
      _count: {
        select: {
          users: true,
          products: true,
          services: true,
          tenders: true,
          buyerProfiles: true,
          sellerProfiles: true
        }
      }
    }
  });

  if (!organization) return jsonError(res, 404, 'Organization not found.', 'NOT_FOUND');

  // Block deletion of orgs that contain a master_admin
  const hasMasterAdmin = organization.users.some(u => u.role === 'master_admin' || u.userId === 'MASTER_ADMIN');
  if (hasMasterAdmin) {
    return jsonError(res, 403, 'Cannot delete an organization that contains the Master Admin user.', 'MASTER_ADMIN_LOCKED');
  }

  // Check for active financial records
  const userIds = organization.users.map(u => u.id);
  const activePayments = userIds.length > 0 ? await safeCount((prisma as any).paymentTransaction, {
    where: { OR: [{ payerId: { in: userIds } }, { payeeId: { in: userIds } }], status: { in: ['INITIATED', 'PENDING', 'PROCESSING'] } }
  }) : 0;
  const activeEscrows = userIds.length > 0 ? await safeCount((prisma as any).escrowAccount, {
    where: { OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }], status: { in: ['HELD', 'FUNDED'] } }
  }) : 0;

  if (activePayments > 0 || activeEscrows > 0) {
    return jsonError(res, 409, `Cannot delete: ${activePayments} active payment(s) and ${activeEscrows} active escrow(s) exist. Resolve them first.`, 'ACTIVE_FINANCIALS');
  }

  // Perform cascade deletion in a transaction
  const summary = await prisma.$transaction(async (tx: any) => {
    const counts: Record<string, number> = {};
    let spIdx = 0;

    // ─── Raw SQL helper: wraps in SAVEPOINT, bypasses Prisma middleware ───
    const rawSql = async (label: string, sql: string) => {
      const sp = `csd_${++spIdx}`;
      try {
        await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
        const result = await tx.$executeRawUnsafe(sql);
        counts[label] = (counts[label] || 0) + (typeof result === 'number' ? result : 0);
        await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('Transaction already closed') || msg.includes('expired transaction')) {
          throw err; // Abort immediately — transaction is dead
        }
        req.log?.warn?.({ label, err: msg }, '[CascadeDelete] rawSql failed');
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {});
      }
    };

    // ─── SQL helpers ───
    const U = userIds.join(','); // user IDs list
    const uIn = `IN (${U})`;    // "IN (3,2)"

    // Reusable subqueries
    const procBidSub = `SELECT id FROM "ProcurementBid" WHERE "buyerOrganizationId" = ${id} OR "buyerId" ${uIn}`;
    const procBidClarSub = `SELECT id FROM "ProcurementBidClarification" WHERE "bidId" IN (${procBidSub})`;
    const procBidPartSub = `SELECT id FROM "ProcurementBidParticipation" WHERE "bidId" IN (${procBidSub})`;
    const productSub = `SELECT id FROM "Product" WHERE "organizationId" = ${id}`;
    const serviceSub = `SELECT id FROM "Service" WHERE "organizationId" = ${id}`;
    const cartSub = `SELECT id FROM "Cart" WHERE "organizationId" = ${id}`;
    const grnSub = `SELECT id FROM "GoodsReceiptNote" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "receivedById" ${uIn}` : ''}`;
    const customRoleSub = `SELECT id FROM "OrgCustomRole" WHERE "organizationId" = ${id}`;
    const tenderSub = `SELECT id FROM "Tender" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "buyerId" ${uIn}` : ''}`;
    const bidSub = `SELECT id FROM "Bid" WHERE "tenderId" IN (${tenderSub})${userIds.length > 0 ? ` OR "sellerId" ${uIn}` : ''}`;
    const poSub = `SELECT id FROM "PurchaseOrder" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`;
    const deliverySub = `SELECT id FROM "DeliveryTracking" WHERE "purchaseOrderId" IN (${poSub})`;
    const invoiceSub = `SELECT id FROM "Invoice" WHERE "purchaseOrderId" IN (${poSub})`;
    const poPaymentSub = `SELECT id FROM "PaymentTransaction" WHERE "purchaseOrderId" IN (${poSub})`;
    const poEscrowSub = `SELECT id FROM "EscrowAccount" WHERE "paymentTransactionId" IN (${poPaymentSub})`;
    const poMilestoneSub = `SELECT id FROM "Milestone" WHERE "escrowAccountId" IN (${poEscrowSub})`;
    const poItemSub = `SELECT id FROM "PurchaseOrderItem" WHERE "purchaseOrderId" IN (${poSub})`;
    const userPaymentSub = `SELECT id FROM "PaymentTransaction" WHERE "payerId" ${uIn} OR "payeeId" ${uIn}`;
    const uEscrowSub = `SELECT id FROM "EscrowAccount" WHERE "paymentTransactionId" IN (${userPaymentSub})`;
    const uMilestoneSub = `SELECT id FROM "Milestone" WHERE "escrowAccountId" IN (${uEscrowSub})`;
    const disputeSub = `SELECT id FROM "Dispute" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn} OR "raisedById" ${uIn} OR "buyerOrgId" = ${id} OR "sellerOrgId" = ${id} OR "raisedByOrgId" = ${id} OR "againstOrgId" = ${id}`;
    const convSub = `SELECT id FROM "Conversation" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`;
    const msgSub = `SELECT id FROM "Message" WHERE "conversationId" IN (${convSub})`;
    const grievanceSub = `SELECT id FROM "GrievanceTicket" WHERE "userId" ${uIn} OR "assignedAdminId" ${uIn}`;
    const auctionSub = `SELECT id FROM "Auction" WHERE "currentWinnerId" ${uIn} OR "winnerSellerId" ${uIn} OR "createdByUserId" ${uIn} OR "buyerOrgId" = ${id}`;
    const catBatchSub = `SELECT id FROM "CatalogueImportBatch" WHERE "sellerId" ${uIn}`;
    const sellerProfileSub = `SELECT id FROM "SellerProfile" WHERE "userId" ${uIn}`;

    // ─── Pre-resolve deeply nested relation IDs to avoid 3-5 level subquery nesting ───
    const sqlIn = (ids: number[]) => ids.length > 0 ? `IN (${ids.join(',')})` : 'IN (NULL)';
    const resolveIds = async (sql: string): Promise<number[]> => {
      try {
        const rows: any[] = await tx.$queryRawUnsafe(sql);
        return rows.map((r: any) => r.id);
      } catch { return []; }
    };

    // PO chain (was 4-level deep nesting: PO → PaymentTx → EscrowAccount → Milestone)
    const poIds = userIds.length > 0
      ? await resolveIds(`SELECT id FROM "PurchaseOrder" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`)
      : [];
    const deliveryIds = poIds.length > 0
      ? await resolveIds(`SELECT id FROM "DeliveryTracking" WHERE "purchaseOrderId" ${sqlIn(poIds)}`)
      : [];
    const invoiceIds = poIds.length > 0
      ? await resolveIds(`SELECT id FROM "Invoice" WHERE "purchaseOrderId" ${sqlIn(poIds)}`)
      : [];
    const poPaymentIds = poIds.length > 0
      ? await resolveIds(`SELECT id FROM "PaymentTransaction" WHERE "purchaseOrderId" ${sqlIn(poIds)}`)
      : [];
    const poEscrowIds = poPaymentIds.length > 0
      ? await resolveIds(`SELECT id FROM "EscrowAccount" WHERE "paymentTransactionId" ${sqlIn(poPaymentIds)}`)
      : [];
    const poMilestoneIds = poEscrowIds.length > 0
      ? await resolveIds(`SELECT id FROM "Milestone" WHERE "escrowAccountId" ${sqlIn(poEscrowIds)}`)
      : [];
    const poItemIds = poIds.length > 0
      ? await resolveIds(`SELECT id FROM "PurchaseOrderItem" WHERE "purchaseOrderId" ${sqlIn(poIds)}`)
      : [];

    // User payment chain (was 3-level deep nesting: PaymentTx → EscrowAccount → Milestone)
    const userPaymentIds = userIds.length > 0
      ? await resolveIds(`SELECT id FROM "PaymentTransaction" WHERE "payerId" ${uIn} OR "payeeId" ${uIn}`)
      : [];
    const uEscrowIds = userPaymentIds.length > 0
      ? await resolveIds(`SELECT id FROM "EscrowAccount" WHERE "paymentTransactionId" ${sqlIn(userPaymentIds)}`)
      : [];
    const uMilestoneIds = uEscrowIds.length > 0
      ? await resolveIds(`SELECT id FROM "Milestone" WHERE "escrowAccountId" ${sqlIn(uEscrowIds)}`)
      : [];

    // ═══════════════════════════════════════════════════════════
    // 1. KYC
    // ═══════════════════════════════════════════════════════════
    await rawSql('KycAuditLog', `DELETE FROM "KycAuditLog" WHERE "organizationId" = ${id}`);
    await rawSql('KycAuthSession', `DELETE FROM "KycAuthSession" WHERE "organizationId" = ${id}`);
    await rawSql('UserKycVerification', `DELETE FROM "UserKycVerification" WHERE "organizationId" = ${id}`);

    // ═══════════════════════════════════════════════════════════
    // 2. Marketplace interactions
    // ═══════════════════════════════════════════════════════════
    await rawSql('MarketplaceInteraction', `DELETE FROM "MarketplaceInteraction" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "userId" ${uIn}` : ''}`);

    // ═══════════════════════════════════════════════════════════
    // 3. Procurement (subquery-based — no intermediate findMany)
    // ═══════════════════════════════════════════════════════════
    if (userIds.length > 0) {
      await rawSql('ProcurementBidClarificationFile', `DELETE FROM "ProcurementBidClarificationFile" WHERE "clarificationId" IN (${procBidClarSub}) OR "uploadedById" ${uIn}`);
      await rawSql('ProcurementBidClarification', `DELETE FROM "ProcurementBidClarification" WHERE "bidId" IN (${procBidSub}) OR "requestedById" ${uIn} OR "respondedById" ${uIn} OR "sellerId" ${uIn} OR "buyerId" ${uIn}`);
      await rawSql('ProcurementBidParticipationDocument', `DELETE FROM "ProcurementBidParticipationDocument" WHERE "participationId" IN (${procBidPartSub}) OR "sellerId" ${uIn}`);
      await rawSql('ProcurementBidEvaluation', `DELETE FROM "ProcurementBidEvaluation" WHERE "bidId" IN (${procBidSub}) OR "evaluatorId" ${uIn}`);
      await rawSql('ProcurementBidAward', `DELETE FROM "ProcurementBidAward" WHERE "bidId" IN (${procBidSub}) OR "sellerId" ${uIn} OR "awardedById" ${uIn}`);
      await rawSql('ProcurementBidParticipation', `DELETE FROM "ProcurementBidParticipation" WHERE "bidId" IN (${procBidSub}) OR "sellerId" ${uIn}`);
      await rawSql('ProcurementBidDocument', `DELETE FROM "ProcurementBidDocument" WHERE "bidId" IN (${procBidSub}) OR "uploadedById" ${uIn}`);
      await rawSql('ProcurementAuditLog', `DELETE FROM "ProcurementAuditLog" WHERE "userId" ${uIn}`);
      await rawSql('ComparativeStatement', `DELETE FROM "ComparativeStatement" WHERE "bidId" IN (${procBidSub})`);
      await rawSql('L1Comparison', `DELETE FROM "L1Comparison" WHERE "organizationId" = ${id}`);
      // Nullify approvedById on bids (nullable)
      await rawSql('ProcurementBid_nullify', `UPDATE "ProcurementBid" SET "approvedById" = NULL WHERE "approvedById" ${uIn}`);
      await rawSql('ProcurementBidInvitation', `DELETE FROM "ProcurementBidInvitation" WHERE "sellerUserId" ${uIn}`);
      await rawSql('ProcurementBid', `DELETE FROM "ProcurementBid" WHERE "buyerOrganizationId" = ${id} OR "buyerId" ${uIn}`);
      await rawSql('ProcurementApproval', `DELETE FROM "ProcurementApproval" WHERE "organizationId" = ${id} OR "approverId" ${uIn}`);
      await rawSql('ProcurementRequest', `DELETE FROM "ProcurementRequest" WHERE "organizationId" = ${id} OR "buyerId" ${uIn}`);
      await rawSql('ProcurementModeSetting', `DELETE FROM "ProcurementModeSetting" WHERE "organizationId" = ${id}`);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. Products/Services and their children (subquery-based)
    // ═══════════════════════════════════════════════════════════
    await rawSql('CartItem_prod', `DELETE FROM "CartItem" WHERE "productId" IN (${productSub}) OR "serviceId" IN (${serviceSub})`);
    await rawSql('GuestCartItem_prod', `DELETE FROM "GuestCartItem" WHERE "productId" IN (${productSub}) OR "serviceId" IN (${serviceSub})`);
    await rawSql('ProductImage', `DELETE FROM "ProductImage" WHERE "productId" IN (${productSub})`);
    await rawSql('ProductSpecification', `DELETE FROM "ProductSpecification" WHERE "productId" IN (${productSub})`);
    await rawSql('ServiceSpecification', `DELETE FROM "ServiceSpecification" WHERE "serviceId" IN (${serviceSub})`);
    await rawSql('Certification', `DELETE FROM "Certification" WHERE "productId" IN (${productSub}) OR "serviceId" IN (${serviceSub})`);

    // 5. Marketplace products/services/requirements
    await rawSql('Product', `DELETE FROM "Product" WHERE "organizationId" = ${id}`);
    await rawSql('Service', `DELETE FROM "Service" WHERE "organizationId" = ${id}`);
    await rawSql('Requirement', `DELETE FROM "Requirement" WHERE "organizationId" = ${id}`);
    await rawSql('Category', `DELETE FROM "Category" WHERE "organizationId" = ${id}`);

    // 6. Buyer/seller data
    await rawSql('BuyerRequirement', `DELETE FROM "BuyerRequirement" WHERE "buyerOrganizationId" = ${id}${userIds.length > 0 ? ` OR "createdById" ${uIn} OR "approvedById" ${uIn}` : ''}`);
    await rawSql('RequirementResponse', `DELETE FROM "RequirementResponse" WHERE "sellerOrganizationId" = ${id}${userIds.length > 0 ? ` OR "sellerUserId" ${uIn}` : ''}`);

    // ═══════════════════════════════════════════════════════════
    // 7. Carts (subquery-based)
    // ═══════════════════════════════════════════════════════════
    await rawSql('CartItem_cart', `DELETE FROM "CartItem" WHERE "cartId" IN (${cartSub})${userIds.length > 0 ? ` OR "sellerId" ${uIn}` : ''}`);
    if (userIds.length > 0) {
      await rawSql('Cart_nullify_approved', `UPDATE "Cart" SET "approvedById" = NULL WHERE "approvedById" ${uIn}`);
      await rawSql('Cart_nullify_rejected', `UPDATE "Cart" SET "rejectedById" = NULL WHERE "rejectedById" ${uIn}`);
      await rawSql('CartItem_nullify', `UPDATE "CartItem" SET "technicalApprovedById" = NULL WHERE "technicalApprovedById" ${uIn}`);
      await rawSql('Cart_user', `DELETE FROM "Cart" WHERE "createdById" ${uIn}`);
    }
    await rawSql('Cart_org', `DELETE FROM "Cart" WHERE "organizationId" = ${id}`);
    await rawSql('GuestCartItem_org', `DELETE FROM "GuestCartItem" WHERE "sellerOrganizationId" = ${id}`);

    // ═══════════════════════════════════════════════════════════
    // 8. GRNs (subquery-based)
    // ═══════════════════════════════════════════════════════════
    if (userIds.length > 0) {
      await rawSql('GRN_nullify_approved', `UPDATE "GoodsReceiptNote" SET "approvedById" = NULL WHERE "approvedById" ${uIn}`);
      await rawSql('GRN_nullify_rejected', `UPDATE "GoodsReceiptNote" SET "rejectedById" = NULL WHERE "rejectedById" ${uIn}`);
    }
    await rawSql('GrnItem', `DELETE FROM "GrnItem" WHERE "grnId" IN (${grnSub})`);
    await rawSql('GrnDocument', `DELETE FROM "GrnDocument" WHERE "grnId" IN (${grnSub})${userIds.length > 0 ? ` OR "uploadedById" ${uIn}` : ''}`);
    await rawSql('GoodsReceiptNote', `DELETE FROM "GoodsReceiptNote" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "receivedById" ${uIn}` : ''}`);

    // ═══════════════════════════════════════════════════════════
    // 9. Disputes
    // ═══════════════════════════════════════════════════════════
    await rawSql('DisputeMessage', `DELETE FROM "DisputeMessage" WHERE "senderOrgId" = ${id}${userIds.length > 0 ? ` OR "senderId" ${uIn}` : ''}`);

    // 10. Fraud alerts
    await rawSql('FraudAlert', `DELETE FROM "FraudAlert" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "userId" ${uIn} OR "reviewedById" ${uIn}` : ''}`);

    // ═══════════════════════════════════════════════════════════
    // 11. Org memberships, invitations, custom roles
    // ═══════════════════════════════════════════════════════════
    await rawSql('OrgRolePermission', `DELETE FROM "OrgRolePermission" WHERE "roleId" IN (${customRoleSub})`);
    if (userIds.length > 0) {
      await rawSql('OrgMembership_nullify_transferred', `UPDATE "OrgMembership" SET "accessTransferredFromUserId" = NULL WHERE "accessTransferredFromUserId" ${uIn}`);
      await rawSql('OrgMembership_nullify_deactivated', `UPDATE "OrgMembership" SET "deactivatedByUserId" = NULL WHERE "deactivatedByUserId" ${uIn}`);
      await rawSql('OrgMembership_nullify_invited', `UPDATE "OrgMembership" SET "invitedById" = NULL WHERE "invitedById" ${uIn}`);
      await rawSql('OrgInvitation_user', `DELETE FROM "OrgInvitation" WHERE "invitedById" ${uIn}`);
      await rawSql('OrgCustomRole_user', `DELETE FROM "OrgCustomRole" WHERE "createdByUserId" ${uIn}`);
    }
    await rawSql('OrgMembership', `DELETE FROM "OrgMembership" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "userId" ${uIn}` : ''}`);
    await rawSql('OrgInvitation', `DELETE FROM "OrgInvitation" WHERE "organizationId" = ${id}`);
    await rawSql('OrgCustomRole', `DELETE FROM "OrgCustomRole" WHERE "organizationId" = ${id}`);
    await rawSql('AccessTransferLog', `DELETE FROM "AccessTransferLog" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "fromUserId" ${uIn} OR "toUserId" ${uIn} OR "performedByUserId" ${uIn}` : ''}`);

    // 12. Addresses
    await rawSql('DeliveryAddress', `DELETE FROM "DeliveryAddress" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "buyerId" ${uIn}` : ''}`);
    await rawSql('AddressGroup', `DELETE FROM "AddressGroup" WHERE "organizationId" = ${id}${userIds.length > 0 ? ` OR "buyerId" ${uIn}` : ''}`);

    // 13. Organization profile
    await rawSql('OrganizationProfile', `DELETE FROM "OrganizationProfile" WHERE "organizationId" = ${id}`);

    // ═══════════════════════════════════════════════════════════
    // 14. User-level cleanup (subquery-based chains)
    // ═══════════════════════════════════════════════════════════
    if (userIds.length > 0) {
      // --- Quotes / Direct Purchase ---
      await rawSql('QuoteRequestClarification', `DELETE FROM "QuoteRequestClarification" WHERE "askedById" ${uIn} OR "answeredById" ${uIn}`);
      await rawSql('QuoteResponse', `DELETE FROM "QuoteResponse" WHERE "sellerId" ${uIn}`);
      await rawSql('QuoteRequest', `DELETE FROM "QuoteRequest" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
      await rawSql('RequirementClarification', `DELETE FROM "RequirementClarification" WHERE "askedById" ${uIn} OR "answeredById" ${uIn}`);
      await rawSql('DirectPurchase', `DELETE FROM "DirectPurchase" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);

      // --- Tender / Bid chain (subquery-based) ---
      await rawSql('BidItem', `DELETE FROM "BidItem" WHERE "bidId" IN (${bidSub})`);
      await rawSql('TechnicalEvaluationResult', `DELETE FROM "TechnicalEvaluationResult" WHERE "tenderId" IN (${tenderSub}) OR "evaluatorId" ${uIn}`);
      await rawSql('TechnicalEvaluationCriteria', `DELETE FROM "TechnicalEvaluationCriteria" WHERE "tenderId" IN (${tenderSub})`);
      await rawSql('FinancialEvaluation', `DELETE FROM "FinancialEvaluation" WHERE "tenderId" IN (${tenderSub}) OR "evaluatorId" ${uIn}`);
      await rawSql('TenderDocument', `DELETE FROM "TenderDocument" WHERE "tenderId" IN (${tenderSub})`);
      await rawSql('TenderItem', `DELETE FROM "TenderItem" WHERE "tenderId" IN (${tenderSub})`);
      await rawSql('TenderParticipant', `DELETE FROM "TenderParticipant" WHERE "tenderId" IN (${tenderSub})`);

      // ─── PurchaseOrder chain (pre-resolved IDs — was 4-level deep nesting) ───
      // Delivery tracking children
      if (deliveryIds.length > 0) {
        await rawSql('DeliveryTrackingEvent', `DELETE FROM "DeliveryTrackingEvent" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
        await rawSql('DeliveryStatusLog', `DELETE FROM "DeliveryStatusLog" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
        await rawSql('DeliveryDocument', `DELETE FROM "DeliveryDocument" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
        await rawSql('DeliveryParticipant', `DELETE FROM "DeliveryParticipant" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
        await rawSql('BuyerAcceptance_delivery', `DELETE FROM "BuyerAcceptance" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
        // Nullify settlement user FKs then delete
        await rawSql('PaymentSettlement_nullify_d', `UPDATE "PaymentSettlement" SET "invoiceVerifiedById" = NULL, "approvedById" = NULL, "releasedById" = NULL, "rejectedById" = NULL WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
        await rawSql('PaymentSettlement_delivery', `DELETE FROM "PaymentSettlement" WHERE "deliveryTrackingId" ${sqlIn(deliveryIds)}`);
      }
      if (poIds.length > 0) {
        await rawSql('DeliveryTracking', `DELETE FROM "DeliveryTracking" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
        await rawSql('DeliveryWorkflow', `DELETE FROM "DeliveryWorkflow" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
      }

      // Invoice children
      if (invoiceIds.length > 0) {
        await rawSql('MilestonePayment_inv', `DELETE FROM "MilestonePayment" WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
        await rawSql('InvoiceItem', `DELETE FROM "InvoiceItem" WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
        await rawSql('InvoiceFactoring_inv', `DELETE FROM "InvoiceFactoring" WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
        await rawSql('PaymentSettlement_nullify_i', `UPDATE "PaymentSettlement" SET "invoiceVerifiedById" = NULL, "approvedById" = NULL, "releasedById" = NULL, "rejectedById" = NULL WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
        await rawSql('PaymentSettlement_inv', `DELETE FROM "PaymentSettlement" WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
        // Nullify PaymentTransaction.invoiceId before deleting invoices
        await rawSql('PaymentTransaction_nullify_inv', `UPDATE "PaymentTransaction" SET "invoiceId" = NULL WHERE "invoiceId" ${sqlIn(invoiceIds)}`);
      }
      if (poIds.length > 0) await rawSql('Invoice', `DELETE FROM "Invoice" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);

      // Inspection
      if (poIds.length > 0) {
        await rawSql('InspectionReport', `DELETE FROM "InspectionReport" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
        await rawSql('InspectionRecord', `DELETE FROM "InspectionRecord" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
        await rawSql('ProvisionalReceiptCertificate_po', `DELETE FROM "ProvisionalReceiptCertificate" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
        await rawSql('ConsigneeReceiptAcceptanceCertificate_po', `DELETE FROM "ConsigneeReceiptAcceptanceCertificate" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
      }

      // Payment transactions & escrow (PO-linked) — pre-resolved milestone/escrow IDs
      if (poMilestoneIds.length > 0) {
        await rawSql('MilestoneApproval_po', `DELETE FROM "MilestoneApproval" WHERE "milestoneId" ${sqlIn(poMilestoneIds)}`);
        await rawSql('MilestonePayment_po', `DELETE FROM "MilestonePayment" WHERE "milestoneId" ${sqlIn(poMilestoneIds)}`);
        await rawSql('EscrowTransaction_ms_po', `DELETE FROM "EscrowTransaction" WHERE "milestoneId" ${sqlIn(poMilestoneIds)}`);
      }
      if (poEscrowIds.length > 0) {
        await rawSql('Milestone_po', `DELETE FROM "Milestone" WHERE "escrowAccountId" ${sqlIn(poEscrowIds)}`);
        await rawSql('EscrowTransaction_esc_po', `DELETE FROM "EscrowTransaction" WHERE "escrowAccountId" ${sqlIn(poEscrowIds)}`);
      }
      if (poPaymentIds.length > 0) {
        await rawSql('EscrowAccount_po', `DELETE FROM "EscrowAccount" WHERE "paymentTransactionId" ${sqlIn(poPaymentIds)}`);
        await rawSql('FinancialLedgerEntry_po', `DELETE FROM "FinancialLedgerEntry" WHERE "transactionId" ${sqlIn(poPaymentIds)}`);
        await rawSql('OfflinePaymentProof_po', `DELETE FROM "OfflinePaymentProof" WHERE "paymentTransactionId" ${sqlIn(poPaymentIds)}`);
        await rawSql('PaymentSettlement_po', `DELETE FROM "PaymentSettlement" WHERE "paymentTransactionId" ${sqlIn(poPaymentIds)}`);
      }
      if (poIds.length > 0) await rawSql('PaymentTransaction_po', `DELETE FROM "PaymentTransaction" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);

      // PO items — nullify InvoiceItem FK, delete GrnItem, then PO items
      if (poItemIds.length > 0) {
        await rawSql('InvoiceItem_nullify_poi', `UPDATE "InvoiceItem" SET "purchaseOrderItemId" = NULL WHERE "purchaseOrderItemId" ${sqlIn(poItemIds)}`);
        await rawSql('GrnItem_poi', `DELETE FROM "GrnItem" WHERE "purchaseOrderItemId" ${sqlIn(poItemIds)}`);
      }
      if (poIds.length > 0) {
        await rawSql('PurchaseOrderItem', `DELETE FROM "PurchaseOrderItem" WHERE "purchaseOrderId" ${sqlIn(poIds)}`);
        await rawSql('PurchaseOrder', `DELETE FROM "PurchaseOrder" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
      }

      // ─── Remaining payment transactions (user-linked) — pre-resolved IDs ───
      if (uMilestoneIds.length > 0) {
        await rawSql('MilestoneApproval_u', `DELETE FROM "MilestoneApproval" WHERE "milestoneId" ${sqlIn(uMilestoneIds)}`);
        await rawSql('MilestonePayment_u', `DELETE FROM "MilestonePayment" WHERE "milestoneId" ${sqlIn(uMilestoneIds)}`);
        await rawSql('EscrowTransaction_ms_u', `DELETE FROM "EscrowTransaction" WHERE "milestoneId" ${sqlIn(uMilestoneIds)}`);
      }
      if (uEscrowIds.length > 0) {
        await rawSql('Milestone_u', `DELETE FROM "Milestone" WHERE "escrowAccountId" ${sqlIn(uEscrowIds)}`);
        await rawSql('EscrowTransaction_esc_u', `DELETE FROM "EscrowTransaction" WHERE "escrowAccountId" ${sqlIn(uEscrowIds)}`);
      }
      await rawSql('EscrowAccount_u', `DELETE FROM "EscrowAccount" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
      if (userPaymentIds.length > 0) {
        await rawSql('FinancialLedgerEntry_u', `DELETE FROM "FinancialLedgerEntry" WHERE "transactionId" ${sqlIn(userPaymentIds)}`);
        await rawSql('OfflinePaymentProof_u', `DELETE FROM "OfflinePaymentProof" WHERE "paymentTransactionId" ${sqlIn(userPaymentIds)}`);
        await rawSql('PaymentSettlement_u', `DELETE FROM "PaymentSettlement" WHERE "paymentTransactionId" ${sqlIn(userPaymentIds)}`);
      }
      await rawSql('PaymentTransaction_u', `DELETE FROM "PaymentTransaction" WHERE "payerId" ${uIn} OR "payeeId" ${uIn}`);

      // ─── Disputes (subquery-based) ───
      await rawSql('DisputeAttachment', `DELETE FROM "DisputeAttachment" WHERE "disputeId" IN (${disputeSub}) OR "uploadedByUserId" ${uIn}`);
      await rawSql('DisputeEvidence', `DELETE FROM "DisputeEvidence" WHERE "disputeId" IN (${disputeSub}) OR "uploadedById" ${uIn}`);
      await rawSql('DisputeMessage_d', `DELETE FROM "DisputeMessage" WHERE "disputeId" IN (${disputeSub})`);
      await rawSql('Dispute_nullify_assigned', `UPDATE "Dispute" SET "assignedAdminId" = NULL WHERE "assignedAdminId" ${uIn}`);
      await rawSql('Dispute_nullify_resolved', `UPDATE "Dispute" SET "resolvedById" = NULL WHERE "resolvedById" ${uIn}`);
      await rawSql('Dispute', `DELETE FROM "Dispute" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn} OR "raisedById" ${uIn} OR "buyerOrgId" = ${id} OR "sellerOrgId" = ${id} OR "raisedByOrgId" = ${id} OR "againstOrgId" = ${id}`);

      // ─── Conversations / Messages (subquery-based) ───
      await rawSql('MessageAttachment', `DELETE FROM "MessageAttachment" WHERE "messageId" IN (${msgSub})`);
      await rawSql('Message', `DELETE FROM "Message" WHERE "conversationId" IN (${convSub}) OR "senderId" ${uIn}`);
      await rawSql('Conversation', `DELETE FROM "Conversation" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);

      // ─── Grievances (subquery-based) ───
      await rawSql('GrievanceAttachment', `DELETE FROM "GrievanceAttachment" WHERE "grievanceId" IN (${grievanceSub}) OR "uploadedById" ${uIn}`);
      await rawSql('GrievanceComment', `DELETE FROM "GrievanceComment" WHERE "grievanceId" IN (${grievanceSub}) OR "authorId" ${uIn}`);
      await rawSql('GrievanceTicket', `DELETE FROM "GrievanceTicket" WHERE "userId" ${uIn} OR "assignedAdminId" ${uIn}`);

      // ─── Auction chain (subquery-based) ───
      await rawSql('AuctionEventLog', `DELETE FROM "AuctionEventLog" WHERE "auctionId" IN (${auctionSub})`);
      await rawSql('AuctionQualificationDocument', `DELETE FROM "AuctionQualificationDocument" WHERE "auctionId" IN (${auctionSub})`);
      await rawSql('AuctionParticipant', `DELETE FROM "AuctionParticipant" WHERE "auctionId" IN (${auctionSub})`);
      await rawSql('AuctionBid', `DELETE FROM "AuctionBid" WHERE "auctionId" IN (${auctionSub}) OR "sellerId" ${uIn} OR "sellerOrgId" = ${id}`);
      await rawSql('Auction_nullify_winner', `UPDATE "Auction" SET "currentWinnerId" = NULL WHERE "currentWinnerId" ${uIn}`);
      await rawSql('Auction_nullify_winnerSeller', `UPDATE "Auction" SET "winnerSellerId" = NULL WHERE "winnerSellerId" ${uIn}`);

      // ─── Contracts ───
      await rawSql('Contract', `DELETE FROM "Contract" WHERE "bidId" IN (${bidSub}) OR "tenderId" IN (${tenderSub})`);
      await rawSql('ComparativeStatement_t', `DELETE FROM "ComparativeStatement" WHERE "tenderId" IN (${tenderSub})`);
      await rawSql('Bid', `DELETE FROM "Bid" WHERE "sellerId" ${uIn}`);
      await rawSql('Tender', `DELETE FROM "Tender" WHERE "buyerId" ${uIn} OR "organizationId" = ${id}`);

      // ─── Ratings / Compliance ───
      await rawSql('SupplierRating', `DELETE FROM "SupplierRating" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
      await rawSql('BuyerRating', `DELETE FROM "BuyerRating" WHERE "buyerId" ${uIn} OR "sellerId" ${uIn}`);
      await rawSql('ComplianceViolation', `DELETE FROM "ComplianceViolation" WHERE "userId" ${uIn}`);
      await rawSql('InvoiceFactoring_u', `DELETE FROM "InvoiceFactoring" WHERE "sellerId" ${uIn} OR "financierId" ${uIn}`);

      // ─── Catalogue imports (subquery-based) ───
      await rawSql('CatalogueImportError', `DELETE FROM "CatalogueImportError" WHERE "batchId" IN (${catBatchSub})`);
      await rawSql('CatalogueImportBatch', `DELETE FROM "CatalogueImportBatch" WHERE "sellerId" ${uIn}`);
      await rawSql('BuyerItemUploadBatch', `DELETE FROM "BuyerItemUploadBatch" WHERE "buyerId" ${uIn}`);
      await rawSql('BuyerFrequentlyBoughtItem', `DELETE FROM "BuyerFrequentlyBoughtItem" WHERE "buyerId" ${uIn}`);

      // ─── Misc user data ───
      await rawSql('BidWizardDraft', `DELETE FROM "BidWizardDraft" WHERE "buyerId" ${uIn}`);
      await rawSql('Approval', `DELETE FROM "Approval" WHERE "userId" ${uIn}`);
      await rawSql('PasswordHistory', `DELETE FROM "PasswordHistory" WHERE "userId" ${uIn}`);
      await rawSql('ScopedInvitation', `DELETE FROM "ScopedInvitation" WHERE "invitedById" ${uIn}`);
      await rawSql('BuyerAcceptance', `DELETE FROM "BuyerAcceptance" WHERE "acceptedById" ${uIn}`);

      // ─── User profiles ───
      await rawSql('BuyerProfile', `DELETE FROM "BuyerProfile" WHERE "userId" ${uIn}`);
      await rawSql('SellerDocument', `DELETE FROM "SellerDocument" WHERE "sellerProfileId" IN (${sellerProfileSub})`);
      await rawSql('SellerBankAccount', `DELETE FROM "SellerBankAccount" WHERE "sellerProfileId" IN (${sellerProfileSub})`);
      await rawSql('SellerOffice', `DELETE FROM "SellerOffice" WHERE "sellerProfileId" IN (${sellerProfileSub})`);
      await rawSql('SellerDocument_nullify', `UPDATE "SellerDocument" SET "verifiedById" = NULL WHERE "verifiedById" ${uIn}`);
      await rawSql('SellerProfile', `DELETE FROM "SellerProfile" WHERE "userId" ${uIn}`);
      await rawSql('ShgProfile', `DELETE FROM "ShgProfile" WHERE "userId" ${uIn}`);
      await rawSql('ShgApplicationAuditLog', `DELETE FROM "ShgApplicationAuditLog" WHERE "actorUserId" ${uIn}`);

      // ─── Marketplace Banner & Eligibility ───
      await rawSql('MarketplaceBanner_nullify', `UPDATE "MarketplaceBanner" SET "uploadedByUserId" = NULL, "approvedByUserId" = NULL WHERE "uploadedByUserId" ${uIn} OR "approvedByUserId" ${uIn}`);
      await rawSql('BannerEligibility_nullify', `UPDATE "BannerEligibility" SET "grantedByUserId" = NULL, "revokedByUserId" = NULL WHERE "grantedByUserId" ${uIn} OR "revokedByUserId" ${uIn}`);

      // ─── Certificates ───
      await rawSql('ProvisionalReceiptCertificate_u', `DELETE FROM "ProvisionalReceiptCertificate" WHERE "generatedById" ${uIn}`);
      await rawSql('ConsigneeReceiptAcceptanceCertificate_u', `DELETE FROM "ConsigneeReceiptAcceptanceCertificate" WHERE "generatedById" ${uIn}`);

      // ─── User roles, sessions, logs ───
      await rawSql('UserRole', `DELETE FROM "UserRole" WHERE "userId" ${uIn}`);
      await rawSql('UserRole_nullify', `UPDATE "UserRole" SET "assignedById" = NULL WHERE "assignedById" ${uIn}`);
      await rawSql('UserSession', `DELETE FROM "UserSession" WHERE "userId" ${uIn}`);
      await rawSql('LoginEvent', `DELETE FROM "LoginEvent" WHERE "userId" ${uIn}`);
      await rawSql('Notification', `DELETE FROM "Notification" WHERE "userId" ${uIn}`);
      await rawSql('NotificationPreference', `DELETE FROM "NotificationPreference" WHERE "userId" ${uIn}`);
      await rawSql('IdempotencyKey', `DELETE FROM "IdempotencyKey" WHERE "userId" ${uIn}`);
      await rawSql('ApiLog', `DELETE FROM "ApiLog" WHERE "userId" ${uIn}`);
      await rawSql('ApiVerificationLog', `DELETE FROM "ApiVerificationLog" WHERE "userId" ${uIn}`);
      await rawSql('AuditLog', `DELETE FROM "AuditLog" WHERE "userId" ${uIn}`);
      await rawSql('FileAsset', `DELETE FROM "FileAsset" WHERE "ownerId" ${uIn}`);

      // ─── Finally delete users ───
      await rawSql('User', `DELETE FROM "User" WHERE "id" ${uIn}`);
    }

    // ═══════════════════════════════════════════════════════════
    // 14.5 Monthly ranks and banner eligibility
    // ═══════════════════════════════════════════════════════════
    await rawSql('OrganizationMonthlyRank', `DELETE FROM "OrganizationMonthlyRank" WHERE "organizationId" = ${id}`);
    await rawSql('BannerEligibility', `DELETE FROM "BannerEligibility" WHERE "organizationId" = ${id}`);

    // 15. Finally delete the organization
    await rawSql('Organization', `DELETE FROM "Organization" WHERE "id" = ${id}`);

    return counts;
  }, { timeout: 300_000, maxWait: 60_000 });

  await createAuditLog(req, {
    action: 'organization.cascade_delete',
    entityType: 'organization',
    entityId: id,
    metadata: { reason, organizationName: organization.organizationName, deletedCounts: summary }
  });

  await invalidateByPattern('master-admin:*');

  jsonOk(res, { deleted: summary, organizationName: organization.organizationName }, `Organization "${organization.organizationName}" and all related data permanently deleted.`);
}));

const getOrganizationCompany = async (organizationId: number): Promise<any | null> => {
  const organization: any = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, organizationName: true,  company: { select: companySelect } as any }
  } as any);
  if (!organization) return null;
  if (organization.companyId) return organization;
  const company = await (prisma as any).company.findFirst({ where: { isActive: true }, select: companySelect });
  if (!company) return organization;
  return { ...organization,  company };
};

const defaultTheme = {
  themeName: 'JsgSmile Default',
  primaryColor: '#12335f',
  secondaryColor: '#0f766e',
  accentColor: '#c27803',
  sidebarStyle: 'compact',
  dashboardLayout: 'governance',
  enableCompactMode: true,
  enableRoundedCards: false,
  logoUrl: null,
  faviconUrl: null
};

router.get('/master-admin/organizations/:id/theme', ...masterOnly, wrap(async (req, res) => {
  const organizationId = Number(req.params.id);
  const organization = await getOrganizationCompany(organizationId);
  if (!organization) return jsonError(res, 404, 'Organization not found.', 'ORGANIZATION_NOT_FOUND');
  const key = `organization:${organizationId}:theme`;
  const setting = organization.companyId ? await (prisma as any).companySetting.findUnique({
    where: { companyId_key: {  key } }
  }) : null;
  jsonOk(res, {
    organizationId,
    
    ...(defaultTheme),
    ...((organization.company as any)?.themeSettings || {}),
    ...(setting?.value || {})
  });
}));

router.put('/master-admin/organizations/:id/theme', ...masterOnly, requirePermission(PERMISSIONS.BRANDING_UPDATE), wrap(async (req, res) => {
  const organizationId = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'update organization theme');
  if (!reason) return;
  const organization = await getOrganizationCompany(organizationId);
  if (!organization?.companyId) return jsonError(res, 400, 'Organization must be assigned to a company before theme settings can be stored.', 'ACTION_NOT_ALLOWED');
  const theme = {
    themeName: textOrNull(req.body?.themeName) || defaultTheme.themeName,
    primaryColor: textOrNull(req.body?.primaryColor) || defaultTheme.primaryColor,
    secondaryColor: textOrNull(req.body?.secondaryColor) || defaultTheme.secondaryColor,
    accentColor: textOrNull(req.body?.accentColor) || defaultTheme.accentColor,
    logoUrl: textOrNull(req.body?.logoUrl),
    faviconUrl: textOrNull(req.body?.faviconUrl),
    dashboardLayout: textOrNull(req.body?.dashboardLayout) || defaultTheme.dashboardLayout,
    sidebarStyle: textOrNull(req.body?.sidebarStyle) || defaultTheme.sidebarStyle,
    enableCompactMode: typeof req.body?.enableCompactMode === 'boolean' ? req.body.enableCompactMode : true,
    enableRoundedCards: typeof req.body?.enableRoundedCards === 'boolean' ? req.body.enableRoundedCards : false,
    customCssJson: req.body?.customCssJson && typeof req.body.customCssJson === 'object' ? req.body.customCssJson : undefined
  };
  const key = `organization:${organizationId}:theme`;
  await (prisma as any).companySetting.upsert({
    where: { companyId_key: {  key } },
    update: { value: theme },
    create: {  key, value: theme }
  });
  await createAuditLog(req, { action: 'organization.theme.update', entityType: 'organization', entityId: organizationId, metadata: {  reason } });
  jsonOk(res, { organizationId,  ...theme }, 'Theme updated successfully');
}));

router.post('/master-admin/organizations/:id/theme/reset', ...masterOnly, requirePermission(PERMISSIONS.BRANDING_UPDATE), wrap(async (req, res) => {
  const organizationId = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'reset organization theme');
  if (!reason) return;
  const organization = await getOrganizationCompany(organizationId);
  if (!organization?.companyId) return jsonError(res, 400, 'Organization must be assigned to a company before theme settings can be reset.', 'ACTION_NOT_ALLOWED');
  await (prisma as any).companySetting.deleteMany({ where: {  key: `organization:${organizationId}:theme` } });
  await createAuditLog(req, { action: 'organization.theme.reset', entityType: 'organization', entityId: organizationId, metadata: {  reason } });
  jsonOk(res, { organizationId,  ...defaultTheme }, 'Theme reset successfully');
}));

router.get('/master-admin/organizations/:id/features', ...masterOnly, wrap(async (req, res) => {
  const organization = await getOrganizationCompany(Number(req.params.id));
  if (!organization) return jsonError(res, 404, 'Organization not found.', 'ORGANIZATION_NOT_FOUND');
  if (!organization.companyId) return jsonOk(res, { items: [] }, 'Organization has no company feature context.');
  const features = await (prisma as any).feature.findMany({
    orderBy: [{ module: 'asc' }, { name: 'asc' }],
    include: { companies: { where: { companyId: organization.companyId } } }
  });
  jsonOk(res, {
    items: features.map((feature: any) => ({
      id: feature.id,
      code: feature.code,
      featureKey: feature.code,
      name: feature.name,
      featureName: feature.name,
      module: feature.module,
      description: feature.description,
      enabled: feature.companies[0]?.enabled ?? (feature.code === 'admin-bid-approval' ? true : false),
      isEnabled: feature.companies[0]?.enabled ?? (feature.code === 'admin-bid-approval' ? true : false),
      updatedAt: feature.companies[0]?.updatedAt ?? null
    }))
  });
}));

router.put('/master-admin/organizations/:id/features', ...masterOnly, requirePermission(PERMISSIONS.FEATURE_TOGGLE), wrap(async (req, res) => {
  const organization = await getOrganizationCompany(Number(req.params.id));
  const reason = ensureReason(res, req.body, 'update organization feature controls');
  if (!reason) return;
  if (!organization?.companyId) return jsonError(res, 400, 'Organization must be assigned to a company before feature settings can be stored.', 'ACTION_NOT_ALLOWED');
  req.params.id = String(organization.companyId);
  const features = Array.isArray(req.body?.features) ? req.body.features : [];
  for (const row of features) {
    const feature = row.featureKey || row.code ? await (prisma as any).feature.findUnique({ where: { code: String(row.featureKey || row.code) } }) : null;
    const featureId = Number(row.featureId || row.id || feature?.id);
    if (!Number.isFinite(featureId)) continue;
    await (prisma as any).platformFeature.upsert({
      where: { companyId_featureId: {  featureId } },
      update: { enabled: Boolean(row.enabled ?? row.isEnabled), updatedById: req.user?.id },
      create: {  featureId, enabled: Boolean(row.enabled ?? row.isEnabled), updatedById: req.user?.id }
    });
  }
  await createAuditLog(req, { action: 'organization.features.update', entityType: 'organization', entityId: organization.id, metadata: {  count: features.length, reason } });
  jsonOk(res, { count: features.length }, 'Feature controls updated successfully');
}));

router.post('/master-admin/organizations/:id/features/:featureKey/enable', ...masterOnly, requirePermission(PERMISSIONS.FEATURE_TOGGLE), wrap(async (req, res) => {
  const organization = await getOrganizationCompany(Number(req.params.id));
  const reason = ensureReason(res, req.body, 'enable organization feature');
  if (!reason) return;
  if (!organization?.companyId) return jsonError(res, 400, 'Organization must be assigned to a company before feature settings can be stored.', 'ACTION_NOT_ALLOWED');
  const feature = await (prisma as any).feature.findUnique({ where: { code: req.params.featureKey } });
  if (!feature) return jsonError(res, 404, 'Feature not found.', 'ACTION_NOT_ALLOWED');
  await (prisma as any).platformFeature.upsert({
    where: { companyId_featureId: {  featureId: feature.id } },
    update: { enabled: true, updatedById: req.user?.id },
    create: {  featureId: feature.id, enabled: true, updatedById: req.user?.id }
  });
  await createAuditLog(req, { action: 'organization.feature.enable', entityType: 'organization', entityId: organization.id, metadata: {  featureKey: feature.code, reason } });
  jsonOk(res, { featureKey: feature.code, enabled: true }, 'Feature enabled');
}));

router.post('/master-admin/organizations/:id/features/:featureKey/disable', ...masterOnly, requirePermission(PERMISSIONS.FEATURE_TOGGLE), wrap(async (req, res) => {
  const organization = await getOrganizationCompany(Number(req.params.id));
  const reason = ensureReason(res, req.body, 'disable organization feature');
  if (!reason) return;
  if (!organization?.companyId) return jsonError(res, 400, 'Organization must be assigned to a company before feature settings can be stored.', 'ACTION_NOT_ALLOWED');
  const feature = await (prisma as any).feature.findUnique({ where: { code: req.params.featureKey } });
  if (!feature) return jsonError(res, 404, 'Feature not found.', 'ACTION_NOT_ALLOWED');
  await (prisma as any).platformFeature.upsert({
    where: { companyId_featureId: {  featureId: feature.id } },
    update: { enabled: false, updatedById: req.user?.id },
    create: {  featureId: feature.id, enabled: false, updatedById: req.user?.id }
  });
  await createAuditLog(req, { action: 'organization.feature.disable', entityType: 'organization', entityId: organization.id, metadata: {  featureKey: feature.code, reason } });
  jsonOk(res, { featureKey: feature.code, enabled: false }, 'Feature disabled');
}));

router.post('/master-admin/users', ...masterOnly, requirePermission(PERMISSIONS.USER_CREATE), wrap(async (req, res) => {
  const reason = ensureReason(res, req.body, 'create user');
  if (!reason) return;
  try {
    const data = await userPayload(req.body || {});
    const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (existing) return jsonError(res, 409, 'A user with this email already exists.', 'DUPLICATE_EMAIL');
    const generatedId = await generateAlphanumericUserId();
    const user = await prisma.user.create({ data: { ...data, userId: generatedId }, select: userSelect });
    await createAuditLog(req, { action: 'user.create', entityType: 'user', entityId: user.id, metadata: { email: user.email, role: user.role, reason } });
    jsonOk(res, user, 'User created successfully', 201);
  } catch (error: any) {
    const code = String(error?.message || '');
    if (code === 'INVALID_ROLE') return jsonError(res, 400, 'Invalid role selected.', 'INVALID_ROLE');
    if (code === 'INVALID_STATUS') return jsonError(res, 400, 'Invalid user status selected.', 'INVALID_STATUS');
    if (code === 'USER_NAME_REQUIRED') return jsonError(res, 400, 'Name is required.', 'VALIDATION_ERROR');
    if (code === 'USER_EMAIL_REQUIRED') return jsonError(res, 400, 'Email is required.', 'VALIDATION_ERROR');
    console.error('Error creating user:', error);
    return jsonError(res, 500, error.message || 'Failed to create user due to an internal error.', 'INTERNAL_SERVER_ERROR');
  }
}));

router.get('/master-admin/users/:id', ...masterOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user || user.role === 'master_admin' || user.userId === 'MASTER_ADMIN') {
    return jsonError(res, 404, 'User not found.', 'USER_NOT_FOUND');
  }
  jsonOk(res, user);
}));

router.put('/master-admin/users/:id', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await checkNotMasterAdmin(id, res))) return;
  const reason = ensureReason(res, req.body, 'update user');
  if (!reason) return;
  try {
    const data = await userPayload(req.body || {}, true);
    if (data.email) {
      const existing = await prisma.user.findFirst({ where: { email: data.email, id: { not: id } }, select: { id: true } });
      if (existing) return jsonError(res, 409, 'A user with this email already exists.', 'DUPLICATE_EMAIL');
      data.userId = data.email;
    }
    const user = await prisma.user.update({ where: { id }, data, select: userSelect });
    await createAuditLog(req, { action: 'user.update', entityType: 'user', entityId: id, metadata: { email: user.email, role: user.role, reason } });
    jsonOk(res, user, 'User updated successfully');
  } catch (error: any) {
    const code = String(error?.message || '');
    if (code === 'INVALID_ROLE') return jsonError(res, 400, 'Invalid role selected.', 'INVALID_ROLE');
    if (code === 'INVALID_STATUS') return jsonError(res, 400, 'Invalid user status selected.', 'INVALID_STATUS');
    console.error('Error updating user:', error);
    return jsonError(res, 500, error.message || 'Failed to update user due to an internal error.', 'INTERNAL_SERVER_ERROR');
  }
}));

const userStatusAction = (action: 'activate' | 'inactivate' | 'suspend' | 'reactivate' | 'archive') =>
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!(await checkNotMasterAdmin(id, res))) return;
    const reason = ensureReason(res, req.body, action);
    if (!reason) return;
    if (action === 'archive') {
      try {
        const deletedUser = await permanentlyDeleteUser(req, id, reason);
        return jsonOk(res, deletedUser, 'User permanently deleted from database.');
      } catch (err: any) {
        return jsonError(res, 400, err.message || 'Failed to delete user.', 'DELETE_FAILED');
      }
    }
    const accountStatus = action === 'activate' || action === 'reactivate' ? 'ACTIVE' : action === 'suspend' ? 'SUSPENDED' : 'BLOCKED';
    const data: any = { accountStatus: accountStatus as any, sessionVersion: { increment: 1 } };
    const user = await prisma.user.update({ where: { id }, data, select: userSelect });
    await createAuditLog(req, { action: `user.${action}`, entityType: 'user', entityId: id, metadata: { reason, accountStatus } });
    jsonOk(res, user, `User ${action} successful`);
  });

router.post('/master-admin/users/:id/activate', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), userStatusAction('activate'));
router.post('/master-admin/users/:id/inactivate', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), userStatusAction('inactivate'));
router.post('/master-admin/users/:id/suspend', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), userStatusAction('suspend'));
router.post('/master-admin/users/:id/reactivate', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), userStatusAction('reactivate'));
router.post('/master-admin/users/:id/archive', ...masterOnly, requirePermission(PERMISSIONS.USER_DELETE), userStatusAction('archive'));

router.delete('/master-admin/users/:id', ...masterOnly, requirePermission(PERMISSIONS.USER_DELETE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await checkNotMasterAdmin(id, res))) return;
  const reason = ensureReason(res, req.body, 'permanently delete user');
  if (!reason) return;
  try {
    const user = await permanentlyDeleteUser(req, id, reason);
    jsonOk(res, user, 'User permanently deleted from database.');
  } catch (err: any) {
    jsonError(res, 400, err.message || 'Failed to delete user.', 'DELETE_FAILED');
  }
}));

// Purge soft-deleted users on module load
setTimeout(async () => {
  try {
    const deletedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { accountStatus: 'DELETED' as any },
          { email: { startsWith: 'deleted_' } }
        ]
      },
      select: { id: true, email: true }
    });
    if (deletedUsers.length > 0) {
      console.log(`[UserPurge] Found ${deletedUsers.length} soft-deleted user(s) to purge permanently...`);
      for (const u of deletedUsers) {
        try {
          await permanentlyDeleteUser(null, u.id, 'Startup purge of soft-deleted users');
          console.log(`[UserPurge] Permanently deleted user #${u.id} (${u.email})`);
        } catch (err: any) {
          console.error(`[UserPurge] Failed to purge user #${u.id}:`, err?.message || err);
        }
      }
    }
  } catch (err) {
    console.error('[UserPurge] Purge error:', err);
  }
}, 1000);

router.post('/master-admin/users/:id/reset-password', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await checkNotMasterAdmin(id, res))) return;
  const reason = ensureReason(res, req.body, 'reset user password');
  if (!reason) return;
  const temporaryPassword = textOrNull(req.body?.temporaryPassword) || `JsgSmile@${randomToken(8)}Aa1!`;
  const user = await prisma.user.update({
    where: { id },
    data: { password: await hashPassword(temporaryPassword), passwordResetVersion: { increment: 1 }, sessionVersion: { increment: 1 } },
    select: userSelect
  });
  await createAuditLog(req, { action: 'user.password.reset', entityType: 'user', entityId: id, metadata: { reason } });
  jsonOk(res, { user, temporaryPassword }, 'Temporary password generated. Share it through an approved secure channel.');
}));

router.post('/master-admin/users/:id/unlock', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await checkNotMasterAdmin(id, res))) return;
  const reason = ensureReason(res, req.body, 'unlock user');
  if (!reason) return;
  const user = await prisma.user.update({
    where: { id },
    data: { failedLoginCount: 0, lockedUntil: null },
    select: userSelect
  });
  await createAuditLog(req, { action: 'user.unlock', entityType: 'user', entityId: id, metadata: { reason } });
  jsonOk(res, user, 'User account unlocked successfully.');
}));

router.post('/master-admin/users/:id/invite', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await checkNotMasterAdmin(id, res))) return;
  const reason = ensureReason(res, req.body, 'invite user');
  if (!reason) return;
  const user = await prisma.user.update({ where: { id }, data: { accountStatus: 'PENDING' as any }, select: userSelect });
  await createAuditLog(req, { action: 'user.invite.marked', entityType: 'user', entityId: id, metadata: { reason } });
  jsonOk(res, user, 'User marked as invited/pending. Email delivery depends on SMTP configuration.');
}));

router.post('/master-admin/users/:id/change-role', ...masterOnly, requirePermission(PERMISSIONS.ROLE_ASSIGN), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await checkNotMasterAdmin(id, res))) return;
  const reason = ensureReason(res, req.body, 'change user role');
  if (!reason) return;
  const role = textOrNull(req.body?.role);
  if (!role || !allowedRoles.has(role)) return jsonError(res, 400, 'Invalid role selected.', 'INVALID_ROLE');
  const requestedRole = role.trim().toLowerCase();
  if (requestedRole === 'master_admin' || requestedRole === 'master admin') {
    return jsonError(res, 403, 'Cannot assign Master Admin role.', 'MASTER_ADMIN_ASSIGNMENT_BLOCKED');
  }
  const user = await prisma.user.update({ where: { id }, data: { role: role as any, sessionVersion: { increment: 1 } }, select: userSelect });
  await createAuditLog(req, { action: 'user.role.change', entityType: 'user', entityId: id, metadata: { role, reason } });
  jsonOk(res, user, 'User role changed successfully');
}));

router.post('/master-admin/users/:id/change-organization', ...masterOnly, requirePermission(PERMISSIONS.USER_UPDATE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await checkNotMasterAdmin(id, res))) return;
  const reason = ensureReason(res, req.body, 'change user organization');
  if (!reason) return;
  const organizationId = numberOrUndefined(req.body?.organizationId);
  if (!organizationId) return jsonError(res, 400, 'Organization is required.', 'VALIDATION_ERROR');
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, } });
  if (!organization) return jsonError(res, 404, 'Organization not found.', 'ORGANIZATION_NOT_FOUND');
  const user = await prisma.user.update({ where: { id }, data: { organizationId}, select: userSelect });
  await createAuditLog(req, { action: 'user.organization.change', entityType: 'user', entityId: id, metadata: { organizationId, reason } });
  jsonOk(res, user, 'User organization changed successfully');
}));

router.get('/master-admin/procurement', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(status ? { status: status as any } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { bidNumber: { contains: q, mode: 'insensitive' } },
        { buyerOrganizationName: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } }
      ]
    } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    title: 'title',
    bidNumber: 'bidNumber',
    status: 'status',
    buyerOrganizationName: 'buyerOrganizationName',
    approvalStatus: 'approvalStatus',
    endDate: 'endDate',
    createdAt: 'createdAt',
    estimatedValue: 'estimatedValue'
  }, { updatedAt: 'desc' });
  const [items, total, summary] = await Promise.all([
    (prisma as any).procurementBid.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        bidNumber: true,
        title: true,
        buyerOrganizationName: true,
        category: true,
        status: true,
        approvalStatus: true,
        lifecycleStage: true,
        estimatedValue: true,
        endDate: true,
        createdAt: true,
        _count: { select: { participations: true, documents: true, awards: true } }
      }
    }),
    (prisma as any).procurementBid.count({ where }),
    Promise.all([
      safeCount((prisma as any).procurementBid),
      safeCount((prisma as any).procurementBid, { where: { approvalStatus: 'PENDING' } }),
      safeCount((prisma as any).procurementBid, { where: { status: 'OPEN' } }),
      safeCount((prisma as any).procurementBid, { where: { status: 'TECHNICAL_EVALUATION' } }),
      safeCount((prisma as any).procurementBid, { where: { status: 'FINANCIAL_EVALUATION' } }),
      safeCount((prisma as any).procurementBid, { where: { status: 'AWARD_RECOMMENDED' } }),
      safeCount((prisma as any).procurementBidParticipation)
    ])
  ]);
  const [totalBids, pendingApprovals, activeBids, technicalEvaluation, financialEvaluation, awardRecommended, participations] = summary;
  res.json({ items, total, page, pageSize, summary: { totalBids, pendingApprovals, activeBids, technicalEvaluation, financialEvaluation, awardRecommended, participations } });
}));

router.get('/master-admin/tenders', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(status ? { status: status as any } : {}),
    ...(q ? {
      OR: [
        { tenderId: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { buyer: { name: { contains: q, mode: 'insensitive' } } },
        { organization: { organizationName: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    tenderId: 'tenderId',
    title: 'title',
    category: 'category',
    status: 'status',
    budget: 'budget',
    closesAt: 'closesAt',
    publishedAt: 'publishedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }, { createdAt: 'desc' });
  const [items, total, summary] = await Promise.all([
    prisma.tender.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        tenderId: true,
        title: true,
        category: true,
        status: true,
        budget: true,
        bidsCount: true,
        closesAt: true,
        publishedAt: true,
        createdAt: true,
        buyer: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, organizationName: true, organizationType: true } },
        _count: { select: { bids: true, tenderParticipants: true, purchaseOrders: true } }
      }
    }),
    prisma.tender.count({ where }),
    Promise.all([
      safeCount(prisma.tender),
      safeCount(prisma.tender, { where: { status: 'draft' as any } }),
      safeCount(prisma.tender, { where: { status: { in: ['published', 'bid_submission'] as any } } }),
      safeCount(prisma.tender, { where: { status: { in: ['awarded', 'closed'] as any } } })
    ])
  ]);
  const [totalTenders, draftTenders, activeTenders, completedTenders] = summary;
  res.json({ items, total, page, pageSize, summary: { totalTenders, draftTenders, activeTenders, completedTenders } });
}));

router.get('/master-admin/rfqs', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { subject: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        { buyer: { name: { contains: q, mode: 'insensitive' } } },
        { seller: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    subject: 'subject',
    status: 'status',
    estimatedValue: 'estimatedValue',
    deadlineDate: 'deadlineDate',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }, { createdAt: 'desc' });
  const [items, total, summary] = await Promise.all([
    prisma.quoteRequest.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        subject: true,
        status: true,
        estimatedValue: true,
        deadlineDate: true,
        createdAt: true,
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        _count: { select: { quoteResponses: true } }
      }
    }),
    prisma.quoteRequest.count({ where }),
    Promise.all([
      safeCount(prisma.quoteRequest),
      safeCount(prisma.quoteRequest, { where: { status: 'pending' } }),
      safeCount(prisma.quoteRequest, { where: { status: { in: ['accepted', 'completed'] } } }),
      safeCount(prisma.quoteResponse)
    ])
  ]);
  const [totalRfqs, pendingRfqs, completedRfqs, responses] = summary;
  res.json({ items, total, page, pageSize, summary: { totalRfqs, pendingRfqs, completedRfqs, responses } });
}));

router.get('/master-admin/orders', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { poNumber: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { sourceType: { contains: q, mode: 'insensitive' } },
        { buyer: { name: { contains: q, mode: 'insensitive' } } },
        { seller: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    poNumber: 'poNumber',
    title: 'title',
    status: 'status',
    amount: 'amount',
    totalValue: 'totalValue',
    expectedDelivery: 'expectedDelivery',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }, { createdAt: 'desc' });
  const [items, total, summary] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        poNumber: true,
        title: true,
        amount: true,
        totalValue: true,
        currency: true,
        status: true,
        sourceType: true,
        expectedDelivery: true,
        createdAt: true,
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        tender: { select: { id: true, tenderId: true, title: true } },
        _count: { select: { invoices: true, payments: true, grns: true } }
      }
    }),
    prisma.purchaseOrder.count({ where }),
    Promise.all([
      safeCount(prisma.purchaseOrder),
      safeCount(prisma.purchaseOrder, { where: { status: { in: ['generated', 'issued', 'accepted'] } } }),
      safeCount(prisma.purchaseOrder, { where: { status: { in: ['in_fulfillment', 'delivered'] } } }),
      safeCount(prisma.purchaseOrder, { where: { status: { in: ['completed', 'closed'] } } })
    ])
  ]);
  const [totalOrders, activeOrders, deliveryOrders, completedOrders] = summary;
  res.json({ items, total, page, pageSize, summary: { totalOrders, activeOrders, deliveryOrders, completedOrders } });
}));

router.post('/master-admin/orders/:id/status', ...masterOnly, requirePermission(PERMISSIONS.OVERRIDE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'update order status');
  if (!reason) return;
  const status = textOrNull(req.body?.status)?.toLowerCase();
  if (!status || !allowedOrderStatuses.has(status)) return jsonError(res, 400, 'Invalid order status selected.', 'VALIDATION_ERROR');
  const previous = await prisma.purchaseOrder.findUnique({ where: { id }, select: { id: true, poNumber: true, status: true, poStatus: true, version: true } });
  if (!previous) return jsonError(res, 404, 'Purchase order not found.', 'NOT_FOUND');
  const poStatusCandidate = normalizedEnum(status);
  const poStatus = poStatusCandidate && ['GENERATED', 'ISSUED', 'ACCEPTED', 'IN_FULFILLMENT', 'DELIVERED', 'CLOSED', 'CANCELLED'].includes(poStatusCandidate)
    ? poStatusCandidate
    : undefined;
  const order = await prisma.purchaseOrder.update({
    where: { id },
    data: { status, ...(poStatus ? { poStatus: poStatus as any } : {}), version: { increment: 1 } },
    select: { id: true, poNumber: true, title: true, status: true, poStatus: true, updatedAt: true }
  });
  await createAuditLog(req, {
    action: 'purchase-order.status.override',
    entityType: 'purchaseOrder',
    entityId: id,
    metadata: { reason, oldValue: { status: previous.status, poStatus: previous.poStatus }, newValue: { status, poStatus: poStatus || previous.poStatus }, poNumber: previous.poNumber }
  });
  jsonOk(res, order, 'Order status updated with audit reason');
}));

router.get('/master-admin/invoices', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: q, mode: 'insensitive' } } },
        { buyer: { name: { contains: q, mode: 'insensitive' } } },
        { seller: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    invoiceNumber: 'invoiceNumber',
    status: 'status',
    amount: 'amount',
    currency: 'currency',
    approvedAt: 'approvedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }, { createdAt: 'desc' });
  const [items, total, summary] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        currency: true,
        status: true,
        invoiceStatus: true,
        taxableAmount: true,
        totalTaxAmount: true,
        tdsAmount: true,
        approvedAt: true,
        createdAt: true,
        purchaseOrder: { select: { id: true, poNumber: true, title: true, status: true } },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true, payments: true, paymentSettlements: true } }
      }
    }),
    prisma.invoice.count({ where }),
    Promise.all([
      safeCount(prisma.invoice),
      safeCount(prisma.invoice, { where: { status: 'submitted' } }),
      safeCount(prisma.invoice, { where: { status: 'approved' } }),
      safeCount(prisma.invoice, { where: { status: 'paid' } })
    ])
  ]);
  const [totalInvoices, submittedInvoices, approvedInvoices, paidInvoices] = summary;
  res.json({ items, total, page, pageSize, summary: { totalInvoices, submittedInvoices, approvedInvoices, paidInvoices } });
}));

router.post('/master-admin/invoices/:id/status', ...masterOnly, requirePermission(PERMISSIONS.OVERRIDE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'update invoice status');
  if (!reason) return;
  const status = textOrNull(req.body?.status)?.toLowerCase();
  if (!status || !allowedInvoiceStatuses.has(status)) return jsonError(res, 400, 'Invalid invoice status selected.', 'VALIDATION_ERROR');
  const previous = await prisma.invoice.findUnique({ where: { id }, select: { id: true, invoiceNumber: true, status: true, invoiceStatus: true, version: true } });
  if (!previous) return jsonError(res, 404, 'Invoice not found.', 'NOT_FOUND');
  const invoiceStatusCandidate = normalizedEnum(status);
  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status, invoiceStatus: invoiceStatusCandidate as any, version: { increment: 1 }, ...(status === 'approved' ? { approvedAt: new Date() } : {}) },
    select: { id: true, invoiceNumber: true, status: true, invoiceStatus: true, approvedAt: true, updatedAt: true }
  });
  await createAuditLog(req, {
    action: 'invoice.status.override',
    entityType: 'invoice',
    entityId: id,
    metadata: { reason, oldValue: { status: previous.status, invoiceStatus: previous.invoiceStatus }, newValue: { status, invoiceStatus: invoiceStatusCandidate }, invoiceNumber: previous.invoiceNumber }
  });
  jsonOk(res, invoice, 'Invoice status updated with audit reason');
}));

router.get('/master-admin/payments', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ referenceId: { contains: q, mode: 'insensitive' } }, { gateway: { contains: q, mode: 'insensitive' } }] } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    referenceId: 'referenceId',
    gateway: 'gateway',
    status: 'status',
    amount: 'amount',
    currency: 'currency',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }, { createdAt: 'desc' });
  const [items, total, summary] = await Promise.all([
    (prisma as any).paymentTransaction.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        referenceId: true,
        gateway: true,
        method: true,
        status: true,
        paymentStatus: true,
        amount: true,
        currency: true,
        createdAt: true,
        completedAt: true,
        purchaseOrderId: true,
        invoiceId: true,
        payer: { select: { id: true, name: true, email: true } },
        payee: { select: { id: true, name: true, email: true } }
      }
    }),
    (prisma as any).paymentTransaction.count({ where }),
    Promise.all([
      safeCount((prisma as any).paymentTransaction),
      safeCount((prisma as any).paymentTransaction, { where: { status: { in: ['failed', 'FAILED'] } } }),
      safeCount((prisma as any).paymentSettlement, { where: { status: 'PENDING' } }),
      safeCount((prisma as any).paymentSettlement, { where: { status: 'RELEASED' } }),
      safeCount((prisma as any).paymentWebhookEvent, { where: { processed: false } })
    ])
  ]);
  const [totalPayments, failedPayments, pendingSettlements, completedSettlements, pendingWebhooks] = summary;
  res.json({ items, total, page, pageSize, summary: { totalPayments, failedPayments, pendingSettlements, completedSettlements, pendingWebhooks } });
}));

router.post('/master-admin/payments/:id/status', ...masterOnly, requirePermission(PERMISSIONS.OVERRIDE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'update payment status');
  if (!reason) return;
  const status = textOrNull(req.body?.status)?.toLowerCase();
  if (!status || !allowedPaymentStatuses.has(status)) return jsonError(res, 400, 'Invalid payment status selected.', 'VALIDATION_ERROR');
  const previous = await (prisma as any).paymentTransaction.findUnique({ where: { id }, select: { id: true, referenceId: true, status: true, paymentStatus: true, version: true } });
  if (!previous) return jsonError(res, 404, 'Payment transaction not found.', 'NOT_FOUND');
  const paymentStatusCandidate = normalizedEnum(status);
  const paymentStatus = paymentStatusCandidate && allowedPaymentStatusEnums.has(paymentStatusCandidate) ? paymentStatusCandidate : undefined;
  const payment = await (prisma as any).paymentTransaction.update({
    where: { id },
    data: {
      status,
      ...(paymentStatus ? { paymentStatus: paymentStatus as any } : {}),
      version: { increment: 1 }
    },
    select: { id: true, referenceId: true, status: true, paymentStatus: true, amount: true, currency: true, updatedAt: true }
  });
  await createAuditLog(req, {
    action: 'payment.status.override',
    entityType: 'paymentTransaction',
    entityId: id,
    metadata: { reason, oldValue: { status: previous.status, paymentStatus: previous.paymentStatus }, newValue: { status, paymentStatus: paymentStatus || previous.paymentStatus }, referenceId: previous.referenceId }
  });
  jsonOk(res, payment, 'Payment status updated with audit reason');
}));

router.get('/master-admin/escrow-accounts', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { status: { contains: q, mode: 'insensitive' } },
        { paymentTransaction: { referenceId: { contains: q, mode: 'insensitive' } } },
        { purchaseOrder: { poNumber: { contains: q, mode: 'insensitive' } } },
        { buyer: { name: { contains: q, mode: 'insensitive' } } },
        { buyer: { email: { contains: q, mode: 'insensitive' } } },
        { seller: { name: { contains: q, mode: 'insensitive' } } },
        { seller: { email: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const [items, total, summary] = await Promise.all([
    (prisma as any).escrowAccount.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        escrowStatus: true,
        fundedAt: true,
        frozenAt: true,
        releasedAt: true,
        createdAt: true,
        updatedAt: true,
        paymentTransaction: { select: { id: true, referenceId: true, status: true } },
        purchaseOrder: { select: { id: true, poNumber: true, title: true, status: true } },
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
        _count: { select: { transactions: true, milestones: true } }
      }
    }),
    safeCount((prisma as any).escrowAccount, { where }),
    Promise.all([
      safeCount((prisma as any).escrowAccount),
      safeCount((prisma as any).escrowAccount, { where: { status: { in: ['held', 'funded'] } } }),
      safeCount((prisma as any).escrowAccount, { where: { status: 'frozen' } }),
      safeCount((prisma as any).escrowAccount, { where: { status: 'released' } })
    ])
  ]);
  const [totalEscrows, heldEscrows, frozenEscrows, releasedEscrows] = summary;
  res.json({ items, total, page, pageSize, summary: { totalEscrows, heldEscrows, frozenEscrows, releasedEscrows } });
}));

router.post('/master-admin/escrow-accounts/:id/status', ...masterOnly, requirePermission(PERMISSIONS.OVERRIDE), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, 'update escrow status');
  if (!reason) return;
  const status = textOrNull(req.body?.status)?.toLowerCase();
  if (!status || !allowedEscrowStatuses.has(status)) return jsonError(res, 400, 'Invalid escrow status selected.', 'VALIDATION_ERROR');
  const previous = await (prisma as any).escrowAccount.findUnique({ where: { id }, select: { id: true, status: true, escrowStatus: true, version: true } });
  if (!previous) return jsonError(res, 404, 'Escrow account not found.', 'NOT_FOUND');
  const escrowStatusCandidate = normalizedEnum(status === 'dispute' ? 'disputed' : status);
  const escrowStatus = escrowStatusCandidate && allowedEscrowStatusEnums.has(escrowStatusCandidate) ? escrowStatusCandidate : undefined;
  const escrow = await (prisma as any).escrowAccount.update({
    where: { id },
    data: {
      status,
      ...(escrowStatus ? { escrowStatus: escrowStatus as any } : {}),
      version: { increment: 1 }
    },
    select: { id: true, amount: true, currency: true, status: true, escrowStatus: true, updatedAt: true }
  });
  await createAuditLog(req, {
    action: 'escrow.status.override',
    entityType: 'escrowAccount',
    entityId: id,
    metadata: { reason, oldValue: { status: previous.status, escrowStatus: previous.escrowStatus }, newValue: { status, escrowStatus: escrowStatus || previous.escrowStatus } }
  });
  jsonOk(res, escrow, 'Escrow status updated with audit reason');
}));

router.get('/master-admin/payment-settlements', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = normalizedEnum(req.query.status);
  const where: any = {
    ...(status ? { status: status as any } : {}),
    ...(q ? {
      OR: [
        { transactionReference: { contains: q, mode: 'insensitive' } },
        { remarks: { contains: q, mode: 'insensitive' } },
        { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
        { paymentTransaction: { referenceId: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const [items, total, summary] = await Promise.all([
    (prisma as any).paymentSettlement.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        transactionReference: true,
        deductionAmount: true,
        penaltyAmount: true,
        netReleasedAmount: true,
        invoiceVerifiedAt: true,
        approvedAt: true,
        releasedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        invoice: { select: { id: true, invoiceNumber: true, status: true, amount: true } },
        paymentTransaction: { select: { id: true, referenceId: true, status: true, amount: true } }
      }
    }),
    safeCount((prisma as any).paymentSettlement, { where }),
    Promise.all([
      safeCount((prisma as any).paymentSettlement),
      safeCount((prisma as any).paymentSettlement, { where: { status: 'PENDING' as any } }),
      safeCount((prisma as any).paymentSettlement, { where: { status: 'APPROVED' as any } }),
      safeCount((prisma as any).paymentSettlement, { where: { status: 'RELEASED' as any } })
    ])
  ]);
  const [totalSettlements, pendingSettlements, approvedSettlements, releasedSettlements] = summary;
  res.json({ items, total, page, pageSize, summary: { totalSettlements, pendingSettlements, approvedSettlements, releasedSettlements } });
}));

router.get('/master-admin/documents', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = textOrNull(req.query.status);
  const where: any = {
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { originalName: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
        { mimeType: { contains: q, mode: 'insensitive' } },
        { owner: { name: { contains: q, mode: 'insensitive' } } },
        { owner: { email: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const [items, total, summary] = await Promise.all([
    (prisma as any).fileAsset.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        entityType: true,
        entityId: true,
        mimeType: true,
        size: true,
        status: true,
        url: true,
        key: true,
        storageProvider: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true,  organization: { select: { id: true, organizationName: true } } } }
      }
    }),
    safeCount((prisma as any).fileAsset, { where }),
    Promise.all([
      safeCount((prisma as any).fileAsset),
      safeCount((prisma as any).fileAsset, { where: { status: 'active' } }),
      safeCount((prisma as any).fileAsset, { where: { url: { not: null } } })
    ])
  ]);
  const [totalDocuments, activeDocuments, documentsWithUrl] = summary;
  res.json({ items, total, page, pageSize, summary: { totalDocuments, activeDocuments, documentsWithUrl } });
}));

router.get('/master-admin/email-settings', ...masterOnly, wrap(async (_req, res) => {
  const stored = await (prisma as any).globalSetting.findUnique({
    where: { key: 'portal-email-settings' }
  }).catch(() => null);
  const storedValue = stored?.value || {};
  res.json({
    smtp: {
      host: storedValue.host || process.env.SMTP_HOST || '',
      port: Number(storedValue.port || process.env.SMTP_PORT || 587),
      secure: Boolean(storedValue.secure),
      user: storedValue.username ? maskSecret(String(storedValue.username), 3) : process.env.SMTP_USER ? maskSecret(process.env.SMTP_USER, 3) : null,
      username: storedValue.username ? maskSecret(String(storedValue.username), 3) : process.env.SMTP_USER ? maskSecret(process.env.SMTP_USER, 3) : null,
      fromEmail: storedValue.fromEmail ? maskSecret(String(storedValue.fromEmail), 3) : process.env.SMTP_USER ? maskSecret(process.env.SMTP_USER, 3) : null,
      fromName: storedValue.fromName || 'JsgSmile Portal',
      replyToEmail: storedValue.replyToEmail || null,
      emailEnabled: storedValue.emailEnabled ?? Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
      passwordConfigured: Boolean(storedValue.passwordConfigured || process.env.SMTP_PASS)
    },
    notifications: {
      emailEnabled: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
      templates: [
        'User registration',
        'Organization approval',
        'Bid published',
        'Seller participated',
        'Technical clarification',
        'Bid awarded',
        'PO generated',
        'Payment initiated',
        'Settlement completed'
      ]
    }
  });
}));

router.put('/master-admin/email-settings', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), wrap(async (req, res) => {
  const reason = ensureReason(res, req.body, 'update email settings');
  if (!reason) return;
  const current = await (prisma as any).globalSetting.findUnique({ where: { key: 'portal-email-settings' } }).catch(() => null);
  const currentValue = current?.value || {};
  const password = textOrNull(req.body?.password);
  const value = {
    host: textOrNull(req.body?.host) || textOrNull(req.body?.smtpHost) || currentValue.host || '',
    port: Number(req.body?.port || req.body?.smtpPort || currentValue.port || 587),
    secure: Boolean(req.body?.secure ?? currentValue.secure),
    username: textOrNull(req.body?.username) || textOrNull(req.body?.user) || currentValue.username || '',
    passwordConfigured: Boolean(password || currentValue.passwordConfigured),
    password: password || currentValue.password || '',
    passwordUpdatedAt: password ? new Date().toISOString() : currentValue.passwordUpdatedAt,
    fromEmail: textOrNull(req.body?.fromEmail) || currentValue.fromEmail || '',
    fromName: textOrNull(req.body?.fromName) || currentValue.fromName || 'Collectorate Jharsuguda Portal',
    replyToEmail: textOrNull(req.body?.replyToEmail) || currentValue.replyToEmail || '',
    emailEnabled: typeof req.body?.emailEnabled === 'boolean' ? req.body.emailEnabled : Boolean(currentValue.emailEnabled)
  };
  await (prisma as any).globalSetting.upsert({
    where: { key: 'portal-email-settings' },
    update: { value },
    create: { key: 'portal-email-settings', value }
  }).catch(() => null);
  await createAuditLog(req, { action: 'email.settings.update', entityType: 'portal', entityId: 1, metadata: { reason, passwordUpdated: Boolean(password) } });
  jsonOk(res, {
    smtp: {
      ...value,
      username: value.username ? maskSecret(value.username, 3) : null,
      passwordConfigured: value.passwordConfigured
    }
  }, 'Email settings saved successfully');
}));

router.post('/master-admin/email-settings/test', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), wrap(async (req, res) => {
  const to = textOrNull(req.body?.to);
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return jsonError(res, 400, 'Valid test email recipient is required.', 'VALIDATION_ERROR');
  await createAuditLog(req, { action: 'email.settings.test', entityType: 'portal', metadata: { to: maskSecret(to, 2) } });
  jsonOk(res, { to: maskSecret(to, 2), deliveryAttempted: false }, 'SMTP test request recorded. Live delivery uses deployment SMTP credentials.');
}));

// ─── Company-Specific Email Template Management ────────────────────────────
type EmailTemplate = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
};

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DEFAULT_TEMPLATE_VARIABLES = [
  'userName', 'userEmail', 'organizationName', 'portalName',
  'companyName', 'actionUrl', 'supportEmail', 'loginUrl',
  'invoiceNumber', 'orderNumber', 'tenderTitle', 'bidReference',
  'amount', 'currency', 'dueDate', 'currentDate', 'otp'
];

const buildDefaultTemplates = (): EmailTemplate[] => {
  const now = new Date().toISOString();
  return [
    {
      id: 'default_registration_otp',
      slug: 'registration-otp',
      name: 'Registration OTP',
      subject: 'Welcome to {{portalName}}! Verification Code',
      htmlBody: '<html><body><h1>Welcome to {{portalName}}!</h1><p>Use the following verification code to complete your registration:</p><h2 style="font-size: 28px; letter-spacing: 5px; color: #12335f; font-family: monospace;">{{otp}}</h2><p>This code is valid for 10 minutes.</p></body></html>',
      textBody: 'Welcome to {{portalName}}! Use the following verification code to complete your registration: {{otp}}. This code is valid for 10 minutes.',
      isActive: true,
      variables: ['portalName', 'otp'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_forgot_password_otp',
      slug: 'forgot-password-otp',
      name: 'Forgot Password OTP',
      subject: '[SECURE AUTH] Password reset code',
      htmlBody: '<html><body><h1>Password Reset Request</h1><p>Use the following code to reset your password:</p><h2 style="font-size: 28px; letter-spacing: 5px; color: #12335f; font-family: monospace;">{{otp}}</h2><p>This code is valid for 10 minutes.</p></body></html>',
      textBody: 'Password Reset Request: Use the following code to reset your password: {{otp}}. This code is valid for 10 minutes.',
      isActive: true,
      variables: ['otp'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_login_otp',
      slug: 'login-otp',
      name: '2FA Login OTP',
      subject: '[SECURE AUTH] Two-factor login code',
      htmlBody: '<html><body><h1>Two-Factor Login Code</h1><p>Use the following verification code to sign in:</p><h2 style="font-size: 28px; letter-spacing: 5px; color: #12335f; font-family: monospace;">{{otp}}</h2><p>This code is valid for 10 minutes.</p></body></html>',
      textBody: 'Two-Factor Login Code: Use the following verification code to sign in: {{otp}}. This code is valid for 10 minutes.',
      isActive: true,
      variables: ['otp'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_common_otp',
      slug: 'common-otp',
      name: 'Common Verification OTP',
      subject: '[JsgSmile Portal] Secure Verification',
      htmlBody: '<html><body><h1>Secure Verification</h1><p>Use the following verification code to continue:</p><h2 style="font-size: 28px; letter-spacing: 5px; color: #12335f; font-family: monospace;">{{otp}}</h2><p>This code is valid for 10 minutes.</p></body></html>',
      textBody: 'Secure Verification: Use the following verification code to continue: {{otp}}. This code is valid for 10 minutes.',
      isActive: true,
      variables: ['otp'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_user_registration',
      slug: 'user-registration',
      name: 'User registration',
      subject: 'Welcome to {{portalName}}!',
      htmlBody: '<html><body><h1>Welcome to {{portalName}}, {{userName}}!</h1><p>Your account has been created successfully.</p><p><a href="{{loginUrl}}">Log in here</a></p></body></html>',
      textBody: 'Welcome to {{portalName}}, {{userName}}! Your account has been created successfully. Log in here: {{loginUrl}}',
      isActive: true,
      variables: ['userName', 'userEmail', 'portalName', 'loginUrl'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_organization_approval',
      slug: 'organization-approval',
      name: 'Organization approval',
      subject: 'Your organization on {{portalName}} has been approved',
      htmlBody: '<html><body><h1>Hello {{userName}}!</h1><p>Your organization <strong>{{organizationName}}</strong> has been approved for access on {{portalName}}.</p></body></html>',
      textBody: 'Hello {{userName}}! Your organization {{organizationName}} has been approved for access on {{portalName}}.',
      isActive: true,
      variables: ['userName', 'organizationName', 'portalName'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_bid_published',
      slug: 'bid-published',
      name: 'Bid published',
      subject: 'New Tender/RFQ published: {{tenderTitle}}',
      htmlBody: '<html><body><h1>A new requirement has been published</h1><p>Title: {{tenderTitle}}</p><p>Estimated Value: {{amount}} {{currency}}</p><p>Due Date: {{dueDate}}</p><p><a href="{{actionUrl}}">View Details</a></p></body></html>',
      textBody: 'A new requirement has been published: {{tenderTitle}}. Estimated Value: {{amount}} {{currency}}. Due Date: {{dueDate}}.',
      isActive: true,
      variables: ['tenderTitle', 'amount', 'currency', 'dueDate', 'actionUrl'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_seller_participated',
      slug: 'seller-participated',
      name: 'Seller participated',
      subject: 'Bid submitted successfully for {{tenderTitle}}',
      htmlBody: '<html><body><h1>Thank you for participating!</h1><p>Your bid (Ref: {{bidReference}}) for tender/RFQ <strong>{{tenderTitle}}</strong> has been submitted successfully.</p></body></html>',
      textBody: 'Thank you for participating! Your bid (Ref: {{bidReference}}) for tender/RFQ {{tenderTitle}} has been submitted successfully.',
      isActive: true,
      variables: ['tenderTitle', 'bidReference'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_technical_clarification',
      slug: 'technical-clarification',
      name: 'Technical clarification',
      subject: 'Action Required: Technical Clarification for {{tenderTitle}}',
      htmlBody: '<html><body><h1>Technical clarification request</h1><p>The procurement officer has requested clarification regarding your bid for <strong>{{tenderTitle}}</strong>.</p><p><a href="{{actionUrl}}">Respond to request</a></p></body></html>',
      textBody: 'Technical clarification request: The procurement officer has requested clarification regarding your bid for {{tenderTitle}}. Respond here: {{actionUrl}}',
      isActive: true,
      variables: ['tenderTitle', 'actionUrl'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_bid_awarded',
      slug: 'bid-awarded',
      name: 'Bid awarded',
      subject: 'Congratulations! Bid awarded for {{tenderTitle}}',
      htmlBody: '<html><body><h1>Bid Award Notification</h1><p>We are pleased to inform you that your bid for <strong>{{tenderTitle}}</strong> has been awarded to your organization.</p><p>Award Amount: {{amount}} {{currency}}</p></body></html>',
      textBody: 'Congratulations! Your bid for {{tenderTitle}} has been awarded. Award Amount: {{amount}} {{currency}}.',
      isActive: true,
      variables: ['tenderTitle', 'amount', 'currency'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_po_generated',
      slug: 'po-generated',
      name: 'PO generated',
      subject: 'Purchase Order Generated: {{orderNumber}}',
      htmlBody: '<html><body><h1>Purchase Order Issued</h1><p>Purchase Order <strong>{{orderNumber}}</strong> has been generated for your award.</p><p>Total Value: {{amount}} {{currency}}</p><p><a href="{{actionUrl}}">View Purchase Order</a></p></body></html>',
      textBody: 'Purchase Order Issued: Purchase Order {{orderNumber}} has been generated. Total Value: {{amount}} {{currency}}.',
      isActive: true,
      variables: ['orderNumber', 'amount', 'currency', 'actionUrl'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_payment_initiated',
      slug: 'payment-initiated',
      name: 'Payment initiated',
      subject: 'Payment Initiated: {{amount}} {{currency}}',
      htmlBody: '<html><body><h1>Payment Processing</h1><p>A payment of <strong>{{amount}} {{currency}}</strong> has been initiated against invoice <strong>{{invoiceNumber}}</strong>.</p></body></html>',
      textBody: 'Payment Processing: A payment of {{amount}} {{currency}} has been initiated against invoice {{invoiceNumber}}.',
      isActive: true,
      variables: ['amount', 'currency', 'invoiceNumber'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'default_settlement_completed',
      slug: 'settlement-completed',
      name: 'Settlement completed',
      subject: 'Payment Settled Successfully',
      htmlBody: '<html><body><h1>Settlement Complete</h1><p>The payment of <strong>{{amount}} {{currency}}</strong> has been successfully settled and deposited into your account.</p></body></html>',
      textBody: 'Payment Settled: The payment of {{amount}} {{currency}} has been successfully settled.',
      isActive: true,
      variables: ['amount', 'currency'],
      createdAt: now,
      updatedAt: now
    }
  ];
};

const getOrInitializeTemplates = async () => {
  try {
    const stored = await (prisma as any).globalSetting.findUnique({
      where: { key: 'email-templates' }
    }).catch(() => null);
    if (stored && Array.isArray(stored.value) && stored.value.length > 0) {
      return stored.value as EmailTemplate[];
    }
    const defaults = buildDefaultTemplates();
    await (prisma as any).globalSetting.upsert({
      where: { key: 'email-templates' },
      update: { value: defaults as any },
      create: { key: 'email-templates', value: defaults as any }
    }).catch((err: any) => {
      console.warn('Failed to persist default email templates in GlobalSetting:', err);
    });
    return defaults;
  } catch (err) {
    console.warn('Error retrieving email templates from GlobalSetting, using defaults:', err);
    return buildDefaultTemplates();
  }
};

router.get('/master-admin/email-templates', ...masterOnly, wrap(async (req, res) => {
  const templates = await getOrInitializeTemplates();
  jsonOk(res, { templates, availableVariables: DEFAULT_TEMPLATE_VARIABLES });
}));

router.post('/master-admin/companies/:companyId/email-templates', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), wrap(async (req, res) => {
  const companyId = Number(req.params.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) return jsonError(res, 400, 'Invalid company ID.', 'VALIDATION_ERROR');
  const company = await (prisma as any).company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return jsonError(res, 404, 'Company not found.', 'NOT_FOUND');
  const reason = ensureReason(res, req.body, 'create email template');
  if (!reason) return;
  const name = textOrNull(req.body?.name);
  const subject = textOrNull(req.body?.subject);
  const htmlBody = textOrNull(req.body?.htmlBody);
  if (!name) return jsonError(res, 400, 'Template name is required.', 'VALIDATION_ERROR');
  if (!subject) return jsonError(res, 400, 'Subject line is required.', 'VALIDATION_ERROR');
  if (!htmlBody) return jsonError(res, 400, 'HTML body is required.', 'VALIDATION_ERROR');

  const templates = await getOrInitializeTemplates();
  const slug = textOrNull(req.body?.slug) || slugify(name);
  if (templates.some(t => t.slug === slug)) return jsonError(res, 409, `A template with slug "${slug}" already exists for this company.`, 'DUPLICATE_ERROR');

  const now = new Date().toISOString();
  const newTemplate: EmailTemplate = {
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    slug,
    name,
    subject,
    htmlBody,
    textBody: textOrNull(req.body?.textBody) || undefined,
    isActive: typeof req.body?.isActive === 'boolean' ? req.body.isActive : true,
    variables: Array.isArray(req.body?.variables) ? req.body.variables.filter((v: unknown) => typeof v === 'string') : [],
    createdAt: now,
    updatedAt: now
  };
  templates.push(newTemplate);
  await (prisma as any).companySetting.upsert({
    where: { companyId_key: { companyId, key: 'email-templates' } },
    update: { value: templates },
    create: { companyId, key: 'email-templates', value: templates }
  });
  await createAuditLog(req, { action: 'email.template.create', entityType: 'email_template', entityId: companyId, metadata: { reason, templateId: newTemplate.id, slug, name } });
  jsonOk(res, newTemplate, 'Email template created successfully.', 201);
}));

router.put('/master-admin/companies/:companyId/email-templates/:templateId', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), wrap(async (req, res) => {
  const companyId = Number(req.params.companyId);
  const templateId = req.params.templateId;
  if (!Number.isFinite(companyId) || companyId <= 0) return jsonError(res, 400, 'Invalid company ID.', 'VALIDATION_ERROR');
  if (!templateId) return jsonError(res, 400, 'Template ID is required.', 'VALIDATION_ERROR');
  const company = await (prisma as any).company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return jsonError(res, 404, 'Company not found.', 'NOT_FOUND');
  const reason = ensureReason(res, req.body, 'update email template');
  if (!reason) return;

  const templates = await getOrInitializeTemplates();
  const idx = templates.findIndex(t => t.id === templateId);
  if (idx === -1) return jsonError(res, 404, 'Template not found.', 'NOT_FOUND');

  const existing = templates[idx];
  const name = textOrNull(req.body?.name) || existing.name;
  const slug = textOrNull(req.body?.slug) || existing.slug;
  if (slug !== existing.slug && templates.some((t, i) => i !== idx && t.slug === slug)) {
    return jsonError(res, 409, `A template with slug "${slug}" already exists.`, 'DUPLICATE_ERROR');
  }

  templates[idx] = {
    ...existing,
    name,
    slug,
    subject: textOrNull(req.body?.subject) || existing.subject,
    htmlBody: textOrNull(req.body?.htmlBody) || existing.htmlBody,
    textBody: req.body?.textBody !== undefined ? (textOrNull(req.body.textBody) || undefined) : existing.textBody,
    isActive: typeof req.body?.isActive === 'boolean' ? req.body.isActive : existing.isActive,
    variables: Array.isArray(req.body?.variables) ? req.body.variables.filter((v: unknown) => typeof v === 'string') : existing.variables,
    updatedAt: new Date().toISOString()
  };
  await (prisma as any).companySetting.update({
    where: { companyId_key: { companyId, key: 'email-templates' } },
    data: { value: templates }
  });
  await createAuditLog(req, { action: 'email.template.update', entityType: 'email_template', entityId: companyId, metadata: { reason, templateId, slug, name } });
  jsonOk(res, templates[idx], 'Email template updated successfully.');
}));

router.delete('/master-admin/companies/:companyId/email-templates/:templateId', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), wrap(async (req, res) => {
  const companyId = Number(req.params.companyId);
  const templateId = req.params.templateId;
  if (!Number.isFinite(companyId) || companyId <= 0) return jsonError(res, 400, 'Invalid company ID.', 'VALIDATION_ERROR');
  if (!templateId) return jsonError(res, 400, 'Template ID is required.', 'VALIDATION_ERROR');
  const company = await (prisma as any).company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return jsonError(res, 404, 'Company not found.', 'NOT_FOUND');
  const reason = ensureReason(res, req.body, 'deactivate email template');
  if (!reason) return;

  const templates = await getOrInitializeTemplates();
  const idx = templates.findIndex(t => t.id === templateId);
  if (idx === -1) return jsonError(res, 404, 'Template not found.', 'NOT_FOUND');

  templates[idx] = { ...templates[idx], isActive: false, updatedAt: new Date().toISOString() };
  await (prisma as any).companySetting.update({
    where: { companyId_key: { companyId, key: 'email-templates' } },
    data: { value: templates }
  });
  await createAuditLog(req, { action: 'email.template.deactivate', entityType: 'email_template', entityId: companyId, metadata: { reason, templateId, slug: templates[idx].slug } });
  jsonOk(res, templates[idx], 'Email template deactivated.');
}));

router.get('/master-admin/portal-settings', ...masterOnly, wrap(async (_req, res) => {
  jsonOk(res, {
    company: {
      id: 1,
      name: 'Collectorate Jharsuguda',
      shortName: 'Jharsuguda',
      portalDisplayName: 'Collectorate Jharsuguda Portal',
      logoUrl: '/brand/logo.png',
      contactEmail: 'admin@jharsuguda.gov.in',
      contactPhone: '+91 6645 272101',
      address: 'District Magistrate & Collectorate Office, Jharsuguda',
      district: 'Jharsuguda',
      state: 'Odisha',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
}));

router.put('/master-admin/portal-settings', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), wrap(async (req, res) => {
  const reason = ensureReason(res, req.body, 'update portal settings');
  if (!reason) return;
  const updated = {
    id: 1,
    name: req.body?.name || 'Collectorate Jharsuguda',
    shortName: req.body?.shortName || 'Jharsuguda',
    portalDisplayName: req.body?.portalDisplayName || 'Collectorate Jharsuguda Portal',
    logoUrl: req.body?.logoUrl || '/brand/logo.png',
    contactEmail: req.body?.contactEmail || 'admin@jharsuguda.gov.in',
    contactPhone: req.body?.contactPhone || '+91 6645 272101',
    address: req.body?.address || 'District Magistrate & Collectorate Office, Jharsuguda',
    district: req.body?.district || 'Jharsuguda',
    state: req.body?.state || 'Odisha',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await createAuditLog(req, { action: 'portal.settings.update', entityType: 'portal', entityId: 1, metadata: { reason } });
  jsonOk(res, updated, 'Portal settings updated successfully');
}));

router.get('/master-admin/security-overview', ...masterOnly, wrap(async (_req, res) => {
  const [failedLogins, suspiciousActions, openFraudAlerts, roleChanges, fileAccessEvents, paymentActions] = await Promise.all([
    safeCount((prisma as any).loginEvent, { where: { success: false } }),
    safeCount((prisma as any).fraudAlert, { where: { status: 'OPEN' } }),
    safeCount((prisma as any).fraudAlert, { where: { status: 'OPEN' } }),
    safeCount(prisma.auditLog, { where: { action: { contains: 'role', mode: 'insensitive' } } }),
    safeCount(prisma.auditLog, { where: { OR: [{ entityType: { contains: 'file', mode: 'insensitive' } }, { action: { contains: 'file', mode: 'insensitive' } }] } }),
    safeCount(prisma.auditLog, { where: { OR: [{ entityType: { contains: 'payment', mode: 'insensitive' } }, { action: { contains: 'payment', mode: 'insensitive' } }, { action: { contains: 'settlement', mode: 'insensitive' } }] } })
  ]);
  res.json({
    summary: {
      failedLogins,
      suspiciousActions,
      openFraudAlerts,
      roleChanges,
      fileAccessEvents,
      paymentActions
    },
    controls: {
      cors: 'Explicit production origins required',
      previews: 'Preview wildcard CORS disabled in production',
      secrets: 'Secrets are masked and loaded from deployment environment',
      fileAccess: 'Authenticated signed URL access',
      sealedQuotes: 'Financial quotes restricted until evaluation stage',
      auditLogs: 'Sensitive actions audited'
    }
  });
}));

router.get('/master-admin/reports', ...masterOnly, wrap(async (_req, res) => {
  const [organizations, users, procurementBids, tenders, rfqs, buyerRequirements, purchaseOrders, invoices, payments, products, services, documents, auditLogs] = await Promise.all([
    safeCount(prisma.organization),
    safeCount(prisma.user),
    safeCount((prisma as any).procurementBid),
    safeCount(prisma.tender),
    safeCount(prisma.quoteRequest),
    safeCount((prisma as any).buyerRequirement),
    safeCount((prisma as any).purchaseOrder),
    safeCount(prisma.invoice),
    safeCount((prisma as any).paymentTransaction),
    safeCount((prisma as any).product),
    safeCount((prisma as any).service),
    safeCount((prisma as any).fileAsset),
    safeCount(prisma.auditLog)
  ]);
  jsonOk(res, { organizations, users, procurementBids, tenders, rfqs, buyerRequirements, purchaseOrders, invoices, payments, products, services, documents, auditLogs, generatedAt: new Date().toISOString() });
}));

router.get('/master-admin/reports/export', ...masterOnly, wrap(async (req, res) => {
  const module = searchText(req.query.module || req.query.type).toLowerCase();
  const reason = textOrNull(req.query.reason);
  if (!reason) return jsonError(res, 400, 'Reason is required to export Master Admin data.', 'VALIDATION_ERROR');
  const take = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 5000);
  const status = textOrNull(req.query.status);
  const companyId = numberOrUndefined(req.query.companyId);
  const dateWhere = exportDateWhere(req.query as Record<string, unknown>);
  let rows: Array<Record<string, unknown>> = [];
  const whereWithDate = (extra: Record<string, unknown> = {}) => ({ ...dateWhere, ...extra });

  if (module === 'companies') {
    rows = await (prisma as any).company.findMany({
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, shortName: true, portalDisplayName: true, contactEmail: true, contactPhone: true, district: true, state: true, isActive: true, createdAt: true, updatedAt: true }
    });
  } else if (module === 'organizations') {
    rows = await prisma.organization.findMany({
      where: whereWithDate({ ...(status ? { verificationStatus: status as any } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, organizationName: true, organizationType: true, gstin: true, panNumber: true, udyamNumber: true, verificationStatus: true, isBlacklisted: true, city: true, district: true, state: true, createdAt: true, updatedAt: true, }
    }) as any;
  } else if (module === 'users') {
    rows = await prisma.user.findMany({
      where: whereWithDate({
        accountStatus: status ? (status as any) : { not: 'DELETED' }
      }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, userId: true, name: true, email: true, mobile: true, role: true, onboardingStatus: true, accountStatus: true, emailVerified: true, mobileVerified: true, lastLoginAt: true, createdAt: true, updatedAt: true,  organization: { select: { organizationName: true } } }
    }) as any;
  } else if (module === 'procurement-bids' || module === 'procurement-records') {
    rows = await (prisma as any).procurementBid.findMany({
      where: whereWithDate({ ...(status ? { status: status as any } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, bidNumber: true, title: true, buyerOrganizationName: true, buyerType: true, category: true, bidType: true, estimatedValue: true, deliveryLocation: true, status: true, approvalStatus: true, startDate: true, endDate: true, createdAt: true, updatedAt: true }
    });
  } else if (module === 'tenders') {
    rows = await prisma.tender.findMany({
      where: whereWithDate({ ...(status ? { status: status as any } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, tenderId: true, title: true, category: true, status: true, budget: true, bidsCount: true, publishedAt: true, closesAt: true, createdAt: true, updatedAt: true, organization: { select: { organizationName: true } }, buyer: { select: { name: true, email: true } } }
    }) as any;
  } else if (module === 'rfqs') {
    rows = await prisma.quoteRequest.findMany({
      where: whereWithDate({ ...(status ? { status } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, subject: true, status: true, estimatedValue: true, deadlineDate: true, createdAt: true, updatedAt: true, buyer: { select: { name: true, email: true } }, seller: { select: { name: true, email: true } } }
    }) as any;
  } else if (module === 'buyer-requirements') {
    rows = await (prisma as any).buyerRequirement.findMany({
      where: whereWithDate({ ...(status ? { status: status as any } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, requirementType: true, status: true, location: true, budgetMin: true, budgetMax: true, lastDate: true, isFeatured: true, isUrgent: true, createdAt: true, updatedAt: true,  buyerOrganization: { select: { organizationName: true } } }
    });
  } else if (module === 'orders') {
    rows = await (prisma as any).purchaseOrder.findMany({
      where: whereWithDate({ ...(status ? { status } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, poNumber: true, title: true, amount: true, totalValue: true, currency: true, status: true, sourceType: true, expectedDelivery: true, createdAt: true, updatedAt: true, buyer: { select: { name: true, email: true } }, seller: { select: { name: true, email: true } } }
    });
  } else if (module === 'invoices') {
    rows = await prisma.invoice.findMany({
      where: whereWithDate({ ...(status ? { status } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, invoiceNumber: true, amount: true, currency: true, status: true, invoiceStatus: true, taxableAmount: true, totalTaxAmount: true, tdsAmount: true, approvedAt: true, createdAt: true, updatedAt: true, purchaseOrder: { select: { poNumber: true, title: true } }, buyer: { select: { name: true, email: true } }, seller: { select: { name: true, email: true } } }
    }) as any;
  } else if (module === 'payments') {
    rows = await (prisma as any).paymentTransaction.findMany({
      where: whereWithDate({ ...(status ? { status } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, referenceId: true, gateway: true, method: true, gatewayOrderId: true, gatewayPaymentId: true, amount: true, currency: true, status: true, paymentStatus: true, completedAt: true, paidAt: true, createdAt: true, updatedAt: true, payer: { select: { name: true, email: true } }, payee: { select: { name: true, email: true } } }
    });
  } else if (module === 'products') {
    rows = await (prisma as any).product.findMany({
      where: whereWithDate({ ...(status ? { status: status as any } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, sku: true, hsnCode: true, brand: true, price: true, currency: true, status: true, isMsmeMade: true, createdAt: true, updatedAt: true, seller: { select: { name: true, email: true } }, organization: { select: { organizationName: true } }, category: { select: { name: true } } }
    });
  } else if (module === 'services') {
    rows = await (prisma as any).service.findMany({
      where: whereWithDate({ ...(status ? { status: status as any } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, pricingModel: true, basePrice: true, currency: true, serviceArea: true, status: true, createdAt: true, updatedAt: true, seller: { select: { name: true, email: true } }, organization: { select: { organizationName: true } }, category: { select: { name: true } } }
    });
  } else if (module === 'documents') {
    rows = await (prisma as any).fileAsset.findMany({
      where: whereWithDate({ ...(status ? { status } : {}) }),
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, originalName: true, entityType: true, entityId: true, storageProvider: true, mimeType: true, size: true, status: true, createdAt: true, updatedAt: true, owner: { select: { name: true, email: true } } }
    });
  } else if (module === 'audit-logs') {
    rows = await prisma.auditLog.findMany({
      where: whereWithDate({ ...(status ? { action: { contains: status, mode: 'insensitive' } } : {}) }),
      take,
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, entityType: true, entityId: true, details: true, oldValue: true, newValue: true, ipAddress: true, userAgent: true, createdAt: true, User: { select: { name: true, email: true, role: true } }, }
    }) as any;
  } else {
    return jsonError(res, 400, 'Unsupported export module.', 'VALIDATION_ERROR');
  }

  await createAuditLog(req, { action: 'data.export', entityType: 'master-admin-report', metadata: { module, reason, rows: rows.length, status} });
  const safeModule = module.replace(/[^a-z0-9-]+/g, '-');
  sendCsv(res, `master-admin-${safeModule}-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => flattenRecord(row as Record<string, any>)));
}));

router.get('/master-admin/marketplace/products', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = normalizedEnum(req.query.status);
  const where: any = {
    ...(status ? { status: status as any } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { hsnCode: { contains: q, mode: 'insensitive' } },
        { seller: { name: { contains: q, mode: 'insensitive' } } },
        { organization: { organizationName: { contains: q, mode: 'insensitive' } } },
        { category: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    name: 'name',
    sku: 'sku',
    brand: 'brand',
    price: 'price',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }, { updatedAt: 'desc' });
  const [items, total, summary] = await Promise.all([
    (prisma as any).product.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        name: true,
        sku: true,
        brand: true,
        price: true,
        currency: true,
        status: true,
        isMsmeMade: true,
        updatedAt: true,
        seller: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, organizationName: true } },
        category: { select: { id: true, name: true, type: true } },
        _count: { select: { images: true, cartItems: true, guestCartItems: true } }
      }
    }),
    (prisma as any).product.count({ where }),
    Promise.all([
      safeCount((prisma as any).product),
      safeCount((prisma as any).product, { where: { status: 'ACTIVE' as any } }),
      safeCount((prisma as any).product, { where: { status: 'DRAFT' as any } }),
      safeCount((prisma as any).product, { where: { status: 'ARCHIVED' as any } })
    ])
  ]);
  const [totalProducts, activeProducts, draftProducts, archivedProducts] = summary;
  res.json({ items, total, page, pageSize, summary: { totalProducts, activeProducts, draftProducts, archivedProducts } });
}));

router.get('/master-admin/marketplace/services', ...masterOnly, wrap(async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query as Record<string, unknown>);
  const q = textOrNull(req.query.q) || textOrNull(req.query.search);
  const status = normalizedEnum(req.query.status);
  const where: any = {
    ...(status ? { status: status as any } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { serviceArea: { contains: q, mode: 'insensitive' } },
        { seller: { name: { contains: q, mode: 'insensitive' } } },
        { organization: { organizationName: { contains: q, mode: 'insensitive' } } },
        { category: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const orderBy = sortableOrder(req.query as Record<string, unknown>, {
    name: 'name',
    basePrice: 'basePrice',
    status: 'status',
    serviceArea: 'serviceArea',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }, { updatedAt: 'desc' });
  const [items, total, summary] = await Promise.all([
    (prisma as any).service.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        name: true,
        pricingModel: true,
        basePrice: true,
        currency: true,
        serviceArea: true,
        status: true,
        updatedAt: true,
        seller: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, organizationName: true } },
        category: { select: { id: true, name: true, type: true } },
        _count: { select: { cartItems: true, guestCartItems: true } }
      }
    }),
    (prisma as any).service.count({ where }),
    Promise.all([
      safeCount((prisma as any).service),
      safeCount((prisma as any).service, { where: { status: 'ACTIVE' as any } }),
      safeCount((prisma as any).service, { where: { status: 'DRAFT' as any } }),
      safeCount((prisma as any).service, { where: { status: 'ARCHIVED' as any } })
    ])
  ]);
  const [totalServices, activeServices, draftServices, archivedServices] = summary;
  res.json({ items, total, page, pageSize, summary: { totalServices, activeServices, draftServices, archivedServices } });
}));

const marketplaceStatusAction = (delegateName: 'product' | 'service', entityType: 'marketplace-product' | 'marketplace-service', reasonAction: string) => wrap(async (req, res) => {
  const id = Number(req.params.id);
  const reason = ensureReason(res, req.body, reasonAction);
  if (!reason) return;
  const status = normalizedEnum(req.body?.status);
  if (!status || !allowedMarketplaceStatuses.has(status)) return jsonError(res, 400, 'Invalid marketplace status selected.', 'VALIDATION_ERROR');
  const delegate = (prisma as any)[delegateName];
  const previous = await delegate.findUnique({ where: { id }, select: { id: true, status: true, name: true } });
  if (!previous) return jsonError(res, 404, 'Marketplace listing not found.', 'NOT_FOUND');
  const item = await delegate.update({
    where: { id },
    data: { status: status as any },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      seller: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, organizationName: true } },
      category: { select: { id: true, name: true, type: true } }
    }
  });
  await createAuditLog(req, {
    action: `${entityType}.status.update`,
    entityType,
    entityId: id,
    metadata: { reason, name: previous.name, oldValue: { status: previous.status }, newValue: { status } }
  });
  invalidateByPattern('cache:marketplace:*').catch(() => {});
  jsonOk(res, item, 'Marketplace listing status updated successfully');
});

router.post('/master-admin/marketplace/products/:id/status', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), marketplaceStatusAction('product', 'marketplace-product', 'update marketplace-product status'));
router.post('/master-admin/marketplace/services/:id/status', ...masterOnly, requirePermission(PERMISSIONS.CONTENT_UPDATE), marketplaceStatusAction('service', 'marketplace-service', 'update marketplace-service status'));

router.get('/master-admin/search', ...masterOnly, wrap(async (req, res) => {
  const q = searchText(req.query.q || req.query.search);
  const type = searchText(req.query.type || 'all').toLowerCase();
  const take = searchLimit(req.query.limit);
  if (q.length < 2) return jsonOk(res, { items: [], total: 0, query: q });

  const include = (name: string) => type === 'all' || type === name;
  const searches: Array<Promise<any[]>> = [];

  if (include('companies')) searches.push(safeFindMany((prisma as any).company, {
    where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { portalDisplayName: { contains: q, mode: 'insensitive' } }, { district: { contains: q, mode: 'insensitive' } }, { state: { contains: q, mode: 'insensitive' } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, portalDisplayName: true, district: true, state: true, isActive: true, updatedAt: true }
  }).then(rows => rows.map((row: any) => searchItem('company', row, row.portalDisplayName || row.name, [row.district, row.state].filter(Boolean).join(', '), `/master-admin/companies`, row.isActive ? 'ACTIVE' : 'INACTIVE'))));

  if (include('users')) searches.push(safeFindMany(prisma.user, {
    where: {
      accountStatus: { not: 'DELETED' },
      OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { mobile: { contains: q, mode: 'insensitive' } }, { userId: { contains: q, mode: 'insensitive' } }]
    },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, accountStatus: true, updatedAt: true,  organization: { select: { organizationName: true } } }
  }).then(rows => rows.map((row: any) => searchItem('user', row, row.name, `${row.email || 'No email'}${row.organization?.organizationName ? ` - ${row.organization.organizationName}` : ''}`, `/master-admin/users`, `${row.role}:${row.accountStatus}`))));

  if (include('organizations')) searches.push(safeFindMany(prisma.organization, {
    where: { OR: [{ organizationName: { contains: q, mode: 'insensitive' } }, { gstin: { contains: q, mode: 'insensitive' } }, { panNumber: { contains: q, mode: 'insensitive' } }, { udyamNumber: { contains: q, mode: 'insensitive' } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, organizationName: true, organizationType: true, verificationStatus: true, updatedAt: true, }
  }).then(rows => rows.map((row: any) => searchItem('organization', row, row.organizationName, row.organizationType, `/master-admin/organizations`, row.verificationStatus))));

  if (include('tenders')) searches.push(safeFindMany(prisma.tender, {
    where: { OR: [{ tenderId: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }, { organization: { organizationName: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, tenderId: true, title: true, status: true, closesAt: true, updatedAt: true, organization: { select: { organizationName: true, } } }
  }).then(rows => rows.map((row: any) => searchItem('tender', { ...row, company: row.organization?.company }, row.title, row.tenderId || row.organization?.organizationName, `/master-admin/procurement`, row.status))));

  if (include('rfqs')) searches.push(safeFindMany(prisma.quoteRequest, {
    where: { OR: [{ subject: { contains: q, mode: 'insensitive' } }, { message: { contains: q, mode: 'insensitive' } }, { buyer: { name: { contains: q, mode: 'insensitive' } } }, { seller: { name: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, subject: true, status: true, deadlineDate: true, updatedAt: true, buyer: { select: { name: true, } }, seller: { select: { name: true } } }
  }).then(rows => rows.map((row: any) => searchItem('rfq', { ...row, company: row.buyer?.company }, row.subject, [row.buyer?.name, row.seller?.name].filter(Boolean).join(' -> '), `/master-admin/procurement`, row.status))));

  if (include('buyer-requirements')) searches.push(safeFindMany((prisma as any).buyerRequirement, {
    where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { location: { contains: q, mode: 'insensitive' } }, { buyerOrganization: { organizationName: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, status: true, requirementType: true, lastDate: true, updatedAt: true,  buyerOrganization: { select: { organizationName: true } } }
  }).then(rows => rows.map((row: any) => searchItem('buyer requirement', row, row.title, row.buyerOrganization?.organizationName || row.requirementType, `/master-admin/procurement`, row.status))));

  if (include('procurement-bids')) searches.push(safeFindMany((prisma as any).procurementBid, {
    where: { OR: [{ bidNumber: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }, { buyerOrganizationName: { contains: q, mode: 'insensitive' } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, bidNumber: true, title: true, status: true, approvalStatus: true, buyerOrganizationName: true, updatedAt: true }
  }).then(rows => rows.map((row: any) => searchItem('procurement bid', row, row.title, row.bidNumber || row.buyerOrganizationName, `/master-admin/procurement`, `${row.status}:${row.approvalStatus}`))));

  if (include('orders')) searches.push(safeFindMany((prisma as any).purchaseOrder, {
    where: { OR: [{ poNumber: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { buyer: { name: { contains: q, mode: 'insensitive' } } }, { seller: { name: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, poNumber: true, title: true, status: true, updatedAt: true, buyer: { select: { name: true, } }, seller: { select: { name: true } } }
  }).then(rows => rows.map((row: any) => searchItem('order', { ...row, company: row.buyer?.company }, row.title || row.poNumber, [row.buyer?.name, row.seller?.name].filter(Boolean).join(' -> '), `/master-admin/orders`, row.status))));

  if (include('invoices')) searches.push(safeFindMany(prisma.invoice, {
    where: { OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { purchaseOrder: { poNumber: { contains: q, mode: 'insensitive' } } }, { buyer: { name: { contains: q, mode: 'insensitive' } } }, { seller: { name: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, invoiceNumber: true, status: true, amount: true, updatedAt: true, purchaseOrder: { select: { poNumber: true } }, buyer: { select: { name: true, } }, seller: { select: { name: true } } }
  }).then(rows => rows.map((row: any) => searchItem('invoice', { ...row, company: row.buyer?.company }, row.invoiceNumber, row.purchaseOrder?.poNumber, `/master-admin/payments`, row.status))));

  if (include('payments')) searches.push(safeFindMany((prisma as any).paymentTransaction, {
    where: { OR: [{ referenceId: { contains: q, mode: 'insensitive' } }, { providerPaymentId: { contains: q, mode: 'insensitive' } }, { gatewayOrderId: { contains: q, mode: 'insensitive' } }, { payer: { name: { contains: q, mode: 'insensitive' } } }, { payee: { name: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, referenceId: true, status: true, amount: true, updatedAt: true, payer: { select: { name: true, } }, payee: { select: { name: true } } }
  }).then(rows => rows.map((row: any) => searchItem('payment', { ...row, company: row.payer?.company }, row.referenceId, [row.payer?.name, row.payee?.name].filter(Boolean).join(' -> '), `/master-admin/payments`, row.status))));

  if (include('products')) searches.push(safeFindMany((prisma as any).product, {
    where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } }, { seller: { name: { contains: q, mode: 'insensitive' } } }, { organization: { organizationName: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, sku: true, status: true, updatedAt: true, seller: { select: { name: true, } }, organization: { select: { organizationName: true } } }
  }).then(rows => rows.map((row: any) => searchItem('product', { ...row, company: row.seller?.company }, row.name, row.sku || row.organization?.organizationName || row.seller?.name, `/master-admin/marketplace`, row.status))));

  if (include('services')) searches.push(safeFindMany((prisma as any).service, {
    where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { serviceArea: { contains: q, mode: 'insensitive' } }, { seller: { name: { contains: q, mode: 'insensitive' } } }, { organization: { organizationName: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, status: true, serviceArea: true, updatedAt: true, seller: { select: { name: true, } }, organization: { select: { organizationName: true } } }
  }).then(rows => rows.map((row: any) => searchItem('service', { ...row, company: row.seller?.company }, row.name, row.serviceArea || row.organization?.organizationName || row.seller?.name, `/master-admin/marketplace`, row.status))));

  if (include('documents')) searches.push(safeFindMany((prisma as any).fileAsset, {
    where: { OR: [{ originalName: { contains: q, mode: 'insensitive' } }, { entityType: { contains: q, mode: 'insensitive' } }, { mimeType: { contains: q, mode: 'insensitive' } }, { owner: { name: { contains: q, mode: 'insensitive' } } }] },
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, originalName: true, entityType: true, status: true, updatedAt: true, owner: { select: { name: true, } } }
  }).then(rows => rows.map((row: any) => searchItem('document', { ...row, company: row.owner?.company }, row.originalName, row.entityType || row.owner?.name, `/master-admin/organizations`, row.status))));

  const items = (await Promise.all(searches)).flat().sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  jsonOk(res, { items, total: items.length, query: q, type });
}));

router.get('/master-admin/system-health', ...masterOnly, wrap(async (_req, res) => {
  const startedAt = Date.now();
  let database: 'ok' | 'degraded' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'degraded';
  }
  const [failedApiCalls, failedPayments, pendingWebhooks, auditEvents, activeUsers, storageFiles] = await Promise.all([
    safeCount((prisma as any).apiLog, { where: { statusCode: { gte: 500 } } }),
    safeCount((prisma as any).paymentTransaction, { where: { status: { in: ['failed', 'FAILED'] } } }),
    safeCount((prisma as any).paymentWebhookEvent, { where: { processed: false } }),
    safeCount(prisma.auditLog),
    safeCount(prisma.user, { where: { accountStatus: 'ACTIVE' as any } }),
    safeCount((prisma as any).fileAsset, { where: { status: 'active' } })
  ]);
  jsonOk(res, {
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    status: database === 'ok' && failedApiCalls === 0 ? 'ok' : 'degraded',
    checks: {
      frontend: 'available',
      backendApi: 'ok',
      database,
      payments: failedPayments > 0 ? 'attention' : 'ok',
      webhooks: pendingWebhooks > 0 ? 'attention' : 'ok',
      fileStorage: storageFiles > 0 ? 'configured' : 'unknown'
    },
    counts: { failedApiCalls, failedPayments, pendingWebhooks, auditEvents, activeUsers, storageFiles }
  });
}));

router.get('/master-admin/procurement-overview', ...masterOnly, wrap(async (_req, res) => {
  const [totalBids, pendingApprovals, activeBids, technicalEvaluation, financialEvaluation, awardRecommended, cancelled] = await Promise.all([
    safeCount((prisma as any).procurementBid),
    safeCount((prisma as any).procurementBid, { where: { approvalStatus: 'PENDING' } }),
    safeCount((prisma as any).procurementBid, { where: { status: 'OPEN' } }),
    safeCount((prisma as any).procurementBid, { where: { status: 'TECHNICAL_EVALUATION' } }),
    safeCount((prisma as any).procurementBid, { where: { status: 'FINANCIAL_EVALUATION' } }),
    safeCount((prisma as any).procurementBid, { where: { status: 'AWARD_RECOMMENDED' } }),
    safeCount((prisma as any).procurementBid, { where: { status: { in: ['CANCELLED', 'EXPIRED'] } } })
  ]);
  jsonOk(res, { totalBids, pendingApprovals, activeBids, technicalEvaluation, financialEvaluation, awardRecommended, cancelled });
}));

router.get('/master-admin/payment-overview', ...masterOnly, wrap(async (_req, res) => {
  const [totalPayments, failedPayments, pendingSettlements, completedSettlements, pendingWebhooks] = await Promise.all([
    safeCount((prisma as any).paymentTransaction),
    safeCount((prisma as any).paymentTransaction, { where: { status: { in: ['failed', 'FAILED'] } } }),
    safeCount((prisma as any).paymentSettlement, { where: { status: 'PENDING' } }),
    safeCount((prisma as any).paymentSettlement, { where: { status: 'RELEASED' } }),
    safeCount((prisma as any).paymentWebhookEvent, { where: { processed: false } })
  ]);
  jsonOk(res, { totalPayments, failedPayments, pendingSettlements, completedSettlements, pendingWebhooks });
}));

const maskSecret = (value: string, visible = 4) => {
  if (!value) return '';
  if (value.length <= visible * 2) return '*'.repeat(value.length);
  return `${value.slice(0, visible)}${'*'.repeat(Math.min(10, value.length - visible * 2))}${value.slice(-visible)}`;
};

export default router;
