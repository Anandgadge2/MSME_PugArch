import { z } from 'zod';
import { DELIVERY_DOCUMENT_TYPES, DELIVERY_PARTICIPANT_ROLES, DELIVERY_STATUSES } from './delivery.constants.js';

const trimmedString = (max: number, min = 1) =>
  z.string().trim().min(min).max(max);

export const deliveryStatusSchema = z.enum(DELIVERY_STATUSES);
export const deliveryParticipantRoleSchema = z.enum(DELIVERY_PARTICIPANT_ROLES);
export const deliveryDocumentTypeSchema = z.enum(DELIVERY_DOCUMENT_TYPES);

export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const purchaseOrderIdParam = z.object({ purchaseOrderId: z.coerce.number().int().positive() });

export const deliveryListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: deliveryStatusSchema.optional(),
  role: z.enum(['seller', 'buyer', 'consignee', 'logistics', 'finance', 'admin']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(100).optional()
}).partial();

export const createDeliveryBody = z.object({
  trackingNumber: z.string().trim().max(120).optional(),
  carrierName: z.string().trim().max(120).optional(),
  expectedDelivery: z.coerce.date().optional(),
  currentLocation: z.string().trim().max(255).optional(),
  logisticsPartnerId: z.coerce.number().int().positive().optional(),
  logisticsPartnerName: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(1000).optional()
});

export const sellerAcceptanceBody = z.object({
  remarks: z.string().trim().max(1000).optional(),
  expectedDelivery: z.coerce.date().optional()
});

export const sellerRejectionBody = z.object({
  reason: trimmedString(1000)
});

export const packingBody = z.object({
  packageWeightKg: z.coerce.number().positive().optional(),
  packageDimensions: z.string().trim().max(120).optional(),
  packageCount: z.coerce.number().int().positive().optional(),
  remarks: z.string().trim().max(1000).optional()
});

export const dispatchDetailsBody = z.object({
  trackingNumber: z.string().trim().max(120).optional(),
  carrierName: z.string().trim().max(120).optional(),
  logisticsPartnerId: z.coerce.number().int().positive().optional(),
  logisticsPartnerName: z.string().trim().max(120).optional(),
  logisticsContact: z.string().trim().max(120).optional(),
  ewayBillNumber: z.string().trim().max(80).optional(),
  courierReceiptNumber: z.string().trim().max(80).optional(),
  expectedDelivery: z.coerce.date().optional(),
  remarks: z.string().trim().max(1000).optional()
});

export const statusUpdateBody = z.object({
  status: deliveryStatusSchema,
  location: z.string().trim().max(255).optional(),
  remarks: z.string().trim().max(1000).optional(),
  occurredAt: z.coerce.date().optional()
});

export const documentUploadBody = z.object({
  documentType: deliveryDocumentTypeSchema,
  fileAssetId: z.coerce.number().int().positive(),
  description: z.string().trim().max(500).optional()
});

export const buyerAcceptanceBody = z.object({
  accepted: z.boolean(),
  rejectionReason: z.string().trim().max(1000).optional(),
  inspectionStatus: z.string().trim().max(80).optional(),
  damageNotes: z.string().trim().max(2000).optional(),
  missingQuantity: z.coerce.number().nonnegative().optional(),
  remarks: z.string().trim().max(1000).optional()
}).refine(
  body => body.accepted || (body.rejectionReason && body.rejectionReason.length > 0),
  { message: 'rejectionReason is required when rejecting a delivery', path: ['rejectionReason'] }
);

export const returnRequestBody = z.object({
  reason: trimmedString(1000),
  type: z.enum(['RETURN', 'REPLACEMENT', 'REFUND']).default('RETURN'),
  remarks: z.string().trim().max(1000).optional()
});

export const disputeRaiseBody = z.object({
  category: trimmedString(80),
  reason: trimmedString(2000),
  evidenceFileAssetIds: z.array(z.coerce.number().int().positive()).max(10).optional()
});

export const disputeResolveBody = z.object({
  resolutionRemarks: trimmedString(2000),
  outcome: z.enum(['RESOLVED_FOR_BUYER', 'RESOLVED_FOR_SELLER', 'PARTIAL', 'REJECTED']).default('RESOLVED_FOR_BUYER')
});

export const invoiceVerifyBody = z.object({
  invoiceId: z.coerce.number().int().positive(),
  remarks: z.string().trim().max(1000).optional()
});

export const paymentDecisionBody = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().trim().max(1000).optional(),
  deductionAmount: z.coerce.number().nonnegative().optional(),
  penaltyAmount: z.coerce.number().nonnegative().optional(),
  remarks: z.string().trim().max(1000).optional()
}).refine(
  body => body.approve || (body.rejectionReason && body.rejectionReason.length > 0),
  { message: 'rejectionReason is required when rejecting a payment', path: ['rejectionReason'] }
);

export const paymentReleaseBody = z.object({
  transactionReference: trimmedString(120),
  netReleasedAmount: z.coerce.number().nonnegative().optional(),
  paymentProofFileAssetId: z.coerce.number().int().positive().optional(),
  remarks: z.string().trim().max(1000).optional()
});

export const adminOverrideBody = z.object({
  status: deliveryStatusSchema,
  reason: trimmedString(2000),
  location: z.string().trim().max(255).optional()
});

export const participantAssignBody = z.object({
  userId: z.coerce.number().int().positive(),
  participantRole: deliveryParticipantRoleSchema,
  notes: z.string().trim().max(500).optional()
});

export const logisticsPartnerBody = z.object({
  name: trimmedString(160),
  code: z.string().trim().max(40).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().trim().max(40).optional(),
  trackingUrl: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional()
});

export const deliveryReportQuery = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sellerId: z.coerce.number().int().positive().optional(),
  buyerId: z.coerce.number().int().positive().optional(),
  status: deliveryStatusSchema.optional()
}).partial();

export type CreateDeliveryInput = z.infer<typeof createDeliveryBody>;
export type StatusUpdateInput = z.infer<typeof statusUpdateBody>;
export type DispatchDetailsInput = z.infer<typeof dispatchDetailsBody>;
export type BuyerAcceptanceInput = z.infer<typeof buyerAcceptanceBody>;
export type DocumentUploadInput = z.infer<typeof documentUploadBody>;
