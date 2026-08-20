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
import { ViewModeToggle } from '../../shared/ViewModeToggle';
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
    initialsBg
}: {
    logo?: string | null;
    name: string;
    orgInitials: string;
    initialsBg: string;
}) {
    const [imgError, setImgError] = React.useState(false);

    if (logo && !imgError) {
        return (
            <img
                src={logo}
                alt={`${name} logo`}
                onError={() => setImgError(true)}
                className="w-full h-full object-contain rounded-full transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
            />
        );
    }

    return (
        <span className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br font-black tracking-wider text-white shadow-xs ${initialsBg}`}>
            {orgInitials}
        </span>
    );
}

function SellersSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
    if (viewMode === 'list') {
        return (
            <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                        key={idx}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs"
                    >
                        <div className="flex items-center gap-4 min-w-0 md:w-2/5">
                            <Skeleton className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-2 pt-1">
                                <Skeleton className="h-4 w-44" />
                                <Skeleton className="h-3 w-28" />
                            </div>
                        </div>
                        <div className="flex-1 space-y-2 py-2 md:py-0">
                            <Skeleton className="h-3.5 w-full max-w-xs" />
                            <Skeleton className="h-3 w-36" />
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Skeleton className="h-9 w-24 rounded-xl" />
                            <Skeleton className="h-9 w-28 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
                <div
                    key={idx}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs space-y-4"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-36" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                        <Skeleton className="h-4.5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Skeleton className="h-9 flex-1 rounded-xl" />
                        <Skeleton className="h-9 flex-1 rounded-xl" />
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

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['marketplaceSellersPage', sortBy],
        queryFn: () => marketplaceApi.getSellers({ pageSize: 100, sort: sortBy }),
        staleTime: 60_000,
        retry: 1,
    });

    const { data: featuredCatData } = useQuery({
        queryKey: ['featuredCategoriesForSellersPage'],
        queryFn: () => marketplaceApi.getFeaturedCategories(),
        staleTime: 5 * 60_000,
    });

    const sellerList = useMemo(() => {
        const list = (data as any)?.sellers ?? [];
        return Array.isArray(list) ? list : [];
    }, [data]);

    const displaySellers = sellerList;

    const locations = useMemo(() => {
        const values = new Set<string>();
        sellerList.forEach((seller: any) => {
            const profile = seller.profile || {};
            [seller.city, seller.district, seller.state, profile.city, profile.district, profile.state]
                .filter(Boolean)
                .forEach((value: string) => values.add(value));
        });
        return Array.from(values).sort();
    }, [sellerList]);

    const categories = useMemo(() => {
        const values = new Set<string>();
        sellerList.forEach((seller: any) => {
            const profile = seller.profile || {};
            const collection = [
                ...(Array.isArray(seller.categories) ? seller.categories : []),
                ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
                ...(Array.isArray(profile.categories) ? profile.categories : []),
            ];
            collection.filter(Boolean).forEach((value: string) => values.add(String(value)));
        });

        // Merge featured system categories if present
        const systemCats = (featuredCatData as any)?.categories ?? [];
        if (Array.isArray(systemCats)) {
            systemCats.forEach((c: any) => {
                if (c?.name) values.add(String(c.name));
            });
        }

        return Array.from(values).sort();
    }, [sellerList, featuredCatData]);

    const filteredSellers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return displaySellers
            .filter((seller: MarketplaceSeller) => {
                const profile = seller.profile || {};
                const locationText = Array.from(new Set([seller.city, seller.district, seller.state, profile.city, profile.district, profile.state].filter(Boolean)))
                    .join(' ')
                    .toLowerCase();
                const categoryText = [
                    ...(Array.isArray((seller as any).categories) ? (seller as any).categories : []),
                    ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                    ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
                    ...(Array.isArray(profile.categories) ? profile.categories : []),
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                const matchesSearch = !q || [seller.organizationName, profile.organizationType, locationText, categoryText].some(value => String(value).toLowerCase().includes(q));
                const matchesLocation = !locationFilter || locationText.includes(locationFilter.toLowerCase());
                const matchesCategory = !categoryFilter || categoryText.includes(categoryFilter.toLowerCase());
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

                    {/* Integrated Search & Filter Controls */}
                    <div className="p-3.5 sm:p-4 space-y-3">
                        <div className="grid gap-2.5 md:grid-cols-12">
                            {/* Search Input */}
                            <div className="md:col-span-5 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    placeholder="Search by seller name, category, or location…"
                                    className="w-full h-9.5 rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-8 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#0b2447] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2447]/10 transition-all"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Location Filter */}
                            <div className="md:col-span-3 relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <select
                                    value={locationFilter}
                                    onChange={event => setLocationFilter(event.target.value)}
                                    className="w-full h-9.5 rounded-xl border border-slate-200 bg-white pl-9 pr-7 text-xs font-medium text-slate-700 outline-none focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">All Locations ({locations.length})</option>
                                    {locations.map(location => (
                                        <option key={location} value={location}>{location}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Category Filter (Fully Populated) */}
                            <div className="md:col-span-2 relative">
                                <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <select
                                    value={categoryFilter}
                                    onChange={event => setCategoryFilter(event.target.value)}
                                    className="w-full h-9.5 rounded-xl border border-slate-200 bg-white pl-9 pr-7 text-xs font-medium text-slate-700 outline-none focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">All Categories ({categories.length})</option>
                                    {categories.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sort Option */}
                            <div className="md:col-span-2 relative">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <select
                                    value={sortBy}
                                    onChange={event => setSortBy(event.target.value as 'name' | 'location' | 'latest')}
                                    className="w-full h-9.5 rounded-xl border border-slate-200 bg-white pl-9 pr-7 text-xs font-medium text-slate-700 outline-none focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="name">Sort: A to Z</option>
                                    <option value="location">Sort: Location</option>
                                    <option value="latest">Sort: Latest</option>
                                </select>
                            </div>
                        </div>

                        {/* Status & View Toolbar */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                                <p className="text-xs font-semibold text-slate-500">
                                    Showing <span className="font-bold text-slate-800">{filteredSellers.length}</span> of {displaySellers.length} suppliers
                                </p>
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                                    >
                                        <X className="h-3 w-3" /> Clear Filters
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <ViewModeToggle value={viewMode} onChange={setViewMode} size="sm" />
                            </div>
                        </div>
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
                        <div className={viewMode === 'grid' ? "grid gap-4 md:grid-cols-2 2xl:grid-cols-3" : "flex flex-col gap-3"}>
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

                                if (viewMode === 'list') {
                                    return (
                                        <article
                                            key={seller.id}
                                            className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs transition-all hover:border-blue-200 hover:shadow-md"
                                        >
                                            {/* Left: Highly Visible Logo & Basic Details */}
                                            <div className="flex items-center gap-4 min-w-0 md:w-2/5 shrink-0">
                                                <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200/90 bg-white shadow-sm p-1 sm:p-1.5 transition-all duration-300 group-hover:scale-105 group-hover:border-[#0b2447] group-hover:shadow-md">
                                                    <SellerLogoImage
                                                        logo={logo}
                                                        name={seller.organizationName}
                                                        orgInitials={initialsText}
                                                        initialsBg={initialsBg}
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1 space-y-1.5">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0b2447] transition-colors line-clamp-1">
                                                            {seller.organizationName}
                                                        </h3>
                                                        <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                                                            <BadgeCheck className="h-3 w-3 text-emerald-500" /> Verified
                                                        </span>
                                                    </div>

                                                    <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                                        <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                                        <span className="truncate">{location || 'Location not listed'}</span>
                                                    </p>

                                                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                                                            {profile.organizationType ? String(profile.organizationType).replace(/_/g, ' ') : 'MSME'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Center: Capabilities & Key Specs */}
                                            <div className="flex-1 min-w-0 px-0 md:px-4 py-2 md:py-0 border-y md:border-y-0 md:border-x border-slate-100 space-y-2">
                                                {categoriesArr.length > 0 ? (
                                                    <div className="space-y-1">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Core Capabilities</div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {categoriesArr.slice(0, 3).map((cat, i) => (
                                                                <span key={i} className="inline-flex items-center rounded-md bg-blue-50/90 border border-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900">
                                                                    {cat}
                                                                </span>
                                                            ))}
                                                            {categoriesArr.length > 3 && (
                                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                                                    +{categoriesArr.length - 3} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Capabilities</div>
                                                        <div className="text-xs text-slate-500 font-medium">Verified industrial supplier & distributor</div>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 text-xs font-medium text-slate-600 pt-0.5">
                                                    <span className="inline-flex items-center gap-1 text-slate-700">
                                                        <Package className="h-3.5 w-3.5 text-blue-600" />
                                                        <strong className="font-bold text-slate-900">{products}</strong> Products
                                                    </span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="inline-flex items-center gap-1 text-slate-700">
                                                        <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                                                        <strong className="font-bold text-slate-900">{services}</strong> Services
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex items-center gap-2 shrink-0 md:w-auto">
                                                <Link
                                                    href={`/vendors/${seller.id}`}
                                                    className="inline-flex flex-1 md:flex-initial items-center justify-center gap-1.5 rounded-xl bg-[#0b2447] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#12335f] active:scale-95"
                                                >
                                                    <Building2 className="h-3.5 w-3.5" /> View Store
                                                </Link>
                                                {user?.role === 'buyer' ? (
                                                    <Link
                                                        href={sUserId ? `/buyer/rfq?sellerId=${sUserId}` : `/vendors/${seller.id}`}
                                                        className="inline-flex flex-1 md:flex-initial items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                                                    >
                                                        Request Quote
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
                                                        className="inline-flex flex-1 md:flex-initial items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                                                    >
                                                        <Bookmark className="h-3.5 w-3.5 text-slate-400" /> Save
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    );
                                }

                                return (
                                    <article
                                        key={seller.id}
                                        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs transition-all hover:border-blue-200 hover:shadow-md"
                                    >
                                        <div className="space-y-3">
                                            {/* Header: Visible Logo + Title + Badge */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3.5 min-w-0">
                                                    <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200/90 bg-white shadow-sm p-1 transition-all duration-300 group-hover:scale-105 group-hover:border-[#0b2447] group-hover:shadow-md">
                                                        <SellerLogoImage
                                                            logo={logo}
                                                            name={seller.organizationName}
                                                            orgInitials={initialsText}
                                                            initialsBg={initialsBg}
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0b2447] transition-colors line-clamp-1">
                                                            {seller.organizationName}
                                                        </h3>
                                                        <p className="flex items-center gap-1 text-xs font-medium text-slate-500 mt-0.5">
                                                            <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                                            <span className="truncate">{location || 'Location not listed'}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-0.5 shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                                                    <BadgeCheck className="h-3 w-3 text-emerald-500" /> Verified
                                                </span>
                                            </div>

                                            {/* Capabilities */}
                                            {categoriesArr.length > 0 && (
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Capabilities</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {categoriesArr.slice(0, 3).map((cat, i) => (
                                                            <span key={i} className="inline-flex items-center rounded-md bg-blue-50/90 border border-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900">
                                                                {cat}
                                                            </span>
                                                        ))}
                                                        {categoriesArr.length > 3 && (
                                                            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                                                +{categoriesArr.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Stats & Org Type */}
                                            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-100 text-xs font-medium text-slate-600">
                                                <div className="flex items-center gap-3">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Package className="h-3.5 w-3.5 text-blue-600" />
                                                        <strong className="font-bold text-slate-900">{products}</strong> Products
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                                                        <strong className="font-bold text-slate-900">{services}</strong> Services
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase text-slate-500">
                                                    {profile.organizationType ? String(profile.organizationType).replace(/_/g, ' ') : 'MSME'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100">
                                            <Link
                                                href={`/vendors/${seller.id}`}
                                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0b2447] px-3 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#12335f] active:scale-95"
                                            >
                                                <Building2 className="h-3.5 w-3.5" /> View Store
                                            </Link>
                                            {user?.role === 'buyer' ? (
                                                <Link
                                                    href={sUserId ? `/buyer/rfq?sellerId=${sUserId}` : `/vendors/${seller.id}`}
                                                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                                                >
                                                    Request Quote
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
                                                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                                                >
                                                    <Bookmark className="h-3.5 w-3.5 text-slate-400" /> Save
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                            pageSizeOptions={[12, 24, 48]}
                            label="suppliers"
                        />
                    </div>
                )}
            </main>

            <MarketplaceFooter />
        </div>
    );
}
