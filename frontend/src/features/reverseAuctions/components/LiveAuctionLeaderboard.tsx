'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Activity,
  Trophy,
  Users,
  Clock,
  RefreshCw,
  ExternalLink,
  Square,
  CheckCircle2,
  TrendingDown,
  Loader2,
  Receipt,
  Award,
  Gavel,
  IndianRupee,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { reverseAuctionApi, type ReverseAuction, type ReverseAuctionParticipant } from '../api';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { formatCurrency, formatTime } from '../../shared/format';
import { DataTable, ColumnDef } from '../../../components/ui/data-table';

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
  const pathname = usePathname();
  const { user } = useAuth();
  const isBuyer = user?.role === 'buyer' || pathname?.startsWith('/buyer');
  const rolePrefix = isBuyer ? '/buyer' : (user?.role === 'admin' ? '/admin' : (user?.role === 'shg' ? '/shg' : '/seller'));
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
      const partList = Array.isArray(partData)
        ? partData
        : Array.isArray((partData as any)?.participants)
        ? (partData as any).participants
        : [];
      const bidsList = Array.isArray(bidsData)
        ? bidsData
        : Array.isArray((bidsData as any)?.bids)
        ? (bidsData as any).bids
        : [];
      setAuction(aucData);
      setParticipants(partList);
      setBids(bidsList);
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

  const startPrice = Number(auction?.startPrice || 0);

  // Effective participants resolution: merge participants with bids or synthesize if empty
  const effectiveParticipants = useMemo<ReverseAuctionParticipant[]>(() => {
    // If participants are provided and non-empty
    if (participants && participants.length > 0) {
      return participants.map((p, idx) => {
        const vendorBids = bids.filter(b =>
          (p.sellerOrgId && (b.sellerOrgId === p.sellerOrgId || b.sellerOrgName === p.sellerOrgName)) ||
          (p.sellerUserId && b.sellerId === p.sellerUserId)
        );
        const lowestBid = vendorBids.length > 0
          ? Math.min(...vendorBids.map(b => Number(b.amount || b.bidAmount || 0)).filter(n => n > 0))
          : null;
        return {
          ...p,
          lastBidAmount: p.lastBidAmount || (lowestBid !== Infinity && lowestBid !== null ? lowestBid : p.lastBidAmount),
          currentRank: p.currentRank || idx + 1
        };
      });
    }

    // If participants array is empty but we have bids, synthesize from bids
    if (bids && bids.length > 0) {
      const vendorMap = new Map<string, { sellerOrgId?: number | null; sellerUserId?: number | null; sellerOrgName: string; lowestBid: number }>();

      bids.forEach((b: any) => {
        const key = String(b.sellerOrgId || b.sellerOrgName || b.sellerId || 'unknown');
        const amt = Number(b.amount || b.bidAmount || 0);
        if (amt <= 0) return;

        const existing = vendorMap.get(key);
        if (!existing) {
          vendorMap.set(key, {
            sellerOrgId: b.sellerOrgId || null,
            sellerUserId: b.sellerId || null,
            sellerOrgName: b.sellerOrgName || (b.sellerOrgId ? `Vendor #${b.sellerOrgId}` : 'Participating Supplier'),
            lowestBid: amt
          });
        } else if (amt < existing.lowestBid) {
          existing.lowestBid = amt;
          if (b.sellerOrgName) existing.sellerOrgName = b.sellerOrgName;
        }
      });

      const list = Array.from(vendorMap.values());
      list.sort((a, b) => a.lowestBid - b.lowestBid);

      return list.map((item, idx) => ({
        id: item.sellerOrgId || idx + 1,
        auctionId: auctionId,
        sellerOrgId: item.sellerOrgId,
        sellerUserId: item.sellerUserId,
        sellerOrgName: item.sellerOrgName,
        currentRank: idx + 1,
        lastBidAmount: item.lowestBid,
        status: 'TECHNICALLY_QUALIFIED'
      }));
    }

    return [];
  }, [participants, bids, auctionId]);

  // Sorted participants
  const sortedParticipants = useMemo(() => {
    return [...effectiveParticipants].sort((a, b) => {
      const rankA = Number(a.currentRank || 999);
      const rankB = Number(b.currentRank || 999);
      if (rankA !== rankB) return rankA - rankB;
      return Number(a.lastBidAmount || 0) - Number(b.lastBidAmount || 0);
    });
  }, [effectiveParticipants]);

  const leaderboardColumns = useMemo<ColumnDef<ReverseAuctionParticipant>[]>(() => [
    {
      key: 'rank',
      header: 'Rank',
      width: 'w-[14%]',
      cell: (part, idx) => {
        const rank = part.currentRank || idx + 1;
        const isL1 = rank === 1;
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-black tracking-wide ${
              isL1
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : rank === 2
                ? 'bg-slate-100 text-slate-800 border border-slate-300'
                : rank === 3
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isL1 ? '🥇 L1' : rank === 2 ? '🥈 L2' : rank === 3 ? '🥉 L3' : `L${rank}`}
          </span>
        );
      }
    },
    {
      key: 'vendor',
      header: 'Vendor Organization',
      width: 'w-[36%]',
      cell: (part) => (
        <div className="flex items-center gap-2">
          <span className="text-slate-900 font-bold text-xs">
            {part.sellerOrgName || `Vendor #${part.sellerOrgId}`}
          </span>
          {part.currentRank === 1 && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-emerald-800">
              Lead Offer
            </span>
          )}
        </div>
      )
    },
    {
      key: 'bestBid',
      header: 'Best Bid (INR)',
      width: 'w-[20%]',
      cell: (part) => {
        const amount = Number(part.lastBidAmount || 0);
        const isL1 = (part.currentRank || 1) === 1;
        return (
          <span className={`text-xs font-mono font-black ${isL1 ? 'text-emerald-700' : 'text-slate-900'}`}>
            {amount > 0 ? formatCurrency(amount) : 'Awaiting Bid'}
          </span>
        );
      }
    },
    {
      key: 'savings',
      header: 'Savings from Opening',
      width: 'w-[18%]',
      cell: (part) => {
        const amount = Number(part.lastBidAmount || 0);
        const diffFromStart = startPrice > amount && amount > 0 ? startPrice - amount : 0;
        return diffFromStart > 0 ? (
          <span className="text-emerald-600 font-bold font-mono text-[11px]">
            -{formatCurrency(diffFromStart)}
          </span>
        ) : (
          <span className="text-slate-400 text-[11px] font-medium">Opening Level</span>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-[12%]',
      align: 'right',
      cell: (part, idx) => {
        const rank = part.currentRank || idx + 1;
        const isL1 = rank === 1;
        return (
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              isL1
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isL1 ? 'Winning Lead' : 'Participating'}
          </span>
        );
      }
    }
  ], [startPrice]);

  if (loading && !auction) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span className="text-xs font-bold">Synchronizing Reverse Auction Leaderboard…</span>
      </div>
    );
  }

  if (!auction) return null;

  const status = String(auction.statusEnum || auction.status || 'DRAFT').toUpperCase();
  const isLive = status === 'LIVE';
  const isCompleted = ['CLOSED', 'COMPLETED', 'AWARD_RECOMMENDED', 'AWARDED'].includes(status);
  
  // Calculate lowest bid from sorted participants or auction
  const lowestParticipantBid = sortedParticipants.length > 0 ? Number(sortedParticipants[0].lastBidAmount || 0) : 0;
  const currentLowest = lowestParticipantBid > 0 
    ? lowestParticipantBid 
    : Number(auction.currentLowestAmount || auction.currentLowestBid || auction.currentBid || startPrice);
  
  const savings = startPrice > 0 && currentLowest > 0 && currentLowest < startPrice ? startPrice - currentLowest : 0;
  const savingsPercent = startPrice > 0 && savings > 0 ? (savings / startPrice) * 100 : 0;
  const l1Winner = sortedParticipants[0];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden space-y-4 p-4 sm:p-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isLive
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : isCompleted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive
                    ? 'bg-red-500 animate-ping'
                    : isCompleted
                    ? 'bg-emerald-500'
                    : 'bg-blue-500'
                }`}
              />
              {isLive ? 'Reverse Auction — Live' : isCompleted ? 'Reverse Auction Completed' : status}
            </span>
            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
              {auction.auctionCode || `RA-${auction.id}`}
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            {auction.title || 'Dynamic Reverse Auction Bidding Room'}
          </h2>
        </div>

        {/* Live Timer & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-red-600 animate-pulse" aria-hidden="true" />
              <div className="text-right">
                <span className="block text-[8.5px] font-bold uppercase tracking-wider text-red-600">
                  Time Left
                </span>
                <span className="font-mono text-xs font-black text-red-700" role="timer" aria-live="off">
                  {timeLeft}
                </span>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchAuctionData(true)}
            disabled={refreshing}
            className="h-8.5 px-3 rounded-xl text-xs font-bold text-slate-700 border-slate-250 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isLive && (
            <Link
              href={`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(auction.auctionCode || String(auction.id))}/live`}
              className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Full Board
            </Link>
          )}

          {isLive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseAuction}
              disabled={actionLoading === 'close'}
              className="h-8.5 px-3 rounded-xl text-xs font-bold text-red-600 border-red-200 hover:bg-red-50"
            >
              {actionLoading === 'close' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5 mr-1" />}
              Close Auction
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Strip - Compact & Proportional */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Current L1 */}
        <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white p-3 sm:p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Current L1 (Lowest)
            </span>
            <div className="h-6 w-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Trophy className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-mono font-black text-emerald-950" role="status" aria-live="polite">
            {formatCurrency(currentLowest)}
          </p>
          <p className="text-[10px] font-medium text-emerald-700">
            Opening: {formatCurrency(startPrice)}
          </p>
        </div>

        {/* Total Savings */}
        <div className="rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/50 to-white p-3 sm:p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
              Savings Generated
            </span>
            <div className="h-6 w-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-mono font-black text-blue-950" role="status" aria-live="polite">
            {formatCurrency(savings)}
          </p>
          <p className="text-[10px] font-medium text-blue-700">
            {savingsPercent > 0 ? `${savingsPercent.toFixed(2)}% below opening` : 'Bidding in progress'}
          </p>
        </div>

        {/* Bids Submitted */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Bids Submitted
            </span>
            <div className="h-6 w-6 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center">
              <Activity className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-black text-slate-900">{bids.length}</p>
          <p className="text-[10px] font-medium text-slate-500">Verified server bids</p>
        </div>

        {/* Qualified Vendors */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Qualified Vendors
            </span>
            <div className="h-6 w-6 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-black text-slate-900">{sortedParticipants.length}</p>
          <p className="text-[10px] font-medium text-slate-500">Active participants</p>
        </div>
      </div>

      {/* If Completed & PO ready to generate */}
      {isCompleted && l1Winner && (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-white p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-emerald-800">
                L1 Evaluated Winner
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
                {l1Winner.sellerOrgName || `Vendor #${l1Winner.sellerOrgId}`} — {formatCurrency(Number(l1Winner.lastBidAmount || currentLowest))}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Concluded with {formatCurrency(savings)} ({savingsPercent.toFixed(1)}%) in savings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {generatedPo ? (
              <Button
                type="button"
                onClick={() => router.push(`/buyer/orders?orderId=${generatedPo.id}`)}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-2xs flex items-center gap-1.5"
              >
                <Receipt className="h-3.5 w-3.5" /> View PO ({generatedPo.poNumber})
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(auction?.auctionCode || auctionId)}/result`)}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-2xs flex items-center gap-1.5"
              >
                <Award className="h-3.5 w-3.5" /> Review Outcomes & Award
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Real-time Leaderboard Table */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-amber-500" /> Live Bid Ranking Leaderboard
        </h3>
        <DataTable<ReverseAuctionParticipant>
          columns={leaderboardColumns}
          data={sortedParticipants}
          keyExtractor={(part, idx) => String(part.id || idx)}
          emptyTitle="No participating vendors"
          emptyDescription="No participating vendors recorded yet."
          minWidth="min-w-[600px]"
          rowClassName={(part, idx) => {
            const rank = part.currentRank || idx + 1;
            return rank === 1 ? 'bg-emerald-50/40 font-bold' : '';
          }}
        />
      </div>

      {/* Real-time Bid Activity Stream */}
      {bids.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Recent Bidding Activity (Audit Stream)
          </span>
          <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
            {bids.slice(0, 10).map((bidItem, idx) => (
              <div key={bidItem.id || idx} className="flex items-center justify-between text-xs text-slate-600 py-0.5">
                <span className="font-mono text-[10px] text-slate-400">
                  {bidItem.submittedAt ? formatTime(bidItem.submittedAt) : '—'}
                </span>
                <span className="font-medium text-slate-800">
                  <strong className="font-bold">{bidItem.sellerOrgName || `Vendor #${bidItem.sellerOrgId}`}</strong> submitted offer of{' '}
                  <span className="font-black text-emerald-700 font-mono">{formatCurrency(Number(bidItem.amount || bidItem.bidAmount || 0))}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Rank L{bidItem.rankAtSubmission || bidItem.bidderRank || '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
