/**
 * GrnListPage — list of all GRNs in the user's organisation.
 *
 * Route: /grn
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Clock, FileCheck2, Plus, RefreshCw, Search, XCircle, X, Calendar } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { useRouter } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { usePermissions } from '../../../hooks/useOrgRole';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatDateTime, formatRelative } from '../../shared/format';
import { KpiCard } from '../../shared/KpiCard';
import { Pagination } from '../../shared/Pagination';
import { usePagination, useResponsiveViewMode } from '../../shared/hooks';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { useGrns } from '../hooks';
import type { GrnStatus } from '../api';
import { GrnCreateModal } from '../components/GrnCreateModal';
import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

function DateFilterPopover({ 
    receivedFrom, setReceivedFrom, 
    receivedTo, setReceivedTo, 
    updatedFrom, setUpdatedFrom, 
    updatedTo, setUpdatedTo,
    activeCount, clearDates
}: any) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    const openPopover = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            let left = rect.left;
            if (left + 280 > window.innerWidth) {
                left = window.innerWidth - 290;
            }
            setPosition({ top: rect.bottom + 8, left });
        }
        setIsOpen(true);
    };

    const closePopover = () => setIsOpen(false);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isOpen && buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                const portal = document.getElementById('date-popover-portal');
                if (portal && !portal.contains(e.target as Node)) {
                    closePopover();
                }
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', closePopover);
            window.addEventListener('scroll', closePopover, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', closePopover);
            window.removeEventListener('scroll', closePopover, true);
        };
    }, [isOpen]);

    return (
        <>
            <Button
                type="button"
                ref={buttonRef}
                variant="outline"
                className={cn("h-10 shrink-0 whitespace-nowrap rounded-xl text-xs font-bold transition-colors w-full sm:w-auto px-3 shadow-xs outline-none", 
                    activeCount > 0 
                        ? "border-[#12335f] bg-[#12335f]/5 text-[#12335f] hover:bg-[#12335f]/10" 
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10"
                )}
                onClick={() => isOpen ? closePopover() : openPopover()}
            >
                <Calendar className="mr-2 h-4 w-4" /> Date Filters
                {activeCount > 0 && <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#12335f] text-[9px] font-black text-white">{activeCount}</span>}
            </Button>
            
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div id="date-popover-portal" className="fixed z-[100] w-[340px] rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col overflow-hidden text-left" style={{ top: position.top, left: position.left }}>
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-black text-[#12335f] uppercase tracking-widest">Date Filters</span>
                        <button onClick={closePopover} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4"/></button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Received</label>
                            <div className="grid items-center gap-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) 20px minmax(0, 1fr)' }}>
                                <input type="date" value={receivedFrom} onChange={e => setReceivedFrom(e.target.value)} className="h-9 w-full min-w-0 rounded-lg bg-slate-50 px-2 text-[11px] font-bold text-slate-700 border border-slate-200 outline-none focus:border-[#12335f] focus:bg-white" title="From Date" />
                                <span className="text-[10px] text-slate-400 font-bold text-center">-</span>
                                <input type="date" value={receivedTo} onChange={e => setReceivedTo(e.target.value)} className="h-9 w-full min-w-0 rounded-lg bg-slate-50 px-2 text-[11px] font-bold text-slate-700 border border-slate-200 outline-none focus:border-[#12335f] focus:bg-white" title="To Date" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Updated</label>
                            <div className="grid items-center gap-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) 20px minmax(0, 1fr)' }}>
                                <input type="date" value={updatedFrom} onChange={e => setUpdatedFrom(e.target.value)} className="h-9 w-full min-w-0 rounded-lg bg-slate-50 px-2 text-[11px] font-bold text-slate-700 border border-slate-200 outline-none focus:border-[#12335f] focus:bg-white" title="From Date" />
                                <span className="text-[10px] text-slate-400 font-bold text-center">-</span>
                                <input type="date" value={updatedTo} onChange={e => setUpdatedTo(e.target.value)} className="h-9 w-full min-w-0 rounded-lg bg-slate-50 px-2 text-[11px] font-bold text-slate-700 border border-slate-200 outline-none focus:border-[#12335f] focus:bg-white" title="To Date" />
                            </div>
                        </div>
                    </div>
                    {activeCount > 0 && (
                        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-end">
                            <button onClick={() => { clearDates(); closePopover(); }} className="text-xs font-bold text-red-600 hover:text-red-700">Clear Dates</button>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </>
    );
}

const STATUS_TONE: Record<GrnStatus, string> = {
    DRAFT: 'border-slate-200 bg-slate-50 text-slate-600',
    SUBMITTED: 'border-amber-200 bg-amber-50 text-amber-700',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REJECTED: 'border-red-200 bg-red-50 text-red-700',
    PARTIAL: 'border-blue-200 bg-blue-50 text-blue-700'
};
type GrnSortKey = 'grnNumber' | 'poNumber' | 'seller' | 'items' | 'status' | 'receivedAt' | 'updatedAt';

export default function GrnListPage() {
    const router = useRouter();
    const { hasPermission } = usePermissions();
    const [filter, setFilter] = useState<GrnStatus | 'ALL'>('ALL');
    const [showCreate, setShowCreate] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<GrnSortKey>('updatedAt');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [viewMode, setViewMode] = useResponsiveViewMode('phase7:grn-list:view-mode');
    const [filterPo, setFilterPo] = useState<string>('ALL');
    const [filterSeller, setFilterSeller] = useState<string>('ALL');
    const [filterReceivedFrom, setFilterReceivedFrom] = useState<string>('');
    const [filterReceivedTo, setFilterReceivedTo] = useState<string>('');
    const [filterUpdatedFrom, setFilterUpdatedFrom] = useState<string>('');
    const [filterUpdatedTo, setFilterUpdatedTo] = useState<string>('');
    const [filterItems, setFilterItems] = useState<string>('ALL');

    const canViewGrns = hasPermission('grn.view');
    const canCreate = hasPermission('grn.create');
    const { data, isLoading, error, refetch, isFetching } = useGrns(undefined, { enabled: canViewGrns });

    const grns = data || [];

    const uniquePos = useMemo(() => {
        const pos = new Set<string>();
        grns.forEach(g => {
            if (g.purchaseOrder?.poNumber) pos.add(g.purchaseOrder.poNumber);
        });
        return Array.from(pos).sort();
    }, [grns]);

    const uniqueSellers = useMemo(() => {
        const sellers = new Set<string>();
        grns.forEach(g => {
            if (g.purchaseOrder?.seller?.name) sellers.add(g.purchaseOrder.seller.name);
        });
        return Array.from(sellers).sort();
    }, [grns]);

    const visibleGrns = useMemo(() => {
        const text = search.trim().toLowerCase();
        return [...grns].filter(g => {
            if (filter !== 'ALL' && g.status !== filter) return false;
            if (filterPo !== 'ALL' && g.purchaseOrder?.poNumber !== filterPo) return false;
            if (filterSeller !== 'ALL' && g.purchaseOrder?.seller?.name !== filterSeller) return false;
            
            if (filterItems !== 'ALL') {
                const count = g.items?.length || 0;
                if (filterItems === '1' && count !== 1) return false;
                if (filterItems === '2' && count !== 2) return false;
                if (filterItems === '3+' && count < 3) return false;
            }

            if (filterReceivedFrom) {
                if (new Date(g.receivedAt).getTime() < new Date(filterReceivedFrom).getTime()) return false;
            }
            if (filterReceivedTo) {
                const toDate = new Date(filterReceivedTo);
                toDate.setHours(23, 59, 59, 999);
                if (new Date(g.receivedAt).getTime() > toDate.getTime()) return false;
            }
            if (filterUpdatedFrom) {
                if (new Date(g.updatedAt).getTime() < new Date(filterUpdatedFrom).getTime()) return false;
            }
            if (filterUpdatedTo) {
                const toDate = new Date(filterUpdatedTo);
                toDate.setHours(23, 59, 59, 999);
                if (new Date(g.updatedAt).getTime() > toDate.getTime()) return false;
            }

            const haystack = [
                g.grnNumber,
                g.status,
                g.purchaseOrder?.poNumber,
                g.purchaseOrder?.title,
                g.purchaseOrder?.seller?.name,
                g.receivedBy?.name
            ].join(' ').toLowerCase();
            return !text || haystack.includes(text);
        }).sort((a, b) => {
            const valueFor = (g: any) => {
                if (sortKey === 'grnNumber') return g.grnNumber || '';
                if (sortKey === 'poNumber') return g.purchaseOrder?.poNumber || '';
                if (sortKey === 'seller') return g.purchaseOrder?.seller?.name || '';
                if (sortKey === 'items') return g.items?.length || 0;
                if (sortKey === 'status') return g.status || '';
                if (sortKey === 'receivedAt') return new Date(g.receivedAt || 0).getTime();
                return new Date(g.updatedAt || 0).getTime();
            };
            const av = valueFor(a);
            const bv = valueFor(b);
            const result = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
            return sortDirection === 'asc' ? result : -result;
        });
    }, [grns, search, sortDirection, sortKey, filter, filterPo, filterSeller, filterItems, filterReceivedFrom, filterReceivedTo, filterUpdatedFrom, filterUpdatedTo]);

    const { page, pageSize, pageItems, total, setPage, setPageSize } = usePagination(visibleGrns, 10);

    if (!canViewGrns) {
        return <InlineError message="You do not have permission to view goods receipt notes." />;
    }

    const toggleSort = (field: GrnSortKey) => {
        setSortDirection(prev => sortKey === field && prev === 'asc' ? 'desc' : 'asc');
        setSortKey(field);
        setPage(1);
    };

    const clearFilters = () => {
        setSearch('');
        setFilter('ALL');
        setFilterPo('ALL');
        setFilterSeller('ALL');
        setFilterReceivedFrom('');
        setFilterReceivedTo('');
        setFilterUpdatedFrom('');
        setFilterUpdatedTo('');
        setFilterItems('ALL');
        setPage(1);
    };

    const activeFilterCount = (search ? 1 : 0) + 
      (filter !== 'ALL' ? 1 : 0) + 
      (filterPo !== 'ALL' ? 1 : 0) + 
      (filterSeller !== 'ALL' ? 1 : 0) + 
      (filterItems !== 'ALL' ? 1 : 0) + 
      (filterReceivedFrom || filterReceivedTo ? 1 : 0) + 
      (filterUpdatedFrom || filterUpdatedTo ? 1 : 0);

    const counts = {
        ALL: grns.length,
        DRAFT: grns.filter(g => g.status === 'DRAFT').length,
        SUBMITTED: grns.filter(g => g.status === 'SUBMITTED').length,
        APPROVED: grns.filter(g => g.status === 'APPROVED').length,
        PARTIAL: grns.filter(g => g.status === 'PARTIAL').length,
        REJECTED: grns.filter(g => g.status === 'REJECTED').length
    };

    return (
        <div className="space-y-6">
            {/* Transparent Header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
                <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f] bg-[#12335f]/10 px-2.5 py-1 rounded-full">Fulfillment</span>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">Goods Receipt Notes</h1>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                        Record received goods, run inspection, approve to trigger seller invoice.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ViewModeToggle className="col-span-2 sm:col-span-1 flex justify-end" value={viewMode} onChange={setViewMode} />
                    <Button variant="outline" onClick={() => refetch()} className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm">
                        <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", isFetching && "animate-spin")} /> Refresh
                    </Button>
                    {canCreate && (
                        <Button onClick={() => setShowCreate(true)} className="h-10 bg-[#12335f] text-white hover:bg-[#0e2a4f] text-xs font-black uppercase rounded-lg shadow-sm">
                            <Plus className="mr-2 h-4 w-4" /> New GRN
                        </Button>
                    )}
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <KpiCard
                    label="Total"
                    value={counts.ALL}
                    subtext="All goods receipts"
                    icon={ClipboardList}
                    active={filter === 'ALL'}
                    onClick={() => setFilter('ALL')}
                    color="indigo"
                />
                <KpiCard
                    label="Draft"
                    value={counts.DRAFT}
                    subtext="Draft GRNs"
                    icon={Clock}
                    active={filter === 'DRAFT'}
                    onClick={() => setFilter('DRAFT')}
                    color="slate"
                />
                <KpiCard
                    label="Submitted"
                    value={counts.SUBMITTED}
                    subtext="Submitted GRNs"
                    icon={FileCheck2}
                    active={filter === 'SUBMITTED'}
                    onClick={() => setFilter('SUBMITTED')}
                    color="amber"
                />
                <KpiCard
                    label="Approved"
                    value={counts.APPROVED + counts.PARTIAL}
                    subtext="Approved GRNs"
                    icon={CheckCircle2}
                    active={filter === 'APPROVED'}
                    onClick={() => setFilter('APPROVED')}
                    color="green"
                />
                <KpiCard
                    label="Rejected"
                    value={counts.REJECTED}
                    subtext="Rejected GRNs"
                    icon={XCircle}
                    active={filter === 'REJECTED'}
                    onClick={() => setFilter('REJECTED')}
                    color="red"
                />
            </div>

            {error && <InlineError message={(error as Error).message} onRetry={() => refetch()} />}

            {/* Search + Filter + View Toggle Toolbar */}
            <div className={cn("rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm", activeFilterCount > 0 ? "space-y-3" : "")}>
                <ResponsiveFilterBar
                    activeFilterCount={activeFilterCount}
                    searchInput={
                        <div className="relative w-full">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={event => { setSearch(event.target.value); setPage(1); }}
                                placeholder="Search GRN, PO, seller, receiver, status..."
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                            />
                        </div>
                    }
                    filters={
                        <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap w-full">
                            <select value={filter} onChange={e => { setFilter(e.target.value as any); setPage(1); }} className="h-10 w-full sm:w-auto sm:w-[150px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-xs cursor-pointer transition-colors">
                                <option value="ALL">All Statuses</option>
                                <option value="DRAFT">Draft</option>
                                <option value="SUBMITTED">Submitted</option>
                                <option value="APPROVED">Approved</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="REJECTED">Rejected</option>
                            </select>

                            <select value={filterPo} onChange={e => { setFilterPo(e.target.value); setPage(1); }} className="h-10 w-full sm:w-auto sm:w-[170px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-xs cursor-pointer transition-colors truncate">
                                <option value="ALL">All Purchase Orders</option>
                                {uniquePos.map(po => <option key={po} value={po}>{po}</option>)}
                            </select>

                            <select value={filterSeller} onChange={e => { setFilterSeller(e.target.value); setPage(1); }} className="h-10 w-full sm:w-auto sm:w-[150px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-xs cursor-pointer transition-colors truncate">
                                <option value="ALL">All Sellers</option>
                                {uniqueSellers.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <select value={filterItems} onChange={e => { setFilterItems(e.target.value); setPage(1); }} className="h-10 w-full sm:w-auto sm:w-[130px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-xs cursor-pointer transition-colors">
                                <option value="ALL">All Items</option>
                                <option value="1">1 line</option>
                                <option value="2">2 lines</option>
                                <option value="3+">3+ lines</option>
                            </select>

                            <DateFilterPopover 
                                receivedFrom={filterReceivedFrom} setReceivedFrom={(v: string) => { setFilterReceivedFrom(v); setPage(1); }}
                                receivedTo={filterReceivedTo} setReceivedTo={(v: string) => { setFilterReceivedTo(v); setPage(1); }}
                                updatedFrom={filterUpdatedFrom} setUpdatedFrom={(v: string) => { setFilterUpdatedFrom(v); setPage(1); }}
                                updatedTo={filterUpdatedTo} setUpdatedTo={(v: string) => { setFilterUpdatedTo(v); setPage(1); }}
                                activeCount={(filterReceivedFrom || filterReceivedTo ? 1 : 0) + (filterUpdatedFrom || filterUpdatedTo ? 1 : 0)}
                                clearDates={() => {
                                    setFilterReceivedFrom('');
                                    setFilterReceivedTo('');
                                    setFilterUpdatedFrom('');
                                    setFilterUpdatedTo('');
                                    setPage(1);
                                }}
                            />

                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    className="h-10 shrink-0 whitespace-nowrap text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-red-600 transition-colors w-full sm:w-auto sm:px-2 flex items-center justify-center sm:justify-start"
                                    onClick={clearFilters}
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    }
                    endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
                />

                {/* Active Filter Chips */}
                {activeFilterCount > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-2 border-t border-slate-100">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Active Filters:</span>
                        
                        {search && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                                Search: {search} <button onClick={() => { setSearch(''); setPage(1); }} className="hover:text-blue-900 ml-0.5"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {filter !== 'ALL' && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                                Status: {filter} <button onClick={() => { setFilter('ALL'); setPage(1); }} className="hover:text-blue-900 ml-0.5"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {filterPo !== 'ALL' && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                                PO: {filterPo} <button onClick={() => { setFilterPo('ALL'); setPage(1); }} className="hover:text-blue-900 ml-0.5"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {filterSeller !== 'ALL' && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                                Seller: {filterSeller} <button onClick={() => { setFilterSeller('ALL'); setPage(1); }} className="hover:text-blue-900 ml-0.5"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {filterItems !== 'ALL' && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                                Items: {filterItems === '1' ? '1 line' : filterItems === '2' ? '2 lines' : '3+ lines'} <button onClick={() => { setFilterItems('ALL'); setPage(1); }} className="hover:text-blue-900 ml-0.5"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {(filterReceivedFrom || filterReceivedTo) && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                                Received: {filterReceivedFrom || '...'} to {filterReceivedTo || '...'} <button onClick={() => { setFilterReceivedFrom(''); setFilterReceivedTo(''); setPage(1); }} className="hover:text-blue-900 ml-0.5"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {(filterUpdatedFrom || filterUpdatedTo) && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                                Updated: {filterUpdatedFrom || '...'} to {filterUpdatedTo || '...'} <button onClick={() => { setFilterUpdatedFrom(''); setFilterUpdatedTo(''); setPage(1); }} className="hover:text-blue-900 ml-0.5"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        
                        <button onClick={clearFilters} className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-800 ml-1 underline decoration-slate-300 underline-offset-2">
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            {isLoading ? (
                <LoadingState label="Loading GRNs..." />
            ) : grns.length === 0 ? (
                <EmptyState title="No GRNs found" description={canCreate ? "Create one against an active Purchase Order to record the receipt of goods." : "No goods receipt notes recorded yet."} />
            ) : pageItems.length === 0 ? (
                <EmptyState 
                    title="No GRNs match these filters" 
                    description="Clear filters to see all goods receipt notes." 
                    action={{
                        label: 'Clear Filters',
                        onClick: clearFilters
                    }}
                />
            ) : viewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {pageItems.map((g: any, index) => {
                        const rowIndex = (page - 1) * pageSize + index + 1;
                        return (
                            <button
                                type="button"
                                key={g.id}
                                onClick={() => router.push(`/grn/${g.id}`)}
                                className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#12335f]/40 hover:shadow-md flex flex-col justify-between"
                            >
                                <div className="w-full space-y-3">
                                    <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[9px] font-black text-slate-500">
                                                    {String(rowIndex).padStart(2, '0')}
                                                </span>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#c86413]">{g.grnNumber}</span>
                                            </div>
                                            <h2 className="mt-2 text-sm font-black text-slate-900 group-hover:text-[#12335f] transition-colors">{g.purchaseOrder?.poNumber || 'Purchase Order'}</h2>
                                            <p className="mt-1 text-xs font-semibold text-slate-500 line-clamp-1">{g.purchaseOrder?.title}</p>
                                        </div>
                                        <StatusPill status={g.status} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5 text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-3">
                                        <InfoTile label="Seller" value={g.purchaseOrder?.seller?.name || '-'} />
                                        <InfoTile label="Items Count" value={`${g.items.length} line${g.items.length === 1 ? '' : 's'}`} />
                                        <InfoTile label="Received" value={formatDateTime(g.receivedAt)} />
                                        <InfoTile label="Updated" value={formatRelative(g.updatedAt)} />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="overflow-x-auto w-full">
                        <table data-ux-wrapped="true" className="w-full min-w-[850px] table-fixed border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/75 hover:bg-transparent">
                                    <th className="p-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[5%]">Sr. No</th>
                                    <th className="p-3 w-[12%]"><SortableHeader label="GRN ID" field="grnNumber" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                    <th className="p-3 w-[38%]"><SortableHeader label="Purchase Order" field="poNumber" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                    <th className="p-3 w-[9%]"><SortableHeader label="Items" field="items" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                    <th className="p-3 w-[10%]"><SortableHeader label="Status" field="status" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                    <th className="p-3 w-[13%]"><SortableHeader label="Received" field="receivedAt" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                    <th className="p-3 w-[13%]"><SortableHeader label="Updated" field="updatedAt" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {pageItems.map((g, idx) => {
                                    const rowIndex = (page - 1) * pageSize + idx + 1;
                                    return (
                                        <tr key={g.id} className="hover:bg-slate-50/50 transition cursor-pointer" onClick={() => router.push(`/grn/${g.id}`)}>
                                            <td className="p-3 font-mono text-xs text-slate-500">
                                                {String(rowIndex).padStart(2, '0')}
                                            </td>
                                            <td className="p-3" onClick={e => e.stopPropagation()}>
                                                <EntityIdLink label={g.grnNumber} id={g.id} size="sm" onClick={() => router.push(`/grn/${g.id}`)} />
                                            </td>
                                            <td className="p-3">
                                                <p className="text-xs font-black text-slate-900 break-words">{g.purchaseOrder?.poNumber}</p>
                                                <p className="text-[10px] font-semibold text-slate-500 break-words">{g.purchaseOrder?.title}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Seller: {g.purchaseOrder?.seller?.name}</p>
                                            </td>
                                            <td className="p-3 text-xs font-semibold text-slate-700">
                                                {g.items.length} line{g.items.length === 1 ? '' : 's'}
                                            </td>
                                            <td className="p-3">
                                                <StatusPill status={g.status} />
                                            </td>
                                            <td className="p-3 text-xs font-semibold text-slate-700">
                                                <p>{formatDateTime(g.receivedAt)}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">by {g.receivedBy.name}</p>
                                            </td>
                                            <td className="p-3 text-xs font-semibold text-slate-700">
                                                <p>{formatDateTime(g.updatedAt)}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{formatRelative(g.updatedAt)}</p>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!isLoading && grns.length > 0 && (
                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="GRNs" />
            )}

            {showCreate && (
                <GrnCreateModal onClose={() => setShowCreate(false)} onCreated={(g) => { setShowCreate(false); router.push(`/grn/${g.id}`); }} />
            )}
        </div>
    );
}

function StatusPill({ status }: { status: GrnStatus }) {
    return (
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_TONE[status]}`}>
            {status}
        </span>
    );
}



function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-slate-800">{value || '-'}</p>
    </div>
  );
}
