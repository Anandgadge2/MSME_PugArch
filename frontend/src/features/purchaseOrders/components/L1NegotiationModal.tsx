'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Percent,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  Send,
  Scale,
  FileText,
  Check,
  Ban,
  ArrowRight,
  ShieldCheck,
  History,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { FocusTrap } from '../../../components/ui/FocusTrap';
import { getApi, postApi } from '../../shared/apiClient';
import { formatCurrency, formatDate } from '../../shared/format';
import { useAuth } from '../../../hooks/useAuth';

export interface L1NegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId?: number;
  requirementId?: number;
  poNumber?: string;
  requirementTitle?: string;
  originalPrice: number;
  sellerUserId?: number;
  sellerName?: string;
  isBuyer: boolean;
  isSeller: boolean;
  onSuccess?: () => void;
}

export function L1NegotiationModal({
  isOpen,
  onClose,
  purchaseOrderId,
  requirementId,
  poNumber,
  requirementTitle,
  originalPrice,
  sellerUserId,
  sellerName,
  isBuyer,
  isSeller,
  onSuccess
}: L1NegotiationModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [negotiation, setNegotiation] = useState<any | null>(null);

  // Buyer Initiation Form State
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [buyerRemarks, setBuyerRemarks] = useState('');
  const [cvcCertified, setCvcCertified] = useState(false);

  // Seller Response Form State
  const [sellerAction, setSellerAction] = useState<'ACCEPT' | 'COUNTER' | 'DECLINE'>('ACCEPT');
  const [counterPrice, setCounterPrice] = useState<string>('');
  const [sellerRemarks, setSellerRemarks] = useState('');

  // Buyer Conclusion State
  const [conclusionRemarks, setConclusionRemarks] = useState('');

  // Fetch current negotiation record
  const fetchNegotiation = async () => {
    try {
      setLoading(true);
      let res;
      if (purchaseOrderId) {
        res = await getApi<{ data: any }>(`/api/negotiations/order/${purchaseOrderId}`);
      } else if (requirementId) {
        res = await getApi<{ data: any }>(`/api/negotiations/requirement/${requirementId}`);
      }
      if (res?.data) {
        setNegotiation(res.data);
      } else {
        setNegotiation(null);
      }
    } catch {
      // 404 means no active negotiation yet
      setNegotiation(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNegotiation();
    }
  }, [isOpen, purchaseOrderId, requirementId]);

  // SLA Countdown Timer
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isSlaExpired, setIsSlaExpired] = useState(false);

  useEffect(() => {
    if (!negotiation?.deadline) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const deadlineTime = new Date(negotiation.deadline).getTime();
      const diff = deadlineTime - now;

      if (diff <= 0) {
        setTimeRemaining('EXPIRED');
        setIsSlaExpired(true);
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        setIsSlaExpired(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [negotiation?.deadline]);

  // Calculated discount for Buyer initiate
  const buyerTargetNum = parseFloat(targetPrice) || 0;
  const buyerDiscountAmt = originalPrice > buyerTargetNum && buyerTargetNum > 0 ? originalPrice - buyerTargetNum : 0;
  const buyerDiscountPct = originalPrice > 0 && buyerDiscountAmt > 0 ? ((buyerDiscountAmt / originalPrice) * 100).toFixed(2) : '0.00';

  // Calculated discount for Seller counter
  const sellerCounterNum = parseFloat(counterPrice) || 0;
  const sellerDiscountAmt = originalPrice > sellerCounterNum && sellerCounterNum > 0 ? originalPrice - sellerCounterNum : 0;
  const sellerDiscountPct = originalPrice > 0 && sellerDiscountAmt > 0 ? ((sellerDiscountAmt / originalPrice) * 100).toFixed(2) : '0.00';

  // Buyer: Submit Initiation
  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerTargetNum || buyerTargetNum <= 0) {
      toast.error('Please enter a valid target negotiated price');
      return;
    }
    if (buyerTargetNum >= originalPrice) {
      toast.error('Target price must be lower than original price to seek negotiation savings');
      return;
    }
    if (!cvcCertified) {
      toast.error('You must certify compliance with CVC L1 Negotiation Guidelines');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        purchaseOrderId: purchaseOrderId || undefined,
        requirementId: requirementId || undefined,
        sellerUserId: sellerUserId || negotiation?.sellerUserId,
        originalPrice,
        targetPrice: buyerTargetNum,
        buyerRemarks: buyerRemarks.trim() || undefined
      };

      await postApi('/api/negotiations/initiate', payload);
      toast.success('L1 Price Negotiation successfully initiated with 72-hour SLA deadline!');
      await fetchNegotiation();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to initiate negotiation');
    } finally {
      setSubmitting(false);
    }
  };

  // Seller: Submit Response
  const handleSellerResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negotiation?.id) return;

    if (sellerAction === 'COUNTER') {
      if (!sellerCounterNum || sellerCounterNum <= 0) {
        toast.error('Please enter a valid counter-offer price');
        return;
      }
      if (sellerCounterNum >= originalPrice) {
        toast.error('Counter offer must be lower than the original price');
        return;
      }
      if (sellerCounterNum <= (negotiation.targetPrice || 0)) {
        toast.error('Counter offer should be above the buyer target price (otherwise select Accept)');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        action: sellerAction,
        counterPrice: sellerAction === 'COUNTER' ? sellerCounterNum : undefined,
        sellerRemarks: sellerRemarks.trim() || undefined
      };

      await postApi(`/api/negotiations/${negotiation.id}/seller-respond`, payload);
      toast.success(
        sellerAction === 'ACCEPT'
          ? 'Target negotiated price accepted!'
          : sellerAction === 'COUNTER'
          ? 'Counter-offer submitted to buyer.'
          : 'Negotiation declined. Original price preserved.'
      );
      await fetchNegotiation();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  // Buyer: Submit Conclusion on Counter-Offer
  const handleBuyerConclude = async (action: 'ACCEPT' | 'CLOSE') => {
    if (!negotiation?.id) return;

    setSubmitting(true);
    try {
      const payload = {
        action,
        finalAgreedPrice: action === 'ACCEPT' ? negotiation.counterPrice : originalPrice,
        remarks: conclusionRemarks.trim() || undefined
      };

      await postApi(`/api/negotiations/${negotiation.id}/buyer-conclude`, payload);
      toast.success(
        action === 'ACCEPT'
          ? `Seller counter-offer of ${formatCurrency(negotiation.counterPrice)} ACCEPTED.`
          : 'Negotiation concluded without reduction. Original price retained.'
      );
      await fetchNegotiation();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to conclude negotiation');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentStatus = negotiation?.status as string | undefined;
  const isInitiated = currentStatus === 'INITIATED';
  const isCountered = currentStatus === 'SELLER_COUNTERED';
  const isCompleted = ['BUYER_ACCEPTED', 'SELLER_ACCEPTED', 'EXPIRED', 'DECLINED'].includes(currentStatus || '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="l1-negotiation-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-100"
    >
      <FocusTrap className="w-full max-w-2xl flex items-center justify-center">
        <div className="w-full max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 transform-gpu will-change-[transform,opacity] animate-in zoom-in-95 duration-100">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="l1-negotiation-title" className="text-base font-black text-slate-900">
                    CVC L1 Price Negotiation
                  </h3>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-900 border border-blue-200">
                    GFR &amp; CVC Rule
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  {poNumber ? `Order: ${poNumber}` : requirementTitle ? `RFQ: ${requirementTitle}` : 'Commercial Negotiation'}
                  {sellerName ? ` • Supplier: ${sellerName}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close negotiation dialog"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* CVC Sovereign Directives Notice */}
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950 space-y-0.5">
              <p className="font-black">
                Central Vigilance Commission (CVC) Procurement Directive
              </p>
              <p className="text-[11px] text-blue-900 leading-relaxed font-medium">
                Post-tender negotiations are strictly prohibited except under exceptional circumstances and exclusively with the lowest responsive bidder (L1). A statutory 72-hour SLA clock applies for supplier response.
              </p>
            </div>
          </div>

          {/* Pricing Overview Cards */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase text-slate-500">Original L1 Bid</span>
              <p className="text-base font-black text-slate-950 mt-0.5">
                {formatCurrency(originalPrice)}
              </p>
            </div>

            {negotiation ? (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <span className="text-[10px] font-bold uppercase text-amber-800">Target Negotiated Price</span>
                  <p className="text-base font-black text-amber-950 mt-0.5">
                    {formatCurrency(negotiation.targetPrice)}
                  </p>
                  <span className="text-[10px] font-bold text-amber-700">
                    Saving: {((((originalPrice - negotiation.targetPrice) / originalPrice) * 100) || 0).toFixed(1)}%
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <span className="text-[10px] font-bold uppercase text-emerald-800">Agreed / Counter Price</span>
                  <p className="text-base font-black text-emerald-950 mt-0.5">
                    {negotiation.finalAgreedPrice
                      ? formatCurrency(negotiation.finalAgreedPrice)
                      : negotiation.counterPrice
                      ? formatCurrency(negotiation.counterPrice)
                      : 'Pending Seller'}
                  </p>
                  {negotiation.counterPrice && !negotiation.finalAgreedPrice && (
                    <span className="text-[10px] font-bold text-purple-700">Counter Offered</span>
                  )}
                </div>
              </>
            ) : (
              <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Status</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">No negotiation initiated</p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Ready to initiate</span>
              </div>
            )}
          </div>

          {/* Active Negotiation SLA Countdown Banner */}
          {negotiation && isInitiated && (
            <div className={`mt-4 rounded-xl border p-3 flex items-center justify-between ${
              isSlaExpired ? 'border-red-300 bg-red-50 text-red-950' : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}>
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${isSlaExpired ? 'text-red-600' : 'text-amber-600 animate-spin'}`} />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block">
                    Statutory 72-Hour CVC Response SLA
                  </span>
                  <span className="text-xs font-black">
                    {isSlaExpired ? 'SLA Clock Expired — Seller defaulted on negotiation deadline' : `Time Remaining: ${timeRemaining}`}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/70 border border-current">
                Initiated: {formatDate(negotiation.initiatedAt || negotiation.createdAt)}
              </span>
            </div>
          )}

          {/* CASE 1: NO ACTIVE NEGOTIATION - BUYER CAN INITIATE */}
          {!negotiation && isBuyer && (
            <form onSubmit={handleInitiate} className="mt-5 space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 space-y-3.5 bg-slate-50/50">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-blue-600" />
                  Initiate Price Reduction Request
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="target-price-input" className="text-xs font-bold text-slate-700">
                      Target Negotiated Price (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        id="target-price-input"
                        type="number"
                        min={1}
                        max={originalPrice - 1}
                        step="any"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        placeholder="e.g. 950000"
                        required
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Estimated Savings</span>
                    <p className="text-sm font-black text-emerald-950">
                      {buyerDiscountAmt > 0 ? formatCurrency(buyerDiscountAmt) : '₹0.00'}
                      <span className="ml-1 text-xs text-emerald-700 font-bold">({buyerDiscountPct}%)</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="buyer-remarks-input" className="text-xs font-bold text-slate-700">
                    Justification &amp; Commercial Terms for Reduction *
                  </label>
                  <textarea
                    id="buyer-remarks-input"
                    rows={2}
                    value={buyerRemarks}
                    onChange={(e) => setBuyerRemarks(e.target.value)}
                    placeholder="State market price benchmarks, bulk volume rationale, or budgetary ceiling justifications..."
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                  />
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="cvc-cert-check"
                    checked={cvcCertified}
                    onChange={(e) => setCvcCertified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="cvc-cert-check" className="text-xs text-slate-700 font-medium cursor-pointer">
                    I solemnly certify that this negotiation is being conducted strictly with the lowest evaluated responsive bidder (L1) as mandated by CVC Guidelines, without prejudice to competition integrity.
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-9 px-4 rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !buyerTargetNum || !cvcCertified}
                  className="h-9 px-5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Transmitting to Supplier...' : 'Initiate L1 Negotiation'}
                </Button>
              </div>
            </form>
          )}

          {/* CASE 2: ACTIVE NEGOTIATION - SELLER ACTION PANEL */}
          {negotiation && isInitiated && isSeller && (
            <form onSubmit={handleSellerResponse} className="mt-5 space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 space-y-3.5 bg-slate-50/50">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Send className="h-4 w-4 text-emerald-600" />
                  Supplier Formal Decision
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSellerAction('ACCEPT')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      sellerAction === 'ACCEPT'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
                    <span className="text-xs block">Accept Target</span>
                    <span className="text-[10px] text-slate-500">{formatCurrency(negotiation.targetPrice)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSellerAction('COUNTER')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      sellerAction === 'COUNTER'
                        ? 'border-blue-500 bg-blue-50 text-blue-950 font-black shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingDown className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                    <span className="text-xs block">Submit Counter</span>
                    <span className="text-[10px] text-slate-500">Propose Middle Price</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSellerAction('DECLINE')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      sellerAction === 'DECLINE'
                        ? 'border-red-500 bg-red-50 text-red-950 font-black shadow-xs ring-2 ring-red-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Ban className="h-4 w-4 mx-auto text-red-600 mb-1" />
                    <span className="text-xs block">Decline Discount</span>
                    <span className="text-[10px] text-slate-500">Hold Original Bid</span>
                  </button>
                </div>

                {sellerAction === 'COUNTER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label htmlFor="counter-price-input" className="text-xs font-bold text-slate-700">
                        Counter-Offer Price (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          id="counter-price-input"
                          type="number"
                          min={negotiation.targetPrice + 1}
                          max={originalPrice - 1}
                          step="any"
                          value={counterPrice}
                          onChange={(e) => setCounterPrice(e.target.value)}
                          placeholder="e.g. 975000"
                          required
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-blue-800 uppercase">Discount Offered</span>
                      <p className="text-sm font-black text-blue-950">
                        {sellerDiscountAmt > 0 ? formatCurrency(sellerDiscountAmt) : '₹0.00'}
                        <span className="ml-1 text-xs text-blue-700 font-bold">({sellerDiscountPct}%)</span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="seller-remarks-input" className="text-xs font-bold text-slate-700">
                    Supplier Explanation / Remarks
                  </label>
                  <textarea
                    id="seller-remarks-input"
                    rows={2}
                    value={sellerRemarks}
                    onChange={(e) => setSellerRemarks(e.target.value)}
                    placeholder="Provide commercial rationale, raw material cost constraints, or warranty terms..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-9 px-4 rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Formal Decision'}
                </Button>
              </div>
            </form>
          )}

          {/* CASE 3: SELLER COUNTERED - BUYER REVIEW & CONCLUDE */}
          {negotiation && isCountered && isBuyer && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-purple-700" />
                  Supplier Counter-Offer Received
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-800 uppercase">Supplier Counter Price</span>
                    <p className="text-lg font-black text-purple-950">
                      {formatCurrency(negotiation.counterPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">Effective Savings</span>
                    <p className="text-sm font-black text-emerald-900">
                      {formatCurrency(originalPrice - (negotiation.counterPrice || 0))}
                    </p>
                  </div>
                </div>
                {negotiation.sellerRemarks && (
                  <p className="text-xs text-purple-900 italic bg-white/60 p-2.5 rounded-lg border border-purple-200">
                    &ldquo;{negotiation.sellerRemarks}&rdquo;
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="conclude-remarks-input" className="text-xs font-bold text-slate-700">
                  Buyer Acceptance / Closing Justification
                </label>
                <textarea
                  id="conclude-remarks-input"
                  rows={2}
                  value={conclusionRemarks}
                  onChange={(e) => setConclusionRemarks(e.target.value)}
                  placeholder="Note competent authority approval or closing remarks..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleBuyerConclude('CLOSE')}
                  disabled={submitting}
                  className="h-9 px-4 rounded-xl text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {submitting ? 'Closing...' : 'Decline Counter (Retain Original Bid)'}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleBuyerConclude('ACCEPT')}
                  disabled={submitting}
                  className="h-9 px-5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Accepting...' : 'Accept Counter-Offer & Conclude'}
                </Button>
              </div>
            </div>
          )}

          {/* CASE 4: NEGOTIATION CONCLUDED / FINAL STATE */}
          {negotiation && isCompleted && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Negotiation Completed ({currentStatus})
                  </h4>
                  <p className="text-xs text-slate-600">
                    Final settled commercial rate: <strong className="text-slate-950">{formatCurrency(negotiation.finalAgreedPrice || originalPrice)}</strong>
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-4 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900"
                >
                  Close
                </Button>
              </div>
            </div>
          )}

        </div>
      </FocusTrap>
    </div>
  );
}

export default L1NegotiationModal;
