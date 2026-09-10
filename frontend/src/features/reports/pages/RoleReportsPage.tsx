'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { BarChart3, FileSpreadsheet, FileText, RefreshCw, Search, ShoppingCart, Truck, IndianRupee, Receipt } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { getApi } from '../../shared/apiClient';
import { procurementOrderApi } from '../../procurementBid/orderApi';
import { money } from '../../procurementBid/data';
import { InlineError, LoadingState } from '../../shared/FeatureStates';
import { Pagination } from '../../shared/Pagination';
import { usePagination } from '../../shared/hooks';
import { KpiCard } from '../../shared/KpiCard';
import { PdfEngine, DocumentConfig, moneyPdf } from '../../../lib/pdfEngine';
import { formatDateTime } from '../../shared/format';
import { downloadCsv } from '../../shared/exportUtils';
import { ExcelEngine, type ExcelDocumentConfig } from '../../../lib/excelEngine';

const COLORS = ['#12335f', '#0f766e', '#c86413', '#6366f1', '#dc2626', '#64748b'];

const asArray = (value: any) => Array.isArray(value) ? value : [];
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not recorded';
const monthKey = (value?: string) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};
const normalizeStatus = (value?: string) => String(value || 'Pending').replace(/_/g, ' ').toUpperCase();

export default function RoleReportsPage() {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const summary = useQuery({
        queryKey: ['role-report-summary', user?.role],
        queryFn: () => getApi<any>('/api/dashboard/summary', true),
        enabled: !!user,
    });

    const procurementOrders = useQuery({
        queryKey: ['role-report-orders', user?.role],
        queryFn: () => procurementOrderApi.listOrders(),
        enabled: !!user,
    });

    const purchaseOrders = useQuery({
        queryKey: ['role-report-live-purchase-orders', user?.role],
        queryFn: () => getApi<any>('/api/purchase-orders?take=500', true),
        enabled: !!user,
    });

    const orderRows = useMemo(() => {
        const primary = asArray(purchaseOrders.data?.items || purchaseOrders.data?.purchaseOrders || purchaseOrders.data?.records || purchaseOrders.data);
        const lifecycle = asArray(procurementOrders.data?.items || procurementOrders.data?.purchaseOrders || procurementOrders.data?.records);
        const byId = new Map<number, any>();
        [...primary, ...lifecycle].forEach((order) => {
            if (order?.id) byId.set(Number(order.id), order);
        });
        return Array.from(byId.values());
    }, [procurementOrders.data, purchaseOrders.data]);

    const filteredOrders = useMemo(() => {
        const text = query.trim().toLowerCase();
        return orderRows.filter((order) => {
            const haystack = [
                order.poNumber,
                order.title,
                order.status,
                order.buyer?.name,
                order.seller?.name,
                order.deliveryTrackings?.[0]?.status,
                order.grns?.[0]?.status,
                order.invoices?.[0]?.status,
            ].join(' ').toLowerCase();
            if (text && !haystack.includes(text)) return false;
            if (statusFilter && normalizeStatus(order.status) !== statusFilter) return false;
            return true;
        });
    }, [orderRows, query, statusFilter]);

    const { page, pageSize, pageItems: pagedOrders, total, setPage, setPageSize } = usePagination(filteredOrders, 10);

    const analytics = useMemo(() => buildAnalytics(filteredOrders, summary.data || {}, user?.role), [filteredOrders, summary.data, user?.role]);
    const statuses = useMemo(() => Array.from(new Set(orderRows.map((order) => normalizeStatus(order.status)))).sort(), [orderRows]);

    const isLoading = summary.isLoading || procurementOrders.isLoading || purchaseOrders.isLoading;
    const error = summary.error || procurementOrders.error || purchaseOrders.error;

    const exportRows = filteredOrders.map((order) => ({
        poNumber: order.poNumber || `PO-${order.id}`,
        title: order.title || '',
        buyer: order.buyer?.name || '',
        seller: order.seller?.name || '',
        amount: Number(order.amount || 0),
        status: normalizeStatus(order.status),
        delivery: normalizeStatus(order.deliveryTrackings?.[0]?.status),
        grn: normalizeStatus(order.grns?.[0]?.status),
        invoice: normalizeStatus(order.invoices?.[0]?.status),
        payment: normalizeStatus(order.payments?.[0]?.status || order.invoices?.[0]?.payments?.[0]?.status),
        createdAt: order.createdAt || '',
    }));

    const handleExport = async (type: 'csv' | 'print' | 'excel') => {
        if (type === 'print') {
            const tableData = exportRows.map((row, index) => [
              String(index + 1),
              row.poNumber,
              row.title,
              row.buyer,
              row.seller,
              moneyPdf(row.amount),
              row.status,
              row.createdAt ? formatDateTime(row.createdAt) : '-'
            ]);

            const config: DocumentConfig = {
              documentTitle: user?.role === 'seller' ? 'Seller Performance Report' : 'Buyer Procurement Report',
              documentNumber: `REP-${Date.now()}`,
              dateStr: formatDateTime(new Date()),
              status: 'GENERATED',
              parties: [],
              infoGrid: {
                'Total Orders': String(exportRows.length),
                'Generated By': user?.name || 'System User',
                'Role': String(user?.role).toUpperCase()
              },
              tableHeaders: ['Sr. No.', 'PO Number', 'Title', 'Buyer', 'Seller', 'Amount', 'Status', 'Created At'],
              tableData: tableData,
              notes: [
                'This report contains procurement lifecycle readiness data including delivery, GRN, and invoice statuses.',
                'Generated automatically by JSGSMILE MSME Procurement.'
              ]
            };

            const engine = new PdfEngine('l'); // Landscape for reports
            const doc = engine.generate(config);
            doc.save(`msme-${user?.role || 'user'}-reports-${new Date().toISOString().slice(0, 10)}.pdf`);
            return;
        }
        const filename = `msme-${user?.role || 'user'}-reports-${new Date().toISOString().slice(0, 10)}`;
        if (type === 'excel') {
            const config: ExcelDocumentConfig = {
              documentTitle: user?.role === 'seller' ? 'Seller Performance Report' : 'Buyer Procurement Report',
              documentNumber: `REP-${Date.now()}`,
              dateStr: formatDateTime(new Date()),
              infoGrid: {
                'Total Orders': String(exportRows.length),
                'Generated By': user?.name || 'System User',
                'Role': String(user?.role).toUpperCase()
              },
              columns: [
                { header: 'Sr. No.', key: 'srNo', width: 8 },
                { header: 'PO Number', key: 'poNumber', width: 18 },
                { header: 'Title', key: 'title', width: 35 },
                { header: 'Buyer', key: 'buyer', width: 25 },
                { header: 'Seller', key: 'seller', width: 25 },
                { header: 'Amount', key: 'amount', width: 18, isCurrency: true },
                { header: 'Status', key: 'status', width: 22 },
                { header: 'Delivery Status', key: 'delivery', width: 20 },
                { header: 'GRN Status', key: 'grn', width: 20 },
                { header: 'Invoice Status', key: 'invoice', width: 20 },
                { header: 'Payment Status', key: 'payment', width: 20 },
                { header: 'Created At', key: 'createdAt', width: 22 },
              ],
              data: exportRows.map((row, index) => ({
                srNo: index + 1,
                poNumber: row.poNumber,
                title: row.title,
                buyer: row.buyer,
                seller: row.seller,
                amount: row.amount, 
                status: row.status,
                delivery: row.delivery,
                grn: row.grn,
                invoice: row.invoice,
                payment: row.payment,
                createdAt: row.createdAt ? formatDateTime(row.createdAt) : '-'
              })),
              notes: [
                'This report contains procurement lifecycle readiness data including delivery, GRN, and invoice statuses.',
                'Generated automatically by JSG SMILE MSME Procurement.'
              ]
            };

            const engine = new ExcelEngine();
            const blob = await engine.generate(config);
            engine.download(blob, `${filename}.xlsx`);
            return;
        }
        
        // Export CSV
        const csvHeaders = ['Sr. No.', 'PO Number', 'Title', 'Buyer', 'Seller', 'Amount', 'Status', 'Delivery Status', 'GRN Status', 'Invoice Status', 'Payment Status', 'Created At'];
        const csvData = [
            csvHeaders,
            ...exportRows.map((row, index) => [
                String(index + 1),
                row.poNumber,
                row.title,
                row.buyer,
                row.seller,
                moneyPdf(row.amount),
                row.status,
                row.delivery,
                row.grn,
                row.invoice,
                row.payment,
                row.createdAt ? formatDateTime(row.createdAt) : '-'
            ])
        ];
        downloadCsv(`${filename}.csv`, csvData);
    };

    return (
        <div className="space-y-4">
            <section className="flex flex-col gap-3 pb-2">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-950">{user?.role === 'seller' ? 'Seller Performance Reports' : 'Buyer Procurement Reports'}</h1>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Executive dashboard for network health, onboarding metrics, and transaction analytics.</p>
                </div>
                
                {/* Compact Filter Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search orders..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#12335f] focus:outline-none focus:ring-1 focus:ring-[#12335f]"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]"
                        >
                            <option value="">All Statuses</option>
                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Date Range:</span>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">All Time</span>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => handleExport('excel')} className="h-9 gap-1.5 px-3 text-[10px] font-black uppercase bg-[#12335f] text-white hover:bg-[#0b2447] hover:text-white border-transparent" title="Export Excel">
                            <FileSpreadsheet className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Excel</span>
                        </Button>
                        <Button type="button" variant="outline" onClick={() => handleExport('csv')} className="h-9 gap-1.5 px-3 text-[10px] font-black uppercase bg-white" title="Export CSV">
                            <FileSpreadsheet className="h-3.5 w-3.5" /> <span className="hidden xl:inline">CSV</span>
                        </Button>
                        <Button type="button" variant="outline" onClick={() => handleExport('print')} className="h-9 gap-1.5 px-3 text-[10px] font-black uppercase bg-white" title="Print/PDF">
                            <FileText className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Print</span>
                        </Button>
                        <Button type="button" variant="outline" onClick={() => { summary.refetch(); procurementOrders.refetch(); purchaseOrders.refetch(); }} className="h-9 gap-1.5 px-3 text-[10px] font-black uppercase bg-white">
                            <RefreshCw className={`h-3.5 w-3.5 ${summary.isFetching || procurementOrders.isFetching || purchaseOrders.isFetching ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
                        </Button>
                    </div>
                </div>
            </section>

            {error ? <InlineError message={(error as Error).message} onRetry={() => { summary.refetch(); procurementOrders.refetch(); purchaseOrders.refetch(); }} /> : isLoading ? <LoadingState label="Loading analytical reports..." /> : (
                <>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {analytics.kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
                    </div>

                    <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                        <ReportCard title="Monthly Order Value" subtitle="PO value based on order creation month.">
                            {analytics.monthlyValue.length === 1 && (
                                <div className="mb-2 rounded bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700">
                                    Limited data for selected period (Only 1 month available)
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={analytics.monthlyValue}>
                                    <defs>
                                        <linearGradient id="valueFill" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="5%" stopColor="#12335f" stopOpacity={0.28} />
                                            <stop offset="95%" stopColor="#12335f" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={45} />
                                    <Tooltip formatter={(value) => money(Number(value || 0))} />
                                    <Area type="monotone" dataKey="value" stroke="#12335f" strokeWidth={3} fill="url(#valueFill)" name="Order value" dot={analytics.monthlyValue.length === 1 ? { r: 4, fill: '#12335f' } : false} activeDot={{ r: 6 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ReportCard>

                        <ReportCard title="Order Status Distribution" subtitle="Current status of filtered procurement orders.">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={analytics.statusDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={76} paddingAngle={3}>
                                        {analytics.statusDistribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-3 grid gap-1.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-2">
                                {analytics.statusDistribution.map((item, index) => (
                                    <div key={item.name} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold">
                                        <span className="inline-flex items-center gap-1.5 truncate pr-2" title={item.name}><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{item.name}</span>
                                        <span>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </ReportCard>
                    </section>

                    <section className="grid gap-4 xl:grid-cols-2">
                        <ReportCard title="Lifecycle Readiness" subtitle="Delivery, GRN, invoice, and payment progress.">
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={analytics.lifecycle}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
                                    <Tooltip />
                                    <Bar dataKey="completed" name="Completed / ready" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                    <Bar dataKey="pending" name="Pending" fill="#c86413" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ReportCard>

                        <ReportCard title="Procurement Aging" subtitle="Open order age from creation date.">
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={analytics.aging}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
                                    <Tooltip />
                                    <Bar dataKey="value" name="Orders" fill="#12335f" radius={[4, 4, 0, 0]} maxBarSize={80} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ReportCard>
                    </section>

                   
                </>
            )}
        </div>
    );
}

function buildAnalytics(orders: any[], summary: any, role?: string) {
    const totalValue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const activeOrders = orders.filter((order) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(normalizeStatus(order.status))).length;
    const pendingInvoices = role === 'seller' ? summary.sellerPendingInvoicesCount : summary.myPendingInvoicesCount;
    const opportunities = role === 'seller' ? summary.sellerOpenTendersCount : summary.myTendersCount;

    const statusMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();
    const aging = { '0-7 days': 0, '8-15 days': 0, '16-30 days': 0, '30+ days': 0 };
    let deliveryReady = 0;
    let grnReady = 0;
    let invoiceReady = 0;
    let paymentReady = 0;

    orders.forEach((order) => {
        const status = normalizeStatus(order.status);
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
        const month = monthKey(order.createdAt);
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + Number(order.amount || 0));
        const ageDays = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt || Date.now()).getTime()) / 86400000));
        if (ageDays <= 7) aging['0-7 days'] += 1;
        else if (ageDays <= 15) aging['8-15 days'] += 1;
        else if (ageDays <= 30) aging['16-30 days'] += 1;
        else aging['30+ days'] += 1;
        if (order.deliveryTrackings?.length) deliveryReady += 1;
        if (order.grns?.some((grn: any) => normalizeStatus(grn.status).includes('APPROVED'))) grnReady += 1;
        if (order.invoices?.length) invoiceReady += 1;
        if (order.payments?.length || order.invoices?.some((invoice: any) => invoice.payments?.length)) paymentReady += 1;
    });

    const count = orders.length || 1;
    return {
        kpis: [
            { label: 'Total order value', value: money(totalValue), subtext: `${orders.length} filtered orders`, hint: `${orders.length} filtered orders`, icon: IndianRupee, tone: 'indigo' },
            { label: 'Active orders', value: activeOrders.toLocaleString('en-IN'), subtext: 'Not completed or cancelled', hint: 'Not completed or cancelled', icon: Truck, tone: 'emerald' },
            { label: role === 'seller' ? 'Open opportunities' : 'Created tenders', value: Number(opportunities || 0).toLocaleString('en-IN'), subtext: 'From dashboard summary', hint: 'From dashboard summary', icon: FileText, tone: 'blue' },
            { label: 'Pending invoices', value: Number(pendingInvoices || 0).toLocaleString('en-IN'), subtext: 'Needs action or follow-up', hint: 'Needs action or follow-up', icon: Receipt, tone: 'amber' },
        ],
        statusDistribution: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
        monthlyValue: Array.from(monthlyMap.entries()).map(([month, value]) => ({ month, value })),
        aging: Object.entries(aging).map(([name, value]) => ({ name, value })),
        lifecycle: [
            { name: 'Delivery', completed: deliveryReady, pending: count - deliveryReady },
            { name: 'GRN', completed: grnReady, pending: count - grnReady },
            { name: 'Invoice', completed: invoiceReady, pending: count - invoiceReady },
            { name: 'Payment', completed: paymentReady, pending: count - paymentReady },
        ],
    };
}

function ReportCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 shadow-sm flex flex-col h-full">
            <div>
                <h2 className="text-[15px] leading-tight font-black text-slate-950">{title}</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{subtitle}</p>
            </div>
            <div className="mt-4 flex-1">{children}</div>
        </div>
    );
}

function WorkflowLink({ icon: Icon, title, text, href }: { icon: any; title: string; text: string; href: string }) {
    return (
        <Link href={href} className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 transition hover:border-[#12335f]/30 hover:bg-white">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#12335f]" />
            <span>
                <span className="block text-sm font-black text-slate-900">{title}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{text}</span>
            </span>
        </Link>
    );
}

function StatusPill({ label }: { label: string }) {
    return <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700">{label}</span>;
}
