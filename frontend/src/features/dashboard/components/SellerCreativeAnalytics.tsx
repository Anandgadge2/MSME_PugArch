'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { 
  PieChart as PieChartIcon, 
  Wallet, 
  Zap, 
  Truck, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  TrendingUp,
  FileText,
  Gavel,
  ChevronRight,
  Receipt
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip 
} from 'recharts';
import { Card, CardContent } from '../../../components/ui/card';
import { useAuth } from '../../../hooks/useAuth';
import { isShgUser } from '../../../lib/shg';

interface CashflowItem {
  name: string;
  amount: number;
  count: number;
  color: string;
}

interface SellerCreativeAnalyticsProps {
  cashflowLifecycle?: CashflowItem[];
  conversion?: {
    submitted?: number;
    won?: number;
    underEval?: number;
    rejected?: number;
    winRate?: number;
    pipelineValue?: number;
    onTimeDeliveryRate?: number | null;
    hasDeliveries?: boolean;
    totalRevenue?: number;
    totalOrders?: number;
  };
  opportunityCounts?: {
    total?: number;
    tenders?: number;
    rfqs?: number;
    auctions?: number;
  };
  isLoading?: boolean;
}

const formatCurrency = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} Lakh`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  return `₹${val.toLocaleString('en-IN')}`;
};

export function SellerCreativeAnalytics({
  cashflowLifecycle = [],
  conversion,
  opportunityCounts,
  isLoading = false
}: SellerCreativeAnalyticsProps) {
  const { user } = useAuth();
  const isShg = isShgUser(user) || user?.role === 'shg';
  const rolePrefix = isShg ? '/shg' : '/seller';

  const [activeTab, setActiveTab] = useState<'cashflow' | 'opportunities' | 'fulfillment'>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const urlTab = sp.get('analyticsTab');
      if (urlTab && ['cashflow', 'opportunities', 'fulfillment'].includes(urlTab)) {
        return urlTab as 'cashflow' | 'opportunities' | 'fulfillment';
      }
      const saved = sessionStorage.getItem('dashboard_seller_analytics_tab');
      if (saved && ['cashflow', 'opportunities', 'fulfillment'].includes(saved)) {
        return saved as 'cashflow' | 'opportunities' | 'fulfillment';
      }
    }
    return 'cashflow';
  });

  const handleTabChange = useCallback((newTab: 'cashflow' | 'opportunities' | 'fulfillment') => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dashboard_seller_analytics_tab', newTab);
      const url = new URL(window.location.href);
      url.searchParams.set('analyticsTab', newTab);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const urlTab = sp.get('analyticsTab');
      if (urlTab && ['cashflow', 'opportunities', 'fulfillment'].includes(urlTab)) {
        setActiveTab(urlTab as 'cashflow' | 'opportunities' | 'fulfillment');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1. Cashflow calculations
  const totalInvoicesAmount = useMemo(
    () => cashflowLifecycle.reduce((sum, item) => sum + (item.amount || 0), 0),
    [cashflowLifecycle]
  );
  const totalInvoicesCount = useMemo(
    () => cashflowLifecycle.reduce((sum, item) => sum + (item.count || 0), 0),
    [cashflowLifecycle]
  );

  const cashflowChartData = useMemo(() => {
    return cashflowLifecycle
      .filter(item => item.amount > 0 || item.count > 0)
      .map(item => ({
        name: item.name,
        value: item.amount > 0 ? item.amount : item.count,
        displayAmount: item.amount,
        count: item.count,
        color: item.color
      }));
  }, [cashflowLifecycle]);

  // 2. Opportunities mix calculations
  const oppTenders = opportunityCounts?.tenders ?? 0;
  const oppRfqs = opportunityCounts?.rfqs ?? 0;
  const oppAuctions = opportunityCounts?.auctions ?? 0;
  const oppTotal = opportunityCounts?.total ?? (oppTenders + oppRfqs + oppAuctions);

  const oppChartData = useMemo(() => {
    const data = [
      { name: 'Public Tenders', value: oppTenders, color: '#2563eb', href: `${rolePrefix}/opportunities/open-tenders` },
      { name: 'Direct RFQs', value: oppRfqs, color: '#8b5cf6', href: `${rolePrefix}/opportunities/rfqs` },
      { name: 'Reverse Auctions', value: oppAuctions, color: '#f59e0b', href: `${rolePrefix}/opportunities/auctions` },
    ].filter(item => item.value > 0);
    return data;
  }, [oppTenders, oppRfqs, oppAuctions, rolePrefix]);

  // 3. Fulfillment SLA
  const onTimeRate = conversion?.onTimeDeliveryRate;
  const hasDeliveries = conversion?.hasDeliveries ?? false;
  const totalOrders = conversion?.totalOrders ?? 0;

  return (
    <Card className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden flex flex-col">
      {/* ── Card Header ── */}
      <div className="bg-slate-50/50 px-3.5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#12335f]/10 text-[#12335f] flex items-center justify-center font-bold">
            <PieChartIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Creative Portfolio Intelligence
            </h2>
            <p className="text-[10px] font-medium text-slate-500">
              Real-time receivables, market demand mix, and fulfillment SLA
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div 
          className="flex items-center bg-slate-100/90 p-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider"
          role="tablist"
          aria-label="Analytics Views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cashflow'}
            onClick={() => handleTabChange('cashflow')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeTab === 'cashflow' 
                ? 'bg-white text-[#12335f] shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cashflow
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'opportunities'}
            onClick={() => handleTabChange('opportunities')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeTab === 'opportunities' 
                ? 'bg-white text-[#12335f] shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Demand Mix
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'fulfillment'}
            onClick={() => handleTabChange('fulfillment')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeTab === 'fulfillment' 
                ? 'bg-white text-[#12335f] shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Fulfillment
          </button>
        </div>
      </div>

      <CardContent className="p-3.5 space-y-3.5 flex-1">
        {/* ── View 1: Cashflow & Receivables Donut Chart ── */}
        {activeTab === 'cashflow' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {totalInvoicesCount > 0 ? (
              <>
                <div className="grid grid-cols-12 items-center gap-3">
                  {/* Pie / Donut Chart */}
                  <div className="col-span-5 h-[120px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={cashflowChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={32}
                          outerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {cashflowChartData.map((entry, idx) => (
                            <Cell key={`cashflow-cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ 
                            borderRadius: '8px', 
                            fontSize: '11px', 
                            fontWeight: '600',
                            backgroundColor: '#ffffff',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                          formatter={(val: any, name: any, entry: any) => [
                            entry.payload.displayAmount > 0 
                              ? formatCurrency(entry.payload.displayAmount) 
                              : `${entry.payload.count} invoices`,
                            name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-black text-slate-950">
                        {totalInvoicesAmount > 0 ? formatCurrency(totalInvoicesAmount) : `${totalInvoicesCount}`}
                      </span>
                      <span className="text-[7px] font-bold uppercase text-slate-400">Total</span>
                    </div>
                  </div>

                  {/* Micro Breakdown Legend */}
                  <div className="col-span-7 space-y-1.5 text-[10px]">
                    {cashflowLifecycle.map((item) => {
                      const pct = totalInvoicesAmount > 0 
                        ? Math.round((item.amount / totalInvoicesAmount) * 100) 
                        : (totalInvoicesCount > 0 ? Math.round((item.count / totalInvoicesCount) * 100) : 0);

                      return (
                        <div 
                          key={item.name} 
                          className="flex items-center justify-between p-1.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="font-bold text-slate-700 truncate">{item.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-slate-900 ml-2">
                              {item.amount > 0 ? formatCurrency(item.amount) : `${item.count} inv`}
                            </span>
                            <span className="text-[9px] text-slate-400 ml-1">({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-medium">
                    Total {totalInvoicesCount} invoices tracked
                  </span>
                  <Link 
                    href={isShg ? '/shg/payments' : '/payments/transactions'}
                    className="font-bold uppercase tracking-wider text-[#12335f] hover:underline flex items-center gap-0.5"
                  >
                    View Invoices →
                  </Link>
                </div>
              </>
            ) : (
              <div className="p-5 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Receipt className="h-6 w-6 mx-auto text-slate-300 mb-1.5" />
                <p className="text-xs font-bold text-slate-700">No invoices generated yet</p>
                <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                  When you fulfill purchase orders and submit GST invoices, your payout lifecycle will be dynamically charted here.
                </p>
                <Link 
                  href={`${rolePrefix}/orders`}
                  className="mt-2.5 inline-block text-[10px] font-bold uppercase tracking-wide text-[#12335f] hover:underline"
                >
                  View Active Orders →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── View 2: Opportunity Demand Mix Pie Chart ── */}
        {activeTab === 'opportunities' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {oppTotal > 0 ? (
              <>
                <div className="grid grid-cols-12 items-center gap-3">
                  {/* Pie Chart */}
                  <div className="col-span-5 h-[120px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={oppChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {oppChartData.map((entry, idx) => (
                            <Cell key={`opp-cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ 
                            borderRadius: '8px', 
                            fontSize: '11px', 
                            fontWeight: '600',
                            backgroundColor: '#ffffff',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                          formatter={(val: any, name: any) => [`${val} Opportunities`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-black text-slate-950">{oppTotal}</span>
                      <span className="text-[7px] font-bold uppercase text-slate-400">Total Leads</span>
                    </div>
                  </div>

                  {/* Channel Breakdown */}
                  <div className="col-span-7 space-y-1.5 text-[10px]">
                    {oppChartData.map((entry) => {
                      const pct = oppTotal > 0 ? Math.round((entry.value / oppTotal) * 100) : 0;
                      return (
                        <Link
                          key={entry.name}
                          href={entry.href}
                          className="flex items-center justify-between p-1.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition-all group"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="font-bold text-slate-700 group-hover:text-[#12335f] truncate">
                              {entry.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-extrabold text-slate-900">{entry.value}</span>
                            <span className="text-[9px] text-slate-400">({pct}%)</span>
                            <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-[#12335f] transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-medium">
                    100% matched to your business categories
                  </span>
                  <Link 
                    href={`${rolePrefix}/opportunities`}
                    className="font-bold uppercase tracking-wider text-[#12335f] hover:underline flex items-center gap-0.5"
                  >
                    Browse All Leads →
                  </Link>
                </div>
              </>
            ) : (
              <div className="p-5 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Zap className="h-6 w-6 mx-auto text-slate-300 mb-1.5" />
                <p className="text-xs font-bold text-slate-700">Scanning for new buyer opportunities</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Buyer procurement tenders and price quotation requests will appear here as soon as published.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── View 3: Order Fulfillment & Delivery Health ── */}
        {activeTab === 'fulfillment' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                    On-Time SLA Rate
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-950">
                    {hasDeliveries && onTimeRate !== null ? `${onTimeRate}%` : '100%'}
                  </span>
                  {!hasDeliveries && (
                    <span className="text-[9px] font-bold text-emerald-700">(Initial SLA)</span>
                  )}
                </div>
                <p className="text-[9px] font-medium text-emerald-700 mt-0.5">
                  Consignment delivery timeline adherence
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Total Orders
                  </span>
                  <Truck className="h-3.5 w-3.5 text-[#12335f]" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-950">{totalOrders}</span>
                  <span className="text-[9px] font-bold text-slate-400">awarded</span>
                </div>
                <p className="text-[9px] font-medium text-slate-500 mt-0.5">
                  Purchase orders in lifecycle
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200/70 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-[10px] font-bold uppercase text-slate-900">
                    Quality & Compliance Rating
                  </h4>
                  <p className="text-[9px] font-medium text-slate-500">
                    Verified supplier profile & digital delivery challan enabled
                  </p>
                </div>
              </div>
              <Link
                href={`${rolePrefix}/delivery-management`}
                className="text-[9px] font-bold uppercase tracking-wider text-[#12335f] hover:underline shrink-0"
              >
                Track Shipments →
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default React.memo(SellerCreativeAnalytics);
