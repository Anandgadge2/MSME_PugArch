'use client';

import { useState, useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

function formatProcurementMethod(method?: string | null): string {
  if (!method) return 'Reverse Auction';
  const clean = String(method).trim().toUpperCase();
  if (clean === 'REVERSE_AUCTION') return 'Reverse Auction';
  if (clean === 'BID_WITH_REVERSE_AUCTION') return 'Bid with Reverse Auction';
  if (clean === 'ENGLISH_REVERSE') return 'English Reverse Auction';
  if (clean === 'RANK_BASED_REVERSE') return 'Rank-Based Reverse Auction';
  return clean.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Gavel,
  IndianRupee,
  Info,
  Loader2,
  Medal,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  Trophy,
  Users,
  X
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDateTime } from '../../shared/format';
import { useAuth } from '../../../hooks/useAuth';
import { useUserRealtime } from '../../../hooks/useUserRealtime';
import { reverseAuctionApi } from '../api';
import { useReverseAuctionRealtime } from '../hooks/useReverseAuctionRealtime';
import { toast } from 'sonner';

export default function AuctionResultPage({ id }: { id: number | string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user } = useAuth();

  const [selectedParticipantForAward, setSelectedParticipantForAward] = useState<any | null>(null);
  const [awardActionType, setAwardActionType] = useState<'recommend' | 'generate_po'>('recommend');
  const [isPriceMatchMode, setIsPriceMatchMode] = useState(false);
  const [nonL1Reason, setNonL1Reason] = useState('MSE Purchase Preference Policy (Matching L1 Price)');
  const [awardRemarks, setAwardRemarks] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const modalRemarksId = useId();
  const nonL1SelectId = useId();
  const declineReasonId = useId();

  const rolePrefix = pathname.startsWith('/buyer') ? '/buyer' :
                     pathname.startsWith('/admin') ? '/admin' :
                     pathname.startsWith('/shg') ? '/shg' :
                     user?.role === 'buyer' ? '/buyer' :
                     user?.role === 'admin' ? '/admin' :
                     user?.role === 'shg' ? '/shg' : '/seller';

  const query = useQuery({
    queryKey: ['reverse-auction-result', id],
    queryFn: () => reverseAuctionApi.result(id),
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });

  const auction = query.data?.auction;
  const canonicalCode = auction?.auctionCode || String(id);

  useReverseAuctionRealtime(auction?.id || id, canonicalCode);
  useUserRealtime(user?.id);
  const ranking: any[] = query.data?.ranking || [];
  const canRecommendAward = Boolean(query.data?.canRecommendAward);
  const canOfferAward = Boolean(query.data?.canOfferAward);
  const canAcceptAward = Boolean(query.data?.canAcceptAward);
  const canGeneratePo = Boolean(query.data?.canGeneratePo);
  const isAwardOffered = Boolean(query.data?.isAwardOffered);
  const isAwardAccepted = Boolean(query.data?.isAwardAccepted);
  const isWinningSeller = Boolean(query.data?.isWinningSeller);
  const winningParticipant = query.data?.winningParticipant;
  const isManager = Boolean(query.data?.isManager);
  const status = String(auction?.statusEnum || auction?.status || '').toUpperCase();

  const displayCategory = (() => {
    const raw = auction?.category || auction?.linkedRequirement?.category;
    if (!raw || raw.trim().toLowerCase() === 'general procurement') return null;
    return raw.trim();
  })();

  const awardMutation = useMutation({
    mutationFn: ({ participantId, remarks, isPriceMatch, counterOfferAmount }: { participantId?: number; remarks?: string; isPriceMatch?: boolean; counterOfferAmount?: number }) =>
      reverseAuctionApi.recommendAward(id, participantId, remarks, { isPriceMatch, counterOfferAmount }),
    onSuccess: () => {
      toast.success(isPriceMatchMode ? 'Price match counter-offer issued to supplier!' : 'Contract award offer successfully issued to supplier!');
      setSelectedParticipantForAward(null);
      setAwardRemarks('');
      setIsPriceMatchMode(false);
      qc.invalidateQueries({ queryKey: ['reverse-auction-result', id] });
      qc.invalidateQueries({ queryKey: ['reverse-auction', id] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to issue award offer');
    }
  });

  const acceptAwardMutation = useMutation({
    mutationFn: (remarks?: string | void) => reverseAuctionApi.acceptAward(id, remarks || undefined),
    onSuccess: () => {
      toast.success('Contract award offer formally accepted! The buyer has been notified to generate the Purchase Order.');
      qc.invalidateQueries({ queryKey: ['reverse-auction-result', id] });
      qc.invalidateQueries({ queryKey: ['reverse-auction', id] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to accept contract award');
    }
  });

  const declineAwardMutation = useMutation({
    mutationFn: (reason?: string | void) => reverseAuctionApi.declineAward(id, reason || undefined),
    onSuccess: () => {
      toast.success('Contract award offer has been declined.');
      setShowDeclineModal(false);
      setDeclineReason('');
      qc.invalidateQueries({ queryKey: ['reverse-auction-result', id] });
      qc.invalidateQueries({ queryKey: ['reverse-auction', id] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to decline award offer');
    }
  });

  const generatePoMutation = useMutation({
    mutationFn: ({ participantId, remarks }: { participantId?: number; remarks?: string }) =>
      reverseAuctionApi.acceptAndGeneratePo(id, { participantId, remarks }),
    onSuccess: (data: any) => {
      toast.success(`Purchase Order ${data.purchaseOrder?.poNumber || ''} generated successfully!`);
      setSelectedParticipantForAward(null);
      setAwardRemarks('');
      qc.invalidateQueries({ queryKey: ['reverse-auction-result', id] });
      qc.invalidateQueries({ queryKey: ['reverse-auction', id] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to generate Purchase Order');
    }
  });

  // Sync URL to human-readable canonical code
  useEffect(() => {
    if (auction?.auctionCode && typeof window !== 'undefined') {
      const code = auction.auctionCode;
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^(\/(?:seller|shg|buyer|admin)\/procurement\/reverse-auction|\/reverse-auctions)\/([^/]+)(\/results?)\/?$/i);
      if (match) {
        const [, basePrefix, currentSlug, subRoute] = match;
        if (decodeURIComponent(currentSlug) !== code) {
          const newPath = `${basePrefix}/${encodeURIComponent(code)}${subRoute}${window.location.search || ''}${window.location.hash || ''}`;
          window.history.replaceState(null, '', newPath);
        }
      }
    }
  }, [auction?.auctionCode]);

  // Keyboard navigation for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedParticipantForAward) setSelectedParticipantForAward(null);
        if (showDeclineModal) setShowDeclineModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedParticipantForAward, showDeclineModal]);

  if (query.isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <LoadingState label="Loading reverse auction official outcomes & evaluations..." />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}`)}
            className="text-xs font-bold text-slate-700"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Auction Details
          </Button>
        </div>
        <InlineError message={(query.error as Error).message} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const startPrice = Number(auction?.startPrice || 0);
  const lowestEvaluated = ranking.find((p: any) => p.currentRank === 1) || (ranking.length > 0 ? ranking[0] : null);
  const awardedParticipant = ranking.find((p: any) =>
    p.isAwarded ||
    (auction?.winnerSellerId && (p.sellerUserId === auction.winnerSellerId || p.sellerOrgId === auction.winnerSellerId)) ||
    p.status === 'AWARDED' ||
    p.status === 'ACCEPTED'
  );
  const isAwardConcluded = ['AWARDED', 'COMPLETED'].includes(status) && Boolean(awardedParticipant);
  const highlightedParticipant = (isAwardConcluded && awardedParticipant) ? awardedParticipant : lowestEvaluated;
  const lowestBidAmount = Number(lowestEvaluated?.lastBidAmount || auction?.currentLowestAmount || auction?.currentLowestBid || 0);
  const hasSavings = startPrice > 0 && lowestBidAmount > 0 && startPrice > lowestBidAmount;
  const savingsAmount = hasSavings ? startPrice - lowestBidAmount : 0;
  const savingsPercent = hasSavings ? ((savingsAmount / startPrice) * 100).toFixed(1) : '0.0';
  const purchaseOrder = query.data?.purchaseOrder;

  const backUrl = `${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}`;

  const isBuyer = rolePrefix === '/buyer';
  const isSeller = rolePrefix === '/seller';
  const isShg = rolePrefix === '/shg';

  const rootListingLabel = isBuyer
    ? 'My Procurements'
    : isSeller || isShg
      ? 'Opportunities'
      : 'Procurements';

  const rootListingUrl = isBuyer
    ? '/buyer/my-procurements'
    : isSeller
      ? '/seller/opportunities?type=reverse-auction'
      : isShg
        ? '/shg/opportunities?type=reverse-auction'
        : '/admin/procurements';

  const handleConfirmAward = () => {
    if (!selectedParticipantForAward) return;
    const isNonL1 = (selectedParticipantForAward.currentRank || 1) !== 1;
    const combinedRemarks = isPriceMatchMode
      ? `[Price Match to L1 Price: ${formatCurrency(lowestBidAmount)}] ${awardRemarks}`.trim()
      : isNonL1
      ? `[Non-L1 Justification: ${nonL1Reason}] ${awardRemarks}`.trim()
      : awardRemarks.trim();

    if (awardActionType === 'generate_po') {
      generatePoMutation.mutate({
        participantId: selectedParticipantForAward.id,
        remarks: combinedRemarks
      });
    } else {
      awardMutation.mutate({
        participantId: selectedParticipantForAward.id,
        remarks: combinedRemarks,
        isPriceMatch: isPriceMatchMode,
        counterOfferAmount: isPriceMatchMode ? lowestBidAmount : undefined
      });
    }
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5">
      {/* 1. Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 sm:px-5 py-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(backUrl)}
            className="h-8 px-2.5 text-xs font-bold text-slate-700 hover:text-slate-950 border-slate-250 hover:bg-slate-50 cursor-pointer"
            aria-label="Return to reverse auction details page"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Auction
          </Button>

          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 ml-1">
            <button
              type="button"
              onClick={() => router.push(rootListingUrl)}
              className="hover:text-slate-900 transition-colors focus:outline-none focus:underline cursor-pointer"
            >
              {rootListingLabel}
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={() => router.push(backUrl)}
              className="hover:text-slate-900 transition-colors focus:outline-none focus:underline font-mono font-bold text-slate-700 cursor-pointer"
            >
              {canonicalCode}
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" aria-hidden="true" />
            <span className="text-slate-900 font-extrabold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]" aria-current="page">
              Outcomes & Evaluation
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="h-8 text-xs font-bold border-slate-250 text-slate-700 hover:bg-slate-50"
            aria-label="Refresh auction outcomes data"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Compact Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1.5">
            {/* Formatted Badge Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                <Gavel className="h-3 w-3 text-blue-600" aria-hidden="true" />
                {formatProcurementMethod(auction?.procurementMethod)}
              </span>

              {auction?.referenceNo && auction.referenceNo !== canonicalCode && (
                <Link
                  href={`/bids/${encodeURIComponent(auction.referenceNo)}`}
                  className="inline-flex items-center gap-1 text-[10.5px] font-mono font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md hover:bg-slate-100 hover:text-blue-900 transition"
                >
                  <span className="font-sans text-[9px] font-medium text-slate-400">Tender:</span>
                  {auction.referenceNo}
                  <ExternalLink className="h-2.5 w-2.5 text-slate-400 ml-0.5" />
                </Link>
              )}

              {purchaseOrder || (['AWARDED', 'COMPLETED'].includes(status) && purchaseOrder) ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Contract Awarded & PO Issued
                </span>
              ) : isAwardAccepted ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  <CheckCircle2 className="h-3 w-3 text-indigo-600" /> Award Accepted — Ready for PO
                </span>
              ) : isAwardOffered ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Clock className="h-3 w-3 text-amber-600" /> Award Offered — Awaiting Supplier
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {status === 'CLOSED' ? 'Closed' : status === 'LIVE' ? 'Live' : status || 'Closed'}
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {auction?.title || `Reverse Auction ${canonicalCode}`}
            </h1>

            <p className="text-xs font-medium text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
              {displayCategory && (
                <span>Category: <strong className="text-slate-700">{displayCategory}</strong></span>
              )}
              {displayCategory && auction?.endTime && <span>·</span>}
              {auction?.endTime && (
                <span>Concluded: <strong className="text-slate-700">{formatDateTime(auction.endTime)}</strong></span>
              )}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Evaluation Concluded</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Executive KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3" role="region" aria-label="Auction Key Performance Indicators">
        {/* L1 Lowest Commercial Offer */}
        <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white p-3 sm:p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Lowest Offer (L1)
            </span>
            <div className="h-6 w-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Trophy className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-mono font-black text-emerald-950">
              {lowestBidAmount > 0 ? formatCurrency(lowestBidAmount) : '—'}
            </span>
          </div>
          <p className="text-[10px] font-medium text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Lowest evaluated bid
          </p>
        </div>

        {/* Baseline Starting Price */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Baseline Starting
            </span>
            <div className="h-6 w-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <IndianRupee className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-mono font-black text-slate-900">
              {startPrice > 0 ? formatCurrency(startPrice) : '—'}
            </span>
          </div>
          <p className="text-[10px] font-medium text-slate-500">
            Ceiling benchmark
          </p>
        </div>

        {/* Procurement Savings */}
        <div className="rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/50 to-white p-3 sm:p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Cost Savings
            </span>
            <div className="h-6 w-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-mono font-black text-blue-950">
              {savingsAmount > 0 ? formatCurrency(savingsAmount) : '₹0.00'}
            </span>
          </div>
          <p className="text-[10px] font-medium text-blue-700">
            {savingsAmount > 0 ? `${savingsPercent}% reduction achieved` : 'No decrement recorded'}
          </p>
        </div>

        {/* Active Bidders */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Qualified Bidders
            </span>
            <div className="h-6 w-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-black text-slate-900">
              {ranking.length}
            </span>
          </div>
          <p className="text-[10px] font-medium text-slate-500">
            Active suppliers evaluated
          </p>
        </div>
      </div>

      {/* 4. Unified Evaluation & Contract Award Action Card */}
      {highlightedParticipant && (
        <div className={`rounded-2xl border-2 p-4 sm:p-5 shadow-2xs ${
          isAwardConcluded
            ? 'border-emerald-300 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-white'
            : isAwardAccepted
            ? 'border-indigo-300 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-white'
            : isAwardOffered
            ? 'border-amber-300 bg-gradient-to-r from-amber-50/80 via-orange-50/30 to-white'
            : 'border-slate-250 bg-gradient-to-r from-slate-50/80 via-blue-50/30 to-white'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`h-11 w-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-2xs ${
                isAwardConcluded || isAwardAccepted
                  ? 'bg-emerald-600'
                  : isAwardOffered
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}>
                {isAwardConcluded || isAwardAccepted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isAwardOffered ? (
                  <Clock className="h-5 w-5" />
                ) : (
                  <Trophy className="h-5 w-5 text-amber-300" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10.5px] font-black uppercase tracking-wider ${
                    isAwardConcluded
                      ? 'text-emerald-900'
                      : isAwardAccepted
                      ? 'text-indigo-900'
                      : isAwardOffered
                      ? 'text-amber-900'
                      : 'text-indigo-900'
                  }`}>
                    {isAwardConcluded
                      ? 'Contract Awarded Supplier'
                      : isAwardAccepted
                      ? 'Award Accepted — Ready for Purchase Order'
                      : isAwardOffered
                      ? 'Contract Award Offered — Awaiting Supplier Formal Acceptance'
                      : 'Lowest Commercial Offer (L1 Benchmark)'}
                  </span>

                  {highlightedParticipant.isCurrentViewer && (
                    <span className="px-2 py-0.5 text-[9.5px] font-black uppercase rounded-full bg-blue-600 text-white shadow-2xs">
                      Your Organization
                    </span>
                  )}

                  {isAwardConcluded && (highlightedParticipant.currentRank || 1) !== 1 && (
                    <span className="px-2 py-0.5 text-[9.5px] font-bold uppercase rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      Discretionary Non-L1 Award
                    </span>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-black text-slate-950">
                  {highlightedParticipant.sellerOrgName}
                </h2>

                <p className="text-xs font-semibold text-slate-600">
                  {isAwardConcluded || isAwardAccepted ? 'Contract Amount: ' : 'Final Bid Amount: '}
                  <span className="font-black text-emerald-700 font-mono">
                    {formatCurrency(highlightedParticipant.lastBidAmount || 0)}
                  </span>
                  {' · '}Rank: <span className="font-bold text-slate-900">L{highlightedParticipant.currentRank || 1}</span>
                </p>

                {/* Contextual Status Messages without duplication */}
                {isManager && isAwardOffered && !isAwardAccepted && (
                  <p className="text-xs font-medium text-amber-900/90 pt-0.5">
                    Award offer has been issued to <strong>{highlightedParticipant.sellerOrgName}</strong>. As soon as the supplier confirms formal acceptance, Purchase Order generation will unlock.
                  </p>
                )}

                {canGeneratePo && (
                  <p className="text-xs font-medium text-indigo-900/90 pt-0.5">
                    <strong>{highlightedParticipant.sellerOrgName}</strong> has formally accepted the contract award offer. Generate the official Purchase Order to initiate fulfillment.
                  </p>
                )}

                {isWinningSeller && isAwardAccepted && !purchaseOrder && (
                  <p className="text-xs font-medium text-indigo-900/90 pt-0.5">
                    You have formally accepted the contract award. The buyer is finalizing the official Purchase Order and you will be notified upon issuance.
                  </p>
                )}

                {/* Non-L1 Justification Note when awarded */}
                {isAwardConcluded && auction?.overrideReason && (
                  <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950">
                    <div className="font-black flex items-center gap-1.5 mb-0.5 text-amber-900 text-[10.5px] uppercase tracking-wide">
                      <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                      Recorded Policy Justification:
                    </div>
                    <p className="font-medium text-amber-900 text-xs leading-relaxed">{auction.overrideReason}</p>
                  </div>
                )}

                {/* Linked Purchase Order Info & Quick Navigation */}
                {purchaseOrder && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
                      <Receipt className="h-3.5 w-3.5 text-emerald-700" />
                      PO: {purchaseOrder.poNumber}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`${rolePrefix}/orders/purchase-orders`)}
                      className="h-7 text-xs font-bold border-emerald-300 text-emerald-900 hover:bg-emerald-50"
                    >
                      <ExternalLink className="mr-1.5 h-3 w-3" /> View Purchase Order
                    </Button>
                  </div>
                )}

                {/* Policy Notice when pending offer */}
                {!isAwardOffered && !isAwardAccepted && !isAwardConcluded && !canAcceptAward && (
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed pt-0.5">
                    <Info className="inline h-3.5 w-3.5 text-blue-600 mr-1 -mt-0.5" />
                    <strong>Procurement Discretion:</strong> Buyers may award contract to L1 or exercise policy preference (e.g. MSE price match) with written justification.
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
              {canOfferAward && (
                <Button
                  onClick={() => {
                    setSelectedParticipantForAward(highlightedParticipant);
                    setIsPriceMatchMode(false);
                    setAwardActionType('recommend');
                  }}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 shadow-2xs flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <Award className="h-4 w-4" /> Issue Award Offer (L1)
                </Button>
              )}

              {canGeneratePo && (
                <Button
                  onClick={() => {
                    setSelectedParticipantForAward(winningParticipant || highlightedParticipant);
                    setAwardActionType('generate_po');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider h-9 px-4 rounded-xl shadow-2xs border border-emerald-400 gap-1.5 cursor-pointer"
                  aria-label="Generate official Purchase Order"
                >
                  <Receipt className="h-4 w-4" /> Generate Purchase Order (PO)
                </Button>
              )}

              {canAcceptAward && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => acceptAwardMutation.mutate()}
                    disabled={acceptAwardMutation.isPending || declineAwardMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider h-9 px-4 rounded-xl shadow-2xs"
                    aria-label="Formally accept contract award offer"
                  >
                    {acceptAwardMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Accepting…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Accept Contract Award
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeclineModal(true)}
                    disabled={acceptAwardMutation.isPending || declineAwardMutation.isPending}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs h-9 px-3 rounded-xl"
                    aria-label="Decline contract award offer"
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Complete Evaluated Ranking Matrix (Buyer can award ANY participant) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Evaluated Bidding & Commercial Ranking Matrix
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Verified downward outcomes. Buyers can award contract to L1 or any eligible participant with written justification.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {ranking.length} {ranking.length === 1 ? 'Bidder Record' : 'Bidder Records'}
          </span>
        </div>

        {ranking.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No ranked bids recorded for this auction" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" aria-label="Reverse auction participant rankings">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th scope="col" className="py-3 px-4 w-20">Rank</th>
                  <th scope="col" className="py-3 px-4">Participant Organization</th>
                  <th scope="col" className="py-3 px-4 text-right w-44">Final Bid Amount</th>
                  <th scope="col" className="py-3 px-4 text-right w-52">Decrement vs Baseline</th>
                  <th scope="col" className="py-3 px-4 w-36">Qualification Status</th>
                  {canRecommendAward && (
                    <th scope="col" className="py-3 px-4 text-right w-56">Award Selection</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {ranking.map((row, index) => {
                  const rankNumber = row.currentRank || index + 1;
                  const isL1 = rankNumber === 1;
                  const isL2 = rankNumber === 2;
                  const isL3 = rankNumber === 3;
                  const bidAmount = Number(row.lastBidAmount || 0);
                  const initialQuote = Number(row.initialQuoteTotal || row.initialQuoteAmount || 0);
                  const baselinePrice = startPrice > 0 ? startPrice : Number((auction as any)?.basePrice || 0);
                  const diffFromBaseline = baselinePrice > 0 && bidAmount > 0 ? baselinePrice - bidAmount : 0;
                  const diffPctFromBaseline = baselinePrice > 0
                    ? ((Math.abs(diffFromBaseline) / baselinePrice) * 100).toFixed(1)
                    : '0.0';
                  const diffFromInitial = initialQuote > 0 && bidAmount > 0 ? initialQuote - bidAmount : 0;

                  const isAlreadyAwarded = Boolean(
                    row.isAwarded ||
                    (auction?.winnerSellerId && (row.sellerUserId === auction.winnerSellerId || row.sellerOrgId === auction.winnerSellerId)) ||
                    row.status === 'AWARDED' ||
                    row.status === 'ACCEPTED'
                  );

                  return (
                    <tr
                      key={row.id || index}
                      className={`hover:bg-slate-50/80 transition-colors ${row.isCurrentViewer ? 'bg-indigo-50/30' : ''}`}
                    >
                      {/* Rank Badge */}
                      <td className="py-3.5 px-4 font-black">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black tracking-wide ${
                            isL1
                              ? 'bg-amber-100 text-amber-950 border border-amber-300'
                              : isL2
                              ? 'bg-slate-200 text-slate-800'
                              : isL3
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isL1 && <Trophy className="mr-1 h-3 w-3 text-amber-600" />}
                          L{rankNumber}
                        </span>
                      </td>

                      {/* Organization Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {row.sellerOrgName}
                          </span>
                          {row.isCurrentViewer && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-indigo-600 text-white">
                              You
                            </span>
                          )}
                          {isAlreadyAwarded && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-600 text-white shadow-xs">
                              Contract Awardee {rankNumber !== 1 ? `(L${rankNumber})` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Final Bid Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-slate-950 text-sm font-mono">
                          {bidAmount > 0 ? formatCurrency(bidAmount) : '—'}
                        </span>
                      </td>

                      {/* Decrement vs Baseline */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        {baselinePrice > 0 && bidAmount > 0 ? (
                          diffFromBaseline > 0.005 ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-bold text-emerald-700">
                                -{formatCurrency(diffFromBaseline)}
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-800">
                                (-{diffPctFromBaseline}%)
                              </span>
                            </div>
                          ) : Math.abs(diffFromBaseline) <= 0.005 ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-bold text-slate-700">
                                ₹0.00
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500">
                                0.0% · At Baseline
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-bold text-slate-700">
                                +{formatCurrency(Math.abs(diffFromBaseline))}
                              </span>
                              <span className="text-[10px] font-semibold text-amber-700">
                                +{diffPctFromBaseline}% vs Baseline
                              </span>
                              {diffFromInitial > 0 && (
                                <span className="text-[9px] font-medium text-emerald-700">
                                  (-{formatCurrency(diffFromInitial)} from quote)
                                </span>
                              )}
                            </div>
                          )
                        ) : diffFromInitial > 0 ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-bold text-emerald-700">
                              -{formatCurrency(diffFromInitial)}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-800">
                              (-{((diffFromInitial / initialQuote) * 100).toFixed(1)}% from quote)
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-bold text-slate-600">₹0.00</span>
                            <span className="text-[10px] font-semibold text-slate-400">0.0% · No decrement</span>
                          </div>
                        )}
                      </td>

                      {/* Qualification Status */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {row.qualificationStatus || row.status || 'QUALIFIED'}
                        </span>
                      </td>

                      {/* Action Column for Managers: Clean Discretionary Choices */}
                      {canRecommendAward && (
                        <td className="py-3.5 px-4 text-right">
                          {purchaseOrder || (['AWARDED', 'COMPLETED'].includes(status) && purchaseOrder) ? (
                            isAlreadyAwarded ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
                                <CheckCircle2 className="h-3 w-3" /> {rankNumber === 1 ? 'PO Issued (L1)' : `PO Issued (L${rankNumber})`}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-semibold">—</span>
                            )
                          ) : row.isAwardAccepted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Award Accepted (PO Issuance Pending)
                            </span>
                          ) : row.isAwardOffered ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 shadow-xs">
                              <Clock className="h-3 w-3" /> Offer Awaiting Acceptance
                            </span>
                          ) : canOfferAward ? (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {isL1 ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedParticipantForAward(row);
                                    setIsPriceMatchMode(false);
                                    setAwardActionType('recommend');
                                  }}
                                  disabled={awardMutation.isPending || generatePoMutation.isPending}
                                  className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 shadow-2xs gap-1"
                                  title="Offer contract award to L1 lowest evaluated bidder"
                                >
                                  <Award className="h-3.5 w-3.5 text-indigo-600" />
                                  Award L1
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedParticipantForAward(row);
                                      setIsPriceMatchMode(true);
                                      setAwardActionType('recommend');
                                    }}
                                    disabled={awardMutation.isPending || generatePoMutation.isPending}
                                    className="h-8 text-xs font-bold border-blue-300 text-blue-700 hover:bg-blue-50 shadow-2xs gap-1"
                                    title="Send counter-offer inviting supplier to match L1 lowest price"
                                  >
                                    <Target className="h-3.5 w-3.5 text-blue-600" />
                                    Match L1
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedParticipantForAward(row);
                                      setIsPriceMatchMode(false);
                                      setAwardActionType('recommend');
                                    }}
                                    disabled={awardMutation.isPending || generatePoMutation.isPending}
                                    className="h-8 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs gap-1"
                                    title="Award directly at higher quoted price with required justification"
                                  >
                                    <Award className="h-3.5 w-3.5 text-slate-600" />
                                    Award L{rankNumber}
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Comprehensive Discretionary Award & PO Modal */}
      {selectedParticipantForAward && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="award-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 relative animate-in fade-in zoom-in duration-150 space-y-4">
            <button
              type="button"
              onClick={() => setSelectedParticipantForAward(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close award modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${awardActionType === 'generate_po' ? 'bg-emerald-100 text-emerald-700' : isPriceMatchMode ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {awardActionType === 'generate_po' ? <Receipt className="h-5 w-5" /> : isPriceMatchMode ? <Target className="h-5 w-5" /> : <Award className="h-5 w-5" />}
              </div>
              <div>
                <h3 id="award-modal-title" className="text-base font-black text-slate-900">
                  {awardActionType === 'generate_po' ? 'Generate Official Purchase Order (PO)' : isPriceMatchMode ? 'Send Price Match Counter-Offer' : 'Issue Contract Award Offer'}
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Auction: <span className="font-mono font-bold text-slate-800">{canonicalCode}</span>
                </p>
              </div>
            </div>

            {/* Selected Supplier Summary */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-600">Selected Supplier:</span>
                <span className="font-black text-slate-900 text-sm">{selectedParticipantForAward.sellerOrgName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-600">Rank in Reverse Auction:</span>
                <span className="font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs border border-amber-300">
                  L{selectedParticipantForAward.currentRank || 1}
                </span>
              </div>
              {isPriceMatchMode ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-800">Counter-Offer Price (L1 Match):</span>
                    <span className="font-mono font-black text-emerald-700 text-sm">
                      {formatCurrency(lowestBidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Supplier's Quoted Bid:</span>
                    <span className="font-mono text-slate-500 line-through text-xs">
                      {formatCurrency(selectedParticipantForAward.lastBidAmount || 0)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-600">Evaluated Contract Amount:</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    {formatCurrency(selectedParticipantForAward.lastBidAmount || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Non-L1 Discretionary Justification Section */}
            {!isPriceMatchMode && (selectedParticipantForAward.currentRank || 1) !== 1 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-amber-900">Non-L1 Award Justification (Required)</p>
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                      You are exercising buyer discretion to award Rank L{selectedParticipantForAward.currentRank} directly at their higher quoted bid. Selecting a non-L1 supplier requires logging the formal justification for audit compliance.
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor={nonL1SelectId} className="block text-[10px] font-black uppercase tracking-wider text-amber-900">
                    Procurement Policy Reason
                  </label>
                  <select
                    id={nonL1SelectId}
                    value={nonL1Reason}
                    onChange={(e) => setNonL1Reason(e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg border border-amber-300 bg-white p-2 text-slate-900 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Capacity Constraints & Split Volume Sourcing">
                      Capacity Constraints & Split Volume Sourcing
                    </option>
                    <option value="Delivery Schedule & Critical Lead Time Compliance">
                      Delivery Schedule & Critical Lead Time Compliance
                    </option>
                    <option value="Technical Specification & Quality Evaluation Superiority">
                      Technical Specification & Quality Evaluation Superiority
                    </option>
                    <option value="Past Non-Performance / Default Risk Assessment of Lower Bidder">
                      Past Non-Performance / Default Risk Assessment of Lower Bidder
                    </option>
                    <option value="Procurement Committee Discretionary Resolution">
                      Procurement Committee Discretionary Resolution
                    </option>
                  </select>
                </div>
              </div>
            )}

            {/* Procurement Lifecycle Guidance Note */}
            <div className={`p-3 rounded-xl border text-xs leading-relaxed ${awardActionType === 'generate_po' ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : isPriceMatchMode ? 'bg-blue-50/70 border-blue-200 text-blue-950' : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'}`}>
              <p className="font-bold flex items-center gap-1.5 mb-0.5">
                <Info className="h-3.5 w-3.5" />
                {awardActionType === 'generate_po' ? 'Binding Purchase Order Creation' : isPriceMatchMode ? 'Price Match Policy (Rule 153 / MSE Preference)' : '4-Step Procurement Lifecycle Step 1'}
              </p>
              <p className="text-[11px] font-medium opacity-90">
                {awardActionType === 'generate_po'
                  ? 'The supplier has formally accepted the award offer. Generating this Purchase Order creates the official binding contract and opens delivery fulfillment tracking.'
                  : isPriceMatchMode
                  ? `Under purchase preference policies, this sends a formal counter-offer to Rank L${selectedParticipantForAward.currentRank} to match the L1 price of ${formatCurrency(lowestBidAmount)}. If the supplier accepts, the contract is finalized at this price.`
                  : 'Issuing this award offer formally notifies the supplier of selection. The supplier must formally accept the award before the binding Purchase Order is generated.'}
              </p>
            </div>

            {/* Remarks / Justification textarea */}
            <div className="space-y-1.5">
              <label htmlFor={modalRemarksId} className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Evaluation Notes & Committee Remarks {!isPriceMatchMode && (selectedParticipantForAward.currentRank || 1) !== 1 && <span className="text-red-500">*</span>}
              </label>
              <textarea
                id={modalRemarksId}
                rows={3}
                value={awardRemarks}
                onChange={(e) => setAwardRemarks(e.target.value)}
                placeholder="Enter procurement committee notes, technical compliance justification, or terms..."
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedParticipantForAward(null)}
                disabled={awardMutation.isPending || generatePoMutation.isPending}
                className="text-xs font-bold text-slate-700 border-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmAward}
                disabled={
                  awardMutation.isPending || 
                  generatePoMutation.isPending || 
                  (!isPriceMatchMode && (selectedParticipantForAward.currentRank || 1) !== 1 && !awardRemarks.trim())
                }
                className={awardActionType === 'generate_po' ? "bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-4" : isPriceMatchMode ? "bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider px-4" : "bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider px-4"}
              >
                {awardMutation.isPending || generatePoMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Processing…
                  </>
                ) : awardActionType === 'generate_po' ? (
                  <>
                    <Receipt className="mr-1.5 h-3.5 w-3.5" /> Confirm & Issue Purchase Order
                  </>
                ) : isPriceMatchMode ? (
                  <>
                    <Target className="mr-1.5 h-3.5 w-3.5" /> Confirm & Send Price Match Offer
                  </>
                ) : (
                  <>
                    <Award className="mr-1.5 h-3.5 w-3.5" /> Confirm & Issue Award Offer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Supplier Decline Award Modal */}
      {showDeclineModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="decline-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 relative animate-in fade-in zoom-in duration-150 space-y-4">
            <button
              type="button"
              onClick={() => setShowDeclineModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close decline modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="decline-modal-title" className="text-base font-black text-slate-900">
                  Decline Contract Award Offer
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Auction: <span className="font-mono font-bold text-slate-800">{canonicalCode}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Are you sure you wish to decline this contract award offer? Declining will notify the buyer and release the award opportunity.
            </p>

            <div className="space-y-1.5">
              <label htmlFor={declineReasonId} className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Reason for Declining (Optional)
              </label>
              <textarea
                id={declineReasonId}
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="State reason such as capacity constraints, delivery timeline conflict, or material availability..."
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeclineModal(false)}
                disabled={declineAwardMutation.isPending}
                className="text-xs font-bold text-slate-700 border-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => declineAwardMutation.mutate(declineReason)}
                disabled={declineAwardMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-4"
              >
                {declineAwardMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Declining…
                  </>
                ) : (
                  <>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Confirm Decline Award
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
