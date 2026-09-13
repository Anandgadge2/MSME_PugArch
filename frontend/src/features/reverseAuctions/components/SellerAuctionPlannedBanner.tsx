'use client';

import React from 'react';
import {
  Clock,
  Trophy,
  ShieldCheck,
  ArrowDown,
  EyeOff,
  Info,
} from 'lucide-react';

export interface SellerAuctionPlannedBannerProps {
  startPrice?: number;
  minDecrementAmount?: number;
  rankVisibility?: string;
}

export default function SellerAuctionPlannedBanner({
  startPrice = 0,
  minDecrementAmount = 0,
  rankVisibility = 'MASKED',
}: SellerAuctionPlannedBannerProps) {
  return (
    <div
      className="rounded-3xl border-2 p-6 text-white shadow-xl relative overflow-hidden animate-in fade-in duration-300 border-indigo-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-[#0c1328] shadow-indigo-950/20"
      role="region"
      aria-label="Stage 2 Planned Reverse Auction"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-3 w-3 relative">
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
            Stage 2: Reverse Auction (Pending Evaluation)
          </span>
          <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
            Follow-On Auction
          </span>
        </div>

        {/* Anti-collusion badge */}
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
          <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span>Anti-Collusion Masked (Competitor IDs Hidden)</span>
        </div>
      </div>

      {/* Informational notice */}
      <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-slate-900/90 border border-slate-800 px-3.5 py-2 text-[11px] text-slate-300">
        <Info className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
        <span>
          <strong className="text-amber-300">Two-Stage Procurement Notice:</strong> This procurement includes a Stage 2 Live Reverse Auction. Qualified bidders will be notified with the scheduled auction window after Stage 1 technical evaluation is completed by the buyer.
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
        {/* Col 1 */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
            Auction Opens After
          </span>
          <p className="text-lg font-black text-indigo-300">
            Stage 1 Evaluation
          </p>
          <p className="text-[10px] text-slate-300/90 font-medium">
            Buyer will schedule post-evaluation
          </p>
        </div>

        {/* Col 2 */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            Ceiling / Start Price
          </span>
          <p className="text-xl font-black text-emerald-400">
            {startPrice > 0 ? `₹${startPrice.toLocaleString('en-IN')}` : 'Locks to L1 Bid'}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
            Will lock to lowest qualified bid
          </p>
        </div>

        {/* Col 3 */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
            Your Eligibility
          </span>
          <p className="text-lg font-bold text-slate-200 flex items-center gap-2 pt-1">
            <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-800 text-blue-300 border border-blue-900/60">
              Submit Stage 1 Bid First
            </span>
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
            Qualification based on sealed bid
          </p>
        </div>

        {/* Col 4 */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <ArrowDown className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
            Min Decrement Step
          </span>
          <p className="text-xl font-black text-blue-300">
            {minDecrementAmount > 0 ? `₹${minDecrementAmount.toLocaleString('en-IN')}` : 'To be configured'}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
            Standard decrement per bid
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800">
        <button
          type="button"
          disabled
          className="w-full sm:w-auto h-11 px-6 rounded-xl bg-slate-800/90 text-slate-400 font-bold text-xs uppercase tracking-wider border border-slate-700 cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
          Auction Will Open After Stage 1 Evaluation
        </button>
      </div>
    </div>
  );
}
