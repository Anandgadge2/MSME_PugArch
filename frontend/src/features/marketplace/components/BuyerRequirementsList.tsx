'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Search, MapPin, Package,
    Wrench, Clock, Flame, CheckCircle,
    BadgeCheck, Eye, X, Grid2X2, List,
    ChevronRight
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
import { DataTable, ColumnDef } from '../../../components/ui/data-table';
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

function getCleanLocation(req: BuyerRequirement): string {
    const buyer = req.buyerOrganization;
    if (buyer?.district && buyer?.state) {
        return `${buyer.district}, ${buyer.state}`;
    }
    const raw = req.location || buyer?.district || buyer?.city || buyer?.state || '';
    if (!raw) return 'Jharsuguda, Odisha';

    let clean = raw
        .replace(/^(Office\s+Delivery\s+Address|Delivery\s+Address|Site\s+Address)[:\s]*/gi, '')
        .replace(/Contact:.*$/gi, '')
        .replace(/\bPlot\s*No\.?[^,]+,\s*/gi, '')
        .replace(/\b\d{6}\b/g, '')
        .replace(/[-,\s]+$/g, '')
        .trim();

    const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 2) {
        clean = parts.slice(-2).join(', ');
    }
    return clean || 'Jharsuguda, Odisha';
}

function formatQuantityWithUnit(qty?: number | string | null, unit?: string | null): string {
    const n = qty != null && !isNaN(Number(qty)) && Number(qty) > 0 ? Number(qty) : null;
    const u = (unit || '').trim();
    if (n != null) {
        return `${n.toLocaleString('en-IN')}${u ? ` ${u}` : ''}`;
    }
    if (u) {
        return `1 ${u}`;
    }
    return '—';
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
    const [statusFilter, setStatusFilter] = useState('');
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
        queryKey: ['marketplaceRequirements', queryParams, sort, statusFilter],
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

        // client-side status filter
        if (statusFilter) {
            rows = rows.filter(r => {
                const code = String(r.computedStatus || r.status || '').toUpperCase();
                if (statusFilter === 'OPEN') return code === 'OPEN' || code === 'OPEN_FOR_BIDDING' || code === 'PUBLISHED';
                if (statusFilter === 'CLOSING_SOON') return code === 'CLOSING_SOON' || code === 'CLOSING_TODAY';
                if (statusFilter === 'CLOSED') return code === 'CLOSED' || code === 'EXPIRED';
                if (statusFilter === 'AWARDED') return code === 'AWARDED';
                if (statusFilter === 'UNDER_EVALUATION') return code === 'UNDER_EVALUATION' || code === 'TECHNICAL_EVALUATION' || code === 'FINANCIAL_EVALUATION';
                return true;
            });
        }

        return rows;
    }, [data, sort, sortDir, statusFilter]);

    const total = data?.total || processedRequirements.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const activeFilters = [location, statusFilter].filter(Boolean).length;

    // Reset page on filter/search change
    useEffect(() => {
        setPage(1);
    }, [tab, query, sort, location, statusFilter, buyerOrganizationId]);

    const getRequirementHref = (req: BuyerRequirement) => {
        const sourceId = (req as any)?.requirementNumber || req?.sourceId || (req?.id ? Math.abs(req.id) : null);
        if (!sourceId) return '/marketplace/requirements';

        if (!isSeller) {
            return `/bids/${sourceId}`;
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
        } else if (method === 'OPEN_TENDER' || method.includes('OPEN') || title.includes('OPEN TENDER')) {
            return sellerRoutes.detail('OPEN_TENDER', sourceId);
        } else if (method === 'LIMITED_TENDER' || method.includes('LIMITED') || title.includes('LIMITED TENDER')) {
            return sellerRoutes.detail('LIMITED_TENDER', sourceId);
        } else if (['TWO_STAGE_TENDER', 'EMERGENCY_PURCHASE'].includes(method)) {
            return sellerRoutes.detail('OPEN_TENDER', sourceId);
        } else if (method === 'REVERSE_AUCTION') {
            return sellerRoutes.detail('REVERSE_AUCTION', (req as any)?.sourceId || sourceId);
        }
        
        return `/bids/${sourceId}`;
    };

    const handleViewDetails = (req: BuyerRequirement) => {
        router.push(getRequirementHref(req));
    };

    const isLegacyRequirement = (req: BuyerRequirement) => {
        return req.sourceModel === 'REQUIREMENT' || req.id < 0;
    };

    const columns: ColumnDef<BuyerRequirement>[] = useMemo(() => [
        {
            key: 'buyer',
            header: 'Buyer / Organization',
            width: 'w-[28%]',
            sortable: true,
            sortKey: 'buyer',
            cell: (req) => {
                const buyer = req.buyerOrganization;
                return (
                    <div className="flex items-center gap-3">
                        <BuyerLogo buyer={buyer} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-[#0b2447] transition-colors">
                                    {buyer?.organizationName || 'Verified Buyer'}
                                </p>
                                {buyer?.verificationStatus === 'VERIFIED' && (
                                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                                )}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mt-0.5">
                                {buyerTypeLabel(buyer?.organizationType)}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'title',
            header: 'Requirement Details',
            width: 'w-[30%]',
            sortable: true,
            sortKey: 'title',
            cell: (req) => (
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
            ),
        },
        {
            key: 'type',
            header: 'Type',
            width: 'w-[6%]',
            sortable: true,
            sortKey: 'type',
            cell: (req) => (
                <span className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border shadow-2xs",
                    req.requirementType === 'PRODUCT' 
                        ? 'bg-blue-50 text-blue-700 border-blue-200/80' 
                        : 'bg-purple-50 text-purple-700 border-purple-200/80'
                )}>
                    {req.requirementType}
                </span>
            ),
        },
        {
            key: 'quantity',
            header: 'Quantity',
            width: 'w-[7%]',
            sortable: true,
            sortKey: 'quantity',
            cell: (req) => (
                <span className="text-slate-900 font-extrabold text-xs sm:text-sm whitespace-nowrap">
                    {formatQuantityWithUnit(req.quantity, req.unit)}
                </span>
            ),
        },
        {
            key: 'location',
            header: 'Location',
            width: 'w-[13%]',
            sortable: true,
            sortKey: 'location',
            cell: (req) => (
                <div className="flex items-start gap-1 text-slate-600 font-semibold text-xs">
                    <MapPin className="h-3.5 w-3.5 text-[#8a6a2f] shrink-0 mt-0.5" />
                    <span className="leading-snug">
                        {getCleanLocation(req)}
                    </span>
                </div>
            ),
        },
        {
            key: 'timeline',
            header: 'Timeline',
            width: 'w-[8%]',
            sortable: true,
            sortKey: 'timeline',
            cell: (req) => {
                const daysRemaining = Math.max(0, Math.ceil((new Date(req.lastDate).getTime() - Date.now()) / 86400000));
                return (
                    <div className="space-y-0.5 text-xs whitespace-nowrap">
                        <p className="font-extrabold text-slate-900">{formatDateIN(req.lastDate)}</p>
                        <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
                            daysRemaining <= 3 ? 'bg-rose-50 text-rose-700 border-rose-200' : daysRemaining <= 7 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-[#0b2447] border-slate-200'
                        )}>
                            {daysRemaining <= 0 ? 'Closed' : `${daysRemaining}D REMAINING`}
                        </span>
                    </div>
                );
            },
        },
        {
            key: 'status',
            header: 'Status',
            width: 'w-[8%]',
            sortable: true,
            sortKey: 'status',
            cell: (req) => {
                const badge = statusBadge(req);
                return (
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider shadow-2xs whitespace-nowrap", badge.cls)}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {badge.label}
                    </span>
                );
            },
        },
        {
            key: 'actions',
            header: 'Actions',
            width: 'w-[10%]',
            align: 'right',
            cellClassName: 'text-right whitespace-nowrap',
            cell: (req) => (
                <button 
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(req);
                    }} 
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-full bg-[#0b2447] px-3.5 text-xs font-black text-white hover:bg-[#12335f] hover:shadow-md active:scale-95 transition-all duration-200 shadow-sm cursor-pointer"
                >
                    View Details
                </button>
            ),
        },
    ], []);

    return (
        <>
            {selected && <BidDetailModal bid={selected} onClose={() => setSelected(null)} />}

            <div className="space-y-3">
                {/* ── Compact integrated toolbar ── */}
                {showSearch && (
                    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                        {/* Row 1: Breadcrumb + result count */}
                        <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                            <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400" aria-label="Breadcrumb">
                                <Link href="/" className="hover:text-[#0b2447] transition-colors">Home</Link>
                                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="font-bold text-slate-700">Public Procurement & Bids</span>
                            </nav>
                            <p className="text-[11px] font-semibold text-slate-400 hidden sm:block" aria-live="polite" role="status">
                                {isLoading || isFetching ? 'Syncing…' : `${total} requirement${total !== 1 ? 's' : ''} found`}
                            </p>
                        </div>

                        {/* Row 2: Search + Sort + Location + Status + View Toggle — all inline */}
                        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                            {/* Search */}
                            <form
                                onSubmit={e => { e.preventDefault(); }}
                                className="flex flex-1 items-center h-9 rounded-lg border border-slate-200 bg-slate-50/80 focus-within:ring-2 focus-within:ring-[#0b2447]/20 focus-within:border-[#0b2447] overflow-hidden min-w-[180px]"
                            >
                                <Search className="h-3.5 w-3.5 text-slate-400 ml-2.5 shrink-0" aria-hidden="true" />
                                <label htmlFor="req-search" className="sr-only">Search requirements</label>
                                <input
                                    id="req-search"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search by title, buyer, location…"
                                    className="flex-1 h-full bg-transparent text-xs pl-2 pr-1 outline-none min-w-0"
                                />
                                {query && (
                                    <button type="button" onClick={() => setQuery('')} className="px-1.5 hover:bg-slate-100 rounded-md" aria-label="Clear search">
                                        <X className="h-3 w-3 text-slate-400" />
                                    </button>
                                )}
                            </form>

                            {/* Sort */}
                            <label htmlFor="req-sort" className="sr-only">Sort requirements</label>
                            <select
                                id="req-sort"
                                value={sort}
                                onChange={e => setSort(e.target.value)}
                                className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 text-slate-700 cursor-pointer min-w-0 w-auto"
                            >
                                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>

                            {showFilters && (
                                <>
                                    {/* Location */}
                                    <div className="relative">
                                        <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
                                        <label htmlFor="req-location" className="sr-only">Filter by location</label>
                                        <input
                                            id="req-location"
                                            value={location}
                                            onChange={e => setLocation(e.target.value)}
                                            placeholder="Location"
                                            className="h-9 w-28 sm:w-32 pl-7 pr-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 bg-white"
                                        />
                                    </div>

                                    {/* Status Filter */}
                                    <label htmlFor="req-status" className="sr-only">Filter by status</label>
                                    <select
                                        id="req-status"
                                        value={statusFilter}
                                        onChange={e => setStatusFilter(e.target.value)}
                                        className={cn(
                                            "h-9 px-2.5 rounded-lg border bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 cursor-pointer min-w-0 w-auto",
                                            statusFilter ? "border-blue-400 text-blue-700" : "border-slate-200 text-slate-700"
                                        )}
                                    >
                                        <option value="">All Status</option>
                                        <option value="OPEN">Open</option>
                                        <option value="CLOSING_SOON">Closing Soon</option>
                                        <option value="UNDER_EVALUATION">Under Evaluation</option>
                                        <option value="AWARDED">Awarded</option>
                                        <option value="CLOSED">Closed</option>
                                    </select>

                                    {/* Clear filters */}
                                    {activeFilters > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => { setLocation(''); setStatusFilter(''); }}
                                            className="h-9 px-2.5 rounded-lg border border-red-200 bg-red-50 text-[10px] font-black text-red-600 hover:bg-red-100 transition-colors uppercase tracking-wider whitespace-nowrap"
                                        >
                                            Clear ({activeFilters})
                                        </button>
                                    )}
                                </>
                            )}

                            {/* View Mode Toggle */}
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 ml-auto shrink-0" aria-label="Display mode">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    className={cn(
                                        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-all",
                                        viewMode === 'grid' ? 'bg-[#0b2447] text-white shadow-sm' : 'text-slate-500 hover:bg-white'
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
                                        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-all",
                                        viewMode === 'list' ? 'bg-[#0b2447] text-white shadow-sm' : 'text-slate-500 hover:bg-white'
                                    )}
                                    title="List view"
                                    aria-label="List view"
                                >
                                    <List className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Row 3: Category tabs — integrated underline-style */}
                        {showTabs && buyerOrganizationId === 'all' && (
                            <div className="flex items-center gap-0 overflow-x-auto no-scrollbar border-t border-slate-100 px-1" role="tablist" aria-label="Requirement categories">
                                {TABS.map(t => (
                                    <button
                                        key={t.id}
                                        role="tab"
                                        aria-selected={tab === t.id}
                                        onClick={() => setTab(t.id)}
                                        className={cn(
                                            "relative shrink-0 px-3.5 py-2.5 text-[11px] font-bold transition-colors whitespace-nowrap",
                                            tab === t.id
                                                ? 'text-[#0b2447]'
                                                : 'text-slate-500 hover:text-slate-700'
                                        )}
                                    >
                                        {t.label}
                                        {tab === t.id && (
                                            <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#0b2447]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Mobile-only result count */}
                <p className="text-[11px] font-semibold text-slate-400 sm:hidden px-1" aria-live="polite" role="status">
                    {isLoading || isFetching ? 'Syncing…' : `${total} requirement${total !== 1 ? 's' : ''} found`}
                </p>

                {/* ── Main content (Loading / Empty / Cards / Table) ── */}
                {isLoading ? (
                    viewMode === 'list' ? (
                        <RequirementsTableSkeleton rows={pageSize} />
                    ) : (
                        <GridSkeleton count={pageSize} />
                    )
                ) : processedRequirements.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                        <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-800">No buyer requirements found.</p>
                        <p className="mt-1 text-xs text-slate-500">Try adjusting your active query or category filters.</p>
                        {activeFilters > 0 && (
                            <button onClick={() => { setQuery(''); setLocation(''); setStatusFilter(''); setTab('all'); }} className="mt-3 text-xs font-black text-[#0b2447] hover:underline">
                                Reset all filters
                            </button>
                        )}
                    </div>
                ) : viewMode === 'list' ? (
                    <DataTable<BuyerRequirement>
                        data={processedRequirements}
                        columns={columns}
                        keyExtractor={(req) => `${req.sourceModel || 'buyer'}-${req.id}`}
                        page={page}
                        pageSize={pageSize}
                        total={data?.total ?? processedRequirements.length}
                        onPageChange={showPagination ? setPage : undefined}
                        onPageSizeChange={showPagination ? setPageSize : undefined}
                        paginationLabel="requirements"
                        sortKey={sort}
                        sortDirection={sortDir}
                        onSort={handleSortHeader}
                        onRowClick={handleViewDetails}
                        minWidth="min-w-[1000px]"
                        isLoading={isLoading}
                    />
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
                                            {req.location && <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-400 font-semibold"><MapPin className="h-3 w-3 text-[#8a6a2f]" />{getCleanLocation(req)}</span>}
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
                                                <span className="font-bold">{formatQuantityWithUnit(req.quantity, req.unit)}</span>
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

                {/* ── Pagination for Grid View ── */}
                {showPagination && viewMode === 'grid' && (
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
function RequirementsTableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div 
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
            role="status"
            aria-label="Loading requirements and bids"
            aria-busy="true"
        >
            <div className="overflow-x-auto w-full max-w-full">
                <table className="w-full border-collapse text-left text-xs table-fixed min-w-[1000px]">
                    <colgroup>
                        <col className="w-[4%]" />
                        <col className="w-[28%]" />
                        <col className="w-[30%]" />
                        <col className="w-[6%]" />
                        <col className="w-[7%]" />
                        <col className="w-[13%]" />
                        <col className="w-[8%]" />
                        <col className="w-[8%]" />
                        <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <th scope="col" className="py-3 px-2.5">SR. NO</th>
                            <th scope="col" className="py-3 px-3">BUYER / ORGANIZATION</th>
                            <th scope="col" className="py-3 px-3">REQUIREMENT DETAILS</th>
                            <th scope="col" className="py-3 px-3">TYPE</th>
                            <th scope="col" className="py-3 px-3">QUANTITY</th>
                            <th scope="col" className="py-3 px-3">LOCATION</th>
                            <th scope="col" className="py-3 px-3">TIMELINE</th>
                            <th scope="col" className="py-3 px-3">STATUS</th>
                            <th scope="col" className="py-3 px-3 text-right">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: Math.min(Math.max(rows, 3), 10) }).map((_, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-2.5">
                                    <div className="h-3 w-5 bg-slate-200/80 rounded animate-pulse" />
                                </td>
                                <td className="py-3 px-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-11 w-11 rounded-full bg-slate-200/80 shrink-0 animate-pulse" />
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <div className="h-3.5 w-32 bg-slate-200/80 rounded animate-pulse" />
                                            <div className="h-2.5 w-20 bg-slate-200/60 rounded animate-pulse" />
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-3">
                                    <div className="space-y-1.5">
                                        <div className="h-3.5 w-44 bg-slate-200/80 rounded animate-pulse" />
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-3.5 w-24 bg-slate-200/70 rounded animate-pulse" />
                                            <div className="h-3 w-28 bg-slate-200/50 rounded animate-pulse" />
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-3">
                                    <div className="h-5 w-16 rounded-full bg-slate-200/80 animate-pulse" />
                                </td>
                                <td className="py-3 px-3">
                                    <div className="h-3.5 w-16 bg-slate-200/80 rounded animate-pulse" />
                                </td>
                                <td className="py-3 px-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-3.5 w-3.5 rounded-full bg-slate-200/70 animate-pulse shrink-0" />
                                        <div className="h-3 w-24 bg-slate-200/70 rounded animate-pulse" />
                                    </div>
                                </td>
                                <td className="py-3 px-3">
                                    <div className="space-y-1">
                                        <div className="h-3.5 w-20 bg-slate-200/80 rounded animate-pulse" />
                                        <div className="h-3.5 w-16 bg-slate-200/60 rounded-full animate-pulse" />
                                    </div>
                                </td>
                                <td className="py-3 px-3">
                                    <div className="h-5 w-16 rounded-full bg-slate-200/80 animate-pulse" />
                                </td>
                                <td className="py-3 px-3 text-right">
                                    <div className="inline-block h-8.5 w-24 rounded-full bg-slate-200/80 animate-pulse" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <span className="sr-only">Loading requirements and bids...</span>
        </div>
    );
}

function GridSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div 
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            role="status"
            aria-label="Loading requirements and bids"
            aria-busy="true"
        >
            {Array.from({ length: Math.min(Math.max(count, 3), 8) }).map((_, index) => (
                <div 
                    key={index} 
                    className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] h-full animate-pulse"
                >
                    <div className="h-1.5 w-full bg-slate-200/80" />
                    <div className="flex flex-1 flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="h-9 w-9 rounded-xl bg-slate-200/80 shrink-0" />
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="h-3.5 w-3/4 bg-slate-200/80 rounded" />
                                    <div className="h-3 w-1/2 bg-slate-200/60 rounded" />
                                </div>
                            </div>
                            <div className="h-5 w-14 rounded-full bg-slate-200/80 shrink-0" />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-slate-200/80 shrink-0" />
                            <div className="h-3 w-28 bg-slate-200/70 rounded" />
                        </div>

                        <div className="space-y-1.5 py-1">
                            <div className="h-2.5 w-full bg-slate-200/60 rounded" />
                            <div className="h-2.5 w-2/3 bg-slate-200/50 rounded" />
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <div className="h-4 w-16 bg-slate-200/70 rounded" />
                            <div className="h-4 w-20 bg-slate-200/60 rounded" />
                            <div className="h-4 w-14 bg-slate-200/60 rounded" />
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                            <div className="space-y-1">
                                <div className="h-2 w-10 bg-slate-200/60 rounded" />
                                <div className="h-3 w-14 bg-slate-200/80 rounded" />
                            </div>
                            <div className="space-y-1">
                                <div className="h-2 w-10 bg-slate-200/60 rounded" />
                                <div className="h-3 w-12 bg-slate-200/80 rounded" />
                            </div>
                            <div className="space-y-1">
                                <div className="h-2 w-10 bg-slate-200/60 rounded" />
                                <div className="h-3 w-12 bg-slate-200/80 rounded" />
                            </div>
                        </div>

                        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                            <div className="h-3 w-16 bg-slate-200/60 rounded" />
                            <div className="h-8 w-24 rounded-lg bg-slate-200/80" />
                        </div>
                    </div>
                </div>
            ))}
            <span className="sr-only">Loading requirements and bids...</span>
        </div>
    );
}
