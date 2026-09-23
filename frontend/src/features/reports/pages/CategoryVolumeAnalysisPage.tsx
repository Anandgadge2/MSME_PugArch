/**
 * CategoryVolumeAnalysisPage — Category-wise Volume Count Analysis
 *
 * Dedicated Admin-Only Analytics Page:
 * - Route: /admin/analytics/category-volume
 * - Access: Strictly restricted to Admin role
 * - Authentic database data only (zero mock / seed fallback)
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  BarChart3, ListFilter, ArrowUpDown, ArrowUp, ArrowDown, 
  RefreshCw, Download, Layers, TrendingUp, IndianRupee, 
  Package, ShoppingCart, Award, Search, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { KpiCard } from '../../shared/KpiCard';
import { InlineError } from '../../shared/FeatureStates';
import { getApi } from '../../shared/apiClient';
import { downloadCsv } from '../../shared/exportUtils';

export interface CategoryVolumeItem {
  categoryId: number | null;
  category: string;
  transactionCount: number;
  totalAmount: number;
  percentageTransactions: number;
  percentageValue: number;
}

export interface CategoryVolumeSummary {
  totalCategories: number;
  totalCategoriesInSystem: number;
  totalTransactions: number;
  totalTransactionValue: number;
  averageTransactionValue: number;
  topCategory: string;
  highestTransactionVolume: number;
}

export interface CategoryVolumeResponse {
  summary: CategoryVolumeSummary;
  categories: CategoryVolumeItem[];
}

type SortField = 'transactionCount' | 'totalAmount' | 'category';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'graph';
type GraphMetric = 'count' | 'amount';

export const formatCompactInr = (amount: number): string => {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
};

export const formatInr = (amount: number): string => {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

// Custom X-Axis Tick with label truncation and native SVG <title> hover tooltip
const CategoryAxisTick = (props: any) => {
  const { x, y, payload } = props;
  if (!payload || payload.value === undefined) return null;
  const fullText = String(payload.value);
  const maxLength = 13;
  const isTruncated = fullText.length > maxLength;
  const displayText = isTruncated ? `${fullText.substring(0, maxLength)}…` : fullText;

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{fullText}</title>
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="end"
        fill="#475569"
        fontSize={11}
        fontWeight={600}
        transform="rotate(-38)"
        className="cursor-pointer transition-colors hover:fill-[#7c3aed] select-none"
      >
        {displayText}
      </text>
    </g>
  );
};

export default function CategoryVolumeAnalysisPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [graphMetric, setGraphMetric] = useState<GraphMetric>('count');
  const [sortField, setSortField] = useState<SortField>('transactionCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery<CategoryVolumeResponse>({
    queryKey: ['admin', 'reports', 'category-volume'] as const,
    queryFn: () => getApi<CategoryVolumeResponse>('/api/admin/reports/category-volume'),
    staleTime: 60_000,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'category' ? 'asc' : 'desc');
    }
  };

  // Filter and sort categories based on search and sort states
  const filteredAndSortedCategories = useMemo(() => {
    if (!data?.categories) return [];

    let list = [...data.categories];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(item => item.category.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (sortField === 'transactionCount') {
        comparison = a.transactionCount - b.transactionCount;
      } else if (sortField === 'totalAmount') {
        comparison = a.totalAmount - b.totalAmount;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return list;
  }, [data?.categories, searchTerm, sortField, sortOrder]);

  const handleExport = () => {
    if (!data?.categories || data.categories.length === 0) return;

    const rows = filteredAndSortedCategories.map((item, index) => ({
      Rank: index + 1,
      Category: item.category,
      'Transaction Count': item.transactionCount,
      'Total Amount (INR)': item.totalAmount,
      '% of Transactions': `${item.percentageTransactions}%`,
      '% of Value': `${item.percentageValue}%`,
    }));

    downloadCsv(`category_volume_analysis_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#12335f]/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#12335f]">
              Admin Analytics
            </span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-700">
              Live DB Records
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
            Category-wise Volume Count Analysis
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-600">
            Analyze purchase volume, transaction count, and transaction value across procurement categories.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
          {/* View Switcher */}
          <div 
            role="group" 
            aria-label="View Switcher"
            className="grid grid-cols-2 sm:flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-inner w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-black transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-[#12335f] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
              List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              aria-pressed={viewMode === 'graph'}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-black transition-all ${
                viewMode === 'graph'
                  ? 'bg-white text-[#12335f] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              Graph View
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!data || data.categories.length === 0}
              className="h-9 gap-1.5 border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 justify-center w-full sm:w-auto"
              aria-label="Export category volume analysis as CSV"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 gap-1.5 border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 justify-center w-full sm:w-auto"
              aria-label="Refresh analysis data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <InlineError message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-9 w-9 animate-spin text-[#12335f]" aria-hidden="true" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wider">Aggregating Procurement Records...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
            <KpiCard
              label="Total Categories"
              value={data.summary.totalCategories}
              subtext={`${data.summary.totalCategoriesInSystem} registered`}
              icon={Layers}
              tone="blue"
              hint="Active categories with recorded transactions"
            />
            <KpiCard
              label="Total Transactions"
              value={data.summary.totalTransactions}
              subtext="Procurement POs"
              icon={ShoppingCart}
              tone="sky"
              hint="Total procurement orders executed across categories"
            />
            <KpiCard
              label="Total Transaction Value"
              value={formatCompactInr(data.summary.totalTransactionValue)}
              subtext={formatInr(data.summary.totalTransactionValue)}
              icon={IndianRupee}
              tone="emerald"
              hint="Cumulative transaction monetary value"
            />
            <KpiCard
              label="Average Transaction Value"
              value={formatCompactInr(data.summary.averageTransactionValue)}
              subtext={formatInr(data.summary.averageTransactionValue)}
              icon={TrendingUp}
              tone="teal"
              hint="Mean monetary value per transaction"
            />
            <KpiCard
              label="Top Category"
              value={data.summary.topCategory}
              subtext="Highest monetary value"
              icon={Award}
              tone="amber"
              hint="Category contributing the largest procurement share"
            />
            <KpiCard
              label="Highest Volume"
              value={`${data.summary.highestTransactionVolume} txns`}
              subtext="Peak category volume"
              icon={Package}
              tone="purple"
              hint="Maximum transactions in any single category"
            />
          </div>

          {/* Search Bar & Stats Bar */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search categories (e.g. Electrical, IT)..."
                aria-label="Filter categories by name"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#12335f] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#12335f]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  aria-label="Clear category search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-500">
              Showing <strong className="text-slate-800">{filteredAndSortedCategories.length}</strong> of{' '}
              <strong className="text-slate-800">{data.categories.length}</strong> categories with activity
            </div>
          </div>

          {/* VIEW: LIST VIEW */}
          {viewMode === 'list' && (
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="sm:hidden px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Detailed table ({filteredAndSortedCategories.length} categories)</span>
                <span className="text-[#12335f] font-bold">↔ Swipe to view all</span>
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[580px] text-left text-xs" role="table">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-600">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-2 text-center w-12">#</th>
                      <th scope="col" className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleSort('category')}
                          className="flex items-center gap-1 font-black uppercase text-slate-700 hover:text-[#12335f]"
                        >
                          Category
                          {sortField === 'category' ? (
                            sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#12335f]" /> : <ArrowDown className="h-3 w-3 text-[#12335f]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th scope="col" className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSort('transactionCount')}
                          className="ml-auto flex items-center gap-1 font-black uppercase text-slate-700 hover:text-[#12335f]"
                        >
                          Transaction Count
                          {sortField === 'transactionCount' ? (
                            sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#12335f]" /> : <ArrowDown className="h-3 w-3 text-[#12335f]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th scope="col" className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSort('totalAmount')}
                          className="ml-auto flex items-center gap-1 font-black uppercase text-slate-700 hover:text-[#12335f]"
                        >
                          Total Amount
                          {sortField === 'totalAmount' ? (
                            sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#12335f]" /> : <ArrowDown className="h-3 w-3 text-[#12335f]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th scope="col" className="py-3.5 px-3 text-right w-36">% of Transactions</th>
                      <th scope="col" className="py-3.5 pr-4 pl-3 text-right w-36">% of Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredAndSortedCategories.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                          No category records match your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAndSortedCategories.map((item, index) => (
                        <tr 
                          key={item.category} 
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3 pl-4 pr-2 text-center font-bold text-slate-400 text-[11px]">
                            {index + 1}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{item.category}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-black text-slate-900">
                            <span className="inline-flex items-center justify-center rounded-md bg-blue-50 px-2 py-0.5 font-bold text-[#12335f]">
                              {item.transactionCount}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-black text-slate-900">
                            {formatInr(item.totalAmount)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                                <div 
                                  className="h-full bg-[#12335f] rounded-full" 
                                  style={{ width: `${Math.min(100, item.percentageTransactions)}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-700 w-12 text-right">
                                {item.percentageTransactions.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 pl-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                                <div 
                                  className="h-full bg-emerald-600 rounded-full" 
                                  style={{ width: `${Math.min(100, item.percentageValue)}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-700 w-12 text-right">
                                {item.percentageValue.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredAndSortedCategories.length > 0 && (
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-black text-slate-900 text-xs">
                      <tr>
                        <td className="py-3 pl-4 pr-2 text-center">Σ</td>
                        <td className="py-3 px-3">Total ({filteredAndSortedCategories.length} Categories)</td>
                        <td className="py-3 px-3 text-right text-[#12335f]">
                          {filteredAndSortedCategories.reduce((sum, c) => sum + c.transactionCount, 0)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-800">
                          {formatInr(filteredAndSortedCategories.reduce((sum, c) => sum + c.totalAmount, 0))}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {filteredAndSortedCategories.reduce((sum, c) => sum + c.percentageTransactions, 0).toFixed(1)}%
                        </td>
                        <td className="py-3 pr-4 pl-3 text-right">
                          {filteredAndSortedCategories.reduce((sum, c) => sum + c.percentageValue, 0).toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          )}

          {/* VIEW: GRAPH VIEW */}
          {viewMode === 'graph' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Rounded Analytics Card matching Image 2 */}
              <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3.5 sm:p-6 lg:p-7 shadow-sm">
                <div className="flex flex-col gap-3 pb-4 sm:pb-6 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: 3-bar icon and title */}
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
                      <span className="w-1.5 h-3 bg-[#a78bfa] rounded-full inline-block" />
                      <span className="w-1.5 h-5 bg-[#7c3aed] rounded-full inline-block" />
                      <span className="w-1.5 h-4 bg-[#c4b5fd] rounded-full inline-block" />
                    </div>
                    <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 truncate">
                      CATEGORY-WISE PURCHASE VOLUME
                    </h2>
                  </div>

                  {/* Right: Metric Toggle (full width on small mobile, compact on tablet/desktop) */}
                  <div 
                    role="group" 
                    aria-label="Chart Metric Selection"
                    className="grid grid-cols-2 sm:flex items-center rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 w-full sm:w-auto"
                  >
                    <button
                      type="button"
                      onClick={() => setGraphMetric('count')}
                      aria-pressed={graphMetric === 'count'}
                      className={`rounded-lg px-2.5 sm:px-3.5 py-1.5 text-xs font-bold transition-all text-center ${
                        graphMetric === 'count'
                          ? 'bg-[#1e1b4b] text-white shadow-sm font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Transaction Count
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphMetric('amount')}
                      aria-pressed={graphMetric === 'amount'}
                      className={`rounded-lg px-2.5 sm:px-3.5 py-1.5 text-xs font-bold transition-all text-center ${
                        graphMetric === 'amount'
                          ? 'bg-[#7c3aed] text-white shadow-sm font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Transaction Amount
                    </button>
                  </div>
                </div>

                <div className="sm:hidden flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 font-medium">
                  <span>{filteredAndSortedCategories.length} Categories plotted</span>
                  <span className="font-bold text-[#7c3aed]">↔ Swipe horizontally to explore</span>
                </div>

                {/* Chart Area with responsive horizontal scroll wrapper for mobile */}
                <div className="overflow-x-auto scrollbar-thin mt-2 pb-2 -mx-1 px-1">
                  <div 
                    style={{ minWidth: `${Math.max(600, filteredAndSortedCategories.length * 56)}px` }}
                    className="sm:!min-w-full h-[360px] sm:h-[430px] w-full"
                  >
                    {filteredAndSortedCategories.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                        No procurement records available to chart.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={filteredAndSortedCategories}
                          margin={{ top: 38, right: 30, left: 24, bottom: 95 }}
                        >
                          <defs>
                            <linearGradient id="purpleGradientFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.22} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="category"
                            tick={<CategoryAxisTick />}
                            interval={0}
                            height={95}
                            axisLine={{ stroke: '#f1f5f9' }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }}
                            tickFormatter={val => (graphMetric === 'count' ? String(val) : formatCompactInr(Number(val)))}
                            domain={[0, (dataMax: number) => (graphMetric === 'count' ? Math.max(5, Math.ceil(dataMax * 1.35)) : Math.ceil(dataMax * 1.3))]}
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                          />
                          <RechartsTooltip
                            cursor={{ stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const item = payload[0].payload as CategoryVolumeItem;
                              return (
                                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl text-xs space-y-1">
                                  <p className="font-black text-slate-900 text-sm border-b border-slate-100 pb-1">
                                    {item.category}
                                  </p>
                                  <div className="flex justify-between gap-4 pt-1">
                                    <span className="text-slate-500 font-semibold">Transactions:</span>
                                    <span className="font-black text-[#7c3aed]">
                                      {item.transactionCount} ({item.percentageTransactions.toFixed(1)}%)
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-500 font-semibold">Total Amount:</span>
                                    <span className="font-black text-emerald-700">
                                      {formatInr(item.totalAmount)} ({item.percentageValue.toFixed(1)}%)
                                    </span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey={graphMetric === 'count' ? 'transactionCount' : 'totalAmount'}
                            stroke="#7c3aed"
                            strokeWidth={3}
                            fill="url(#purpleGradientFill)"
                            dot={(dotProps: any) => {
                              const { cx, cy, value, index } = dotProps;
                              if (cx === undefined || cy === undefined || value === undefined || value === null) return null;
                              const rawValue = Array.isArray(value) ? value[1] : value;
                              const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0;
                              const displayVal = graphMetric === 'count' ? String(numericValue) : formatCompactInr(numericValue);
                              const pillWidth = Math.max(26, displayVal.length * 8 + 12);
                              const pillHeight = 22;
                              const rectX = cx - pillWidth / 2;
                              const rectY = cy - 28;

                              return (
                                <g key={`custom-dot-badge-${index}`}>
                                  {/* Floating Badge Pill matching Image 2 */}
                                  <rect
                                    x={rectX}
                                    y={rectY}
                                    width={pillWidth}
                                    height={pillHeight}
                                    rx={6}
                                    fill="#f1f5f9"
                                    stroke="#e2e8f0"
                                    strokeWidth={1}
                                  />
                                  <text
                                    x={cx}
                                    y={rectY + 15}
                                    textAnchor="middle"
                                    fill="#1e293b"
                                    fontSize={11}
                                    fontWeight={800}
                                    fontFamily="inherit"
                                  >
                                    {displayVal}
                                  </text>
                                  {/* Purple Point Dot */}
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4.5}
                                    fill="#7c3aed"
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                  />
                                </g>
                              );
                            }}
                            activeDot={{
                              r: 6.5,
                              fill: '#6d28d9',
                              stroke: '#ffffff',
                              strokeWidth: 2
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
