/**
 * RatingsPage - shows the rating list and aggregate distribution for a single
 * supplier or buyer. Reads via the new ratings module (React Query) so
 * navigating away and back is instant from cache.
 */

import { useMemo, useState } from 'react';
import {
  MessageSquareText,
  RefreshCw,
  Search,
  Star,
  ThumbsUp,
  TrendingUp,
  Filter,
  CheckCircle2,
  X,
  Calendar,
  Building2,
  Quote,
  ShieldCheck,
  Award,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { EmptyState, InlineError } from '../../shared/FeatureStates';
import { ListSkeleton } from '../../../components/ui/skeleton';
import { Pagination } from '../../shared/Pagination';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { ViewModeToggle, type ViewMode } from '../../shared/ViewModeToggle';
import { KpiCard } from '../../shared/KpiCard';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { formatDate } from '../../shared/format';
import { cn } from '../../../lib/utils';
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
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'with_review' | 'rating_only'>('all');
  const [orderFilter, setOrderFilter] = useState<'all' | 'po_linked' | 'direct'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '30_days' | '90_days' | 'this_year'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'rating_desc' | 'rating_asc'>('newest');

  // View Mode
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const subjectId = subjectIdFromEndpoint(endpoint);

  // Fetch ratings via React Query
  const supplierQuery = useSupplierRatings(subjectId, { page: 1, pageSize: 50, enabled: mode === 'supplier' });
  const buyerQuery = useBuyerRatings(subjectId, { page: 1, pageSize: 50, enabled: mode === 'buyer' });
  const query = mode === 'supplier' ? supplierQuery : buyerQuery;

  const data = (query.data || { records: [], total: 0, summary: undefined }) as RatingsListResult<
    SupplierRatingDto | BuyerRatingDto
  >;

  const records = data.records || [];
  const summary = data.summary;

  // KPI Calculations from authentic data
  const totalRatings = summary?.count ?? records.length ?? 0;
  const averageRating = summary?.average ?? 0;
  const writtenReviewCount = records.filter(r => r.review && r.review.trim().length > 0).length;
  const highScoreCount = (summary?.distribution || []).filter(b => b.star >= 4).reduce((sum, b) => sum + b.count, 0)
    || records.filter(r => (r.rating || 0) >= 4).length;
  const criticalCount = (summary?.distribution || []).filter(b => b.star <= 2).reduce((sum, b) => sum + b.count, 0)
    || records.filter(r => (r.rating || 0) <= 2).length;
  const fiveStarCount = (summary?.distribution || []).find(b => b.star === 5)?.count
    ?? records.filter(r => Math.round(r.rating || 0) === 5).length;
  const positiveRate = totalRatings > 0 ? Math.round((highScoreCount / totalRatings) * 100) : 0;

  // Multi-criteria Filtering
  const filtered = useMemo(() => {
    let list = [...records];
    const term = searchTerm.trim().toLowerCase();

    if (term) {
      list = list.filter(item => {
        const partyName = mode === 'supplier'
          ? (item as SupplierRatingDto).buyer?.name || ''
          : (item as BuyerRatingDto).seller?.name || '';
        const haystack = [
          item.review || '',
          partyName,
          item.purchaseOrderId ? `po #${item.purchaseOrderId}` : '',
          item.purchaseOrderId ? String(item.purchaseOrderId) : ''
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    if (scoreFilter !== 'all') {
      if (scoreFilter === '5') {
        list = list.filter(r => Math.round(r.rating || 0) === 5);
      } else if (scoreFilter === '4+') {
        list = list.filter(r => (r.rating || 0) >= 4);
      } else if (scoreFilter === '3+') {
        list = list.filter(r => (r.rating || 0) >= 3);
      } else if (scoreFilter === 'critical') {
        list = list.filter(r => (r.rating || 0) <= 2);
      } else if (!Number.isNaN(Number(scoreFilter))) {
        list = list.filter(r => Math.round(r.rating || 0) === Number(scoreFilter));
      }
    }

    if (feedbackFilter === 'with_review') {
      list = list.filter(r => Boolean(r.review && r.review.trim().length > 0));
    } else if (feedbackFilter === 'rating_only') {
      list = list.filter(r => !r.review || r.review.trim().length === 0);
    }

    if (orderFilter === 'po_linked') {
      list = list.filter(r => Boolean(r.purchaseOrderId));
    } else if (orderFilter === 'direct') {
      list = list.filter(r => !r.purchaseOrderId);
    }

    if (dateFilter !== 'all') {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      list = list.filter(r => {
        if (!r.createdAt) return true;
        const time = new Date(r.createdAt).getTime();
        if (Number.isNaN(time)) return true;
        const ageDays = (now - time) / dayMs;
        if (dateFilter === '30_days') return ageDays <= 30;
        if (dateFilter === '90_days') return ageDays <= 90;
        if (dateFilter === 'this_year') return ageDays <= 365;
        return true;
      });
    }

    // Sort order
    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'rating_desc') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'rating_asc') {
        return (a.rating || 0) - (b.rating || 0);
      }
      return 0;
    });

    return list;
  }, [records, searchTerm, scoreFilter, feedbackFilter, orderFilter, dateFilter, sortBy, mode]);

  // Active filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (scoreFilter !== 'all') count++;
    if (feedbackFilter !== 'all') count++;
    if (orderFilter !== 'all') count++;
    if (dateFilter !== 'all') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [searchTerm, scoreFilter, feedbackFilter, orderFilter, dateFilter, sortBy]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setScoreFilter('all');
    setFeedbackFilter('all');
    setOrderFilter('all');
    setDateFilter('all');
    setSortBy('newest');
    setPage(1);
  };

  // Paged items from filtered list
  const pagedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="mx-auto max-w-[1560px] space-y-4 px-3 sm:px-4 pb-8 pt-3 sm:pt-4">
      {/* ── Header Section ── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f] mb-0.5">
            {mode === 'supplier' ? 'SUPPLIER REPUTATION & FEEDBACK' : 'BUYER PERFORMANCE PROFILE'}
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              {mode === 'supplier' ? 'Supplier Ratings' : 'Buyer Ratings'}
            </h1>
            {totalRatings > 0 && (
              <RatingPill average={averageRating} count={totalRatings} size="md" />
            )}
          </div>
          <p className="mt-0.5 text-xs font-semibold text-slate-500 max-w-2xl leading-relaxed">
            {mode === 'supplier'
              ? 'Quality compliance, delivery punctuality, and responsiveness feedback from fulfilled purchase orders.'
              : 'Payment timeliness and transaction communication ratings recorded by vendor partners.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            aria-label="Refresh ratings data"
            className="h-9 px-3.5 rounded-xl text-xs font-black uppercase shadow-xs bg-white text-slate-700 border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', query.isFetching && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Streamlined 4-Card KPI Grid ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          label="Overall Rating"
          value={totalRatings > 0 ? `${averageRating.toFixed(1)} / 5` : '0.0 / 5'}
          subtext={totalRatings > 0 ? `Across ${totalRatings} verified review${totalRatings === 1 ? '' : 's'}` : 'No verified ratings recorded'}
          icon={Star}
          tone="amber"
          active={scoreFilter === 'all' && feedbackFilter === 'all'}
          badge={totalRatings > 0 ? (averageRating >= 4.0 ? 'Top Rated' : averageRating >= 3.0 ? 'Active' : 'Needs Review') : undefined}
          badgeColor={averageRating >= 4.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}
          onClick={() => {
            setScoreFilter('all');
            setFeedbackFilter('all');
            setPage(1);
          }}
          loading={query.isLoading && !query.data}
          ariaLabel="Filter by all reviews"
        />

        <KpiCard
          label="Total Ratings"
          value={totalRatings}
          subtext={totalRatings > 0 ? `${writtenReviewCount} detailed feedback remarks` : '0 completed transactions rated'}
          icon={ThumbsUp}
          tone="blue"
          active={scoreFilter === 'all' && feedbackFilter === 'all'}
          onClick={() => {
            setScoreFilter('all');
            setFeedbackFilter('all');
            setPage(1);
          }}
          loading={query.isLoading && !query.data}
          ariaLabel="Show all transactions"
        />

        <KpiCard
          label="Positive Feedback (4★+)"
          value={totalRatings > 0 ? `${highScoreCount} (${positiveRate}%)` : '0 (0%)'}
          subtext="Ratings scored 4 or 5 stars"
          icon={TrendingUp}
          tone="emerald"
          active={scoreFilter === '4+'}
          onClick={() => {
            setScoreFilter(scoreFilter === '4+' ? 'all' : '4+');
            setPage(1);
          }}
          loading={query.isLoading && !query.data}
          ariaLabel="Filter by high score 4 stars and above"
        />

        <KpiCard
          label="Written Feedback"
          value={writtenReviewCount}
          subtext={totalRatings > 0 ? `${Math.round((writtenReviewCount / totalRatings) * 100)}% review comment coverage` : '0 reviews with text notes'}
          icon={MessageSquareText}
          tone="purple"
          active={feedbackFilter === 'with_review'}
          onClick={() => {
            setFeedbackFilter(feedbackFilter === 'with_review' ? 'all' : 'with_review');
            setPage(1);
          }}
          loading={query.isLoading && !query.data}
          ariaLabel="Filter by reviews with written text"
        />
      </div>

      {query.error && (
        <InlineError
          message={query.error instanceof Error ? query.error.message : 'Failed to load ratings'}
          onRetry={() => query.refetch()}
        />
      )}

      {/* ── Performance Breakdown Scorecard (Shown when ratings exist) ── */}
      {summary && totalRatings > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Left: Star Rating Distribution */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#12335f] flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  Star Distribution
                </h3>
                {scoreFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setScoreFilter('all');
                      setPage(1);
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Clear Star Filter
                  </button>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mb-3">
                Click any score bar to isolate reviews by star tier.
              </p>
              <RatingDistribution
                summary={summary}
                selectedStar={!Number.isNaN(Number(scoreFilter)) ? Number(scoreFilter) : null}
                onSelectStar={star => {
                  setScoreFilter(scoreFilter === String(star) ? 'all' : String(star));
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Right: Dimension Benchmarks */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-7 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#12335f] mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Performance Benchmarks
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mb-3.5">
                {mode === 'supplier'
                  ? 'Key competency evaluations scored by verified buyers upon order completion.'
                  : 'Commercial coordination and payment metrics submitted by suppliers.'}
              </p>
              <div className="space-y-3">
                {mode === 'supplier' ? (
                  <>
                    <BenchmarkProgress
                      label="Quality Compliance"
                      score={summary.averages?.quality ?? 0}
                      tone="blue"
                      hint="Specification conformance & acceptance"
                    />
                    <BenchmarkProgress
                      label="Delivery Timeliness"
                      score={summary.averages?.delivery ?? 0}
                      tone="purple"
                      hint="Adherence to dispatch schedules"
                    />
                    <BenchmarkProgress
                      label="Communication & Support"
                      score={summary.averages?.communication ?? 0}
                      tone="teal"
                      hint="Responsiveness and coordination"
                    />
                  </>
                ) : (
                  <>
                    <BenchmarkProgress
                      label="Payment Timeliness"
                      score={summary.averages?.paymentTimeliness ?? 0}
                      tone="green"
                      hint="Settlement within agreed credit term"
                    />
                    <BenchmarkProgress
                      label="Procurement Coordination"
                      score={summary.averages?.communication ?? 0}
                      tone="teal"
                      hint="Clarity on requirements and purchase process"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Enhanced Filter Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs space-y-2.5">
        <ResponsiveFilterBar
          activeFilterCount={activeFilterCount}
          searchInput={
            <div className="relative w-full">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder={
                  mode === 'supplier'
                    ? 'Search by buyer name, PO #, or review keyword...'
                    : 'Search by supplier name, PO #, or review keyword...'
                }
                aria-label="Search reviews and ratings"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setPage(1);
                  }}
                  aria-label="Clear search input"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          }
          filters={
            <>
              {/* Score Filter */}
              <div className="w-full sm:w-[145px]">
                <label htmlFor="score-filter-select" className="sr-only">
                  Score Filter
                </label>
                <select
                  id="score-filter-select"
                  value={scoreFilter}
                  onChange={e => {
                    setScoreFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by star score"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="all">Rating: All Stars</option>
                  <option value="5">5 Stars (Excellent)</option>
                  <option value="4+">4+ Stars (Good & Up)</option>
                  <option value="3+">3+ Stars (Average & Up)</option>
                  <option value="critical">1-2 Stars (Critical)</option>
                </select>
              </div>

              {/* Feedback Type Filter */}
              <div className="w-full sm:w-[155px]">
                <label htmlFor="feedback-filter-select" className="sr-only">
                  Feedback Type
                </label>
                <select
                  id="feedback-filter-select"
                  value={feedbackFilter}
                  onChange={e => {
                    setFeedbackFilter(e.target.value as any);
                    setPage(1);
                  }}
                  aria-label="Filter by review type"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="all">Feedback: All</option>
                  <option value="with_review">With Comments Only</option>
                  <option value="rating_only">Ratings Only</option>
                </select>
              </div>

              {/* Order Association */}
              <div className="w-full sm:w-[140px]">
                <label htmlFor="order-filter-select" className="sr-only">
                  Order Association
                </label>
                <select
                  id="order-filter-select"
                  value={orderFilter}
                  onChange={e => {
                    setOrderFilter(e.target.value as any);
                    setPage(1);
                  }}
                  aria-label="Filter by order connection"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="all">Order: All</option>
                  <option value="po_linked">Linked to PO</option>
                  <option value="direct">Direct Feedback</option>
                </select>
              </div>

              {/* Date Period */}
              <div className="w-full sm:w-[135px]">
                <label htmlFor="date-filter-select" className="sr-only">
                  Date Range
                </label>
                <select
                  id="date-filter-select"
                  value={dateFilter}
                  onChange={e => {
                    setDateFilter(e.target.value as any);
                    setPage(1);
                  }}
                  aria-label="Filter by date range"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="all">Period: All Time</option>
                  <option value="30_days">Past 30 Days</option>
                  <option value="90_days">Past 90 Days</option>
                  <option value="this_year">This Year</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="w-full sm:w-[145px]">
                <label htmlFor="sort-filter-select" className="sr-only">
                  Sort Order
                </label>
                <select
                  id="sort-filter-select"
                  value={sortBy}
                  onChange={e => {
                    setSortBy(e.target.value as any);
                    setPage(1);
                  }}
                  aria-label="Sort ratings"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="rating_desc">Highest Rating</option>
                  <option value="rating_asc">Lowest Rating</option>
                </select>
              </div>

              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleResetFilters}
                  className="h-10 px-3 text-xs font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl shrink-0 transition-colors"
                  aria-label="Reset all filters"
                >
                  Reset ({activeFilterCount})
                </Button>
              )}
            </>
          }
          viewToggle={
            <ViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              size="md"
            />
          }
        />

        {/* ── Quick Filter Chips ── */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" aria-hidden="true" /> Quick Filter:
          </span>

          <FilterChip
            label={`All (${records.length})`}
            active={scoreFilter === 'all' && feedbackFilter === 'all' && orderFilter === 'all'}
            onClick={() => {
              setScoreFilter('all');
              setFeedbackFilter('all');
              setOrderFilter('all');
              setPage(1);
            }}
          />

          <FilterChip
            label={`5 Stars (${fiveStarCount})`}
            active={scoreFilter === '5'}
            onClick={() => {
              setScoreFilter(scoreFilter === '5' ? 'all' : '5');
              setPage(1);
            }}
          />

          <FilterChip
            label={`4+ Stars (${highScoreCount})`}
            active={scoreFilter === '4+'}
            onClick={() => {
              setScoreFilter(scoreFilter === '4+' ? 'all' : '4+');
              setPage(1);
            }}
          />

          {criticalCount > 0 && (
            <FilterChip
              label={`Critical ≤2★ (${criticalCount})`}
              tone="red"
              active={scoreFilter === 'critical'}
              onClick={() => {
                setScoreFilter(scoreFilter === 'critical' ? 'all' : 'critical');
                setPage(1);
              }}
            />
          )}

          <FilterChip
            label={`With Comments (${writtenReviewCount})`}
            active={feedbackFilter === 'with_review'}
            onClick={() => {
              setFeedbackFilter(feedbackFilter === 'with_review' ? 'all' : 'with_review');
              setPage(1);
            }}
          />

          {orderFilter !== 'all' && (
            <FilterChip
              label={orderFilter === 'po_linked' ? 'PO Linked' : 'Direct Only'}
              active={true}
              onClear={() => {
                setOrderFilter('all');
                setPage(1);
              }}
              onClick={() => {
                setOrderFilter('all');
                setPage(1);
              }}
            />
          )}
        </div>
      </div>

      {/* ── Content View: Skeleton, Empty, Grid, or Table ── */}
      {query.isLoading && !query.data ? (
        <ListSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={records.length === 0 ? 'No ratings recorded yet' : 'No ratings match your filters'}
          description={
            records.length === 0
              ? 'Performance ratings and reviews will automatically appear here once purchase orders are fulfilled and reviewed.'
              : 'Try clearing your search query, adjusting star thresholds, or resetting your filter criteria.'
          }
          action={
            activeFilterCount > 0
              ? {
                  label: 'Clear All Filters',
                  onClick: handleResetFilters
                }
              : undefined
          }
        />
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <div className="flex flex-col space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {pagedRecords.map(item => {
              const partyName =
                mode === 'supplier'
                  ? (item as SupplierRatingDto).buyer?.name || `Buyer #${item.buyerId || '-'}`
                  : (item as BuyerRatingDto).seller?.name || `Seller #${item.sellerId || '-'}`;
              const initials = partyName
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'TX';

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:shadow-md hover:border-slate-300 flex flex-col justify-between gap-3.5"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-xs font-black text-[#12335f]">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-900 truncate" title={partyName}>
                          {partyName}
                        </h4>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
                          {item.purchaseOrderId ? (
                            <EntityIdLink
                              label={`PO #${item.purchaseOrderId}`}
                              to={`/purchase-orders?search=${item.purchaseOrderId}`}
                              size="sm"
                              className="text-[9.5px] font-bold"
                            />
                          ) : (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600">
                              Direct Rating
                            </span>
                          )}
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" aria-hidden="true" />
                            {item.createdAt ? formatDate(item.createdAt) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Star Rating Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StarRating value={item.rating} size="sm" readOnly />
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-[10px] font-black',
                          item.rating >= 4
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.rating >= 3
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                        )}
                      >
                        {item.rating?.toFixed(1) || '0.0'}
                      </span>
                    </div>
                  </div>

                  {/* Review Text Body */}
                  <div className="relative rounded-xl bg-slate-50/70 p-3 border-l-2 border-[#12335f]/40 min-h-[50px] flex items-center">
                    <Quote className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-300/80" aria-hidden="true" />
                    <p className="text-xs font-medium text-slate-700 italic pr-5 leading-relaxed">
                      {item.review ? `"${item.review}"` : 'No written remarks provided for this transaction.'}
                    </p>
                  </div>

                  {/* Dimension Scores Footer */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                    {mode === 'supplier' ? (
                      <>
                        <CompactScore
                          label="QUALITY"
                          value={(item as SupplierRatingDto).qualityScore}
                          tone="blue"
                        />
                        <CompactScore
                          label="DELIVERY"
                          value={(item as SupplierRatingDto).deliveryScore}
                          tone="purple"
                        />
                        <CompactScore
                          label="COMMUNICATION"
                          value={(item as SupplierRatingDto).communicationScore}
                          tone="teal"
                        />
                      </>
                    ) : (
                      <>
                        <CompactScore
                          label="PAYMENT"
                          value={(item as BuyerRatingDto).paymentTimelinessScore}
                          tone="green"
                        />
                        <CompactScore
                          label="COMMUNICATION"
                          value={(item as BuyerRatingDto).communicationScore}
                          tone="teal"
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="ratings"
          />
        </div>
      ) : (
        /* ── Table View ── */
        <div className="flex flex-col space-y-3">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-3.5 py-3">Date</th>
                  <th scope="col" className="px-3.5 py-3">{mode === 'supplier' ? 'Evaluated By' : 'Supplier'}</th>
                  <th scope="col" className="px-3.5 py-3">Order Ref</th>
                  <th scope="col" className="px-3.5 py-3">Rating</th>
                  <th scope="col" className="px-3.5 py-3">Evaluations</th>
                  <th scope="col" className="px-3.5 py-3">Written Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {pagedRecords.map(item => {
                  const partyName =
                    mode === 'supplier'
                      ? (item as SupplierRatingDto).buyer?.name || `Buyer #${item.buyerId || '-'}`
                      : (item as BuyerRatingDto).seller?.name || `Seller #${item.sellerId || '-'}`;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-3 whitespace-nowrap text-slate-600 font-semibold">
                        {item.createdAt ? formatDate(item.createdAt) : '—'}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-bold text-slate-900">
                        {partyName}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        {item.purchaseOrderId ? (
                          <EntityIdLink
                            label={`PO #${item.purchaseOrderId}`}
                            to={`/purchase-orders?search=${item.purchaseOrderId}`}
                            size="sm"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Direct</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <StarRating value={item.rating} size="sm" readOnly />
                          <span className="font-black text-slate-800 text-[11px]">{item.rating}/5</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {mode === 'supplier' ? (
                            <>
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-700">
                                Q: {(item as SupplierRatingDto).qualityScore || '-'}
                              </span>
                              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-black text-purple-700">
                                D: {(item as SupplierRatingDto).deliveryScore || '-'}
                              </span>
                              <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-black text-teal-700">
                                C: {(item as SupplierRatingDto).communicationScore || '-'}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
                                P: {(item as BuyerRatingDto).paymentTimelinessScore || '-'}
                              </span>
                              <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-black text-teal-700">
                                C: {(item as BuyerRatingDto).communicationScore || '-'}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 max-w-xs truncate">
                        {item.review ? (
                          <span className="italic">"{item.review}"</span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">No remarks</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="ratings"
          />
        </div>
      )}
    </div>
  );
}

// ── Auxiliary Subcomponents ──

function BenchmarkProgress({
  label,
  score,
  tone,
  hint
}: {
  label: string;
  score: number;
  tone: 'blue' | 'purple' | 'teal' | 'green';
  hint?: string;
}) {
  const pct = Math.min(100, Math.max(0, (score / 5) * 100));
  const toneMap = {
    blue: { bar: 'from-blue-500 to-indigo-600', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    purple: { bar: 'from-purple-500 to-violet-600', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    teal: { bar: 'from-teal-500 to-emerald-600', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
    green: { bar: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };
  const t = toneMap[tone] || toneMap.blue;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="min-w-0">
          <span className="font-bold text-slate-800">{label}</span>
          {hint && <span className="hidden sm:inline ml-2 text-[10px] text-slate-400 font-medium">({hint})</span>}
        </div>
        <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-black', t.badge)}>
          {score > 0 ? `${score.toFixed(1)} / 5` : '0.0 / 5'}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all duration-500', t.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  onClear,
  tone = 'default'
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onClear?: () => void;
  tone?: 'default' | 'red';
}) {
  const isRed = tone === 'red';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all duration-150',
        active
          ? isRed
            ? 'border-rose-300 bg-rose-50 text-rose-700 shadow-2xs ring-1 ring-rose-200'
            : 'border-[#12335f] bg-[#12335f] text-white shadow-2xs'
          : isRed
            ? 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      <span>{label}</span>
      {onClear && active && (
        <span
          role="button"
          tabIndex={0}
          onClick={e => {
            e.stopPropagation();
            onClear();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onClear();
            }
          }}
          className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
          aria-label="Remove filter"
        >
          <X className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
}

function CompactScore({
  label,
  value,
  tone
}: {
  label: string;
  value?: number | null;
  tone: 'blue' | 'purple' | 'teal' | 'green';
}) {
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
    <div className={cn('flex items-center gap-1.5 rounded-md border px-2 py-0.5', displayStyle)}>
      <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-80">{label}</span>
      <span className="text-[10px] font-black">{value ? `${value}/5` : '-'}</span>
    </div>
  );
}
