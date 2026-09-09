'use client';

import React, { useState, useMemo } from 'react';
import {
  Gavel,
  Clock,
  IndianRupee,
  ShieldCheck,
  Users,
  AlertCircle,
  X,
  Loader2,
  Calendar,
  CheckCircle2,
  Timer,
  Zap,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { reverseAuctionApi } from '../api';
import { toast } from 'sonner';

export interface SubmittedVendorItem {
  sellerOrgId?: number;
  sellerUserId?: number;
  sellerId?: number;
  vendorName: string;
  quotedAmount: number;
  offeredQty?: string;
  deliveryTimeline?: string;
}

export interface StartReverseAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  procurementId: number | string;
  procurementTitle: string;
  initialLowestQuote?: number;
  submittedVendors: SubmittedVendorItem[];
  onAuctionStarted: (auction: any) => void;
}

export default function StartReverseAuctionModal({
  isOpen,
  onClose,
  procurementId,
  procurementTitle,
  initialLowestQuote = 0,
  submittedVendors = [],
  onAuctionStarted,
}: StartReverseAuctionModalProps) {
  // Compute benchmark from submitted vendors if not provided
  const computedLowestQuote = useMemo(() => {
    if (initialLowestQuote > 0) return initialLowestQuote;
    const quotes = submittedVendors
      .map(v => Number(v.quotedAmount || 0))
      .filter(q => q > 0);
    return quotes.length ? Math.min(...quotes) : 100000;
  }, [initialLowestQuote, submittedVendors]);

  // Form states
  const [startType, setStartType] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [scheduledStartTime, setScheduledStartTime] = useState<string>(() => {
    const d = new Date(Date.now() + 10 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [minDecrement, setMinDecrement] = useState<number>(() => {
    return Math.max(500, Math.round(computedLowestQuote * 0.005));
  });
  const [autoExtensionEnabled, setAutoExtensionEnabled] = useState<boolean>(true);
  const [extensionWindow, setExtensionWindow] = useState<number>(5);
  const [extensionMinutes, setExtensionMinutes] = useState<number>(5);
  const [maxExtensions, setMaxExtensions] = useState<number>(10);

  // Vendor selection states
  const [selectedVendorKeys, setSelectedVendorKeys] = useState<Set<number>>(() => {
    return new Set(submittedVendors.map((_, idx) => idx));
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleVendor = (idx: number) => {
    setSelectedVendorKeys(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        if (next.size === 1) {
          toast.warning('At least one vendor must be selected for the reverse auction.');
          return prev;
        }
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const selectAllVendors = () => {
    setSelectedVendorKeys(new Set(submittedVendors.map((_, idx) => idx)));
  };

  const handleStartAuction = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedVendorsList = submittedVendors.filter((_, idx) => selectedVendorKeys.has(idx));
    if (selectedVendorsList.length === 0) {
      toast.error('Please select at least one vendor to participate.');
      return;
    }

    if (minDecrement <= 0) {
      toast.error('Minimum decrement must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const startTime = startType === 'NOW' ? new Date() : new Date(scheduledStartTime);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      const payload = {
        procurementId,
        title: `Reverse Auction — ${procurementTitle}`,
        startPrice: computedLowestQuote,
        minDecrementAmount: minDecrement,
        autoExtensionWindowMinutes: autoExtensionEnabled ? extensionWindow : 5,
        autoExtensionByMinutes: autoExtensionEnabled ? extensionMinutes : 5,
        maxAutoExtensions: autoExtensionEnabled ? maxExtensions : 0,
        startTime,
        endTime,
        durationMinutes,
        selectedSellers: selectedVendorsList.map(v => ({
          sellerOrgId: v.sellerOrgId,
          sellerUserId: v.sellerUserId,
          sellerId: v.sellerId,
          vendorName: v.vendorName,
          quotedAmount: v.quotedAmount,
        })),
      };

      const result = await reverseAuctionApi.startFromBids(payload);
      toast.success('Reverse auction initiated successfully!');
      onAuctionStarted(result);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start reverse auction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reverse-auction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                  Setup & Launch
                </span>
                <span className="text-xs font-semibold text-slate-400">e-Reverse Auction</span>
              </div>
              <h2 id="reverse-auction-modal-title" className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Start Reverse Auction
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

        {/* Benchmark Callout */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-teal-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
              Opening Benchmark (Initial L1)
            </span>
            <p className="text-xl font-black text-emerald-950">
              ₹{computedLowestQuote.toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] font-medium text-emerald-800">
              All bids must strictly decrement downward below this benchmark.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 bg-emerald-100/80 px-3 py-2 rounded-xl border border-emerald-200/60 self-start sm:self-auto">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>{submittedVendors.length} Verified Quotations</span>
          </div>
        </div>

        <form onSubmit={handleStartAuction} className="space-y-5">
          {/* Timing Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-600" /> 1. Auction Timing & Duration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                onClick={() => setStartType('NOW')}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                  startType === 'NOW'
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/30'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="startType"
                  checked={startType === 'NOW'}
                  onChange={() => setStartType('NOW')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> Start Immediately (Live)
                  </p>
                  <p className="text-[10px] font-medium text-slate-500">Opens bidding room upon click</p>
                </div>
              </label>

              <label
                onClick={() => setStartType('SCHEDULED')}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                  startType === 'SCHEDULED'
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/30'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="startType"
                  checked={startType === 'SCHEDULED'}
                  onChange={() => setStartType('SCHEDULED')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" /> Schedule for Later
                  </p>
                  <p className="text-[10px] font-medium text-slate-500">Specify date and start time</p>
                </div>
              </label>
            </div>

            {startType === 'SCHEDULED' && (
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Scheduled Start Time</label>
                <input
                  type="datetime-local"
                  value={scheduledStartTime}
                  onChange={e => setScheduledStartTime(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Event Duration (Minutes)
              </label>
              <div className="flex gap-2">
                {[30, 45, 60, 90, 120].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                      durationMinutes === mins
                        ? 'bg-[#12335f] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Decrement & Anti-Sniping Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5 text-indigo-600" /> 2. Decrement & Anti-Sniping Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Minimum Bid Decrement (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="100"
                  value={minDecrement}
                  onChange={e => setMinDecrement(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Each counter-bid must be at least this much lower than the current L1.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={autoExtensionEnabled}
                    onChange={e => setAutoExtensionEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Enable Anti-Sniping Auto-Extension
                  </span>
                </label>
                {autoExtensionEnabled && (
                  <p className="text-[10px] text-slate-500 leading-tight">
                    If a bid is submitted within the last {extensionWindow} minutes, extend deadline by {extensionMinutes} minutes (up to {maxExtensions} times).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Vendor Enrollment Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-purple-600" /> 3. Auto-Enrolled Vendors ({selectedVendorKeys.size}/{submittedVendors.length})
              </h3>
              <button
                type="button"
                onClick={selectAllVendors}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/40">
              {submittedVendors.map((vendor, idx) => {
                const isSelected = selectedVendorKeys.has(idx);
                return (
                  <label
                    key={idx}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white transition"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVendor(idx)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-xs font-black text-slate-900">{vendor.vendorName}</p>
                        <p className="text-[10px] font-medium text-slate-400">
                          Initial Quote: ₹{Number(vendor.quotedAmount || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                      Eligible
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-bold text-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedVendorKeys.size === 0}
              className="w-full sm:w-auto h-11 px-7 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold shadow-md shadow-blue-500/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting Auction…
                </>
              ) : (
                <>
                  <Gavel className="h-4 w-4" /> Start Reverse Auction Now
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
