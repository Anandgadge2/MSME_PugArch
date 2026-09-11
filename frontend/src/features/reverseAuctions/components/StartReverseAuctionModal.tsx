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
  Tag,
  Truck,
  Layers,
  Award,
  Filter
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { reverseAuctionApi } from '../api';
import { formatCurrency, formatDateTime } from '../../shared/format';
import { toast } from 'sonner';

export interface SubmittedVendorItem {
  sellerOrgId?: number;
  sellerUserId?: number;
  sellerId?: number;
  vendorName: string;
  quotedAmount: number;
  offeredQty?: string | number;
  deliveryTimeline?: string;
  makeBrand?: string;
  model?: string;
  technicalStatus?: 'QUALIFIED' | 'DISQUALIFIED' | 'UNDER_EVALUATION' | string;
  warranty?: string;
  complianceNotes?: string;
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
  // Vendor selection states - all initially selected unless explicitly marked disqualified
  const [selectedVendorKeys, setSelectedVendorKeys] = useState<Set<number>>(() => {
    const keys = new Set<number>();
    submittedVendors.forEach((v, idx) => {
      if (v.technicalStatus !== 'DISQUALIFIED') {
        keys.add(idx);
      }
    });
    return keys.size > 0 ? keys : new Set(submittedVendors.map((_, idx) => idx));
  });

  // Dynamic Opening Ceiling Benchmark calculated strictly from the APPROVED/SELECTED vendors!
  const computedLowestQuote = useMemo(() => {
    const selectedQuotes = submittedVendors
      .filter((_, idx) => selectedVendorKeys.has(idx))
      .map(v => Number(v.quotedAmount || 0))
      .filter(q => q > 0);
    if (selectedQuotes.length > 0) return Math.min(...selectedQuotes);
    return initialLowestQuote > 0 ? initialLowestQuote : 100000;
  }, [selectedVendorKeys, submittedVendors, initialLowestQuote]);

  // Form states
  const [startType, setStartType] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [scheduledStartTime, setScheduledStartTime] = useState<string>(() => {
    const d = new Date(Date.now() + 10 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [minDecrement, setMinDecrement] = useState<number>(() => {
    return Math.max(500, Math.round(computedLowestQuote * 0.01));
  });
  const [autoExtensionEnabled, setAutoExtensionEnabled] = useState<boolean>(true);
  const [extensionWindow, setExtensionWindow] = useState<number>(3);
  const [extensionMinutes, setExtensionMinutes] = useState<number>(3);
  const [maxExtensions, setMaxExtensions] = useState<number>(5);

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
      toast.error('Minimum bid decrement must be greater than zero.');
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
        autoExtensionWindowMinutes: autoExtensionEnabled ? extensionWindow : 3,
        autoExtensionByMinutes: autoExtensionEnabled ? extensionMinutes : 3,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                  e-Reverse Auction
                </span>
                <span className="text-xs font-semibold text-slate-500">Evaluation & Live Kickoff</span>
              </div>
              <h2 id="reverse-auction-modal-title" className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Configure Reverse Auction Stage
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* Dynamic Opening Ceiling Benchmark Card */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-teal-50/50 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                  Opening Benchmark Ceiling (L1)
                </span>
                <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                  Based on {selectedVendorKeys.size} Approved {selectedVendorKeys.size === 1 ? 'Supplier' : 'Suppliers'}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-950 tracking-tight">
                {formatCurrency(computedLowestQuote)}
              </p>
              <p className="text-xs font-medium text-emerald-800 leading-snug">
                All counter-bids during the live reverse auction must strictly decrement below this opening ceiling.
              </p>
            </div>
            <div className="flex sm:flex-col items-start gap-2 text-xs font-bold text-emerald-900 bg-emerald-100/90 px-3 py-2.5 rounded-xl border border-emerald-300/60 shrink-0">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>Selective Admission</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-800">
                {selectedVendorKeys.size} of {submittedVendors.length} Suppliers Admitted
              </span>
            </div>
          </div>

          <form id="reverse-auction-form" onSubmit={handleStartAuction} className="space-y-6">

            {/* Section 1: Vendor Technical Scrutiny & Selective Admission */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-indigo-600" /> 1. Supplier Scrutiny & Reverse Auction Admission
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Select only the technically compliant suppliers you approve to enter the dynamic live bidding room.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={selectAllVendors}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition underline underline-offset-2"
                >
                  Select All
                </button>
              </div>

              {selectedVendorKeys.size < 2 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Recommendation:</strong> Select at least <strong>2 suppliers</strong> to foster competitive real-time price compression.
                  </span>
                </div>
              )}

              <div className="space-y-2.5">
                {submittedVendors.map((vendor, idx) => {
                  const isSelected = selectedVendorKeys.has(idx);
                  const isLowestAmongSelected = Number(vendor.quotedAmount || 0) === computedLowestQuote && isSelected;

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleVendor(idx)}
                      className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border cursor-pointer transition select-none ${
                        isSelected
                          ? isLowestAmongSelected
                            ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-500/30'
                            : 'border-blue-200 bg-blue-50/25 ring-1 ring-blue-500/20'
                          : 'border-slate-200 bg-slate-50/60 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleVendor(idx)}
                          className="h-4 w-4 rounded mt-1 border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                          aria-label={`Select ${vendor.vendorName}`}
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-slate-900 truncate">
                              {vendor.vendorName}
                            </span>
                            {isLowestAmongSelected && (
                              <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide">
                                Current L1 Benchmark
                              </span>
                            )}
                          </div>

                          {/* Technical attributes pills */}
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-semibold">
                            {vendor.makeBrand && (
                              <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                <Tag className="h-3 w-3 text-slate-400" />
                                Make: {vendor.makeBrand} {vendor.model ? `(${vendor.model})` : ''}
                              </span>
                            )}
                            {vendor.deliveryTimeline && (
                              <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                <Truck className="h-3 w-3 text-slate-400" />
                                Delivery: {vendor.deliveryTimeline}
                              </span>
                            )}
                            {vendor.offeredQty && (
                              <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                <Layers className="h-3 w-3 text-slate-400" />
                                Qty: {vendor.offeredQty}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1.5 shrink-0 pl-7 sm:pl-0">
                        <span className="text-sm font-black text-slate-900">
                          {formatCurrency(vendor.quotedAmount)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            isSelected
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isSelected ? '✓ Admitted to e-RA' : 'Excluded'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Timing & Duration */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-600" /> 2. Auction Launch Mode & Duration
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setStartType('NOW')}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
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
                    <p className="text-[10px] font-medium text-slate-500">Opens bidding room instantly upon submission</p>
                  </div>
                </label>

                <label
                  onClick={() => setStartType('SCHEDULED')}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
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
                    <p className="text-[10px] font-medium text-slate-500">Specify future date and start time</p>
                  </div>
                </label>
              </div>

              {startType === 'SCHEDULED' && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Scheduled Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledStartTime}
                    onChange={e => setScheduledStartTime(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  />
                  <p className="text-[10px] font-semibold text-slate-500 mt-1">
                    Scheduled preview: {formatDateTime(scheduledStartTime)}
                  </p>
                </div>
              )}

              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Live Auction Duration
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[10, 15, 30, 45, 60, 90].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={`py-2 rounded-xl text-xs font-black transition ${
                        durationMinutes === mins
                          ? 'bg-[#12335f] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {mins} Mins
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 3: Decrement & Anti-Sniping Protection */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5 text-indigo-600" /> 3. Decrement & Anti-Sniping Protection Rules
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Every counter-bid must be at least {formatCurrency(minDecrement)} lower than the current L1.
                  </p>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoExtensionEnabled}
                      onChange={e => setAutoExtensionEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Enable Anti-Sniping Protection
                    </span>
                  </label>
                  {autoExtensionEnabled && (
                    <p className="text-[10px] text-slate-600 leading-snug">
                      If a counter-bid is placed within the final <strong>{extensionWindow} minutes</strong>, the auction extends by <strong>+{extensionMinutes} minutes</strong> (up to {maxExtensions} times).
                    </p>
                  )}
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 p-4 sm:p-5 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">{selectedVendorKeys.size}</span> qualified {selectedVendorKeys.size === 1 ? 'supplier' : 'suppliers'} enrolled
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none h-10 px-5 rounded-xl text-xs font-bold text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="reverse-auction-form"
              disabled={isSubmitting || selectedVendorKeys.size === 0}
              className="flex-1 sm:flex-none h-10 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black shadow-md shadow-blue-500/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
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
        </div>

      </div>
    </div>
  );
}
