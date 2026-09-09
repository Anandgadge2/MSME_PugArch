'use client';

import React, { useState } from 'react';
import {
  Gavel,
  IndianRupee,
  ShieldCheck,
  X,
  Loader2,
  AlertCircle,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { reverseAuctionApi } from '../api';
import { toast } from 'sonner';

export interface PlaceLowerBidModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionId: number;
  currentLowestBid: number;
  minNextBid: number;
  minDecrement: number;
  myLastBid?: number;
  onSuccess?: () => void;
}

export default function PlaceLowerBidModal({
  isOpen,
  onClose,
  auctionId,
  currentLowestBid,
  minNextBid,
  minDecrement,
  myLastBid = 0,
  onSuccess,
}: PlaceLowerBidModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = Number(val);
    if (minNextBid > 0 && num > minNextBid) {
      setErrorMsg(
        `Bid amount cannot exceed ₹${minNextBid.toLocaleString('en-IN')} (must be at least ₹${minDecrement.toLocaleString(
          'en-IN'
        )} lower than current L1 ₹${currentLowestBid.toLocaleString('en-IN')})`
      );
    } else {
      setErrorMsg('');
    }
  };

  const fillQuickBid = () => {
    if (minNextBid > 0) {
      handleAmountChange(String(minNextBid));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bidAmount = Number(amount);

    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      setErrorMsg('Please enter a valid positive bid amount.');
      return;
    }

    if (minNextBid > 0 && bidAmount > minNextBid) {
      setErrorMsg(
        `Bid amount cannot exceed ₹${minNextBid.toLocaleString('en-IN')}. Please lower your bid.`
      );
      return;
    }

    if (!acceptedTerms) {
      setErrorMsg('You must accept the auction terms and rules to place a bid.');
      return;
    }

    setSubmitting(true);
    try {
      await reverseAuctionApi.placeBid(auctionId, bidAmount);
      toast.success('Bid placed successfully! Your standing has been updated.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to place bid';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-bid-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white shadow-md shadow-red-500/25">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <span className="rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                Live Bidding Console
              </span>
              <h2 id="place-bid-modal-title" className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Place Lower Bid
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pricing Specs */}
        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Market Current L1
            </span>
            <p className="text-base font-black text-slate-900">
              ₹{currentLowestBid.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Max Allowed Next Bid
            </span>
            <p className="text-base font-black text-emerald-700">
              ₹{minNextBid.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Minimum Decrement
            </span>
            <p className="text-xs font-bold text-slate-700">
              -₹{minDecrement.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Your Last Offer
            </span>
            <p className="text-xs font-bold text-slate-700">
              {myLastBid > 0 ? `₹${myLastBid.toLocaleString('en-IN')}` : 'None'}
            </p>
          </div>
        </div>

        {/* Quick Fill Button */}
        {minNextBid > 0 && (
          <button
            type="button"
            onClick={fillQuickBid}
            className="w-full rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-center text-xs font-black text-emerald-800 hover:bg-emerald-100 transition flex items-center justify-center gap-1.5"
          >
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Fill Next Minimum Valid Bid: ₹{minNextBid.toLocaleString('en-IN')}
          </button>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Enter Your Commercial Offer (INR) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="0.01"
                max={minNextBid > 0 ? minNextBid : undefined}
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                placeholder={`Must be ≤ ₹${minNextBid.toLocaleString('en-IN')}`}
                className="h-12 w-full rounded-2xl border border-slate-200 pl-8 pr-4 text-sm font-black text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition"
                required
                disabled={submitting}
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100/60 transition">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
              disabled={submitting}
            />
            <span className="text-xs font-medium text-slate-600 select-none leading-relaxed">
              I confirm our capacity to supply at this revised rate and accept the reverse auction binding terms.
            </span>
          </label>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-bold text-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !acceptedTerms || Boolean(errorMsg) || !amount}
              className="w-full sm:w-auto h-11 px-7 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-red-600/20 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting Offer…
                </>
              ) : (
                <>
                  <Gavel className="h-4 w-4" /> Submit Downward Bid
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
