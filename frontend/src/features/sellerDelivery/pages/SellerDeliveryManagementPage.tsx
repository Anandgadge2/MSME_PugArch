/**
 * SellerDeliveryManagementPage — sellers manage active deliveries.
 *
 * Route: /seller/delivery-management
 * Workflow buttons (status-aware):
 *   PENDING_ACCEPTANCE → Accept | Reject
 *   SELLER_ACCEPTED    → Mark Packed
 *   PACKED             → Add Dispatch Details → Ready for Pickup
 *   READY_FOR_PICKUP   → Save Dispatch Details
 *   Delivery Tracking  → Picked Up → In Transit → Out for Delivery → Delivered
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, FileText, Grid3x3, List, MoreVertical, Package, Paperclip, RefreshCw, Search, Send, Truck, Upload, UploadCloud, X, XCircle } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { compressImage } from '../../../lib/compress';
import { Button } from '../../../components/ui/button';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { Card, CardContent } from '../../../components/ui/card';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import { formatCurrency, formatDate, formatDateTime, formatRelative } from '../../shared/format';
import { runWithToast } from '../../../lib/toast';
import {
    useAddDeliveryDocument, useDeliveries, useDelivery, useManualStatusUpdate,
    useMarkPacked, useMarkReadyForPickup, useSellerAccept, useSellerReject,
    useUpdateDispatchDetails
} from '../hooks';
import type { DeliveryDto } from '../api';

const STATUS_TONE: Record<string, string> = {
    CREATED: 'border-amber-200 bg-amber-50 text-amber-800',
    PENDING_ACCEPTANCE: 'border-amber-200 bg-amber-50 text-amber-800',
    SELLER_ACCEPTED: 'border-blue-200 bg-blue-50 text-blue-800',
    SELLER_REJECTED: 'border-red-200 bg-red-50 text-red-800',
    PACKED: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    READY_FOR_PICKUP: 'border-purple-200 bg-purple-50 text-purple-800',
    PICKED_UP: 'border-sky-200 bg-sky-50 text-sky-800',
    DISPATCHED: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    IN_TRANSIT: 'border-blue-200 bg-blue-50 text-blue-800',
    OUT_FOR_DELIVERY: 'border-blue-200 bg-blue-50 text-blue-800',
    DELIVERED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    CANCELLED: 'border-slate-200 bg-slate-100 text-slate-700',
    DISPUTED: 'border-red-200 bg-red-50 text-red-800',
    RETURNED: 'border-orange-200 bg-orange-50 text-orange-800'
};

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'AWAITING_ACCEPTANCE', label: 'Awaiting Acceptance (Created/Pending)' },
    { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CREATED', label: 'Created' },
    { value: 'PENDING_ACCEPTANCE', label: 'Pending Acceptance' },
    { value: 'SELLER_ACCEPTED', label: 'Seller Accepted' },
    { value: 'PACKED', label: 'Packed' },
    { value: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
    { value: 'PICKED_UP', label: 'Picked Up' },
    { value: 'DISPATCHED', label: 'Dispatched' },
    { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'DISPUTED', label: 'Disputed' },
    { value: 'RETURNED', label: 'Returned' }
];

const MANUAL_TRACKING_FLOW = ['READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

const nextManualStatusFor = (status: string) => {
    if (status === 'DISPATCHED') return 'IN_TRANSIT';
    const index = MANUAL_TRACKING_FLOW.findIndex(step => step === status);
    if (index < 0 || index >= MANUAL_TRACKING_FLOW.length - 1) return null;
    return MANUAL_TRACKING_FLOW[index + 1];
};

const readableStatus = (status: string) => status.replace(/_/g, ' ');

function ActionButtons({ delivery, onAction }: { delivery: DeliveryDto; onAction: (kind: string) => void }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const status = String(delivery.status);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = () => setOpen(false);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [open]);

    const poId = delivery.purchaseOrder?.id || delivery.purchaseOrderId;
    const amount = delivery.purchaseOrder?.amount;

    return (
        <div className="relative inline-flex items-center justify-end" onClick={e => e.stopPropagation()}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(!open);
                }}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs focus:outline-none"
                title="Actions"
            >
                <MoreVertical className="h-4 w-4" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 flex flex-col gap-0.5 text-left animate-in fade-in zoom-in-95 duration-100">
                    {(status === 'CREATED' || status === 'PENDING_ACCEPTANCE') && (
                        <>
                            <button
                                type="button"
                                onClick={() => { setOpen(false); onAction('accept'); }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors text-left"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Accept Order</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setOpen(false); onAction('reject'); }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-rose-700 hover:bg-rose-50 transition-colors text-left"
                            >
                                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                <span>Reject Order</span>
                            </button>
                        </>
                    )}

                    {status === 'SELLER_ACCEPTED' && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); onAction('packed'); }}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-[#12335f] hover:bg-blue-50 transition-colors text-left"
                        >
                            <Package className="h-3.5 w-3.5 text-[#12335f]" />
                            <span>Mark Packed</span>
                        </button>
                    )}

                    {status === 'PACKED' && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); onAction('ready'); }}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-purple-700 hover:bg-purple-50 transition-colors text-left"
                        >
                            <Truck className="h-3.5 w-3.5 text-purple-600" />
                            <span>Ready for Pickup</span>
                        </button>
                    )}

                    {['READY_FOR_PICKUP', 'PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(status) && (
                        <>
                            {status === 'READY_FOR_PICKUP' && (
                                <button
                                    type="button"
                                    onClick={() => { setOpen(false); onAction('dispatch-details'); }}
                                    className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
                                >
                                    <Send className="h-3.5 w-3.5 text-[#12335f]" />
                                    <span>Dispatch Order</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { setOpen(false); onAction('track-info'); }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-[#12335f] hover:bg-blue-50 transition-colors text-left"
                            >
                                <Truck className="h-3.5 w-3.5 text-[#12335f]" />
                                <span>Update Status</span>
                            </button>
                        </>
                    )}

                    {['DELIVERED', 'COMPLETED', 'ACCEPTED'].includes(status) && (
                        <>
                            {poId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpen(false);
                                        router.push(`/seller/invoices?convertPoId=${poId}${amount !== undefined ? `&amount=${amount}` : ''}`);
                                    }}
                                    className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
                                >
                                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Create Invoice</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { setOpen(false); onAction('upload-pod'); }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors text-left"
                            >
                                <Upload className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Upload POD</span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function SellerDeliveryManagementPage() {
    const { data, isLoading, error, refetch, isFetching } = useDeliveries({ role: 'seller' });
    const [actionTarget, setActionTarget] = useState<{ kind: string; delivery: DeliveryDto } | null>(null);

    const [viewMode, setViewMode] = useResponsiveViewMode('seller-delivery-management:view-mode');
    const [searchQuery, setSearchQuery] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('search') || params.get('q') || params.get('po') || '';
        }
        return '';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const q = params.get('search') || params.get('q') || params.get('po') || '';
            if (q) setSearchQuery(q);
        }
    }, []);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('newest');

    const items = (data?.records || data?.items || []) as DeliveryDto[];
    const pendingCount = items.filter(item => item.status === 'CREATED' || item.status === 'PENDING_ACCEPTANCE').length;
    const inTransitCount = items.filter(item => ['PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(String(item.status))).length;
    const completedCount = items.filter(item => ['DELIVERED', 'COMPLETED', 'CLOSED'].includes(String(item.status))).length;

    // Apply filtering
    const filteredItems = items.filter(item => {
        // Status filter
        if (statusFilter !== 'ALL') {
            const status = String(item.status);
            if (statusFilter === 'AWAITING_ACCEPTANCE') {
                if (status !== 'CREATED' && status !== 'PENDING_ACCEPTANCE') return false;
            } else if (statusFilter === 'IN_TRANSIT') {
                if (!['PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(status)) return false;
            } else if (statusFilter === 'COMPLETED') {
                if (!['DELIVERED', 'COMPLETED', 'CLOSED'].includes(status)) return false;
            } else {
                if (status !== statusFilter) return false;
            }
        }

        // Search query filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const dlvId = `dlv-${item.id}`.toLowerCase();
            const poNumber = (item.purchaseOrder?.poNumber || '').toLowerCase();
            const buyerName = (item.purchaseOrder?.buyer?.name || '').toLowerCase();
            const title = (item.purchaseOrder?.title || '').toLowerCase();
            const trackingNum = (item.trackingNumber || '').toLowerCase();
            const carrier = (item.carrierName || '').toLowerCase();
            const partner = (item.logisticsPartnerName || '').toLowerCase();
            const amount = String(item.purchaseOrder?.amount || '').toLowerCase();

            const match = dlvId.includes(q) ||
                          poNumber.includes(q) ||
                          buyerName.includes(q) ||
                          title.includes(q) ||
                          trackingNum.includes(q) ||
                          carrier.includes(q) ||
                          partner.includes(q) ||
                          amount.includes(q);
            if (!match) return false;
        }

        return true;
    });

    type DeliverySortKey = 'id' | 'poNumber' | 'buyer' | 'amount' | 'status' | 'carrier' | 'eta' | 'createdAt';
    const [sortKey, setSortKey] = useState<DeliverySortKey>('createdAt');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const toggleSort = (key: DeliverySortKey) => {
        setSortDirection(prev => sortKey === key && prev === 'asc' ? 'desc' : 'asc');
        setSortKey(key);
        setPage(1);
    };

    // Apply sorting
    const sortedItems = [...filteredItems].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';
        if (sortKey === 'id') {
            valA = a.id;
            valB = b.id;
        } else if (sortKey === 'poNumber') {
            valA = a.purchaseOrder?.poNumber || '';
            valB = b.purchaseOrder?.poNumber || '';
        } else if (sortKey === 'buyer') {
            valA = a.purchaseOrder?.buyer?.name || '';
            valB = b.purchaseOrder?.buyer?.name || '';
        } else if (sortKey === 'amount') {
            valA = Number(a.purchaseOrder?.amount || 0);
            valB = Number(b.purchaseOrder?.amount || 0);
        } else if (sortKey === 'status') {
            valA = String(a.status || '');
            valB = String(b.status || '');
        } else if (sortKey === 'carrier') {
            valA = a.carrierName || '';
            valB = b.carrierName || '';
        } else if (sortKey === 'eta') {
            valA = a.expectedDelivery ? new Date(a.expectedDelivery).getTime() : 0;
            valB = b.expectedDelivery ? new Date(b.expectedDelivery).getTime() : 0;
        } else if (sortKey === 'createdAt') {
            valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        const res = strA.localeCompare(strB);
        return sortDirection === 'asc' ? res : -res;
    });

    const isFiltered = searchQuery.trim() !== '' || statusFilter !== 'ALL';
    
    const kpis = {
        total: items.length,
        awaitingAcceptance: items.filter(item => item.status === 'CREATED' || item.status === 'PENDING_ACCEPTANCE').length,
        inTransit: items.filter(item => ['PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(String(item.status))).length,
        completed: items.filter(item => ['DELIVERED', 'COMPLETED', 'CLOSED'].includes(String(item.status))).length
    };

    const { page, pageSize, pageItems: pagedDeliveries, total, setPage, setPageSize } = usePagination(sortedItems, 10);

    return (
        <div className="space-y-6">
            {/* Transparent Header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
                <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f] bg-[#12335f]/10 px-2.5 py-1 rounded-full">Fulfillment & Logistics</span>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">Delivery Management</h1>
                    <p className="text-xs font-semibold text-slate-500 mt-1">Accept delivery commitments, generate packing labels, and broadcast dispatches.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => refetch()}
                        className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
                    >
                        <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", isFetching ? 'animate-spin' : '')} /> Refresh
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard 
                    label="Awaiting Acceptance" 
                    value={kpis.awaitingAcceptance} 
                    subtext="Awaiting acceptance"
                    icon={Clock} 
                    active={statusFilter === 'AWAITING_ACCEPTANCE'}
                    onClick={() => setStatusFilter(statusFilter === 'AWAITING_ACCEPTANCE' ? 'ALL' : 'AWAITING_ACCEPTANCE')}
                    color="amber"
                />
                <KpiCard 
                    label="Active / In Transit" 
                    value={kpis.inTransit} 
                    subtext="Deliveries in transit"
                    icon={Truck} 
                    active={statusFilter === 'IN_TRANSIT'}
                    onClick={() => setStatusFilter(statusFilter === 'IN_TRANSIT' ? 'ALL' : 'IN_TRANSIT')}
                    color="blue"
                />
                <KpiCard 
                    label="Completed" 
                    value={kpis.completed} 
                    subtext="Completed deliveries"
                    icon={CheckCircle2} 
                    active={statusFilter === 'COMPLETED'}
                    onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
                    color="green"
                />
                <KpiCard 
                    label="Total Deliveries" 
                    value={kpis.total} 
                    subtext="All deliveries"
                    icon={Package} 
                    active={statusFilter === 'ALL'}
                    onClick={() => setStatusFilter('ALL')}
                    color="indigo"
                />
            </div>

            {/* ── Search + Filter + View Toggle Toolbar ── */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
                <ResponsiveFilterBar
                    activeFilterCount={(statusFilter !== 'ALL' ? 1 : 0) + (sortBy !== 'newest' ? 1 : 0)}
                    searchInput={
                        <div className="relative w-full">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by delivery #, PO #, buyer, tracking..."
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                            />
                        </div>
                    }
                    filters={
                        <>
                            <div className="w-full sm:w-auto sm:min-w-[150px]">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                >
                                    {STATUS_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full sm:w-auto sm:min-w-[140px]">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="value-desc">Value: High to Low</option>
                                    <option value="value-asc">Value: Low to High</option>
                                </select>
                            </div>

                            {(searchQuery || statusFilter !== 'ALL' || sortBy !== 'newest') && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('ALL');
                                        setSortBy('newest');
                                    }}
                                    className="h-10 rounded-xl border-rose-200 bg-rose-50/60 text-xs font-extrabold text-rose-700 hover:bg-rose-100 min-w-[80px]"
                                >
                                    Reset
                                </Button>
                            )}
                        </>
                    }
                    endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
                />
            </div>

            {error ? <InlineError message={(error as Error).message} onRetry={() => refetch()} /> :
                isLoading ? <LoadingState label="Loading deliveries..." /> :
                    sortedItems.length === 0 ? (
                        <Card><CardContent className="py-12">
                            <EmptyState 
                                title={isFiltered ? "No matching deliveries" : "No deliveries"} 
                                description={isFiltered ? "Try clearing your filters or search query to find other deliveries." : "No delivery records are linked to your seller account yet. Accepted purchase orders are converted into delivery tracking records before dispatch."} 
                            />
                        </CardContent></Card>
                    ) : (
                        <div className="space-y-4">
                            {viewMode === 'grid' ? (
                                <div className="grid gap-3 lg:grid-cols-2">
                                    {pagedDeliveries.map(delivery => (
                                        <DeliveryCard key={delivery.id} delivery={delivery} onAction={(kind) => setActionTarget({ kind, delivery })} />
                                    ))}
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                    <div className="overflow-x-auto w-full">
                                        <table data-ux-wrapped="true" className="w-full border-collapse text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-50/75 hover:bg-transparent">
                                                    <th className="w-14 px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Sr. No</th>
                                                    <th className="px-3 py-3 whitespace-nowrap"><SortableHeader label="Delivery ID" field="id" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                                    <th className="px-3 py-3 min-w-[160px] whitespace-nowrap"><SortableHeader label="Purchase Order" field="poNumber" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                                    <th className="px-3 py-3 min-w-[120px] whitespace-nowrap"><SortableHeader label="Buyer" field="buyer" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                                    <th className="px-3 py-3 text-right whitespace-nowrap"><SortableHeader label="Value" field="amount" activeField={sortKey} direction={sortDirection} onSort={toggleSort} align="right" /></th>
                                                    <th className="px-3 py-3 whitespace-nowrap"><SortableHeader label="Status" field="status" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                                    <th className="px-3 py-3 whitespace-nowrap"><SortableHeader label="Carrier & Tracking" field="carrier" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                                    <th className="px-3 py-3 whitespace-nowrap"><SortableHeader label="ETA / Expected" field="eta" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                                    <th className="w-16 px-3 py-3 pr-4 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 bg-white">
                                                {pagedDeliveries.map((delivery, index) => {
                                                    const status = String(delivery.status);
                                                    const rowNumber = (page - 1) * pageSize + index + 1;
                                                    
                                                    const stage = (s: string) => {
                                                        if (s === 'CREATED' || s === 'PENDING_ACCEPTANCE') return { label: 'Awaiting Acceptance', icon: Clock };
                                                        if (s === 'SELLER_ACCEPTED') return { label: 'Awaiting Packing', icon: Package };
                                                        if (s === 'PACKED') return { label: 'PACKED / Ready to Dispatch', icon: Truck };
                                                        if (s === 'READY_FOR_PICKUP') return { label: 'Ready for Pickup', icon: Truck };
                                                        if (s === 'PICKED_UP') return { label: 'Picked Up', icon: Truck };
                                                        if (['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s)) return { label: 'In Transit', icon: Truck };
                                                        if (['DELIVERED', 'COMPLETED', 'ACCEPTED'].includes(s)) return { label: 'Delivered', icon: CheckCircle2 };
                                                        return { label: s.replace(/_/g, ' '), icon: AlertCircle };
                                                    };
                                                    const { label: stageLabel } = stage(status);

                                                    return (
                                                        <tr key={delivery.id} className="hover:bg-slate-50/70 transition-colors">
                                                            <td className="px-3 py-3 font-mono text-xs text-slate-500 text-center whitespace-nowrap">{rowNumber}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <EntityIdLink label={`DLV-${delivery.id}`} id={delivery.id} size="sm" to={`/delivery/${delivery.id}`} />
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={delivery.purchaseOrder?.title || 'Delivery'}>
                                                                    {delivery.purchaseOrder?.title || 'Delivery'}
                                                                </div>
                                                                {delivery.purchaseOrder?.poNumber && (
                                                                    <div className="mt-0.5">
                                                                        <EntityIdLink label={delivery.purchaseOrder.poNumber} id={delivery.purchaseOrder.id} size="sm" to="/orders" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <span className="font-bold text-slate-700">{delivery.purchaseOrder?.buyer?.name || `#${delivery.purchaseOrder?.buyerId}`}</span>
                                                            </td>
                                                            <td className="text-right font-black text-slate-900 px-3 py-3 whitespace-nowrap">
                                                                {delivery.purchaseOrder?.amount !== undefined ? formatCurrency(delivery.purchaseOrder.amount) : '—'}
                                                            </td>
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <div className="flex flex-col gap-0.5 items-start">
                                                                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase ${STATUS_TONE[status] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                                                                        {status.replace(/_/g, ' ')}
                                                                    </span>
                                                                    <span className="text-[9px] font-semibold text-slate-400">{stageLabel}</span>
                                                                </div>
                                                            </td>
                                                            <td className="text-xs font-semibold text-slate-700 px-3 py-3 whitespace-nowrap">
                                                                {delivery.trackingNumber || delivery.carrierName ? (
                                                                    <div>
                                                                        {delivery.carrierName && <div className="font-bold text-slate-900">{delivery.carrierName}</div>}
                                                                        {delivery.trackingNumber && <div className="font-mono text-[10px] text-slate-500">No: {delivery.trackingNumber}</div>}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 italic text-[11px]">No details</span>
                                                                )}
                                                            </td>
                                                            <td className="text-xs font-semibold text-slate-700 px-3 py-3 whitespace-nowrap">
                                                                {delivery.expectedDelivery ? (
                                                                    <div>
                                                                        <div className="font-bold text-slate-900">{formatRelative(delivery.expectedDelivery)}</div>
                                                                        <div className="text-[10px] text-slate-400">{formatDate(delivery.expectedDelivery)}</div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 italic text-[11px]">—</span>
                                                                )}
                                                            </td>
                                                            <td className="text-right px-3 py-3 pr-4 whitespace-nowrap">
                                                                <ActionButtons delivery={delivery} onAction={(kind) => setActionTarget({ kind, delivery })} />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ═══ PAGINATION ═══ */}
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <Pagination
                                    page={page}
                                    pageSize={pageSize}
                                    total={total}
                                    onPageChange={setPage}
                                    onPageSizeChange={setPageSize}
                                    label="deliveries"
                                />
                            </div>
                        </div>
                    )
            }

            {actionTarget && (
                <ActionDialog
                    kind={actionTarget.kind}
                    delivery={actionTarget.delivery}
                    onClose={() => setActionTarget(null)}
                />
            )}
        </div>
    );
}

interface SummaryTileProps {
    label: string;
    value: string | number;
    icon: any;
    onClick?: () => void;
    active?: boolean;
    color?: 'blue' | 'green' | 'red' | 'purple' | 'amber' | 'indigo' | 'slate';
}

function SummaryTile({ label, value, icon: Icon, onClick, active, color = 'slate' }: SummaryTileProps) {
    return (
        <KpiCard
            label={label}
            value={value}
            subtext="Deliveries overview"
            icon={Icon}
            onClick={onClick}
            active={active}
            color={color}
        />
    );
}

function DeliveryCard({ delivery, onAction }: { delivery: DeliveryDto; onAction: (kind: string) => void }) {
    const status = String(delivery.status);

    const stage = (s: string) => {
        if (s === 'CREATED' || s === 'PENDING_ACCEPTANCE') return { label: 'Awaiting Acceptance', icon: Clock };
        if (s === 'SELLER_ACCEPTED') return { label: 'Awaiting Packing', icon: Package };
        if (s === 'PACKED') return { label: 'Packed', icon: Truck };
        if (s === 'READY_FOR_PICKUP') return { label: 'Ready for Pickup', icon: Truck };
        if (s === 'PICKED_UP') return { label: 'Picked Up', icon: Truck };
        if (['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s)) return { label: 'In Transit', icon: Truck };
        if (s === 'DELIVERED') return { label: 'Delivered', icon: CheckCircle2 };
        return { label: s.replace(/_/g, ' '), icon: AlertCircle };
    };

    const { label, icon: Icon } = stage(status);

    return (
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#12335f]/40 hover:shadow-md flex flex-col justify-between">
            <div className="w-full space-y-3">
                <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <EntityIdLink label={`DLV-${delivery.id}`} id={delivery.id} size="sm" to={`/delivery/${delivery.id}`} />
                            {delivery.purchaseOrder?.poNumber && (
                                <EntityIdLink label={delivery.purchaseOrder.poNumber} id={delivery.purchaseOrder.id} size="sm" to="/orders" />
                            )}
                        </div>
                        <p className="mt-1.5 text-sm font-black text-slate-900 leading-snug">{delivery.purchaseOrder?.title || 'Delivery'}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase ${STATUS_TONE[status] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                            {status.replace(/_/g, ' ')}
                        </span>
                        <p className="mt-1 text-[9px] font-black uppercase text-slate-400">{label}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-3">
                    <InfoTile label="Buyer" value={delivery.purchaseOrder?.buyer?.name || `#${delivery.purchaseOrder?.buyerId}`} />
                    <InfoTile label="Amount" value={delivery.purchaseOrder?.amount !== undefined ? formatCurrency(delivery.purchaseOrder.amount) : '—'} />
                    <InfoTile label="Carrier & Tracking" value={delivery.carrierName || delivery.trackingNumber ? `${delivery.carrierName || '-'}${delivery.trackingNumber ? ` (No: ${delivery.trackingNumber})` : ''}` : 'No details'} />
                    <InfoTile label="Expected Delivery" value={delivery.expectedDelivery ? `${formatRelative(delivery.expectedDelivery)} (${formatDate(delivery.expectedDelivery)})` : '—'} />
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                    <ActionButtons delivery={delivery} onAction={onAction} />
                </div>
            </div>
        </div>
    );
}

// ─── Action Dialog (multi-purpose modal) ─────────────────────────────────────

function ActionDialog({ kind, delivery, onClose }: { kind: string; delivery: DeliveryDto; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md max-h-[90vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">{kindToLabel(kind)}</h3>
                        <p className="mt-0.5 text-[10px] text-white/70">DLV-{delivery.id} · {delivery.purchaseOrder?.poNumber || ''}</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                    {kind === 'accept' && <AcceptForm delivery={delivery} onDone={onClose} />}
                    {kind === 'reject' && <RejectForm delivery={delivery} onDone={onClose} />}
                    {kind === 'packed' && <PackedForm delivery={delivery} onDone={onClose} />}
                    {kind === 'ready' && <ReadyForm delivery={delivery} onDone={onClose} />}
                    {kind === 'dispatch-details' && <DispatchDetailsForm delivery={delivery} onDone={onClose} />}
                    {kind === 'track-info' && <TrackInfoForm delivery={delivery} onDone={onClose} />}
                    {kind === 'upload-pod' && <UploadPodForm delivery={delivery} onDone={onClose} />}
                </div>
            </div>
        </div>
    );
}

function kindToLabel(kind: string): string {
    const map: Record<string, string> = {
        accept: 'Accept Order',
        reject: 'Reject Order',
        packed: 'Pack Order',
        ready: 'Ready for Pickup',
        'dispatch-details': 'Dispatch Order',
        'track-info': 'Tracking Details',
        'upload-pod': 'UPLOAD PROOF OF DELIVERY (POD)'
    };
    return map[kind] || 'Action';
}

function AcceptForm({ delivery, onDone }: { delivery: DeliveryDto; onDone: () => void }) {
    const [remarks, setRemarks] = useState('');
    const [eta, setEta] = useState('');
    const mut = useSellerAccept();
    return (
        <div className="space-y-3">
            <Field label="Expected Delivery Date">
                <input type="date" value={eta} onChange={e => setEta(e.target.value)} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-semibold" />
            </Field>
            <Field label="Remarks (optional)">
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} className="w-full rounded border border-slate-200 px-3 py-2 text-xs font-semibold" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onDone}>Cancel</Button>
                <Button
                    onClick={async () => {
                        await runWithToast(() => mut.mutateAsync({ id: delivery.id, data: { remarks: remarks.trim() || undefined, expectedDelivery: eta || undefined } }), {
                            loading: 'Accepting order...',
                            success: 'Order accepted successfully',
                            error: (err: any) => err?.message || 'Unable to accept delivery order'
                        });
                        onDone();
                    }}
                    disabled={mut.isPending}
                    className="bg-emerald-600 text-white"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Accept Order
                </Button>
            </div>
        </div>
    );
}

function RejectForm({ delivery, onDone }: { delivery: DeliveryDto; onDone: () => void }) {
    const [reason, setReason] = useState('');
    const mut = useSellerReject();
    return (
        <div className="space-y-3">
            <Field label="Rejection Reason">
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="Why are you rejecting this order?" required className="w-full rounded border border-slate-200 px-3 py-2 text-xs font-semibold" />
                <p className="text-[10px] text-slate-400">Buyer will be notified.</p>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onDone}>Cancel</Button>
                <Button
                    onClick={async () => {
                        if (reason.trim().length < 3) { toast.error('Provide a reason'); return; }
                        await runWithToast(() => mut.mutateAsync({ id: delivery.id, reason: reason.trim() }), {
                            loading: 'Rejecting...', success: 'Order rejected', error: 'Reject failed'
                        });
                        onDone();
                    }}
                    disabled={mut.isPending}
                    className="bg-red-600 text-white"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                    Confirm Rejection
                </Button>
            </div>
        </div>
    );
}

function PackedForm({ delivery, onDone }: { delivery: DeliveryDto; onDone: () => void }) {
    const parsedDims = useMemo(() => {
        if (!delivery.packageDimensions) return ['', '', ''];
        const matches = delivery.packageDimensions.match(/\d+(\.\d+)?/g);
        if (matches && matches.length >= 3) {
            return [matches[0], matches[1], matches[2]];
        }
        return ['', '', ''];
    }, [delivery.packageDimensions]);

    const [weight, setWeight] = useState<string>(delivery.packageWeightKg ? String(delivery.packageWeightKg) : '');
    const [count, setCount] = useState<string>(delivery.packageCount ? String(delivery.packageCount) : '');
    const [length, setLength] = useState<string>(parsedDims[0]);
    const [width, setWidth] = useState<string>(parsedDims[1]);
    const [height, setHeight] = useState<string>(parsedDims[2]);
    const [remarks, setRemarks] = useState<string>(delivery.remarks || '');
    const mut = useMarkPacked();

    const validatePositiveNumber = (val: string, fieldName: string): number | null => {
        const trimmed = String(val).trim();
        if (!trimmed) {
            toast.error(`Please enter ${fieldName}`);
            return null;
        }
        const num = Number(trimmed);
        if (isNaN(num) || !isFinite(num)) {
            toast.error(`${fieldName} must be a valid number`);
            return null;
        }
        if (num <= 0) {
            toast.error(`${fieldName} must be a positive number greater than 0`);
            return null;
        }
        return num;
    };

    const handleSave = async () => {
        const weightNum = validatePositiveNumber(weight, 'Weight (kg)');
        if (weightNum === null) return;

        const countNum = validatePositiveNumber(count, 'Packages');
        if (countNum === null) return;

        const lengthNum = validatePositiveNumber(length, 'Length (cm)');
        if (lengthNum === null) return;

        const widthNum = validatePositiveNumber(width, 'Width (cm)');
        if (widthNum === null) return;

        const heightNum = validatePositiveNumber(height, 'Height (cm)');
        if (heightNum === null) return;

        const formattedDimensions = `${lengthNum} × ${widthNum} × ${heightNum} cm`;

        await runWithToast(() => mut.mutateAsync({
            id: delivery.id,
            data: {
                packageWeightKg: weightNum,
                packageDimensions: formattedDimensions,
                packageCount: Math.round(countNum),
                remarks: remarks.trim() || undefined
            }
        }), {
            loading: 'Saving changes...',
            success: 'Order packing details saved successfully',
            error: (err: any) => err?.message || 'Failed to save order packing details'
        });
        onDone();
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Weight (kg)">
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        placeholder="e.g. 10.5"
                        className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                    />
                </Field>
                <Field label="Packages">
                    <input
                        type="number"
                        step="1"
                        min="1"
                        value={count}
                        onChange={e => setCount(e.target.value)}
                        placeholder="e.g. 2"
                        className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                    />
                </Field>
            </div>

            <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Dimensions — Length × Width × Height (cm)
                </label>
                <div className="grid grid-cols-3 gap-2">
                    <Field label="Length (cm)">
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={length}
                            onChange={e => setLength(e.target.value)}
                            placeholder="L"
                            className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                        />
                    </Field>
                    <Field label="Width (cm)">
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={width}
                            onChange={e => setWidth(e.target.value)}
                            placeholder="W"
                            className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                        />
                    </Field>
                    <Field label="Height (cm)">
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={height}
                            onChange={e => setHeight(e.target.value)}
                            placeholder="H"
                            className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                        />
                    </Field>
                </div>
            </div>

            <Field label="Remarks (optional)">
                <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Add packing remarks…"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 resize-none"
                />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onDone}>Cancel</Button>
                <Button
                    onClick={handleSave}
                    disabled={mut.isPending}
                    className="bg-[#12335f] text-white hover:bg-[#0b2447]"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}

function DispatchDetailsForm({ delivery, onDone }: { delivery: DeliveryDto; onDone: () => void }) {
    const [trackingNumber, setTrackingNumber] = useState(delivery.trackingNumber || '');
    const [carrierName, setCarrierName] = useState(delivery.carrierName || '');
    const [eta, setEta] = useState((delivery.expectedDelivery || '').slice(0, 10));
    const mut = useUpdateDispatchDetails();
    return (
        <div className="space-y-3">
            <Field label="Tracking Number">
                <input type="text" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
                <Field label="Carrier Name">
                    <input type="text" value={carrierName} onChange={e => setCarrierName(e.target.value)} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-semibold" />
                </Field>
                <Field label="Expected Delivery">
                    <input type="date" value={eta} onChange={e => setEta(e.target.value)} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-semibold" />
                </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onDone}>Cancel</Button>
                <Button
                    onClick={async () => {
                        await runWithToast(() => mut.mutateAsync({
                            id: delivery.id, data: {
                                trackingNumber: trackingNumber.trim() || undefined,
                                carrierName: carrierName.trim() || undefined,
                                expectedDelivery: eta || undefined
                            }
                        }), { loading: 'Saving...', success: 'Dispatch details saved', error: 'Failed' });
                        onDone();
                    }}
                    disabled={mut.isPending}
                    className="bg-[#12335f] text-white"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                    Save Dispatch Details
                </Button>
            </div>
        </div>
    );
}

function ReadyForm({ delivery, onDone }: { delivery: DeliveryDto; onDone: () => void }) {
    const mut = useMarkReadyForPickup();
    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 text-xs text-purple-900 font-semibold">
                <Truck className="inline h-4 w-4 mr-1.5 text-purple-600" />
                Confirm that DLV-{delivery.id} is packed and ready for pickup. Once confirmed, status changes to <strong>READY FOR PICKUP</strong>.
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onDone}>Cancel</Button>
                <Button
                    onClick={async () => {
                        await runWithToast(() => mut.mutateAsync(delivery.id), {
                            loading: 'Marking ready...',
                            success: 'Status updated: READY FOR PICKUP',
                            error: (err: any) => err?.message || 'Failed'
                        });
                        onDone();
                    }}
                    disabled={mut.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                    Confirm Ready for Pickup
                </Button>
            </div>
        </div>
    );
}

function TrackInfoForm({ delivery: initialDelivery, onDone }: { delivery: DeliveryDto; onDone: () => void }) {
    const { data: freshDelivery } = useDelivery(initialDelivery.id);
    const delivery = freshDelivery || initialDelivery;
    const nextStatus = nextManualStatusFor(String(delivery.status));
    const mut = useManualStatusUpdate();

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">Current Status</span>
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase ${STATUS_TONE[String(delivery.status)] || ''}`}>
                        {readableStatus(String(delivery.status))}
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs font-semibold text-slate-700 pt-1 sm:grid-cols-2">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Tracking Number</span>
                        <span className="font-mono text-slate-900">{delivery.trackingNumber || `DLV-${delivery.id}`}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Carrier</span>
                        <span className="font-bold text-slate-900">{delivery.carrierName || delivery.logisticsPartnerName || 'Pending'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Expected Delivery</span>
                        <span className="text-slate-900">{delivery.expectedDelivery ? formatDate(delivery.expectedDelivery) : 'Pending'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Latest Manual Update</span>
                        <span className="text-slate-900">{readableStatus(String(delivery.status))}</span>
                        {delivery.updatedAt && <span className="ml-1 text-[10px] text-slate-400">({formatDate(delivery.updatedAt)})</span>}
                    </div>
                </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Next Status</span>
                <div className="mt-1 font-black text-slate-900">
                    {nextStatus ? readableStatus(nextStatus) : 'No further seller update available'}
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={onDone}>Close</Button>
                <Button
                    onClick={async () => {
                        if (!nextStatus) return;
                        await runWithToast(() => mut.mutateAsync({ id: delivery.id, data: { status: nextStatus } }), {
                            loading: 'Updating status...',
                            success: `Status updated: ${readableStatus(nextStatus)}`,
                            error: (err: any) => err?.message || 'Status update failed'
                        });
                        onDone();
                    }}
                    disabled={!nextStatus || mut.isPending}
                    className="bg-[#12335f] text-white"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                    Update Status
                </Button>
            </div>
        </div>
    );
}

function UploadPodForm({ delivery, onDone }: { delivery: DeliveryDto; onDone: () => void }) {
    const [docType, setDocType] = useState('PROOF_OF_DELIVERY');
    const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [receivedBy, setReceivedBy] = useState('');
    const [recipientContact, setRecipientContact] = useState('');
    const [remarks, setRemarks] = useState('');
    const [fileAssetId, setFileAssetId] = useState<number | ''>('');
    const [uploadedFile, setUploadedFile] = useState<{ name: string; size?: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const mut = useAddDeliveryDocument();

    const validateAndProcessFile = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

        // 1. Format validation
        if (!allowedExts.includes(ext || '') && !allowedMimes.includes(file.type)) {
            toast.error('Invalid document format. Only PDF, JPG, or PNG files are supported for Proof of Delivery.');
            return;
        }

        // 2. Unrelated document check (quotation/tender)
        const nameLower = file.name.toLowerCase();
        if (nameLower.includes('quotation') || nameLower.includes('quote_') || nameLower.includes('tender_') || nameLower.includes('rfq_')) {
            toast.error('Quotation or tender documents cannot be submitted as Proof of Delivery (POD). Please attach a valid POD document.');
            return;
        }

        // 3. Size limit check (10 MB)
        const maxSizeBytes = 10 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            toast.error(`File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB selected).`);
            return;
        }

        setIsUploading(true);
        try {
            const fileToUpload = await compressImage(file);
            const formData = new FormData();
            formData.append('file', fileToUpload);

            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await api.fetch('/api/upload', {
                method: 'POST',
                headers,
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                const fileId = Number(data?.fileId || data?.file?.id || data?.id || data?.data?.fileId || data?.data?.id || 0);
                if (fileId > 0) {
                    setFileAssetId(fileId);
                    const formattedSize = file.size > 1024 * 1024
                        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                        : `${Math.round(file.size / 1024)} KB`;
                    setUploadedFile({ name: file.name, size: formattedSize });
                    toast.success(`POD File "${file.name}" uploaded successfully`);
                } else {
                    toast.error('Upload succeeded but no File Asset ID was returned');
                }
            } else {
                toast.error('Failed to upload POD file');
            }
        } catch (err: any) {
            toast.error(err?.message || 'Error uploading POD file');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) validateAndProcessFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) validateAndProcessFile(file);
    };

    const handleRemoveFile = () => {
        setUploadedFile(null);
        setFileAssetId('');
    };

    const handleSubmit = async () => {
        if (!fileAssetId) {
            toast.error('Please upload a valid POD document file (PDF, JPG, PNG).');
            return;
        }
        if (!deliveryDate) {
            toast.error('Please select a Delivery Date.');
            return;
        }
        if (!receivedBy.trim()) {
            toast.error('Please enter the recipient name in "Received By".');
            return;
        }

        const parts = [
            `Received By: ${receivedBy.trim()}`,
            `Delivery Date: ${deliveryDate}`,
            recipientContact.trim() ? `Contact: ${recipientContact.trim()}` : '',
            remarks.trim() ? `Remarks: ${remarks.trim()}` : ''
        ].filter(Boolean);

        const compositeDescription = parts.join(' | ').slice(0, 500);

        await runWithToast(() => mut.mutateAsync({
            id: delivery.id,
            data: {
                documentType: docType,
                fileAssetId: Number(fileAssetId),
                description: compositeDescription
            }
        }), {
            loading: 'Submitting Proof of Delivery (POD)...',
            success: 'POD document submitted successfully',
            error: (err: any) => err?.message || 'Failed to submit POD'
        });

        onDone();
    };

    return (
        <div className="space-y-4 text-left">
            <p className="text-xs font-semibold text-slate-600">
                Attach Proof of Delivery (POD) or recipient receipt for DLV-{delivery.id}.
            </p>

            <Field label="Document Type">
                <select
                    value={docType}
                    onChange={e => setDocType(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                >
                    <option value="PROOF_OF_DELIVERY">Proof of Delivery (POD)</option>
                    <option value="DELIVERY_CHALLAN">Delivery Challan</option>
                    <option value="COURIER_RECEIPT">Courier Receipt</option>
                    <option value="TAX_INVOICE">Tax Invoice</option>
                    <option value="OTHER">Other Document</option>
                </select>
            </Field>

            {/* POD Document Upload Area */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Attach POD Document <span className="text-red-500">*</span></span>
                    <span className="text-[9px] font-bold text-slate-400 normal-case">PDF, JPG, PNG • Max 10 MB</span>
                </label>

                {uploadedFile ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                                <Paperclip className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="truncate text-xs font-bold text-emerald-950" title={uploadedFile.name}>
                                        {uploadedFile.name}
                                    </p>
                                    <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-emerald-200/80 px-2 py-0.5 text-[9px] font-black text-emerald-800">
                                        <CheckCircle2 className="h-3 w-3" /> Attached
                                    </span>
                                </div>
                                <p className="text-[10px] font-semibold text-emerald-700">
                                    {uploadedFile.size} • Asset ID #{fileAssetId}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="ml-2 shrink-0 rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition"
                            title="Remove attached file"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                            isDragging
                                ? 'border-[#12335f] bg-blue-50/50 scale-[1.01]'
                                : 'border-slate-200 bg-slate-50/60 hover:border-[#12335f]/50 hover:bg-slate-50'
                        }`}
                    >
                        <input
                            type="file"
                            id="pod-file-input"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                        <label
                            htmlFor="pod-file-input"
                            className="flex flex-col items-center justify-center cursor-pointer w-full"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-[#12335f] shadow-sm mb-2">
                                {isUploading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <UploadCloud className="h-5 w-5" />
                                )}
                            </div>
                            <p className="text-xs font-bold text-slate-800">
                                {isUploading ? 'Uploading file…' : 'Drag & drop or Click to Browse Files'}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-1">
                                PDF, JPG, PNG • Max 10 MB
                            </p>
                        </label>
                    </div>
                )}
            </div>

            {/* Read-Only Asset ID metadata */}
            {fileAssetId ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-semibold text-slate-600 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400">System Asset ID (Read-Only)</span>
                    <span className="font-bold text-slate-900">#{fileAssetId}</span>
                </div>
            ) : null}

            {/* Delivery Date & Received By */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Delivery Date *">
                    <input
                        type="date"
                        value={deliveryDate}
                        onChange={e => setDeliveryDate(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                        required
                    />
                </Field>
                <Field label="Received By *">
                    <input
                        type="text"
                        value={receivedBy}
                        onChange={e => setReceivedBy(e.target.value)}
                        placeholder="e.g. Rajesh Sharma / Warehouse Incharge"
                        className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                        required
                    />
                </Field>
            </div>

            {/* Recipient Contact (Optional) */}
            <Field label="Recipient Contact (Optional)">
                <input
                    type="text"
                    value={recipientContact}
                    onChange={e => setRecipientContact(e.target.value)}
                    placeholder="e.g. +91 98765 43210 or recipient@company.com"
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                />
            </Field>

            {/* Delivery Remarks (Optional) */}
            <Field label="Delivery Remarks (Optional)">
                <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Add delivery remarks, discrepancies, or recipient comments…"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 resize-none"
                />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" onClick={onDone}>Cancel</Button>
                <Button
                    onClick={handleSubmit}
                    disabled={mut.isPending || isUploading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Submit POD
                </Button>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</label>
            {children}
        </div>
    );
}

function InfoTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 break-words text-xs font-bold text-slate-800">{value || '-'}</p>
        </div>
    );
}
