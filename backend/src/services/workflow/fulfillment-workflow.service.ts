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

  if (actor.role === 'seller') {
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
    if (actor.role !== 'admin' && actor.role !== 'master_admin' && actor.role !== 'seller') throw new ApiError(403, 'Seller access required', 'SELLER_REQUIRED');
    statusTransitions.purchaseOrder(po.status, 'accepted');
    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: 'accepted', poStatus: poStatusEnumFor('accepted'), acceptedAt: new Date(), version: { increment: 1 } }
    });
    // Ensure a DeliveryTracking row exists so the seller can drive dispatch
    // from the new delivery module immediately after acknowledging.
    const existingDelivery = await db.deliveryTracking.findFirst({ where: { purchaseOrderId } });
    if (!existingDelivery) {
      await db.deliveryTracking.create({
        data: {
          purchaseOrderId,
          status: 'CREATED',
          expectedDelivery: po.expectedDelivery || null
        }
      }).catch(() => undefined);
    }
    await auditWorkflow(actor, 'workflow.po.acknowledged', 'purchaseOrder', purchaseOrderId);
    return updated;
  },

  async cancelPO(actor: WorkflowActor, purchaseOrderId: number) {
    const po = await assertPOAccess(actor, purchaseOrderId);
    if (actor.role !== 'admin' && po.buyerId !== actor.id) throw new ApiError(403, 'Buyer access required', 'BUYER_REQUIRED');
    statusTransitions.purchaseOrder(po.status, 'cancelled');
    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: 'cancelled', poStatus: poStatusEnumFor('cancelled'), version: { increment: 1 } }
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
    // po.amount is GST-inclusive (base + tax). When no explicit amount is given,
    // derive the taxable base from PO line items (unitPrice is always excl. GST).
    let baseAmount: number;
    if (input.amount != null) {
      baseAmount = input.amount;
    } else if (po.items?.length) {
      baseAmount = roundMoney(po.items.reduce((sum: number, item: any) => sum + Number(item.quantity) * Number(item.unitPrice), 0));
    } else {
      // Fallback: reverse-calculate from GST-inclusive po.amount
      baseAmount = roundMoney(Number(po.amount) / (1 + gstRate / 100));
    }
    const taxes = taxBreakup(baseAmount, input);
    // Build line items from PO items when caller doesn't provide them
    let itemsData: { create: Array<Record<string, unknown>> } | undefined;
    if (input.items?.length) {
      itemsData = { create: input.items };
    } else if (po.items?.length) {
      itemsData = {
        create: po.items.map((item: any) => {
          const qty = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          const itemTaxable = roundMoney(qty * unitPrice);
          const itemTaxRate = Number(item.taxRate ?? gstRate);
          const itemTax = roundMoney(itemTaxable * itemTaxRate / 100);
          return {
            purchaseOrderItemId: item.id,
            itemName: item.itemName,
            description: item.description || '',
            quantity: item.quantity,
            unitOfMeasure: item.unitOfMeasure || 'units',
            unitPrice: item.unitPrice,
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
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || (actor.role !== 'admin' && invoice.buyerId !== actor.id)) throw new ApiError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
    statusTransitions.invoice(invoice.status, approved ? 'approved' : 'rejected');
    const updated = await db.invoice.update({
      where: { id: invoiceId },
      data: { status: approved ? 'approved' : 'rejected', invoiceStatus: invoiceStatusEnumFor(approved ? 'approved' : 'rejected'), approvedAt: approved ? new Date() : null, version: { increment: 1 } }
    });
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
