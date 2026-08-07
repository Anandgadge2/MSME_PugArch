import { Router, Response } from 'express';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';
import db from '../lib/prisma.js';
import { apiResponse } from '../utils/apiResponse.js';

const router = Router();

// In-memory fallback map if DB model queries encounter engine locks
const inMemoryEmdPayments = new Map<string, any>();

const getEmdKey = (sellerId: number, reqId?: number | string | null, bidId?: number | string | null) => {
  return `${sellerId}:${reqId || ''}:${bidId || ''}`;
};

const parsePacket = (value: any) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return {};
};

const bidTokenVariants = (token: string) => Array.from(new Set([
  token,
  token.replace(/^RFQ-/, 'REQ-'),
  token.replace(/^REQ-/, 'RFQ-')
].filter(Boolean)));

const findProcurementBidForEmd = async (token?: string | number | null) => {
  const bidToken = String(token || '').trim();
  if (!bidToken) return null;
  return (db as any).procurementBid.findFirst({
    where: {
      OR: [
        ...bidTokenVariants(bidToken).map(t => ({ bidNumber: t })),
        ...(/^\d+$/.test(bidToken) ? [{ id: Number(bidToken) }] : [])
      ]
    },
    select: { id: true, bidNumber: true, isEmdRequired: true, emdAmount: true, endDate: true, technicalPacket: true }
  }).catch(() => null);
};

const resolveLinkedRequirementId = (bidRecord: any) => {
  const packet = parsePacket(bidRecord?.technicalPacket);
  return numId(packet.sourceRequirementId || packet.requirementId || packet.linkedRequirementId);
};

export const resolveEmdPaymentStatus = async (sellerId: number, reqId?: number | null, bidIdOrNumber?: string | number | null) => {
  try {
    let payment: any = null;
    const or: any[] = [];
    if (reqId) {
      or.push({ requirementId: Number(reqId) });
    }

    if (bidIdOrNumber) {
      const bidStr = String(bidIdOrNumber).trim();
      const numBid = /^\d+$/.test(bidStr) ? Number(bidStr) : null;
      if (numBid) or.push({ bidId: numBid });
      const bidRecord = await findProcurementBidForEmd(bidStr);
      if (bidRecord?.id) or.push({ bidId: bidRecord.id });
      const linkedReqId = resolveLinkedRequirementId(bidRecord);
      if (linkedReqId) or.push({ requirementId: linkedReqId });
      or.push({ transactionId: { contains: bidStr } });
    }

    if (or.length) {
      payment = await (db as any).emdPayment.findFirst({
        where: { sellerId, OR: or },
        orderBy: { paidAt: 'desc' }
      }).catch(() => null);
    }

    if (!payment) {
      // Check in-memory store
      const keys = Array.from(inMemoryEmdPayments.keys());
      const keyMatch = keys.find(k => k.startsWith(`${sellerId}:`) && (k.includes(`:${reqId}:`) || (bidIdOrNumber && k.includes(`:${bidIdOrNumber}`))));
      if (keyMatch) {
        payment = inMemoryEmdPayments.get(keyMatch);
      }
    }

    return payment;
  } catch {
    return null;
  }
};

function numId(val: any): number | null {
  const n = Number(val);
  return !isNaN(n) && n > 0 ? n : null;
}

// GET /api/emd/status
router.get('/emd/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = Number(req.user?.id);
    const requirementIdParam = req.query.requirementId || req.query.id;
    const requestIdParam = req.query.requestId || req.query.bidId;

    const reqId = numId(requirementIdParam);
    const bidToken = String(requestIdParam || '').trim();

    // Look up procurement item details
    let isEmdRequired = false;
    let emdAmount = 0;
    let paymentMethod = 'Online / Net Banking / UPI';
    let refundPolicy = 'Refundable after technical evaluation & contract award';
    let instructions = 'Pay EMD via Online Gateway or Bank Transfer. Keep reference ID for verification.';
    let paymentDeadline: string | null = null;
    let resolvedReqId = reqId;
    let resolvedBidId: number | null = null;

    // Query buyer requirement or procurement bid
    let reqRecord: any = null;
    if (reqId) {
      reqRecord = await (db as any).buyerRequirement.findUnique({
        where: { id: reqId },
        select: { id: true, lastDate: true, payload: true, isEmdRequired: true, emdAmount: true }
      }).catch(() => null);

      if (reqRecord) {
        const payload: any = reqRecord.payload || {};
        const terms = payload.terms || {};
        isEmdRequired = Boolean(reqRecord.isEmdRequired || terms.emdRequired || (reqRecord.emdAmount && Number(reqRecord.emdAmount) > 0));
        emdAmount = Number(reqRecord.emdAmount || terms.emdAmount || 0);
        if (terms.emdPaymentMethod) paymentMethod = terms.emdPaymentMethod;
        if (terms.emdRefundPolicy) refundPolicy = terms.emdRefundPolicy;
        if (terms.emdInstructions) instructions = terms.emdInstructions;
        paymentDeadline = reqRecord.lastDate ? new Date(reqRecord.lastDate).toISOString() : null;
      }
    }

    if (bidToken || (reqId && !reqRecord)) {
      const bidRecord: any = await findProcurementBidForEmd(bidToken || reqId);

      if (bidRecord) {
        resolvedBidId = bidRecord.id;
        const linkedReqId = resolveLinkedRequirementId(bidRecord);
        if (linkedReqId && (!resolvedReqId || !reqRecord)) resolvedReqId = linkedReqId;
        const pkt: any = parsePacket(bidRecord.technicalPacket);
        const terms = pkt.terms || {};
        isEmdRequired = Boolean(bidRecord.isEmdRequired || terms.emdRequired || (bidRecord.emdAmount && Number(bidRecord.emdAmount) > 0));
        emdAmount = Number(bidRecord.emdAmount || terms.emdAmount || 50000);
        if (terms.emdPaymentMethod) paymentMethod = terms.emdPaymentMethod;
        if (terms.emdRefundPolicy) refundPolicy = terms.emdRefundPolicy;
        if (terms.emdInstructions) instructions = terms.emdInstructions;
        paymentDeadline = bidRecord.endDate ? new Date(bidRecord.endDate).toISOString() : null;
      }
    }

    // Default seed fallback if not explicitly configured in DB
    if (emdAmount <= 0) {
      emdAmount = 50000;
    }

    // ─── Edge Case 1: MSME / NSIC EMD Exemption (Public Procurement Policy) ───
    // Micro & Small Enterprises with valid Udyam certification are legally exempt
    // from paying EMD under Government Public Procurement Policy for MSEs.
    let isEmdExempt = false;
    let emdExemptionReason: string | null = null;
    try {
      const sellerProfile = await (db as any).sellerProfile.findUnique({
        where: { userId: sellerId },
        select: { isUdyamCertified: true, msmeCategoryEnum: true, msmeCategory: true }
      });
      if (sellerProfile) {
        const category = sellerProfile.msmeCategoryEnum || sellerProfile.msmeCategory || '';
        const isMSE = ['MICRO', 'SMALL'].includes(String(category).toUpperCase());
        if (sellerProfile.isUdyamCertified && isMSE) {
          isEmdExempt = true;
          emdExemptionReason = `MSE EMD Exemption (Public Procurement Policy) — ${String(category).toUpperCase()} Enterprise with valid Udyam Registration`;
        }
      }
    } catch { /* profile lookup failure is non-fatal */ }

    // Check payment record for this seller
    const existingPayment = await resolveEmdPaymentStatus(sellerId, resolvedReqId, bidToken);
    const submittedResponse = resolvedReqId
      ? await (db as any).requirementResponse.findFirst({
        where: {
          sellerUserId: sellerId,
          requirementId: resolvedReqId,
          status: { not: 'DRAFT' }
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, updatedAt: true, status: true }
      }).catch(() => null)
      : null;

    let status = 'PENDING';
    if (!isEmdRequired || isEmdExempt) {
      status = isEmdExempt ? 'EXEMPT' : 'NOT_REQUIRED';
    } else if (existingPayment) {
      status = String(existingPayment.status || 'PAID').toUpperCase();
    } else if (submittedResponse) {
      status = 'VERIFIED';
    }

    const syntheticCompletedPayment = submittedResponse ? {
      transactionId: `EMD-COMPLETED-RFQ-${submittedResponse.id}`,
      paidAt: submittedResponse.updatedAt || submittedResponse.createdAt,
      amount: emdAmount,
      paymentMethod,
      status: 'VERIFIED'
    } : null;

    return apiResponse.success(res, {
      isEmdRequired: isEmdExempt ? false : isEmdRequired,
      isEmdExempt,
      emdExemptionReason,
      emdAmount,
      paymentMethod,
      paymentDeadline,
      refundPolicy,
      instructions,
      status,
      payment: existingPayment ? {
        transactionId: existingPayment.transactionId,
        paidAt: existingPayment.paidAt || existingPayment.createdAt,
        amount: Number(existingPayment.amount || emdAmount),
        paymentMethod: existingPayment.paymentMethod || paymentMethod,
        status: existingPayment.status || 'PAID'
      } : syntheticCompletedPayment,
      completed: ['PAID', 'VERIFIED', 'EXEMPT'].includes(status),
      resolvedRequirementId: resolvedReqId,
      resolvedBidId
    });
  } catch (err: any) {
    console.error('[EMD Status Error]', err);
    return apiResponse.error(res, 500, err?.message || 'Failed to fetch EMD status', 'EMD_STATUS_ERROR');
  }
});

// POST /api/emd/pay
router.post('/emd/pay', authenticate, authorize('seller'), async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = Number(req.user?.id);
    const sellerOrgId = req.user?.organizationId ? Number(req.user.organizationId) : null;
    const { requirementId, requestId, bidId, paymentMethod = 'ONLINE', amount } = req.body;

    const reqId = numId(requirementId);
    const bidToken = String(requestId || bidId || '').trim();

    // Determine EMD Amount
    let targetAmount = Number(amount || 0);
    let resolvedReqId = reqId;
    let resolvedBidId: number | null = null;

    if (reqId) {
      const reqRecord: any = await (db as any).buyerRequirement.findUnique({
        where: { id: reqId },
        select: { id: true, payload: true, emdAmount: true }
      }).catch(() => null);

      if (reqRecord && !targetAmount) {
        const payload: any = reqRecord.payload || {};
        targetAmount = Number(reqRecord.emdAmount || payload.terms?.emdAmount || 0);
      }
    }

    if (bidToken) {
      const bidRecord: any = await findProcurementBidForEmd(bidToken);

      if (bidRecord) {
        resolvedBidId = bidRecord.id;
        const linkedReqId = resolveLinkedRequirementId(bidRecord);
        if (linkedReqId && !resolvedReqId) resolvedReqId = linkedReqId;
        if (!targetAmount) {
          const pkt: any = parsePacket(bidRecord.technicalPacket);
          targetAmount = Number(bidRecord.emdAmount || pkt.terms?.emdAmount || 50000);
        }
      }
    }

    if (targetAmount <= 0) targetAmount = 50000;

    const transactionId = `EMD-TXN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    let paymentRecord: any = null;
    try {
      paymentRecord = await (db as any).emdPayment.create({
        data: {
          sellerId,
          sellerOrgId,
          requirementId: resolvedReqId,
          bidId: resolvedBidId,
          amount: targetAmount,
          paymentMethod,
          transactionId,
          status: 'PAID',
          paidAt: new Date()
        }
      });
    } catch {
      // In-memory fallback
      paymentRecord = {
        id: Date.now(),
        sellerId,
        sellerOrgId,
        requirementId: resolvedReqId,
        bidId: resolvedBidId,
        amount: targetAmount,
        paymentMethod,
        transactionId,
        status: 'PAID',
        paidAt: new Date().toISOString()
      };
      const mapKey = getEmdKey(sellerId, resolvedReqId, bidToken);
      inMemoryEmdPayments.set(mapKey, paymentRecord);
    }

    // Best-effort notification
    try {
      const { notificationService } = await import('../services/notification.service.js');
      await notificationService.notifyNow(sellerId, {
        title: 'EMD Payment Successful',
        message: `Earnest Money Deposit of ₹${targetAmount.toLocaleString('en-IN')} has been paid successfully. Transaction ID: ${transactionId}`,
        type: 'emd_payment_success',
        priority: 'high',
        redirectUrl: `/seller/rfq?${resolvedReqId ? `requirementId=${resolvedReqId}` : `requestId=${bidToken}`}`
      });
    } catch {
      // Ignore notification failures
    }

    return apiResponse.success(res, {
      success: true,
      payment: {
        transactionId,
        status: 'PAID',
        amount: targetAmount,
        paymentMethod,
        paidAt: paymentRecord.paidAt || new Date().toISOString()
      }
    }, 201, 'EMD payment completed successfully');
  } catch (err: any) {
    console.error('[EMD Payment Error]', err);
    return apiResponse.error(res, 500, err?.message || 'Failed to process EMD payment', 'EMD_PAYMENT_ERROR');
  }
});

export default router;
