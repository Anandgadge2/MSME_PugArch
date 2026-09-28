'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Scale,
  Award,
  Truck,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  Eye,
  FileSpreadsheet,
  Clock
} from 'lucide-react';
import { cn } from '../../../lib/utils';

export type LifecycleStageId = 1 | 2 | 3 | 4 | 5;

export interface StageConfig {
  id: LifecycleStageId;
  name: string;
  shortName: string;
  description: string;
  buyerHint: string;
  sellerHint: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface ProcurementLifecycleStepperProps {
  status?: string;
  lifecycleStage?: string;
  awards?: any[];
  activeAward?: any;
  purchaseOrders?: any[];
  activeOrder?: any;
  hasApprovedGrn?: boolean;
  invoices?: any[];
  isBuyer?: boolean;
  isStandby?: boolean;

  // Real participation / bid states for strictly conditional action rendering
  isSellerParticipated?: boolean;
  myParticipation?: any;
  canSubmitBid?: boolean;
  submittedBidsCount?: number;
  onSubmitClick?: () => void;
  onViewQuotationClick?: () => void;

  /** In-page or cross-route stage navigation handlers */
  onNavigateStage?: (stageId: LifecycleStageId) => void;
  onViewEvaluation?: () => void;
  onViewPO?: () => void;
  onNavigateDelivery?: () => void;
  onNavigateInvoice?: (invoice?: any) => void;
  onNavigateSettlement?: () => void;

  /** In-page dialog trigger callbacks (replacing router.push redirects) */
  onOpenPackDialog?: () => void;
  onOpenDispatchDialog?: () => void;
  onOpenGrnCreate?: () => void;
  onOpenCreateInvoice?: (invoiceData?: any) => void;
  onOpenPaymentModal?: (order?: any) => void;
  onOpenSettlementModal?: (order?: any) => void;
  onOpenViewPaymentProof?: (order?: any) => void;
  fulfillmentPhase?: string;
}

export const LIFECYCLE_STAGES: StageConfig[] = [
  {
    id: 1,
    name: 'Evaluation',
    shortName: 'Evaluation',
    description: 'Technical & Commercial Scrutiny',
    buyerHint: 'Evaluate bids and determine ranking',
    sellerHint: 'Proposal under evaluation and ranking',
    icon: Scale
  },
  {
    id: 2,
    name: 'Award & PO',
    shortName: 'Award & PO',
    description: 'Mutual Consent & Order Binding',
    buyerHint: 'Offer award & issue formal Purchase Order',
    sellerHint: 'Accept award offer & commit to PO',
    icon: Award
  },
  {
    id: 3,
    name: 'Delivery & GRN',
    shortName: 'Delivery & GRN',
    description: 'Dispatch & Physical Inspection',
    buyerHint: 'Inspect delivered items & approve GRN',
    sellerHint: 'Dispatch goods & submit delivery tracking',
    icon: Truck
  },
  {
    id: 4,
    name: 'Invoicing',
    shortName: 'Invoicing',
    description: 'Tax Invoicing to Accompany Shipment',
    buyerHint: 'Review and approve verified tax invoice',
    sellerHint: 'Generate tax invoice to accompany delivery shipment',
    icon: FileText
  },
  {
    id: 5,
    name: 'Settlement',
    shortName: 'Settlement',
    description: 'Bank Payment & Contract Close',
    buyerHint: 'Pay online or record UTR & upload payment proof',
    sellerHint: 'Review payment proof & confirm order settlement',
    icon: ShieldCheck
  }
];

// Distinct, vibrant, executive stage visual themes with gradients & hover glows
export interface StageVisualTheme {
  name: string;
  completedCardBg: string;
  completedBorder: string;
  completedTitleText: string;
  completedBadge: string;
  completedBadgeText: string;
  completedNumberBg: string;
  completedBtnBg: string;
  completedBtnBorder: string;
  completedBtnText: string;
  completedHoverShadow: string;
  activeCardBg: string;
  activeBorder: string;
  activeRing: string;
  activeBadge: string;
  activeGlow: string;
  activeBtnBg: string;
  activeBtnText: string;
  upcomingNumberText: string;
  upcomingNumberBg: string;
  upcomingHoverBorder: string;
  accentGradient: string;
}

export const STAGE_VISUAL_THEMES: Record<LifecycleStageId, StageVisualTheme> = {
  1: {
    // Evaluation: Indigo / Violet
    name: 'Evaluation',
    completedCardBg: 'bg-gradient-to-br from-indigo-50/95 via-violet-50/60 to-white',
    completedBorder: 'border-indigo-200/90 hover:border-indigo-400',
    completedTitleText: 'text-indigo-950 font-bold',
    completedBadge: 'bg-indigo-100/90 text-indigo-700 border border-indigo-200/90',
    completedBadgeText: 'text-indigo-700 font-extrabold',
    completedNumberBg: 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-300/50',
    completedBtnBg: 'bg-white/95 hover:bg-indigo-50',
    completedBtnBorder: 'border-indigo-200/90 hover:border-indigo-300',
    completedBtnText: 'text-indigo-900 font-bold',
    completedHoverShadow: 'hover:shadow-[0_8px_20px_-4px_rgba(99,102,241,0.25)]',

    activeCardBg: 'bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca]',
    activeBorder: 'border-indigo-400/90',
    activeRing: 'ring-2 ring-indigo-400/50',
    activeBadge: 'bg-indigo-400/20 text-indigo-200 border border-indigo-300/40',
    activeGlow: 'shadow-[0_10px_25px_-5px_rgba(79,70,229,0.5)]',
    activeBtnBg: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:to-violet-500',
    activeBtnText: 'text-white font-extrabold shadow-sm',

    upcomingNumberText: 'text-indigo-500',
    upcomingNumberBg: 'bg-indigo-50 border border-indigo-100',
    upcomingHoverBorder: 'hover:border-indigo-300 hover:bg-indigo-50/30',
    accentGradient: 'from-indigo-500 to-violet-600'
  },
  2: {
    // Award & PO: Azure / Cyan / Sky Blue
    name: 'Award & PO',
    completedCardBg: 'bg-gradient-to-br from-sky-50/95 via-cyan-50/60 to-white',
    completedBorder: 'border-sky-200/90 hover:border-sky-400',
    completedTitleText: 'text-sky-950 font-bold',
    completedBadge: 'bg-sky-100/90 text-sky-700 border border-sky-200/90',
    completedBadgeText: 'text-sky-700 font-extrabold',
    completedNumberBg: 'bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-sky-300/50',
    completedBtnBg: 'bg-white/95 hover:bg-sky-50',
    completedBtnBorder: 'border-sky-200/90 hover:border-sky-300',
    completedBtnText: 'text-sky-900 font-bold',
    completedHoverShadow: 'hover:shadow-[0_8px_20px_-4px_rgba(14,165,233,0.25)]',

    activeCardBg: 'bg-gradient-to-br from-[#082f49] via-[#0369a1] to-[#0284c7]',
    activeBorder: 'border-sky-400/90',
    activeRing: 'ring-2 ring-sky-400/50',
    activeBadge: 'bg-sky-400/20 text-sky-200 border border-sky-300/40',
    activeGlow: 'shadow-[0_10px_25px_-5px_rgba(2,132,199,0.5)]',
    activeBtnBg: 'bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 hover:from-sky-400 hover:to-blue-500',
    activeBtnText: 'text-white font-extrabold shadow-sm',

    upcomingNumberText: 'text-sky-500',
    upcomingNumberBg: 'bg-sky-50 border border-sky-100',
    upcomingHoverBorder: 'hover:border-sky-300 hover:bg-sky-50/30',
    accentGradient: 'from-sky-500 to-blue-600'
  },
  3: {
    // Delivery & GRN: Amber / Warm Gold / Orange
    name: 'Delivery & GRN',
    completedCardBg: 'bg-gradient-to-br from-amber-50/95 via-orange-50/60 to-white',
    completedBorder: 'border-amber-200/90 hover:border-amber-400',
    completedTitleText: 'text-amber-950 font-bold',
    completedBadge: 'bg-amber-100/90 text-amber-800 border border-amber-200/90',
    completedBadgeText: 'text-amber-800 font-extrabold',
    completedNumberBg: 'bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-amber-300/50',
    completedBtnBg: 'bg-white/95 hover:bg-amber-50',
    completedBtnBorder: 'border-amber-200/90 hover:border-amber-300',
    completedBtnText: 'text-amber-950 font-bold',
    completedHoverShadow: 'hover:shadow-[0_8px_20px_-4px_rgba(245,158,11,0.25)]',

    activeCardBg: 'bg-gradient-to-br from-[#451a03] via-[#9a3412] to-[#c2410c]',
    activeBorder: 'border-amber-400/90',
    activeRing: 'ring-2 ring-amber-400/50',
    activeBadge: 'bg-amber-400/20 text-amber-200 border border-amber-300/40',
    activeGlow: 'shadow-[0_10px_25px_-5px_rgba(217,119,6,0.5)]',
    activeBtnBg: 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500',
    activeBtnText: 'text-white font-extrabold shadow-sm',

    upcomingNumberText: 'text-amber-500',
    upcomingNumberBg: 'bg-amber-50 border border-amber-100',
    upcomingHoverBorder: 'hover:border-amber-300 hover:bg-amber-50/30',
    accentGradient: 'from-amber-500 to-orange-600'
  },
  4: {
    // Invoicing: Fuchsia / Purple / Magenta
    name: 'Invoicing',
    completedCardBg: 'bg-gradient-to-br from-fuchsia-50/95 via-purple-50/60 to-white',
    completedBorder: 'border-fuchsia-200/90 hover:border-fuchsia-400',
    completedTitleText: 'text-fuchsia-950 font-bold',
    completedBadge: 'bg-fuchsia-100/90 text-fuchsia-800 border border-fuchsia-200/90',
    completedBadgeText: 'text-fuchsia-800 font-extrabold',
    completedNumberBg: 'bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white shadow-fuchsia-300/50',
    completedBtnBg: 'bg-white/95 hover:bg-fuchsia-50',
    completedBtnBorder: 'border-fuchsia-200/90 hover:border-fuchsia-300',
    completedBtnText: 'text-fuchsia-950 font-bold',
    completedHoverShadow: 'hover:shadow-[0_8px_20px_-4px_rgba(217,70,239,0.25)]',

    activeCardBg: 'bg-gradient-to-br from-[#4a044e] via-[#86198f] to-[#a21caf]',
    activeBorder: 'border-fuchsia-400/90',
    activeRing: 'ring-2 ring-fuchsia-400/50',
    activeBadge: 'bg-fuchsia-400/20 text-fuchsia-200 border border-fuchsia-300/40',
    activeGlow: 'shadow-[0_10px_25px_-5px_rgba(162,28,175,0.5)]',
    activeBtnBg: 'bg-gradient-to-r from-fuchsia-500 via-fuchsia-600 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500',
    activeBtnText: 'text-white font-extrabold shadow-sm',

    upcomingNumberText: 'text-fuchsia-500',
    upcomingNumberBg: 'bg-fuchsia-50 border border-fuchsia-100',
    upcomingHoverBorder: 'hover:border-fuchsia-300 hover:bg-fuchsia-50/30',
    accentGradient: 'from-fuchsia-500 to-purple-600'
  },
  5: {
    // Settlement: Emerald / Teal / Mint
    name: 'Settlement',
    completedCardBg: 'bg-gradient-to-br from-emerald-50/95 via-teal-50/60 to-white',
    completedBorder: 'border-emerald-200/90 hover:border-emerald-400',
    completedTitleText: 'text-emerald-950 font-bold',
    completedBadge: 'bg-emerald-100/90 text-emerald-800 border border-emerald-200/90',
    completedBadgeText: 'text-emerald-800 font-extrabold',
    completedNumberBg: 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-emerald-300/50',
    completedBtnBg: 'bg-white/95 hover:bg-emerald-50',
    completedBtnBorder: 'border-emerald-200/90 hover:border-emerald-300',
    completedBtnText: 'text-emerald-950 font-bold',
    completedHoverShadow: 'hover:shadow-[0_8px_20px_-4px_rgba(16,185,129,0.25)]',

    activeCardBg: 'bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#059669]',
    activeBorder: 'border-emerald-400/90',
    activeRing: 'ring-2 ring-emerald-400/50',
    activeBadge: 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/40',
    activeGlow: 'shadow-[0_10px_25px_-5px_rgba(5,150,105,0.5)]',
    activeBtnBg: 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500',
    activeBtnText: 'text-white font-extrabold shadow-sm',

    upcomingNumberText: 'text-emerald-500',
    upcomingNumberBg: 'bg-emerald-50 border border-emerald-100',
    upcomingHoverBorder: 'hover:border-emerald-300 hover:bg-emerald-50/30',
    accentGradient: 'from-emerald-500 to-teal-600'
  }
};

export function determineCurrentLifecycleStage({
  status,
  lifecycleStage,
  awards = [],
  activeAward,
  purchaseOrders = [],
  activeOrder,
  hasApprovedGrn,
  invoices = []
}: {
  status?: string;
  lifecycleStage?: string;
  awards?: any[];
  activeAward?: any;
  purchaseOrders?: any[];
  activeOrder?: any;
  hasApprovedGrn?: boolean;
  invoices?: any[];
}): LifecycleStageId {
  const statusUpper = String(status || '').toUpperCase().trim();
  const stageUpper = String(lifecycleStage || '').toUpperCase().trim();
  const poStatusUpper = String(
    activeOrder?.poStatus ||
    activeOrder?.status ||
    purchaseOrders[0]?.poStatus ||
    purchaseOrders[0]?.status ||
    ''
  ).toUpperCase().trim();

  // Combine invoices from activeOrder and standalone invoices
  const allInvoices = [
    ...(Array.isArray(invoices) ? invoices : []),
    ...(Array.isArray(activeOrder?.invoices) ? activeOrder.invoices : []),
    ...(Array.isArray(purchaseOrders[0]?.invoices) ? purchaseOrders[0].invoices : [])
  ];

  const hasSettledInvoice = allInvoices.some(inv => {
    const s = String(inv.invoiceStatus || inv.status || '').toUpperCase();
    return s === 'SETTLED' || s === 'PAID';
  });

  const hasPaymentSubmitted = allInvoices.some(inv => {
    const s = String(inv.invoiceStatus || inv.status || '').toUpperCase();
    return s === 'PAYMENT_SUBMITTED' || Boolean(inv.paymentReference);
  });

  const hasActiveInvoice = allInvoices.length > 0 && allInvoices.some(inv => {
    const s = String(inv.invoiceStatus || inv.status || '').toUpperCase();
    return s !== 'REJECTED' && s !== 'CANCELLED' && s !== 'DRAFT';
  });

  // Stage 5: Settlement
  if (
    statusUpper === 'COMPLETED' ||
    statusUpper === 'PAYMENT_COMPLETED' ||
    poStatusUpper === 'COMPLETED' ||
    poStatusUpper === 'PAID' ||
    hasSettledInvoice ||
    hasPaymentSubmitted
  ) {
    return 5;
  }

  // Stage 4: Invoicing
  if (
    statusUpper === 'INVOICE_SUBMITTED' ||
    poStatusUpper === 'INVOICED' ||
    poStatusUpper === 'INVOICE_SUBMITTED' ||
    hasActiveInvoice ||
    hasApprovedGrn ||
    activeOrder?.grns?.some((g: any) => String(g.status || '').toUpperCase() === 'APPROVED')
  ) {
    return 4;
  }

  // Stage 3: Delivery & GRN
  if (
    statusUpper === 'IN_PROGRESS' ||
    statusUpper === 'DELIVERED' ||
    statusUpper === 'GRN_COMPLETED' ||
    poStatusUpper === 'ACCEPTED' ||
    poStatusUpper === 'DISPATCHED' ||
    poStatusUpper === 'IN_FULFILLMENT' ||
    poStatusUpper === 'DELIVERED' ||
    poStatusUpper === 'GRN_APPROVED' ||
    (activeOrder && poStatusUpper !== 'ISSUED' && poStatusUpper !== 'GENERATED' && poStatusUpper !== 'ORDER_PLACED')
  ) {
    return 3;
  }

  // Stage 2: Award & PO
  const hasOfferedOrAcceptedAward =
    (awards && awards.some(a => ['OFFERED', 'ACCEPTED', 'RECOMMENDED', 'ADMIN_APPROVED'].includes(String(a.awardStatus || '').toUpperCase()))) ||
    Boolean(activeAward) ||
    ['AWARD_OFFERED', 'AWARD_ACCEPTED', 'AWARD_RECOMMENDED', 'AWARDED', 'PO_GENERATED', 'ORDERED'].includes(statusUpper) ||
    ['AWARD_OFFERED', 'AWARD_ACCEPTED', 'AWARD_RECOMMENDED', 'AWARDED', 'PO_GENERATED', 'ORDERED'].includes(stageUpper) ||
    Boolean(activeOrder) ||
    purchaseOrders.length > 0;

  if (hasOfferedOrAcceptedAward) {
    return 2;
  }

  // Stage 1: Evaluation (Default initial)
  return 1;
}

export function ProcurementLifecycleStepper({
  status,
  lifecycleStage,
  awards,
  activeAward,
  purchaseOrders,
  activeOrder,
  hasApprovedGrn,
  invoices,
  isBuyer = true,
  isStandby = false,
  isSellerParticipated = false,
  myParticipation,
  canSubmitBid = false,
  submittedBidsCount,
  onSubmitClick,
  onViewQuotationClick,
  onNavigateStage,
  onViewEvaluation,
  onViewPO,
  onNavigateDelivery,
  onNavigateInvoice,
  onNavigateSettlement,
  onOpenPackDialog,
  onOpenDispatchDialog,
  onOpenGrnCreate,
  onOpenCreateInvoice,
  onOpenPaymentModal,
  onOpenSettlementModal,
  onOpenViewPaymentProof,
  fulfillmentPhase
}: ProcurementLifecycleStepperProps) {
  const router = useRouter();

  const currentStageId = useMemo(
    () =>
      determineCurrentLifecycleStage({
        status,
        lifecycleStage,
        awards,
        activeAward,
        purchaseOrders,
        activeOrder,
        hasApprovedGrn,
        invoices
      }),
    [status, lifecycleStage, awards, activeAward, purchaseOrders, activeOrder, hasApprovedGrn, invoices]
  );

  // Extract contextual identifiers
  const effectiveActiveOrder = activeOrder || purchaseOrders?.[0];
  const effectivePoNumber = effectiveActiveOrder?.poNumber || effectiveActiveOrder?.id;
  const effectiveAmount = activeOrder?.amount || activeOrder?.totalValue || activeAward?.finalAmount;

  const allInvoicesList = useMemo(() => [
    ...(Array.isArray(invoices) ? invoices : []),
    ...(Array.isArray(activeOrder?.invoices) ? activeOrder.invoices : []),
    ...(Array.isArray(purchaseOrders?.[0]?.invoices) ? purchaseOrders[0].invoices : [])
  ], [invoices, activeOrder, purchaseOrders]);

  const hasSettledInvoice = allInvoicesList.some(inv => {
    const s = String(inv.invoiceStatus || inv.status || '').toUpperCase();
    return s === 'SETTLED' || s === 'PAID';
  });

  const isContractSettled = useMemo(() => {
    const statusUpper = String(status || '').toUpperCase().trim();
    const poStatusUpper = String(effectiveActiveOrder?.poStatus || effectiveActiveOrder?.status || '').toUpperCase().trim();
    return statusUpper === 'COMPLETED' || poStatusUpper === 'COMPLETED' || hasSettledInvoice;
  }, [status, effectiveActiveOrder, hasSettledInvoice]);

  const currentStageConfig = LIFECYCLE_STAGES.find(s => s.id === currentStageId) || LIFECYCLE_STAGES[0];
  const stageHint = isContractSettled
    ? 'All contract milestones successfully completed & funds settled'
    : isBuyer
      ? currentStageConfig.buyerHint
      : isStandby && currentStageId === 2
        ? 'Award processing with primary bidder — You remain on standby reserve'
        : currentStageConfig.sellerHint;

  // Compute strictly conditional action & status for each stage
  const getStageAction = (stageId: LifecycleStageId): {
    hasAction: boolean;
    actionLabel?: string;
    actionHint?: string;
    idleStatusText?: string;
    onClick?: () => void;
    isPrimary?: boolean;
  } => {
    switch (stageId) {
      case 1: {
        // Stage 1: Evaluation / Quotation
        if (!isBuyer) {
          if (isSellerParticipated) {
            return {
              hasAction: true,
              actionLabel: 'View My Quotation',
              actionHint: 'Open your submitted quotation dialog modal',
              onClick: () => {
                if (onViewQuotationClick) onViewQuotationClick();
                else if (onViewEvaluation) onViewEvaluation();
              },
              isPrimary: false
            };
          } else if (canSubmitBid && onSubmitClick) {
            return {
              hasAction: true,
              actionLabel: 'Submit Quotation',
              actionHint: 'Participate and submit formal quotation',
              onClick: onSubmitClick,
              isPrimary: true
            };
          } else {
            return {
              hasAction: false,
              idleStatusText: 'Awaiting Window'
            };
          }
        } else {
          // Buyer
          const bidsCount = (submittedBidsCount !== undefined) ? submittedBidsCount : (awards?.length || 0);
          if (bidsCount > 0) {
            return {
              hasAction: true,
              actionLabel: `Review Bids (${bidsCount})`,
              actionHint: 'Review submitted bidder proposals',
              onClick: onViewEvaluation,
              isPrimary: currentStageId === 1
            };
          } else {
            return {
              hasAction: false,
              idleStatusText: 'Awaiting Bids'
            };
          }
        }
      }

      case 2: {
        // Stage 2: Award & PO
        const poExists = Boolean(effectiveActiveOrder) || (purchaseOrders && purchaseOrders.length > 0);
        if (poExists) {
          return {
            hasAction: true,
            actionLabel: isBuyer ? (effectivePoNumber ? `View PO #${effectivePoNumber}` : 'View PO') : 'View PO Copy',
            actionHint: 'Open purchase order dialog modal',
            onClick: () => {
              if (onViewPO) onViewPO();
              else router.push(isBuyer ? '/buyer/orders' : '/seller/orders');
            },
            isPrimary: currentStageId === 2
          };
        } else {
          return {
            hasAction: false,
            idleStatusText: currentStageId < 2 ? 'Pending Evaluation' : 'Pending PO Issue'
          };
        }
      }

      case 3: {
        // Stage 3: Delivery & GRN
        const isOrderActive = Boolean(effectiveActiveOrder);
        const poStatus = String(effectiveActiveOrder?.poStatus || effectiveActiveOrder?.status || '').toLowerCase();
        const isDeliveryPhase = isOrderActive && (
          ['accepted', 'in_fulfillment', 'dispatched', 'delivered', 'grn_approved', 'grn_completed', 'invoiced', 'completed', 'paid'].includes(poStatus) ||
          Boolean(hasApprovedGrn)
        );

        if (!isDeliveryPhase) {
          return {
            hasAction: false,
            idleStatusText: 'Pending Acceptance'
          };
        }

        const grnApproved = Boolean(hasApprovedGrn) || poStatus === 'grn_approved' || poStatus === 'grn_completed';

        if (!isBuyer) {
          // SELLER
          if (fulfillmentPhase === 'PO_ACCEPTED_AWAITING_PACK' || (!poStatus.includes('dispatch') && !poStatus.includes('delivered') && !grnApproved)) {
            return {
              hasAction: true,
              actionLabel: '📦 Pack Order',
              actionHint: 'Open packing console to record package dimensions',
              onClick: () => {
                if (onOpenPackDialog) onOpenPackDialog();
                else if (onNavigateDelivery) onNavigateDelivery();
              },
              isPrimary: true
            };
          }
          if (fulfillmentPhase === 'PACKED') {
            return {
              hasAction: true,
              actionLabel: '🚚 Enter Dispatch',
              actionHint: 'Enter carrier, tracking LR/AWB, and vehicle details',
              onClick: () => {
                if (onOpenDispatchDialog) onOpenDispatchDialog();
                else if (onNavigateDelivery) onNavigateDelivery();
              },
              isPrimary: true
            };
          }
          return {
            hasAction: true,
            actionLabel: grnApproved ? 'View GRN' : '📍 Track Dispatch',
            actionHint: 'View carrier dispatch tracking & delivery milestones',
            onClick: () => {
              if (onOpenDispatchDialog) onOpenDispatchDialog();
              else if (onNavigateDelivery) onNavigateDelivery();
            },
            isPrimary: false
          };
        } else {
          // BUYER
          if (grnApproved) {
            return {
              hasAction: true,
              actionLabel: 'GRN Approved ✓',
              actionHint: 'Goods receipt verified and approved',
              onClick: onNavigateDelivery,
              isPrimary: false
            };
          }
          if (fulfillmentPhase === 'DELIVERED_PENDING_GRN' || poStatus === 'delivered') {
            return {
              hasAction: true,
              actionLabel: '📋 Inspect & Create GRN',
              actionHint: 'Inspect delivered items and create formal GRN',
              onClick: () => {
                if (onOpenGrnCreate) onOpenGrnCreate();
                else if (onNavigateDelivery) onNavigateDelivery();
              },
              isPrimary: true
            };
          }
          return {
            hasAction: true,
            actionLabel: '🚚 Track Shipment',
            actionHint: 'View carrier dispatch tracking details',
            onClick: () => {
              if (onOpenDispatchDialog) onOpenDispatchDialog();
              else if (onNavigateDelivery) onNavigateDelivery();
            },
            isPrimary: false
          };
        }
      }

      case 4: {
        // Stage 4: Invoicing (Can be generated post PO acceptance to accompany delivery)
        const validInvoice = allInvoicesList.find(
          inv => !['CANCELLED', 'DRAFT'].includes(String(inv.status || inv.invoiceStatus || '').toUpperCase())
        );

        if (validInvoice) {
          const invNo = validInvoice.invoiceNumber || validInvoice.id;
          return {
            hasAction: true,
            actionLabel: invNo ? `Inv #${invNo}` : 'View Tax Invoice',
            actionHint: 'Open invoice details dialog',
            onClick: () => {
              if (onNavigateInvoice) onNavigateInvoice(validInvoice);
              else {
                const invParam = invNo ? `?viewInvoiceNo=${encodeURIComponent(invNo)}` : '';
                router.push(isBuyer ? `/buyer/invoices${invParam}` : `/seller/invoices${invParam}`);
              }
            },
            isPrimary: currentStageId === 4
          };
        } else if (
          !isBuyer &&
          effectiveActiveOrder &&
          currentStageId >= 2 &&
          ['accepted', 'in_fulfillment', 'dispatched', 'delivered', 'grn_approved', 'grn_completed'].includes(
            String(effectiveActiveOrder.status || effectiveActiveOrder.poStatus || '').toLowerCase()
          )
        ) {
          return {
            hasAction: true,
            actionLabel: '🧾 Create Tax Invoice',
            actionHint: 'Generate tax invoice to accompany delivery shipment',
            onClick: () => {
              if (onOpenCreateInvoice) onOpenCreateInvoice();
              else if (onNavigateInvoice) onNavigateInvoice();
              else {
                const amtVal = effectiveActiveOrder.amount || effectiveActiveOrder.totalValue || activeAward?.finalAmount || 0;
                router.push(`/seller/invoices?convertPoId=${effectiveActiveOrder.id}&amount=${amtVal}`);
              }
            },
            isPrimary: true
          };
        } else {
          return {
            hasAction: false,
            idleStatusText: isBuyer ? 'Awaiting Invoice' : 'PO Required'
          };
        }
      }

      case 5: {
        // Stage 5: Settlement
        const poStatusUpper = String(effectiveActiveOrder?.poStatus || effectiveActiveOrder?.status || '').toUpperCase().trim();
        const hasPaymentSub = allInvoicesList.some(inv => {
          const s = String(inv.invoiceStatus || inv.status || '').toUpperCase();
          return s === 'PAYMENT_SUBMITTED' || Boolean(inv.paymentReference) || Boolean(inv.paymentSlipFileId);
        }) || Boolean(effectiveActiveOrder?.paymentSlipFileId) || Boolean((effectiveActiveOrder as any)?.paymentProof);

        if (isBuyer) {
          if (isContractSettled) {
            return {
              hasAction: true,
              actionLabel: 'Contract Settled ✓',
              actionHint: 'Order completed and settled',
              onClick: () => {
                if (onOpenViewPaymentProof) onOpenViewPaymentProof(effectiveActiveOrder);
                else if (onNavigateSettlement) onNavigateSettlement();
              },
              isPrimary: false
            };
          }
          if (hasPaymentSub || poStatusUpper === 'PAID') {
            return {
              hasAction: true,
              actionLabel: '📄 View Payment Proof',
              actionHint: 'Payment submitted, awaiting seller settlement confirmation',
              onClick: () => {
                if (onOpenViewPaymentProof) onOpenViewPaymentProof(effectiveActiveOrder);
                else if (onNavigateSettlement) onNavigateSettlement();
              },
              isPrimary: false
            };
          }
          // STRICT BUYER GATING: Buyer can ONLY pay once in Stage 4/5 with an active PO & invoice/GRN!
          const canBuyerPay = currentStageId >= 4 && (hasApprovedGrn || allInvoicesList.length > 0 || currentStageId === 5);
          if (canBuyerPay) {
            return {
              hasAction: true,
              actionLabel: '💰 Make Payment',
              actionHint: 'Pay online or record UTR and payment proof',
              onClick: () => {
                if (onOpenPaymentModal) onOpenPaymentModal(effectiveActiveOrder);
                else if (onNavigateSettlement) onNavigateSettlement();
              },
              isPrimary: true
            };
          } else {
            return {
              hasAction: false,
              idleStatusText: currentStageId < 2 ? 'Pending Evaluation' : currentStageId === 2 ? 'Pending PO Issue' : currentStageId === 3 ? 'Pending Delivery/GRN' : 'Pending Invoice'
            };
          }
        } else {
          // SELLER
          if (isContractSettled) {
            return {
              hasAction: true,
              actionLabel: 'Contract Settled ✓',
              actionHint: 'Funds received and contract settled',
              onClick: () => {
                if (onOpenViewPaymentProof) onOpenViewPaymentProof(effectiveActiveOrder);
                else if (onNavigateSettlement) onNavigateSettlement();
              },
              isPrimary: false
            };
          }
          // STRICT GATING: Seller ONLY sees settlement actions if buyer has submitted payment!
          if (hasPaymentSub || poStatusUpper === 'PAID') {
            return {
              hasAction: true,
              actionLabel: '✅ Confirm Settlement',
              actionHint: 'Inspect payment proof and confirm funds receipt',
              onClick: () => {
                if (onOpenSettlementModal) onOpenSettlementModal(effectiveActiveOrder);
                else if (onNavigateSettlement) onNavigateSettlement();
              },
              isPrimary: true
            };
          }
          return {
            hasAction: false,
            idleStatusText: 'Awaiting Buyer Payment'
          };
        }
      }
    }
  };

  return (
    <nav
      aria-label="Procurement Lifecycle Highway"
      className="w-full rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-2.5 sm:p-3 shadow-xs transition-all relative overflow-hidden group/highway"
    >
      {/* Background ambient multi-color portal auras */}
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 -bottom-16 h-44 w-44 rounded-full bg-gradient-to-tl from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl"
        aria-hidden="true"
      />

      {/* Slim Header Bar */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-100/90 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-blue-600 to-teal-500 text-white shadow-xs ring-1 ring-blue-500/20">
            <Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <h2 className="text-[11.5px] font-black uppercase tracking-wider bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 bg-clip-text text-transparent leading-none">
              Procurement Highway
            </h2>
            <span className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 px-2 py-0.5 text-[9.5px] font-extrabold text-indigo-900 shadow-2xs">
              {isContractSettled ? '5 / 5 Completed' : `Stage ${currentStageId}/5: ${currentStageConfig.name}`}
            </span>
            <span className="hidden md:inline-block text-[10px] text-slate-300">|</span>
            <p className="hidden md:inline-block text-[11px] font-medium text-slate-600 leading-tight truncate">
              {stageHint}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isContractSettled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800 border border-emerald-300 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
              Contract Fully Settled
            </span>
          ) : isStandby && currentStageId === 2 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10.5px] font-bold text-sky-800 border border-sky-200 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse shrink-0" aria-hidden="true" />
              Award in Progress (Standby)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 px-2.5 py-0.5 text-[10.5px] font-black text-indigo-900 border border-indigo-200/80 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-ping shrink-0" aria-hidden="true" />
              Active: {currentStageConfig.name}
            </span>
          )}
        </div>
      </div>

      {/* Animated Multi-Color Liquid Rainbow Progress Bar */}
      <div className="pt-2 pb-1 hidden sm:block relative z-10">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 via-amber-500 via-fuchsia-500 to-emerald-500 transition-all duration-700 ease-out shadow-xs"
            style={{
              width: isContractSettled
                ? '100%'
                : `${Math.min(100, Math.max(14, ((currentStageId - 1) / 4) * 86 + 14))}%`
            }}
          />
        </div>
      </div>

      {/* 5-Stage Stepper Grid */}
      <ol
        role="list"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-2 relative z-10"
      >
        {LIFECYCLE_STAGES.map((stage) => {
          const isCompleted = currentStageId > stage.id || (stage.id === 5 && isContractSettled);
          const isActive = currentStageId === stage.id && !isContractSettled;
          const isUpcoming = currentStageId < stage.id;
          const stageAction = getStageAction(stage.id);
          const theme = STAGE_VISUAL_THEMES[stage.id] || STAGE_VISUAL_THEMES[1];

          return (
            <li
              key={stage.id}
              role="listitem"
              title={`${stage.name}: ${stage.description}`}
              aria-current={isActive ? 'step' : undefined}
              tabIndex={stageAction.hasAction ? 0 : -1}
              onKeyDown={(e) => {
                if (stageAction.hasAction && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  if (stageAction.onClick) stageAction.onClick();
                }
              }}
              onClick={() => {
                if (stageAction.hasAction && stageAction.onClick) {
                  stageAction.onClick();
                }
              }}
              className={cn(
                'group relative flex flex-col justify-between rounded-xl p-2 sm:p-2.5 border transition-all duration-300 outline-none select-none min-h-[52px] sm:min-h-[54px] overflow-hidden',
                stageAction.hasAction ? 'cursor-pointer' : 'cursor-default',
                'focus-visible:ring-2 focus-visible:ring-offset-1',
                // Completed State: Distinct stage gradient background, colored border, and floating hover aura
                isCompleted && cn(
                  theme.completedCardBg,
                  theme.completedBorder,
                  theme.completedHoverShadow,
                  'shadow-2xs hover:-translate-y-1 hover:scale-[1.01]'
                ),
                // Active State: Luminous rich jewel-tone gradient, breathing ring, and prominent aura glow
                isActive && cn(
                  theme.activeCardBg,
                  theme.activeBorder,
                  theme.activeRing,
                  theme.activeGlow,
                  'text-white hover:-translate-y-1 hover:scale-[1.015]'
                ),
                // Upcoming State: Soft frosted glass card with subtle stage-tinted hover
                isUpcoming && cn(
                  'bg-white/80 border-slate-200/90 text-slate-600 hover:bg-white',
                  theme.upcomingHoverBorder,
                  'hover:-translate-y-0.5 hover:shadow-2xs'
                )
              )}
            >
              {/* Row 1: Indicator + Stage Title + Status Badge */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[9.5px] font-black font-mono transition-transform duration-300 group-hover:scale-110 shadow-2xs',
                      isCompleted && theme.completedNumberBg,
                      isActive && 'bg-white text-slate-950 font-black shadow-sm',
                      isUpcoming && cn(theme.upcomingNumberBg, theme.upcomingNumberText, 'font-bold')
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-2.5 w-2.5 stroke-[2.8]" aria-hidden="true" />
                    ) : (
                      `0${stage.id}`
                    )}
                  </span>

                  <h3
                    className={cn(
                      'text-[11.5px] font-bold tracking-tight truncate leading-tight',
                      isCompleted && theme.completedTitleText,
                      isActive && 'text-white font-extrabold',
                      isUpcoming && 'text-slate-700 group-hover:text-slate-900'
                    )}
                  >
                    {stage.name}
                  </h3>
                </div>

                <span
                  className={cn(
                    'text-[8.5px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.2 rounded transition-colors',
                    isCompleted && theme.completedBadge,
                    isActive && theme.activeBadge,
                    isUpcoming && 'text-slate-400 bg-slate-100/80 border border-slate-200/60'
                  )}
                >
                  {isCompleted && (stage.id === 5 ? 'Settled ✓' : 'Done ✓')}
                  {isActive && (
                    <span className="flex items-center gap-1 font-black">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                      <span className="truncate">{isStandby && stage.id === 2 ? 'Standby' : 'Active'}</span>
                    </span>
                  )}
                  {isUpcoming && 'Pending'}
                </span>
              </div>

              {/* Row 2: Compact Action CTA Button or Clean State Pill */}
              <div className="pt-1 mt-1 border-t border-slate-100/80 group-data-[active=true]:border-white/10">
                {stageAction.hasAction ? (
                  <button
                    type="button"
                    aria-label={`${stage.name}: ${stageAction.actionLabel}`}
                    title={stageAction.actionHint}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (stageAction.onClick) stageAction.onClick();
                    }}
                    className={cn(
                      'w-full inline-flex items-center justify-center gap-1 rounded h-5.5 px-1.5 text-[9.5px] font-bold tracking-tight transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 group/btn',
                      stageAction.isPrimary
                        ? cn(theme.activeBtnBg, theme.activeBtnText)
                        : isCompleted
                          ? cn(theme.completedBtnBg, theme.completedBtnBorder, theme.completedBtnText, 'border hover:scale-[1.01]')
                          : isActive
                            ? 'bg-white hover:bg-slate-100 text-slate-950 font-black border border-white/60 shadow-md hover:scale-[1.01]'
                            : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 hover:scale-[1.01]'
                    )}
                  >
                    <span className="truncate">{stageAction.actionLabel}</span>
                    <ArrowUpRight className="h-2 w-2 shrink-0 opacity-75 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" aria-hidden="true" />
                  </button>
                ) : (
                  <div
                    className={cn(
                      'w-full flex items-center justify-center h-5.5 rounded px-1.5 transition-colors',
                      isActive
                        ? 'bg-white/15 border border-white/30 text-white font-bold text-[9.5px]'
                        : 'bg-slate-100/70 border border-slate-200/50 text-slate-400 font-medium text-[9px]'
                    )}
                  >
                    {isActive && <Clock className="h-2 w-2 mr-1 text-white/80 shrink-0" aria-hidden="true" />}
                    <span className="truncate font-semibold">
                      {stageAction.idleStatusText || 'Pending'}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ProcurementLifecycleStepper;
