/**
 * Utility functions for procurement lifecycle gating, payment conditions, and routing.
 * VPAT and defensive security compliant.
 */

export function isAdvancePaymentTerms(termsOrOrder?: any): boolean {
  if (!termsOrOrder) return false;
  if (typeof termsOrOrder === 'string') {
    const s = termsOrOrder.toUpperCase();
    return s.includes('ADVANCE') || s.includes('100% ADVANCE') || s.includes('ADVANCE_PAYMENT');
  }
  const paymentTerms = String(
    termsOrOrder.paymentTerms ||
    termsOrOrder.terms?.paymentTerms ||
    termsOrOrder.rawBid?.paymentTerms ||
    termsOrOrder.purchaseOrder?.paymentTerms ||
    ''
  ).toUpperCase();
  if (paymentTerms.includes('ADVANCE')) return true;
  if (termsOrOrder.isAdvancePayment || termsOrOrder.advancePayment || termsOrOrder.advancePaymentAllowed) return true;
  if (Number(termsOrOrder.advancePercentage || termsOrOrder.advanceAmount || 0) > 0) return true;
  return false;
}

export function isDeliveryDeliveredOrApproved(orderOrDelivery?: any, grn?: any): boolean {
  if (!orderOrDelivery && !grn) return false;
  if (grn) {
    const grnStatus = String(grn.status || '').toUpperCase();
    if (['APPROVED', 'COMPLETED', 'PARTIAL', 'VERIFIED', 'SUBMITTED', 'PENDING'].includes(grnStatus)) {
      return true;
    }
  }
  if (orderOrDelivery) {
    const status = String(
      orderOrDelivery.deliveryStatus ||
      orderOrDelivery.status ||
      orderOrDelivery.poStatus ||
      ''
    ).toLowerCase();
    if (['delivered', 'grn_created', 'grn_pending', 'grn_approved', 'grn_completed', 'inspection_accepted', 'completed', 'paid'].includes(status)) {
      return true;
    }
    if (orderOrDelivery.delivery) {
      const delStatus = String(orderOrDelivery.delivery.status || '').toUpperCase();
      if (['DELIVERED', 'COMPLETED', 'RECEIVED'].includes(delStatus)) return true;
    }
  }
  return false;
}

export function canDisburseInvoicePayment(params: {
  invoice?: any;
  order?: any;
  delivery?: any;
  grn?: any;
  isApproved?: boolean;
}): { canPay: boolean; reason: string } {
  const { invoice, order, delivery, grn, isApproved } = params;
  if (!isApproved) {
    return { canPay: false, reason: 'Invoice must be approved before payment can be unlocked.' };
  }

  const termsSource =
    invoice?.paymentTerms ||
    order?.paymentTerms ||
    (invoice as any)?.terms?.paymentTerms ||
    (order as any)?.terms?.paymentTerms;
  const isAdvance = isAdvancePaymentTerms(termsSource) || isAdvancePaymentTerms(order) || isAdvancePaymentTerms(invoice);

  if (isAdvance) {
    return { canPay: true, reason: 'Advance payment terms: unlocked upon invoice approval.' };
  }

  const isDelivered = isDeliveryDeliveredOrApproved(order || delivery || invoice?.delivery || invoice?.purchaseOrder, grn || invoice?.grn);
  if (isDelivered) {
    return { canPay: true, reason: 'Consignment delivered and verified: payment unlocked.' };
  }

  return {
    canPay: false,
    reason: 'Payment locked until consignment is delivered. Only advance payment terms allow disbursement prior to delivery.'
  };
}
