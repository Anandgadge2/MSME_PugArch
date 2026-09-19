'use client';

import React, { useMemo } from 'react';
import {
  Scale,
  Award,
  Truck,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '../../../lib/utils';

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
}

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
  const poStatusUpper = String(activeOrder?.poStatus || activeOrder?.status || (purchaseOrders[0]?.poStatus || purchaseOrders[0]?.status) || '').toUpperCase().trim();

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
  const hasOfferedOrAcceptedAward = (awards && awards.some(a => ['OFFERED', 'ACCEPTED', 'RECOMMENDED', 'ADMIN_APPROVED'].includes(String(a.awardStatus || '').toUpperCase()))) ||
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
  isBuyer = true
}: ProcurementLifecycleStepperProps) {
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

  return (
    <nav
      aria-label="Procurement Lifecycle Highway"
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all"
    >
      {/* Header bar of Stepper */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#12335f] text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Procurement Lifecycle Highway
            </h2>
            <p className="text-[11px] font-semibold text-slate-500">
              Stage {currentStageId} of 5: <span className="font-bold text-[#12335f]">{currentStageConfig.name}</span> — {isBuyer ? currentStageConfig.buyerHint : currentStageConfig.sellerHint}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-700 border border-slate-200">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                currentStageId === 5
                  ? 'bg-emerald-500'
                  : 'bg-indigo-600 animate-pulse'
              )}
            />
            {currentStageId === 5 ? 'Contract Fully Settled' : `Active Stage: ${currentStageConfig.shortName}`}
          </span>
        </div>
      </div>

      {/* 5-Stage Step Indicators */}
      <ol
        role="list"
        className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 sm:gap-2 relative"
      >
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isCompleted = currentStageId > stage.id;
          const isActive = currentStageId === stage.id;
          const isUpcoming = currentStageId < stage.id;
          const Icon = stage.icon;

          return (
            <li
              key={stage.id}
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'relative flex flex-col justify-between rounded-xl p-3 border transition-all select-none',
                isCompleted && 'border-emerald-200 bg-emerald-50/50 text-emerald-950 shadow-2xs',
                isActive && 'border-[#12335f] bg-gradient-to-b from-[#12335f] to-[#0c2445] text-white shadow-md ring-2 ring-[#12335f]/20',
                isUpcoming && 'border-slate-200 bg-slate-50/70 text-slate-500'
              )}
            >
              {/* Top Row: Badge & Icon */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black font-mono transition-colors',
                    isCompleted && 'bg-emerald-600 text-white',
                    isActive && 'bg-white text-[#12335f] shadow-xs',
                    isUpcoming && 'bg-slate-200 text-slate-600'
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4 stroke-[2.5]" /> : stage.id}
                </span>

                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isCompleted && 'text-emerald-700',
                    isActive && 'text-emerald-300',
                    isUpcoming && 'text-slate-400'
                  )}
                />
              </div>

              {/* Title & Description */}
              <div className="space-y-0.5">
                <h3
                  className={cn(
                    'text-xs font-black tracking-tight leading-tight',
                    isCompleted && 'text-emerald-950',
                    isActive && 'text-white',
                    isUpcoming && 'text-slate-700'
                  )}
                >
                  {stage.name}
                </h3>
                <p
                  className={cn(
                    'text-[10px] font-medium leading-normal line-clamp-2',
                    isCompleted && 'text-emerald-800/90',
                    isActive && 'text-slate-200',
                    isUpcoming && 'text-slate-500'
                  )}
                >
                  {stage.description}
                </p>
              </div>

              {/* Status Pill */}
              <div className="mt-2.5 pt-2 border-t border-current/10 flex items-center justify-between">
                <span
                  className={cn(
                    'text-[9.5px] font-black uppercase tracking-wider',
                    isCompleted && 'text-emerald-700',
                    isActive && 'text-emerald-300 font-extrabold flex items-center gap-1',
                    isUpcoming && 'text-slate-400'
                  )}
                >
                  {isCompleted && 'Completed'}
                  {isActive && (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      In Progress
                    </>
                  )}
                  {isUpcoming && 'Pending Gate'}
                </span>

                {idx < 4 && (
                  <ChevronRight
                    className={cn(
                      'hidden sm:block h-3.5 w-3.5',
                      isCompleted && 'text-emerald-400',
                      isActive && 'text-slate-300',
                      isUpcoming && 'text-slate-300'
                    )}
                  />
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
