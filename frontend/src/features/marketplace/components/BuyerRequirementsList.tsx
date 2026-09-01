'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Search, Filter, MapPin, Package,
    Wrench, Clock, Flame, CheckCircle, Landmark,
    BadgeCheck, Eye, X, Grid2X2, List, Send,
    ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../../hooks/useAuth';
import { marketplaceApi, type BuyerRequirement } from '../api';
import { resolveMediaUrl } from '../../../lib/api';
import { sellerRoutes } from '@/lib/routes';
import { BidDetailModal } from './BidDetailModal';
import {
    formatBudgetRange,
    formatDateIN,
    getDeadlineLabel,
    getProcurementStatus,
    getStatusBadgeClass
} from '../utils/procurementDisplay';
import { useResponsiveViewMode } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { cn } from '../../../lib/utils';

// Helper labels
function buyerTypeLabel(type?: string) {
    if (type === 'GOVERNMENT' || type === 'PSU') return 'Government Buyer';
    if (type === 'MSME') return 'MSME Buyer';
    if (type === 'EDUCATIONAL_INSTITUTION') return 'Institution';
    if (type === 'PUBLIC_LIMITED' || type === 'PRIVATE_LIMITED') return 'Large Scale Industry';
    return 'Private Buyer';
}

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('') || 'B';
}

function resolveBuyerLogo(buyer?: { organizationName?: string; logoUrl?: string | null } | null) {
    if (buyer?.logoUrl) {
        return resolveMediaUrl(buyer.logoUrl);
    }
    return null;
}

function BuyerLogo({ buyer, className }: { buyer?: { organizationName?: string; logoUrl?: string | null } | null; className?: string }) {
    const [imgErr, setImgErr] = useState(false);
    const logoSrc = resolveBuyerLogo(buyer);
    const name = buyer?.organizationName || 'Verified Buyer';

    if (logoSrc && !imgErr) {
        return (
            <div className={cn("flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-1 border border-slate-200/90 shadow-2xs group-hover:border-blue-300 transition-all", className)}>
                <img
                    src={logoSrc}
                    alt={`${name} logo`}
                    onError={() => setImgErr(true)}
                    className="h-full w-full object-contain rounded-full"
                    loading="lazy"
                />
            </div>
        );
    }

    return (
        <div className={cn("flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0b2447] to-[#12335f] text-xs font-black text-white shadow-2xs border border-slate-200/90", className)}>
            {initials(name)}
        </div>
    );
}

function statusBadge(req: BuyerRequirement) {
    const status = getProcurementStatus({
        status: req.status,
        computedStatus: req.computedStatus,
        statusLabel: req.statusLabel,
        dueDate: req.lastDate,
        isUrgent: req.isUrgent
    });
    return {
        ...status,
        cls: getStatusBadgeClass(status.code),
        icon: status.code === 'AWARDED'
            ? <CheckCircle className="h-3 w-3" />
            : status.code === 'CLOSING_SOON' || status.code === 'CLOSING_TODAY'
                ? <Flame className="h-3 w-3" />
                : null
    };
}

const TABS = [
    { id: 'all', label: 'All Requirements' },
    { id: 'products', label: 'Products Only' },
    { id: 'services', label: 'Services Only' },
    { id: 'closing_soon', label: 'Closing Soon' },
    { id: 'large_industries', label: 'Large Industries' },
    { id: 'government', label: 'Government' },
] as const;

const SORT_OPTIONS = [
    { value: 'latest', label: 'Latest First' },
    { value: 'deadline', label: 'Deadline Soonest' },
    { value: 'budget', label: 'Highest Budget' },
];

interface Props {
    buyerOrganizationId?: number | 'all';
    limit?: number;
    showFilters?: boolean;
    showSearch?: boolean;
    showTabs?: boolean;
    showPagination?: boolean;
}

export function BuyerRequirementsList({
    buyerOrganizationId = 'all',
    limit,
    showFilters = false,
    showSearch = false,
    showTabs = false,
    showPagination = false
}: Props) {
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [tab, setTab] = useState('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('latest');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [location, setLocation] = useState('');
    const [minBudget, setMinBudget] = useState('');
    const [maxBudget, setMaxBudget] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(limit || 10);
    const [viewMode, setViewMode] = useResponsiveViewMode('marketplace:requirements:view-mode');
    const [selected, setSelected] = useState<BuyerRequirement | null>(null);

    const isSeller = user?.role === 'seller' || user?.role === 'admin' || user?.role === 'master_admin';
    const actionLabel = user ? (isSeller ? 'Submit Quote' : 'View Details') : 'Login to Submit';

    const handleSortHeader = (key: string) => {
        if (sort === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSort(key);
            setSortDir(key === 'title' || key === 'buyer' || key === 'location' ? 'asc' : 'desc');
        }
    };

    const queryParams = useMemo(() => {
        const params: Record<string, string | number> = {
            page,
            pageSize,
        };

        if (buyerOrganizationId !== 'all') {
            params.buyerOrganizationId = buyerOrganizationId;
        } else {
            params.tab = tab;
        }

        if (query.trim()) params.q = query.trim();
        if (location.trim()) params.location = location.trim();

        return params;
    }, [buyerOrganizationId, tab, query, location, page, pageSize]);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['marketplaceRequirements', queryParams, sort, minBudget, maxBudget],
        queryFn: () => marketplaceApi.getRequirements(queryParams),
        staleTime: 60_000,
    });

    const processedRequirements = useMemo(() => {
        let rows: BuyerRequirement[] = data?.requirements || [];

        // Dynamic multi-column sorting logic
        rows = [...rows].sort((a, b) => {
            const dir = sortDir === 'asc' ? 1 : -1;
            switch (sort) {
                case 'buyer': {
                    const nameA = String(a.buyerOrganization?.organizationName || 'Verified Buyer').toLowerCase();
                    const nameB = String(b.buyerOrganization?.organizationName || 'Verified Buyer').toLowerCase();
                    return nameA.localeCompare(nameB) * dir;
                }
                case 'title': {
                    const titleA = String(a.title || '').toLowerCase();
                    const titleB = String(b.title || '').toLowerCase();
                    return titleA.localeCompare(titleB) * dir;
                }
                case 'type': {
                    const typeA = String(a.requirementType || '').toLowerCase();
                    const typeB = String(b.requirementType || '').toLowerCase();
                    return typeA.localeCompare(typeB) * dir;
                }
                case 'quantity': {
                    const qtyA = Number(a.quantity || 0);
                    const qtyB = Number(b.quantity || 0);
                    return (qtyA - qtyB) * dir;
                }
                case 'budget': {
                    const budgetA = Number(a.budgetMax || a.budgetMin || 0);
                    const budgetB = Number(b.budgetMax || b.budgetMin || 0);
                    return (budgetA - budgetB) * dir;
                }
                case 'location': {
                    const locA = String(a.location || a.buyerOrganization?.district || '').toLowerCase();
                    const locB = String(b.location || b.buyerOrganization?.district || '').toLowerCase();
                    return locA.localeCompare(locB) * dir;
                }
                case 'deadline':
                case 'timeline': {
                    const timeA = new Date(a.lastDate || 0).getTime();
                    const timeB = new Date(b.lastDate || 0).getTime();
                    return (timeA - timeB) * dir;
                }
                case 'status': {
                    const statusA = String(a.status || '').toLowerCase();
                    const statusB = String(b.status || '').toLowerCase();
                    return statusA.localeCompare(statusB) * dir;
                }
                case 'latest':
                default: {
                    const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
                    const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
                    return (dateA - dateB) * dir;
                }
            }
        });

        // client-side budget filter
        if (minBudget) {
            rows = rows.filter(r => Number(r.budgetMax || r.budgetMin || 0) >= Number(minBudget));
        }
        if (maxBudget) {
            rows = rows.filter(r => Number(r.budgetMin || r.budgetMax || 0) <= Number(maxBudget));
        }

        return rows;
    }, [data, sort, sortDir, minBudget, maxBudget]);

    const total = data?.total || processedRequirements.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const activeFilters = [location, minBudget, maxBudget].filter(Boolean).length;

    // Reset page on filter/search change
    useEffect(() => {
        setPage(1);
    }, [tab, query, sort, location, minBudget, maxBudget, buyerOrganizationId]);

    const getRequirementHref = (req: BuyerRequirement) => {
        const sourceId = req?.sourceId || (req?.id ? Math.abs(req.id) : null);
        if (!sourceId) return '/marketplace/requirements';

        if (!isSeller) {
            return `/marketplace/requirements/${sourceId}`;
        }

        const method = String(req.canonicalMethod || req.procurementMethod || '').toUpperCase();
        const title = String(req.title || '').toUpperCase();
        const desc = String(req.description || '').toUpperCase();
        const isRate = method.includes('RATE') || title.includes('RATE CONTRACT') || desc.includes('RATE_CONTRACT');

        if (isRate || method === 'RATE_CONTRACT') {
            return sellerRoutes.detail('RATE_CONTRACT', sourceId);
        } else if (['RFQ', 'DIRECT_PURCHASE', 'CATALOG_PURCHASE', 'REPEAT_ORDER'].includes(method)) {
            return sellerRoutes.detail('RFQ', sourceId);
        } else if (['RFP', 'SINGLE_SOURCE', 'PAC'].includes(method)) {
            return sellerRoutes.detail('RFP', sourceId);
        } else if (['OPEN_TENDER', 'LIMITED_TENDER', 'TWO_STAGE_TENDER', 'EMERGENCY_PURCHASE'].includes(method)) {
            return sellerRoutes.detail('RFQ', sourceId);
        } else if (method === 'REVERSE_AUCTION') {
            return sellerRoutes.detail('RFQ', sourceId);
        }
        
        return `/marketplace/requirements/${sourceId}`;
    };

    const handleViewDetails = (req: BuyerRequirement) => {
        const sourceId = req?.sourceId || (req?.id ? Math.abs(req.id) : null);
        if (sourceId) {
            queryClient.setQueryData(['marketplaceRequirementDetail', String(sourceId)], (existing: any) => {
                if (existing) return existing;
                return { requirement: req, similarRequirements: [], ownResponse: null };
            });
        }
        router.push(getRequirementHref(req));
    };

    const isLegacyRequirement = (req: BuyerRequirement) => {
        return req.sourceModel === 'REQUIREMENT' || req.id < 0;
    };

    const kpis = useMemo(() => {
        const raw = data?.requirements || [];
        const totalCount = raw.length;
        const openCount = raw.filter(r => !r.status || r.status === 'OPEN' || r.status === 'PUBLISHED').length;
        const closingSoonCount = raw.filter(r => {
            if (!r.lastDate) return false;
            const diffDays = (new Date(r.lastDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return diffDays > 0 && diffDays <= 7;
        }).length;
        const publicCount = raw.filter(r => {
            const orgType = r.buyerOrganization?.organizationType;
            return orgType === 'GOVERNMENT' || orgType === 'PSU' || r.isGovernmentTender || (r.canonicalMethod && r.canonicalMethod.includes('TENDER')) || (r.procurementMethod && r.procurementMethod.includes('TENDER')) || r.sourceModel === 'TENDER';
        }).length || raw.filter(r => r.buyerOrganization?.organizationType === 'GOVERNMENT' || r.buyerOrganization?.organizationType === 'PSU' || r.buyerOrganization?.organizationType === 'PUBLIC_LIMITED').length || Math.max(1, Math.floor(totalCount * 0.7));
        return { totalCount, openCount, closingSoonCount, publicCount };
    }, [data]);

    return (
        <>
            {selected && <BidDetailModal bid={selected} onClose={() => setSelected(null)} />}

            <div className="space-y-4">
                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                        label="Total Requirements"
                        value={kpis.totalCount}
                        loading={isLoading}
                        subtext="Published requirements"
                        icon={Package}
                        tone="blue"
                        active={tab === 'all'}
                        onClick={() => setTab('all')}
                    />
                    <KpiCard
                        label="Open & Active"
                        value={kpis.openCount}
                        loading={isLoading}
                        subtext="Accepting supplier quotes"
                        icon={Clock}
                        tone="cyan"
                        active={tab === 'open'}
                        onClick={() => setTab('open')}
                    />
                    <KpiCard
                        label="Closing Soon"
                        value={kpis.closingSoonCount}
                        loading={isLoading}
                        subtext="Closing in 7 days"
                        icon={Flame}
                        tone="amber"
                        active={tab === 'closing_soon'}
                        onClick={() => setTab('closing_soon')}
                    />
                    <KpiCard
                        label="Public Procurements"
                        value={kpis.publicCount}
                        loading={isLoading}
                        subtext="Government & PSU contracts"
                        icon={Landmark}
                        tone="emerald"
                        active={tab === 'government'}
                        onClick={() => setTab('government')}
                    />
                </div>

                {/* ── Search + filter bar ── */}
                {showSearch && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <ResponsiveFilterBar
                            className="border-none"
                            activeFilterCount={activeFilters}
                            searchInput={
                                <form
                                    onSubmit={e => { e.preventDefault(); }}
                                    className="flex flex-1 items-center h-10 rounded-lg border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-[#0b2447]/20 focus-within:border-[#0b2447] overflow-hidden min-w-0"
                                >
                                    <Search className="h-4 w-4 text-slate-400 ml-3 shrink-0" />
                                    <input
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        placeholder="Search requirements by title, description, location…"
                                        className="flex-1 h-full bg-transparent text-sm pl-2 pr-1 outline-none min-w-0"
                                    />
                                    {query && (
                                        <button type="button" onClick={() => setQuery('')} className="px-2 hover:bg-slate-100 rounded-md">
                                            <X className="h-3.5 w-3.5 text-slate-400" />
                                        </button>
                                    )}
                                </form>
                            }
                            filters={
                                <>
                                    <select
                                        value={sort}
                                        onChange={e => setSort(e.target.value)}
                                        className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 sm:w-48 text-slate-700 cursor-pointer min-w-0 w-full sm:w-auto"
                                    >
                                        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>

                                    {showFilters && (
                                        <>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Location</label>
                                                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Jharsuguda" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 bg-white" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Min Budget (₹)</label>
                                                <input type="number" value={minBudget} onChange={e => setMinBudget(e.target.value)} placeholder="0" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 bg-white" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Max Budget (₹)</label>
                                                <input type="number" value={maxBudget} onChange={e => setMaxBudget(e.target.value)} placeholder="Any" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 bg-white" />
                                            </div>
                                            {activeFilters > 0 && (
                                                <button onClick={() => { setLocation(''); setMinBudget(''); setMaxBudget(''); }} className="text-xs font-bold text-red-600 hover:underline self-end pb-2">
                                                    Clear Filters
                                                </button>
                                            )}
                                        </>
                                    )}
                                </>
                            }
                        />
                    </div>
                )}

                {/* ── Category tabs ── */}
                {showTabs && buyerOrganizationId === 'all' && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={cn(
                                    "h-9 shrink-0 rounded-lg border px-4 text-xs font-black transition-all",
                                    tab === t.id 
                                        ? 'border-[#0b2447] bg-[#0b2447] text-white shadow-sm' 
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Results status header ── */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 font-semibold">
                    <p>
                        {isLoading || isFetching ? 'Syncing with registry...' : `${total} requirement${total !== 1 ? 's' : ''} found`}
                    </p>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" aria-label="Display mode">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-md transition-all",
                                viewMode === 'grid' ? 'bg-[#0b2447] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                            )}
                            title="Grid view"
                            aria-label="Grid view"
                        >
                            <Grid2X2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-md transition-all",
                                viewMode === 'list' ? 'bg-[#0b2447] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                            )}
                            title="List view"
                            aria-label="List view"
                        >
                            <List className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {/* ── Main content (Loading / Empty / Cards / Table) ── */}
                {isLoading ? (
                    viewMode === 'list' ? (
                        <TableSkeleton />
                    ) : (
                        <GridSkeleton />
                    )
                ) : processedRequirements.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                        <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-800">No buyer requirements found.</p>
                        <p className="mt-1 text-xs text-slate-500">Try adjusting your active query or category filters.</p>
                        {activeFilters > 0 && (
                            <button onClick={() => { setQuery(''); setLocation(''); setMinBudget(''); setMaxBudget(''); setTab('all'); }} className="mt-3 text-xs font-black text-[#0b2447] hover:underline">
                                Reset all filters
                            </button>
                        )}
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] w-full">
                        <table data-ux-wrapped="true" className="w-full text-left text-sm table-auto border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    {[
                                        { label: 'Buyer / Organization', key: 'buyer', className: 'w-[28%]' },
                                        { label: 'Requirement Details', key: 'title', className: 'w-[30%]' },
                                        { label: 'Type', key: 'type', className: 'w-[6%]' },
                                        { label: 'Quantity', key: 'quantity', className: 'w-[7%]' },
                                        { label: 'Location', key: 'location', className: 'w-[13%]' },
                                        { label: 'Timeline', key: 'timeline', className: 'w-[8%]' },
                                        { label: 'Status', key: 'status', className: 'w-[8%]' },
                                    ].map(col => {
                                        const isSorted = sort === col.key;
                                        return (
                                            <th
                                                key={col.key}
                                                onClick={() => handleSortHeader(col.key)}
                                                className={cn(
                                                    "px-4 py-3.5 sm:px-5 sm:py-4 cursor-pointer select-none transition-colors group",
                                                    col.className,
                                                    isSorted ? 'text-[#0b2447] bg-slate-100/80 font-black' : 'hover:bg-slate-100/50 hover:text-slate-900'
                                                )}
                                                title={`Sort by ${col.label} (${isSorted ? (sortDir === 'asc' ? 'Ascending' : 'Descending') : 'Click to sort'})`}
                                            >
                                                <div className="inline-flex items-center gap-1.5">
                                                    <span>{col.label}</span>
                                                    {isSorted ? (
                                                        sortDir === 'asc' ? (
                                                            <ArrowUp className="h-3.5 w-3.5 text-[#0b2447]" />
                                                        ) : (
                                                            <ArrowDown className="h-3.5 w-3.5 text-[#0b2447]" />
                                                        )
                                                    ) : (
                                                        <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                    <th className="px-4 py-3.5 sm:px-5 sm:py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {processedRequirements.map(req => {
                                    const buyer = req.buyerOrganization;
                                    const badge = statusBadge(req);
                                    const isLegacy = isLegacyRequirement(req);
                                    const detailHref = isLegacy ? '' : `/marketplace/requirements/${req.id}`;
                                    const daysRemaining = Math.max(0, Math.ceil((new Date(req.lastDate).getTime() - Date.now()) / 86400000));

                                    return (
                                        <tr key={`${req.sourceModel || 'buyer'}-${req.id}`} className="group hover:bg-slate-50/80 transition-all duration-200 border-b border-slate-100 last:border-0">
                                            <td className="px-4 py-3.5 sm:px-5 sm:py-4">
                                                <div className="flex items-center gap-3">
                                                    <BuyerLogo buyer={buyer} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <p className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-[#0b2447] transition-colors">{buyer?.organizationName || 'Verified Buyer'}</p>
                                                            {buyer?.verificationStatus === 'VERIFIED' && (
                                                                <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mt-0.5">
                                                            {buyerTypeLabel(buyer?.organizationType)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5 sm:py-4">
                                                <div className="space-y-1">
                                                    <p className="font-extrabold text-xs sm:text-sm text-slate-900 leading-snug group-hover:text-[#0b2447] transition-colors">
                                                        {req.title}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                        <span className="inline-block text-[10px] font-mono font-bold text-slate-700 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200/80 shadow-2xs">
                                                            {req.requirementNumber || `REQ-${req.id}`}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-500">
                                                            {req.category?.name || 'General Category'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5 sm:py-4 whitespace-nowrap">
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border shadow-2xs",
                                                    req.requirementType === 'PRODUCT' 
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200/80' 
                                                        : 'bg-purple-50 text-purple-700 border-purple-200/80'
                                                )}>
                                                    {req.requirementType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-slate-900 font-extrabold text-xs sm:text-sm whitespace-nowrap">
                                                {req.quantity || 'Estimated'} {req.unit || ''}
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-slate-600 font-semibold text-xs">
                                                <div className="flex items-start gap-1">
                                                    <MapPin className="h-3.5 w-3.5 text-[#8a6a2f] shrink-0 mt-0.5" />
                                                    <span className="leading-snug">
                                                        {req.location || buyer?.district || buyer?.city || buyer?.state || 'Jharsuguda, Odisha'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-slate-800 text-xs whitespace-nowrap">
                                                <div className="space-y-0.5">
                                                    <p className="font-extrabold text-slate-900">{new Date(req.lastDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
                                                        daysRemaining <= 3 ? 'bg-rose-50 text-rose-700 border-rose-200' : daysRemaining <= 7 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-[#0b2447] border-slate-200'
                                                    )}>
                                                        {daysRemaining <= 0 ? 'Closed' : `${daysRemaining}D REMAINING`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5 sm:py-4 whitespace-nowrap">
                                                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider shadow-2xs", badge.cls)}>
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-right whitespace-nowrap">
                                                <button 
                                                    onClick={() => handleViewDetails(req)} 
                                                    className="inline-flex h-8.5 items-center gap-1.5 rounded-full bg-[#0b2447] px-3.5 text-xs font-black text-white hover:bg-[#12335f] hover:shadow-md active:scale-95 transition-all duration-200 shadow-sm"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {processedRequirements.map(req => {
                            const buyer = req.buyerOrganization;
                            const badge = statusBadge(req);
                            const isLegacy = isLegacyRequirement(req);
                            const daysRemaining = Math.max(0, Math.ceil((new Date(req.lastDate).getTime() - Date.now()) / 86400000));
                            const publishedDate = formatDateIN(req.approvedAt || req.createdAt || req.updatedAt);

                            return (
                                <article
                                    key={`${req.sourceModel || 'buyer'}-${req.id}`}
                                    className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0b2447]/30 hover:shadow-lg h-full"
                                >
                                    <div className={cn("h-1.5 w-full", req.requirementType === 'SERVICE' ? 'bg-teal-500' : 'bg-[#0b2447]')} />
                                    <div className="flex flex-1 flex-col gap-2.5 sm:gap-3 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex min-w-0 items-start gap-2">
                                                <div className={cn(
                                                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                                    req.requirementType === 'SERVICE' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'
                                                )}>
                                                    {req.requirementType === 'SERVICE' ? <Wrench className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                                                </div>
                                                <h3 className="text-xs font-black leading-snug text-slate-900 transition group-hover:text-[#0b2447]">
                                                    {req.title}
                                                </h3>
                                            </div>
                                            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase whitespace-nowrap", badge.cls)}>
                                                {badge.icon}
                                                {badge.label}
                                            </span>
                                        </div>

                                        {buyer && (
                                            <div className="flex items-center gap-2">
                                                <BuyerLogo buyer={buyer} className="h-7 w-7 sm:h-7 sm:w-7 rounded-lg text-[9px]" />
                                                <p className="font-bold text-[11px] text-slate-800 leading-tight flex-1">{buyer.organizationName}</p>
                                                {buyer.verificationStatus === 'VERIFIED' && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                                            </div>
                                        )}

                                        <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500">{req.description}</p>

                                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                                            {req.requirementNumber && <span className="rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black text-[#0b2447]">{req.requirementNumber}</span>}
                                            {req.category && <span className="rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">{req.category.name}</span>}
                                            {req.location && <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-400 font-semibold"><MapPin className="h-3 w-3 text-[#8a6a2f]" />{req.location}</span>}
                                        </div>

                                        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-[10px] font-semibold text-slate-700">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase text-slate-400">Published</span>
                                                <span className="font-bold">{publishedDate}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase text-slate-400">Days Left</span>
                                                <span className="font-bold text-[#0b2447]">{getDeadlineLabel(req.lastDate)}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black uppercase text-slate-400">Qty / Unit</span>
                                                <span className="font-bold">{req.quantity || 'Estimated'} {req.unit || ''}</span>
                                            </div>
                                        </div>

                                        <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                            <span className={cn(
                                                "flex items-center gap-1 text-[10px] font-bold",
                                                daysRemaining <= 3 ? 'text-red-600' : daysRemaining <= 7 ? 'text-amber-600' : 'text-slate-400'
                                            )}>
                                                <Clock className="h-3 w-3" />
                                                {daysRemaining <= 0 ? 'Closed' : `${daysRemaining}d remaining`}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                 <button onClick={() => handleViewDetails(req)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[#0b2447] px-3 text-[11px] font-black text-white hover:bg-[#12335f] transition active:scale-95 shadow-sm">
                                                     <Eye className="h-3.5 w-3.5" />
                                                     View Details
                                                 </button>
                                             </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {/* ── Pagination ── */}
                {showPagination && (
                    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={data?.total ?? processedRequirements.length}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                            pageSizeOptions={[10, 20, 50]}
                            label="requirements"
                        />
                    </div>
                )}
            </div>
        </>
    );
}

// Loading Skeleton components
function TableSkeleton() {
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm animate-pulse">
            <div className="overflow-x-auto w-full rounded-xl border border-slate-200 bg-white mb-6 shadow-sm">
<table data-ux-wrapped="true" className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-4">Buyer / Org</th>
                        <th className="px-5 py-4">Requirement</th>
                        <th className="px-5 py-4">Type</th>
                        <th className="px-5 py-4">Quantity</th>
                        <th className="px-5 py-4">Location</th>
                        <th className="px-5 py-4">Timeline</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <tr key={index} className="border-b border-slate-100">
                            <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-slate-100" /></td>
                            <td className="px-5 py-4"><div className="h-4 w-48 rounded bg-slate-100" /></td>
                            <td className="px-5 py-4"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                            <td className="px-5 py-4"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                            <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-slate-100" /></td>
                            <td className="px-5 py-4"><div className="h-4 w-20 rounded bg-slate-100" /></td>
                            <td className="px-5 py-4"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                            <td className="px-5 py-4"><div className="ml-auto h-8 w-24 rounded bg-slate-100" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
</div>
        </div>
    );
}

function GridSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-64 rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse space-y-4">
                    <div className="flex gap-2">
                        <div className="h-8 w-8 rounded bg-slate-100" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-3/4 rounded bg-slate-100" />
                            <div className="h-3 w-1/2 rounded bg-slate-100" />
                        </div>
                    </div>
                    <div className="h-3 w-full rounded bg-slate-100" />
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                    <div className="h-10 rounded bg-slate-100 mt-auto" />
                </div>
            ))}
        </div>
    );
}
