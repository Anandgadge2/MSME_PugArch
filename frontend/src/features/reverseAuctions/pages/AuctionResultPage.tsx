'use client';

import { useState, useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  IndianRupee,
  Info,
  Loader2,
  Medal,
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
  const [awardRemarks, setAwardRemarks] = useState('');
  const modalRemarksId = useId();

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

  // Sync URL to human-readable canonical code (e.g. /seller/procurement/reverse-auction/RA-2026-69UXUD/results)
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
        <LoadingState label="Loading reverse auction official results..." />
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
  const l1Winner = ranking.length > 0 ? ranking[0] : null;
  const l1BidAmount = Number(l1Winner?.lastBidAmount || auction?.currentLowestAmount || auction?.currentLowestBid || 0);
  const hasSavings = startPrice > 0 && l1BidAmount > 0 && startPrice > l1BidAmount;
  const savingsAmount = hasSavings ? startPrice - l1BidAmount : 0;
  const savingsPercent = hasSavings ? ((savingsAmount / startPrice) * 100).toFixed(1) : '0.0';

  const backUrl = `${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}`;

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
            <span className="text-slate-900 font-bold" aria-current="page">Results</span>
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
            {['AWARD_RECOMMENDED', 'AWARDED', 'COMPLETED'].includes(status) ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                {status.replace(/_/g, ' ')}
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

      {/* 2. Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Gavel className="h-4 w-4 text-indigo-600" />
              <span>Official Reverse Auction Outcomes & Ranking</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">
              {auction?.title || `Reverse Auction ${canonicalCode}`}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
              Auction Reference: <span className="font-mono font-bold text-slate-900">{canonicalCode}</span>
              {auction?.category && <> · Category: <span className="font-bold text-slate-900">{auction.category}</span></>}
              {auction?.endTime && <> · Concluded At: <span className="font-bold text-slate-900">{formatDateTime(auction.endTime)}</span></>}
            </p>
          </div>

          {canRecommendAward && ['CLOSED', 'COMPLETED'].includes(status) && l1Winner && (
            <div className="shrink-0">
              <Button
                onClick={() => setSelectedParticipantForAward(l1Winner)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider h-10 px-5 shadow-sm"
              >
                <Award className="mr-2 h-4 w-4" /> Recommend Award to L1
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label="Auction Key Performance Indicators">
        {/* L1 Final Bid */}
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Final Winning Bid (L1)</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-950">
              {l1BidAmount > 0 ? formatCurrency(l1BidAmount) : '—'}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-emerald-800 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Lowest evaluated quote
          </p>
        </div>

        {/* Starting Baseline Price */}
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

        {/* Cost Reduction / Savings */}
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Procurement Savings</span>
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
            {savingsAmount > 0 ? `${savingsPercent}% reduction vs starting price` : 'No decrement recorded'}
          </p>
        </div>

        {/* Qualified Participants */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Bidders</span>
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
            Total participating suppliers
          </p>
        </div>
      </div>

      {/* 4. L1 Spotlight Winner Card */}
      {l1Winner && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50/80 via-yellow-50/40 to-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 shadow-sm">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Official L1 Winning Bidder
                  </span>
                  {l1Winner.isCurrentViewer && (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-600 text-white shadow-sm">
                      Your Organization
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-950 mt-0.5">
                  {l1Winner.sellerOrgName}
                </h2>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  Final Evaluated Quote: <span className="font-black text-emerald-700">{formatCurrency(l1BidAmount)}</span>
                  {savingsAmount > 0 && <> (Generated <span className="font-bold text-indigo-700">{formatCurrency(savingsAmount)}</span> cost savings)</>}
                </p>
              </div>
            </div>

            {canRecommendAward && (
              <div className="flex items-center gap-2 self-start sm:self-center">
                {status === 'AWARDED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Contract Awarded
                  </span>
                ) : status === 'AWARD_RECOMMENDED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-300">
                    <Award className="h-4 w-4 text-indigo-700" /> Award Recommended
                  </span>
                ) : (
                  <Button
                    onClick={() => setSelectedParticipantForAward(l1Winner)}
                    className="rounded-xl bg-slate-900 hover:bg-[#0b2447] text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 shadow-sm"
                  >
                    <Award className="mr-1.5 h-3.5 w-3.5" /> Recommend Award
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Complete Ranking Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Evaluated Bidding & Ranking Matrix
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Verified outcomes ordered by final lowest quote (L1 through Ln)
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {ranking.length} {ranking.length === 1 ? 'Supplier Entry' : 'Supplier Entries'}
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
                    <th scope="col" className="py-3 px-4 text-right w-36">Action</th>
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
                        </div>
                      </td>

                      {/* Final Bid Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-slate-950 text-sm">
                          {bidAmount > 0 ? formatCurrency(bidAmount) : '—'}
                        </span>
                      </td>

                      {/* Decrement vs Baseline */}
                      <td className="py-3.5 px-4 text-right">
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

                      {/* Action Column for Managers */}
                      {canRecommendAward && (
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant={isL1 ? 'primary' : 'outline'}
                            onClick={() => setSelectedParticipantForAward(row)}
                            disabled={awardMutation.isPending}
                            className={`h-8 text-xs font-bold ${isL1 ? 'bg-slate-900 hover:bg-[#0b2447] text-white' : 'border-slate-300 text-slate-700'}`}
                          >
                            <Award className="mr-1 h-3.5 w-3.5" />
                            Recommend
                          </Button>
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

      {/* 6. Award Recommendation Confirmation Modal */}
      {selectedParticipantForAward && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="award-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 relative animate-in fade-in zoom-in duration-200">
            <button
              type="button"
              onClick={() => setSelectedParticipantForAward(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close award modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 id="award-modal-title" className="text-base font-black text-slate-900">
                  Recommend Award for Auction
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Auction Code: <span className="font-mono font-bold text-slate-800">{canonicalCode}</span>
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">Selected Participant:</span>
                <span className="font-black text-slate-900">{selectedParticipantForAward.sellerOrgName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">Final Evaluated Quote:</span>
                <span className="font-black text-emerald-700">
                  {formatCurrency(selectedParticipantForAward.lastBidAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">Auction Rank:</span>
                <span className="font-black text-slate-900">
                  L{selectedParticipantForAward.currentRank || 1}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 mb-5">
              <label htmlFor={modalRemarksId} className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Award Recommendation Remarks (Optional)
              </label>
              <textarea
                id={modalRemarksId}
                rows={3}
                value={awardRemarks}
                onChange={(e) => setAwardRemarks(e.target.value)}
                placeholder="Specify justification, procurement committee notes, or technical compliance observations..."
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedParticipantForAward(null)}
                disabled={awardMutation.isPending}
                className="text-xs font-bold text-slate-700 border-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => awardMutation.mutate({
                  participantId: selectedParticipantForAward.id,
                  remarks: awardRemarks
                })}
                disabled={awardMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider px-4"
              >
                {awardMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirm Recommendation
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

