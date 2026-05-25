/**
 * Helpers for rendering delivery statuses in the UI consistently.
 */

import type { DeliveryStatus } from './types';

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  CREATED: 'Order Created',
  SELLER_ACCEPTED: 'Seller Accepted',
  SELLER_REJECTED: 'Seller Rejected',
  PACKED: 'Packed',
  READY_FOR_PICKUP: 'Ready for Pickup',
  PICKUP_SCHEDULED: 'Pickup Scheduled',
  PICKED_UP: 'Picked Up',
  DISPATCHED: 'Dispatched',
  IN_TRANSIT: 'In Transit',
  AT_HUB: 'At Hub',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  DELIVERY_CONFIRMATION_PENDING: 'Confirmation Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  RETURN_INITIATED: 'Return Initiated',
  RETURNED: 'Returned',
  REPLACEMENT_REQUESTED: 'Replacement Requested',
  DISPUTE_RAISED: 'Dispute Raised',
  DISPUTE_RESOLVED: 'Dispute Resolved',
  INVOICE_VERIFIED: 'Invoice Verified',
  PAYMENT_APPROVED: 'Payment Approved',
  PAYMENT_RELEASED: 'Payment Released',
  CLOSED: 'Closed',
  DELAYED: 'Delayed',
  REATTEMPT_SCHEDULED: 'Reattempt Scheduled',
  DELIVERY_FAILED: 'Delivery Failed',
  CANCELLED: 'Cancelled'
};

export type StatusTone = 'positive' | 'negative' | 'warning' | 'progress' | 'neutral';

export const STATUS_TONES: Record<DeliveryStatus, StatusTone> = {
  CREATED: 'neutral',
  SELLER_ACCEPTED: 'progress',
  SELLER_REJECTED: 'negative',
  PACKED: 'progress',
  READY_FOR_PICKUP: 'progress',
  PICKUP_SCHEDULED: 'progress',
  PICKED_UP: 'progress',
  DISPATCHED: 'progress',
  IN_TRANSIT: 'progress',
  AT_HUB: 'progress',
  OUT_FOR_DELIVERY: 'progress',
  DELIVERED: 'positive',
  DELIVERY_CONFIRMATION_PENDING: 'warning',
  ACCEPTED: 'positive',
  REJECTED: 'negative',
  RETURN_INITIATED: 'warning',
  RETURNED: 'warning',
  REPLACEMENT_REQUESTED: 'warning',
  DISPUTE_RAISED: 'negative',
  DISPUTE_RESOLVED: 'positive',
  INVOICE_VERIFIED: 'progress',
  PAYMENT_APPROVED: 'progress',
  PAYMENT_RELEASED: 'positive',
  CLOSED: 'positive',
  DELAYED: 'warning',
  REATTEMPT_SCHEDULED: 'warning',
  DELIVERY_FAILED: 'negative',
  CANCELLED: 'negative'
};

export const TONE_STYLE: Record<StatusTone, string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  negative: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  progress: 'border-sky-200 bg-sky-50 text-sky-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600'
};

export const DELIVERY_HAPPY_PATH: DeliveryStatus[] = [
  'CREATED',
  'SELLER_ACCEPTED',
  'PACKED',
  'READY_FOR_PICKUP',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'ACCEPTED',
  'INVOICE_VERIFIED',
  'PAYMENT_APPROVED',
  'PAYMENT_RELEASED',
  'CLOSED'
];

export const labelFor = (status?: string) => DELIVERY_STATUS_LABELS[status as DeliveryStatus] || status || '—';

export const toneClassFor = (status?: string) => {
  const tone = STATUS_TONES[status as DeliveryStatus] || 'neutral';
  return TONE_STYLE[tone];
};
