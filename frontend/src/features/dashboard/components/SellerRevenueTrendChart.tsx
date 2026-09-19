'use client';

import React, { useState } from 'react';
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
}

const formatCurrency = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} Lakh`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  return `₹${val.toLocaleString('en-IN')}`;
};

export function SellerRevenueTrendChart({
  revenueTrend = [],
  cashflowLifecycle = [],
  totalRevenue = 0,
  totalOrders = 0,
  isLoading = false
}: SellerRevenueTrendChartProps) {
  const [activeTab, setActiveTab] = useState<'revenue' | 'cashflow'>('revenue');

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
              6-month realized sales volume, invoice receivables, and payout lifecycle
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200" role="tablist" aria-label="Seller Financial View">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'revenue'}
            onClick={() => setActiveTab('revenue')}
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
            onClick={() => setActiveTab('cashflow')}
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

      <CardContent className="p-4 space-y-4">
        {/* KPI Mini-Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">6-Month Realized Revenue</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-[#12335f]">
                {formatCurrency(periodRevenue)}
              </span>
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              {periodOrders > 0 ? `${periodOrders} fulfilled orders in period` : 'No orders in period'}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Monthly Run Rate</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-slate-900">
                {formatCurrency(avgMonthlyRevenue)}
              </span>
              <span className="text-[10px] font-bold text-slate-400">/ mo</span>
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              Trailing 6-month average
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

        {/* ── View 1: Revenue Velocity Area Chart ── */}
        {activeTab === 'revenue' && (
          <div>
            {periodRevenue > 0 ? (
              <div className="h-[200px] w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
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
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2.5">
                <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    No Sales Revenue Recorded in Past 6 Months
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

        {/* ── View 2: Cashflow & Invoices Lifecycle ── */}
        {activeTab === 'cashflow' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {cashflowLifecycle.map((item) => {
                const pct = totalInvoicesAmount > 0 
                  ? Math.round((item.amount / totalInvoicesAmount) * 100) 
                  : 0;
                return (
                  <div key={item.name} className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-bold text-slate-800">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {item.count} invoices ({pct}%)
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-black text-slate-950">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${totalInvoicesAmount > 0 ? (item.amount / totalInvoicesAmount) * 100 : 0}%`,
                          backgroundColor: item.color 
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {totalInvoicesCount === 0 && (
              <div className="p-4 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                <p className="text-xs font-bold text-slate-700">No invoices submitted yet.</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Generate and submit tax invoices once purchase orders are accepted to track your receivables and payment timelines.</p>
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
