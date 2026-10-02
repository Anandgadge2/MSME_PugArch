'use client';

import { FormEvent, useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Ban,
  Clock3,
  EyeOff,
  Gavel,
  History,
  Hourglass,
  IndianRupee,
  Info,
  LineChart as LineChartIcon,
  Lock,
  RadioTower,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Trophy,
  Users,
  X,
  Gauge,
  Percent,
  CheckCircle2,
  ChevronRight,
  UserCheck,
  ExternalLink,
  FileText,
  Tag,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { DataTable, ColumnDef } from '../../../components/ui/data-table';
import { formatCurrency, formatDateTime, formatDateTimeWithSeconds, formatNumber, formatTime, formatTimeWithSeconds } from '../../shared/format';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../hooks/useAuth';
import { reverseAuctionApi, type ReverseAuction, type ReverseAuctionBid, type ReverseAuctionParticipant } from '../api';
import { useReverseAuctionRealtime } from '../hooks/useReverseAuctionRealtime';
import { toast } from 'sonner';

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getStatus = (auction?: ReverseAuction) => String(auction?.statusEnum || auction?.status || 'DRAFT').toUpperCase();

const isAuctionLive = (auction?: ReverseAuction, serverTime?: string) => {
  if (!auction) return false;
  const now = serverTime ? new Date(serverTime).getTime() : Date.now();
  return getStatus(auction) === 'LIVE' && new Date(auction.startTime).getTime() <= now && new Date(auction.endTime).getTime() > now;
};

const getCurrentLowest = (auction?: ReverseAuction) =>
  numberValue(auction?.currentLowestAmount ?? auction?.currentLowestBid ?? auction?.currentBid ?? auction?.startPrice, 0);

const getBidAmount = (bid: ReverseAuctionBid) => numberValue(bid.amount ?? bid.bidAmount, 0);

const liveSummaryCache = new Map<number | string, any>();

const liveAwareRefetch = (query: any) => {
  const cachedAuction = liveSummaryCache.get(query?.queryKey?.[1])?.auction;
  const auction = query?.state?.data?.auction || cachedAuction || (query?.state?.data?.status ? query?.state?.data : undefined);
  if (!auction) return 10_000;
  return isAuctionLive(auction, query?.state?.data?.serverTime) ? 2_000 : 15_000;
};

const parseDescriptionContent = (rawText?: string | null) => {
  if (!rawText || !rawText.trim()) {
    return {
      narrative: 'Participate in a competitive reverse auction with live downward price tracking, real-time rank updates, and server timestamp verification.',
      badges: [] as Array<{ key: string; label: string; value: string; variant: 'blue' | 'emerald' | 'amber' | 'slate' }>
    };
  }

  const text = rawText.trim();

  // Split by newlines or inline concatenated keys like "Sourcing Method: ... Value: ... Urgency: ..."
  const rawSegments = text.split(/\r?\n/).flatMap(segment => {
    return segment.split(/(?<=\S)\s+(?=(?:Sourcing Method|Method|Value|Estimated Value|Budget|Urgency|Priority|Category):\s*)/i);
  }).map(s => s.trim()).filter(Boolean);

  const badges: Array<{ key: string; label: string; value: string; variant: 'blue' | 'emerald' | 'amber' | 'slate' }> = [];
  const narrativeParts: string[] = [];

  for (const seg of rawSegments) {
    const match = seg.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const rawKey = match[1].trim();
      const rawVal = match[2].trim();
      const lowerKey = rawKey.toLowerCase();

      if (lowerKey === 'sourcing method' || lowerKey === 'method') {
        const formattedVal = rawVal.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        badges.push({ key: 'method', label: 'Method', value: formattedVal, variant: 'blue' });
      } else if (lowerKey === 'value' || lowerKey === 'estimated value' || lowerKey === 'budget') {
        const formattedVal = rawVal.replace(/^INR\s*/i, '₹');
        badges.push({ key: 'value', label: 'Est. Value', value: formattedVal, variant: 'emerald' });
      } else if (lowerKey === 'urgency' || lowerKey === 'priority') {
        const formattedVal = rawVal.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        badges.push({ key: 'urgency', label: 'Urgency', value: formattedVal, variant: 'amber' });
      } else if (lowerKey === 'category') {
        badges.push({ key: 'category', label: 'Category', value: rawVal, variant: 'slate' });
      } else {
        narrativeParts.push(seg);
      }
    } else {
      narrativeParts.push(seg);
    }
  }

  const narrative = narrativeParts.join(' ').trim();
  return { narrative, badges };
};

export default function ReverseAuctionLivePage({ id }: { id: number | string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin' || user?.role === 'master_admin';
  const rolePrefix = pathname.startsWith('/buyer') ? '/buyer' :
                     pathname.startsWith('/admin') ? '/admin' :
                     pathname.startsWith('/shg') ? '/shg' :
                     user?.role === 'buyer' ? '/buyer' :
                     user?.role === 'admin' ? '/admin' :
                     user?.role === 'shg' ? '/shg' : '/seller';
  const [amount, setAmount] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [localError, setLocalError] = useState('');
  const [activeLogTab, setActiveLogTab] = useState<'stream' | 'leaderboard'>('stream');

  const summary = useQuery({
    queryKey: ['reverse-auction-live', id],
    queryFn: async () => {
      const result = await reverseAuctionApi.liveSummary(id);
      liveSummaryCache.set(id, result);
      return result;
    },
    staleTime: 3_000,
    refetchInterval: liveAwareRefetch,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => {
      if (previous !== undefined) return previous;
      if (liveSummaryCache.has(id)) return liveSummaryCache.get(id);
      const cached = qc.getQueryData<any>(['reverse-auction-live', id]);
      if (cached !== undefined) return cached;
      return undefined;
    }
  });

  const canonicalCode = summary.data?.auction?.auctionCode || liveSummaryCache.get(id)?.auction?.auctionCode || String(id);

  // Real-time WebSocket and Pusher synchronization
  useReverseAuctionRealtime(id, canonicalCode);

  // Sync URL to human-readable canonical code
  useEffect(() => {
    if (summary.data?.auction?.auctionCode && typeof window !== 'undefined') {
      const code = summary.data.auction.auctionCode;
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^(\/(?:seller|shg|buyer)\/procurement\/reverse-auction|\/reverse-auctions)\/([^/]+)(\/live)$/i);
      if (match) {
        const [, basePrefix, currentSlug, subRoute] = match;
        if (decodeURIComponent(currentSlug) !== code) {
          const newPath = `${basePrefix}/${encodeURIComponent(code)}${subRoute}${window.location.search || ''}${window.location.hash || ''}`;
          window.history.replaceState(null, '', newPath);
        }
      }
    }
  }, [summary.data?.auction?.auctionCode]);

  const participants = useQuery({
    queryKey: ['reverse-auction-participants', id],
    queryFn: () => reverseAuctionApi.participants(id),
    staleTime: 3_000,
    refetchInterval: liveAwareRefetch,
    refetchOnWindowFocus: false,
    enabled: !summary.isError,
  });

  const bids = useQuery({
    queryKey: ['reverse-auction-bids', id],
    queryFn: () => reverseAuctionApi.bids(id),
    staleTime: 3_000,
    refetchInterval: liveAwareRefetch,
    refetchOnWindowFocus: false,
    enabled: !summary.isError,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['reverse-auction-live', id] });
    qc.invalidateQueries({ queryKey: ['reverse-auction-participants', id] });
    qc.invalidateQueries({ queryKey: ['reverse-auction-bids', id] });
  };

  const transition = useMutation({
    mutationFn: (action: 'schedule' | 'start' | 'pause' | 'resume' | 'close') => reverseAuctionApi.transition(id, action),
    onSuccess: () => {
      setLocalError('');
      invalidate();
    },
    onError: (err: any) => {
      setLocalError(`Action failed: ${err.message}`);
    }
  });

  const bid = useMutation({
    mutationFn: (nextAmount: number) => reverseAuctionApi.placeBid(id, nextAmount),
    onSuccess: () => {
      setAmount('');
      setLocalError('');
      toast.success('Bid submitted successfully!');
      invalidate();
    },
    onError: (err: any) => {
      const rawMsg = String(err.message || 'Bid submission failed');
      const cleanMsg = rawMsg.includes('\n')
        ? (rawMsg.split('\n').find(l => l.trim().length > 0 && !l.includes('Invalid') && !l.includes('invocation')) || 'Bid submission failed. Please review your amount and try again.')
        : rawMsg;
      setLocalError(cleanMsg);
      toast.error(cleanMsg);
      invalidate();
      if (err?.details?.maxAllowedBid) {
        setAmount(String(err.details.maxAllowedBid));
      }
    }
  });

  const auction = (summary.data?.auction || liveSummaryCache.get(id)?.auction) as ReverseAuction | undefined;
  
  const loading = summary.isLoading && !auction;

  // Countdown timer logic
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [isNearEnding, setIsNearEnding] = useState(false);
  const live = auction ? isAuctionLive(auction, summary.data?.serverTime || liveSummaryCache.get(id)?.serverTime) : false;
  const status = auction ? getStatus(auction) : 'DRAFT';
  const parsedDesc = useMemo(() => parseDescriptionContent(auction?.description), [auction?.description]);

  useEffect(() => {
    if (!live || !auction?.endTime) {
      setTimeLeft('00:00:00');
      setIsNearEnding(false);
      return;
    }
    const updateTimer = () => {
      const end = new Date(auction.endTime).getTime();
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        setIsNearEnding(false);
      } else {
        // Highlight in urgent red if less than 5 minutes remain
        setIsNearEnding(diff <= 300_000);
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
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [live, auction?.endTime]);

  const participant = (summary.data?.participant || liveSummaryCache.get(id)?.participant) as ReverseAuctionParticipant | null | undefined;
  const participantRows = participants.data?.participants || [];
  
  // All bids in descending order by submission time
  const bidRows: ReverseAuctionBid[] = (bids.data?.bids || []).slice().sort(
    (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
  );
  const latestBid = bidRows[0];

  const rawCurrentLowest = getCurrentLowest(auction);
  const lowestFromBids = bidRows.reduce((lowest, b) => {
    const amt = getBidAmount(b);
    return amt > 0 && (!lowest || amt < lowest) ? amt : lowest;
  }, 0);
  const currentLowest = lowestFromBids > 0 && (rawCurrentLowest <= 0 || lowestFromBids < rawCurrentLowest)
    ? lowestFromBids
    : rawCurrentLowest;

  // Find authentic L1 Leader Bid (lowest valid commercial offer, tie-broken by earliest submission time)
  const leaderBid = useMemo(() => {
    const validBids = bidRows.filter(b => getBidAmount(b) > 0);
    if (validBids.length === 0) return null;
    return validBids.slice().sort((a, b) => {
      const amtA = getBidAmount(a);
      const amtB = getBidAmount(b);
      if (amtA !== amtB) return amtA - amtB;
      return new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime();
    })[0];
  }, [bidRows]);

  // Find L1 participant if available in participants list
  const leaderParticipant = useMemo(() => {
    if (participantRows.length > 0) {
      const sorted = participantRows.slice().sort((a, b) => {
        const rankA = Number(a.currentRank || 999);
        const rankB = Number(b.currentRank || 999);
        if (rankA !== rankB) return rankA - rankB;
        const amtA = Number(a.lastBidAmount || 999999999);
        const amtB = Number(b.lastBidAmount || 999999999);
        return amtA - amtB;
      });
      if (sorted[0] && (sorted[0].currentRank === 1 || Number(sorted[0].lastBidAmount) === currentLowest)) {
        return sorted[0];
      }
    }
    return null;
  }, [participantRows, currentLowest]);

  const leaderOrgName =
    leaderParticipant?.sellerOrgName ||
    leaderBid?.sellerOrgName ||
    (currentLowest > 0 ? 'L1 Bidder' : 'Awaiting Bids');

  const startPrice = numberValue(auction?.startPrice, 0);
  const savings = startPrice > currentLowest && currentLowest > 0 ? startPrice - currentLowest : 0;
  const savingsPercent = startPrice > 0 && savings > 0 ? (savings / startPrice) * 100 : 0;
  const decrement = numberValue(auction?.minDecrementAmount ?? auction?.minDecrement, 0);
  const percentDecrement = auction?.minDecrementPercent ? currentLowest * (numberValue(auction.minDecrementPercent, 0) / 100) : 0;
  const requiredDecrement = Math.max(decrement, percentDecrement);
  const calculatedNextBid = currentLowest > 0 && requiredDecrement > 0 ? Math.max(0, currentLowest - requiredDecrement) : 0;
  const serverMinNext = numberValue(summary.data?.minimumNextBid || liveSummaryCache.get(id)?.minimumNextBid, 0);
  const minNextBid = serverMinNext > 0 && calculatedNextBid > 0
    ? Math.min(serverMinNext, calculatedNextBid)
    : (serverMinNext || calculatedNextBid || (currentLowest > 0 && requiredDecrement > 0 ? Math.max(0, currentLowest - requiredDecrement) : currentLowest));

  // Compute seller's own best bid
  const myBestBid = useMemo(() => {
    if (summary.data?.myBestBid != null) return Number(summary.data.myBestBid);
    const myBids = bidRows.filter(b => b.isMyBid);
    if (myBids.length === 0) return 0;
    return myBids.reduce((best, b) => {
      const amt = getBidAmount(b);
      return amt > 0 && (!best || amt < best) ? amt : best;
    }, 0);
  }, [summary.data?.myBestBid, bidRows]);

  // Compute seller's own rank
  const myRank = useMemo(() => {
    if (summary.data?.myRank != null) return summary.data.myRank;
    if (participant?.currentRank != null) return participant.currentRank;
    const myP = participantRows.find(p => p.isCurrentViewer);
    return myP?.currentRank || null;
  }, [summary.data?.myRank, participant?.currentRank, participantRows]);

  // Active participants count
  const activeParticipantsCount = useMemo(() => {
    if (summary.data?.activeParticipantsCount != null) {
      return Number(summary.data.activeParticipantsCount);
    }
    const active = participantRows.filter((p: any) => 
      ['ACCEPTED', 'TECHNICALLY_QUALIFIED', 'BID_SUBMITTED'].includes(p.status) || p.lastBidAmount
    );
    return active.length || participantRows.length;
  }, [summary.data?.activeParticipantsCount, participantRows]);

  const extensionCount = numberValue(auction?.extensionCount, 0);
  const maxExtensions = auction?.maxAutoExtensions ?? 0;

  // Live bidding stream columns
  const liveBidColumns = useMemo<ColumnDef<ReverseAuctionBid>[]>(() => [
    {
      key: 'rank',
      header: 'Rank',
      width: 'w-[14%]',
      cell: (row) => {
        const rankNum = row.bidderRank || row.rankAtSubmission;
        const isL1 = rankNum === 1;
        return (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold shadow-xs tracking-tight",
            isL1
              ? "bg-amber-100 text-amber-900 border border-amber-300"
              : rankNum === 2
              ? "bg-slate-100 text-slate-800 border border-slate-300"
              : rankNum === 3
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          )}>
            {isL1 ? '🥇 L1' : rankNum === 2 ? '🥈 L2' : rankNum === 3 ? '🥉 L3' : `L${rankNum || '-'}`}
          </span>
        );
      }
    },
    {
      key: 'bidder',
      header: 'Participant / Bidder',
      width: 'w-[32%]',
      cell: (row: ReverseAuctionBid) => {
        if (row.isMyBid) {
          return (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
                YOU
              </span>
              <span className="font-extrabold text-blue-900 truncate max-w-[180px]" title={row.sellerOrgName || 'Your Organization'}>
                {isBuyerOrAdmin ? row.sellerOrgName : 'Your Organization'}
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-slate-300 shrink-0" aria-hidden="true" />
            <span className="font-bold text-slate-700 truncate max-w-[200px]" title={row.sellerOrgName || 'Competitor'}>
              {row.sellerOrgName || 'Competitor Bidder'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'submittedAt',
      header: 'Bid Time',
      width: 'w-[20%]',
      cell: (row) => (
        <span className="font-semibold text-slate-500 text-xs">
          {formatDateTime(row.submittedAt)}
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Commercial Bid',
      width: 'w-[20%]',
      cell: (row) => {
        const amt = getBidAmount(row);
        const isLowest = amt === currentLowest && currentLowest > 0;
        return (
          <span className={cn(
            "font-black font-mono text-sm tracking-tight",
            isLowest ? "text-emerald-700 font-extrabold" : "text-slate-900"
          )}>
            {formatCurrency(amt)}
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-[14%]',
      cell: (row) => (
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide",
          row.isValid === false
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
        )}>
          {row.isValid === false ? 'Invalid' : '✓ Valid'}
        </span>
      )
    }
  ], [isBuyerOrAdmin, currentLowest]);

  // Leaderboard columns for Participant Standings Tab
  const leaderboardColumns = useMemo<ColumnDef<ReverseAuctionParticipant>[]>(() => [
    {
      key: 'rank',
      header: 'Rank',
      width: 'w-[15%]',
      cell: (part, idx) => {
        const rank = part.currentRank || idx + 1;
        const isL1 = rank === 1;
        return (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black shadow-xs",
            isL1
              ? "bg-amber-100 text-amber-900 border border-amber-300"
              : rank === 2
              ? "bg-slate-100 text-slate-800 border border-slate-300"
              : rank === 3
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-slate-100 text-slate-600"
          )}>
            {isL1 ? '🥇 L1' : rank === 2 ? '🥈 L2' : rank === 3 ? '🥉 L3' : `L${rank}`}
          </span>
        );
      }
    },
    {
      key: 'participant',
      header: 'Participant / Organization',
      width: 'w-[35%]',
      cell: (part) => {
        if (part.isCurrentViewer) {
          return (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                YOU
              </span>
              <span className="font-black text-blue-900">
                {isBuyerOrAdmin ? part.sellerOrgName : 'Your Organization'}
              </span>
            </div>
          );
        }
        return (
          <span className="font-bold text-slate-800">
            {part.sellerOrgName || `Bidder #${part.sellerOrgId || '?'}`}
          </span>
        );
      }
    },
    {
      key: 'lastBid',
      header: 'Best Submitted Offer',
      width: 'w-[25%]',
      cell: (part) => {
        const amt = Number(part.lastBidAmount || 0);
        const isL1 = (part.currentRank || 1) === 1;
        return (
          <span className={cn("font-mono text-xs font-black", isL1 ? "text-emerald-700" : "text-slate-900")}>
            {amt > 0 ? formatCurrency(amt) : 'Awaiting First Bid'}
          </span>
        );
      }
    },
    {
      key: 'gap',
      header: 'Gap to L1',
      width: 'w-[25%]',
      cell: (part) => {
        const amt = Number(part.lastBidAmount || 0);
        if (amt <= 0) return <span className="text-slate-400 text-xs">-</span>;
        if ((part.currentRank || 1) === 1) {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Sparkles className="h-3 w-3" /> Leading L1
            </span>
          );
        }
        const gap = currentLowest > 0 && amt > currentLowest ? amt - currentLowest : 0;
        const gapPct = currentLowest > 0 ? (gap / currentLowest) * 100 : 0;
        return (
          <span className="text-xs font-bold text-amber-700 font-mono">
            +{formatCurrency(gap)} (+{gapPct.toFixed(1)}%)
          </span>
        );
      }
    }
  ], [isBuyerOrAdmin, currentLowest]);

  // Process data for the real-time bid chart:
  // For initial baseline bids submitted at the same time, higher quotes come first so downward progression is accurately reflected.
  const sortedBidRows = useMemo(() => {
    return bidRows
      .slice()
      .sort((a, b) => {
        const timeA = new Date(a.submittedAt || 0).getTime();
        const timeB = new Date(b.submittedAt || 0).getTime();
        if (Math.abs(timeA - timeB) > 2000) {
          return timeA - timeB; // Chronological order across distinct times
        }
        // If submitted within 2 seconds of each other (e.g. initial baseline import), sort higher amount first so reverse auction curve goes DOWN
        return getBidAmount(b) - getBidAmount(a);
      });
  }, [bidRows]);

  const chartData = useMemo(() => {
    return sortedBidRows.map((b, idx, arr) => {
      const amt = getBidAmount(b);
      const prevAmt = idx > 0 ? getBidAmount(arr[idx - 1]) : startPrice;
      const dropFromPrev = prevAmt > 0 && prevAmt > amt ? prevAmt - amt : 0;
      const dropFromPrevPct = prevAmt > 0 && dropFromPrev > 0 ? (dropFromPrev / prevAmt) * 100 : 0;
      const dropFromStart = startPrice > 0 && startPrice > amt ? startPrice - amt : 0;
      const dropFromStartPct = startPrice > 0 && dropFromStart > 0 ? (dropFromStart / startPrice) * 100 : 0;
      const rankNum = b.bidderRank || b.rankAtSubmission || (amt === currentLowest && currentLowest > 0 ? 1 : null);

      return {
        index: idx + 1,
        bidNumber: idx + 1,
        totalBids: arr.length,
        amount: amt,
        time: formatTimeWithSeconds(b.submittedAt || 0),
        shortTime: formatTime(b.submittedAt || 0),
        fullTime: formatDateTimeWithSeconds(b.submittedAt || 0),
        label: b.isMyBid ? 'Your Bid' : (b.sellerOrgName || `Bidder #${idx + 1}`),
        sellerOrgName: b.sellerOrgName,
        isMyBid: Boolean(b.isMyBid),
        rank: rankNum,
        isLowest: amt === currentLowest && currentLowest > 0,
        dropFromPrev,
        dropFromPrevPct,
        dropFromStart,
        dropFromStartPct,
        isFirstBid: idx === 0,
      };
    });
  }, [sortedBidRows, startPrice, currentLowest]);

  // Compute padded Y-Axis domain to ensure curve and dots have vertical breathing room
  const { chartYMin, chartYMax } = useMemo(() => {
    if (chartData.length === 0) return { chartYMin: 0, chartYMax: 100 };
    const amounts = chartData
      .map(d => Number(d.amount))
      .filter(v => Number.isFinite(v) && v > 0);
    if (Number.isFinite(startPrice) && startPrice > 0) amounts.push(startPrice);
    if (Number.isFinite(currentLowest) && currentLowest > 0) amounts.push(currentLowest);
    if (amounts.length === 0) return { chartYMin: 0, chartYMax: 100 };
    const minVal = Math.min(...amounts);
    const maxVal = Math.max(...amounts);
    const range = maxVal - minVal;
    const padding = range > 0 ? range * 0.15 : (minVal * 0.05 || 5000);
    const yMin = Math.max(0, Math.floor(minVal - padding));
    const yMax = Math.ceil(maxVal + padding);
    return {
      chartYMin: Number.isFinite(yMin) ? yMin : 0,
      chartYMax: Number.isFinite(yMax) && yMax > yMin ? yMax : (Number.isFinite(yMin) ? yMin + 1000 : 1000),
    };
  }, [chartData, startPrice, currentLowest]);

  // Determine if Start Price and L1 coincide closely to prevent overlapping ReferenceLine labels
  const startAndL1Same = useMemo(() => {
    return Number.isFinite(startPrice) && startPrice > 0 && Number.isFinite(currentLowest) && currentLowest > 0 && Math.abs(startPrice - currentLowest) < 1;
  }, [startPrice, currentLowest]);

  if (loading) return <LoadingState label="Loading live auction..." />;
  if (summary.error) return <InlineError message={(summary.error as Error).message} onRetry={() => summary.refetch()} />;
  if (!auction) return <EmptyState title="Auction not found" />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setLocalError('Please enter a valid positive bid amount');
      return;
    }
    if (minNextBid > 0 && nextAmount > minNextBid) {
      setLocalError(`Bid amount cannot exceed the permitted maximum of ${formatCurrency(minNextBid)}`);
      return;
    }
    if (!acceptedTerms) {
      setLocalError('Please accept the auction terms and bidding rules before placing a bid');
      return;
    }
    setLocalError('');
    setShowConfirmModal(true);
  };

  const confirmSubmit = () => {
    const nextAmount = Number(amount);
    setShowConfirmModal(false);
    bid.mutate(nextAmount);
  };

  // Quick helper to fill amount
  const handleQuickFill = (targetAmt: number) => {
    if (targetAmt > 0) {
      setAmount(String(targetAmt));
      setLocalError('');
    }
  };

  return (
    <div className="space-y-6 pb-12 bg-white text-slate-900 p-4 sm:p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
      
      {/* Error notification */}
      {localError && (
        <div 
          role="alert"
          aria-live="polite"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{localError}</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {minNextBid > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAmount(String(minNextBid));
                  setLocalError('');
                }}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 transition"
              >
                Use {formatCurrency(minNextBid)}
              </button>
            )}
            <button 
              type="button"
              onClick={() => setLocalError('')} 
              className="text-red-600 hover:text-red-800 p-1 rounded-md transition"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header section with status, title, details & glowing countdown */}
      <section className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link 
              href={`${rolePrefix}/procurement/reverse-auction/${canonicalCode}`} 
              className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Auction Details
            </Link>
            
            {/* Live Indicator */}
            {live ? (
              <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-red-600 shadow-xs">
                <span className="mr-2 h-2 w-2 rounded-full bg-red-500 animate-ping" />
                Live Reverse Auction
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                {status.replace(/_/g, ' ')}
              </span>
            )}
            
            {auction.auctionCode && (
              <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-mono font-black uppercase tracking-wider text-amber-700">
                <span className="font-sans font-medium text-[9px] text-amber-600/80">Floor:</span>
                {auction.auctionCode}
              </span>
            )}

            {auction.referenceNo && auction.referenceNo !== auction.auctionCode && (
              <Link 
                href={`/bids/${auction.referenceNo}`}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-mono font-bold text-slate-700 hover:bg-slate-100 hover:text-[#0b2447] transition shadow-2xs"
                title="View Originating Procurement Tender"
              >
                <span className="font-sans font-medium uppercase text-[9px] text-slate-400">Originating Tender:</span>
                <span className="text-[#0b2447]">{auction.referenceNo}</span>
                <ExternalLink className="h-2.5 w-2.5 text-slate-400 ml-0.5" />
              </Link>
            )}

            {auction.autoExtensionEnabled && (
              <span className={cn(
                "rounded-xl border px-2.5 py-1 text-[10px] font-bold transition flex items-center gap-1.5",
                extensionCount > 0 
                  ? "border-amber-300 bg-amber-50 text-amber-800 shadow-xs" 
                  : "border-blue-200 bg-blue-50 text-blue-700"
              )}>
                {extensionCount > 0 && <Sparkles className="h-3 w-3 text-amber-600" aria-hidden="true" />}
                Auto-Extended: {extensionCount} / {maxExtensions}
              </span>
            )}
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {auction.title || `Auction #${id}`}
          </h1>
          {/* Formatted Description & Structured Badges */}
          <div className="space-y-2 mt-1">
            {parsedDesc.badges.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {parsedDesc.badges.map((b) => (
                  <span
                    key={b.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs",
                      b.variant === 'blue' && "bg-blue-50 border-blue-200 text-blue-800",
                      b.variant === 'emerald' && "bg-emerald-50 border-emerald-200 text-emerald-800",
                      b.variant === 'amber' && "bg-amber-50 border-amber-200 text-amber-800",
                      b.variant === 'slate' && "bg-slate-50 border-slate-200 text-slate-700"
                    )}
                  >
                    {b.key === 'method' && <FileText className="h-3.5 w-3.5 text-blue-600" />}
                    {b.key === 'value' && <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />}
                    {b.key === 'urgency' && <Clock3 className="h-3.5 w-3.5 text-amber-600" />}
                    {b.key === 'category' && <Tag className="h-3.5 w-3.5 text-slate-500" />}
                    <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-70">
                      {b.label}:
                    </span>
                    <span className="font-black">
                      {b.value}
                    </span>
                  </span>
                ))}
              </div>
            )}
            <p className="max-w-4xl text-xs sm:text-sm font-semibold leading-relaxed text-slate-500">
              {parsedDesc.narrative || 'Dynamic Stage 2 live reverse auction with downward price discovery and server-verified timestamping.'}
            </p>
          </div>
        </div>

        {/* Countdown & Action Buttons */}
        <div className="flex flex-col sm:items-end gap-3.5 shrink-0">
          <div className="flex flex-col sm:items-end">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Remaining Bidding Window
            </p>
            <div 
              role="timer"
              aria-live="off"
              className={cn(
              "mt-1 text-2xl sm:text-3xl font-mono font-extrabold tracking-wider drop-shadow-xs",
              isNearEnding 
                ? "text-red-600 animate-pulse drop-shadow-[0_0_12px_rgba(239,68,68,0.35)]" 
                : "text-red-600"
            )}>
              ( {timeLeft} )
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ambient Reactive Sync Indicator (Replaces manual 1990s Refresh button) */}
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-semibold text-slate-700 shadow-2xs"
              title="Real-time auction telemetry connected via WebSocket"
            >
              <span className={cn(
                "h-2 w-2 rounded-full",
                live ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-slate-400"
              )} />
              <span>{live ? "Live Sync Active" : "Floor Offline"}</span>
              {summary.isFetching && (
                <RefreshCw className="h-3 w-3 animate-spin text-slate-400 ml-0.5" />
              )}
            </div>

            {isBuyerOrAdmin && (
              <div className="flex items-center gap-1.5">
                {status === 'DRAFT' && (
                  <Button onClick={() => transition.mutate('schedule')} variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs font-bold">Schedule</Button>
                )}
                {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(status) && (
                  <Button onClick={() => transition.mutate('start')} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-2xs">Start</Button>
                )}
                {status === 'LIVE' && (
                  <Button onClick={() => transition.mutate('pause')} variant="secondary" size="sm" className="rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs">Pause</Button>
                )}
                {['LIVE', 'PAUSED'].includes(status) && (
                  <Button onClick={() => transition.mutate('close')} size="sm" className="rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-2xs">Close Auction</Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}/results`)}
                  className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs"
                >
                  Results
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* KPI Cards Row — Role Differentiated */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Current Lowest Bid (L1) */}
        <StatsCard
          icon={IndianRupee}
          label="Current Lowest Bid (L1)"
          value={currentLowest > 0 ? formatCurrency(currentLowest) : 'No bids yet'}
          subtitle={startPrice > currentLowest && currentLowest > 0 
            ? `Price Drop: -${formatCurrency(startPrice - currentLowest)} (-${savingsPercent.toFixed(1)}%)` 
            : `Starting Price: ${formatCurrency(startPrice)}`}
          color="emerald"
        />

        {/* Card 2: My Current Rank (Seller) / Event Standing (Buyer) */}
        <StatsCard
          icon={Trophy}
          label={isBuyerOrAdmin ? "Auction Leader (L1)" : "My Current Rank"}
          value={
            isBuyerOrAdmin
              ? leaderOrgName
              : myRank === 1
              ? '🥇 L1 (Leading)'
              : myRank === 2
              ? '🥈 L2 (Trailing)'
              : myRank === 3
              ? '🥉 L3 (Trailing)'
              : myRank
              ? `L${myRank}`
              : myBestBid > 0
              ? 'Rank Processing'
              : 'Not Ranked'
          }
          subtitle={
            isBuyerOrAdmin
              ? (leaderBid ? `Holding L1 at ${formatCurrency(getBidAmount(leaderBid))}` : `${bidRows.length} total bids received`)
              : myRank === 1
              ? 'Holding the winning commercial offer'
              : myBestBid > 0
              ? 'Submit lower downward bid to take L1'
              : 'Submit a valid bid to enter leaderboard'
          }
          color="amber"
        />

        {/* Card 3: Active Participants (Verified Real Count) */}
        <StatsCard
          icon={Users}
          label="Active Participants"
          value={formatNumber(activeParticipantsCount)}
          subtitle={`${formatNumber(summary.data?.totalParticipantsCount ?? participantRows.length)} qualified bidders`}
          color="blue"
        />

        {/* Card 4: For Sellers: YOUR BEST OFFER (Replaces Savings Generated!); For Buyers: SAVINGS GENERATED */}
        {isBuyerOrAdmin ? (
          <StatsCard
            icon={Percent}
            label="Savings Generated"
            value={savings > 0 ? `${formatCurrency(savings)} (${savingsPercent.toFixed(1)}%)` : '₹0.00 (0.0%)'}
            subtitle={`Compared to opening benchmark of ${formatCurrency(startPrice)}`}
            color="cyan"
          />
        ) : (
          <StatsCard
            icon={Award}
            label="Your Best Offer"
            value={myBestBid > 0 ? formatCurrency(myBestBid) : 'No Bids Placed'}
            subtitle={
              myRank === 1
                ? '🥇 Currently winning (L1 lead)'
                : myBestBid > 0 && currentLowest > 0
                ? `+${formatCurrency(myBestBid - currentLowest)} behind L1 (Drop needed)`
                : `Benchmark Opening: ${formatCurrency(startPrice)}`
            }
            color="violet"
          />
        )}
      </div>

      {/* Real-time Dynamic Price Chart */}
      <Card className="border-slate-200/80 bg-white shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingDown className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <span>Live Bidding Price Movement</span>
                  {live && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Stream
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                  Visual mapping of downward commercial offers across all participants over time.
                </p>
              </div>
            </div>

            {/* Quick Chart Legend / Metric Pills */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Current L1: <span className="font-mono font-black text-emerald-700">{currentLowest > 0 ? formatCurrency(currentLowest) : '-'}</span>
              </span>
              {startPrice > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 border border-slate-200/60">
                  <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
                  Opening Benchmark: <span className="font-mono font-bold text-slate-800">{formatCurrency(startPrice)}</span>
                </span>
              )}
              {savings > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 text-teal-800 border border-teal-200/70">
                  <TrendingDown className="h-3 w-3 text-teal-600" />
                  Price Drop: <span className="font-mono font-bold text-teal-700">-{formatCurrency(savings)} ({savingsPercent.toFixed(1)}%)</span>
                </span>
              )}
              {!isBuyerOrAdmin && myBestBid > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 border border-blue-200/60">
                  <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                  Your Best: <span className="font-mono font-black">{formatCurrency(myBestBid)}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 border border-slate-200/60">
                Total Bids: <span className="font-mono font-bold text-slate-800">{chartData.length}</span>
              </span>
            </div>
          </div>

          <div className="h-72 sm:h-80 w-full pt-2">
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-slate-400 p-6">
                <LineChartIcon className="h-10 w-10 text-slate-300 mb-2 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-500">Waiting for live bids to populate chart…</p>
                <p className="text-[11px] text-slate-400 mt-1">Once verified downward bids are registered, the price drop curve will display here.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 15, bottom: 10 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="index" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    dy={6}
                    tickFormatter={(val: any) => {
                      const idx = Number(val);
                      if (!Number.isFinite(idx)) return String(val ?? '');
                      const item = chartData[idx - 1];
                      if (!item) return `Bid #${idx}`;
                      if (chartData.length <= 4 && item.shortTime) return `Bid #${idx} (${item.shortTime})`;
                      return `Bid #${idx}`;
                    }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    domain={[chartYMin, chartYMax]}
                    tickFormatter={(val: any) => {
                      const num = Number(val);
                      if (!Number.isFinite(num) || num <= 0) return '₹0';
                      if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
                      return `₹${num.toLocaleString('en-IN')}`;
                    }}
                    dx={-5}
                  />
                  
                  {/* Start price benchmark reference line (rendered when distinct from L1) */}
                  {startPrice > 0 && !startAndL1Same && (
                    <ReferenceLine 
                      y={startPrice} 
                      stroke="#94a3b8" 
                      strokeDasharray="4 4" 
                      strokeWidth={1.5}
                      label={{ 
                        value: `Start Benchmark: ${formatCurrency(startPrice)}`, 
                        position: 'top', 
                        fill: '#64748b', 
                        fontSize: 10, 
                        fontWeight: 700 
                      }} 
                    />
                  )}

                  {/* Current L1 benchmark reference line (rendered when distinct from startPrice) */}
                  {currentLowest > 0 && !startAndL1Same && (
                    <ReferenceLine 
                      y={currentLowest} 
                      stroke="#10b981" 
                      strokeDasharray="3 3" 
                      strokeWidth={1.5}
                      label={{ 
                        value: `Current L1 Floor: ${formatCurrency(currentLowest)}`, 
                        position: 'bottom', 
                        fill: '#059669', 
                        fontSize: 10, 
                        fontWeight: 800 
                      }} 
                    />
                  )}

                  {/* Single unified benchmark line when Start and L1 are identical */}
                  {startAndL1Same && currentLowest > 0 && (
                    <ReferenceLine 
                      y={currentLowest} 
                      stroke="#059669" 
                      strokeDasharray="3 3" 
                      strokeWidth={1.5}
                      label={{ 
                        value: `Opening & L1 Floor: ${formatCurrency(currentLowest)}`, 
                        position: 'top', 
                        fill: '#059669', 
                        fontSize: 10, 
                        fontWeight: 800 
                      }} 
                    />
                  )}

                  <RechartsTooltip content={<CustomChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '4 4' }} />

                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#priceGradient)"
                    dot={<CustomizedDot />}
                    activeDot={{ r: 7.5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2.5 }}
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Grid Layout: Live Bidding Log & Place Bid Console */}
      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        
        {/* Left Column: Live Bidding Log & Leaderboard with Tabs */}
        <Card className="border-slate-200/80 bg-white shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <History className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    Live Bidding Log & Standings
                  </h2>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    Real-time sequence of downward commercial offers. Your submissions are highlighted.
                  </p>
                </div>
              </div>

              {/* Tab Selector: Live Stream vs Leaderboard */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveLogTab('stream')}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition duration-150",
                    activeLogTab === 'stream'
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Live Bid Stream ({bidRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLogTab('leaderboard')}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition duration-150",
                    activeLogTab === 'leaderboard'
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Participant Leaderboard ({participantRows.length})
                </button>
              </div>
            </div>

            {/* Tab 1: Live Bid Stream */}
            {activeLogTab === 'stream' && (
              <div className="overflow-x-auto">
                <DataTable<ReverseAuctionBid>
                  columns={liveBidColumns}
                  data={bidRows}
                  keyExtractor={(row) => String(row.id)}
                  emptyTitle="No bids placed yet"
                  emptyDescription="Once live bids are validated by the server, they will populate here in real-time."
                  minWidth="min-w-[560px]"
                  rowClassName={(row) => row.isMyBid ? 'bg-blue-50/50 border-l-4 border-l-blue-600 font-medium' : ''}
                />
              </div>
            )}

            {/* Tab 2: Participant Standings / Leaderboard */}
            {activeLogTab === 'leaderboard' && (
              <div className="overflow-x-auto">
                <DataTable<ReverseAuctionParticipant>
                  columns={leaderboardColumns}
                  data={participantRows}
                  keyExtractor={(row) => String(row.id)}
                  emptyTitle="No participants joined"
                  emptyDescription="Qualified participants will appear here with their live standing and lowest offers."
                  minWidth="min-w-[560px]"
                  rowClassName={(row) => row.isCurrentViewer ? 'bg-blue-50/60 border-l-4 border-l-blue-600' : ''}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: PLACE YOUR BID Console Card */}
        <aside className="space-y-4">
          <Card className="border-slate-200/80 bg-white shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-6 space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600">
                  {isBuyerOrAdmin ? 'Live Console' : 'Competitive Bid Console'}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {isBuyerOrAdmin ? 'Sourcing Monitor' : 'Place Your Downward Bid'}
                </h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                  {isBuyerOrAdmin
                    ? 'Monitor active MSME participant bids, review ranks, and manage auction stages.'
                    : 'Submit a lower commercial offer. Bids are cryptographically verified using server timestamps.'}
                </p>
              </div>

              {/* Status constraints warning if not live */}
              {!live && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs font-bold leading-relaxed text-amber-800">
                      Bidding console is locked. Auction status: {status.toLowerCase().replace(/_/g, ' ')}.
                    </p>
                  </div>
                </div>
              )}

              {/* Bid constraints metadata */}
              <div className="grid grid-cols-2 gap-3">
                <BidSpec label="Max Permitted Bid" value={minNextBid > 0 ? formatCurrency(minNextBid) : '-'} color="red" />
                <BidSpec label="Min Decrement" value={decrement > 0 ? formatCurrency(decrement) : '-'} />
                <BidSpec label="Reserve Price" value={isBuyerOrAdmin && auction.reservePrice ? formatCurrency(auction.reservePrice) : 'Protected (Hidden)'} />
                <BidSpec label="Auto Extensions" value={auction.autoExtensionEnabled ? `${extensionCount}/${maxExtensions}` : 'Disabled'} />
              </div>

              {/* Buyer Monitor Mode or Seller Bidding Form */}
              {isBuyerOrAdmin ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs font-semibold leading-relaxed text-slate-600 space-y-2">
                  <p className="font-bold text-slate-900 mb-2">Buyer Monitor Statistics</p>
                  <p className="flex justify-between"><span>Invited Suppliers:</span> <span className="font-bold text-slate-800">{participantRows.length}</span></p>
                  <p className="flex justify-between"><span>Active Qualified Sellers:</span> <span className="font-bold text-emerald-600">{activeParticipantsCount}</span></p>
                  <p className="flex justify-between"><span>Total Bids Placed:</span> <span className="font-bold text-slate-800">{bidRows.length}</span></p>
                  <p className="flex justify-between"><span>Auto Extensions Triggered:</span> <span className="font-bold text-slate-800">{extensionCount} / {maxExtensions}</span></p>
                </div>
              ) : (() => {
                const canBid = (participant as any)?.canBid !== false;
                const pStatus = (participant?.status || '').toUpperCase();
                const disqualReason = (participant as any)?.disqualificationReason || '';
                const evalPending = (auction as any)?.evaluationPending;

                // Disqualified seller
                if (pStatus === 'DISQUALIFIED') {
                  return (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3" role="alert">
                        <Ban className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
                        <div>
                          <p className="text-xs font-black text-red-800">Bidding Access Revoked</p>
                          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-red-700">
                            Your organization has been disqualified from this auction. You cannot submit bids.
                          </p>
                          {disqualReason && (
                            <p className="mt-2 text-[10px] font-semibold text-red-600 border-t border-red-200 pt-2">
                              <span className="font-black">Reason:</span> {disqualReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Qualification under review
                if (!canBid && (pStatus === 'SUBMITTED' || pStatus === 'IN_PROGRESS' || pStatus === 'INVITED')) {
                  return (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3" role="status" aria-live="polite">
                      <Lock className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="text-xs font-black text-amber-800">Qualification Under Review</p>
                        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-amber-700">
                          Your qualification documents are being reviewed by the buyer. Bidding will be enabled once approved.
                        </p>
                      </div>
                    </div>
                  );
                }

                // Evaluation pending
                if (evalPending && !canBid) {
                  return (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3" role="status" aria-live="polite">
                      <Hourglass className="h-5 w-5 shrink-0 text-blue-600 mt-0.5 animate-pulse" aria-hidden="true" />
                      <div>
                        <p className="text-xs font-black text-blue-800">Evaluation In Progress</p>
                        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-blue-700">
                          The buyer is reviewing seller qualifications. Bidding will open once evaluation is completed.
                        </p>
                      </div>
                    </div>
                  );
                }

                // Qualified seller — active bid form
                return (
                  <form onSubmit={submit} className="space-y-4">
                    {/* Quick Bid Helper Buttons */}
                    {live && minNextBid > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickFill(minNextBid)}
                          className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-center text-[10px] font-black text-emerald-800 hover:bg-emerald-100 transition shadow-xs"
                        >
                          Fill Next Max Bid: {formatCurrency(minNextBid)}
                        </button>
                        {decrement > 0 && minNextBid - decrement > 0 && (
                          <button
                            type="button"
                            onClick={() => handleQuickFill(minNextBid - decrement)}
                            className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 text-center text-[10px] font-black text-blue-800 hover:bg-blue-100 transition shadow-xs"
                          >
                            Drop by 2× Min: {formatCurrency(minNextBid - decrement)}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="bid-amount-input" className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Your Commercial Offer (INR)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-bold text-sm">
                          ₹
                        </span>
                        <input
                          id="bid-amount-input"
                          value={amount}
                          onChange={event => setAmount(event.target.value)}
                          name="amount"
                          type="number"
                          min="1"
                          max={minNextBid > 0 ? minNextBid : undefined}
                          step="0.01"
                          required
                          placeholder={minNextBid > 0 ? `Max permitted: ${minNextBid}` : 'Enter downward amount'}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3.5 text-sm font-bold font-mono text-slate-900 outline-none transition focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          disabled={!live || bid.isPending}
                          aria-label="Bid amount in Indian Rupees"
                        />
                      </div>
                    </div>

                    {/* Terms acceptance checkbox */}
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:bg-slate-100/50">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={e => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500/40"
                        disabled={!live || bid.isPending}
                        aria-label="Accept reverse auction terms and commercial supply rules"
                      />
                      <span className="text-[11px] font-semibold text-slate-600 leading-normal select-none">
                        I accept the reverse auction terms, decrement rules, and confirm our capacity to fulfill at this price.
                      </span>
                    </label>

                    <Button 
                      type="submit"
                      disabled={!live || bid.isPending || !acceptedTerms} 
                      className="h-12 w-full rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold shadow-md shadow-red-600/20 transition duration-200"
                    >
                      <Send className="mr-1.5 h-4 w-4" /> {bid.isPending ? 'Submitting Bid…' : 'SUBMIT LOWER COMMERCIAL BID'}
                    </Button>

                    {/* Confirmation Dialog Modal */}
                    {showConfirmModal && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs font-semibold text-slate-800 space-y-3 shadow-md animate-in fade-in">
                        <p className="font-black text-slate-900 flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          Confirm Binding Downward Offer
                        </p>
                        <p className="leading-relaxed">
                          Are you sure you want to submit a downward commercial bid of{' '}
                          <span className="font-black text-red-600 font-mono text-sm">{formatCurrency(Number(amount))}</span>? 
                          This offer is legally binding and will be permanently logged in the audit ledger.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <Button 
                            size="sm" 
                            type="button" 
                            onClick={confirmSubmit} 
                            className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg"
                          >
                            Confirm & Submit
                          </Button>
                          <Button 
                            size="sm" 
                            type="button" 
                            variant="outline" 
                            onClick={() => setShowConfirmModal(false)} 
                            className="border-slate-200 bg-white text-slate-700 rounded-lg"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </form>
                );
              })()}
            </CardContent>
          </Card>

          {/* Compliance & Audit Information */}
          <Card className="border-slate-200/80 bg-white shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200/80 pb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </span>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Compliance & Audit Verification
                </h2>
              </div>

              <div className="space-y-2.5 text-xs font-semibold text-slate-500">
                <div className="flex justify-between"><span>Server Validation:</span> <span className="text-emerald-600 font-black">Active (UTC NTP Synced)</span></div>
                <div className="flex justify-between"><span>Audit Log Event ID:</span> <span className="text-slate-800 font-mono">AUD-RA-{id}</span></div>
                <div className="flex justify-between"><span>Extension Trigger:</span> <span className="text-slate-800">{auction.autoExtensionEnabled ? `Last ${auction.autoExtensionWindowMinutes || 0} min` : 'Disabled'}</span></div>
                <div className="flex justify-between"><span>Extension By:</span> <span className="text-slate-800">{auction.autoExtensionEnabled ? `+${auction.autoExtensionByMinutes || 0} min` : 'Disabled'}</span></div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Rules Summary Card */}
      <Card className="border-slate-200/80 bg-white shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Gavel className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Reverse Auction Rules & Parameters
              </h2>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                Verified commercial parameters and operational constraints governing this event.
              </p>
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-4">
            <RuleItem label="Start Price" value={formatCurrency(auction.startPrice)} />
            <RuleItem label="Reserve Price" value={isBuyerOrAdmin && auction.reservePrice ? formatCurrency(auction.reservePrice) : 'Protected'} />
            <RuleItem label="Auto Extension" value={auction.autoExtensionEnabled ? 'Enabled' : 'Disabled'} />
            <RuleItem label="Extension Limit" value={auction.autoExtensionEnabled ? `${auction.maxAutoExtensions || 0} times` : 'N/A'} />
            <RuleItem label="Auction Start" value={formatDateTime(auction.startTime)} className="sm:col-span-2" />
            <RuleItem label="Auction End" value={formatDateTime(auction.endTime)} className="sm:col-span-2" />
          </div>
        </CardContent>
      </Card>

      {/* Mobile Sticky Quick-Bid Bar for participating sellers */}
      {!isBuyerOrAdmin && live && minNextBid > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-lg xl:hidden flex items-center justify-between gap-3 animate-fadeIn">
          <div className="min-w-0">
            <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-500">Max Permitted Bid</p>
            <p className="text-sm font-mono font-black text-red-600 truncate">{formatCurrency(minNextBid)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const el = document.getElementById('bid-amount-input');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
              }
            }}
            className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-md shadow-red-600/20 shrink-0"
          >
            Jump to Bid ⚡
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Supporting Helper Components ──

function StatsCard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle, 
  color 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  subtitle?: string; 
  color: 'emerald' | 'amber' | 'blue' | 'cyan' | 'violet' 
}) {
  const colorMap = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
    amber: 'text-amber-700 bg-amber-50 border-amber-200/60',
    blue: 'text-blue-700 bg-blue-50 border-blue-200/60',
    cyan: 'text-cyan-700 bg-cyan-50 border-cyan-200/60',
    violet: 'text-violet-700 bg-violet-50 border-violet-200/60',
  };

  return (
    <Card className="border-slate-200/80 bg-white shadow-sm rounded-2xl overflow-hidden transition hover:border-slate-300 duration-200">
      <CardContent className="p-5 flex flex-col justify-between h-full space-y-2">
        <div className="flex justify-between items-start gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-2xs", colorMap[color])}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div>
          <p title={value} role="status" aria-live="polite" className={cn("text-xl font-mono font-extrabold tracking-tight truncate", colorMap[color].split(' ')[0])}>
            {value}
          </p>
          {subtitle && (
            <p className="text-[11px] font-medium text-slate-500 mt-1 truncate" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BidSpec({ label, value, color }: { label: string; value: string; color?: 'red' }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn("mt-1 text-xs font-mono font-extrabold", color === 'red' ? 'text-red-600' : 'text-slate-800')}>
        {value}
      </p>
    </div>
  );
}

function RuleItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5", className)}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1.5 text-xs font-bold text-slate-800 leading-normal">{value}</p>
    </div>
  );
}

// Custom Tooltip for the Animated Area Chart
function CustomChartTooltip({ active, payload }: any) {
  if (active && Array.isArray(payload) && payload.length > 0) {
    const data = payload[0]?.payload;
    if (!data) return null;

    const isLead = data.rank === 1 || data.isLowest;
    const dropPrev = Number(data.dropFromPrev || 0);
    const dropPrevPct = Number(data.dropFromPrevPct || 0);
    const dropStart = Number(data.dropFromStart || 0);
    const dropStartPct = Number(data.dropFromStartPct || 0);
    const amt = Number(data.amount || 0);

    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur-md text-xs space-y-2.5 min-w-[240px] max-w-[300px] animate-in fade-in zoom-in-95 duration-150">
        {/* Header: Bid Sequence & Rank Badge */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-black text-slate-700">
              #{data.bidNumber || data.index || 1}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              of {data.totalBids || 1} Bids
            </span>
          </div>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight",
            isLead
              ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
              : data.rank === 2
              ? "bg-slate-100 text-slate-800 border border-slate-300"
              : data.rank === 3
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          )}>
            {isLead ? '🥇 L1 Leading Offer' : data.rank === 2 ? '🥈 L2 Trailing' : data.rank === 3 ? '🥉 L3 Trailing' : `L${data.rank || '-'}`}
          </span>
        </div>

        {/* Commercial Price & Delta */}
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Commercial Offer</p>
          <div className="text-lg font-black font-mono text-slate-900 tracking-tight mt-0.5">
            {formatCurrency(amt)}
          </div>
          
          {/* Price drop pill */}
          {dropPrev > 0 ? (
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 mt-1">
              <TrendingDown className="h-3 w-3 shrink-0" />
              <span>▼ {formatCurrency(dropPrev)}</span>
              <span className="font-mono text-[10px] opacity-80">(-{dropPrevPct.toFixed(1)}%)</span>
            </div>
          ) : data.isFirstBid ? (
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-1">
              Opening Benchmark Bid
            </div>
          ) : null}
        </div>

        {/* Bidder Organization */}
        <div className="border-t border-slate-100 pt-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Bidder:</span>
            {data.isMyBid ? (
              <span className="inline-flex items-center gap-1 font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                YOU (Your Org)
              </span>
            ) : (
              <span className="font-bold text-slate-800 truncate max-w-[160px]" title={data.sellerOrgName || data.label || 'Bidder'}>
                {data.sellerOrgName || data.label || 'Bidder'}
              </span>
            )}
          </div>

          {/* Cumulative Drop vs Start Price */}
          {dropStart > 0 && (
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-400 font-medium">Drop vs Start:</span>
              <span className="font-mono font-bold text-emerald-600">
                -{formatCurrency(dropStart)} ({dropStartPct.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100">
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3 text-slate-400" /> Time
          </span>
          <span className="font-semibold text-slate-700 font-mono">{data.fullTime || data.time || '—'}</span>
        </div>
      </div>
    );
  }
  return null;
}

// Custom Dot for AreaChart: Highlights user's own bids, lowest point, and competitors
function CustomizedDot(props: any) {
  const { cx, cy, payload } = props;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;

  const key = `dot-${payload?.index || payload?.bidNumber || 'default'}`;

  if (payload?.isMyBid) {
    return (
      <g key={key}>
        <circle cx={cx} cy={cy} r={8.5} fill="#3b82f6" fillOpacity={0.25} />
        <circle cx={cx} cy={cy} r={5} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
      </g>
    );
  }

  if (payload?.isLowest || payload?.rank === 1) {
    return (
      <g key={key}>
        <circle cx={cx} cy={cy} r={8} fill="#10b981" fillOpacity={0.3} />
        <circle cx={cx} cy={cy} r={5} fill="#059669" stroke="#ffffff" strokeWidth={2} />
      </g>
    );
  }

  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} />
    </g>
  );
}
