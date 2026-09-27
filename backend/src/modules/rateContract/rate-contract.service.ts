import prisma from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export interface RateContractPenaltyTerms {
  ratePerWeek: number;
  gracePeriodDays: number;
  maxCapPercent: number;
}

export interface ItemUtilization {
  itemName: string;
  unitOfMeasure: string;
  contractedQuantity: number;
  drawnQuantity: number;
  remainingQuantity: number;
  utilizationPercent: number;
  contractedRate: number;
}

export interface RateContractUtilization {
  contractId: number;
  totalContractValue: number;
  totalOrderedValue: number;
  totalRemainingValue: number;
  valueUtilizationPercent: number;
  items: ItemUtilization[];
}

/**
 * Extracts numeric SLA days from structured field or text (e.g. "15 days" -> 15).
 */
export function parseDeliverySlaDays(rawSla: unknown, fallbackDays = 15): number {
  if (typeof rawSla === 'number' && Number.isFinite(rawSla) && rawSla > 0) {
    return Math.round(rawSla);
  }
  if (typeof rawSla === 'string') {
    const match = rawSla.match(/(\d+)\s*(calendar\s*days|working\s*days|days|day)?/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0) return parsed;
    }
  }
  return fallbackDays;
}

/**
 * Extracts structured penalty parameters from metadata.
 */
export function parsePenaltyTerms(metadata: any): RateContractPenaltyTerms {
  let ratePerWeek = 0.5;
  let gracePeriodDays = 0;
  let maxCapPercent = 10.0;

  if (metadata) {
    if (metadata.penaltyTerms && typeof metadata.penaltyTerms === 'object') {
      if (Number.isFinite(Number(metadata.penaltyTerms.ratePerWeek))) {
        ratePerWeek = Math.max(0, Number(metadata.penaltyTerms.ratePerWeek));
      }
      if (Number.isFinite(Number(metadata.penaltyTerms.gracePeriodDays))) {
        gracePeriodDays = Math.max(0, Number(metadata.penaltyTerms.gracePeriodDays));
      }
      if (Number.isFinite(Number(metadata.penaltyTerms.maxCapPercent))) {
        maxCapPercent = Math.max(0, Number(metadata.penaltyTerms.maxCapPercent));
      }
    } else {
      if (Number.isFinite(Number(metadata.penaltyRatePerWeek))) {
        ratePerWeek = Math.max(0, Number(metadata.penaltyRatePerWeek));
      }
      if (Number.isFinite(Number(metadata.penaltyGraceDays))) {
        gracePeriodDays = Math.max(0, Number(metadata.penaltyGraceDays));
      }
      if (Number.isFinite(Number(metadata.maxPenaltyCapPercentage))) {
        maxCapPercent = Math.max(0, Number(metadata.maxPenaltyCapPercentage));
      } else if (typeof metadata.penaltyClause === 'string') {
        const rateMatch = metadata.penaltyClause.match(/([\d.]+)%\s*per\s*week/i);
        if (rateMatch && rateMatch[1]) ratePerWeek = parseFloat(rateMatch[1]);
        const capMatch = metadata.penaltyClause.match(/maximum\s*(?:of)?\s*([\d.]+)%/i) || metadata.penaltyClause.match(/cap(?:ped)?\s*(?:at)?\s*([\d.]+)%/i);
        if (capMatch && capMatch[1]) maxCapPercent = parseFloat(capMatch[1]);
      }
    }
  }

  return { ratePerWeek, gracePeriodDays, maxCapPercent };
}

/**
 * Calculates Expected Delivery Date from Order Date + SLA Days.
 */
export function calculateExpectedDeliveryDate(orderDate: Date, slaDays: number): Date {
  const result = new Date(orderDate);
  result.setDate(result.getDate() + Math.max(1, slaDays));
  return result;
}

/**
 * Queries cumulative utilization for each item in the rate contract.
 */
export async function getRateContractUtilization(
  contractId: number,
  contractMetadata?: any,
  contractTotalValue = 0
): Promise<RateContractUtilization> {
  let meta = contractMetadata;
  let totalVal = contractTotalValue;

  if (!meta || totalVal === 0) {
    const contract = await (prisma as any).contract.findUnique({
      where: { id: contractId },
      select: { metadata: true, value: true }
    });
    if (contract) {
      meta = contract.metadata || {};
      totalVal = Number(contract.value || 0);
    }
  }

  const itemRateSchedule: any[] = Array.isArray(meta?.itemRateSchedule) ? meta.itemRateSchedule : [];

  // Query all active (non-cancelled / non-rejected) call-off purchase orders
  const activeOrders = await (prisma as any).purchaseOrder.findMany({
    where: {
      contractId,
      sourceType: 'RATE_CONTRACT_CALLOFF',
      status: { notIn: ['cancelled', 'rejected'] }
    },
    include: {
      items: true
    }
  });

  const orderedQtyMap = new Map<string, number>();
  let totalOrderedValue = 0;

  for (const po of activeOrders) {
    totalOrderedValue += Number(po.totalValue || po.amount || 0);
    for (const line of (po.items || [])) {
      const key = String(line.itemName || '').trim().toLowerCase();
      const current = orderedQtyMap.get(key) || 0;
      orderedQtyMap.set(key, current + Number(line.quantity || 0));
    }
  }

  const items: ItemUtilization[] = itemRateSchedule.map((item: any) => {
    const key = String(item.itemName || '').trim().toLowerCase();
    const contractedQuantity = Number(item.estimatedAnnualQuantity || 0);
    const drawnQuantity = orderedQtyMap.get(key) || 0;
    const remainingQuantity = Math.max(0, contractedQuantity - drawnQuantity);
    const utilizationPercent = contractedQuantity > 0
      ? Math.min(100, Math.round((drawnQuantity / contractedQuantity) * 1000) / 10)
      : 0;

    return {
      itemName: String(item.itemName || ''),
      unitOfMeasure: String(item.uom || item.unitOfMeasure || 'Nos'),
      contractedQuantity,
      drawnQuantity,
      remainingQuantity,
      utilizationPercent,
      contractedRate: Number(item.baseRate || 0)
    };
  });

  const totalRemainingValue = Math.max(0, totalVal - totalOrderedValue);
  const valueUtilizationPercent = totalVal > 0
    ? Math.min(100, Math.round((totalOrderedValue / totalVal) * 1000) / 10)
    : 0;

  return {
    contractId,
    totalContractValue: totalVal,
    totalOrderedValue,
    totalRemainingValue,
    valueUtilizationPercent,
    items
  };
}

/**
 * Validates a Call-off PO request against Rate Contract constraints:
 * 1. Contract validity and call-off permissions
 * 2. Supplier membership in selectedSuppliers
 * 3. Min/Max call-off quantity bounds
 * 4. Item rate resolution from itemRateSchedule
 * 5. Cumulative quantity ceiling per item
 */
export async function validateCallOffOrderRequest(
  contract: any,
  body: {
    sellerId: number;
    items: Array<{
      itemName: string;
      quantity: number;
      unitOfMeasure?: string;
      unitPrice?: number;
      taxRate?: number;
    }>;
  }
) {
  const metadata = (contract.metadata || {}) as any;

  if (contract.contractType !== 'RATE_CONTRACT') {
    throw new ApiError(400, 'Contract is not a Rate Contract', 'RATE_CONTRACT_TYPE_INVALID');
  }

  if (metadata.callOffOrderAllowed === false) {
    throw new ApiError(409, 'Call-off orders are not allowed for this rate contract', 'RATE_CONTRACT_CALLOFF_NOT_ALLOWED');
  }

  if (contract.endDate && new Date(contract.endDate) < new Date()) {
    throw new ApiError(409, 'Rate contract has expired', 'RATE_CONTRACT_EXPIRED');
  }

  // 1. Check supplier
  const selectedSuppliers = Array.isArray(metadata.selectedSuppliers) ? metadata.selectedSuppliers : [];
  const supplierAllowed = selectedSuppliers.some((s: any) =>
    Number(s.supplierUserId || s.sellerUserId || s.supplierId || 0) === Number(body.sellerId)
  );
  if (!supplierAllowed && selectedSuppliers.length > 0) {
    throw new ApiError(400, 'Selected seller is not an authorized supplier for this rate contract', 'RATE_CONTRACT_SUPPLIER_INVALID');
  }

  // 2. Validate Order Quantity Bounds
  const totalCallOffQty = body.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const minCallOffQty = Number(metadata.minimumOrderQuantity || 0);
  const maxCallOffQty = Number(metadata.maximumOrderQuantityPerCallOff || 0);

  if (minCallOffQty > 0 && totalCallOffQty < minCallOffQty) {
    throw new ApiError(
      400,
      `Call-off order quantity (${totalCallOffQty}) is below the minimum allowed quantity of ${minCallOffQty} units.`,
      'RATE_CONTRACT_MIN_QTY_INVALID'
    );
  }

  if (maxCallOffQty > 0 && totalCallOffQty > maxCallOffQty) {
    throw new ApiError(
      400,
      `Call-off order quantity (${totalCallOffQty}) exceeds the maximum allowed quantity of ${maxCallOffQty} units per call-off.`,
      'RATE_CONTRACT_MAX_QTY_INVALID'
    );
  }

  // 3. Cumulative Item Availability and Price Resolution
  const utilization = await getRateContractUtilization(contract.id, metadata, Number(contract.value || 0));
  const utilizationMap = new Map<string, ItemUtilization>();
  for (const item of utilization.items) {
    utilizationMap.set(item.itemName.trim().toLowerCase(), item);
  }

  const scheduleItems: any[] = Array.isArray(metadata.itemRateSchedule) ? metadata.itemRateSchedule : [];
  const scheduleMap = new Map<string, any>();
  for (const sch of scheduleItems) {
    scheduleMap.set(String(sch.itemName || '').trim().toLowerCase(), sch);
  }

  const resolvedItems = body.items.map(reqItem => {
    const key = reqItem.itemName.trim().toLowerCase();
    const sch = scheduleMap.get(key);
    const util = utilizationMap.get(key);

    if (scheduleItems.length > 0 && !sch) {
      throw new ApiError(
        400,
        `Item "${reqItem.itemName}" is not part of this Rate Contract's approved rate schedule.`,
        'RATE_CONTRACT_ITEM_NOT_FOUND'
      );
    }

    // Cumulative balance check
    if (util && util.contractedQuantity > 0) {
      if (reqItem.quantity > util.remainingQuantity) {
        throw new ApiError(
          400,
          `Requested quantity (${reqItem.quantity}) for "${reqItem.itemName}" exceeds remaining contract balance (${util.remainingQuantity} units available of ${util.contractedQuantity} contracted).`,
          'RATE_CONTRACT_CEILING_EXCEEDED'
        );
      }
    }

    // Resolve unit rate from schedule
    let unitPrice = Number(reqItem.unitPrice || 0);
    if (sch) {
      let baseRate = Number(sch.baseRate || 0);
      const discount = Number(sch.discount || 0);

      // Check volume slab pricing
      if (Array.isArray(sch.slabPricing) && sch.slabPricing.length > 0) {
        for (const slab of sch.slabPricing) {
          const min = Number(slab.minQuantity || 0);
          const max = slab.maxQuantity ? Number(slab.maxQuantity) : Infinity;
          if (reqItem.quantity >= min && reqItem.quantity <= max && Number(slab.rate) > 0) {
            baseRate = Number(slab.rate);
            break;
          }
        }
      }

      const discountedRate = discount > 0 ? baseRate * (1 - discount / 100) : baseRate;
      unitPrice = Math.round(discountedRate * 100) / 100;
    }

    const taxRate = Number(reqItem.taxRate !== undefined ? reqItem.taxRate : (sch?.gst || 0));
    const lineTotal = Math.round(reqItem.quantity * unitPrice * (1 + taxRate / 100) * 100) / 100;

    return {
      itemName: sch ? sch.itemName : reqItem.itemName,
      quantity: reqItem.quantity,
      unitOfMeasure: sch ? (sch.uom || sch.unitOfMeasure) : (reqItem.unitOfMeasure || 'Nos'),
      unitPrice,
      taxRate,
      totalAmount: lineTotal
    };
  });

  return {
    resolvedItems,
    totalCallOffQty,
    utilization
  };
}

/**
 * Calculates contractual liquidated damages (penalty) for delayed delivery.
 */
export function calculateContractualPenalty(params: {
  poValue: number;
  expectedDeliveryDate: Date;
  actualDeliveryDate?: Date | null;
  penaltyTerms: RateContractPenaltyTerms;
  isWaived?: boolean;
}) {
  const { poValue, expectedDeliveryDate, actualDeliveryDate, penaltyTerms, isWaived = false } = params;
  const { ratePerWeek, gracePeriodDays, maxCapPercent } = penaltyTerms;

  if (isWaived || !poValue || !expectedDeliveryDate) {
    return {
      delayDays: 0,
      delayedWeeks: 0,
      weeklyRate: ratePerWeek,
      maxCapPercent,
      calculatedPenalty: 0,
      isDelayed: false,
      isWaived: Boolean(isWaived)
    };
  }

  const effectiveEnd = actualDeliveryDate ? new Date(actualDeliveryDate) : new Date();
  const effectiveExpected = new Date(expectedDeliveryDate);
  effectiveExpected.setDate(effectiveExpected.getDate() + gracePeriodDays);

  if (effectiveEnd <= effectiveExpected) {
    return {
      delayDays: 0,
      delayedWeeks: 0,
      weeklyRate: ratePerWeek,
      maxCapPercent,
      calculatedPenalty: 0,
      isDelayed: false,
      isWaived: false
    };
  }

  const diffMs = effectiveEnd.getTime() - effectiveExpected.getTime();
  const delayDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const delayedWeeks = Math.ceil(delayDays / 7);

  const rawPenalty = poValue * (ratePerWeek / 100) * delayedWeeks;
  const maxCapAmount = poValue * (maxCapPercent / 100);
  const calculatedPenalty = Math.round(Math.min(rawPenalty, maxCapAmount) * 100) / 100;

  return {
    delayDays,
    delayedWeeks,
    weeklyRate: ratePerWeek,
    maxCapPercent,
    calculatedPenalty,
    isDelayed: true,
    isWaived: false
  };
}
