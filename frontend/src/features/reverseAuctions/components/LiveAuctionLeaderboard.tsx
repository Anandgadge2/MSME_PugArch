'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Trophy,
  Users,
  Percent,
  Clock,
  RefreshCw,
  ExternalLink,
  Square,
  CheckCircle2,
  FileCheck,
  TrendingDown,
  Loader2,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { reverseAuctionApi, type ReverseAuction, type ReverseAuctionParticipant } from '../api';
import { toast } from 'sonner';
import { formatTime } from '../../shared/format';

export interface LiveAuctionLeaderboardProps {
  auctionId: number;
  onAuctionClosed?: () => void;
  onPoGenerated?: (po: any) => void;
}

export default function LiveAuctionLeaderboard({
  auctionId,
  onAuctionClosed,
  onPoGenerated,
}: LiveAuctionLeaderboardProps) {
  const router = useRouter();
  const [auction, setAuction] = useState<ReverseAuction | null>(null);
  const [participants, setParticipants] = useState<ReverseAuctionParticipant[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [generatedPo, setGeneratedPo] = useState<any | null>(null);

  const fetchAuctionData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [aucData, partData, bidsData] = await Promise.all([
        reverseAuctionApi.get(auctionId),
        reverseAuctionApi.participants(auctionId).catch(() => ({ participants: [] })),
        reverseAuctionApi.bids(auctionId).catch(() => ({ bids: [] })),
      ]);
      setAuction(aucData);
      setParticipants(partData.participants || []);
      setBids(bidsData.bids || []);
    } catch (err: any) {
      // Silent in background, alert on manual
      if (isManual) toast.error('Failed to update live auction data');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuctionData();
  }, [auctionId]);

  // Polling: 3s if LIVE, 15s if SCHEDULED or CLOSED
  useEffect(() => {
    if (!auction) return;
    const isLive = String(auction.statusEnum || auction.status || '').toUpperCase() === 'LIVE';
    const intervalTime = isLive ? 3000 : 15000;

    const interval = setInterval(() => {
      // Only refetch if page is visible
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchAuctionData();
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [auction?.status, auction?.statusEnum]);

  // Countdown timer logic
  useEffect(() => {
    if (!auction?.endTime) return;
    const isLive = String(auction.statusEnum || auction.status || '').toUpperCase() === 'LIVE';

    const updateTimer = () => {
      const end = new Date(auction.endTime).getTime();
      const now = Date.now();
      const diff = end - now;

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
  }, [auction?.endTime, auction?.status]);

  const handleCloseAuction = async () => {
    if (!confirm('Are you sure you want to close this reverse auction now?')) return;
    setActionLoading('close');
    try {
      await reverseAuctionApi.transition(auctionId, 'close');
      toast.success('Reverse auction closed.');
      await fetchAuctionData();
      if (onAuctionClosed) onAuctionClosed();
    } catch (err: any) {
      toast.error(err.message || 'Failed to close auction');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptAndGeneratePo = async () => {
    if (!confirm('Accept L1 quote and generate official Purchase Order for the winning supplier?')) return;
    setActionLoading('po');
    try {
      const result = await reverseAuctionApi.acceptAndGeneratePo(auctionId);
      toast.success(`Purchase Order ${result.purchaseOrder?.poNumber} generated successfully!`);
      setGeneratedPo(result.purchaseOrder);
      if (onPoGenerated) onPoGenerated(result.purchaseOrder);
      await fetchAuctionData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate Purchase Order');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !auction) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span className="text-xs font-bold">Synchronizing Reverse Auction Leaderboard…</span>
      </div>
    );
  }

  if (!auction) return null;

  const status = String(auction.statusEnum || auction.status || 'DRAFT').toUpperCase();
  const isLive = status === 'LIVE';
  const isCompleted = ['CLOSED', 'COMPLETED', 'AWARD_RECOMMENDED', 'AWARDED'].includes(status);
  const startPrice = Number(auction.startPrice || 0);
  const currentLowest = Number(auction.currentLowestAmount || auction.currentLowestBid || auction.currentBid || startPrice);
  const savings = startPrice > 0 && currentLowest > 0 && currentLowest < startPrice ? startPrice - currentLowest : 0;
  const savingsPercent = startPrice > 0 && savings > 0 ? (savings / startPrice) * 100 : 0;

  // Sorted participants
  const sortedParticipants = [...participants].sort((a, b) => {
    const rankA = Number(a.currentRank || 999);
    const rankB = Number(b.currentRank || 999);
    if (rankA !== rankB) return rankA - rankB;
    return Number(a.lastBidAmount || 0) - Number(b.lastBidAmount || 0);
  });

  const l1Winner = sortedParticipants[0];

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white shadow-md overflow-hidden space-y-6 p-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isLive
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : isCompleted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLive
                    ? 'bg-red-500 animate-ping'
                    : isCompleted
                    ? 'bg-emerald-500'
                    : 'bg-blue-500'
                }`}
              />
              {isLive ? 'REVERSE AUCTION — LIVE' : isCompleted ? 'REVERSE AUCTION COMPLETED' : status}
            </span>
            <span className="font-mono text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
              {auction.auctionCode || `RA-${auction.id}`}
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            {auction.title || 'Dynamic Reverse Auction Bidding Room'}
          </h2>
        </div>

        {/* Live Timer & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isLive && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50/80 border border-red-200 px-4 py-2">
              <Clock className="h-4 w-4 text-red-600 animate-pulse" />
              <div className="text-right">
                <span className="block text-[9px] font-black uppercase tracking-widest text-red-600">
                  Time Remaining
                </span>
                <span className="font-mono text-base font-black text-red-700">{timeLeft}</span>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchAuctionData(true)}
            disabled={refreshing}
            className="h-10 px-3.5 rounded-xl text-xs font-bold text-slate-700 border-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Link
            href={`/seller/procurement/reverse-auction/${auction.id}/live`}
            target="_blank"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open Full Board
          </Link>

          {isLive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseAuction}
              disabled={actionLoading === 'close'}
              className="h-10 px-3.5 rounded-xl text-xs font-black text-red-600 border-red-200 hover:bg-red-50"
            >
              {actionLoading === 'close' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5 mr-1" />}
              Close Auction
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5 text-emerald-600" /> Current L1 (Lowest)
          </span>
          <p className="text-xl font-black text-emerald-950">
            ₹{currentLowest.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] font-semibold text-emerald-700">
            Opening: ₹{startPrice.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5 text-blue-600" /> Total Savings Generated
          </span>
          <p className="text-xl font-black text-blue-950">
            ₹{savings.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] font-semibold text-blue-700">
            {savingsPercent > 0 ? `${savingsPercent.toFixed(2)}% below opening` : 'Bidding in progress'}
          </p>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-purple-600" /> Bids Submitted
          </span>
          <p className="text-xl font-black text-purple-950">{bids.length}</p>
          <p className="text-[10px] font-semibold text-purple-700">Server verified offers</p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-indigo-600" /> Qualified Vendors
          </span>
          <p className="text-xl font-black text-indigo-950">{sortedParticipants.length}</p>
          <p className="text-[10px] font-semibold text-indigo-700">Active participants</p>
        </div>
      </div>

      {/* If Completed & PO ready to generate */}
      {isCompleted && l1Winner && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <span className="rounded-md bg-emerald-100/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                L1 Evaluated Winner
              </span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">
                {l1Winner.sellerOrgName || `Vendor #${l1Winner.sellerOrgId}`} — ₹{Number(l1Winner.lastBidAmount || currentLowest).toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Reverse auction concluded successfully with ₹{savings.toLocaleString('en-IN')} ({savingsPercent.toFixed(1)}%) in procurement savings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {generatedPo ? (
              <Button
                type="button"
                onClick={() => router.push(`/procurement-orders/${generatedPo.id}`)}
                className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center gap-2"
              >
                <Receipt className="h-4 w-4" /> View PO ({generatedPo.poNumber})
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleAcceptAndGeneratePo}
                disabled={actionLoading === 'po'}
                className="h-11 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-emerald-600/25 flex items-center gap-2"
              >
                {actionLoading === 'po' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating PO…
                  </>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4" /> Accept & Generate PO
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Real-time Leaderboard Table */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Live Bid Ranking Leaderboard
        </h3>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200">
                <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Vendor Organization</th>
                  <th className="px-4 py-3">Best Bid (INR)</th>
                  <th className="px-4 py-3">Savings from Opening</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {sortedParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                      No participating vendors recorded yet.
                    </td>
                  </tr>
                ) : (
                  sortedParticipants.map((part, idx) => {
                    const rank = part.currentRank || idx + 1;
                    const amount = Number(part.lastBidAmount || 0);
                    const isL1 = rank === 1;
                    const diffFromStart = startPrice > amount && amount > 0 ? startPrice - amount : 0;

                    return (
                      <tr
                        key={part.id || idx}
                        className={`transition ${
                          isL1
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70 font-bold'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${
                              isL1
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : rank === 2
                                ? 'bg-slate-200 text-slate-800'
                                : rank === 3
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isL1 ? '🥇 L1' : rank === 2 ? '🥈 L2' : rank === 3 ? '🥉 L3' : `L${rank}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-900 font-black">
                          {part.sellerOrgName || `Vendor #${part.sellerOrgId}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-black ${isL1 ? 'text-emerald-700' : 'text-slate-900'}`}>
                            {amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'Awaiting Bid'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {diffFromStart > 0 ? (
                            <span className="text-emerald-600 font-bold text-[11px]">
                              -₹{diffFromStart.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            'Opening Level'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${
                              isL1
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isL1 ? 'Winning Lead' : 'Participating'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Real-time Bid Activity Stream */}
      {bids.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Recent Bidding Activity (Audit Stream)
          </span>
          <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
            {bids.slice(0, 10).map((bidItem, idx) => (
              <div key={bidItem.id || idx} className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-mono text-[10px] text-slate-400">
                  {bidItem.submittedAt ? formatTime(bidItem.submittedAt) : '—'}
                </span>
                <span className="font-bold text-slate-800">
                  {bidItem.sellerOrgName || `Vendor #${bidItem.sellerOrgId}`} submitted offer of{' '}
                  <span className="font-black text-emerald-700">₹{Number(bidItem.amount || bidItem.bidAmount || 0).toLocaleString('en-IN')}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Rank L{bidItem.rankAtSubmission || '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
