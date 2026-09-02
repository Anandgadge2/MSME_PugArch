import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  FileBarChart, Users, ClipboardCheck, ArrowUpRight, Activity, Download, 
  ShieldCheck, Clock, FileText, CreditCard, Truck, Gavel, KeyRound, IndianRupee, CheckCircle2 
} from 'lucide-react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { KpiCard } from '../features/shared/KpiCard';
import { downloadCsv } from '../features/shared/exportUtils';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

const COLORS = ['#12335f', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function MISReports() {
  const { token } = useAuth();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  
  const [timeframe, setTimeframe] = useState('30d');
  const [roleFilter, setRoleFilter] = useState('all');

  // Fetch all stats together with filters
  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminStatsReport', timeframe, roleFilter],
    queryFn: async () => {
      const queryParams = new URLSearchParams({ timeframe, role: roleFilter }).toString();
      const res = await api.fetch(`/api/admin/reports/summary?${queryParams}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  });

  const isKpiLoading = isLoading;
  const isDetailsLoading = isLoading;
  const userGrowthData = stats?.userGrowth || [];
  const transactionData = stats?.transactions || [];
  const approvalRateNumber = Number(String(stats?.approvalRate || '0').replace('%', '')) || 0;
  const pendingApproval = Number(stats?.pendingApproval || 0);
  const totalNetwork = Number(stats?.totalNetwork || 0);
  const reviewLoad = totalNetwork ? Math.round((pendingApproval / totalNetwork) * 100) : 0;
  const executiveSignals = [
    { label: 'Approval throughput', value: `${approvalRateNumber}%`, helper: approvalRateNumber >= 70 ? 'Healthy conversion' : 'Needs review follow-up', icon: ShieldCheck, tone: approvalRateNumber >= 70 ? 'green' : 'amber' },
    { label: 'Review load', value: `${reviewLoad}%`, helper: `${pendingApproval} pending of ${totalNetwork || 0}`, icon: Clock, tone: reviewLoad > 30 ? 'amber' : 'blue' },
    { label: 'Avg onboarding time', value: stats?.avgOnboardingTime || '0 Days', helper: 'Submission to approval cycle', icon: Activity, tone: 'slate' },
  ];

  const distributionData = [
    { name: 'Active Sellers', value: stats?.activeSellers || 0 },
    { name: 'Active Buyers', value: stats?.activeBuyers || 0 },
    { name: 'Pending Review', value: stats?.pendingApproval || 0 },
  ];

  const exportSummary = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Network', stats?.totalNetwork || 0],
      ['Active Sellers', stats?.activeSellers || 0],
      ['Active Buyers', stats?.activeBuyers || 0],
      ['Pending Approval', stats?.pendingApproval || 0],
      ['Approval Rate', stats?.approvalRate || '0%'],
      ['Average Onboarding Time', stats?.avgOnboardingTime || '0 Days'],
      ['Active Procurement Value', stats?.activeProcurementValue || 'Rs. 0'],
      ['Tender Success Rate', stats?.tenderSuccessRate || '0%'],
    ];
    downloadCsv(`mis-summary-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="mx-auto max-w-[1560px] space-y-3 sm:space-y-4 px-3 sm:px-4 pb-8 animate-in fade-in duration-500">
      {/* ── Compact Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#12335f]">Analytics</span>
            <span className="text-slate-300">•</span>
            <span className="text-[10px] font-bold text-slate-400">Network Intelligence</span>
          </div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-black tracking-tight text-slate-950">
            <FileBarChart className="h-5 w-5 sm:h-6 sm:w-6 text-[#12335f] shrink-0" />
            <span>MIS Reports & Insights</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5 max-w-2xl">
            Executive dashboard for network health, onboarding metrics, and transaction analytics.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 mt-1 sm:mt-0">
          <button
            type="button"
            onClick={exportSummary}
            className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-lg bg-[#12335f] px-3.5 text-xs font-black uppercase tracking-wide text-white shadow-xs hover:bg-[#0b2445] transition-colors focus:ring-2 focus:ring-[#12335f]/20 focus:outline-none"
            aria-label="Export MIS Summary to CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ── Compact Filter Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 sm:px-3 sm:py-2">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <label htmlFor="timeframe-select" className="sr-only">Filter by Timeframe</label>
          <select
            id="timeframe-select"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="h-8 flex-1 sm:flex-initial min-w-[130px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition-all focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 shadow-2xs"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">This Year</option>
            <option value="all">All Time</option>
          </select>

          <label htmlFor="role-select" className="sr-only">Filter by Role</label>
          <select
            id="role-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-8 flex-1 sm:flex-initial min-w-[130px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition-all focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 shadow-2xs"
          >
            <option value="all">All Roles</option>
            <option value="buyer">Buyers Only</option>
            <option value="seller">Sellers Only</option>
          </select>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-slate-400">
          <span>Active filter:</span>
          <span className="rounded bg-white px-1.5 py-0.5 text-slate-700 border border-slate-200 text-[10px] uppercase font-black">
            {timeframe === 'all' ? 'All Time' : timeframe}
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 text-slate-700 border border-slate-200 text-[10px] uppercase font-black">
            {roleFilter}
          </span>
        </div>
      </div>

      {/* ── Executive Signal Cards (3 items: 2 cols on mobile with 3rd spanning, 3 cols on sm+) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
        {executiveSignals.map((signal, idx) => (
          <div key={signal.label} className={cn(idx === 2 ? 'col-span-2 sm:col-span-1' : 'col-span-1')}>
            <KpiCard
              label={signal.label}
              value={signal.value}
              subtext={signal.helper}
              icon={signal.icon}
              tone={signal.tone}
              loading={isKpiLoading}
            />
          </div>
        ))}
      </div>

      {/* ── Network Scope Cards (4 items: 2 cols on mobile, 4 cols on lg+) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <KpiCard 
          label="Total Network" 
          value={stats?.totalNetwork || 0} 
          icon={Users} 
          subtext="+12% growth trend" 
          tone="blue"
          loading={isKpiLoading}
        />
        <KpiCard 
          label="Active Sellers" 
          value={stats?.activeSellers || 0} 
          icon={ClipboardCheck} 
          subtext="+5% verified suppliers" 
          tone="green"
          loading={isKpiLoading}
        />
        <KpiCard 
          label="Active Buyers" 
          value={stats?.activeBuyers || 0} 
          icon={ClipboardCheck} 
          subtext="Active buyer departments" 
          tone="indigo"
          loading={isKpiLoading}
        />
        <KpiCard 
          label="Pending Approval" 
          value={stats?.pendingApproval || 0} 
          icon={Activity} 
          subtext="Requires verification" 
          tone="amber"
          loading={isKpiLoading}
        />
      </div>

      {/* ── Analytics Charts: 3 Balanced Columns (Growth + Volume + Compact Readiness Trend) ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {/* Chart 1: User Registration Growth */}
        <Card className="shadow-2xs">
          <CardHeader className="py-2 px-3 sm:px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
              User Registration Growth
            </CardTitle>
            <span className="text-[10px] font-bold text-slate-400">Monthly</span>
          </CardHeader>
          <CardContent className="h-[210px] sm:h-[225px] p-2 sm:p-3">
            {isDetailsLoading ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">
                Loading growth stats...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userGrowthData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ paddingTop: '6px', fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="sellers" name="Sellers" fill="#12335f" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="buyers" name="Buyers" fill="#38bdf8" radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Weekly Transaction Volume */}
        <Card className="shadow-2xs">
          <CardHeader className="py-2 px-3 sm:px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
              Weekly Transaction Volume
            </CardTitle>
            <span className="text-[10px] font-bold text-slate-400">Daily settlement</span>
          </CardHeader>
          <CardContent className="h-[210px] sm:h-[225px] p-2 sm:p-3">
            {isDetailsLoading ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">
                Loading transaction volume...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transactionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val) => Number(val) >= 100000 ? `₹${(Number(val)/100000).toFixed(1)}L` : Number(val) >= 1000 ? `₹${(Number(val)/1000).toFixed(0)}k` : `₹${val}`}
                  />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                    formatter={(val: any) => [`₹${Number(val || 0).toLocaleString('en-IN')}`, 'Volume']}
                  />
                  <Line type="monotone" dataKey="value" name="Volume (₹)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Approval Readiness Trend (Small & Compact) */}
        <Card className="shadow-2xs md:col-span-2 lg:col-span-1">
          <CardHeader className="py-2 px-3 sm:px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
              Approval Readiness Trend
            </CardTitle>
            <span className="text-[10px] font-bold text-slate-400">Trajectories</span>
          </CardHeader>
          <CardContent className="h-[210px] sm:h-[225px] p-2 sm:p-3">
            {isDetailsLoading ? (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-xs font-bold text-slate-400">Loading readiness trend...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#12335f" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#12335f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ paddingTop: '6px', fontSize: '11px', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="sellers" name="Sellers" stroke="#12335f" fill="url(#readinessFill)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="buyers" name="Buyers" stroke="#0ea5e9" fill="#e0f2fe" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Lower Section: 3 Balanced Columns (Entity Distribution + KPI Grid + Report Shortcuts) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Col 1: Entity Distribution */}
        <Card className="shadow-2xs flex flex-col">
          <CardHeader className="py-2 px-3 sm:px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
              Entity Distribution
            </CardTitle>
            <span className="text-[10px] font-bold text-slate-400">Platform share</span>
          </CardHeader>
          <CardContent className="h-[210px] sm:h-[225px] p-2 flex items-center justify-center flex-1">
            {isDetailsLoading ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">
                Loading distribution...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="45%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }} />
                  <Legend verticalAlign="bottom" height={30} wrapperStyle={{ paddingTop: '4px', fontSize: '11px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Col 2: Key Performance Indicators */}
        <Card className="shadow-2xs flex flex-col">
          <CardHeader className="py-2 px-3 sm:px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
              Key Performance Indicators
            </CardTitle>
            <span className="text-[10px] font-bold text-slate-400">Benchmarks</span>
          </CardHeader>
          <CardContent className="p-2 sm:p-2.5 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-2">
              <KpiCard
                label="Avg Onboarding"
                value={stats?.avgOnboardingTime || '0 Days'}
                subtext="Submission to approval"
                icon={Clock}
                tone="slate"
                loading={isKpiLoading}
              />
              <KpiCard
                label="Approval Rate"
                value={stats?.approvalRate || '0%'}
                subtext="Conversion rate"
                icon={ShieldCheck}
                tone="green"
                loading={isKpiLoading}
              />
              <KpiCard
                label="Active Procurement"
                value={stats?.activeProcurementValue || '₹0.00Cr'}
                subtext="Active PO commitment"
                icon={IndianRupee}
                tone="blue"
                loading={isKpiLoading}
              />
              <KpiCard
                label="Tender Success"
                value={stats?.tenderSuccessRate || '0%'}
                subtext="Awarded vs closed"
                icon={CheckCircle2}
                tone="purple"
                loading={isKpiLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Col 3: Report Shortcuts */}
        <Card className="shadow-2xs flex flex-col md:col-span-2 lg:col-span-1">
          <CardHeader className="py-2 px-3 sm:px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
              Report Shortcuts
            </CardTitle>
            <span className="text-[10px] font-bold text-slate-400">Direct links</span>
          </CardHeader>
          <CardContent className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between gap-1 sm:gap-1.5">
            {[
              ['Procurement report', '/admin/reports/procurement', Gavel],
              ['Payments report', '/admin/reports/payments', CreditCard],
              ['Suppliers report', '/admin/reports/suppliers', Users],
              ['Roles & permissions', '/admin/rbac', KeyRound],
              ['Delivery operations', '/admin/delivery', Truck],
              ['Invoices', '/payments/invoices', FileText],
            ].map(([label, href, Icon]: any) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-[#12335f]/30 hover:bg-white hover:text-[#12335f] transition-all shadow-2xs group"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200/60 text-[#12335f] group-hover:bg-[#12335f] group-hover:text-white transition-colors">
                    <Icon className="h-3 w-3" />
                  </span>
                  <span>{label}</span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#12335f] transition-colors" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
