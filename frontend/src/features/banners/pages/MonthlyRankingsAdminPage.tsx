import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  Images,
  RefreshCw,
  ShieldCheck,
  Trophy,
  XCircle,
  Search,
  Users2,
  Store,
  Building2,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Check
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency } from '../../shared/format';
import { Pagination } from '../../shared/Pagination';
import { usePagination } from '../../shared/hooks';
import { KpiCard } from '../../shared/KpiCard';
import { bannerApi } from '../api';

const monthName = (month: number, year: number) =>
  new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

type CategoryFilter = 'ALL' | 'BUYER' | 'SELLER' | 'SHG';

export default function MonthlyRankingsAdminPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [message, setMessage] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Manual Grant Form state
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedEligibilityType, setSelectedEligibilityType] = useState<string>('MANUAL');

  const qc = useQueryClient();

  // Load monthly rankings
  const query = useQuery({
    queryKey: ['monthly-rankings', month, year],
    queryFn: () => bannerApi.rankings(month, year),
    staleTime: 20_000
  });

  // Load full organizations list for searchable combobox
  const orgsQuery = useQuery({
    queryKey: ['admin-organizations-lookup'],
    queryFn: bannerApi.organizations,
    staleTime: 60_000
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['monthly-rankings'] });
    qc.invalidateQueries({ queryKey: ['admin-organizations-lookup'] });
  };

  const compute = useMutation({
    mutationFn: () => bannerApi.computeRankings(month, year),
    onSuccess: (data: any) => {
      const bCount = data?.buyers?.length ?? 0;
      const sCount = data?.sellers?.length ?? 0;
      const shgCount = data?.shgs?.length ?? 0;
      setMessage(`Rankings successfully computed for ${monthName(month, year)}: ${bCount} Buyers, ${sCount} Sellers, and ${shgCount} SHGs ranked. Top 3 in each category granted banner eligibility.`);
      refresh();
    },
    onError: err => setMessage((err as Error).message)
  });

  const grant = useMutation({
    mutationFn: bannerApi.grant,
    onSuccess: (_data, variables: any) => {
      const orgName = (orgsQuery.data?.organizations || []).find((o: any) => o.id === variables.organizationId)?.organizationName || `Organization #${variables.organizationId}`;
      setMessage(`Homepage banner eligibility successfully granted to "${orgName}" for ${monthName(month, year)}.`);
      setSelectedOrgId(null);
      refresh();
    },
    onError: err => setMessage((err as Error).message)
  });

  const revoke = useMutation({
    mutationFn: bannerApi.revoke,
    onSuccess: (_data, variables: any) => {
      const orgName = (orgsQuery.data?.organizations || []).find((o: any) => o.id === variables.organizationId)?.organizationName || `Organization #${variables.organizationId}`;
      setMessage(`Banner eligibility revoked for "${orgName}".`);
      refresh();
    },
    onError: err => setMessage((err as Error).message)
  });

  const submitGrant = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrgId) {
      setMessage('Please select an organization from the searchable dropdown before granting eligibility.');
      return;
    }
    grant.mutate({
      organizationId: selectedOrgId,
      month,
      year,
      eligibilityType: selectedEligibilityType
    });
  };

  // Convert organization records into options for the SearchableSelect
  const orgOptions = useMemo(() => {
    const list = orgsQuery.data?.organizations || [];
    return list.map((o: any) => {
      const typeLabel = o.organizationType === 'SHG' || o.isShg ? 'SHG' : o.organizationType || 'ORG';
      const loc = o.district ? ` • ${o.district}` : '';
      return {
        value: o.id,
        label: `${o.organizationName} (${typeLabel}${loc})`
      };
    });
  }, [orgsQuery.data]);

  const rawRankings = query.data?.rankings || [];

  // Filter rankings by category and search text
  const filteredRankings = useMemo(() => {
    return rawRankings.filter((row: any) => {
      // Category check
      if (categoryFilter !== 'ALL') {
        if (row.organizationType !== categoryFilter) return false;
      }
      // Text search check
      if (searchFilter.trim()) {
        const queryText = searchFilter.toLowerCase().trim();
        const orgName = String(row.organization?.organizationName || '').toLowerCase();
        const district = String(row.organization?.district || '').toLowerCase();
        const orgType = String(row.organizationType || '').toLowerCase();
        const idStr = String(row.organizationId);
        if (!orgName.includes(queryText) && !district.includes(queryText) && !orgType.includes(queryText) && !idStr.includes(queryText)) {
          return false;
        }
      }
      return true;
    });
  }, [rawRankings, categoryFilter, searchFilter]);

  const { page, pageSize, pageItems: pagedRankings, total, setPage, setPageSize } = usePagination(filteredRankings, 10);

  // Statistics
  const buyerCount = useMemo(() => rawRankings.filter((row: any) => row.organizationType === 'BUYER').length, [rawRankings]);
  const sellerCount = useMemo(() => rawRankings.filter((row: any) => row.organizationType === 'SELLER').length, [rawRankings]);
  const shgCount = useMemo(() => rawRankings.filter((row: any) => row.organizationType === 'SHG').length, [rawRankings]);

  if (query.isLoading) return <LoadingState label="Loading authentic monthly rankings..." />;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-3 md:flex-row md:items-end md:justify-between border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            
          </div>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Monthly Performance Rankings
          </h1>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600 sm:text-sm max-w-3xl">
            Audit and compute monthly volume rankings for Buyers, Sellers, and Self-Help Groups (SHGs). 
            Top 3 performers in each category automatically earn high-visibility promotional banner slots on the homepage hero carousel.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/admin/banners">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs font-bold shadow-sm border-slate-300 text-slate-700 hover:bg-slate-50">
              <Images className="mr-1.5 h-3.5 w-3.5 text-[#12335f]" />
              Banner Management
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-bold shadow-sm border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() => refresh()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Selected Period"
          value={monthName(month, year)}
          icon={CalendarDays}
          tone="slate"
        />
        <KpiCard
          label="Total Ranked"
          value={rawRankings.length}
          icon={Trophy}
          tone="indigo"
        />
        <KpiCard
          label="Buyer Rankings"
          value={buyerCount}
          icon={Building2}
          tone="blue"
        />
        <KpiCard
          label="Seller Rankings"
          value={sellerCount}
          icon={Store}
          tone="emerald"
        />
        <KpiCard
          label="SHG Rankings"
          value={shgCount}
          icon={Users2}
          tone="indigo"
        />
      </div>

      {/* Control Panels */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Period Computation Panel */}
        <div className="lg:col-span-5 rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 p-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-blue-100/80">
            <div className="flex items-center gap-2 text-[#12335f]">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#12335f] text-white">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Compute Rankings</h3>
                <p className="text-[11px] font-semibold text-slate-500">Calculate authentic settled transaction totals</p>
              </div>
            </div>
            <span className="rounded-md bg-blue-100/60 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              Audit Scoped
            </span>
          </div>

          <div className="mt-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="compute-month-select" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Month
                </label>
                <select
                  id="compute-month-select"
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/15"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="compute-year-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Year
                </label>
                <input
                  id="compute-year-input"
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  type="number"
                  min="2020"
                  max="2100"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/15"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage('')}
                className="h-9 flex-1 text-xs font-bold bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                Clear Message
              </Button>
              <Button
                size="sm"
                onClick={() => compute.mutate()}
                disabled={compute.isPending}
                className="h-9 flex-1 text-xs font-bold bg-[#12335f] text-white hover:bg-[#0b2445] shadow-sm"
              >
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                {compute.isPending ? 'Computing...' : 'Compute Month'}
              </Button>
            </div>
          </div>
        </div>

        {/* Manual Grant Panel with Searchable Dropdown */}
        <div className="lg:col-span-7 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 p-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-100/80">
            <div className="flex items-center gap-2 text-emerald-900">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Manual Banner Grant</h3>
                <p className="text-[11px] font-semibold text-slate-500">Grant homepage banner upload eligibility by name</p>
              </div>
            </div>
            <span className="rounded-md bg-emerald-100/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Admin Override
            </span>
          </div>

          <form onSubmit={submitGrant} className="mt-3.5 space-y-3">
            <div className="grid sm:grid-cols-12 gap-2.5 items-start">
              <div className="sm:col-span-7">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Select Organization *
                </label>
                <SearchableSelect
                  options={orgOptions}
                  value={selectedOrgId}
                  onChange={val => setSelectedOrgId(val ? Number(val) : null)}
                  placeholder="Search organization by name or district..."
                  className="w-full"
                />
              </div>
              <div className="sm:col-span-5">
                <label htmlFor="grant-eligibility-type" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Eligibility Type
                </label>
                <select
                  id="grant-eligibility-type"
                  value={selectedEligibilityType}
                  onChange={e => setSelectedEligibilityType(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                >
                  <option value="MANUAL">Manual Grant</option>
                  <option value="TOP_BUYER">Top Buyer</option>
                  <option value="TOP_SELLER">Top Seller</option>
                  <option value="TOP_SHG">Top SHG (Self-Help Group)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Grants 15-day promotional banner upload rights for {monthName(month, year)}.
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={grant.isPending || !selectedOrgId}
                className="h-9 px-4 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {grant.isPending ? 'Granting...' : 'Grant Banner Slot'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Notification Toast / Alert */}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-xs font-bold text-[#12335f] shadow-sm animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage('')}
            className="text-blue-500 hover:text-blue-800 font-extrabold text-sm ml-3"
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      {query.error && <InlineError message={(query.error as Error).message} onRetry={() => query.refetch()} />}

      {/* Rankings List Card */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          {/* List Header & Filters */}
          <div className="border-b border-slate-200 bg-slate-50/60 p-4 sm:flex sm:items-center sm:justify-between gap-4 space-y-3 sm:space-y-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Performance Ledger
                </span>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-black text-slate-700">
                  {filteredRankings.length} results
                </span>
              </div>
              <h2 className="mt-0.5 text-base font-extrabold text-slate-950">
                {monthName(month, year)} Rankings
              </h2>
            </div>

            {/* Category Tabs & Quick Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Category Filter Tabs */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`rounded-md px-2.5 py-1 transition-colors ${categoryFilter === 'ALL' ? 'bg-[#12335f] text-white shadow-xs' : 'hover:bg-slate-50'}`}
                >
                  All ({rawRankings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('BUYER')}
                  className={`rounded-md px-2.5 py-1 transition-colors ${categoryFilter === 'BUYER' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-50'}`}
                >
                  Buyers ({buyerCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('SELLER')}
                  className={`rounded-md px-2.5 py-1 transition-colors ${categoryFilter === 'SELLER' ? 'bg-emerald-600 text-white shadow-xs' : 'hover:bg-slate-50'}`}
                >
                  Sellers ({sellerCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('SHG')}
                  className={`rounded-md px-2.5 py-1 transition-colors ${categoryFilter === 'SHG' ? 'bg-purple-600 text-white shadow-xs' : 'hover:bg-slate-50'}`}
                >
                  SHGs ({shgCount})
                </button>
              </div>

              {/* Text Search Input */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by name, district..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-[#12335f] focus:outline-none focus:ring-1 focus:ring-[#12335f]/15"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table / Empty State */}
          {filteredRankings.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                {rawRankings.length === 0
                  ? 'No rankings computed for this month yet'
                  : 'No organizations match your selected filters'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                {rawRankings.length === 0
                  ? 'Click "Compute Month" to calculate authentic settled transaction totals from PostgreSQL database records.'
                  : 'Try selecting a different category tab or clearing your search term.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table data-ux-wrapped="true" className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3 pl-4">Rank</th>
                    <th className="p-3">Organization Details</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Total Volume</th>
                    <th className="p-3">Orders</th>
                    <th className="p-3">Homepage Banner Status</th>
                    <th className="p-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pagedRankings.map((row: any) => {
                    const org = row.organization;
                    const orgName = org?.organizationName || `Organization #${row.organizationId}`;
                    const district = org?.district || 'Jharsuguda';
                    const state = org?.state || 'Odisha';
                    const isVerified = org?.verificationStatus === 'VERIFIED';
                    const isTop3 = row.rank <= 3;
                    const eligibility = row.eligibility;
                    const isEligible = Boolean(eligibility?.isEligible);
                    const banner = row.banner;

                    // Rank Medal Badge Styling
                    let rankBadge = (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
                        #{row.rank}
                      </span>
                    );
                    if (row.rank === 1) {
                      rankBadge = (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-gradient-to-r from-amber-100 to-amber-50 px-2 py-1 text-xs font-black text-amber-900 shadow-xs">
                          <Trophy className="h-3.5 w-3.5 text-amber-600" />
                          #1 Gold
                        </span>
                      );
                    } else if (row.rank === 2) {
                      rankBadge = (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-gradient-to-r from-slate-200 to-slate-100 px-2 py-1 text-xs font-black text-slate-800 shadow-xs">
                          <Trophy className="h-3.5 w-3.5 text-slate-500" />
                          #2 Silver
                        </span>
                      );
                    } else if (row.rank === 3) {
                      rankBadge = (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-600/30 bg-gradient-to-r from-amber-600/15 to-amber-600/5 px-2 py-1 text-xs font-black text-amber-800 shadow-xs">
                          <Trophy className="h-3.5 w-3.5 text-amber-700" />
                          #3 Bronze
                        </span>
                      );
                    }

                    // Category Pill
                    let catPill = (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700">
                        {row.organizationType}
                      </span>
                    );
                    if (row.organizationType === 'BUYER') {
                      catPill = (
                        <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                          <Building2 className="h-3 w-3" />
                          Buyer
                        </span>
                      );
                    } else if (row.organizationType === 'SELLER') {
                      catPill = (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                          <Store className="h-3 w-3" />
                          Seller / MSME
                        </span>
                      );
                    } else if (row.organizationType === 'SHG') {
                      catPill = (
                        <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-700">
                          <Users2 className="h-3 w-3" />
                          Self-Help Group (SHG)
                        </span>
                      );
                    }

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Rank */}
                        <td className="p-3.5 pl-4 whitespace-nowrap">
                          {rankBadge}
                        </td>

                        {/* Organization Details */}
                        <td className="p-3.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-slate-950 text-sm">{orgName}</p>
                              {isVerified && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">
                                  <Check className="h-2.5 w-2.5" />
                                  Verified
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] font-semibold text-slate-500">
                              <span>📍 {district}, {state}</span>
                              {org?.udyamNumber && <span>• Udyam: {org.udyamNumber}</span>}
                              {org?.gstin && <span>• GST: {org.gstin}</span>}
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="p-3.5 whitespace-nowrap">
                          {catPill}
                        </td>

                        {/* Total Value */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="font-black text-slate-900 text-sm">
                            {formatCurrency(row.organizationType === 'BUYER' ? row.totalPurchaseValue : row.totalSalesValue)}
                          </span>
                          <span className="block text-[10px] font-semibold text-slate-400">
                            Settled Turnover
                          </span>
                        </td>

                        {/* Orders */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">
                            {row.orderCount} {row.orderCount === 1 ? 'order' : 'orders'}
                          </span>
                        </td>

                        {/* Banner Promotion Status */}
                        <td className="p-3.5">
                          {banner?.status === 'ACTIVE' || banner?.isActive ? (
                            <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Live on Homepage</span>
                            </div>
                          ) : banner?.status === 'PENDING_APPROVAL' ? (
                            <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span>Banner Pending Approval</span>
                            </div>
                          ) : isEligible ? (
                            <div className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
                              <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                              <span>Eligible (Slot Unlocked)</span>
                            </div>
                          ) : isTop3 ? (
                            <span className="text-[11px] font-semibold text-slate-400">Top 3 candidate</span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">Not eligible</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {banner?.status === 'PENDING_APPROVAL' && (
                              <Link href="/admin/banners">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] font-bold border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                >
                                  <ArrowUpRight className="mr-1 h-3 w-3" />
                                  Review Banner
                                </Button>
                              </Link>
                            )}

                            {isEligible ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={revoke.isPending}
                                className="h-7 px-2 text-[11px] font-bold border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                                onClick={() =>
                                  revoke.mutate({
                                    organizationId: row.organizationId,
                                    month,
                                    year,
                                    eligibilityType:
                                      eligibility?.eligibilityType ||
                                      (row.organizationType === 'BUYER' ? 'TOP_BUYER' : row.organizationType === 'SHG' ? 'TOP_SHG' : 'TOP_SELLER')
                                  })
                                }
                              >
                                <XCircle className="mr-1 h-3 w-3 text-red-500" />
                                Revoke Slot
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={grant.isPending}
                                className="h-7 px-2 text-[11px] font-bold border-slate-200 text-slate-700 hover:bg-slate-100"
                                onClick={() =>
                                  grant.mutate({
                                    organizationId: row.organizationId,
                                    month,
                                    year,
                                    eligibilityType:
                                      row.organizationType === 'BUYER'
                                        ? 'TOP_BUYER'
                                        : row.organizationType === 'SHG'
                                        ? 'TOP_SHG'
                                        : 'TOP_SELLER'
                                  })
                                }
                              >
                                <Sparkles className="mr-1 h-3 w-3 text-emerald-600" />
                                Grant Banner
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredRankings.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50/50 p-2">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                label="rankings"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

