import React from 'react';
import { cn } from '../../../lib/utils';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle,
  FileText,
  IndianRupee,
  AlertTriangle
} from 'lucide-react';

export interface EmdInfo {
  isEmdRequired: boolean;
  emdAmount: number;
  paymentMethod?: string;
  paymentDeadline?: string | null;
  refundPolicy?: string;
  instructions?: string;
  status: 'PENDING' | 'PAID' | 'VERIFIED' | 'FAILED' | 'REFUNDED' | 'NOT_REQUIRED';
  payment?: {
    transactionId: string;
    paidAt: string;
    amount: number;
    paymentMethod?: string;
    status?: string;
  } | null;
}

export interface EmdCardProps {
  emdInfo: EmdInfo | null;
  loading?: boolean;
  onPayClick: () => void;
  procurementType?: string | null;
}

/**
 * Business Rule: EMD is applicable ONLY when ALL conditions are true:
 * 1. Procurement Type is one of: RFP, Rate Contract, Open Tender, Limited Tender
 * 2. Buyer configured emdRequired = true AND emdAmount > 0
 */
export function isEmdApplicable(
  procurementType?: string | null,
  emdRequired?: boolean | null,
  emdAmount?: number | null
): boolean {
  if (emdRequired !== true || !emdAmount || Number(emdAmount) <= 0) {
    return false;
  }

  const pt = String(procurementType || '').toUpperCase().trim();
  if (!pt) return false;

  const isRfp = pt === 'RFP' || pt.includes('PROPOSAL');
  const isRateContract = pt === 'RATE_CONTRACT' || pt === 'RATE CONTRACT' || pt.includes('RATE');
  const isOpenTender = pt === 'OPEN_TENDER' || pt === 'OPEN TENDER' || pt === 'TENDER' || (pt.includes('OPEN') && pt.includes('TENDER'));
  const isLimitedTender = pt === 'LIMITED_TENDER' || pt === 'LIMITED TENDER' || (pt.includes('LIMITED') && pt.includes('TENDER'));

  return isRfp || isRateContract || isOpenTender || isLimitedTender;
}

export const EmdCard: React.FC<EmdCardProps> = ({
  emdInfo,
  loading = false,
  onPayClick,
  procurementType
}) => {
  const isApplicable = isEmdApplicable(
    procurementType,
    emdInfo?.isEmdRequired,
    emdInfo?.emdAmount
  );

  // Case 1: EMD Not Applicable — do not display the EMD section at all
  if (!isApplicable) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 rounded-lg w-1/2"></div>
        <div className="h-16 bg-slate-100 rounded-xl"></div>
        <div className="h-10 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  const amount = emdInfo?.emdAmount || 0;
  const status = emdInfo?.status || 'PENDING';
  const isPaid = status === 'PAID' || status === 'VERIFIED';
  const isFailed = status === 'FAILED';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Paid
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Verified
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Payment Failed
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            Refunded
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 animate-pulse shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Payment
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-amber-200/90 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Card Header */}
      <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-xs tracking-wider uppercase text-white">Earnest Money Deposit (EMD)</h3>
            <p className="text-[10px] text-slate-300 font-medium">Required prerequisite for response submission</p>
          </div>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      <div className="p-5 space-y-4">
        {/* Information Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-500 font-semibold block text-[11px]">EMD Amount</span>
            <span className="font-black text-slate-900 text-base text-emerald-700">{formatCurrency(amount)}</span>
          </div>

          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-500 font-semibold block text-[11px]">Payment Method</span>
            <span className="font-bold text-slate-800 truncate block mt-0.5">
              {emdInfo?.paymentMethod || 'Online Escrow / Gateway'}
            </span>
          </div>

          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 col-span-2">
            <span className="text-slate-500 font-semibold block text-[11px]">Refund Policy</span>
            <span className="text-slate-700 font-medium block leading-relaxed mt-0.5">
              {emdInfo?.refundPolicy || 'Refundable after technical evaluation & contract award'}
            </span>
          </div>
        </div>

        {/* Instructions */}
        {emdInfo?.instructions && (
          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1">
            <div className="font-extrabold flex items-center gap-1.5 text-blue-900 text-[11px] uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Payment Instructions
            </div>
            <p className="text-blue-700 leading-relaxed text-[11px]">
              {emdInfo.instructions}
            </p>
          </div>
        )}

        {/* Paid State Details vs Unpaid/Failed CTA */}
        {isPaid && emdInfo?.payment ? (
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-emerald-900 font-black border-b border-emerald-200/80 pb-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                EMD Payment Complete
              </span>
              <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md font-mono font-bold">
                {emdInfo.payment.status || 'PAID'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-emerald-700 font-semibold text-[11px] block">Transaction ID</span>
                <span className="font-mono font-bold text-emerald-950 text-xs break-all">
                  {emdInfo.payment.transactionId}
                </span>
              </div>
              <div>
                <span className="text-emerald-700 font-semibold text-[11px] block">Amount Paid</span>
                <span className="font-black text-emerald-900 text-xs">
                  {formatCurrency(emdInfo.payment.amount || amount)}
                </span>
              </div>
              <div className="col-span-2 pt-1 border-t border-emerald-200/60">
                <span className="text-emerald-700 font-semibold text-[11px] block">Payment Date</span>
                <span className="font-bold text-emerald-950 text-xs">
                  {new Date(emdInfo.payment.paidAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50/90 p-3 rounded-xl border border-amber-200/90">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">
                This procurement requires an Earnest Money Deposit (EMD). Please complete the EMD payment before submitting your response.
              </span>
            </div>

            <button
              type="button"
              onClick={onPayClick}
              className={cn(
                "w-full py-3 px-4 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 group",
                isFailed ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              <CreditCard className="w-4 h-4" />
              <span>{isFailed ? "Retry EMD Payment" : "Pay EMD"} ({formatCurrency(amount)})</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

