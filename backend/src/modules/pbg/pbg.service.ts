import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const db = prisma as any;

/**
 * GFR 2017 Rule 171 - Performance Bank Guarantee & MSME Retention Service
 */
export class PbgService {
  /**
   * Helper to calculate SHA-256 integrity hash for CAG audit-proof non-repudiation
   */
  private static computeHash(payload: Record<string, any>): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload) + (process.env.ENCRYPTION_SECRET || 'jsg-smile-cag-audit-key'))
      .digest('hex');
  }

  /**
   * Fetch PBG record for a given Purchase Order
   */
  static async getByPurchaseOrder(purchaseOrderId: number, actor: { id: number; role: string }) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        performanceGuarantee: true,
        seller: { select: { id: true, name: true, organizationId: true } },
        buyer: { select: { id: true, name: true, organizationId: true } }
      }
    });

    if (!po) {
      throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
    }

    // Role-based scoping check
    const isOwner = po.buyerId === actor.id || po.sellerId === actor.id;
    const isAdmin = actor.role === 'admin' || actor.role === 'master_admin';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Unauthorized access to purchase order PBG particulars', 'FORBIDDEN');
    }

    return {
      purchaseOrder: {
        id: po.id,
        poNumber: po.poNumber,
        amount: Number(po.amount || po.totalValue || 0),
        pbgRequired: po.pbgRequired,
        pbgPercentage: Number(po.pbgPercentage || (po.pbgRequired ? 3 : 0)),
        pbgExemptReason: (po.metadata as any)?.pbgExemptReason || (!po.pbgRequired ? 'MSE_STATUTORY_WAIVER' : null),
        ldTerms: (po.metadata as any)?.ldTerms || (po.metadata as any)?.penaltyClause || '0.5% per week of delay (max 10%)',
        pbgType: po.pbgType
      },
      performanceGuarantee: po.performanceGuarantee || null
    };
  }

  /**
   * Submit PBG or select 5% MSME Retention Money option (Seller Action)
   */
  static async submitPbg(
    purchaseOrderId: number,
    actor: { id: number; role: string },
    data: {
      type: 'BANK_GUARANTEE' | 'FDR_PLEDGE' | 'RETENTION_DEDUCTION' | 'INSURANCE_BOND';
      amount?: number;
      percentage?: number;
      bankName?: string;
      bgNumber?: string;
      issueDate?: string | Date;
      expiryDate?: string | Date;
      documentFileId?: number;
    }
  ) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId }
    });

    if (!po) {
      throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
    }

    if (po.sellerId !== actor.id && actor.role !== 'admin' && actor.role !== 'master_admin') {
      throw new ApiError(403, 'Only the awarded seller can submit performance security', 'SELLER_ONLY');
    }

    const poValue = Number(po.amount || po.totalValue || 0);
    const pbgPercentage = data.percentage ?? Number(po.pbgPercentage || 3.0);
    const calculatedAmount = data.amount ?? Math.round((poValue * pbgPercentage) / 100 * 100) / 100;

    let claimExpiryDate: Date | null = null;
    let expDate: Date | null = null;

    if (data.type !== 'RETENTION_DEDUCTION') {
      if (!data.expiryDate) {
        throw new ApiError(400, 'Expiry date is mandatory for Bank Guarantee / FDR under GFR Rule 171', 'EXPIRY_REQUIRED');
      }
      expDate = new Date(data.expiryDate);
      // GFR 171 Mandate: Claim expiry must be at least 60 calendar days beyond contract/warranty expiry
      claimExpiryDate = new Date(expDate);
      claimExpiryDate.setDate(claimExpiryDate.getDate() + 60);
    }

    const payloadToHash = {
      purchaseOrderId,
      type: data.type,
      amount: calculatedAmount,
      percentage: pbgPercentage,
      bgNumber: data.bgNumber || null,
      submittedById: actor.id,
      timestamp: new Date().toISOString()
    };
    const integrityHash = this.computeHash(payloadToHash);

    const isRetention = data.type === 'RETENTION_DEDUCTION';
    const status = isRetention ? 'VERIFIED_ACTIVE' : 'SUBMITTED_FOR_VERIFICATION';

    const pbg = await db.performanceGuarantee.upsert({
      where: { purchaseOrderId },
      create: {
        purchaseOrderId,
        sellerId: po.sellerId,
        buyerId: po.buyerId,
        type: data.type,
        amount: calculatedAmount,
        percentage: pbgPercentage,
        bankName: data.bankName || (isRetention ? 'District Escrow (Retention Holdback)' : null),
        bgNumber: data.bgNumber || (isRetention ? `RET-${po.poNumber}` : null),
        issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
        expiryDate: expDate,
        claimExpiryDate,
        documentFileId: data.documentFileId || null,
        status,
        submissionDue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days standard
        submittedById: actor.id,
        integrityHash
      },
      update: {
        type: data.type,
        amount: calculatedAmount,
        percentage: pbgPercentage,
        bankName: data.bankName || (isRetention ? 'District Escrow (Retention Holdback)' : null),
        bgNumber: data.bgNumber || (isRetention ? `RET-${po.poNumber}` : null),
        issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
        expiryDate: expDate,
        claimExpiryDate,
        documentFileId: data.documentFileId || null,
        status,
        submittedById: actor.id,
        integrityHash
      }
    });

    // Update PurchaseOrder status indicator
    await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        pbgRequired: true,
        pbgPercentage,
        pbgType: data.type
      }
    });

    return pbg;
  }

  /**
   * Maker Review (Buyer / Procurement Officer)
   */
  static async makerReview(
    pbgId: number,
    actor: { id: number; role: string },
    data: { approved: boolean; remarks?: string }
  ) {
    const pbg = await db.performanceGuarantee.findUnique({
      where: { id: pbgId },
      include: { purchaseOrder: true }
    });

    if (!pbg) {
      throw new ApiError(404, 'Performance guarantee not found', 'PBG_NOT_FOUND');
    }

    const isBuyer = pbg.buyerId === actor.id || pbg.purchaseOrder?.buyerId === actor.id;
    const isAdmin = actor.role === 'admin' || actor.role === 'master_admin';
    if (!isBuyer && !isAdmin) {
      throw new ApiError(403, 'Only authorized procurement officer can perform maker review', 'FORBIDDEN');
    }

    const updated = await db.performanceGuarantee.update({
      where: { id: pbgId },
      data: {
        makerReviewerId: actor.id,
        makerRemarks: data.remarks || (data.approved ? 'Verified by Procurement Maker' : 'Returned with remarks'),
        status: data.approved ? 'SUBMITTED_FOR_VERIFICATION' : 'PENDING_SUBMISSION'
      }
    });

    return updated;
  }

  /**
   * Checker Approval (Finance Officer / GM DIC with 2FA)
   */
  static async checkerApprove(
    pbgId: number,
    actor: { id: number; role: string },
    data: { approved: boolean; remarks?: string; twoFactorVerified: boolean }
  ) {
    if (!data.twoFactorVerified) {
      throw new ApiError(401, 'Checker dual-authorization requires verified 2FA token', '2FA_REQUIRED');
    }

    const pbg = await db.performanceGuarantee.findUnique({ where: { id: pbgId } });
    if (!pbg) {
      throw new ApiError(404, 'Performance guarantee not found', 'PBG_NOT_FOUND');
    }

    const isAdmin = actor.role === 'admin' || actor.role === 'master_admin';
    if (!isAdmin) {
      throw new ApiError(403, 'Checker approval is restricted to authorized Finance / Admin officers', 'ADMIN_ONLY');
    }

    if (pbg.makerReviewerId && pbg.makerReviewerId === actor.id) {
      throw new ApiError(403, 'Maker-Checker violation: Checker cannot be the same user who initiated Maker review', 'MAKER_CHECKER_VIOLATION');
    }

    const updated = await db.performanceGuarantee.update({
      where: { id: pbgId },
      data: {
        checkerApproverId: actor.id,
        checkerApprovedAt: new Date(),
        checkerRemarks: data.remarks || 'Approved by Finance Checker',
        status: data.approved ? 'VERIFIED_ACTIVE' : 'PENDING_SUBMISSION'
      }
    });

    return updated;
  }

  /**
   * Release PBG / Retention upon successful contract + warranty completion
   */
  static async releasePbg(pbgId: number, actor: { id: number; role: string }, remarks?: string) {
    const pbg = await db.performanceGuarantee.findUnique({ where: { id: pbgId } });
    if (!pbg) throw new ApiError(404, 'Performance guarantee not found', 'PBG_NOT_FOUND');

    const isAdmin = actor.role === 'admin' || actor.role === 'master_admin';
    const isBuyer = pbg.buyerId === actor.id;
    if (!isBuyer && !isAdmin) {
      throw new ApiError(403, 'Unauthorized to release performance security', 'FORBIDDEN');
    }

    const updated = await db.performanceGuarantee.update({
      where: { id: pbgId },
      data: {
        status: 'RELEASED_COMPLETED',
        releasedAt: new Date(),
        checkerRemarks: remarks || 'Discharged and released upon warranty completion'
      }
    });

    return updated;
  }
}
