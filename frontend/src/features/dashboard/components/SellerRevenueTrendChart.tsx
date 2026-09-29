'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  IndianRupee, 
  PackageCheck, 
  BarChart3, 
  ArrowUpRight, 
  ShieldCheck, 
  Info,
  Layers,
  Wallet,
  Receipt
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card, CardContent } from '../../../components/ui/card';

interface RevenueTrendItem {
  key: string;
  month: string;
  revenue: number;
  ordersCount: number;
}

interface CashflowItem {
  name: string;
  amount: number;
  count: number;
  color: string;
}

interface SellerRevenueTrendChartProps {
  revenueTrend?: RevenueTrendItem[];
  cashflowLifecycle?: CashflowItem[];
  totalRevenue?: number;
  totalOrders?: number;
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
        subtitle: 'Daily sales volume, invoice receivables, and payout lifecycle',
        revenueLabel: 'Daily Realized Revenue',
        invoiceLabel: 'Daily Invoiced Volume',
        runRateLabel: 'Daily Run Rate',
        runRateSubtitle: 'Today',
        runRateUnit: '/ day',
        emptySubtitle: 'No Sales Revenue Recorded Today'
      };
    case 'weekly':
      return {
        titlePrefix: '7-Day',
        subtitle: '7-day rolling sales volume, invoice receivables, and payout lifecycle',
        revenueLabel: '7-Day Realized Revenue',
        invoiceLabel: '7-Day Invoiced Volume',
        runRateLabel: 'Weekly Run Rate',
        runRateSubtitle: 'Past 7 days',
        runRateUnit: '/ wk',
        emptySubtitle: 'No Sales Revenue Recorded in Past 7 Days'
      };
    case 'quarterly':
      return {
        titlePrefix: '90-Day',
        subtitle: '90-day fiscal sales volume, invoice receivables, and payout lifecycle',
        revenueLabel: '90-Day Realized Revenue',
        invoiceLabel: '90-Day Invoiced Volume',
        runRateLabel: 'Quarterly Run Rate',
        runRateSubtitle: 'Past 90 days',
        runRateUnit: '/ qtr',
        emptySubtitle: 'No Sales Revenue Recorded in Past 90 Days'
      };
    default:
      return {
        titlePrefix: '30-Day',
        subtitle: '30-day realized sales volume, invoice receivables, and payout lifecycle',
        revenueLabel: '30-Day Realized Revenue',
        invoiceLabel: '30-Day Invoiced Volume',
        runRateLabel: 'Monthly Run Rate',
        runRateSubtitle: 'Past 30 days',
        runRateUnit: '/ mo',
        emptySubtitle: 'No Sales Revenue Recorded in Past 30 Days'
      };
  }
};

export function SellerRevenueTrendChart({
  revenueTrend = [],
  cashflowLifecycle = [],
  totalRevenue = 0,
  totalOrders = 0,
  isLoading = false,
  granularity = 'monthly',
  onGranularityChange
}: SellerRevenueTrendChartProps) {
  const [activeTab, setActiveTab] = useState<'revenue' | 'cashflow'>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const urlTab = sp.get('trendTab');
      if (urlTab && ['revenue', 'cashflow'].includes(urlTab)) {
        return urlTab as 'revenue' | 'cashflow';
      }
      const saved = sessionStorage.getItem('dashboard_seller_trend_tab');
      if (saved && ['revenue', 'cashflow'].includes(saved)) {
        return saved as 'revenue' | 'cashflow';
      }
    }
    return 'revenue';
  });

  const handleTabChange = useCallback((newTab: 'revenue' | 'cashflow') => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dashboard_seller_trend_tab', newTab);
      const url = new URL(window.location.href);
      url.searchParams.set('trendTab', newTab);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const urlTab = sp.get('trendTab');
      if (urlTab && ['revenue', 'cashflow'].includes(urlTab)) {
        setActiveTab(urlTab as 'revenue' | 'cashflow');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const timeframeMeta = useMemo(() => getTimeframeMeta(granularity), [granularity]);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const periodRevenue = revenueTrend.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const periodOrders = revenueTrend.reduce((sum, item) => sum + (item.ordersCount || 0), 0);
  const avgMonthlyRevenue = revenueTrend.length > 0 
    ? Math.round(periodRevenue / revenueTrend.length) 
    : 0;

  const totalInvoicesAmount = cashflowLifecycle.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalInvoicesCount = cashflowLifecycle.reduce((sum, c) => sum + (c.count || 0), 0);

  return (
    <Card className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Sales Revenue & Cashflow Intelligence
            </h3>
            <p className="text-[10px] font-medium text-slate-500">
              {timeframeMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Granularity & View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity Selector */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200" role="tablist" aria-label="Timeframe Granularity">
            {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={granularity === g}
                onClick={() => onGranularityChange?.(g)}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded transition ${
                  granularity === g
                    ? 'bg-[#12335f] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {g === 'daily' ? 'Daily' : g === 'weekly' ? 'Weekly' : g === 'monthly' ? 'Monthly' : 'Quarterly'}
              </button>
            ))}
          </div>

          {/* View Switcher Tabs */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200" role="tablist" aria-label="Seller Financial View">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'revenue'}
              onClick={() => handleTabChange('revenue')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition ${
                activeTab === 'revenue'
                  ? 'bg-[#12335f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              Revenue Velocity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'cashflow'}
              onClick={() => handleTabChange('cashflow')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition ${
                activeTab === 'cashflow'
                  ? 'bg-[#12335f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Wallet className="h-3 w-3" />
              Cashflow & Invoices
            </button>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* KPI Mini-Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              {activeTab === 'cashflow' ? timeframeMeta.invoiceLabel : timeframeMeta.revenueLabel}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-[#12335f]">
                {activeTab === 'cashflow' ? formatCurrency(totalInvoicesAmount) : formatCurrency(periodRevenue)}
              </span>
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              {activeTab === 'cashflow'
                ? (totalInvoicesCount > 0 ? `${totalInvoicesCount} invoices tracked in ${timeframeMeta.titlePrefix.toLowerCase()} window` : 'No invoices in period')
                : (periodOrders > 0 ? `${periodOrders} fulfilled orders in period` : 'No orders in period')}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              {activeTab === 'cashflow' ? 'Settled & Paid' : timeframeMeta.runRateLabel}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-slate-900">
                {activeTab === 'cashflow' 
                  ? formatCurrency(cashflowLifecycle.find(c => c.name.toLowerCase().includes('settled'))?.amount || 0)
                  : formatCurrency(avgMonthlyRevenue)}
              </span>
              {activeTab !== 'cashflow' && (
                <span className="text-[10px] font-bold text-slate-400">{timeframeMeta.runRateUnit}</span>
              )}
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              {activeTab === 'cashflow'
                ? `${cashflowLifecycle.find(c => c.name.toLowerCase().includes('settled'))?.count || 0} cleared payouts`
                : timeframeMeta.runRateSubtitle}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800">Total All-Time Realized</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-emerald-950">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
            <p className="text-[9px] font-medium text-emerald-700 mt-0.5">
              Across {totalOrders} total purchase order awards
            </p>
          </div>
        </div>

        {/* ── View 1: Revenue Velocity Area or Bar Chart ── */}
        {activeTab === 'revenue' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-slate-400">Sales Volume Curve</p>
              {/* Line vs Bar Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-[9px] font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`px-2 py-0.5 rounded transition ${chartType === 'line' ? 'bg-white text-[#12335f] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Line Graph
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`px-2 py-0.5 rounded transition ${chartType === 'bar' ? 'bg-white text-[#12335f] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Bar Chart
                </button>
              </div>
            </div>

            {periodRevenue > 0 ? (
              <div className="h-[200px] w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'line' ? (
                    <AreaChart
                      data={revenueTrend}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#12335f" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#12335f" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
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
                        formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Revenue']}
                        labelFormatter={(lbl) => `Month: ${lbl}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#12335f" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#revenueGradient)" 
                      />
                    </AreaChart>
                  ) : (
                    <BarChart
                      data={revenueTrend}
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
                        formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Revenue']}
                        labelFormatter={(lbl) => `Month: ${lbl}`}
                      />
                      <Bar 
                        dataKey="revenue" 
                        name="Monthly Revenue" 
                        fill="#12335f" 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2.5">
                <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {timeframeMeta.emptySubtitle}
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    As soon as you bid on open tenders or receive purchase orders from buyers, your revenue growth curve and volume history will plot automatically.
                  </p>
                </div>
                <Link
                  href="/opportunities"
                  className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#12335f] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#1b4884] transition shadow-xs"
                >
                  Explore Live Opportunities <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── View 2: Cashflow & Invoices Lifecycle (Interactive Graphical Analytics) ── */}
        {activeTab === 'cashflow' && (
          <div className="space-y-3 pt-1">
            {totalInvoicesCount > 0 ? (
              <>
                <div className="h-[180px] w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={cashflowLifecycle.map((item) => ({
                        name: item.name,
                        amount: item.amount,
                        count: item.count,
                        color: item.color
                      }))}
                      margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 9, fill: '#475569', fontWeight: 700 }} 
                        tickLine={false} 
                        axisLine={{ stroke: '#cbd5e1' }} 
                      />
                      <YAxis 
                        tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(0)}L` : v > 0 ? `₹${(v/1000).toFixed(0)}k` : '₹0'}
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
                        formatter={(val: any, name: any, item: any) => [
                          `${formatCurrency(Number(val))} (${item.payload.count} invoices)`,
                          item.payload.name
                        ]}
                      />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {cashflowLifecycle.map((entry, index) => (
                          <Cell key={`cashflow-bar-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {cashflowLifecycle.map((item) => {
                    const pct = totalInvoicesAmount > 0 
                      ? Math.round((item.amount / totalInvoicesAmount) * 100) 
                      : 0;
                    return (
                      <Link
                        key={item.name}
                        href={`/payments/invoices?status=${encodeURIComponent(item.name)}`}
                        className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 transition-all space-y-1.5 group block"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-bold text-slate-800 group-hover:text-[#12335f] transition-colors">{item.name}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {item.count} invoices ({pct}%)
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-black text-slate-950">
                            {formatCurrency(item.amount)}
                          </span>
                          <span className="text-[9px] font-bold text-[#12335f] group-hover:underline">View Invoices →</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-6 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200 space-y-1.5">
                <p className="text-xs font-bold text-slate-700">No invoices submitted yet.</p>
                <p className="text-[10px] text-slate-500">Generate and submit tax invoices once purchase orders are accepted to track your receivables and payment timelines.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1 font-medium">
            <Info className="h-3 w-3 text-slate-400" />
            Computed from authentic invoice and purchase order settlements
          </span>
          <Link 
            href="/orders" 
            className="font-bold uppercase tracking-wider text-[#12335f] hover:underline flex items-center gap-0.5"
          >
            All Orders & Invoices →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default React.memo(SellerRevenueTrendChart);
