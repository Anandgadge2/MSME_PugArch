import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const db = prisma as any;

/**
 * CVC Circular 01/01/2017 & GFR Rule 173 Compliant L1 Price Negotiation Service
 */
export class NegotiationService {
  private static computeHash(payload: Record<string, any>): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload) + (process.env.ENCRYPTION_SECRET || 'jsg-smile-cvc-negotiation-key'))
      .digest('hex');
  }

  /**
   * Get active or completed negotiations for a Purchase Order
   */
  static async getByPurchaseOrder(purchaseOrderId: number, actor: { id: number; role: string }) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        negotiations: { orderBy: { createdAt: 'desc' } },
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } }
      }
    });

    if (!po) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');

    const isParty = po.buyerId === actor.id || po.sellerId === actor.id;
    const isAdmin = actor.role === 'admin' || actor.role === 'master_admin';
    if (!isParty && !isAdmin) {
      throw new ApiError(403, 'Unauthorized access to negotiation record', 'FORBIDDEN');
    }

    // Auto-check for 72-hour expiry on active negotiation
    const active = po.negotiations.find((n: any) => n.status === 'REQUESTED');
    if (active && new Date() > new Date(active.deadlineAt)) {
      await db.procurementNegotiation.update({
        where: { id: active.id },
        data: { status: 'EXPIRED', completedAt: new Date() }
      });
      active.status = 'EXPIRED';
    }

    return {
      purchaseOrder: {
        id: po.id,
        poNumber: po.poNumber,
        currentAmount: Number(po.amount || po.totalValue || 0)
      },
      negotiations: po.negotiations
    };
  }

  /**
   * Initiate CVC-Compliant L1 Price Negotiation (Buyer Action)
   */
  static async initiate(
    purchaseOrderId: number,
    actor: { id: number; role: string },
    data: { targetAmount: number; buyerJustification: string }
  ) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { negotiations: true }
    });

    if (!po) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');

    const isBuyer = po.buyerId === actor.id;
    const isAdmin = actor.role === 'admin' || actor.role === 'master_admin';
    if (!isBuyer && !isAdmin) {
      throw new ApiError(403, 'Only the buyer or administrative authority can initiate price negotiation', 'FORBIDDEN');
    }

    const currentAmount = Number(po.amount || po.totalValue || 0);
    if (data.targetAmount >= currentAmount) {
      throw new ApiError(400, 'Target negotiation amount must be lower than the current contract amount', 'INVALID_TARGET');
    }

    // CVC Rule: Check if a negotiation is already open
    const openNegotiation = po.negotiations.find((n: any) => n.status === 'REQUESTED');
    if (openNegotiation) {
      throw new ApiError(409, 'An active L1 negotiation is already in progress with this seller', 'ACTIVE_NEGOTIATION_EXISTS');
    }

    // GFR / CVC Statutory 72-Hour Timer
    const deadlineAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const payloadToHash = {
      purchaseOrderId,
      buyerId: po.buyerId,
      sellerId: po.sellerId,
      originalAmount: currentAmount,
      targetAmount: data.targetAmount,
      timestamp: new Date().toISOString()
    };
    const integrityHash = this.computeHash(payloadToHash);

    const negotiation = await db.procurementNegotiation.create({
      data: {
        purchaseOrderId,
        buyerId: po.buyerId,
        sellerId: po.sellerId,
        originalAmount: currentAmount,
        targetAmount: data.targetAmount,
        roundNumber: 1, // Single round per CVC guidelines
        status: 'REQUESTED',
        buyerJustification: data.buyerJustification,
        deadlineAt,
        integrityHash
      }
    });

    return negotiation;
  }

  /**
   * Respond to L1 Negotiation (Seller Action: ACCEPT, COUNTER, or REJECT)
   */
  static async respond(
    negotiationId: number,
    actor: { id: number; role: string },
    data: {
      action: 'ACCEPT' | 'COUNTER' | 'REJECT';
      counterAmount?: number;
      sellerRemarks?: string;
    }
  ) {
    const neg = await db.procurementNegotiation.findUnique({
      where: { id: negotiationId },
      include: { purchaseOrder: true }
    });

    if (!neg) throw new ApiError(404, 'Negotiation record not found', 'NOT_FOUND');

    if (neg.sellerId !== actor.id && actor.role !== 'admin' && actor.role !== 'master_admin') {
      throw new ApiError(403, 'Only the designated L1 seller can respond to price negotiations', 'FORBIDDEN');
    }

    if (neg.status !== 'REQUESTED') {
      throw new ApiError(400, `Cannot respond to negotiation in '${neg.status}' status`, 'INVALID_STATUS');
    }

    // Check if 72-hour timer has expired
    if (new Date() > new Date(neg.deadlineAt)) {
      await db.procurementNegotiation.update({
        where: { id: negotiationId },
        data: { status: 'EXPIRED', completedAt: new Date() }
      });
      throw new ApiError(410, 'Statutory 72-hour CVC negotiation deadline has expired', 'NEGOTIATION_EXPIRED');
    }

    if (data.action === 'ACCEPT') {
      const finalAmount = Number(neg.targetAmount);
      const updated = await db.procurementNegotiation.update({
        where: { id: negotiationId },
        data: {
          status: 'ACCEPTED_BY_SELLER',
          finalAgreedAmount: finalAmount,
          sellerRemarks: data.sellerRemarks || 'Accepted buyer target price',
          completedAt: new Date()
        }
      });

      // Update Purchase Order amount to negotiated rate
      if (neg.purchaseOrderId) {
        await db.purchaseOrder.update({
          where: { id: neg.purchaseOrderId },
          data: {
            amount: finalAmount,
            totalValue: finalAmount
          }
        });
      }

      return updated;
    }

    if (data.action === 'COUNTER') {
      if (!data.counterAmount || data.counterAmount <= Number(neg.targetAmount) || data.counterAmount >= Number(neg.originalAmount)) {
        throw new ApiError(400, 'Counter offer must be between target price and original price', 'INVALID_COUNTER');
      }

      const updated = await db.procurementNegotiation.update({
        where: { id: negotiationId },
        data: {
          status: 'COUNTERED_BY_SELLER',
          sellerCounterAmount: data.counterAmount,
          sellerRemarks: data.sellerRemarks || 'Seller submitted counter-offer'
        }
      });
      return updated;
    }

    // REJECT / DECLINE
    const updated = await db.procurementNegotiation.update({
      where: { id: negotiationId },
      data: {
        status: 'REJECTED_BY_SELLER',
        finalAgreedAmount: neg.originalAmount,
        sellerRemarks: data.sellerRemarks || 'Seller declined discount and stands by original bid',
        completedAt: new Date()
      }
    });

    return updated;
  }

  /**
   * Buyer decides on Seller's Counter-Offer
   */
  static async decideCounter(
    negotiationId: number,
    actor: { id: number; role: string },
    data: { accept: boolean; remarks?: string }
  ) {
    const neg = await db.procurementNegotiation.findUnique({
      where: { id: negotiationId },
      include: { purchaseOrder: true }
    });

    if (!neg) throw new ApiError(404, 'Negotiation not found', 'NOT_FOUND');

    const isBuyer = neg.buyerId === actor.id;
    const isAdmin = actor.role === 'admin' || actor.role === 'master_admin';
    if (!isBuyer && !isAdmin) {
      throw new ApiError(403, 'Only the buyer can accept or decline counter-offers', 'FORBIDDEN');
    }

    if (neg.status !== 'COUNTERED_BY_SELLER') {
      throw new ApiError(400, 'No pending counter-offer to decide upon', 'INVALID_STATUS');
    }

    const finalAmount = data.accept ? Number(neg.sellerCounterAmount) : Number(neg.originalAmount);
    const updated = await db.procurementNegotiation.update({
      where: { id: negotiationId },
      data: {
        status: data.accept ? 'ACCEPTED_BY_SELLER' : 'REJECTED_BY_SELLER',
        finalAgreedAmount: finalAmount,
        completedAt: new Date()
      }
    });

    if (data.accept && neg.purchaseOrderId) {
      await db.purchaseOrder.update({
        where: { id: neg.purchaseOrderId },
        data: {
          amount: finalAmount,
          totalValue: finalAmount
        }
      });
    }

    return updated;
  }
}
