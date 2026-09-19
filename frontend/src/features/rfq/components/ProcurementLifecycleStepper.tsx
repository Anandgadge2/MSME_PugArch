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
  ChevronRight,
  Sparkles,
  ExternalLink,
  ArrowUpRight,
  Eye
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
  buyerActionLabel: string;
  sellerActionLabel: string;
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
    buyerActionLabel: 'Evaluation',
    sellerActionLabel: 'View Bids',
    icon: Scale
  },
  {
    id: 2,
    name: 'Award & PO',
    shortName: 'Award & PO',
    description: 'Mutual Consent & Order Binding',
    buyerHint: 'Offer award & issue formal Purchase Order',
    sellerHint: 'Accept award offer & commit to PO',
    buyerActionLabel: 'View PO',
    sellerActionLabel: 'View PO Copy',
    icon: Award
  },
  {
    id: 3,
    name: 'Delivery & GRN',
    shortName: 'Delivery & GRN',
    description: 'Dispatch & Physical Inspection',
    buyerHint: 'Inspect delivered items & approve GRN',
    sellerHint: 'Dispatch goods & submit delivery tracking',
    buyerActionLabel: 'Inspect GRN',
    sellerActionLabel: 'Dispatch Hub',
    icon: Truck
  },
  {
    id: 4,
    name: 'Invoicing',
    shortName: 'Invoicing',
    description: 'GRN-Gated Tax Invoicing',
    buyerHint: 'Review and approve verified tax invoice',
    sellerHint: 'Create tax invoice capped to accepted GRN',
    buyerActionLabel: 'Review Invoices',
    sellerActionLabel: 'Create Invoice',
    icon: FileText
  },
  {
    id: 5,
    name: 'Settlement',
    shortName: 'Settlement',
    description: 'Bank Payment & Contract Close',
    buyerHint: 'Record UTR transfer & upload bank slip',
    sellerHint: 'Verify funds receipt & close order',
    buyerActionLabel: 'Payment Ledger',
    sellerActionLabel: 'Settlement Status',
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

  // Extract contextual IDs
  const effectivePoNumber = activeOrder?.poNumber || activeOrder?.id || purchaseOrders?.[0]?.poNumber || purchaseOrders?.[0]?.id;
  const effectiveAmount = activeOrder?.amount || activeOrder?.totalValue || activeAward?.finalAmount;

  // Central dispatch handler for stage actions
  const handleStageAction = (stageId: LifecycleStageId, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (onNavigateStage) {
      onNavigateStage(stageId);
      return;
    }

    switch (stageId) {
      case 1:
        if (onViewEvaluation) {
          onViewEvaluation();
        } else {
          const tabSection = document.getElementById('tabpanel-clarifications') || document.getElementById('tabs-navigation-section');
          if (tabSection) {
            tabSection.scrollIntoView({ behavior: 'smooth' });
          }
        }
        break;

      case 2:
        if (onViewPO) {
          onViewPO();
        } else if (effectivePoNumber) {
          const poSection = document.getElementById('po-banner-section') || document.getElementById('tabs-navigation-section');
          if (poSection) {
            poSection.scrollIntoView({ behavior: 'smooth' });
          } else {
            router.push(isBuyer ? '/buyer/orders' : '/seller/orders');
          }
        }
        break;

      case 3:
        if (onNavigateDelivery) {
          onNavigateDelivery();
        } else {
          router.push(isBuyer ? '/buyer/grn' : '/seller/delivery-management');
        }
        break;

      case 4:
        if (onNavigateInvoice) {
          onNavigateInvoice();
        } else {
          if (!isBuyer && activeOrder?.id) {
            const amtParam = effectiveAmount ? `&amount=${effectiveAmount}` : '';
            router.push(`/seller/invoices?convertPoId=${activeOrder.id}${amtParam}`);
          } else {
            router.push(isBuyer ? '/buyer/invoices' : '/seller/invoices');
          }
        }
        break;

      case 5:
        if (onNavigateSettlement) {
          onNavigateSettlement();
        } else {
          router.push(isBuyer ? '/buyer/payments' : '/seller/invoices');
        }
        break;
    }
  };

  return (
    <nav
      aria-label="Procurement Lifecycle Highway"
      className="w-full rounded-xl border border-slate-200/90 bg-white/95 p-2 sm:p-2.5 shadow-2xs transition-all relative overflow-hidden"
    >
      {/* Background ambient glow for active progress */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-gradient-to-br from-indigo-500/5 via-sky-400/5 to-transparent blur-2xl"
        aria-hidden="true"
      />

      {/* Slim Header Bar */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-1.5 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#12335f] text-white shadow-2xs ring-2 ring-[#12335f]/10">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
            <h2 className="text-[10.5px] font-black uppercase tracking-wider text-slate-900 leading-tight">
              Procurement Highway
            </h2>
            <span className="hidden sm:inline-block text-[10px] text-slate-300 font-normal">|</span>
            <p className="text-[10px] sm:text-[10.5px] font-medium text-slate-500 leading-tight truncate">
              Stage {currentStageId}/5: <strong className="font-extrabold text-[#12335f]">{currentStageConfig.name}</strong> — {stageHint}
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

      {/* 5-Stage Stepper Grid with Interactive Action Buttons */}
      <ol
        role="list"
        className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 relative"
      >
        {LIFECYCLE_STAGES.map((stage) => {
          const isCompleted = currentStageId > stage.id;
          const isActive = currentStageId === stage.id;
          const isUpcoming = currentStageId < stage.id;
          const Icon = stage.icon;
          const actionLabel = isBuyer ? stage.buyerActionLabel : stage.sellerActionLabel;

          return (
            <li
              key={stage.id}
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleStageAction(stage.id);
                }
              }}
              onClick={() => handleStageAction(stage.id)}
              className={cn(
                'group relative flex flex-col justify-between rounded-lg p-2 border transition-all duration-200 cursor-pointer outline-none select-none min-h-[56px] sm:min-h-[58px]',
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
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full animate-ping shrink-0',
                            isStandby && stage.id === 2 ? 'bg-sky-400' : 'bg-emerald-400'
                          )}
                          aria-hidden="true"
                        />
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

              {/* Bottom Row: Quick Navigation Action Button */}
              <div className="flex items-center justify-between gap-1 pt-0.5 mt-auto">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Navigate to ${stage.name}`}
                  onClick={(e) => handleStageAction(stage.id, e)}
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer',
                    // Completed button style
                    isCompleted &&
                      'bg-white/80 text-emerald-800 border border-emerald-300/80 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-2xs',
                    // Active button style
                    isActive &&
                      'bg-emerald-400 text-slate-950 hover:bg-emerald-300 hover:scale-[1.02] shadow-xs font-black ring-1 ring-emerald-300/50',
                    // Upcoming button style
                    isUpcoming &&
                      'bg-white/60 text-slate-500 border border-slate-200/80 hover:bg-slate-200 hover:text-slate-800'
                  )}
                >
                  <span className="truncate">{actionLabel}</span>
                  <ArrowUpRight className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ProcurementLifecycleStepper;
