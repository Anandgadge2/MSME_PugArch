'use client';

import { useState, useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
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
  TrendingDown,
  Trophy,
  Users,
  X
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDateTime } from '../../shared/format';
import { useAuth } from '../../../hooks/useAuth';
import { reverseAuctionApi } from '../api';
import { toast } from 'sonner';
export default function AuctionResultPage({ id }: { id: number | string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user } = useAuth();

  const [selectedParticipantForAward, setSelectedParticipantForAward] = useState<any | null>(null);
  const [awardActionType, setAwardActionType] = useState<'recommend' | 'generate_po'>('generate_po');
  const [nonL1Reason, setNonL1Reason] = useState('MSE Purchase Preference Policy (Matching L1 Price)');
  const [awardRemarks, setAwardRemarks] = useState('');
  const modalRemarksId = useId();
  const nonL1SelectId = useId();

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
  const ranking: any[] = query.data?.ranking || [];
  const canRecommendAward = Boolean(query.data?.canRecommendAward);
  const isManager = Boolean(query.data?.isManager);
  const status = String(auction?.statusEnum || auction?.status || '').toUpperCase();

  const awardMutation = useMutation({
    mutationFn: ({ participantId, remarks }: { participantId?: number; remarks?: string }) =>
      reverseAuctionApi.recommendAward(id, participantId, remarks),
    onSuccess: () => {
      toast.success('Award recommendation successfully submitted!');
      setSelectedParticipantForAward(null);
      setAwardRemarks('');
      qc.invalidateQueries({ queryKey: ['reverse-auction-result', id] });
      qc.invalidateQueries({ queryKey: ['reverse-auction', id] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to submit award recommendation');
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

  // Keyboard navigation for modal
  useEffect(() => {
    if (!selectedParticipantForAward) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedParticipantForAward(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedParticipantForAward]);

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

  const handleConfirmAward = () => {
    if (!selectedParticipantForAward) return;
    const isNonL1 = (selectedParticipantForAward.currentRank || 1) !== 1;
    const combinedRemarks = isNonL1
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
        remarks: combinedRemarks
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Breadcrumbs & Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="hover:text-slate-900 transition-colors focus:outline-none focus:underline"
            >
              Home
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => router.push(`${rolePrefix}/procurement/opportunities?type=reverse-auction`)}
              className="hover:text-slate-900 transition-colors focus:outline-none focus:underline"
            >
              Procurement
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => router.push(backUrl)}
              className="hover:text-slate-900 transition-colors focus:outline-none focus:underline font-mono"
            >
              {canonicalCode}
            </button>
            <span>/</span>
            <span className="text-slate-900 font-bold" aria-current="page">Outcomes & Evaluation</span>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(backUrl)}
              className="h-8 px-3 text-xs font-bold text-slate-700 hover:text-slate-950 border-slate-300"
              aria-label="Return to reverse auction details page"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Auction Details
            </Button>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide uppercase bg-blue-100 text-blue-900 border border-blue-200">
              {auction?.procurementMethod || 'REVERSE_AUCTION'}
            </span>
            {['AWARDED', 'COMPLETED'].includes(status) ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> Contract Awarded
              </span>
            ) : status === 'AWARD_RECOMMENDED' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
                <Award className="h-3.5 w-3.5 text-indigo-700" /> Award Recommended
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
                {status || 'CLOSED'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="h-9 text-xs font-bold border-slate-300"
            aria-label="Refresh auction outcomes data"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Header Banner with Action Buttons */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Gavel className="h-4 w-4 text-indigo-600" />
              <span>Official Reverse Auction Outcomes & Evaluation</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">
              {auction?.title || `Reverse Auction ${canonicalCode}`}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
              Auction Code: <span className="font-mono font-bold text-slate-900">{canonicalCode}</span>
              {auction?.category && <> · Category: <span className="font-bold text-slate-900">{auction.category}</span></>}
              {auction?.endTime && <> · Concluded: <span className="font-bold text-slate-900">{formatDateTime(auction.endTime)}</span></>}
            </p>
          </div>

          {canRecommendAward && ['CLOSED', 'COMPLETED'].includes(status) && (
            <div className="shrink-0 flex items-center gap-2">
              <Button
                onClick={() => {
                  setSelectedParticipantForAward(lowestEvaluated);
                  setAwardActionType('generate_po');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider h-10 px-5 shadow-sm"
              >
                <Receipt className="mr-2 h-4 w-4" /> Award Contract & Generate PO
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label="Auction Key Performance Indicators">
        {/* L1 Lowest Commercial Offer */}
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Lowest Commercial Offer (L1)</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-950">
              {lowestBidAmount > 0 ? formatCurrency(lowestBidAmount) : '—'}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-emerald-800 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Lowest evaluated downward bid
          </p>
        </div>

        {/* Baseline Starting Price */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Starting Baseline Price</span>
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-950">
              {startPrice > 0 ? formatCurrency(startPrice) : '—'}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            Ceiling reference benchmark
          </p>
        </div>

        {/* Procurement Savings */}
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Procurement Cost Savings</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-indigo-950">
              {savingsAmount > 0 ? formatCurrency(savingsAmount) : '₹0.00'}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-indigo-800 mt-1">
            {savingsAmount > 0 ? `${savingsPercent}% reduction achieved` : 'No decrement recorded'}
          </p>
        </div>

        {/* Active Bidders */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qualified Bidders</span>
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-950">
              {ranking.length}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            Total active suppliers evaluated
          </p>
        </div>
      </div>

      {/* 4. Evaluation Spotlight Card: Discretionary Award & Standing Notice */}
      {highlightedParticipant && (
        <div className={`rounded-2xl border-2 p-5 sm:p-6 shadow-sm ${
          isAwardConcluded
            ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-teal-50/30 to-white'
            : 'border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-blue-50/30 to-white'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-sm ${
                isAwardConcluded ? 'bg-emerald-600' : 'bg-indigo-600'
              }`}>
                {isAwardConcluded ? <ShieldCheck className="h-6 w-6" /> : <Award className="h-6 w-6" />}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-black uppercase tracking-wider ${
                    isAwardConcluded ? 'text-emerald-900' : 'text-indigo-900'
                  }`}>
                    {isAwardConcluded ? 'Contract Awarded Supplier' : 'Lowest Commercial Offer (L1 Benchmark)'}
                  </span>
                  {highlightedParticipant.isCurrentViewer && (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-blue-600 text-white shadow-sm">
                      Your Organization
                    </span>
                  )}
                  {isAwardConcluded && (highlightedParticipant.currentRank || 1) !== 1 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      Discretionary Non-L1 Award
                    </span>
                  )}
                  {!isAwardConcluded && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      Award Discretionary
                    </span>
                  )}
                </div>

                <h2 className="text-lg sm:text-xl font-black text-slate-950">
                  {highlightedParticipant.sellerOrgName}
                </h2>

                <p className="text-xs font-semibold text-slate-600">
                  {isAwardConcluded ? 'Awarded Contract Amount: ' : 'Final Bid Amount: '}
                  <span className="font-black text-emerald-700">{formatCurrency(highlightedParticipant.lastBidAmount || 0)}</span>
                  {' · '}{isAwardConcluded ? 'Auction Standings: ' : 'Rank: '}
                  <span className="font-black text-slate-900">L{highlightedParticipant.currentRank || 1}</span>
                </p>

                {/* Non-L1 Justification Note when awarded */}
                {isAwardConcluded && auction?.overrideReason && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950">
                    <div className="font-black flex items-center gap-1.5 mb-0.5 text-amber-900 text-[11px] uppercase tracking-wide">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      Recorded Procurement Policy Justification:
                    </div>
                    <p className="font-medium text-amber-900 text-xs leading-relaxed">{auction.overrideReason}</p>
                  </div>
                )}

                {/* Linked Purchase Order Info & Quick Navigation */}
                {purchaseOrder && (
                  <div className="mt-3 flex flex-wrap items-center gap-2.5 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs">
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

                {/* Important Procurement Discretion Notice */}
                {!isAwardConcluded && (
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed pt-1">
                    <Info className="inline h-3.5 w-3.5 text-blue-600 mr-1 -mt-0.5" />
                    <strong>Procurement Policy Note:</strong> In reverse auctions, awarding to L1 is not mandatory. The buyer possesses discretionary authority to evaluate technical capability, delivery timelines, capacity, or enforce MSE purchase preference before formal contract allocation.
                  </p>
                )}
              </div>
            </div>

            {canRecommendAward && !isAwardConcluded && ['CLOSED', 'COMPLETED'].includes(status) && (
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
                <Button
                  onClick={() => {
                    setSelectedParticipantForAward(highlightedParticipant);
                    setAwardActionType('generate_po');
                  }}
                  className="rounded-xl bg-slate-900 hover:bg-[#0b2447] text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 shadow-sm"
                >
                  <Receipt className="mr-1.5 h-3.5 w-3.5" /> Award This Bidder
                </Button>
              </div>
            )}
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
                  <th scope="col" className="py-3 px-4 text-right">Final Bid Amount</th>
                  <th scope="col" className="py-3 px-4 text-right">Decrement vs Baseline</th>
                  <th scope="col" className="py-3 px-4">Qualification Status</th>
                  {canRecommendAward && (
                    <th scope="col" className="py-3 px-4 text-right w-44">Discretionary Award</th>
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
                  const diff = startPrice > 0 && bidAmount > 0 ? startPrice - bidAmount : 0;
                  const diffPercent = startPrice > 0 && diff > 0 ? ((diff / startPrice) * 100).toFixed(1) : null;
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
                        {diff > 0 ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-bold text-emerald-700">
                              -{formatCurrency(diff)}
                            </span>
                            {diffPercent && (
                              <span className="text-[10px] font-semibold text-emerald-800">
                                ({diffPercent}%)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Qualification Status */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {row.qualificationStatus || row.status || 'QUALIFIED'}
                        </span>
                      </td>

                      {/* Action Column for Managers: Can Award ANY Participant */}
                      {canRecommendAward && (
                        <td className="py-3.5 px-4 text-right">
                          {['AWARDED', 'COMPLETED'].includes(status) ? (
                            isAlreadyAwarded ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
                                <CheckCircle2 className="h-3 w-3" /> {rankNumber === 1 ? 'Awarded (L1)' : `Awarded (L${rankNumber})`}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-semibold">—</span>
                            )
                          ) : (
                            <Button
                              size="sm"
                              variant={isL1 ? 'primary' : 'outline'}
                              onClick={() => {
                                setSelectedParticipantForAward(row);
                                setAwardActionType('generate_po');
                              }}
                              disabled={awardMutation.isPending || generatePoMutation.isPending}
                              className={`h-8 text-xs font-bold ${
                                isL1 
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                  : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <Award className="mr-1 h-3.5 w-3.5" />
                              {isL1 ? 'Award L1' : `Award L${rankNumber}`}
                            </Button>
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
              <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 id="award-modal-title" className="text-base font-black text-slate-900">
                  Award Contract & Allocate Purchase Order
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
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-600">Evaluated Contract Amount:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {formatCurrency(selectedParticipantForAward.lastBidAmount || 0)}
                </span>
              </div>
            </div>

            {/* Non-L1 Discretionary Justification Section */}
            {(selectedParticipantForAward.currentRank || 1) !== 1 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-amber-900">Non-L1 Award Justification (Required)</p>
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                      You are exercising buyer discretion to award Rank L{selectedParticipantForAward.currentRank}. Under procurement rules, selecting a non-L1 supplier requires logging the formal justification for audit compliance.
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
                    <option value="MSE Purchase Preference Policy (Matching L1 Price)">
                      MSE Purchase Preference Policy (Matching L1 Price)
                    </option>
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

            {/* Action Type: Recommend vs Direct PO */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Award Action Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAwardActionType('generate_po')}
                  className={`p-3 rounded-xl border text-left transition ${
                    awardActionType === 'generate_po'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/30 text-emerald-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="text-xs font-black">Generate Official PO</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Issues PO & starts delivery</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAwardActionType('recommend')}
                  className={`p-3 rounded-xl border text-left transition ${
                    awardActionType === 'recommend'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/30 text-indigo-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="text-xs font-black">Recommend Award</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Logs internal approval first</p>
                </button>
              </div>
            </div>

            {/* Remarks / Justification textarea */}
            <div className="space-y-1.5">
              <label htmlFor={modalRemarksId} className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Evaluation Notes & Committee Remarks {(selectedParticipantForAward.currentRank || 1) !== 1 && <span className="text-red-500">*</span>}
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
                  ((selectedParticipantForAward.currentRank || 1) !== 1 && !awardRemarks.trim())
                }
                className={awardActionType === 'generate_po' ? "bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-4" : "bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider px-4"}
              >
                {awardMutation.isPending || generatePoMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Processing Award…
                  </>
                ) : awardActionType === 'generate_po' ? (
                  <>
                    <Receipt className="mr-1.5 h-3.5 w-3.5" /> Confirm & Issue Purchase Order
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Submit Award Recommendation
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
