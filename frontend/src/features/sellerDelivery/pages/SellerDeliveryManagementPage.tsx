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
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, FileText, Grid3x3, List, Package, RefreshCw, Search, Send, Truck, Upload, X, XCircle } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/card';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import { formatCurrency, formatDateTime, formatRelative } from '../../shared/format';
import { runWithToast } from '../../../lib/toast';
import {
    useAddDeliveryDocument, useDeliveries, useManualStatusUpdate,
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
    const status = String(delivery.status);

    if (status === 'CREATED' || status === 'PENDING_ACCEPTANCE') {
        return (
            <div className="flex justify-end gap-1.5">
                <button 
                    onClick={() => onAction('accept')} 
                    className="h-7 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase px-2.5 transition active:scale-95 shadow-sm"
                >
                    Accept
                </button>
                <button 
                    onClick={() => onAction('reject')} 
                    className="h-7 rounded-md border border-red-200 text-red-700 hover:bg-red-50 font-black text-[10px] uppercase px-2.5 transition active:scale-95"
                >
                    Reject
                </button>
            </div>
        );
    }

    if (status === 'SELLER_ACCEPTED') {
        return (
            <button 
                onClick={() => onAction('packed')} 
                className="h-7 rounded-md bg-[#12335f] text-white hover:bg-brand-deep font-black text-[10px] uppercase px-3 transition active:scale-95 shadow-sm flex items-center gap-1 ml-auto"
            >
                <Package className="h-3 w-3" /> Pack
            </button>
        );
    }

    if (status === 'PACKED') {
        return (
            <button 
                onClick={() => onAction('ready')} 
                className="h-7 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase px-3 transition active:scale-95 shadow-sm flex items-center gap-1 ml-auto"
            >
                <Truck className="h-3 w-3" /> Ready for Pickup
            </button>
        );
    }

    if (['READY_FOR_PICKUP', 'PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(status)) {
        return (
            <div className="flex justify-end gap-1.5">
                {status === 'READY_FOR_PICKUP' && (
                    <button
                        onClick={() => onAction('dispatch-details')}
                        className="h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-[10px] uppercase px-3 transition active:scale-95 flex items-center gap-1 shadow-sm"
                    >
                        <Send className="h-3 w-3 text-[#12335f]" /> Dispatch
                    </button>
                )}
                <button
                    onClick={() => onAction('track-info')}
                    className="h-7 rounded-md bg-[#12335f] text-white hover:bg-brand-deep font-black text-[10px] uppercase px-3 transition active:scale-95 flex items-center gap-1 shadow-sm"
                >
                    <Truck className="h-3 w-3" /> Update Status
                </button>
            </div>
        );
    }

    if (['DELIVERED', 'COMPLETED', 'ACCEPTED'].includes(status)) {
        const poId = delivery.purchaseOrder?.id || delivery.purchaseOrderId;
        const amount = delivery.purchaseOrder?.amount;

        return (
            <div className="flex justify-end gap-1.5 items-center">
                {poId && (
                    <button 
                        type="button"
                        onClick={() => router.push(`/seller/invoices?convertPoId=${poId}${amount !== undefined ? `&amount=${amount}` : ''}`)} 
                        className="h-7 rounded-md bg-[#12335f] hover:bg-[#0e2a4f] text-white font-black text-[10px] uppercase px-3 transition active:scale-95 flex items-center gap-1 shadow-sm"
                    >
                        <FileText className="h-3 w-3" /> Create Invoice
                    </button>
                )}
                <button 
                    type="button"
                    onClick={() => onAction('upload-pod')} 
                    className="h-7 rounded-md border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase px-3 transition active:scale-95 flex items-center gap-1"
                >
                    <Upload className="h-3 w-3 text-emerald-600" /> Upload POD
                </button>
            </div>
        );
    }

    return null;
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile 
                    label="Awaiting Acceptance" 
                    value={kpis.awaitingAcceptance} 
                    icon={Clock} 
                    active={statusFilter === 'AWAITING_ACCEPTANCE'}
                    onClick={() => setStatusFilter(statusFilter === 'AWAITING_ACCEPTANCE' ? 'ALL' : 'AWAITING_ACCEPTANCE')}
                    color="amber"
                />
                <SummaryTile 
                    label="Active / In Transit" 
                    value={kpis.inTransit} 
                    icon={Truck} 
                    active={statusFilter === 'IN_TRANSIT'}
                    onClick={() => setStatusFilter(statusFilter === 'IN_TRANSIT' ? 'ALL' : 'IN_TRANSIT')}
                    color="blue"
                />
                <SummaryTile 
                    label="Completed" 
                    value={kpis.completed} 
                    icon={CheckCircle2} 
                    active={statusFilter === 'COMPLETED'}
                    onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
                    color="green"
                />
                <SummaryTile 
                    label="Total Deliveries" 
                    value={kpis.total} 
                    icon={Package} 
                    active={statusFilter === 'ALL'}
                    onClick={() => setStatusFilter('ALL')}
                    color="indigo"
                />
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between border-y border-slate-200 bg-slate-50/50 py-3 px-1">
                <div className="relative min-w-0 flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by delivery #, PO #, buyer, tracking..."
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="h-10 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="value-desc">Value: High to Low</option>
                        <option value="value-asc">Value: Low to High</option>
                    </select>

                    <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            title="List view"
                            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wide transition-all duration-150 ${
                                viewMode === 'list'
                                    ? 'bg-slate-100 text-[#12335f] shadow-sm'
                                    : 'text-slate-500 hover:text-[#12335f]'
                            }`}
                        >
                            <List className="h-3.5 w-3.5" /> List
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            title="Grid view"
                            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wide transition-all duration-150 ${
                                viewMode === 'grid'
                                    ? 'bg-slate-100 text-[#12335f] shadow-sm'
                                    : 'text-slate-500 hover:text-[#12335f]'
                            }`}
                        >
                            <Grid3x3 className="h-3.5 w-3.5" /> Grid
                        </button>
                    </div>
                </div>
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
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[960px] border-collapse text-left text-xs">
                                            <TableHeader>
                                                <TableRow className="border-b border-slate-200 bg-slate-50/75 hover:bg-transparent">
                                                    <TableHead className="w-16 p-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Sr. No</TableHead>
                                                    <TableHead className="p-3"><SortableHeader label="Delivery ID" field="id" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></TableHead>
                                                    <TableHead className="p-3"><SortableHeader label="Purchase Order" field="poNumber" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></TableHead>
                                                    <TableHead className="p-3"><SortableHeader label="Buyer" field="buyer" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></TableHead>
                                                    <TableHead className="text-right p-3"><SortableHeader label="Value" field="amount" activeField={sortKey} direction={sortDirection} onSort={toggleSort} className="justify-end" /></TableHead>
                                                    <TableHead className="p-3"><SortableHeader label="Status" field="status" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></TableHead>
                                                    <TableHead className="p-3"><SortableHeader label="Carrier & Tracking" field="carrier" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></TableHead>
                                                    <TableHead className="p-3"><SortableHeader label="ETA / Expected" field="eta" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></TableHead>
                                                    <TableHead className="text-right w-[200px] p-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="divide-y divide-slate-100 font-semibold text-slate-700">
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
                                                        <TableRow key={delivery.id} className="hover:bg-slate-50/50 transition">
                                                            <TableCell className="p-3 font-mono text-xs text-slate-500">{rowNumber}</TableCell>
                                                            <TableCell className="p-3">
                                                                <EntityIdLink label={`DLV-${delivery.id}`} id={delivery.id} size="sm" to={`/delivery/${delivery.id}`} />
                                                            </TableCell>
                                                            <TableCell className="p-3">
                                                                <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={delivery.purchaseOrder?.title || 'Delivery'}>
                                                                    {delivery.purchaseOrder?.title || 'Delivery'}
                                                                </div>
                                                                {delivery.purchaseOrder?.poNumber && (
                                                                    <div className="mt-0.5">
                                                                        <EntityIdLink label={delivery.purchaseOrder.poNumber} id={delivery.purchaseOrder.id} size="sm" to="/orders" />
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="p-3">
                                                                <span className="font-bold text-slate-700">{delivery.purchaseOrder?.buyer?.name || `#${delivery.purchaseOrder?.buyerId}`}</span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-black text-slate-900 p-3">
                                                                {delivery.purchaseOrder?.amount !== undefined ? formatCurrency(delivery.purchaseOrder.amount) : '—'}
                                                            </TableCell>
                                                            <TableCell className="p-3">
                                                                <div className="flex flex-col gap-0.5 items-start">
                                                                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase ${STATUS_TONE[status] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                                                                        {status.replace(/_/g, ' ')}
                                                                    </span>
                                                                    <span className="text-[9px] font-semibold text-slate-400">{stageLabel}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs font-semibold text-slate-700 p-3">
                                                                {delivery.trackingNumber || delivery.carrierName ? (
                                                                    <div>
                                                                        {delivery.carrierName && <div className="font-bold text-slate-900">{delivery.carrierName}</div>}
                                                                        {delivery.trackingNumber && <div className="font-mono text-[10px] text-slate-500">No: {delivery.trackingNumber}</div>}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 italic text-[11px]">No details</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-semibold text-slate-700 p-3">
                                                                {delivery.expectedDelivery ? (
                                                                    <div>
                                                                        <div className="font-bold text-slate-900">{formatRelative(delivery.expectedDelivery)}</div>
                                                                        <div className="text-[10px] text-slate-400">{formatDateTime(delivery.expectedDelivery).slice(0, 10)}</div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 italic text-[11px]">—</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right p-3">
                                                                <ActionButtons delivery={delivery} onAction={(kind) => setActionTarget({ kind, delivery })} />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
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
    const colorMap = {
        blue: 'border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-blue-700 hover:border-blue-300 ring-blue-600/10',
        green: 'border-green-100 bg-green-50/50 hover:bg-green-50 text-green-700 hover:border-green-300 ring-green-600/10',
        red: 'border-red-100 bg-red-50/50 hover:bg-red-50 text-red-700 hover:border-red-300 ring-red-600/10',
        purple: 'border-purple-100 bg-purple-50/50 hover:bg-purple-50 text-purple-700 hover:border-purple-300 ring-purple-600/10',
        amber: 'border-amber-100 bg-amber-50/50 hover:bg-amber-50 text-amber-700 hover:border-amber-300 ring-amber-600/10',
        indigo: 'border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 hover:border-indigo-300 ring-indigo-600/10',
        slate: 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-700 hover:border-slate-300 ring-slate-600/10',
    };

    const activeColorMap = {
        blue: 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20',
        green: 'border-green-500 bg-green-50 text-green-800 ring-2 ring-green-500/20',
        red: 'border-red-500 bg-red-50 text-red-800 ring-2 ring-red-500/20',
        purple: 'border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-500/20',
        amber: 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20',
        indigo: 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20',
        slate: 'border-slate-500 bg-slate-50 text-slate-800 ring-2 ring-slate-500/20',
    };

    const iconBgMap = {
        blue: 'bg-blue-500 text-white',
        green: 'bg-green-500 text-white',
        red: 'bg-red-500 text-white',
        purple: 'bg-purple-500 text-white',
        amber: 'bg-amber-500 text-white',
        indigo: 'bg-indigo-500 text-white',
        slate: 'bg-slate-500 text-white',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'w-full text-left rounded-2xl border p-4 shadow-sm transition-all duration-300 flex items-center justify-between',
                active ? activeColorMap[color] : colorMap[color]
            )}
        >
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
                <p className="mt-1 text-2xl font-black tracking-tight leading-none">{value}</p>
            </div>
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 hover:scale-110', iconBgMap[color])}>
                <Icon className="h-4.5 w-4.5" />
            </div>
        </button>
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
                    <InfoTile label="Expected Delivery" value={delivery.expectedDelivery ? `${formatRelative(delivery.expectedDelivery)} (${formatDateTime(delivery.expectedDelivery).slice(0, 10)})` : '—'} />
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
        'upload-pod': 'Upload Delivery Proof (POD)'
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
    const [weight, setWeight] = useState<number | ''>('');
    const [dim, setDim] = useState('');
    const [count, setCount] = useState<number | ''>('');
    const [remarks, setRemarks] = useState('');
    const mut = useMarkPacked();
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                <Field label="Weight (kg)">
                    <input type="number" step="0.01" value={weight} onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold" />
                </Field>
                <Field label="Packages">
                    <input type="number" value={count} onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold" />
                </Field>
                <Field label="Dimensions">
                    <input type="text" value={dim} onChange={e => setDim(e.target.value)} placeholder="LxWxH cm" className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-semibold" />
                </Field>
            </div>
            <Field label="Remarks (optional)">
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} className="w-full rounded border border-slate-200 px-3 py-2 text-xs font-semibold" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onDone}>Cancel</Button>
                <Button
                    onClick={async () => {
                        await runWithToast(() => mut.mutateAsync({
                            id: delivery.id, data: {
                                packageWeightKg: weight === '' ? undefined : weight,
                                packageDimensions: dim.trim() || undefined,
                                packageCount: count === '' ? undefined : count,
                                remarks: remarks.trim() || undefined
                            }
                        }), { loading: 'Saving...', success: 'Marked packed', error: 'Failed' });
                        onDone();
                    }}
                    disabled={mut.isPending}
                    className="bg-[#12335f] text-white"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                    Mark Packed
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

function TrackInfoForm({ delivery, onDone }: { delivery: DeliveryDto; onDone: () => void }) {
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
                        <span className="text-slate-900">{delivery.expectedDelivery ? formatDateTime(delivery.expectedDelivery).slice(0, 10) : 'Pending'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Latest Manual Update</span>
                        <span className="text-slate-900">{readableStatus(String(delivery.status))}</span>
                        {delivery.updatedAt && <span className="ml-1 text-[10px] text-slate-400">({formatDateTime(delivery.updatedAt).slice(0, 10)})</span>}
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
    const [description, setDescription] = useState('');
    const [fileAssetId, setFileAssetId] = useState<number | ''>('');
    const mut = useAddDeliveryDocument();

    return (
        <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600">
                Attach Proof of Delivery (POD) or recipient receipt for DLV-{delivery.id}.
            </p>
            <Field label="Document Type">
                <select value={docType} onChange={e => setDocType(e.target.value)} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-bold">
                    <option value="PROOF_OF_DELIVERY">Proof of Delivery (POD)</option>
                    <option value="DELIVERY_CHALLAN">Delivery Challan</option>
                    <option value="COURIER_RECEIPT">Courier Receipt</option>
                    <option value="TAX_INVOICE">Tax Invoice</option>
                    <option value="OTHER">Other Document</option>
                </select>
            </Field>
            <Field label="File Asset ID / Ref #">
                <input
                    type="number"
                    value={fileAssetId}
                    onChange={e => setFileAssetId(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Enter uploaded file asset ID"
                    className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold"
                />
            </Field>
            <Field label="Description (optional)">
                <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. Signed LR copy by recipient"
                    className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-semibold"
                />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onDone}>Cancel</Button>
                <Button
                    onClick={async () => {
                        if (!fileAssetId) {
                            toast.error('Please enter a valid File Asset ID');
                            return;
                        }
                        await runWithToast(() => mut.mutateAsync({
                            id: delivery.id,
                            data: {
                                documentType: docType,
                                fileAssetId: Number(fileAssetId),
                                description: description.trim() || undefined
                            }
                        }), {
                            loading: 'Uploading document...',
                            success: 'POD document attached successfully',
                            error: (err: any) => err?.message || 'Failed to attach document'
                        });
                        onDone();
                    }}
                    disabled={mut.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                    {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Attach Document
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
