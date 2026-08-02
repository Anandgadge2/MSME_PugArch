import React from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  HelpCircle, 
  ArrowRight, 
  Building2, 
  AlertCircle,
  FileText
} from 'lucide-react';

export interface EmdInfo {
  isEmdRequired: boolean;
  emdAmount: number;
  paymentMethod: string;
  paymentDeadline?: string | null;
  refundPolicy: string;
  instructions: string;
  status: 'PENDING' | 'PAID' | 'VERIFIED' | 'REFUNDED' | 'NOT_REQUIRED';
  payment?: {
    transactionId: string;
    paidAt: string;
    amount: number;
    paymentMethod: string;
    status: string;
  } | null;
}

interface EmdCardProps {
  emdInfo: EmdInfo | null;
  loading?: boolean;
  onPayClick: () => void;
}

export const EmdCard: React.FC<EmdCardProps> = ({ emdInfo, loading = false, onPayClick }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 rounded w-1/2"></div>
        <div className="h-16 bg-slate-100 rounded-lg"></div>
        <div className="h-10 bg-slate-200 rounded"></div>
      </div>
    );
  }

  const isRequired = emdInfo?.isEmdRequired ?? true; // Default to true if configured
  const amount = emdInfo?.emdAmount || 50000;
  const status = emdInfo?.status || 'PENDING';
  const isPaid = status === 'PAID' || status === 'VERIFIED';

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Paid
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Verified
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            Refunded
          </span>
        );
      case 'NOT_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Not Required
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Premium Header */}
      <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">ðŸ’°</span>
          <h3 className="font-bold text-sm tracking-tight text-white">Earnest Money Deposit (EMD)</h3>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      <div className="p-4 space-y-3.5">
        {!isRequired ? (
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>EMD is not required for this procurement opportunity. You may submit your quotation directly.</span>
          </div>
        ) : (
          <>
            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium block text-[11px]">EMD Amount</span>
                <span className="font-bold text-slate-900 text-sm text-emerald-700">{formatCurrency(amount)}</span>
              </div>

              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium block text-[11px]">Payment Method</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {emdInfo?.paymentMethod || 'Online / Net Banking'}
                </span>
              </div>

              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 col-span-2">
                <span className="text-slate-500 font-medium block text-[11px]">Refund Policy</span>
                <span className="text-slate-700 font-medium block leading-snug">
                  {emdInfo?.refundPolicy || 'Refundable after technical evaluation & contract award'}
                </span>
              </div>
            </div>

            {/* Instructions */}
            {emdInfo?.instructions && (
              <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 text-[11px] text-blue-800 space-y-1">
                <div className="font-semibold flex items-center gap-1 text-blue-900">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Payment Instructions
                </div>
                <p className="text-blue-700/90 leading-relaxed">
                  {emdInfo.instructions}
                </p>
              </div>
            )}

            {/* Paid State vs Pending CTA */}
            {isPaid && emdInfo?.payment ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-emerald-800 font-bold border-b border-emerald-200/60 pb-2">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Payment Successful
                  </span>
                  <span className="text-[11px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded font-mono">
                    {emdInfo.payment.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-emerald-700/80 block">Transaction ID</span>
                    <span className="font-mono font-semibold text-emerald-950 text-[11px] break-all">
                      {emdInfo.payment.transactionId}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-700/80 block">Paid Amount</span>
                    <span className="font-bold text-emerald-900">
                      {formatCurrency(emdInfo.payment.amount || amount)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-emerald-700/80 block">Payment Date</span>
                    <span className="font-medium text-emerald-950">
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
              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    EMD payment is <strong>mandatory</strong> to unlock quotation submission for this requirement.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onPayClick}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay EMD ({formatCurrency(amount)})</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
