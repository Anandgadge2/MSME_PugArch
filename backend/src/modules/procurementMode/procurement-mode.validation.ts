import { z } from 'zod';

export const evaluateCartSchema = z.object({
  cartId: z.number().int().positive(),
  selectedMethod: z.string().optional(),
  buyerJustification: z.string().max(2000).optional(),
  consigneeSummary: z.record(z.string(), z.unknown()).optional(),
});

export const confirmMethodSchema = z.object({
  cartId: z.number().int().positive(),
  selectedMethod: z.string().min(1),
  justification: z.string().max(2000).optional(),
  l1ComparisonId: z.number().int().positive().optional(),
  demandSplittingConfirmation: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  directPurchaseMaxValue: z.number().nonnegative().optional(),
  l1PurchaseMaxValue: z.number().nonnegative().optional(),
  bidMinValue: z.number().nonnegative().optional(),
  raRecommendedMinValue: z.number().nonnegative().optional(),
  internalApprovalRequired: z.boolean().optional(),
  demandSplitLookbackDays: z.number().int().positive().optional(),
  demandSplitSimilarityThreshold: z.number().min(0).max(1).optional(),
  allowNonL1WithApproval: z.boolean().optional(),
  governmentProcurementOnlineGatewayEnabled: z.boolean().optional(),
  allowLegacyGrnInvoiceGate: z.boolean().optional(),
  financeSkipThreshold: z.number().nonnegative().optional(),
});
