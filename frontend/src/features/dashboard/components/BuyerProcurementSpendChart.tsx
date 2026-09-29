'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  BarChart2, 
  PieChart as PieChartIcon, 
  Layers, 
  IndianRupee, 
  ShieldCheck, 
  ArrowUpRight,
  Sparkles,
  Info,
  GitCommit,
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card, CardContent } from '../../../components/ui/card';

interface SpendTrendItem {
  key: string;
  month: string;
  totalSpend: number;
  msmeSpend: number;
  ordersCount: number;
}

interface MethodItem {
  name: string;
  count: number;
  color: string;
}

interface FunnelItem {
  stage: string;
  count: number;
  color: string;
  description: string;
}

interface CategoryItem {
  name: string;
  spend: number;
  count: number;
  color: string;
}

interface BuyerProcurementSpendChartProps {
  spendTrend?: SpendTrendItem[];
  methodDistribution?: MethodItem[];
  procurementFunnel?: FunnelItem[];
  categoryDistribution?: CategoryItem[];
  compliance?: {
    totalSpend?: number;
    msmeSpend?: number;
    activeOrdersCount?: number;
    msmeSharePercent?: number;
  };
  isLoading?: boolean;
  granularity?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  onGranularityChange?: (g: 'daily' | 'weekly' | 'monthly' | 'quarterly') => void;
}

const formatCurrency = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} Lakh`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  return `₹${val.toLocaleString('en-IN')}`;
};

const getTimeframeMeta = (g: string) => {
  switch (g) {
    case 'daily':
      return {
        titlePrefix: 'Daily',
        subtitle: 'Daily spend velocity, lifecycle pipeline funnel, and method mix',
        allocationLabel: 'Daily Allocation Velocity',
        orderSubtitle: 'today'
      };
    case 'weekly':
      return {
        titlePrefix: '7-Day',
        subtitle: '7-day rolling spend trajectory, lifecycle pipeline funnel, and method mix',
        allocationLabel: 'Weekly Allocation Trajectory',
        orderSubtitle: 'in past 7 days'
      };
    case 'quarterly':
      return {
        titlePrefix: '90-Day',
        subtitle: '90-day fiscal spend trajectory, lifecycle pipeline funnel, and method mix',
        allocationLabel: 'Quarterly Fiscal Allocation',
        orderSubtitle: 'in past 90 days'
      };
    default:
      return {
        titlePrefix: '30-Day',
        subtitle: '30-day spend trajectory, lifecycle pipeline funnel, and method mix',
        allocationLabel: 'Monthly Allocation Trajectory',
        orderSubtitle: 'in past 30 days'
      };
  }
};

export function BuyerProcurementSpendChart({
  spendTrend = [],
  methodDistribution = [],
  procurementFunnel = [],
  categoryDistribution = [],
  compliance,
  isLoading = false,
  granularity = 'monthly',
  onGranularityChange
}: BuyerProcurementSpendChartProps) {
  const [activeView, setActiveView] = useState<'trend' | 'funnel' | 'methods' | 'categories'>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const viewParam = sp.get('chartView');
      if (viewParam && ['trend', 'funnel', 'methods', 'categories'].includes(viewParam)) {
        return viewParam as 'trend' | 'funnel' | 'methods' | 'categories';
      }
      const saved = sessionStorage.getItem('dashboard_buyer_chart_view');
      if (saved && ['trend', 'funnel', 'methods', 'categories'].includes(saved)) {
        return saved as 'trend' | 'funnel' | 'methods' | 'categories';
      }
    }
    return 'trend';
  });

  const handleViewChange = useCallback((newView: 'trend' | 'funnel' | 'methods' | 'categories') => {
    setActiveView(newView);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dashboard_buyer_chart_view', newView);
      const url = new URL(window.location.href);
      url.searchParams.set('chartView', newView);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const viewParam = sp.get('chartView');
      if (viewParam && ['trend', 'funnel', 'methods', 'categories'].includes(viewParam)) {
        setActiveView(viewParam as 'trend' | 'funnel' | 'methods' | 'categories');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const timeframeMeta = useMemo(() => getTimeframeMeta(granularity), [granularity]);
  const [trendMode, setTrendMode] = useState<'bar' | 'line'>('bar');

  const totalPeriodSpend = compliance?.totalSpend ?? spendTrend.reduce((sum, item) => sum + (item.totalSpend || 0), 0);
  const totalPeriodMseSpend = compliance?.msmeSpend ?? spendTrend.reduce((sum, item) => sum + (item.msmeSpend || 0), 0);
  const totalPeriodOrders = compliance?.activeOrdersCount ?? spendTrend.reduce((sum, item) => sum + (item.ordersCount || 0), 0);
  const mseShareOverall = compliance?.msmeSharePercent ?? (totalPeriodSpend > 0 
    ? Number(((totalPeriodMseSpend / totalPeriodSpend) * 100).toFixed(1)) 
    : 0);

  const totalMethodsCount = methodDistribution.reduce((sum, m) => sum + (m.count || 0), 0);
  const totalFunnelActions = procurementFunnel.reduce((sum, f) => sum + (f.count || 0), 0);
  const totalCategorySpend = categoryDistribution.reduce((sum, c) => sum + (c.spend || 0), 0);

  return (
    <Card className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#12335f]/10 text-[#12335f] flex items-center justify-center font-bold">
            <BarChart2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Procurement Velocity & Spend Analytics
            </h3>
            <p className="text-[10px] font-medium text-slate-500">
              {timeframeMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Granularity & View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity Selector */}
          <div className="flex items-center gap-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/70" role="tablist" aria-label="Timeframe Granularity">
            {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={granularity === g}
                onClick={() => onGranularityChange?.(g)}
                className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md transition ${
                  granularity === g
                    ? 'bg-[#12335f] text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                }`}
              >
                {g === 'daily' ? 'Daily' : g === 'weekly' ? 'Weekly' : g === 'monthly' ? 'Monthly' : 'Quarterly'}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* View Switcher Tabs */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs" role="tablist" aria-label="Procurement View Selector">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'trend'}
              onClick={() => handleViewChange('trend')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition ${
                activeView === 'trend'
                  ? 'bg-[#12335f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              Spend Trend
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'funnel'}
              onClick={() => handleViewChange('funnel')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition ${
                activeView === 'funnel'
                  ? 'bg-[#12335f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <GitCommit className="h-3 w-3" />
              Stage Funnel
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'methods'}
              onClick={() => handleViewChange('methods')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition ${
                activeView === 'methods'
                  ? 'bg-[#12335f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <PieChartIcon className="h-3 w-3" />
              Method Mix
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'categories'}
              onClick={() => handleViewChange('categories')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition ${
                activeView === 'categories'
                  ? 'bg-[#12335f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Layers className="h-3 w-3" />
              Category Mix
            </button>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* KPI Mini-Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              {timeframeMeta.titlePrefix} Total Spend
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-[#12335f]">
                {formatCurrency(totalPeriodSpend)}
              </span>
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              {totalPeriodOrders > 0 ? `${totalPeriodOrders} fulfilled purchase orders ${timeframeMeta.orderSubtitle}` : `No purchase orders ${timeframeMeta.orderSubtitle}`}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800">MSME Mandate Procurement</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-emerald-950">
                {formatCurrency(totalPeriodMseSpend)}
              </span>
              <span className="text-[10px] font-bold text-emerald-700">({mseShareOverall}%)</span>
            </div>
            <p className="text-[9px] font-medium text-emerald-700 mt-0.5">
              Target: 25.0% statutory quota
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Active Procurement Pipeline</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-slate-900">
                {totalMethodsCount}
              </span>
              <span className="text-[10px] font-bold text-slate-500">active actions</span>
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              Across department requirements
            </p>
          </div>
        </div>

        {/* ── View 1: Spend Trajectory Trend (Bar or Line Graph) ── */}
        {activeView === 'trend' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                {timeframeMeta.allocationLabel}
              </p>
              {/* Bar vs Line Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-[9px] font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setTrendMode('bar')}
                  className={`px-2 py-0.5 rounded transition ${trendMode === 'bar' ? 'bg-white text-[#12335f] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Bar Chart
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMode('line')}
                  className={`px-2 py-0.5 rounded transition ${trendMode === 'line' ? 'bg-white text-[#12335f] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Line Graph
                </button>
              </div>
            </div>

            {totalPeriodSpend > 0 ? (
              <div className="h-[220px] w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  {trendMode === 'bar' ? (
                    <BarChart
                      data={spendTrend}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(0)}L` : v > 0 ? `₹${(v/1000).toFixed(0)}k` : '₹0'}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          borderColor: '#e2e8f0', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                        formatter={(value: any, name: any) => [formatCurrency(Number(value || 0)), name]}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '8px', fontWeight: 600 }} 
                      />
                      <Bar 
                        dataKey="totalSpend" 
                        name="Total Spend" 
                        fill="#12335f" 
                        radius={[4, 4, 0, 0]} 
                      />
                      <Bar 
                        dataKey="msmeSpend" 
                        name="MSME Spend" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  ) : (
                    <LineChart
                      data={spendTrend}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(0)}L` : v > 0 ? `₹${(v/1000).toFixed(0)}k` : '₹0'}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          borderColor: '#e2e8f0', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                        formatter={(value: any, name: any) => [formatCurrency(Number(value || 0)), name]}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '8px', fontWeight: 600 }} 
                      />
                      <Line 
                        type="monotone"
                        dataKey="totalSpend" 
                        name="Total Spend" 
                        stroke="#12335f" 
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#12335f' }}
                      />
                      <Line 
                        type="monotone"
                        dataKey="msmeSpend" 
                        name="MSME Spend" 
                        stroke="#10b981" 
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#10b981' }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2.5">
                <div className="h-10 w-10 rounded-full bg-blue-50 text-[#12335f] flex items-center justify-center font-bold">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    No Procurement Spend in Past {timeframeMeta.titlePrefix}
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    Once purchase orders are awarded to suppliers and verified, real-time spend velocity and MSME allocation trends will render here automatically.
                  </p>
                </div>
                <Link
                  href="/buyer/my-procurements"
                  className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#12335f] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#1b4884] transition shadow-xs"
                >
                  Create Procurement Tender / RFQ <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── View 2: Lifecycle Stage Funnel (Interactive Graphical Chart) ── */}
        {activeView === 'funnel' && (
          <div className="space-y-3 pt-1">
            {totalFunnelActions > 0 ? (
              <>
                <div className="h-[180px] w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={procurementFunnel.map((item, idx) => ({
                        stage: item.stage,
                        count: item.count,
                        fill: item.color,
                        pct: totalFunnelActions > 0 ? Math.round((item.count / totalFunnelActions) * 100) : 0,
                        tab: idx === 0 ? 'bidding' : idx === 1 ? 'evaluation' : 'awarded'
                      }))}
                      margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="stage" 
                        tick={{ fontSize: 9, fill: '#475569', fontWeight: 700 }} 
                        tickLine={false} 
                        axisLine={{ stroke: '#cbd5e1' }} 
                      />
                      <YAxis 
                        tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <Tooltip
                        contentStyle={{ 
                          borderRadius: '8px', 
                          fontSize: '11px', 
                          fontWeight: 600, 
                          backgroundColor: '#ffffff', 
                          borderColor: '#e2e8f0',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(val: any, name: any, item: any) => [`${val} Procurements (${item.payload.pct}%)`, 'Active Volume']}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {procurementFunnel.map((entry, index) => (
                          <Cell key={`funnel-bar-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {procurementFunnel.map((item, idx) => {
                    const pct = totalFunnelActions > 0 
                      ? Math.round((item.count / totalFunnelActions) * 100) 
                      : 0;
                    const stageTargetTab = idx === 0 ? 'bidding' : idx === 1 ? 'evaluation' : 'awarded';
                    return (
                      <Link 
                        key={item.stage} 
                        href={`/buyer/my-procurements?tab=${stageTargetTab}`}
                        className="p-2 rounded-lg border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80 transition-all space-y-1 group block"
                      >
                        <div className="flex items-center justify-between">
                          <span className="h-5 w-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: item.color }}>
                            {idx + 1}
                          </span>
                          <span className="text-[11px] font-black text-slate-900">{item.count}</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-800 group-hover:text-[#12335f] truncate transition-colors">{item.stage}</p>
                        <p className="text-[8px] font-semibold text-slate-400">Share: {pct}%</p>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2">
                <p className="text-xs font-bold text-slate-700">No active procurement stages yet</p>
                <p className="text-[10px] text-slate-500">Publish a tender or RFQ to initiate the lifecycle funnel.</p>
              </div>
            )}
            <p className="text-[9px] text-slate-400 italic text-center">
              Click any stage to filter active bidding tenders, bid evaluation queues, and settled contracts.
            </p>
          </div>
        )}

        {/* ── View 3: Methods Breakdown (Interactive Donut & Links) ── */}
        {activeView === 'methods' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-2">
            <div className="md:col-span-6 h-[180px] w-full relative">
              {totalMethodsCount > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={methodDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="count"
                      >
                        {methodDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
                        formatter={(val: any) => [`${val} Procurements`, 'Count']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base font-black text-slate-900">{totalMethodsCount}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-center p-4">
                  <p className="text-[11px] font-medium text-slate-400">
                    No active procurement methods initiated yet.
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-6 space-y-2">
              {methodDistribution.map((method) => {
                const pct = totalMethodsCount > 0 
                  ? Math.round((method.count / totalMethodsCount) * 100) 
                  : 0;
                return (
                  <Link 
                    key={method.name} 
                    href={`/buyer/my-procurements?type=${encodeURIComponent(method.name)}`}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-between transition-colors group block"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: method.color }} />
                      <span className="text-[10px] font-bold text-slate-700 group-hover:text-[#12335f] transition-colors">{method.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-slate-900">{method.count}</span>
                      <span className="text-[9px] font-semibold text-slate-400">({pct}%)</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── View 4: Category Spend Breakdown (Donut + Category Cards) ── */}
        {activeView === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-2">
            <div className="md:col-span-6 h-[190px] w-full relative">
              {totalCategorySpend > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="spend"
                        nameKey="name"
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell key={`cat-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
                        formatter={(val: any) => [formatCurrency(Number(val || 0)), 'Spend']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-black text-slate-900">{formatCurrency(totalCategorySpend)}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Total Spend</span>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-center p-4">
                  <p className="text-[11px] font-medium text-slate-400">
                    No category spend data recorded yet.
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-6 space-y-2">
              {categoryDistribution.length > 0 ? (
                categoryDistribution.map((cat) => {
                  const pct = totalCategorySpend > 0 
                    ? Math.round((cat.spend / totalCategorySpend) * 100) 
                    : 0;
                  return (
                    <div 
                      key={cat.name} 
                      className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <div>
                          <span className="text-[10px] font-bold text-slate-700 block">{cat.name}</span>
                          <span className="text-[8px] font-semibold text-slate-400">{cat.count} order{cat.count === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-extrabold text-slate-900 block">{formatCurrency(cat.spend)}</span>
                        <span className="text-[9px] font-semibold text-slate-400">({pct}%)</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-[10px] text-slate-400 italic">No category allocation history available.</p>
              )}
            </div>
          </div>
        )}

      
      </CardContent>
    </Card>
  );
}

export default React.memo(BuyerProcurementSpendChart);
