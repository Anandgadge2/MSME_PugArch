'use client';

import React, { useState, useCallback, useEffect } from 'react';
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

interface BuyerProcurementSpendChartProps {
  spendTrend?: SpendTrendItem[];
  methodDistribution?: MethodItem[];
  procurementFunnel?: FunnelItem[];
  isLoading?: boolean;
}

const formatCurrency = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} Lakh`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  return `₹${val.toLocaleString('en-IN')}`;
};

export function BuyerProcurementSpendChart({
  spendTrend = [],
  methodDistribution = [],
  procurementFunnel = [],
  isLoading = false
}: BuyerProcurementSpendChartProps) {
  const [activeView, setActiveView] = useState<'trend' | 'funnel' | 'methods'>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const viewParam = sp.get('chartView');
      if (viewParam && ['trend', 'funnel', 'methods'].includes(viewParam)) {
        return viewParam as 'trend' | 'funnel' | 'methods';
      }
      const saved = sessionStorage.getItem('dashboard_buyer_chart_view');
      if (saved && ['trend', 'funnel', 'methods'].includes(saved)) {
        return saved as 'trend' | 'funnel' | 'methods';
      }
    }
    return 'trend';
  });

  const handleViewChange = useCallback((newView: 'trend' | 'funnel' | 'methods') => {
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
      if (viewParam && ['trend', 'funnel', 'methods'].includes(viewParam)) {
        setActiveView(viewParam as 'trend' | 'funnel' | 'methods');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const totalPeriodSpend = spendTrend.reduce((sum, item) => sum + (item.totalSpend || 0), 0);
  const totalPeriodMseSpend = spendTrend.reduce((sum, item) => sum + (item.msmeSpend || 0), 0);
  const totalPeriodOrders = spendTrend.reduce((sum, item) => sum + (item.ordersCount || 0), 0);
  const mseShareOverall = totalPeriodSpend > 0 
    ? Number(((totalPeriodMseSpend / totalPeriodSpend) * 100).toFixed(1)) 
    : 0;

  const totalMethodsCount = methodDistribution.reduce((sum, m) => sum + (m.count || 0), 0);
  const totalFunnelActions = procurementFunnel.reduce((sum, f) => sum + (f.count || 0), 0);

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
              6-month historical spend trajectory, lifecycle pipeline funnel, and method mix
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200" role="tablist" aria-label="Procurement View Selector">
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
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* KPI Mini-Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">6-Month Total Spend</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-[#12335f]">
                {formatCurrency(totalPeriodSpend)}
              </span>
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              {totalPeriodOrders > 0 ? `${totalPeriodOrders} fulfilled purchase orders` : 'No purchase orders in period'}
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

        {/* ── View 1: Spend Trajectory Trend ── */}
        {activeView === 'trend' && (
          <div className="space-y-2">
            {totalPeriodSpend > 0 ? (
              <div className="h-[220px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
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
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2.5">
                <div className="h-10 w-10 rounded-full bg-blue-50 text-[#12335f] flex items-center justify-center font-bold">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    No Procurement Spend in Past 6 Months
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    Once purchase orders are awarded to suppliers and verified, real-time monthly spend velocity and MSME allocation trends will render here automatically.
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

        {/* ── View 2: Lifecycle Stage Funnel ── */}
        {activeView === 'funnel' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {procurementFunnel.map((item, idx) => {
                const pct = totalFunnelActions > 0 
                  ? Math.round((item.count / totalFunnelActions) * 100) 
                  : 0;
                return (
                  <div key={item.stage} className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: item.color }}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{item.stage}</p>
                          <p className="text-[9px] font-medium text-slate-500">{item.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900">{item.count}</span>
                        <span className="text-[9px] font-semibold text-slate-400 ml-1">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${totalFunnelActions > 0 ? Math.max(8, (item.count / totalFunnelActions) * 100) : 0}%`,
                          backgroundColor: item.color 
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-slate-400 italic text-center">
              Provides full-cycle visibility across active bidding tenders, bid evaluation queues, and settled contracts.
            </p>
          </div>
        )}

        {/* ── View 3: Methods Breakdown ── */}
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
                  <div key={method.name} className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: method.color }} />
                      <span className="text-[10px] font-bold text-slate-700">{method.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-slate-900">{method.count}</span>
                      <span className="text-[9px] font-semibold text-slate-400">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer info note */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1 font-medium">
            <Info className="h-3 w-3 text-slate-400" />
            Aggregated in real-time from verified database purchase order ledgers
          </span>
          <Link 
            href="/admin/reports" 
            className="font-bold uppercase tracking-wider text-[#12335f] hover:underline flex items-center gap-0.5"
          >
            Full Procurement MIS →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default React.memo(BuyerProcurementSpendChart);
