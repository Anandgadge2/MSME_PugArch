/**
 * RatingsPage - shows the rating list and aggregate distribution for a single
 * supplier or buyer. Reads via the new ratings module (React Query) so
 * navigating away and back is instant from cache.
 */

import { useMemo, useState } from 'react';
import { MessageSquareText, RefreshCw, Search, Star, ThumbsUp, TrendingUp } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { EmptyState, InlineError } from '../../shared/FeatureStates';
import { ListSkeleton } from '../../../components/ui/skeleton';
import { KpiCard } from '../../shared/KpiCard';
import { Pagination } from '../../shared/Pagination';
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
    <div className="mx-auto max-w-[1560px] space-y-5 px-4 pb-12">
      {/* ── Transparent Header ── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#12335f]">
          {mode === 'supplier' ? 'Supplier Performance' : 'Buyer Performance'}
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Ratings</h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
              Performance feedback across quality, delivery, communication, and completed procurement records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {summary && summary.count > 0 && <RatingPill average={summary.average} count={summary.count} />}
            <Button
              variant="outline"
              onClick={() => query.refetch()}
              className="h-10 rounded-lg text-xs font-black uppercase shadow-sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Average Rating"
          value={summary?.average ? `${summary.average.toFixed(1)} ★` : '0.0 ★'}
          subtext="Overall performance aggregate"
          icon={Star}
          tone="amber"
          loading={query.isLoading && !query.data}
        />
        <KpiCard
          label="Total Ratings"
          value={summary?.count ?? 0}
          subtext="Total reviews received"
          icon={ThumbsUp}
          tone="blue"
          loading={query.isLoading && !query.data}
        />
        <KpiCard
          label="Written Reviews"
          value={writtenReviewCount}
          subtext="Detailed stakeholder feedback"
          icon={MessageSquareText}
          tone="green"
          loading={query.isLoading && !query.data}
        />
        <KpiCard
          label="High Score (4+)"
          value={highScoreCount}
          subtext="4-star and 5-star ratings"
          icon={TrendingUp}
          tone="indigo"
          loading={query.isLoading && !query.data}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3">
        <KpiCard label="Review Coverage" value={`${responseCoverage}%`} subtext="Written feedback compared with total ratings" tone="slate" />
        <KpiCard label="Low Score Alerts" value={lowScoreCount} subtext="Ratings at 1 or 2 stars" tone="red" />
        <div className="col-span-2 sm:col-span-1">
          <KpiCard label="Current Dataset" value={mode === 'supplier' ? 'Supplier' : 'Buyer'} subtext="Only this rating endpoint is queried" tone="blue" />
        </div>
      </div>

      {query.error && (
        <InlineError
          message={query.error instanceof Error ? query.error.message : 'Failed to load ratings'}
          onRetry={() => query.refetch()}
        />
      )}

      {summary && summary.count > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#12335f]">
              Rating Distribution
            </p>
            <RatingDistribution summary={summary} />
          </CardContent>
        </Card>
      )}

      {/* ── Filter Bar (border-y) ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between border-y border-slate-200 bg-slate-50/50 py-3 px-1">
        <div className="relative min-w-0 w-full sm:flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search supplier, buyer, PO, review..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
          />
        </div>
        <select
          value={scoreFilter}
          onChange={event => setScoreFilter(event.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20 min-w-0 w-full sm:w-auto"
        >
          <option value="">All scores</option>
          <option value="5">5 star</option>
          <option value="4">4 star and above</option>
          <option value="3">3 star and above</option>
        </select>
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {filtered.map(item => (
              <Card key={item.id}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {mode === 'supplier'
                          ? (item as any).seller?.name || `Seller #${item.sellerId || '-'}`
                          : (item as any).buyer?.name || `Buyer #${item.buyerId || '-'}`}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.purchaseOrderId ? `PO #${item.purchaseOrderId}` : 'Direct rating'} ·{' '}
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <StarRating value={item.rating} readOnly />
                  </div>

                  <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                    {item.review || 'No written review provided.'}
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {mode === 'supplier' ? (
                      <>
                        <Score label="Quality" value={(item as SupplierRatingDto).qualityScore} />
                        <Score label="Delivery" value={(item as SupplierRatingDto).deliveryScore} />
                        <Score
                          label="Communication"
                          value={(item as SupplierRatingDto).communicationScore}
                        />
                      </>
                    ) : (
                      <>
                        <Score
                          label="Payment"
                          value={(item as BuyerRatingDto).paymentTimelinessScore}
                        />
                        <Score
                          label="Communication"
                          value={(item as BuyerRatingDto).communicationScore}
                        />
                        <div />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
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



function Score({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value ? `${value}/5` : '-'}</p>
    </div>
  );
}
