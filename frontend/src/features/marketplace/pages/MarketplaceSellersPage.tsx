'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft,
    BadgeCheck,
    Building2,
    MapPin,
    Package,
    Search,
    SlidersHorizontal,
    Sparkles,
    Wrench,
    X,
    Bookmark,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Skeleton } from '../../../components/ui/skeleton';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { marketplaceApi, type MarketplaceSeller } from '../api';
import { resolveMediaUrl } from '../../../lib/api';
import { saveSupplier } from '../utils/savedSuppliers';
import { Button } from '../../../components/ui/button';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';

function sellerLogo(seller: MarketplaceSeller) {
    const profile = seller.profile || {};
    const rawLogo = seller.logoUrl || seller.logoFile?.url || profile.logoUrl || profile.logo || profile.organizationLogoUrl || profile.organizationLogo || null;
    return resolveMediaUrl(rawLogo);
}

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('') || 'V';
}

const getInitialsBg = (id: number) => {
    const gradients = [
        'from-blue-600 to-indigo-700 text-white border-blue-400/40 shadow-xs',
        'from-emerald-600 to-teal-700 text-white border-emerald-400/40 shadow-xs',
        'from-purple-600 to-violet-700 text-white border-purple-400/40 shadow-xs',
        'from-amber-600 to-orange-700 text-white border-amber-400/40 shadow-xs',
        'from-rose-600 to-pink-700 text-white border-rose-400/40 shadow-xs',
    ];
    return gradients[Math.abs(id) % gradients.length];
};

function SellerLogoImage({
    logo,
    name,
    orgInitials,
    initialsBg,
    size = 'md',
}: {
    logo?: string | null;
    name: string;
    orgInitials: string;
    initialsBg: string;
    size?: 'sm' | 'md' | 'lg';
}) {
    const [imgError, setImgError] = React.useState(false);

    if (logo && !imgError) {
        return (
            <img
                src={logo}
                alt={`${name} logo`}
                onError={() => setImgError(true)}
                className="max-h-full max-w-[92%] object-contain drop-shadow-2xs transition-transform duration-300 group-hover:scale-108"
                loading="lazy"
            />
        );
    }

    return (
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white font-black text-base tracking-wider shadow-xs ${initialsBg}`}>
            {orgInitials}
        </span>
    );
}

function SellersSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
    if (viewMode === 'list') {
        return (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 sm:px-6 min-w-[260px]"><Skeleton className="h-4 w-32" /></th>
                            <th className="px-4 py-3 sm:px-6 min-w-[180px]"><Skeleton className="h-4 w-24" /></th>
                            <th className="px-4 py-3 sm:px-6 min-w-[260px]"><Skeleton className="h-4 w-28" /></th>
                            <th className="px-4 py-3 sm:px-6 whitespace-nowrap"><Skeleton className="h-4 w-16" /></th>
                            <th className="px-4 py-3 sm:px-6 whitespace-nowrap"><Skeleton className="h-4 w-16" /></th>
                            <th className="px-4 py-3 sm:px-6 text-right whitespace-nowrap"><Skeleton className="h-4 w-24 ml-auto" /></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <tr key={idx}>
                                <td className="px-4 py-3.5 sm:px-6">
                                    <div className="flex items-center gap-3.5">
                                        <Skeleton className="h-14 w-28 rounded-xl shrink-0" />
                                        <div className="space-y-1.5 flex-1"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-16" /></div>
                                    </div>
                                </td>
                                <td className="px-4 py-3.5 sm:px-6"><Skeleton className="h-4 w-28" /></td>
                                <td className="px-4 py-3.5 sm:px-6"><div className="flex gap-1.5"><Skeleton className="h-6 w-24 rounded-md" /><Skeleton className="h-6 w-20 rounded-md" /></div></td>
                                <td className="px-4 py-3.5 sm:px-6"><Skeleton className="h-6 w-14 rounded-lg" /></td>
                                <td className="px-4 py-3.5 sm:px-6"><Skeleton className="h-6 w-14 rounded-lg" /></td>
                                <td className="px-4 py-3.5 sm:px-6 text-right"><div className="flex justify-end gap-2"><Skeleton className="h-8 w-16 rounded-lg" /><Skeleton className="h-8 w-16 rounded-lg" /></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-16 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="h-3 w-1/2 rounded" />
                    </div>
                    <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between">
                        <Skeleton className="h-5 w-24 rounded-md" />
                        <div className="flex gap-1.5">
                            <Skeleton className="h-7.5 w-16 rounded-lg" />
                            <Skeleton className="h-7.5 w-12 rounded-lg" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function MarketplaceSellersPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'location' | 'latest'>('name');
    const [viewMode, setViewMode] = useResponsiveViewMode('marketplace:sellers:viewMode');

    const { data: homeData, isLoading: homeLoading } = useQuery({
        queryKey: ['marketplaceHomeData'],
        queryFn: () => marketplaceApi.getHomeData(),
        staleTime: 60_000,
        retry: 1,
    });

    const { data, isLoading: sellersLoading, isError, error } = useQuery({
        queryKey: ['marketplaceSellersPage'],
        queryFn: () => marketplaceApi.getSellers({ pageSize: 100 }),
        staleTime: 60_000,
        retry: 1,
    });

    const isLoading = sellersLoading || homeLoading;

    const sellerList = useMemo(() => {
        const list = (data as any)?.sellers ?? [];
        return Array.isArray(list) ? list : [];
    }, [data]);

    const displaySellers = sellerList;

    const categories = useMemo(() => {
        const homeCategories = (homeData?.categories ?? []).map(cat => cat.name);
        if (homeCategories.length > 0) return Array.from(new Set(homeCategories)).sort();

        const values = new Set<string>();
        sellerList.forEach((seller: MarketplaceSeller) => {
            const profile = seller.profile || {};
            const categoriesArr = [
                ...(Array.isArray((seller as any).categories) ? (seller as any).categories : []),
                ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
            ].filter(Boolean);
            categoriesArr.forEach((category: string) => values.add(category));
        });
        return Array.from(values).sort();
    }, [sellerList, homeData]);

    const locations = useMemo(() => {
        const values = new Set<string>();
        sellerList.forEach((seller: MarketplaceSeller) => {
            const profile = seller.profile || {};
            [seller.city, seller.district, seller.state, profile.city, profile.district, profile.state]
                .filter(Boolean)
                .forEach((value: string) => values.add(value));
        });
        return Array.from(values).sort();
    }, [sellerList]);

    const filteredSellers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return displaySellers
            .filter((seller: MarketplaceSeller) => {
                const profile = seller.profile || {};
                const categoriesArr = [
                    ...(Array.isArray((seller as any).categories) ? (seller as any).categories : []),
                    ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                    ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
                ].filter(Boolean);

                const locationText = Array.from(new Set([seller.city, seller.district, seller.state, profile.city, profile.district, profile.state].filter(Boolean)))
                    .join(' ')
                    .toLowerCase();

                const matchesSearch = !q || [seller.organizationName, locationText, ...categoriesArr].some(value => String(value).toLowerCase().includes(q));
                const matchesLocation = !locationFilter || locationText.includes(locationFilter.toLowerCase());
                const matchesCategory = !categoryFilter || categoriesArr.some(cat => String(cat).toLowerCase() === categoryFilter.toLowerCase());

                return matchesSearch && matchesLocation && matchesCategory;
            })
            .sort((a: MarketplaceSeller, b: MarketplaceSeller) => {
                if (sortBy === 'location') {
                    const aLoc = Array.from(new Set([a.city, a.district, a.state].filter(Boolean))).join(' ');
                    const bLoc = Array.from(new Set([b.city, b.district, b.state].filter(Boolean))).join(' ');
                    return aLoc.localeCompare(bLoc);
                }
                if (sortBy === 'latest') {
                    return (new Date((b as any).createdAt || 0).getTime()) - (new Date((a as any).createdAt || 0).getTime());
                }
                return a.organizationName.localeCompare(b.organizationName);
            });
    }, [displaySellers, search, locationFilter, categoryFilter, sortBy]);

    const { page, pageSize, pageItems: pagedSellers, total, setPage, setPageSize } = usePagination(filteredSellers, 12);

    const clearFilters = () => {
        setSearch('');
        setLocationFilter('');
        setCategoryFilter('');
        setSortBy('name');
        setPage(1);
    };

    const hasActiveFilters = Boolean(search || locationFilter || categoryFilter || sortBy !== 'name');

    return (
        <div className="min-h-dvh bg-[#f8fafc] text-slate-800">
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-6 lg:px-8">
                
                {/* ════════════════════════════════════════════════════════════════════
                    COMPACT HERO & INTEGRATED CONTROLS SECTION
                ════════════════════════════════════════════════════════════════════ */}
                <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
                    
                    {/* Compact Hero Banner */}
                    <div className="bg-gradient-to-r from-[#0b2447] via-[#12335f] to-[#1e40af] px-4 py-3.5 text-white sm:px-6 sm:py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (typeof window !== 'undefined' && window.history.length > 1) {
                                                router.back();
                                            } else {
                                                router.push('/');
                                            }
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-xs transition hover:bg-white/20 hover:text-white cursor-pointer active:scale-95"
                                        title="Go Back"
                                    >
                                        <ArrowLeft className="h-3 w-3" /> Back
                                    </button>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200 border border-blue-400/20">
                                        <Sparkles className="h-3 w-3 text-amber-300" /> Directory
                                    </span>
                                    <span className="text-xs font-medium text-blue-200/90 hidden sm:inline">
                                        Verified Industrial MSME Partners
                                    </span>
                                </div>
                                <h1 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">
                                    Discover Trusted Seller Organizations
                                </h1>
                            </div>

                            {/* Quick Stat Pill */}
                            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-xs">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                                    <BadgeCheck className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">{sellerList.length} Verified Suppliers</div>
                                    <div className="text-[10px] text-white/70">GST & Udyam Verified</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Search + Filter + View Toggle Toolbar ── */}
                    <div className="p-3.5 sm:p-4">
                        <ResponsiveFilterBar
                            activeFilterCount={(search ? 1 : 0) + (locationFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (sortBy !== 'name' ? 1 : 0)}
                            searchInput={
                                <div className="relative w-full">
                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={event => setSearch(event.target.value)}
                                        placeholder="Search by seller name, category, or location…"
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                                    />
                                </div>
                            }
                            filters={
                                <>
                                    <div className="w-full sm:w-auto sm:min-w-[140px]">
                                        <select
                                            value={locationFilter}
                                            onChange={event => setLocationFilter(event.target.value)}
                                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                        >
                                            <option value="">All Locations ({locations.length})</option>
                                            {locations.map(location => (
                                                <option key={location} value={location}>{location}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="w-full sm:w-auto sm:min-w-[160px]">
                                        <select
                                            value={categoryFilter}
                                            onChange={event => setCategoryFilter(event.target.value)}
                                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                        >
                                            <option value="">All Categories ({categories.length})</option>
                                            {categories.map(category => (
                                                <option key={category} value={category}>{category}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="w-full sm:w-auto sm:min-w-[130px]">
                                        <select
                                            value={sortBy}
                                            onChange={event => setSortBy(event.target.value as 'name' | 'location' | 'latest')}
                                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                        >
                                            <option value="name">Sort: A to Z</option>
                                            <option value="location">Sort: Location</option>
                                            <option value="latest">Sort: Latest</option>
                                        </select>
                                    </div>

                                    {hasActiveFilters && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={clearFilters}
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
                </section>

                {/* ════════════════════════════════════════════════════════════════════
                    SELLER LIST / GRID CONTENT
                ════════════════════════════════════════════════════════════════════ */}
                {isLoading ? (
                    <SellersSkeleton viewMode={viewMode} />
                ) : isError ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-800 shadow-2xs">
                        The marketplace directory is temporarily unavailable. Showing a preview of the verified seller experience while the service recovers.
                        <div className="mt-1.5 text-xs text-amber-700">{error instanceof Error ? error.message : 'Unable to load sellers right now.'}</div>
                    </div>
                ) : filteredSellers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-2xs">
                        <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                        <h2 className="mt-2 text-base font-bold text-slate-700">No seller matches your search</h2>
                        <p className="mt-1 text-xs font-medium text-slate-500">Try adjusting the filters or searching for a different category or city.</p>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0b2447] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#12335f]"
                        >
                            <X className="h-3.5 w-3.5" /> Reset Filters
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {viewMode === 'list' ? (
                            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3.5 sm:px-6 min-w-[260px]">Seller Organization</th>
                                            <th className="px-4 py-3.5 sm:px-6 min-w-[180px]">Location</th>
                                            <th className="px-4 py-3.5 sm:px-6 min-w-[260px]">Capabilities</th>
                                            <th className="px-4 py-3.5 sm:px-6 whitespace-nowrap">Products</th>
                                            <th className="px-4 py-3.5 sm:px-6 whitespace-nowrap">Services</th>
                                            <th className="px-4 py-3.5 sm:px-6 text-right whitespace-nowrap">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pagedSellers.map((seller: MarketplaceSeller) => {
                                            const profile = seller.profile || {};
                                            const location = Array.from(new Set([seller.city, seller.district, seller.state, profile.city, profile.district, profile.state].filter(Boolean))).join(', ');
                                            const sUserId = (seller as any).sellerUserId || ((seller as any).users && (seller as any).users[0]?.id) || null;
                                            const categoriesArr = [
                                                ...(Array.isArray((seller as any).categories) ? (seller as any).categories : []),
                                                ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                                                ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
                                            ].filter(Boolean);
                                            const products = seller._count?.products || 0;
                                            const services = seller._count?.services || 0;
                                            const logo = sellerLogo(seller);
                                            const initialsText = initials(seller.organizationName);
                                            const initialsBg = getInitialsBg(seller.id);

                                            return (
                                                <tr key={seller.id} className="hover:bg-blue-50/40 transition-colors group">
                                                    <td className="px-4 py-3.5 sm:px-6">
                                                        <div className="flex items-center gap-3.5">
                                                            <Link href={`/marketplace/sellers/${seller.id}`} className="shrink-0">
                                                                <div className="flex h-14 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-2 group-hover:border-[#0b2447] group-hover:shadow-xs transition-all">
                                                                    <SellerLogoImage
                                                                        logo={logo}
                                                                        name={seller.organizationName}
                                                                        orgInitials={initialsText}
                                                                        initialsBg={initialsBg}
                                                                        size="md"
                                                                    />
                                                                </div>
                                                            </Link>
                                                            <div className="flex flex-col min-w-0">
                                                                <Link href={`/marketplace/sellers/${seller.id}`} className="font-extrabold text-slate-900 hover:text-[#0b2447] transition-colors leading-snug break-words">
                                                                    {seller.organizationName}
                                                                </Link>
                                                                <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 mt-1">
                                                                    <BadgeCheck className="h-3 w-3 text-emerald-500" /> Verified
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5 sm:px-6">
                                                        <div className="flex items-start gap-1.5 text-slate-600 text-xs">
                                                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                            <span className="leading-relaxed break-words">{location || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5 sm:px-6">
                                                        {categoriesArr.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                                                                {categoriesArr.slice(0, 2).map((cat, i) => (
                                                                    <span key={i} className="inline-flex items-center rounded-md bg-blue-50/90 border border-blue-100/90 px-2.5 py-1 text-[11px] font-semibold text-[#0b2447] leading-tight">
                                                                        {cat}
                                                                    </span>
                                                                ))}
                                                                {categoriesArr.length > 2 && (
                                                                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                                                                        +{categoriesArr.length - 2} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 font-medium">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 sm:px-6 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 text-xs font-bold text-slate-700">
                                                            <Package className="h-3.5 w-3.5 text-blue-600" /> {products}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 sm:px-6 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 text-xs font-bold text-slate-700">
                                                            <Wrench className="h-3.5 w-3.5 text-indigo-600" /> {services}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 sm:px-6 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Link
                                                                href={`/marketplace/sellers/${seller.id}`}
                                                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0b2447] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#12335f] active:scale-95"
                                                            >
                                                                <Building2 className="h-3.5 w-3.5" /> Store
                                                            </Link>
                                                            {user?.role === 'buyer' ? (
                                                                <Link
                                                                    href={sUserId ? `/buyer/rfq?sellerId=${sUserId}` : `/marketplace/sellers/${seller.id}`}
                                                                    className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                                                                >
                                                                    Quote
                                                                </Link>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        saveSupplier({
                                                                            id: seller.id,
                                                                            sellerUserId: sUserId,
                                                                            name: seller.organizationName,
                                                                            location,
                                                                            verificationStatus: seller.verificationStatus || 'VERIFIED',
                                                                            email: (seller as any).email || null,
                                                                            mobile: (seller as any).mobile || null,
                                                                            source: 'Verified sellers page',
                                                                        });
                                                                    }}
                                                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                                                                >
                                                                    <Bookmark className="h-3.5 w-3.5 text-slate-400" /> Save
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {pagedSellers.map((seller: MarketplaceSeller) => {
                                    const profile = seller.profile || {};
                                    const location = Array.from(new Set([seller.city, seller.district, seller.state, profile.city, profile.district, profile.state].filter(Boolean))).join(', ');
                                    const sUserId = (seller as any).sellerUserId || ((seller as any).users && (seller as any).users[0]?.id) || null;
                                    const categoriesArr = [
                                        ...(Array.isArray((seller as any).categories) ? (seller as any).categories : []),
                                        ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                                        ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
                                    ].filter(Boolean);
                                    const products = seller._count?.products || 0;
                                    const services = seller._count?.services || 0;
                                    const logo = sellerLogo(seller);
                                    const initialsText = initials(seller.organizationName);
                                    const initialsBg = getInitialsBg(seller.id);

                                    return (
                                        <article
                                            key={seller.id}
                                            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs hover:shadow-[0_14px_32px_-6px_rgba(11,36,71,0.12)] hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                                        >
                                            {/* Top Row: Organization Type & Verified */}
                                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider truncate max-w-[140px]">
                                                    {(seller as any).organizationType ? String((seller as any).organizationType).replace(/_/g, ' ') : 'SUPPLIER'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
                                                    <BadgeCheck className="h-3 w-3 text-emerald-500" /> Verified
                                                </span>
                                            </div>

                                            {/* Center: Prominent Large Logo Box */}
                                            <Link href={`/marketplace/sellers/${seller.id}`} className="block mb-3">
                                                <div className="flex h-24 sm:h-26 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-slate-50/90 to-slate-100/40 border border-slate-200/70 p-3 transition-all duration-300 group-hover:bg-white group-hover:border-blue-300 group-hover:shadow-xs">
                                                    <SellerLogoImage
                                                        logo={logo}
                                                        name={seller.organizationName}
                                                        orgInitials={initialsText}
                                                        initialsBg={initialsBg}
                                                        size="lg"
                                                    />
                                                </div>
                                            </Link>

                                            {/* Organization Name & Location */}
                                            <div className="mb-2 space-y-0.5">
                                                <Link href={`/marketplace/sellers/${seller.id}`}>
                                                    <h3 title={seller.organizationName} className="text-sm font-bold text-[#0b2447] group-hover:text-blue-600 transition-colors line-clamp-1 leading-snug">
                                                        {seller.organizationName}
                                                    </h3>
                                                </Link>
                                                <p className="flex items-center gap-1 text-xs text-slate-500">
                                                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span title={location || 'Jharsuguda, Odisha'} className="line-clamp-1 truncate">
                                                        {location || 'Jharsuguda, Odisha'}
                                                    </span>
                                                </p>
                                            </div>

                                            {/* Capabilities Tags */}
                                            <div className="min-h-[1.5rem] flex items-center mb-3">
                                                {categoriesArr.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {categoriesArr.slice(0, 2).map((cat, i) => (
                                                            <span key={i} className="inline-flex items-center rounded-md bg-blue-50/90 border border-blue-100/80 px-2 py-0.5 text-[10px] font-semibold text-[#0b2447] leading-tight truncate max-w-[120px]">
                                                                {cat}
                                                            </span>
                                                        ))}
                                                        {categoriesArr.length > 2 && (
                                                            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                                                +{categoriesArr.length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 font-medium">Verified Industrial Partner</span>
                                                )}
                                            </div>

                                            {/* Bottom: Action & Stats */}
                                            <div className="pt-2.5 border-t border-slate-100 flex flex-col space-y-2">
                                                {/* Stats */}
                                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                                    <span className="inline-flex items-center gap-1 font-medium">
                                                        <Package className="h-3.5 w-3.5 text-blue-600" />
                                                        <strong className="font-extrabold text-[#0b2447]">{products}</strong> Products
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 font-medium">
                                                        <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                                                        <strong className="font-extrabold text-[#0b2447]">{services}</strong> Services
                                                    </span>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-2">
                                                    <Link
                                                        href={`/marketplace/sellers/${seller.id}`}
                                                        className="inline-flex flex-1 h-8 items-center justify-center gap-1.5 rounded-xl bg-[#0b2447] px-3 text-xs font-bold text-white shadow-xs transition-all duration-200 hover:bg-[#12335f] hover:shadow-sm active:scale-95"
                                                    >
                                                        <Building2 className="h-3.5 w-3.5" /> View Store
                                                    </Link>
                                                    {user?.role === 'buyer' ? (
                                                        <Link
                                                            href={sUserId ? `/buyer/rfq?sellerId=${sUserId}` : `/marketplace/sellers/${seller.id}`}
                                                            className="inline-flex flex-1 h-8 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                                                        >
                                                            Quote
                                                        </Link>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                saveSupplier({
                                                                    id: seller.id,
                                                                    sellerUserId: sUserId,
                                                                    name: seller.organizationName,
                                                                    location,
                                                                    verificationStatus: seller.verificationStatus || 'VERIFIED',
                                                                    email: (seller as any).email || null,
                                                                    mobile: (seller as any).mobile || null,
                                                                    source: 'Verified sellers page',
                                                                });
                                                            }}
                                                            className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 h-8 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                                                        >
                                                            <Bookmark className="h-3.5 w-3.5 text-slate-400" /> Save
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                            pageSizeOptions={[12, 24, 48]}
                            label="sellers"
                        />
                    </div>
                )}
            </main>

            <MarketplaceFooter />
        </div>
    );
}
