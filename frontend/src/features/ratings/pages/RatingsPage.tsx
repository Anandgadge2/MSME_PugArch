/**
 * RatingsPage - shows the rating list and aggregate distribution for a single
 * supplier or buyer. Reads via the new ratings module (React Query) so
 * navigating away and back is instant from cache.
 */

import { useMemo, useState } from 'react';
import { MessageSquareText, RefreshCw, Search, Star, ThumbsUp, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { EmptyState, InlineError } from '../../shared/FeatureStates';
import { ListSkeleton } from '../../../components/ui/skeleton';
import { Pagination } from '../../shared/Pagination';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { formatDate } from '../../shared/format';
import { RatingDistribution } from '../components/RatingDistribution';
import { StarRating } from '../components/StarRating';
import { RatingPill } from '../components/RatingPill';
import { useBuyerRatings, useSupplierRatings } from '../hooks';
import type { BuyerRatingDto, RatingsListResult, SupplierRatingDto } from '../types';

interface Props {
  endpoint: string;
  mode?: 'supplier' | 'buyer';
}

const subjectIdFromEndpoint = (endpoint: string) => {
  const match = endpoint.match(/\/api\/ratings\/(?:supplier|buyer)\/(\d+)/);
  return match ? Number(match[1]) : NaN;
};

export default function RatingsPage({ endpoint, mode = 'supplier' }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');

  const subjectId = subjectIdFromEndpoint(endpoint);

  const supplierQuery = useSupplierRatings(subjectId, { page, pageSize, enabled: mode === 'supplier' });
  const buyerQuery = useBuyerRatings(subjectId, { page, pageSize, enabled: mode === 'buyer' });
  const query = mode === 'supplier' ? supplierQuery : buyerQuery;

  const data = (query.data || { records: [], total: 0, summary: undefined }) as RatingsListResult<
    SupplierRatingDto | BuyerRatingDto
  >;

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return (data.records || []).filter(rating => {
      const haystack = [
        rating.review,
        (rating as any).seller?.name,
        (rating as any).buyer?.name,
        rating.purchaseOrderId ? `PO #${rating.purchaseOrderId}` : ''
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (
        (!term || haystack.includes(term)) &&
        (!scoreFilter || (rating.rating || 0) >= Number(scoreFilter))
      );
    });
  }, [data.records, searchTerm, scoreFilter]);

  const summary = data.summary;
  const writtenReviewCount = (data.records || []).filter(r => r.review).length;
  const lowScoreCount = (summary?.distribution || []).filter(bucket => bucket.star <= 2).reduce((sum, bucket) => sum + bucket.count, 0);
  const highScoreCount = (summary?.distribution || []).filter(bucket => bucket.star >= 4).reduce((sum, bucket) => sum + bucket.count, 0);
  const responseCoverage = summary?.count ? Math.round((writtenReviewCount / summary.count) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1560px] space-y-4 px-4 pb-8 pt-4">
      {/* ── Compact Header ── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
            SUPPLIER PERFORMANCE
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tight text-slate-900">Ratings</h1>
            {summary && summary.count > 0 && <RatingPill average={summary.average} count={summary.count} />}
          </div>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500 max-w-xl leading-tight">
            Performance feedback across quality, delivery, communication, and completed procurement records.
          </p>
        </div>
        <div className="flex shrink-0">
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            className="h-8 px-3 rounded-md text-[10px] font-black uppercase shadow-xs bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="flex flex-col gap-3">
        {/* Primary Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardKpi
            label="Average Rating"
            value={summary?.average ? `${summary.average.toFixed(1)} / 5` : '0.0 / 5'}
            icon={Star}
            tone="amber"
            highlight={true}
            loading={query.isLoading && !query.data}
          />
          <DashboardKpi
            label="Total Ratings"
            value={summary?.count ?? 0}
            icon={ThumbsUp}
            tone="blue"
            loading={query.isLoading && !query.data}
          />
          <DashboardKpi
            label="Written Reviews"
            value={writtenReviewCount}
            icon={MessageSquareText}
            tone="teal"
            loading={query.isLoading && !query.data}
          />
          <DashboardKpi
            label="High Score (4+)"
            value={highScoreCount}
            icon={TrendingUp}
            tone="green"
            loading={query.isLoading && !query.data}
          />
        </div>

        {/* Secondary Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DashboardKpi label="Review Coverage" value={`${responseCoverage}%`} icon={BarChart3} tone="blue" />
          <DashboardKpi label="Low Score Alerts" value={lowScoreCount} icon={BarChart3} tone={lowScoreCount > 0 ? 'red' : 'slate'} />
          <DashboardKpi label="Current Dataset" value={mode === 'supplier' ? 'Supplier' : 'Buyer'} icon={BarChart3} tone="slate" />
        </div>
      </div>

      {query.error && (
        <InlineError
          message={query.error instanceof Error ? query.error.message : 'Failed to load ratings'}
          onRetry={() => query.refetch()}
        />
      )}

      {/* ── Rating Distribution ── */}
      {summary && summary.count > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#12335f]">Rating Distribution</h3>
            <p className="text-[10px] font-semibold text-slate-500">How ratings are distributed across your supplier feedback</p>
          </div>
          <div className="max-w-md">
            <RatingDistribution summary={summary} />
          </div>
        </div>
      )}

      {/* ── Compact Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search supplier, buyer, PO, review..."
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]/20 shadow-xs"
          />
        </div>
        <div className="w-full sm:w-auto">
          <select
            value={scoreFilter}
            onChange={event => setScoreFilter(event.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-0 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] transition-colors shadow-xs cursor-pointer"
          >
            <option value="">All scores</option>
            <option value="5">5 star</option>
            <option value="4">4 star and above</option>
            <option value="3">3 star and above</option>
          </select>
        </div>
        {(searchTerm || scoreFilter) && (
          <Button
            variant="ghost"
            className="h-9 rounded-md px-3 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            onClick={() => {
              setSearchTerm('');
              setScoreFilter('');
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {query.isLoading && !query.data ? (
        <ListSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No ratings found"
          description={searchTerm || scoreFilter
            ? 'No reviews match the current search or score filter.'
            : 'Ratings appear after completed purchase orders are reviewed.'}
        />
      ) : (
        <div className="flex flex-col space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map(item => (
              <div key={item.id} className="rounded-xl border border-slate-200/80 bg-white shadow-xs p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-black text-[#12335f] truncate max-w-[200px] sm:max-w-xs">
                      {mode === 'supplier'
                        ? (item as any).seller?.name || `Seller #${item.sellerId || '-'}`
                        : (item as any).buyer?.name || `Buyer #${item.buyerId || '-'}`}
                    </h4>
                    <p className="mt-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                      {item.purchaseOrderId ? `PO #${item.purchaseOrderId}` : 'Direct rating'} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StarRating value={item.rating} size="sm" readOnly />
                  </div>
                </div>

                {/* Review Body */}
                <div className="relative rounded-lg bg-slate-50/80 p-3 border-l-2 border-slate-200 text-xs font-medium text-slate-700 min-h-[48px] flex items-center">
                  <span className="italic text-slate-600">
                    {item.review ? `"${item.review}"` : 'No written review provided.'}
                  </span>
                </div>

                {/* Sub-Ratings */}
                <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                  {mode === 'supplier' ? (
                    <>
                      <CompactScore label="QUALITY" value={(item as SupplierRatingDto).qualityScore} tone="blue" />
                      <CompactScore label="DELIVERY" value={(item as SupplierRatingDto).deliveryScore} tone="purple" />
                      <CompactScore label="COMM." value={(item as SupplierRatingDto).communicationScore} tone="teal" />
                    </>
                  ) : (
                    <>
                      <CompactScore label="PAYMENT" value={(item as BuyerRatingDto).paymentTimelinessScore} tone="green" />
                      <CompactScore label="COMM." value={(item as BuyerRatingDto).communicationScore} tone="teal" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={data.total || 0}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="ratings"
          />
        </div>
      )}
    </div>
  );
}

function DashboardKpi({ label, value, icon: Icon, tone, highlight = false, loading = false }: any) {
  const toneMap: Record<string, { bg: string, text: string, iconBg: string }> = {
    amber: { bg: 'border-amber-200 bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100 text-amber-600' },
    blue: { bg: 'border-blue-200 bg-blue-50/50', text: 'text-blue-700', iconBg: 'bg-blue-100 text-blue-600' },
    teal: { bg: 'border-teal-200 bg-teal-50/50', text: 'text-teal-700', iconBg: 'bg-teal-100 text-teal-600' },
    green: { bg: 'border-emerald-200 bg-emerald-50/50', text: 'text-emerald-700', iconBg: 'bg-emerald-100 text-emerald-600' },
    red: { bg: 'border-rose-200 bg-rose-50/50', text: 'text-rose-700', iconBg: 'bg-rose-100 text-rose-600' },
    slate: { bg: 'border-slate-200 bg-slate-50/50', text: 'text-slate-600', iconBg: 'bg-slate-100 text-slate-500' },
  };

  const t = toneMap[tone] || toneMap.slate;

  return (
    <div className={`rounded-xl border ${highlight ? t.bg : 'bg-white border-slate-200/80'} p-3 shadow-xs flex items-center gap-3`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.iconBg}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[9.5px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <p className={`mt-0.5 truncate text-sm font-black ${highlight ? t.text : 'text-slate-900'} ${loading ? 'animate-pulse text-slate-300' : ''}`}>
          {loading ? '...' : value}
        </p>
      </div>
    </div>
  );
}

function CompactScore({ label, value, tone }: { label: string; value?: number | null; tone: 'blue' | 'purple' | 'teal' | 'green' }) {
  const isWarning = value !== null && value !== undefined && value <= 2;
  
  const toneStyles = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };

  const alertStyle = 'bg-rose-50 text-rose-700 border-rose-100';
  const displayStyle = isWarning ? alertStyle : toneStyles[tone];

  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${displayStyle}`}>
      <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-80">{label}</span>
      <span className="text-[11px] font-black">{value ? `${value}/5` : '-'}</span>
    </div>
  );
}
