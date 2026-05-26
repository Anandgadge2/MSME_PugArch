/**
 * Delivery Tracking Module - shared constants and status transition map.
 *
 * The values here mirror the Prisma DeliveryStatus enum so that the database,
 * service layer, and frontend can share a single source of truth for legal
 * transitions. Any change to the enum should be reflected here.
 */

export const DELIVERY_STATUSES = [
  'CREATED',
  'SELLER_ACCEPTED',
  'SELLER_REJECTED',
  'PACKED',
  'READY_FOR_PICKUP',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'DISPATCHED',
  'IN_TRANSIT',
  'AT_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_CONFIRMATION_PENDING',
  'ACCEPTED',
  'REJECTED',
  'RETURN_INITIATED',
  'RETURNED',
  'REPLACEMENT_REQUESTED',
  'DISPUTE_RAISED',
  'DISPUTE_RESOLVED',
  'INVOICE_VERIFIED',
  'PAYMENT_APPROVED',
  'PAYMENT_RELEASED',
  'CLOSED',
  'DELAYED',
  'REATTEMPT_SCHEDULED',
  'DELIVERY_FAILED',
  'CANCELLED'
] as const;

export type DeliveryStatus = typeof DELIVERY_STATUSES[number];

/**
 * Allowed transitions per status. Permissive enough to capture the happy and
 * exception flows in the spec while still rejecting clearly invalid jumps such
 * as DELIVERED → CREATED. Admin overrides bypass this map (with audit log).
 */
export const DELIVERY_STATUS_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  CREATED: ['SELLER_ACCEPTED', 'SELLER_REJECTED', 'CANCELLED'],
  SELLER_ACCEPTED: ['PACKED', 'READY_FOR_PICKUP', 'DISPATCHED', 'CANCELLED'],
  SELLER_REJECTED: ['CANCELLED'],
  PACKED: ['READY_FOR_PICKUP', 'PICKUP_SCHEDULED', 'PICKED_UP', 'DISPATCHED', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKUP_SCHEDULED', 'PICKED_UP', 'DISPATCHED', 'CANCELLED'],
  PICKUP_SCHEDULED: ['PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'CANCELLED'],
  PICKED_UP: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  DISPATCHED: ['IN_TRANSIT', 'AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'CANCELLED'],
  IN_TRANSIT: ['AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'CANCELLED'],
  AT_HUB: ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED', 'DELAYED'],
  DELIVERED: ['DELIVERY_CONFIRMATION_PENDING', 'ACCEPTED', 'REJECTED'],
  DELIVERY_CONFIRMATION_PENDING: ['ACCEPTED', 'REJECTED', 'DISPUTE_RAISED'],
  ACCEPTED: ['INVOICE_VERIFIED', 'DISPUTE_RAISED'],
  REJECTED: ['RETURN_INITIATED', 'REPLACEMENT_REQUESTED', 'DISPUTE_RAISED'],
  RETURN_INITIATED: ['RETURNED', 'CANCELLED'],
  RETURNED: ['CLOSED', 'REPLACEMENT_REQUESTED'],
  REPLACEMENT_REQUESTED: ['PACKED', 'READY_FOR_PICKUP', 'DISPATCHED', 'CANCELLED'],
  DISPUTE_RAISED: ['DISPUTE_RESOLVED'],
  DISPUTE_RESOLVED: ['ACCEPTED', 'INVOICE_VERIFIED', 'RETURN_INITIATED', 'PAYMENT_APPROVED', 'CLOSED', 'CANCELLED'],
  INVOICE_VERIFIED: ['PAYMENT_APPROVED', 'DISPUTE_RAISED'],
  PAYMENT_APPROVED: ['PAYMENT_RELEASED', 'DISPUTE_RAISED'],
  PAYMENT_RELEASED: ['CLOSED'],
  CLOSED: [],
  DELAYED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AT_HUB', 'DELIVERY_FAILED', 'CANCELLED'],
  REATTEMPT_SCHEDULED: ['OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'CANCELLED'],
  DELIVERY_FAILED: ['REATTEMPT_SCHEDULED', 'RETURN_INITIATED', 'CANCELLED'],
  CANCELLED: []
};

/**
 * Maps high-level delivery status to allowed actor roles. Admin can perform any
 * transition (with required reason). Seller, buyer, consignee, logistics, and
 * finance officers are constrained to their stages.
 */
export const STATUS_ALLOWED_ROLES: Record<DeliveryStatus, string[]> = {
  CREATED: ['system', 'seller', 'admin'],
  SELLER_ACCEPTED: ['seller', 'admin'],
  SELLER_REJECTED: ['seller', 'admin'],
  PACKED: ['seller', 'admin'],
  READY_FOR_PICKUP: ['seller', 'admin'],
  PICKUP_SCHEDULED: ['seller', 'logistics', 'admin'],
  PICKED_UP: ['seller', 'logistics', 'admin'],
  DISPATCHED: ['seller', 'logistics', 'admin'],
  IN_TRANSIT: ['logistics', 'seller', 'admin'],
  AT_HUB: ['logistics', 'admin'],
  OUT_FOR_DELIVERY: ['logistics', 'admin'],
  DELIVERED: ['logistics', 'seller', 'admin'],
  DELIVERY_CONFIRMATION_PENDING: ['logistics', 'system', 'admin'],
  ACCEPTED: ['buyer', 'consignee', 'admin'],
  REJECTED: ['buyer', 'consignee', 'admin'],
  RETURN_INITIATED: ['buyer', 'consignee', 'admin'],
  RETURNED: ['logistics', 'seller', 'admin'],
  REPLACEMENT_REQUESTED: ['buyer', 'consignee', 'admin'],
  DISPUTE_RAISED: ['buyer', 'seller', 'consignee', 'admin'],
  DISPUTE_RESOLVED: ['admin'],
  INVOICE_VERIFIED: ['finance', 'admin'],
  PAYMENT_APPROVED: ['finance', 'admin'],
  PAYMENT_RELEASED: ['finance', 'admin'],
  CLOSED: ['admin', 'finance', 'system'],
  DELAYED: ['logistics', 'seller', 'admin'],
  REATTEMPT_SCHEDULED: ['logistics', 'admin'],
  DELIVERY_FAILED: ['logistics', 'admin'],
  CANCELLED: ['seller', 'buyer', 'admin']
};

export const TERMINAL_STATUSES: DeliveryStatus[] = ['CLOSED', 'CANCELLED'];

/** Extended (non-system) participant roles supported via DeliveryParticipant. */
export const DELIVERY_PARTICIPANT_ROLES = ['CONSIGNEE', 'LOGISTICS_PARTNER', 'FINANCE_OFFICER', 'DISPUTE_OFFICER'] as const;
export type DeliveryParticipantRole = typeof DELIVERY_PARTICIPANT_ROLES[number];

export const DELIVERY_DOCUMENT_TYPES = [
  'PURCHASE_ORDER',
  'TAX_INVOICE',
  'DELIVERY_CHALLAN',
  'PACKING_SLIP',
  'COURIER_RECEIPT',
  'EWAY_BILL',
  'PROOF_OF_DISPATCH',
  'PROOF_OF_DELIVERY',
  'INSPECTION_REPORT',
  'REJECTION_REPORT',
  'RETURN_DOCUMENT',
  'PAYMENT_PROOF',
  'OTHER'
] as const;
export type DeliveryDocumentType = typeof DELIVERY_DOCUMENT_TYPES[number];

export const DELIVERY_NOTIFICATION_TYPE = 'delivery_status_change';
