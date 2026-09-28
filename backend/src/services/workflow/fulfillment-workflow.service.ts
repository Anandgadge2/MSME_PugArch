import { ApiError } from '../../utils/ApiError.js';
import { auditWorkflow, db, notifyWorkflowSoon, numberSeries, roundMoney, type WorkflowActor } from './workflow-common.js';
import { getOrGenerateInvoicePdfBuffer } from '../invoice-pdf.service.js';
import {
  escrowStatusEnumFor,
  invoiceStatusEnumFor,
  paymentStatusEnumFor,
  poStatusEnumFor,
  statusTransitions
} from './status-transition.service.js';

const assertPOAccess = async (actor: WorkflowActor, purchaseOrderId: number) => {
  const po = await db.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { items: true } });
  if (!po) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
  if (actor.role === 'admin' || actor.role === 'master_admin') return po;

  if (actor.role === 'buyer' && Number(po.buyerId) === Number(actor.id)) return po;

  if (actor.role === 'seller' || actor.role === 'shg') {
    if (Number(po.sellerId) === Number(actor.id)) return po;
    const actorUser = await db.user.findUnique({ where: { id: Number(actor.id) }, select: { organizationId: true } });
    const sellerUser = await db.user.findUnique({ where: { id: Number(po.sellerId) }, select: { organizationId: true } });
    if (actorUser?.organizationId && sellerUser?.organizationId && actorUser.organizationId === sellerUser.organizationId) {
      return po;
    }
  }

  throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
};

const taxBreakup = (amount: number, options?: { gstRate?: number; tdsRate?: number; interstate?: boolean; otherTaxRate?: number }) => {
  const gstRate = options?.gstRate ?? 18;
  const tdsRate = options?.tdsRate ?? 0;
  const otherTaxRate = options?.otherTaxRate ?? 0;
  const taxableAmount = roundMoney(amount);
  const gstTaxAmount = roundMoney(taxableAmount * gstRate / 100);
  const otherTaxAmount = roundMoney(taxableAmount * otherTaxRate / 100);
  const totalTaxAmount = roundMoney(gstTaxAmount + otherTaxAmount);
  const tdsAmount = roundMoney(taxableAmount * tdsRate / 100);
  return {
    taxableAmount,
    cgstAmount: options?.interstate ? 0 : roundMoney(gstTaxAmount / 2),
    sgstAmount: options?.interstate ? 0 : roundMoney(gstTaxAmount / 2),
    igstAmount: options?.interstate ? gstTaxAmount : 0,
    totalTaxAmount,
    tdsAmount,
    otherTaxRate,
    otherTaxAmount,
    grossAmount: roundMoney(taxableAmount + totalTaxAmount - tdsAmount)
  };
};

export const fulfillmentWorkflow = {
  async acknowledgePO(actor: WorkflowActor, purchaseOrderId: number) {
    const po = await assertPOAccess(actor, purchaseOrderId);
    if (actor.role !== 'admin' && actor.role !== 'master_admin' && actor.role !== 'seller' && actor.role !== 'shg') throw new ApiError(403, 'Seller access required', 'SELLER_REQUIRED');
    statusTransitions.purchaseOrder(po.status, 'accepted');
    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: 'accepted', poStatus: poStatusEnumFor('accepted') as any, acceptedAt: new Date(), version: { increment: 1 } }
    });
    // Ensure a DeliveryTracking row exists and is marked as SELLER_ACCEPTED so the seller can drive dispatch
    // from the delivery module immediately after acknowledging without needing to re-accept on the delivery page.
    const existingDelivery = await db.deliveryTracking.findFirst({ where: { purchaseOrderId } });
    if (!existingDelivery) {
      await db.deliveryTracking.create({
        data: {
          purchaseOrderId,
          status: 'SELLER_ACCEPTED',
          sellerAcceptedAt: new Date(),
          expectedDelivery: po.expectedDelivery || null
        }
      }).catch(() => undefined);
    } else if (existingDelivery.status === 'CREATED' || existingDelivery.status === 'PENDING_ACCEPTANCE') {
      await db.deliveryTracking.update({
        where: { id: existingDelivery.id },
        data: {
          status: 'SELLER_ACCEPTED',
          sellerAcceptedAt: new Date()
        }
      }).catch(() => undefined);
      await db.deliveryStatusLog.create({
        data: {
          deliveryTrackingId: existingDelivery.id,
          previousStatus: existingDelivery.status,
          newStatus: 'SELLER_ACCEPTED',
          changedById: actor.id,
          actorRole: actor.role,
          remarks: 'PO accepted by seller; delivery moved to SELLER_ACCEPTED'
        }
      }).catch(() => undefined);
    }
    const bidId = po.bidId || (po.metadata && (po.metadata as any).bidId);
    if (bidId && !isNaN(Number(bidId))) {
      await db.procurementBidParticipation.updateMany({
        where: {
          bidId: Number(bidId),
          sellerId: po.sellerId
        },
        data: {
          finalStatus: 'ORDERED'
        }
      }).catch(() => undefined);

      await db.procurementBidParticipation.updateMany({
        where: {
          bidId: Number(bidId),
          sellerId: { not: po.sellerId },
          finalStatus: { notIn: ['ORDERED', 'AWARDED'] }
        },
        data: {
          finalStatus: 'NOT_SELECTED'
        }
      }).catch(() => undefined);

      await db.procurementBid.update({
        where: { id: Number(bidId) },
        data: {
          status: 'IN_PROGRESS',
          lifecycleStage: 'AWARDED'
        }
      }).catch(() => undefined);
    }

    const awardId = (po.metadata && (po.metadata as any).awardId) || (po.sourceType === 'procurement_bid_award' ? po.sourceId : null);
    if (awardId && !isNaN(Number(awardId))) {
      await db.procurementBidAward.update({
        where: { id: Number(awardId) },
        data: { awardStatus: 'ACCEPTED', acceptedAt: new Date() }
      }).catch(() => undefined);
    }
    await auditWorkflow(actor, 'workflow.po.acknowledged', 'purchaseOrder', purchaseOrderId);
    return updated;
  },

  async rejectPO(actor: WorkflowActor, purchaseOrderId: number, reason?: string) {
    const po = await assertPOAccess(actor, purchaseOrderId);
    if (actor.role !== 'admin' && actor.role !== 'master_admin' && actor.role !== 'seller' && actor.role !== 'shg') {
      throw new ApiError(403, 'Seller access required', 'SELLER_REQUIRED');
    }
    statusTransitions.purchaseOrder(po.status, 'rejected');
    const prevMetadata = (po.metadata && typeof po.metadata === 'object') ? (po.metadata as Record<string, unknown>) : {};
    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: 'rejected',
        poStatus: poStatusEnumFor('rejected') as any,
        metadata: {
          ...prevMetadata,
          rejectionReason: reason || null,
          rejectedAt: new Date().toISOString(),
          rejectedBy: actor.id
        },
        version: { increment: 1 }
      }
    });

    const existingDelivery = await db.deliveryTracking.findFirst({ where: { purchaseOrderId } });
    if (existingDelivery && (existingDelivery.status === 'CREATED' || existingDelivery.status === 'PENDING_ACCEPTANCE')) {
      await db.deliveryTracking.update({
        where: { id: existingDelivery.id },
        data: {
          status: 'SELLER_REJECTED',
          sellerRejectedAt: new Date(),
          sellerRejectReason: reason || undefined
        }
      }).catch(() => undefined);
      await db.deliveryStatusLog.create({
        data: {
          deliveryTrackingId: existingDelivery.id,
          previousStatus: existingDelivery.status,
          newStatus: 'SELLER_REJECTED',
          changedById: actor.id,
          actorRole: actor.role,
          remarks: reason || 'Purchase order rejected by seller'
        }
      }).catch(() => undefined);
    }

    await auditWorkflow(actor, 'workflow.po.rejected', 'purchaseOrder', purchaseOrderId, { reason });
    return updated;
  },

  async cancelPO(actor: WorkflowActor, purchaseOrderId: number) {
    const po = await assertPOAccess(actor, purchaseOrderId);
    if (actor.role !== 'admin' && po.buyerId !== actor.id) throw new ApiError(403, 'Buyer access required', 'BUYER_REQUIRED');
    statusTransitions.purchaseOrder(po.status, 'cancelled');
    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: 'cancelled', poStatus: poStatusEnumFor('cancelled') as any, version: { increment: 1 } }
    });
    await auditWorkflow(actor, 'workflow.po.cancelled', 'purchaseOrder', purchaseOrderId);
    return updated;
  },

  async createDelivery(actor: WorkflowActor, purchaseOrderId: number, input: Record<string, unknown>) {
    const po = await assertPOAccess(actor, purchaseOrderId);
    if (actor.role !== 'admin' && po.sellerId !== actor.id) throw new ApiError(403, 'Seller access required', 'SELLER_REQUIRED');
    const delivery = await db.deliveryTracking.create({ data: { ...input, purchaseOrderId, status: 'CREATED' } });
    await db.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: 'in_fulfillment', poStatus: poStatusEnumFor('in_fulfillment'), version: { increment: 1 } } }).catch(() => undefined);
    await auditWorkflow(actor, 'workflow.delivery.created', 'deliveryTracking', delivery.id, { purchaseOrderId });
    return delivery;
  },

  async addDeliveryEvent(actor: WorkflowActor, deliveryTrackingId: number, input: Record<string, unknown>) {
    const delivery = await db.deliveryTracking.findUnique({ where: { id: deliveryTrackingId }, include: { purchaseOrder: true } });
    if (!delivery || (actor.role !== 'admin' && delivery.purchaseOrder.sellerId !== actor.id)) throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    const event = await db.deliveryTrackingEvent.create({ data: { ...input, deliveryTrackingId } });
    await db.deliveryTracking.update({ where: { id: deliveryTrackingId }, data: { status: input.status, currentLocation: input.location } });
    if (input.status === 'DELIVERED') {
      await db.purchaseOrder.update({ where: { id: delivery.purchaseOrderId }, data: { status: 'delivered', poStatus: poStatusEnumFor('delivered'), version: { increment: 1 } } }).catch(() => undefined);
    }
    await auditWorkflow(actor, 'workflow.delivery.event_added', 'deliveryTrackingEvent', event.id);
    return event;
  },

  async createInspection(actor: WorkflowActor, purchaseOrderId: number, input: Record<string, unknown>) {
    const po = await assertPOAccess(actor, purchaseOrderId);
    if (actor.role !== 'admin' && po.buyerId !== actor.id) throw new ApiError(403, 'Buyer access required', 'BUYER_REQUIRED');
    const report = await db.inspectionReport.create({
      data: { ...input, purchaseOrderId, reportNumber: numberSeries('INSP'), status: 'IN_PROGRESS' }
    });
    await auditWorkflow(actor, 'workflow.inspection.created', 'inspectionReport', report.id);
    return report;
  },

  async decideInspection(actor: WorkflowActor, inspectionReportId: number, accepted: boolean, remarks?: string) {
    const report = await db.inspectionReport.findUnique({ where: { id: inspectionReportId }, include: { purchaseOrder: true } });
    if (!report || (actor.role !== 'admin' && report.purchaseOrder.buyerId !== actor.id)) throw new ApiError(404, 'Inspection not found', 'INSPECTION_NOT_FOUND');
    const updated = await db.$transaction(async (tx: any) => {
      const inspection = await tx.inspectionReport.update({ where: { id: inspectionReportId }, data: { status: accepted ? 'ACCEPTED' : 'REJECTED', remarks } });
      if (accepted) {
        await tx.purchaseOrder.update({
          where: { id: report.purchaseOrderId },
          data: { status: 'inspection_accepted', version: { increment: 1 } }
        });
      }
      return inspection;
    });
    await auditWorkflow(actor, accepted ? 'workflow.inspection.accepted' : 'workflow.inspection.rejected', 'inspectionReport', inspectionReportId);
    return updated;
  },

  async createInvoice(actor: WorkflowActor, input: { purchaseOrderId: number; amount?: number; gstRate?: number; tdsRate?: number; interstate?: boolean; otherTaxRate?: number; items?: Array<Record<string, unknown>> }) {
    const po = await assertPOAccess(actor, input.purchaseOrderId);
    if (actor.role !== 'admin' && po.sellerId !== actor.id) throw new ApiError(403, 'Seller access required', 'SELLER_REQUIRED');
    const gstRate = input.gstRate ?? 18;
    const poGross = Number(po.amount || po.totalValue || 0);
    const metaBase = Number(po.metadata?.baseAmount || po.metadata?.taxableAmount || po.metadata?.quotationPricing?.subtotal || 0);

    // Prevent double-taxation:
    // If input.amount is provided and matches the gross PO amount, the caller passed the gross total.
    // In that case, extract the true taxable base (base = gross / (1 + gstRate / 100)).
    let baseAmount: number;
    if (input.amount != null) {
      if (poGross > 0 && Math.abs(input.amount - poGross) < 1 && gstRate > 0) {
        baseAmount = metaBase > 0 ? metaBase : roundMoney(input.amount / (1 + gstRate / 100));
      } else {
        baseAmount = input.amount;
      }
    } else if (metaBase > 0) {
      baseAmount = metaBase;
    } else if (po.items?.length) {
      const rawItemsSum = po.items.reduce((sum: number, item: any) => {
        const qty = Number(item.quantity || 1);
        let uPrice = Number(item.unitPrice || 0);
        if (qty > 1 && (uPrice * qty) > (poGross * 1.2)) {
          uPrice = uPrice / qty;
        }
        return sum + (qty * uPrice);
      }, 0);
      baseAmount = rawItemsSum > 0 && rawItemsSum <= poGross ? roundMoney(rawItemsSum) : roundMoney(poGross / (1 + gstRate / 100));
    } else {
      baseAmount = roundMoney(poGross / (1 + gstRate / 100));
    }
    // Auto-detect interstate if not explicitly specified
    let isInterstate = input.interstate;
    if (isInterstate === undefined) {
      try {
        const [sellerUser, buyerUser] = await Promise.all([
          db.user.findUnique({
            where: { id: po.sellerId },
            select: { registrationDetails: true, organization: { select: { state: true, gstin: true } } }
          }),
          db.user.findUnique({
            where: { id: po.buyerId },
            select: { registrationDetails: true, organization: { select: { state: true, gstin: true } } }
          })
        ]);
        const sReg = (sellerUser?.registrationDetails as any) || {};
        const bReg = (buyerUser?.registrationDetails as any) || {};
        const sGstin = sReg.gstin || sellerUser?.organization?.gstin || '';
        const bGstin = bReg.gstin || buyerUser?.organization?.gstin || '';
        const sState = sReg.state || sellerUser?.organization?.state || '';
        const bState = bReg.state || buyerUser?.organization?.state || '';

        const sCode = sGstin.trim().substring(0, 2);
        const bCode = bGstin.trim().substring(0, 2);
        if (/^\d{2}$/.test(sCode) && /^\d{2}$/.test(bCode)) {
          isInterstate = sCode !== bCode;
        } else if (sState && bState) {
          isInterstate = sState.trim().toLowerCase() !== bState.trim().toLowerCase();
        }
      } catch {}
    }

    const taxes = taxBreakup(baseAmount, { ...input, interstate: isInterstate });
    // Build line items from PO items when caller doesn't provide them
    let itemsData: { create: Array<Record<string, unknown>> } | undefined;
    if (input.items?.length) {
      itemsData = {
        create: input.items.map((it: any) => {
          const qty = Number(it.quantity || 1);
          let unitPrice = Number(it.unitPrice || 0);
          if (qty > 1 && poGross > 0 && (unitPrice * qty) > (poGross * 1.2)) {
            unitPrice = roundMoney(unitPrice / qty);
          }
          let itemTaxable = Number(it.taxableAmount || (unitPrice > 0 ? unitPrice * qty : 0));
          if (qty > 1 && itemTaxable > (poGross * 1.2)) {
            itemTaxable = roundMoney(itemTaxable / qty);
          }
          const itemTaxRate = Number(it.taxRate ?? gstRate);
          const itemTax = roundMoney(itemTaxable * itemTaxRate / 100);
          return {
            purchaseOrderItemId: it.purchaseOrderItemId || it.id,
            productId: it.productId || null,
            itemName: it.itemName || it.description || 'Order Item',
            description: it.description || '',
            quantity: qty,
            unitOfMeasure: it.unitOfMeasure || 'units',
            unitPrice: unitPrice,
            taxableAmount: itemTaxable,
            taxAmount: itemTax,
            totalAmount: roundMoney(itemTaxable + itemTax)
          };
        })
      };
    } else if (po.items?.length) {
      itemsData = {
        create: po.items.map((item: any) => {
          const qty = Number(item.quantity || 1);
          let unitPrice = Number(item.unitPrice || 0);
          // Protect against legacy bug where unitPrice was set to entire lot total:
          if (qty > 1 && poGross > 0 && (unitPrice * qty) > (poGross * 1.2)) {
            unitPrice = roundMoney(unitPrice / qty);
          }
          let itemTaxable = roundMoney(qty * unitPrice);
          if (qty > 1 && itemTaxable > (poGross * 1.2)) {
            itemTaxable = roundMoney(itemTaxable / qty);
          }
          const itemTaxRate = Number(item.taxRate ?? gstRate);
          const itemTax = roundMoney(itemTaxable * itemTaxRate / 100);
          return {
            purchaseOrderItemId: item.id,
            itemName: item.itemName,
            description: item.description || '',
            quantity: item.quantity,
            unitOfMeasure: item.unitOfMeasure || 'units',
            unitPrice: unitPrice,
            taxableAmount: itemTaxable,
            taxAmount: itemTax,
            totalAmount: roundMoney(itemTaxable + itemTax)
          };
        })
      };
    }
    const invoice = await db.$transaction(async (tx: any) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber: numberSeries('INV'),
          purchaseOrderId: po.id,
          sellerId: po.sellerId,
          buyerId: po.buyerId,
          amount: taxes.grossAmount,
          status: 'submitted',
          invoiceStatus: invoiceStatusEnumFor('submitted'),
          taxableAmount: taxes.taxableAmount,
          cgstAmount: taxes.cgstAmount,
          sgstAmount: taxes.sgstAmount,
          igstAmount: taxes.igstAmount,
          totalTaxAmount: taxes.totalTaxAmount,
          tdsAmount: taxes.tdsAmount,
          metadata: {
            interstate: isInterstate,
            otherTaxRate: taxes.otherTaxRate,
            otherTaxAmount: taxes.otherTaxAmount
          },
          items: itemsData
        },
        include: { items: true }
      });
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'invoice_submitted', version: { increment: 1 } } });
      return created;
    });
    await auditWorkflow(actor, 'workflow.invoice.created', 'invoice', invoice.id, { purchaseOrderId: po.id });

    // Fetch full invoice details for PDF & notification
    const fullInvoice = await db.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: true,
        purchaseOrder: {
          include: {
            items: true,
            buyer: { select: { id: true, name: true, email: true } },
            seller: { select: { id: true, name: true, email: true } }
          }
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            registrationDetails: true,
            organizationId: true,
            sellerProfile: true,
            organization: { include: { profile: true } }
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            registrationDetails: true,
            organizationId: true,
            buyerProfile: true,
            organization: { include: { profile: true } }
          }
        }
      }
    });

    const formattedAmount = `₹${Number(invoice.amount).toLocaleString('en-IN')}`;
    const poNum = po.poNumber || `PO-${po.id}`;

    let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined = undefined;

    try {
      const pdfRes = await getOrGenerateInvoicePdfBuffer(fullInvoice || invoice);
      if (pdfRes?.buffer && pdfRes.buffer.length > 0) {
        pdfAttachment = {
          filename: pdfRes.filename || `Invoice_${invoice.invoiceNumber}.pdf`,
          content: pdfRes.buffer,
          contentType: 'application/pdf'
        };
      }
    } catch (pdfErr) {
      console.error('[InvoicePDF] Failed to generate/fetch invoice PDF for email attachment:', pdfErr);
    }

    const emailNote = pdfAttachment ? ' (Tax Invoice PDF is attached to this email.)' : '';

    // 1. Notify Seller
    if (po.sellerId) {
      notifyWorkflowSoon(
        po.sellerId,
        `Invoice Created: ${invoice.invoiceNumber}`,
        `Your invoice ${invoice.invoiceNumber} for Purchase Order ${poNum} (Amount: ${formattedAmount}) has been generated successfully.${emailNote}`,
        'invoice_created',
        '/seller/invoices',
        pdfAttachment ? [pdfAttachment] : undefined
      );
    }

    // 2. Notify Buyer
    if (po.buyerId) {
      notifyWorkflowSoon(
        po.buyerId,
        `New Invoice Submitted: ${invoice.invoiceNumber}`,
        `Seller submitted invoice ${invoice.invoiceNumber} for Purchase Order ${poNum} (Amount: ${formattedAmount}). Please review and approve.${emailNote}`,
        'invoice_submitted',
        '/buyer/invoices',
        pdfAttachment ? [pdfAttachment] : undefined
      );
    }

    return invoice;
  },

  async decideInvoice(actor: WorkflowActor, invoiceId: number, approved: boolean) {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { purchaseOrder: true } });
    if (!invoice || (actor.role !== 'admin' && invoice.buyerId !== actor.id && invoice.purchaseOrder?.buyerId !== actor.id)) {
      throw new ApiError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
    }
    statusTransitions.invoice(invoice.status, approved ? 'approved' : 'rejected');
    const updated = await db.invoice.update({
      where: { id: invoiceId },
      data: { status: approved ? 'approved' : 'rejected', invoiceStatus: invoiceStatusEnumFor(approved ? 'approved' : 'rejected'), approvedAt: approved ? new Date() : null, version: { increment: 1 } }
    });
    if (approved && invoice.purchaseOrderId) {
      await db.purchaseOrder.update({
        where: { id: invoice.purchaseOrderId },
        data: { status: 'payment_initiated', version: { increment: 1 } }
      }).catch(() => {});
    }
    await auditWorkflow(actor, approved ? 'workflow.invoice.approved' : 'workflow.invoice.rejected', 'invoice', invoiceId);

    // Notify seller when buyer approves/rejects invoice
    if (invoice.sellerId) {
      const invNum = invoice.invoiceNumber || `INV-${invoice.id}`;
      notifyWorkflowSoon(
        invoice.sellerId,
        approved ? `Invoice Approved: ${invNum}` : `Invoice Rejected: ${invNum}`,
        approved
          ? `Buyer approved invoice ${invNum}. Payment processing will proceed.`
          : `Buyer rejected invoice ${invNum}. Please review the invoice requirements.`,
        approved ? 'invoice_approved' : 'invoice_rejected',
        '/seller/invoices'
      );
    }

    return updated;
  },

  async reconcilePayment(actor: WorkflowActor, paymentId: number, status: 'success' | 'failed' | 'refunded' | 'cancelled', remarks?: string) {
    const payment = await db.paymentTransaction.findUnique({ where: { id: paymentId } });
    if (!payment) throw new ApiError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
    statusTransitions.payment(payment.status, status);
    const updated = await db.paymentTransaction.update({
      where: { id: paymentId },
      data: { status, paymentStatus: paymentStatusEnumFor(status), metadata: { ...(payment.metadata || {}), reconcileRemarks: remarks }, version: { increment: 1 } }
    });
    await auditWorkflow(actor, 'workflow.payment.reconciled', 'paymentTransaction', paymentId, { status });
    return updated;
  },

  async freezeEscrowForDispute(actor: WorkflowActor, escrowAccountId: number, reason?: string) {
    const escrow = await db.escrowAccount.findUnique({ where: { id: escrowAccountId } });
    if (!escrow || (actor.role !== 'admin' && escrow.buyerId !== actor.id && escrow.sellerId !== actor.id)) throw new ApiError(404, 'Escrow not found', 'ESCROW_NOT_FOUND');
    statusTransitions.escrow(escrow.status, 'frozen');
    const updated = await db.escrowAccount.update({
      where: { id: escrowAccountId },
      data: { status: 'frozen', escrowStatus: escrowStatusEnumFor('frozen'), frozenAt: new Date(), metadata: { ...(escrow.metadata || {}), disputeFreezeReason: reason }, version: { increment: 1 } }
    });
    await auditWorkflow(actor, 'workflow.escrow.frozen_for_dispute', 'escrowAccount', escrowAccountId, { reason });
    return updated;
  }
};
