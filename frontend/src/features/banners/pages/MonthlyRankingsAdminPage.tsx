import { FormEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CalendarDays, Images, RefreshCw, ShieldCheck, Trophy, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDate } from '../../shared/format';
import { Pagination } from '../../shared/Pagination';
import { usePagination } from '../../shared/hooks';
import { KpiCard } from '../../shared/KpiCard';
import { bannerApi } from '../api';

const monthName = (month: number, year: number) =>
  new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const readable = (value?: string | null) =>
  String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

export default function MonthlyRankingsAdminPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [message, setMessage] = useState('');
  const grantFormRef = useRef<HTMLFormElement>(null);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['monthly-rankings', month, year],
    queryFn: () => bannerApi.rankings(month, year),
    staleTime: 20_000
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['monthly-rankings'] });

  const compute = useMutation({
    mutationFn: () => bannerApi.computeRankings(month, year),
    onSuccess: () => {
      setMessage(`Rankings computed for ${monthName(month, year)}.`);
      refresh();
    },
    onError: err => setMessage((err as Error).message)
  });

  const grant = useMutation({
    mutationFn: bannerApi.grant,
    onSuccess: (_data, variables: any) => {
      setMessage(`Eligibility granted for Organization #${variables.organizationId} in ${monthName(month, year)}.`);
      grantFormRef.current?.reset();
      refresh();
    },
    onError: err => setMessage((err as Error).message)
  });

  const revoke = useMutation({
    mutationFn: bannerApi.revoke,
    onSuccess: (_data, variables: any) => {
      setMessage(`Eligibility revoked for Organization #${variables.organizationId} in ${monthName(month, year)}.`);
      refresh();
    },
    onError: err => setMessage((err as Error).message)
  });

  const submitGrant = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    grant.mutate({
      organizationId: Number(form.get('organizationId')),
      month,
      year,
      eligibilityType: form.get('eligibilityType')
    });
  };

  const rankings = query.data?.rankings || [];
  const { page, pageSize, pageItems: pagedRankings, total, setPage, setPageSize } = usePagination(rankings, 10);
  const buyerCount = useMemo(() => rankings.filter((row: any) => row.organizationType === 'BUYER').length, [rankings]);
  const sellerCount = useMemo(() => rankings.filter((row: any) => row.organizationType === 'SELLER').length, [rankings]);

  if (query.isLoading) return <LoadingState label="Loading monthly rankings..." />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-2 md:flex-row md:items-end md:justify-between border-b border-slate-200">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Banner Eligibility</p>
          <h1 className="text-xl font-extrabold text-slate-950">Monthly Rankings</h1>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            Compute monthly buyer and seller rankings, then grant homepage banner eligibility.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/admin/banners">
            <Button variant="outline" size="sm" className="h-8 text-xs shadow-sm">
              <Images className="mr-1.5 h-3.5 w-3.5" />
              Banner Management
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="h-8 text-xs shadow-sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Selected Period" value={monthName(month, year)} icon={CalendarDays} tone="slate" />
        <KpiCard label="Ranked Organizations" value={rankings.length} icon={Trophy} tone="indigo" />
        <KpiCard label="Buyer Rankings" value={buyerCount} icon={BarChart3} tone="blue" />
        <KpiCard label="Seller Rankings" value={sellerCount} icon={BarChart3} tone="emerald" />
      </div>

      {/* Control Panels */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Period Computation Panel */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-blue-800 shrink-0">
              <CalendarDays className="h-4 w-4" />
              <div className="hidden sm:block">
                <span className="text-[10px] font-black uppercase tracking-wide block">Compute Period</span>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-8 w-full sm:max-w-[100px] rounded-md border border-blue-200 bg-white px-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20">
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}</option>
                ))}
              </select>
              <input value={year} onChange={e => setYear(Number(e.target.value))} type="number" min="2020" className="h-8 w-full sm:max-w-[80px] rounded-md border border-blue-200 bg-white px-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="flex shrink-0 gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <Button variant="outline" size="sm" onClick={() => setMessage('')} className="h-8 flex-1 sm:flex-none text-xs bg-white text-slate-600 border-blue-200 hover:bg-blue-50">
                Clear
              </Button>
              <Button size="sm" onClick={() => compute.mutate()} disabled={compute.isPending} className="h-8 flex-1 sm:flex-none text-xs bg-blue-600 text-white hover:bg-blue-700 shadow-sm">
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                {compute.isPending ? 'Computing...' : 'Compute'}
              </Button>
            </div>
          </div>
        </div>

        {/* Manual Grant Panel */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 shadow-sm">
          <form ref={grantFormRef} onSubmit={submitGrant} className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-emerald-800 shrink-0">
              <ShieldCheck className="h-4 w-4" />
              <div className="hidden sm:block">
                <span className="text-[10px] font-black uppercase tracking-wide block">Manual Grant</span>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <input name="organizationId" type="number" min="1" required placeholder="Org ID" className="h-8 w-full sm:max-w-[100px] rounded-md border border-emerald-200 bg-white px-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20" />
              <select name="eligibilityType" defaultValue="MANUAL" className="h-8 w-full sm:max-w-[110px] rounded-md border border-emerald-200 bg-white px-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20">
                <option value="MANUAL">Manual</option>
                <option value="TOP_BUYER">Top Buyer</option>
                <option value="TOP_SELLER">Top Seller</option>
              </select>
            </div>
            <div className="flex shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
              <Button size="sm" disabled={grant.isPending} className="h-8 w-full text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
                {grant.isPending ? 'Granting...' : 'Grant'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-[#12335f] shadow-sm animate-in fade-in">{message}</div>}
      {query.error && <InlineError message={(query.error as Error).message} onRetry={() => query.refetch()} />}

      {rankings.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center shadow-sm">
           <Trophy className="mx-auto h-8 w-8 text-slate-300" />
           <h3 className="mt-3 text-sm font-bold text-slate-900">No rankings available for this period</h3>
           <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">Click Compute to generate rankings for the selected month and year. You can still use Manual Grant if an organization needs immediate banner eligibility.</p>
        </div>
      ) : (
        <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Computed List</p>
                <h2 className="text-sm font-bold text-slate-950">{monthName(month, year)} Rankings</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table data-ux-wrapped="true" className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-white text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="p-3 pl-4">Rank</th>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Value</th>
                    <th className="p-3">Orders</th>
                    <th className="p-3">Computed</th>
                    <th className="p-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pagedRankings.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="p-3 pl-4 text-base font-black text-slate-700">#{row.rank}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">Organization #{row.organizationId}</p>
                        <p className="text-[11px] font-semibold text-slate-500">{readable(row.organizationType)} promotion candidate</p>
                      </td>
                      <td className="p-3 text-[11px] font-black uppercase tracking-wider text-slate-500">{row.organizationType}</td>
                      <td className="p-3 font-bold text-slate-800">{formatCurrency(row.organizationType === 'BUYER' ? row.totalPurchaseValue : row.totalSalesValue)}</td>
                      <td className="p-3 font-semibold text-slate-600">{row.orderCount}</td>
                      <td className="p-3 text-[11px] font-semibold text-slate-400">{formatDate(row.computedAt)}</td>
                      <td className="p-3 pr-4 text-right">
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={revoke.isPending}
                          className="h-8 px-2.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => revoke.mutate({ organizationId: row.organizationId, month, year, eligibilityType: row.organizationType === 'BUYER' ? 'TOP_BUYER' : 'TOP_SELLER' })}
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 bg-slate-50/50">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                label="rankings"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
