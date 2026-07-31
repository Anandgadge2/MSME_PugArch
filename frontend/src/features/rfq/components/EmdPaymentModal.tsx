import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  Building2, 
  QrCode, 
  FileCheck2, 
  ShieldCheck, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Lock
} from 'lucide-react';
import { postApi } from '../../shared/apiClient';

interface EmdPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirementId?: number | string | null;
  requestId?: string | null;
  rfqTitle?: string;
  rfqNumber?: string;
  emdAmount: number;
  buyerName?: string;
  onSuccess: (paymentData: any) => void;
}

export const EmdPaymentModal: React.FC<EmdPaymentModalProps> = ({
  isOpen,
  onClose,
  requirementId,
  requestId,
  rfqTitle,
  rfqNumber,
  emdAmount,
  buyerName,
  onSuccess
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'ONLINE' | 'NET_BANKING' | 'UPI' | 'BG_DD'>('ONLINE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedPayment, setCompletedPayment] = useState<any>(null);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handlePayEmd = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Simulate enterprise gateway roundtrip delay
      await new Promise(resolve => setTimeout(resolve, 1400));

      const res = await postApi<any>('/api/emd/pay', {
        requirementId,
        requestId,
        amount: emdAmount,
        paymentMethod: selectedMethod === 'ONLINE' ? 'Credit/Debit Card' : (selectedMethod === 'UPI' ? 'UPI (Instant)' : (selectedMethod === 'NET_BANKING' ? 'Net Banking / NEFT' : 'Demand Draft / BG'))
      });

      const paymentData = res?.data?.payment || res?.payment || res;

      setIsProcessing(false);
      setIsSuccess(true);
      setCompletedPayment(paymentData);

      setTimeout(() => {
        onSuccess(paymentData);
      }, 1200);
    } catch (err: any) {
      console.error('[EMD Payment Modal Error]', err);
      setIsProcessing(false);
      setErrorMsg(err.response?.data?.message || 'Failed to complete EMD payment. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-lg">
              💰
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">EMD Payment Gateway</h2>
              <p className="text-xs text-slate-300">Earnest Money Deposit Escrow Portal</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Success Animated State */}
          {isSuccess ? (
            <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">EMD Payment Successful!</h3>
                <p className="text-slate-500">Your Earnest Money Deposit has been verified & recorded.</p>
              </div>

              {completedPayment && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left max-w-xs mx-auto space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction ID:</span>
                    <span className="font-mono font-bold text-slate-900">{completedPayment.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paid Amount:</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(completedPayment.amount || emdAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-bold text-emerald-600">VERIFIED / PAID</span>
                  </div>
                </div>
              )}

              <p className="text-emerald-700 font-semibold text-xs animate-pulse">
                Unlocking Quotation Submission...
              </p>
            </div>
          ) : (
            <>
              {/* Procurement Summary Banner */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">RFQ Reference</span>
                  <span className="font-mono font-bold text-slate-800">{rfqNumber || requestId || 'REQ-2026-D3D8247A3D65'}</span>
                </div>
                {rfqTitle && (
                  <div className="text-slate-700 font-semibold line-clamp-1">
                    {rfqTitle}
                  </div>
                )}
                {buyerName && (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Buyer: <strong>{buyerName}</strong></span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 font-bold text-slate-900 border-t border-slate-200">
                  <span className="text-slate-600 text-xs">Total EMD Payable</span>
                  <span className="text-base text-emerald-700">{formatCurrency(emdAmount)}</span>
                </div>
              </div>

              {/* Error Notification */}
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Select Payment Method */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800 text-xs">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('ONLINE')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      selectedMethod === 'ONLINE'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <CreditCard className={`w-4 h-4 mt-0.5 ${selectedMethod === 'ONLINE' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-semibold text-xs">Card Payment</div>
                      <div className="text-[10px] text-slate-500">Visa, Mastercard, RuPay</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('UPI')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      selectedMethod === 'UPI'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <QrCode className={`w-4 h-4 mt-0.5 ${selectedMethod === 'UPI' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-semibold text-xs">UPI / Instant</div>
                      <div className="text-[10px] text-slate-500">GPay, PhonePe, Paytm</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('NET_BANKING')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      selectedMethod === 'NET_BANKING'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Building2 className={`w-4 h-4 mt-0.5 ${selectedMethod === 'NET_BANKING' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-semibold text-xs">Net Banking / NEFT</div>
                      <div className="text-[10px] text-slate-500">All major banks</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('BG_DD')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      selectedMethod === 'BG_DD'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <FileCheck2 className={`w-4 h-4 mt-0.5 ${selectedMethod === 'BG_DD' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-semibold text-xs">Bank Guarantee / DD</div>
                      <div className="text-[10px] text-slate-500">Verify e-BG reference</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Security & Refund Trust Note */}
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200/60 rounded-lg text-[11px] text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Escrow Secured. Funds remain held safely until procurement evaluation completes.</span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isSuccess && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>256-Bit SSL Encrypted</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handlePayEmd}
                disabled={isProcessing}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Processing EMD...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Confirm & Pay {formatCurrency(emdAmount)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
