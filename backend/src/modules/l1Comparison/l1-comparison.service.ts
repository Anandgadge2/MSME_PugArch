import prisma from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { auditLog } from '../audit/audit.service.js';
import { numberSeries } from '../../services/workflow/workflow-common.js';
import { getProcurementModeSettings } from '../procurementMode/procurement-mode.service.js';

type ComparedSellerRow = {
  sellerId: number;
  sellerName: string;
  productOrService: string;
  unitPrice: number;
  totalPrice: number;
  deliveryPeriod?: string;
  warranty?: string;
  sellerRating?: number;
  locationServiceability?: string;
  complianceStatus: 'Compliant' | 'Non-compliant' | 'Clarification Required';
  isL1?: boolean;
};

export type VendorQuote = {
  vendorId?: number | string;
  sellerId?: number | string;
  vendorOrgId?: number | string;
  sellerOrgId?: number | string;
  vendorName?: string;
  sellerName?: string;
  productOrService?: string;
  itemName?: string;
  unitPrice?: number;
  totalPrice?: number;
  quantity?: number;
  compliant?: boolean;
  complianceStatus?: string;
  submittedAt?: string | Date;
  [key: string]: any;
};

export type L1EvaluationResult = {
  l1VendorId: number | string | null;
  l1Price: number | null;
  compliantQuotes: any[];
  meetsQuorum: boolean;
  vendorCount: number;
  thresholdExemption?: boolean;
  notice?: string;
  rankings?: Array<{
    rank: string;
    vendorId: number | string;
    vendorName: string;
    totalPrice: number;
    isL1: boolean;
  }>;
};

/**
 * Statutory GFR 149 Multi-Vendor L1 Evaluation Engine.
 * Evaluates quotes across distinct vendor organizations and enforces >=3 vendor quorum.
 */
export function evaluateL1(quotes: VendorQuote[] = []): L1EvaluationResult {
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return {
      l1VendorId: null,
      l1Price: null,
      compliantQuotes: [],
      meetsQuorum: false,
      vendorCount: 0,
      notice: 'No quotes provided for evaluation'
    };
  }

  // Aggregate line items by distinct vendor organization
  const vendorMap = new Map<number | string, {
    vendorId: number | string;
    vendorOrgId?: number | string;
    vendorName: string;
    totalPrice: number;
    compliant: boolean;
    complianceStatus: string;
    submittedAt: string;
    items: string[];
  }>();

  for (const q of quotes) {
    const vId = q.vendorOrgId || q.sellerOrgId || q.vendorId || q.sellerId || 0;
    const isCompliant = q.compliant !== false && q.complianceStatus !== 'Non-compliant' && q.complianceStatus !== 'REJECTED';
    const lineTotal = Number(q.totalPrice !== undefined ? q.totalPrice : ((q.unitPrice || 0) * (q.quantity || 1)));

    if (!vendorMap.has(vId)) {
      vendorMap.set(vId, {
        vendorId: q.vendorId || q.sellerId || vId,
        vendorOrgId: q.vendorOrgId || q.sellerOrgId,
        vendorName: q.vendorName || q.sellerName || `Vendor #${vId}`,
        totalPrice: lineTotal,
        compliant: isCompliant,
        complianceStatus: isCompliant ? 'Compliant' : 'Non-compliant',
        submittedAt: q.submittedAt ? new Date(q.submittedAt).toISOString() : new Date().toISOString(),
        items: [q.productOrService || q.itemName || 'Item']
      });
    } else {
      const entry = vendorMap.get(vId)!;
      entry.totalPrice += lineTotal;
      if (!isCompliant) {
        entry.compliant = false;
        entry.complianceStatus = 'Non-compliant';
      }
      if (q.productOrService || q.itemName) {
        entry.items.push(q.productOrService || q.itemName);
      }
    }
  }

  const allVendors = Array.from(vendorMap.values());
  const compliantVendors = allVendors.filter(v => v.compliant);
  const meetsQuorum = compliantVendors.length >= 3;

  if (!meetsQuorum) {
    return {
      l1VendorId: null,
      l1Price: null,
      compliantQuotes: compliantVendors,
      meetsQuorum: false,
      vendorCount: allVendors.length,
      notice: `Quorum requires minimum 3 distinct compliant vendors; received ${compliantVendors.length}.`
    };
  }

  // Sort compliant vendors by aggregate total price ascending, breaking ties deterministically
  compliantVendors.sort((a, b) => {
    if (a.totalPrice !== b.totalPrice) return a.totalPrice - b.totalPrice;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  const l1 = compliantVendors[0];

  return {
    l1VendorId: l1.vendorId,
    l1Price: l1.totalPrice,
    compliantQuotes: compliantVendors,
    meetsQuorum: true,
    vendorCount: allVendors.length,
    rankings: compliantVendors.map((v, index) => ({
      rank: `L${index + 1}`,
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      totalPrice: v.totalPrice,
      isL1: index === 0
    }))
  };
}

const buildComparisonFromCart = async (cartId: number, organizationId: number) => {
  const cart = await prisma.cart.findFirst({
    where: { id: cartId, organizationId, status: 'ACTIVE' },
    include: {
      items: {
        include: {
          seller: { include: { sellerProfile: true } },
          product: true,
          service: true,
        },
      },
    },
  });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Active cart not found or empty.', 'CART_EMPTY');
  }

  // Aggregate items by distinct vendor organization / seller
  const sellerQuotes: VendorQuote[] = [];
  const itemsBySeller = new Map<number, typeof cart.items>();

  for (const item of cart.items) {
    const sId = item.sellerId;
    if (!itemsBySeller.has(sId)) {
      itemsBySeller.set(sId, []);
    }
    itemsBySeller.get(sId)!.push(item);
  }

  const rows: ComparedSellerRow[] = [];
  let totalCartAmount = 0;

  for (const [sellerId, items] of itemsBySeller.entries()) {
    const firstItem = items[0];
    const sellerName = firstItem.seller?.sellerProfile?.businessName || firstItem.seller?.name || `Seller #${sellerId}`;
    let sellerTotalPrice = 0;
    const itemNames: string[] = [];

    for (const it of items) {
      const uPrice = Number(it.unitPrice);
      const qty = Number(it.quantity);
      const lineTotal = uPrice * qty;
      sellerTotalPrice += lineTotal;
      totalCartAmount += lineTotal;
      itemNames.push(`${it.itemName} (${qty})`);
    }

    const row: ComparedSellerRow = {
      sellerId,
      sellerName,
      productOrService: itemNames.join(', '),
      unitPrice: sellerTotalPrice,
      totalPrice: sellerTotalPrice,
      deliveryPeriod: '30 Days',
      warranty: 'As per catalogue',
      sellerRating: undefined,
      locationServiceability: 'Available',
      complianceStatus: 'Compliant',
    };

    rows.push(row);
    sellerQuotes.push({
      sellerId,
      vendorId: sellerId,
      vendorOrgId: firstItem.seller?.organizationId || sellerId,
      sellerOrgId: firstItem.seller?.organizationId || sellerId,
      vendorName: sellerName,
      sellerName,
      totalPrice: sellerTotalPrice,
      compliant: true,
      complianceStatus: 'Compliant'
    });
  }

  // Statutory GFR 149 evaluation across distinct vendors
  const evaluation = evaluateL1(sellerQuotes);

  // Identify whether threshold exemption applies (e.g. direct purchase <= ₹25k)
  const thresholdExemption = totalCartAmount <= 25000;
  if (thresholdExemption) {
    evaluation.thresholdExemption = true;
  }

  const l1SellerId = evaluation.l1VendorId !== null ? Number(evaluation.l1VendorId) : null;
  if (l1SellerId !== null) {
    rows.forEach(r => {
      if (r.sellerId === l1SellerId) {
        r.isL1 = true;
      }
    });
  }

  return {
    cart,
    rows,
    l1SellerId,
    evaluation,
    meetsQuorum: evaluation.meetsQuorum,
    thresholdExemption,
    vendorCount: evaluation.vendorCount
  };
};

export const createL1ComparisonFromCart = async (params: {
  cartId: number;
  organizationId: number;
  buyerId: number;
}) => {
  const { cart, rows, l1SellerId, evaluation, meetsQuorum, thresholdExemption, vendorCount } = await buildComparisonFromCart(params.cartId, params.organizationId);
  const settings = await getProcurementModeSettings(params.organizationId);

  const comparison = await prisma.l1Comparison.create({
    data: {
      comparisonNumber: numberSeries('L1C'),
      cartId: params.cartId,
      buyerId: params.buyerId,
      organizationId: params.organizationId,
      comparedSellers: rows,
      l1SellerId,
      snapshot: {
        cartId: cart.id,
        rows,
        evaluation,
        meetsQuorum,
        thresholdExemption,
        vendorCount,
        generatedAt: new Date().toISOString()
      },
      status: 'DRAFT',
    },
  });

  await auditLog({
    actorUserId: params.buyerId,
    action: 'l1.comparison.created',
    entityType: 'l1_comparison',
    entityId: comparison.id,
    metadata: { cartId: params.cartId, l1SellerId, meetsQuorum, thresholdExemption, vendorCount },
  });

  return {
    comparison,
    l1SellerId,
    meetsQuorum,
    thresholdExemption,
    vendorCount,
    allowNonL1WithApproval: settings.allowNonL1WithApproval
  };
};

export const getL1Comparison = async (id: number, organizationId: number) => {
  const comparison = await prisma.l1Comparison.findFirst({
    where: { id, organizationId },
  });
  if (!comparison) throw new ApiError(404, 'L1 comparison not found.', 'NOT_FOUND');
  return comparison;
};

export const selectL1Seller = async (params: {
  id: number;
  organizationId: number;
  buyerId: number;
  selectedSellerId: number;
  nonL1Justification?: string;
}) => {
  const comparison = await getL1Comparison(params.id, params.organizationId);
  const settings = await getProcurementModeSettings(params.organizationId);
  const rows = (comparison.comparedSellers as ComparedSellerRow[]) || [];
  const l1SellerId = comparison.l1SellerId;

  if (params.selectedSellerId !== l1SellerId) {
    if (!settings.allowNonL1WithApproval) {
      await auditLog({
        actorUserId: params.buyerId,
        action: 'l1.non_l1.blocked',
        entityType: 'l1_comparison',
        entityId: comparison.id,
      });
      throw new ApiError(409, 'Non-L1 seller selection requires approval and is blocked by policy.', 'NON_L1_BLOCKED');
    }
    if (!params.nonL1Justification?.trim()) {
      throw new ApiError(400, 'Justification required when selecting non-L1 seller.', 'JUSTIFICATION_REQUIRED');
    }
  }

  const updated = await prisma.l1Comparison.update({
    where: { id: comparison.id },
    data: {
      selectedSellerId: params.selectedSellerId,
      nonL1Justification: params.nonL1Justification || null,
      status: 'SELECTED',
    },
  });

  await auditLog({
    actorUserId: params.buyerId,
    action: 'l1.seller.selected',
    entityType: 'l1_comparison',
    entityId: comparison.id,
    metadata: { selectedSellerId: params.selectedSellerId, isL1: params.selectedSellerId === l1SellerId },
  });

  return updated;
};

export const buildL1ComparisonPdfPayload = async (id: number, organizationId: number) => {
  const comparison = await getL1Comparison(id, organizationId);
  return {
    comparisonNumber: comparison.comparisonNumber,
    comparedSellers: comparison.comparedSellers,
    l1SellerId: comparison.l1SellerId,
    selectedSellerId: comparison.selectedSellerId,
    generatedAt: comparison.createdAt,
  };
};
