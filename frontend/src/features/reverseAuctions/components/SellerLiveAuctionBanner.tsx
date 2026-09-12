'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Gavel,
  Clock,
  IndianRupee,
  Trophy,
  ArrowDown,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  Loader2,
  AlertCircle,
  EyeOff,
  Info,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { reverseAuctionApi, type ReverseAuction, type ReverseAuctionParticipant } from '../api';
import PlaceLowerBidModal from './PlaceLowerBidModal';

export interface SellerLiveAuctionBannerProps {
  auctionId: number;
  procurementTitle?: string;
  procurementReference?: string;
  onBidSubmitted?: () => void;
}

export default function SellerLiveAuctionBanner({
  auctionId,
  procurementTitle,
  procurementReference,
  onBidSubmitted,
}: SellerLiveAuctionBannerProps) {
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');

  const fetchLiveSummary = async () => {
    try {
      const data = await reverseAuctionApi.liveSummary(auctionId);
      setSummary(data);
    } catch (err) {
      // Silent in background
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveSummary();
    const interval = setInterval(fetchLiveSummary, 3000);
    return () => clearInterval(interval);
  }, [auctionId]);

  const auction: ReverseAuction | undefined = summary?.auction;
  const participant: ReverseAuctionParticipant | undefined = summary?.participant;

  const status = String(auction?.statusEnum || auction?.status || '').toUpperCase();
  const startTimeMs = auction?.startTime ? new Date(auction.startTime).getTime() : 0;
  const endTimeMs = auction?.endTime ? new Date(auction.endTime).getTime() : 0;
  const nowMs = Date.now();

  const isScheduled = status === 'SCHEDULED' || (startTimeMs > 0 && startTimeMs > nowMs);
  const isLive = status === 'LIVE' && !isScheduled;

  useEffect(() => {
    const targetMs = isScheduled ? startTimeMs : endTimeMs;
    if (!targetMs) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetMs - now;

      if (diff <= 0) {
        setTimeLeft('00:00:00');
      } else {
        const days = Math.floor(diff / 86400000);
        const hrs = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
        const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
        const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
        if (days > 0) {
          setTimeLeft(`${days}d ${hrs}h ${mins}m ${secs}s`);
        } else {
          setTimeLeft(`${hrs}:${mins}:${secs}`);
        }
      }
    };
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [isScheduled, startTimeMs, endTimeMs]);

  const formattedStartTime = useMemo(() => {
    if (!auction?.startTime) return 'To be announced';
    try {
      const d = new Date(auction.startTime);
      if (isNaN(d.getTime())) return String(auction.startTime);
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${year}, ${hh}:${mm} IST`;
    } catch {
      return String(auction.startTime);
    }
  }, [auction?.startTime]);

  if (loading && !summary) {
    return null;
  }

  if (!auction) return null;

  if (!isLive && !isScheduled) {
    return null;
  }

  const currentLowest = Number(summary?.currentLowestPrice || auction.currentLowestAmount || auction.startPrice || 0);
  const minNextBid = Number(summary?.minimumNextBid || currentLowest);
  const minDecrement = Number(auction.minDecrementAmount || 1000);
  const myCurrentRank = participant?.currentRank;
  const isL1 = myCurrentRank === 1;

  return (
    <>
      <div
        className={`rounded-3xl border-2 p-6 text-white shadow-xl relative overflow-hidden animate-in fade-in duration-300 ${
          isLive
            ? 'border-red-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-[#0b1b36] shadow-red-950/20'
            : 'border-blue-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-[#0a192f] shadow-blue-950/20'
        }`}
        role="region"
        aria-label={isLive ? 'Stage 2 Live Reverse Auction' : 'Stage 2 Scheduled Reverse Auction'}
      >
        {/* Anti-collusion badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              {isLive ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400" />
              )}
            </span>
            <span
              className={`text-xs font-black uppercase tracking-widest ${
                isLive ? 'text-red-400' : 'text-blue-400'
              }`}
            >
              {isLive ? 'Stage 2: Live Reverse Auction Active' : 'Stage 2: Reverse Auction (Scheduled)'}
            </span>
            {procurementReference && (
              <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300">
                {procurementReference}
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                isLive
                  ? 'bg-red-950/80 border border-red-500/30 text-red-300'
                  : 'bg-blue-950/80 border border-blue-500/30 text-blue-300'
              }`}
            >
              {isLive ? 'Dynamic Bidding Window' : 'Scheduled Bidding Window'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
            <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Anti-Collusion Masked (Competitor IDs Hidden)</span>
          </div>
        </div>

        {/* Two-Stage Explanatory Banner */}
        <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-slate-900/90 border border-slate-800 px-3.5 py-2 text-[11px] text-slate-300">
          <Info className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span>
            {isLive ? (
              <>
                <strong className="text-amber-300">Two-Stage Procurement Notice:</strong> This banner reflects the <strong>Stage 2 Live Reverse Auction</strong> closing time. Initial qualification quotes must be submitted by the <strong>Stage 1 Submission Deadline</strong> below.
              </>
            ) : (
              <>
                <strong className="text-blue-300">Two-Stage Procurement Notice:</strong> This reverse auction is scheduled to commence on <strong>{formattedStartTime}</strong> following technical qualification. Initial qualification quotes must be submitted by the <strong>Stage 1 Submission Deadline</strong> below.
              </>
            )}
          </span>
        </div>

        {/* Content & KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
          {/* Time Remaining */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Clock className={`h-3.5 w-3.5 ${isLive ? 'text-red-400' : 'text-blue-400'}`} aria-hidden="true" />
              {isLive ? 'Auction Closes In' : 'Auction Opens In'}
            </span>
            <p className={`font-mono text-2xl font-black tracking-wider ${isLive ? 'text-red-400' : 'text-blue-400'}`}>
              {timeLeft}
            </p>
            <p className="text-[10px] text-slate-300/90 font-medium">
              {isLive ? 'Stage 2 Live Auction Cutoff' : `Scheduled Start: ${formattedStartTime}`}
            </p>
          </div>

          {/* Market L1 / Ceiling */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              {isLive ? 'Market Current L1' : 'Ceiling / Start Price'}
            </span>
            <p className="text-2xl font-black text-emerald-400">
              ₹{currentLowest.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {isLive ? 'Lowest evaluated price' : 'Initial ceiling reference'}
            </p>
          </div>

          {/* My Rank / Standing */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
              {isLive ? 'Your Current Standing' : 'Eligibility Status'}
            </span>
            {isLive ? (
              <>
                <p className="text-2xl font-black text-white flex items-center gap-2">
                  <span
                    className={`inline-flex px-3 py-0.5 rounded-xl text-lg font-black ${
                      isL1
                        ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                        : myCurrentRank
                        ? 'bg-slate-800 text-slate-200 border border-slate-700'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isL1 ? '🥇 Rank L1 (Leading)' : myCurrentRank ? `Rank L${myCurrentRank}` : 'Not Ranked'}
                  </span>
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {participant?.lastBidAmount ? `Your last bid: ₹${Number(participant.lastBidAmount).toLocaleString('en-IN')}` : 'No bid submitted yet'}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-slate-200 flex items-center gap-2 pt-1">
                  <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-800 text-blue-300 border border-blue-900/60">
                    Stage 1 Review Pending
                  </span>
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Eligible upon Stage 1 quote acceptance
                </p>
              </>
            )}
          </div>

          {/* Next Allowed Bid / Min Decrement */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ArrowDown className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              {isLive ? 'Max Permitted Next Bid' : 'Min Decrement Step'}
            </span>
            <p className="text-2xl font-black text-blue-300">
              ₹{(isLive ? minNextBid : minDecrement).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {isLive ? `Min decrement: ₹${minDecrement.toLocaleString('en-IN')}` : 'Standard decrement per bid'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Link
            href={`/seller/procurement/reverse-auction/${auctionId}/live`}
            className="w-full sm:w-auto h-11 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {isLive ? 'Open Full Bidding Console' : 'Preview Bidding Console'}
          </Link>

          {isLive ? (
            <Button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto h-11 px-7 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:via-rose-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <Gavel className="h-4 w-4" aria-hidden="true" /> Place Lower Bid Now
            </Button>
          ) : (
            <Button
              type="button"
              disabled
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-slate-800/90 text-slate-400 font-bold text-xs uppercase tracking-wider border border-slate-700 cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Bidding Opens After Stage 1 Qualification
            </Button>
          )}
        </div>
      </div>

      {/* Place Lower Bid Modal */}
      {isModalOpen && isLive && (
        <PlaceLowerBidModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          auctionId={auctionId}
          currentLowestBid={currentLowest}
          minNextBid={minNextBid}
          minDecrement={minDecrement}
          myLastBid={Number(participant?.lastBidAmount || 0)}
          onSuccess={() => {
            fetchLiveSummary();
            if (onBidSubmitted) onBidSubmitted();
          }}
        />
      )}
    </>
  );
}
