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

export type StatusTone = 'positive' | 'negative' | 'warning' | 'progress' | 'neutral' | 'indigo';

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
  INVOICE_VERIFIED: 'indigo',
  PAYMENT_APPROVED: 'indigo',
  PAYMENT_RELEASED: 'positive',
  CLOSED: 'positive',
  DELAYED: 'warning',
  REATTEMPT_SCHEDULED: 'warning',
  DELIVERY_FAILED: 'negative',
  CANCELLED: 'negative'
};

export const TONE_STYLE: Record<StatusTone, string> = {
  positive: 'border-emerald-200/90 bg-emerald-50/90 text-emerald-800 ring-1 ring-emerald-500/20 shadow-xs shadow-emerald-500/5',
  negative: 'border-rose-200/90 bg-rose-50/90 text-rose-800 ring-1 ring-rose-500/20 shadow-xs shadow-rose-500/5',
  warning: 'border-amber-200/90 bg-amber-50/90 text-amber-900 ring-1 ring-amber-500/20 shadow-xs shadow-amber-500/5',
  progress: 'border-teal-200/90 bg-teal-50/90 text-[#0f766e] ring-1 ring-[#0f766e]/20 shadow-xs shadow-teal-500/5',
  indigo: 'border-indigo-200/90 bg-indigo-50/90 text-indigo-900 ring-1 ring-indigo-500/20 shadow-xs shadow-indigo-500/5',
  neutral: 'border-slate-200/90 bg-slate-50/90 text-slate-700 ring-1 ring-slate-400/20 shadow-xs shadow-slate-500/5'
};

export const TONE_DOT_COLOR: Record<StatusTone, string> = {
  positive: 'bg-emerald-500',
  negative: 'bg-rose-500',
  warning: 'bg-amber-500',
  progress: 'bg-teal-600',
  indigo: 'bg-indigo-600',
  neutral: 'bg-slate-400'
};

export const LIVE_PROGRESS_STATUSES = new Set<DeliveryStatus>([
  'READY_FOR_PICKUP',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'DISPATCHED',
  'IN_TRANSIT',
  'AT_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERY_CONFIRMATION_PENDING'
]);

export const isLiveStatus = (status?: string): boolean => {
  return status ? LIVE_PROGRESS_STATUSES.has(status as DeliveryStatus) : false;
};

export const DELIVERY_HAPPY_PATH: DeliveryStatus[] = [
  'CREATED',
  'SELLER_ACCEPTED',
  'PACKED',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

export const labelFor = (status?: string) => DELIVERY_STATUS_LABELS[status as DeliveryStatus] || status || '—';

export const toneClassFor = (status?: string) => {
  const tone = STATUS_TONES[status as DeliveryStatus] || 'neutral';
  return TONE_STYLE[tone];
};

export const toneDotFor = (status?: string) => {
  const tone = STATUS_TONES[status as DeliveryStatus] || 'neutral';
  return TONE_DOT_COLOR[tone];
};
