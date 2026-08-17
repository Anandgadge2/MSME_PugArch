'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft,
    BadgeCheck,
    Building2,
    ChevronRight,
    MapPin,
    Package,
    Search,
    SlidersHorizontal,
    Sparkles,
    Wrench,
    X,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Skeleton } from '../../../components/ui/skeleton';
import { MarketplaceHeader } from '../components/MarketplaceHeader';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { marketplaceApi, type MarketplaceSeller } from '../api';
import { saveSupplier } from '../utils/savedSuppliers';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';

function sellerLogo(seller: MarketplaceSeller) {
    const profile = seller.profile || {};
    return seller.logoUrl || seller.logoFile?.url || profile.logoUrl || profile.logo || profile.organizationLogoUrl || profile.organizationLogo || null;
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
        'from-blue-50 to-indigo-100 text-[#0b2447] border-indigo-200/60',
        'from-emerald-50 to-teal-100 text-emerald-800 border-emerald-200/60',
        'from-purple-50 to-violet-100 text-purple-800 border-purple-200/60',
        'from-amber-50 to-orange-100 text-amber-800 border-amber-200/60',
        'from-rose-50 to-pink-100 text-rose-800 border-rose-200/60',
    ];
    return gradients[Math.abs(id) % gradients.length];
};

function SellersSkeleton({ viewMode, userRole }: { viewMode: 'grid' | 'list'; userRole?: string }) {
    if (viewMode === 'list') {
        return (
            <div className="flex flex-col gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                    >
                        <div className="flex flex-1 items-start gap-4 min-w-0">
                            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200" />
                            <div className="min-w-0 flex-1 space-y-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Skeleton className="h-4.5 w-56 sm:w-72" />
                                    <Skeleton className="h-4.5 w-16 rounded-full" />
                                    <Skeleton className="h-4.5 w-24 rounded-full" />
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0 border-t border-slate-100 pt-4 sm:border-t-0 sm:pt-0">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Skeleton className="h-8.5 w-24 rounded-xl" />
                                <Skeleton className="h-8.5 w-28 rounded-xl" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
                <div
                    key={idx}
                    className="flex flex-col justify-between overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm h-full space-y-5"
                >
                    <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Skeleton className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-4.5 w-11/12" />
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                            </div>
                            <Skeleton className="h-4.5 w-16 rounded-full shrink-0" />
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Skeleton className="h-4.5 w-24 rounded-full" />
                            <Skeleton className="h-4.5 w-32 rounded-full" />
                        </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 space-y-4">
                        <div className="flex gap-2 w-full pt-1">
                            <Skeleton className="h-9 flex-1 rounded-xl" />
                            <Skeleton className="h-9 flex-1 rounded-xl" />
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

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['marketplaceSellersPage', sortBy],
        queryFn: () => marketplaceApi.getSellers({ pageSize: 100, sort: sortBy }),
        staleTime: 60_000,
        retry: 1,
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
                ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
                ...(Array.isArray(profile.categories) ? profile.categories : []),
            ];
            collection.filter(Boolean).forEach((value: string) => values.add(String(value)));
        });
        return Array.from(values).sort();
    }, [sellerList]);

    const filteredSellers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return displaySellers
            .filter((seller: MarketplaceSeller) => {
                const profile = seller.profile || {};
                const locationText = Array.from(new Set([seller.city, seller.district, seller.state, profile.city, profile.district, profile.state].filter(Boolean)))
                    .join(' ')
                    .toLowerCase();
                const categoryText = [
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

    return (
        <div className="min-h-dvh bg-[#f4f6fb] text-slate-800">
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-gradient-to-br from-[#0b2447] via-[#12335f] to-[#275a9a] px-5 py-6 text-white sm:px-8 sm:py-8">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/90 backdrop-blur transition hover:bg-white/20"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Back
                        </button>
                        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
                                    <Sparkles className="h-3.5 w-3.5" /> verified supplier directory
                                </div>
                                <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Discover trusted seller organizations</h1>
                                <p className="mt-2 text-sm font-medium text-white/80 sm:text-base">
                                    Search by location, industry, and service capability to find the right verified partner for your procurement needs.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-sm backdrop-blur">
                                <div className="flex items-center gap-2 font-semibold text-white/90">
                                    <BadgeCheck className="h-4 w-4 text-emerald-300" />
                                    <span>{sellerList.length} verified organizations available</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/75">
                                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">GST Verified</span>
                                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">Udyam Ready</span>
                                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">Fast RFQ</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-5 py-5 sm:px-8">
                        <div className="grid gap-3 xl:grid-cols-[1.6fr_0.8fr_0.8fr_0.6fr]">
                            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-[#0b2447] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0b2447]/10">
                                <Search className="h-4 w-4 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    placeholder="Search by seller name, category, or city"
                                    className="w-full border-none bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
                                />
                            </label>
                            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <select value={locationFilter} onChange={event => setLocationFilter(event.target.value)} className="w-full bg-transparent outline-none">
                                    <option value="">All locations</option>
                                    {locations.map(location => <option key={location} value={location}>{location}</option>)}
                                </select>
                            </label>
                            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                                <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="w-full bg-transparent outline-none">
                                    <option value="">All categories</option>
                                    {categories.map(category => <option key={category} value={category}>{category}</option>)}
                                </select>
                            </label>
                            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                                <Package className="h-4 w-4 text-slate-400" />
                                <select value={sortBy} onChange={event => setSortBy(event.target.value as 'name' | 'location' | 'latest')} className="w-full bg-transparent outline-none">
                                    <option value="name">Name A–Z</option>
                                    <option value="location">Location</option>
                                    <option value="latest">Latest</option>
                                </select>
                            </label>
                        </div>

                        {(search || locationFilter || categoryFilter || sortBy !== 'name') && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#0b2447] transition hover:text-[#12335f]"
                            >
                                <X className="h-3.5 w-3.5" /> Clear filters
                            </button>
                        )}

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-4 mt-4">
                            <p className="text-xs font-semibold text-slate-500">
                                Showing {filteredSellers.length} of {displaySellers.length} supplier organizations
                            </p>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">View:</span>
                                <ViewModeToggle value={viewMode} onChange={setViewMode} />
                            </div>
                        </div>
                    </div>
                </section>

                {isLoading ? (
                    <SellersSkeleton viewMode={viewMode} userRole={user?.role} />
                ) : isError ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-800 shadow-sm">
                        The marketplace directory is temporarily unavailable. Showing a preview of the verified seller experience while the service recovers.
                        <div className="mt-2 text-xs text-amber-700">{error instanceof Error ? error.message : 'Unable to load sellers right now.'}</div>
                    </div>
                ) : filteredSellers.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                        <Building2 className="mx-auto h-12 w-12 text-slate-300" />
                        <h2 className="mt-3 text-lg font-black text-slate-700">No seller matches your search</h2>
                        <p className="mt-2 text-sm font-medium text-slate-500">Try adjusting the filters or searching for a different category or city.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className={viewMode === 'grid' ? "grid gap-5 md:grid-cols-2 2xl:grid-cols-3" : "flex flex-col gap-4"}>
                            {pagedSellers.map((seller: MarketplaceSeller) => {
                                const profile = seller.profile || {};
                                const location = Array.from(new Set([seller.city, seller.district, seller.state, profile.city, profile.district, profile.state].filter(Boolean))).join(', ');
                                const sUserId = (seller as any).sellerUserId || ((seller as any).users && (seller as any).users[0]?.id) || null;
                                const categoryText = [
                                    ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                                    ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
                                ].filter(Boolean).slice(0, 2).join(' • ');
                                const products = seller._count?.products || 0;
                                const services = seller._count?.services || 0;
                                const logo = sellerLogo(seller);
                                const initialsText = initials(seller.organizationName);
                                const initialsBg = getInitialsBg(seller.id);

                                if (viewMode === 'list') {
                                    return (
                                        <article key={seller.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                                            <div className="flex flex-1 items-start gap-4 min-w-0">
                                                {logo ? (
                                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
                                                        <img src={logo} alt={`${seller.organizationName} logo`} className="h-full w-full object-contain" loading="lazy" />
                                                    </div>
                                                ) : (
                                                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br text-sm font-black ${initialsBg}`}>
                                                        {initialsText}
                                                    </div>
                                                )}

                                                <div className="min-w-0 flex-1 space-y-1.5">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-base font-black text-slate-900 line-clamp-1">{seller.organizationName}</h3>
                                                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                                            Verified
                                                        </span>
                                                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-slate-600">
                                                            {profile.organizationType ? String(profile.organizationType).replace(/_/g, ' ') : 'MSME'}
                                                        </span>
                                                    </div>

                                                    <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                                                        <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                                        <span className="truncate">{location || 'Location not listed'}</span>
                                                    </p>

                                                    {categoryText && (
                                                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-600">
                                                            <span className="text-blue-700 bg-blue-50/50 border border-blue-100 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Capabilities</span>
                                                            <span className="text-slate-500 truncate max-w-[300px] sm:max-w-md">{categoryText}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0 border-t border-slate-100 pt-4 sm:border-t-0 sm:pt-0">
                                                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                                                    <span><strong className="text-slate-800">{products}</strong> Products</span>
                                                    <span>•</span>
                                                    <span><strong className="text-slate-800">{services}</strong> Services</span>
                                                </div>

                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <Link
                                                        href={`/vendors/${seller.id}`}
                                                        className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl bg-[#0b2447] px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#12335f] shadow-xs"
                                                    >
                                                        <Building2 className="h-3.5 w-3.5" /> View Store
                                                    </Link>
                                                    {user?.role === 'buyer' ? (
                                                        <Link
                                                            href={sUserId ? `/buyer/rfq?sellerId=${sUserId}` : `/vendors/${seller.id}`}
                                                            className="inline-flex flex-1 sm:flex-initial items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-orange-700 transition hover:bg-orange-100"
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
                                                            className="inline-flex flex-1 sm:flex-initial items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            Save Supplier
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                }

                                return (
                                    <article
                                        key={seller.id}
                                        className="flex flex-col justify-between overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                {logo ? (
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                                        <img src={logo} alt={`${seller.organizationName} logo`} className="h-full w-full object-contain" loading="lazy" />
                                                    </div>
                                                ) : (
                                                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br text-sm font-black ${initialsBg}`}>
                                                        {initialsText}
                                                    </div>
                                                )}
                                                <div>
                                                    <h3 className="text-base font-black text-slate-900 line-clamp-1">{seller.organizationName}</h3>
                                                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                                                        <MapPin className="h-3.5 w-3.5 text-orange-500" />
                                                        <span>{location || 'Location not listed'}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                                Verified
                                            </span>
                                        </div>

                                        {categoryText && (
                                            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                                                <span className="text-blue-700 bg-blue-50/50 border border-blue-100 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Capabilities</span>
                                                <span className="text-slate-500">{categoryText}</span>
                                            </div>
                                        )}

                                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">
                                            <span>
                                                <strong className="text-slate-800">{products}</strong> Products
                                            </span>
                                            <span>
                                                <strong className="text-slate-800">{services}</strong> Services
                                            </span>
                                            <span className="capitalize">
                                                {profile.organizationType ? String(profile.organizationType).replace(/_/g, ' ') : 'MSME'}
                                            </span>
                                        </div>

                                        <div className="mt-5 flex flex-wrap gap-2">
                                            <Link
                                                href={`/vendors/${seller.id}`}
                                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0b2447] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#12335f]"
                                            >
                                                <Building2 className="h-3.5 w-3.5" /> View Store
                                            </Link>
                                            {user?.role === 'buyer' ? (
                                                <Link
                                                    href={sUserId ? `/buyer/rfq?sellerId=${sUserId}` : `/vendors/${seller.id}`}
                                                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-orange-700 transition hover:bg-orange-100"
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
                                                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-50"
                                                >
                                                    Save Supplier
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
