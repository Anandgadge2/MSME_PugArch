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
    Eye,
    MapPin,
    Package,
    Search,
    SlidersHorizontal,
    Sparkles,
    X,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Skeleton } from '../../../components/ui/skeleton';
import { MarketplaceHeader } from '../components/MarketplaceHeader';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { marketplaceApi } from '../api';
import { resolveMediaUrl } from '../../../lib/api';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';

function buyerLogo(buyer: any) {
    const profile = buyer.profile || {};
    const rawLogo = buyer.logoUrl || buyer.logoFile?.url || profile.logoUrl || profile.logo || profile.organizationLogoUrl || profile.organizationLogo || null;
    return resolveMediaUrl(rawLogo);
}

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('') || 'B';
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

function BuyerLogoImage({
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

function BuyersSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
    if (viewMode === 'list') {
        return (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 sm:px-6 min-w-[240px]"><Skeleton className="h-4 w-32" /></th>
                            <th className="px-4 py-3 sm:px-6 min-w-[180px]"><Skeleton className="h-4 w-24" /></th>
                            <th className="px-4 py-3 sm:px-6"><Skeleton className="h-4 w-20" /></th>
                            <th className="px-4 py-3 sm:px-6"><Skeleton className="h-4 w-20" /></th>
                            <th className="px-4 py-3 sm:px-6"><Skeleton className="h-4 w-16" /></th>
                            <th className="px-4 py-3 sm:px-6 text-right"><Skeleton className="h-4 w-20 ml-auto" /></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <tr key={idx}>
                                <td className="px-4 py-3 sm:px-6">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl shrink-0" />
                                        <Skeleton className="h-4 w-40" />
                                    </div>
                                </td>
                                <td className="px-4 py-3 sm:px-6"><Skeleton className="h-4 w-32" /></td>
                                <td className="px-4 py-3 sm:px-6"><Skeleton className="h-4 w-20" /></td>
                                <td className="px-4 py-3 sm:px-6"><Skeleton className="h-4 w-16" /></td>
                                <td className="px-4 py-3 sm:px-6"><Skeleton className="h-4 w-16 rounded-full" /></td>
                                <td className="px-4 py-3 sm:px-6 text-right"><Skeleton className="h-8 w-20 rounded-lg ml-auto" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-16 rounded-full" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <div className="flex flex-col items-center space-y-2.5 py-1">
                        <Skeleton className="h-24 w-24 sm:h-26 sm:w-26 rounded-full" />
                        <Skeleton className="h-4 w-36 mt-2 rounded-full" />
                        <Skeleton className="h-3 w-24 rounded-full" />
                    </div>
                    <div className="border-t border-slate-100/80 pt-3 flex items-center justify-between">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-8.5 w-24 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function MarketplaceBuyersPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'location' | 'latest' | 'requirements'>('requirements');
    const [viewMode, setViewMode] = useResponsiveViewMode('marketplace:buyers:viewMode');

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['marketplaceBuyersPage'],
        queryFn: () => marketplaceApi.getBuyers({ pageSize: 100 }),
        staleTime: 60_000,
        retry: 1,
    });

    const buyerList = useMemo(() => {
        const list = (data as any)?.buyers ?? [];
        return Array.isArray(list) ? list : [];
    }, [data]);

    const displayBuyers = buyerList;

    const locations = useMemo(() => {
        const values = new Set<string>();
        buyerList.forEach((buyer: any) => {
            const profile = buyer.profile || {};
            [buyer.city, buyer.district, buyer.state, profile.city, profile.district, profile.state]
                .filter(Boolean)
                .forEach((value: string) => values.add(value));
        });
        return Array.from(values).sort();
    }, [buyerList]);

    const filteredBuyers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return displayBuyers
            .filter((buyer: any) => {
                const profile = buyer.profile || {};
                const locationText = Array.from(new Set([buyer.city, buyer.district, buyer.state, profile.city, profile.district, profile.state].filter(Boolean)))
                    .join(' ')
                    .toLowerCase();

                const matchesSearch = !q || [buyer.organizationName, buyer.organizationType, locationText].some(value => String(value).toLowerCase().includes(q));
                const matchesLocation = !locationFilter || locationText.includes(locationFilter.toLowerCase());
                return matchesSearch && matchesLocation;
            })
            .sort((a: any, b: any) => {
                if (sortBy === 'location') {
                    const aLoc = Array.from(new Set([a.city, a.district, a.state].filter(Boolean))).join(' ');
                    const bLoc = Array.from(new Set([b.city, b.district, b.state].filter(Boolean))).join(' ');
                    return aLoc.localeCompare(bLoc);
                }
                if (sortBy === 'latest') {
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                }
                if (sortBy === 'requirements') {
                    const aCount = a._count?.buyerRequirements || 0;
                    const bCount = b._count?.buyerRequirements || 0;
                    return bCount - aCount || a.organizationName.localeCompare(b.organizationName);
                }
                return a.organizationName.localeCompare(b.organizationName);
            });
    }, [displayBuyers, search, locationFilter, sortBy]);

    const { page, pageSize, pageItems: pagedBuyers, total, setPage, setPageSize } = usePagination(filteredBuyers, 12);

    const clearFilters = () => {
        setSearch('');
        setLocationFilter('');
        setSortBy('requirements');
        setPage(1);
    };

    const hasActiveFilters = Boolean(search || locationFilter || sortBy !== 'requirements');

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
                                    Discover Trusted Buyer Organizations
                                </h1>
                            </div>

                            {/* Quick Stat Pill */}
                            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-xs">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                                    <BadgeCheck className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">{buyerList.length} Verified Buyers</div>
                                    <div className="text-[10px] text-white/70">GST & Udyam Verified</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrated Search & Filter Controls */}
                    <div className="p-3.5 sm:p-4 space-y-3">
                        <div className="grid gap-2.5 md:grid-cols-12">
                            {/* Search Input */}
                            <div className="md:col-span-6 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    placeholder="Search by buyer name, type, or city…"
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

                            {/* Sort Option */}
                            <div className="md:col-span-3 relative">
                                <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <select
                                    value={sortBy}
                                    onChange={event => setSortBy(event.target.value as 'name' | 'location' | 'latest' | 'requirements')}
                                    className="w-full h-9.5 rounded-xl border border-slate-200 bg-white pl-9 pr-7 text-xs font-medium text-slate-700 outline-none focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="requirements">Sort: Requirements Published</option>
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
                                    Showing <span className="font-bold text-slate-800">{filteredBuyers.length}</span> of {displayBuyers.length} buyer organizations
                                </p>
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                                    >
                                        <X className="h-3 w-3" /> Clear Filters
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <ViewModeToggle value={viewMode} onChange={setViewMode} />
                            </div>
                        </div>
                    </div>
                </section>

                {isLoading ? (
                    <BuyersSkeleton viewMode={viewMode} />
                ) : isError ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-800 shadow-sm">
                        Unable to load the buyer directory right now.
                        <div className="mt-2 text-xs text-amber-700">{error instanceof Error ? error.message : 'Please check back later.'}</div>
                    </div>
                ) : filteredBuyers.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                        <Building2 className="mx-auto h-12 w-12 text-slate-300" />
                        <h2 className="mt-3 text-lg font-black text-slate-700">No buyer matches your search</h2>
                        <p className="mt-2 text-sm font-medium text-slate-500">Try adjusting the filters or searching for a different name or city.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {viewMode === 'list' ? (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3 sm:px-6 min-w-[250px]">Buyer Organization</th>
                                            <th className="px-4 py-3 sm:px-6 min-w-[180px]">Location</th>
                                            <th className="px-4 py-3 sm:px-6">Type</th>
                                            <th className="px-4 py-3 sm:px-6 whitespace-nowrap">Requirements</th>
                                            <th className="px-4 py-3 sm:px-6 whitespace-nowrap">Verification</th>
                                            <th className="px-4 py-3 sm:px-6 text-right whitespace-nowrap">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pagedBuyers.map((buyer: any) => {
                                            const profile = buyer.profile || {};
                                            const location = Array.from(new Set([buyer.city, buyer.district, buyer.state, profile.city, profile.district, profile.state].filter(Boolean))).join(', ');
                                            const requirements = buyer._count?.buyerRequirements || 0;
                                            const logo = buyerLogo(buyer);
                                            const initialsText = initials(buyer.organizationName);
                                            const initialsBg = getInitialsBg(buyer.id);
                                            const profileHref = `/buyer-requirements/${buyer.id}`;

                                            return (
                                                <tr key={buyer.id} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-4 py-3 sm:px-6">
                                                        <div className="flex items-center gap-3.5">
                                                            <Link href={profileHref} className="shrink-0">
                                                                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs p-1 group-hover:border-[#0b2447] group-hover:shadow-sm transition-all">
                                                                    <BuyerLogoImage
                                                                        logo={logo}
                                                                        name={buyer.organizationName}
                                                                        orgInitials={initialsText}
                                                                        initialsBg={initialsBg}
                                                                    />
                                                                </div>
                                                            </Link>
                                                            <Link href={profileHref} className="font-extrabold text-slate-900 hover:text-[#0b2447] transition-colors leading-snug">
                                                                {buyer.organizationName}
                                                            </Link>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 sm:px-6">
                                                        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                            <span className="leading-snug">{location || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 sm:px-6">
                                                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                                                            {buyer.organizationType ? String(buyer.organizationType).replace(/_/g, ' ') : 'ENTERPRISE'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50/90 border border-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-[#0b2447]">
                                                            {requirements} Published
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                                            <BadgeCheck className="h-3 w-3 text-emerald-500" /> Verified
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 sm:px-6 text-right whitespace-nowrap">
                                                        <Link
                                                            href={profileHref}
                                                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-[#0b2447] hover:border-blue-200 active:scale-95"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" /> View
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {pagedBuyers.map((buyer: any) => {
                                    const profile = buyer.profile || {};
                                    const location = Array.from(new Set([buyer.city, buyer.district, buyer.state, profile.city, profile.district, profile.state].filter(Boolean))).join(', ');
                                    const requirements = buyer._count?.buyerRequirements || 0;
                                    const logo = buyerLogo(buyer);
                                    const initialsText = initials(buyer.organizationName);
                                    const initialsBg = getInitialsBg(buyer.id);
                                    const profileHref = `/buyer-requirements/${buyer.id}`;

                                    return (
                                        <article
                                            key={buyer.id}
                                            className="group relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-gradient-to-b from-white via-white to-slate-50/40 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_36px_-6px_rgba(11,36,71,0.1)] hover:border-blue-200/80 transition-all duration-400 ease-out hover:-translate-y-1.5 overflow-hidden"
                                        >
                                            {/* Soft subtle ambient background glow */}
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-36 h-36 bg-blue-400/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-500" />

                                            {/* Top Bar: Badges */}
                                            <div className="relative flex items-center justify-between gap-2 z-10">
                                                <span className="inline-flex items-center rounded-full bg-slate-100/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                    {buyer.organizationType ? String(buyer.organizationType).replace(/_/g, ' ') : 'BUYER'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                                    <BadgeCheck className="h-3 w-3 text-emerald-500" /> Verified
                                                </span>
                                            </div>

                                            {/* Main Content: Big Logo + Title + Location */}
                                            <Link href={profileHref} className="relative flex flex-col items-center text-center my-3 z-10">
                                                {/* Smooth Floating Circular Logo Disc */}
                                                <div className="relative flex h-24 w-24 sm:h-26 sm:w-26 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] ring-4 ring-slate-50/90 transition-all duration-400 ease-out group-hover:scale-105 group-hover:ring-blue-100/90 group-hover:shadow-[0_10px_25px_rgba(11,36,71,0.12)] p-3">
                                                    <BuyerLogoImage
                                                        logo={logo}
                                                        name={buyer.organizationName}
                                                        orgInitials={initialsText}
                                                        initialsBg={initialsBg}
                                                    />
                                                </div>

                                                {/* Org Name */}
                                                <h3 className="mt-3 text-sm sm:text-base font-extrabold text-[#0b2447] group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug px-1">
                                                    {buyer.organizationName}
                                                </h3>

                                                {/* Location */}
                                                <p className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-slate-500 px-1">
                                                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span className="line-clamp-1">{location || 'Jharsuguda, Odisha'}</span>
                                                </p>
                                            </Link>

                                            {/* Bottom Row: Requirements Count & Action */}
                                            <div className="relative pt-3 border-t border-slate-100/80 flex items-center justify-between gap-2 z-10">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50/80 px-2.5 py-1 text-[11px] font-bold text-[#0b2447]">
                                                    <span>{requirements}</span>
                                                    <span className="text-slate-500 font-medium">Req{requirements === 1 ? '' : 's'}</span>
                                                </span>
                                                <Link
                                                    href={profileHref}
                                                    className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-full bg-[#0b2447] px-4 text-xs font-bold text-white shadow-xs transition-all duration-300 hover:bg-[#12335f] hover:shadow-md hover:scale-[1.02] active:scale-95 shrink-0"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    <span>View Profile</span>
                                                </Link>
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
                            label="buyers"
                        />
                    </div>
                )}
            </main>

            <MarketplaceFooter />
        </div>
    );
}
