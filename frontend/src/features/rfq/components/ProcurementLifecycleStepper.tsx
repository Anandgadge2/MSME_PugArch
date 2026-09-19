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
  onNavigateInvoice?: () => void;
  onNavigateSettlement?: () => void;
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
    description: 'GRN-Gated Tax Invoicing',
    buyerHint: 'Review and approve verified tax invoice',
    sellerHint: 'Create tax invoice capped to accepted GRN',
    icon: FileText
  },
  {
    id: 5,
    name: 'Settlement',
    shortName: 'Settlement',
    description: 'Bank Payment & Contract Close',
    buyerHint: 'Record UTR transfer & upload bank slip',
    sellerHint: 'Verify funds receipt & close order',
    icon: ShieldCheck
  }
];

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
  onNavigateSettlement
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

  const currentStageConfig = LIFECYCLE_STAGES.find(s => s.id === currentStageId) || LIFECYCLE_STAGES[0];
  const stageHint = isBuyer
    ? currentStageConfig.buyerHint
    : isStandby && currentStageId === 2
      ? 'Award processing with primary bidder — You remain on standby reserve'
      : currentStageConfig.sellerHint;

  // Extract contextual identifiers
  const effectiveActiveOrder = activeOrder || purchaseOrders?.[0];
  const effectivePoNumber = effectiveActiveOrder?.poNumber || effectiveActiveOrder?.id;
  const effectiveAmount = activeOrder?.amount || activeOrder?.totalValue || activeAward?.finalAmount;

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

        if (isDeliveryPhase) {
          const grnApproved = Boolean(hasApprovedGrn) || poStatus === 'grn_approved' || poStatus === 'grn_completed';
          return {
            hasAction: true,
            actionLabel: isBuyer
              ? (grnApproved ? 'GRN Approved' : 'Inspect GRN')
              : (grnApproved ? 'View GRN' : 'Track Dispatch'),
            actionHint: 'View delivery dispatch / GRN inspection details',
            onClick: () => {
              if (onNavigateDelivery) onNavigateDelivery();
              else {
                const searchQ = effectivePoNumber ? `?search=${encodeURIComponent(effectivePoNumber)}` : '';
                router.push(isBuyer ? `/buyer/grn${searchQ}` : `/seller/delivery-management${searchQ}`);
              }
            },
            isPrimary: currentStageId === 3
          };
        } else {
          return {
            hasAction: false,
            idleStatusText: 'Pending Acceptance'
          };
        }
      }

      case 4: {
        // Stage 4: Invoicing
        const allInvoicesList = [
          ...(Array.isArray(invoices) ? invoices : []),
          ...(Array.isArray(activeOrder?.invoices) ? activeOrder.invoices : [])
        ];
        const validInvoice = allInvoicesList.find(
          inv => !['CANCELLED', 'DRAFT'].includes(String(inv.status || inv.invoiceStatus || '').toUpperCase())
        );

        if (validInvoice) {
          const invNo = validInvoice.invoiceNumber || validInvoice.id;
          return {
            hasAction: true,
            actionLabel: invNo ? `Inv #${invNo}` : 'View Invoice',
            actionHint: 'Open invoice details dialog',
            onClick: () => {
              if (onNavigateInvoice) onNavigateInvoice();
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
          currentStageId >= 3 &&
          ['accepted', 'in_fulfillment', 'dispatched', 'delivered', 'grn_approved', 'grn_completed'].includes(
            String(effectiveActiveOrder.status || effectiveActiveOrder.poStatus || '').toLowerCase()
          )
        ) {
          const amtVal = effectiveActiveOrder.amount || effectiveActiveOrder.totalValue || activeAward?.finalAmount || 0;
          return {
            hasAction: true,
            actionLabel: '⚡ Create Invoice',
            actionHint: 'Create tax invoice pre-filled from this Purchase Order',
            onClick: () => {
              if (onNavigateInvoice) onNavigateInvoice();
              else router.push(`/seller/invoices?convertPoId=${effectiveActiveOrder.id}&amount=${amtVal}`);
            },
            isPrimary: true
          };
        } else {
          return {
            hasAction: false,
            idleStatusText: 'GRN Required'
          };
        }
      }

      case 5: {
        // Stage 5: Settlement
        const statusUpper = String(status || '').toUpperCase().trim();
        const poStatusUpper = String(activeOrder?.poStatus || activeOrder?.status || '').toUpperCase().trim();
        const allInvoicesList = [
          ...(Array.isArray(invoices) ? invoices : []),
          ...(Array.isArray(activeOrder?.invoices) ? activeOrder.invoices : [])
        ];
        const hasSettled = allInvoicesList.some(inv => {
          const s = String(inv.invoiceStatus || inv.status || '').toUpperCase();
          return s === 'SETTLED' || s === 'PAID';
        });
        const hasPaymentSub = allInvoicesList.some(inv => {
          const s = String(inv.invoiceStatus || inv.status || '').toUpperCase();
          return s === 'PAYMENT_SUBMITTED' || Boolean(inv.paymentReference);
        });

        const isSettlementActive =
          statusUpper === 'COMPLETED' ||
          statusUpper === 'PAYMENT_COMPLETED' ||
          poStatusUpper === 'COMPLETED' ||
          poStatusUpper === 'PAID' ||
          hasSettled ||
          hasPaymentSub;

        if (isSettlementActive) {
          return {
            hasAction: true,
            actionLabel: isBuyer ? 'Payment Ledger' : 'Settlement Status',
            actionHint: 'View UTR transaction and bank settlement record',
            onClick: () => {
              if (onNavigateSettlement) onNavigateSettlement();
              else {
                const searchQ = effectivePoNumber ? `?search=${encodeURIComponent(effectivePoNumber)}` : '';
                router.push(isBuyer ? `/buyer/payments${searchQ}` : `/seller/invoices${searchQ}`);
              }
            },
            isPrimary: currentStageId === 5
          };
        } else {
          return {
            hasAction: false,
            idleStatusText: 'Pending Payment'
          };
        }
      }
    }
  };

  return (
    <nav
      aria-label="Procurement Lifecycle Highway"
      className="w-full rounded-xl border border-slate-200/90 bg-white/95 p-2 sm:p-2.5 shadow-2xs transition-all relative overflow-hidden"
    >
      {/* Background ambient portal aura */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-gradient-to-br from-[#12335f]/8 via-sky-500/5 to-transparent blur-2xl"
        aria-hidden="true"
      />

      {/* Slim Header Bar */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-1.5 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#12335f] text-white shadow-2xs ring-2 ring-[#12335f]/10">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
            <h2 className="text-[10.5px] font-black uppercase tracking-wider text-[#12335f] leading-tight">
              Procurement Highway
            </h2>
            <span className="hidden sm:inline-block text-[10px] text-slate-300 font-normal">|</span>
            <p className="text-[10px] sm:text-[10.5px] font-medium text-slate-500 leading-tight truncate">
              Stage {currentStageId}/5: <strong className="font-extrabold text-slate-900">{currentStageConfig.name}</strong> — {stageHint}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-slate-700 border border-slate-200 shadow-2xs">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full shrink-0',
                currentStageId === 5
                  ? 'bg-emerald-500'
                  : isStandby && currentStageId === 2
                    ? 'bg-sky-500 animate-pulse'
                    : 'bg-emerald-500 animate-ping'
              )}
              aria-hidden="true"
            />
            {currentStageId === 5
              ? 'Contract Fully Settled'
              : isStandby && currentStageId === 2
                ? 'Award in Progress (Standby)'
                : `Active: ${currentStageConfig.shortName}`}
          </span>
        </div>
      </div>

      {/* 5-Stage Stepper Grid with Flowing Connector Highway Track */}
      <div className="relative">
        {/* Animated Highway Progress Track (Desktop) */}
        <div className="hidden sm:block absolute top-[13px] left-[8%] right-[8%] h-[2.5px] bg-slate-100 rounded-full overflow-hidden pointer-events-none z-0">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#12335f] transition-all duration-700 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, ((currentStageId - 1) / 4) * 100))}%`
            }}
          />
        </div>

        <ol
          role="list"
          className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 relative z-10"
        >
          {LIFECYCLE_STAGES.map((stage) => {
            const isCompleted = currentStageId > stage.id;
            const isActive = currentStageId === stage.id;
            const isUpcoming = currentStageId < stage.id;
            const Icon = stage.icon;
            const stageAction = getStageAction(stage.id);

            return (
              <li
                key={stage.id}
                role="listitem"
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
                  'group relative flex flex-col justify-between rounded-lg p-2 border transition-all duration-200 outline-none select-none min-h-[56px] sm:min-h-[58px]',
                  stageAction.hasAction ? 'cursor-pointer' : 'cursor-default',
                  'focus-visible:ring-2 focus-visible:ring-[#12335f] focus-visible:ring-offset-1',
                  // Completed State
                  isCompleted &&
                    'border-emerald-200/90 bg-gradient-to-b from-emerald-50/70 to-emerald-50/20 text-emerald-950 hover:border-emerald-400 hover:shadow-xs hover:-translate-y-0.5',
                  // Active State (Command Focus)
                  isActive &&
                    'border-[#12335f] bg-gradient-to-br from-[#12335f] via-[#102d54] to-[#0a1e38] text-white shadow-sm ring-1 ring-[#12335f]/30 hover:-translate-y-0.5 hover:shadow-md',
                  // Upcoming State
                  isUpcoming &&
                    'border-slate-200/70 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-100/60 hover:-translate-y-0.5'
                )}
              >
                {/* Top Row: Micro Stage Badge, Status Indicator, Icon */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-black font-mono transition-transform group-hover:scale-105',
                        isCompleted && 'bg-emerald-600 text-white shadow-2xs',
                        isActive && 'bg-white text-[#12335f] shadow-2xs font-extrabold',
                        isUpcoming && 'bg-slate-200 text-slate-600'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
                      ) : (
                        stage.id
                      )}
                    </span>

                    <span
                      className={cn(
                        'text-[8.5px] font-black uppercase tracking-wider truncate',
                        isCompleted && 'text-emerald-700',
                        isActive && 'text-emerald-300 font-extrabold flex items-center gap-1',
                        isUpcoming && 'text-slate-400 font-semibold'
                      )}
                    >
                      {isCompleted && 'Done'}
                      {isActive && (
                        <>
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span
                              className={cn(
                                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                                isStandby && stage.id === 2 ? 'bg-sky-400' : 'bg-emerald-400'
                              )}
                            />
                            <span
                              className={cn(
                                'relative inline-flex rounded-full h-1.5 w-1.5',
                                isStandby && stage.id === 2 ? 'bg-sky-400' : 'bg-emerald-400'
                              )}
                            />
                          </span>
                          <span className="truncate">{isStandby && stage.id === 2 ? 'Standby' : 'In Progress'}</span>
                        </>
                      )}
                      {isUpcoming && 'Pending'}
                    </span>
                  </div>

                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110',
                      isCompleted && 'text-emerald-600',
                      isActive && 'text-emerald-300',
                      isUpcoming && 'text-slate-400'
                    )}
                    aria-hidden="true"
                  />
                </div>

                {/* Middle Row: Stage Title */}
                <div className="my-0.5 min-w-0">
                  <h3
                    className={cn(
                      'text-[11px] sm:text-[11.5px] font-extrabold tracking-tight leading-snug truncate',
                      isCompleted && 'text-emerald-950',
                      isActive && 'text-white',
                      isUpcoming && 'text-slate-700'
                    )}
                  >
                    {stage.name}
                  </h3>
                </div>

                {/* Bottom Row: Strictly Conditional Action Button OR Clean Status Chip */}
                <div className="flex items-center justify-between gap-1 pt-0.5 mt-auto">
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
                        'w-full inline-flex items-center justify-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95',
                        stageAction.isPrimary
                          ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-xs font-black ring-1 ring-emerald-300/60'
                          : isCompleted
                            ? 'bg-white hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300/80'
                            : 'bg-white hover:bg-[#12335f] text-[#12335f] hover:text-white border border-slate-300'
                      )}
                    >
                      <span className="truncate">{stageAction.actionLabel}</span>
                      <ArrowUpRight className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-center py-0.5 rounded bg-slate-100/50 border border-slate-200/40">
                      <span className="text-[8.5px] font-semibold text-slate-400 truncate">
                        {stageAction.idleStatusText || 'Pending'}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

export default ProcurementLifecycleStepper;
