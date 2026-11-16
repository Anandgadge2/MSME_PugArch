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
import { DataTable, type ColumnDef } from '../../../components/ui/data-table';

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
        'from-[#0b2447] to-[#1e40af] text-white',
        'from-emerald-700 to-teal-800 text-white',
        'from-indigo-700 to-blue-800 text-white',
        'from-slate-800 to-slate-900 text-amber-200',
        'from-[#0f3363] to-[#1b508f] text-cyan-200',
        'from-amber-600 to-orange-700 text-white',
    ];
    return gradients[Math.abs(id) % gradients.length];
};

function SellerLogoImage({
    logo,
    name,
    orgInitials,
    initialsBg,
    size = 'md',
    className = '',
}: {
    logo?: string | null;
    name: string;
    orgInitials: string;
    initialsBg: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const [imgError, setImgError] = React.useState(false);

    if (logo && !imgError) {
        return (
            <img
                src={logo}
                alt={`${name} logo`}
                onError={() => setImgError(true)}
                className={`max-h-full max-w-full object-contain drop-shadow-2xs transition-transform duration-300 group-hover:scale-105 ${className}`}
                loading="lazy"
            />
        );
    }

    return (
        <span className={`flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br font-black tracking-wider shadow-inner text-white ${initialsBg} ${className}`}>
            {orgInitials}
        </span>
    );
}

const sellerSkeletonColumns: ColumnDef<any>[] = [
    { key: 'org', header: 'Seller Organization', width: 'w-[320px] min-w-[280px]', cell: () => null },
    { key: 'loc', header: 'Location', width: 'w-[180px] min-w-[160px]', cell: () => null },
    { key: 'cap', header: 'Capabilities', width: 'w-[240px] min-w-[200px]', cell: () => null },
    { key: 'prod', header: 'Products', width: 'w-[100px] min-w-[90px]', cell: () => null },
    { key: 'serv', header: 'Services', width: 'w-[100px] min-w-[90px]', cell: () => null },
    { key: 'action', header: 'Action', align: 'right', width: 'w-[180px] min-w-[160px]', cell: () => null },
];

function SellersSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
    if (viewMode === 'list') {
        return (
            <DataTable
                data={[]}
                columns={sellerSkeletonColumns}
                isLoading={true}
                skeletonRows={6}
                showSrNo={false}
                keyExtractor={(_, idx) => idx}
                minWidth="min-w-[1100px]"
            />
        );
    }

    return (
        <div className="grid gap-4 sm:gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200/80 bg-white shadow-xs flex flex-col justify-between overflow-hidden">
                    <div className="h-16 w-full bg-slate-100 p-3 flex justify-between items-start animate-pulse">
                        <Skeleton className="h-4 w-20 rounded-full" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <div className="px-4 -mt-8 flex items-end justify-between">
                        <Skeleton className="h-16 w-16 rounded-2xl ring-2 ring-white" />
                        <Skeleton className="h-5 w-24 rounded-lg mb-1" />
                    </div>
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-3/4 rounded" />
                            <Skeleton className="h-3 w-1/2 rounded" />
                        </div>
                        <div className="flex gap-1.5">
                            <Skeleton className="h-6 w-24 rounded-lg" />
                            <Skeleton className="h-6 w-20 rounded-lg" />
                        </div>
                        <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                            <Skeleton className="h-8 flex-1 rounded-xl mr-2" />
                            <Skeleton className="h-8 w-16 rounded-xl" />
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

    const sellerColumns: ColumnDef<MarketplaceSeller>[] = useMemo(() => [
        {
            key: 'organization',
            header: 'Seller Organization',
            width: 'w-[320px] min-w-[280px]',
            cell: (seller) => {
                const logo = sellerLogo(seller);
                const initialsText = initials(seller.organizationName);
                const initialsBg = getInitialsBg(seller.id);
                return (
                    <div className="flex items-center gap-3">
                        <Link href={`/marketplace/sellers/${seller.id}`} className="shrink-0 group/logo">
                            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs group-hover/logo:border-blue-400 group-hover/logo:shadow-xs transition-all overflow-hidden">
                                <SellerLogoImage
                                    logo={logo}
                                    name={seller.organizationName}
                                    orgInitials={initialsText}
                                    initialsBg={initialsBg}
                                    size="sm"
                                />
                            </div>
                        </Link>
                        <div className="flex flex-col min-w-0 flex-1">
                            <Link href={`/marketplace/sellers/${seller.id}`} className="font-extrabold text-slate-900 hover:text-blue-700 transition-colors text-xs sm:text-sm leading-snug truncate" title={seller.organizationName}>
                                {seller.organizationName}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                                    <BadgeCheck className="h-3 w-3 text-emerald-500" /> Verified
                                </span>
                                {(seller as any).organizationType && (
                                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider truncate max-w-[120px]">
                                        {String((seller as any).organizationType).replace(/_/g, ' ')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'location',
            header: 'Location',
            width: 'w-[180px] min-w-[160px]',
            cell: (seller) => {
                const profile = seller.profile || {};
                const location = Array.from(new Set([seller.city, seller.district, seller.state, profile.city, profile.district, profile.state].filter(Boolean))).join(', ');
                return (
                    <div className="flex items-start gap-1.5 text-slate-600 text-xs">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed truncate" title={location}>{location || '—'}</span>
                    </div>
                );
            }
        },
        {
            key: 'capabilities',
            header: 'Capabilities',
            width: 'w-[240px] min-w-[200px]',
            cell: (seller) => {
                const profile = seller.profile || {};
                const categoriesArr = [
                    ...(Array.isArray((seller as any).categories) ? (seller as any).categories : []),
                    ...(Array.isArray(profile.productCategories) ? profile.productCategories : []),
                    ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories : []),
                ].filter(Boolean);
                if (categoriesArr.length === 0) {
                    return <span className="text-xs text-slate-400 font-medium">—</span>;
                }
                return (
                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {categoriesArr.slice(0, 2).map((cat, i) => (
                            <span key={i} title={cat} className="inline-flex items-center rounded-lg bg-blue-50/90 border border-blue-100/90 px-2.5 py-1 text-[11px] font-semibold text-[#0b2447] leading-tight truncate max-w-[170px]">
                                {cat}
                            </span>
                        ))}
                        {categoriesArr.length > 2 && (
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                                +{categoriesArr.length - 2}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'products',
            header: 'Products',
            width: 'w-[100px] min-w-[90px]',
            cellClassName: 'whitespace-nowrap',
            cell: (seller) => {
                const products = seller._count?.products || 0;
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 text-xs font-bold text-slate-700">
                        <Package className="h-3.5 w-3.5 text-blue-600" /> {products}
                    </span>
                );
            }
        },
        {
            key: 'services',
            header: 'Services',
            width: 'w-[100px] min-w-[90px]',
            cellClassName: 'whitespace-nowrap',
            cell: (seller) => {
                const services = seller._count?.services || 0;
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 text-xs font-bold text-slate-700">
                        <Wrench className="h-3.5 w-3.5 text-indigo-600" /> {services}
                    </span>
                );
            }
        },
        {
            key: 'action',
            header: 'Action',
            width: 'w-[180px] min-w-[160px]',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            cell: (seller) => {
                const profile = seller.profile || {};
                const location = Array.from(new Set([seller.city, seller.district, seller.state, profile.city, profile.district, profile.state].filter(Boolean))).join(', ');
                const sUserId = (seller as any).sellerUserId || ((seller as any).users && (seller as any).users[0]?.id) || null;
                return (
                    <div className="flex items-center justify-end gap-2">
                        <Link
                            href={`/marketplace/sellers/${seller.id}`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0b2447] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#12335f] active:scale-95"
                        >
                            <Building2 className="h-3.5 w-3.5" /> View Store
                        </Link>
                        {user?.role === 'buyer' ? (
                            <Link
                                href={sUserId ? `/buyer/rfq?sellerId=${sUserId}` : `/marketplace/sellers/${seller.id}`}
                                className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
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
                                className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 cursor-pointer"
                            >
                                <Bookmark className="h-3.5 w-3.5 text-slate-500" /> Save
                            </button>
                        )}
                    </div>
                );
            }
        }
    ], [user]);

    return (
        <div className="min-h-dvh bg-[#f8fafc] text-slate-800">
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-6 lg:px-8">
                
                {/* ════════════════════════════════════════════════════════════════════
                    COMPACT HERO & INTEGRATED CONTROLS SECTION
                ════════════════════════════════════════════════════════════════════ */}
                <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
                    
                    {/* Premium Hero Banner */}
                    <div className="relative bg-gradient-to-r from-[#071930] via-[#0b2447] to-[#12335f] px-4 py-4 text-white sm:px-6 sm:py-5 overflow-hidden">
                        {/* Subtle Ambient Decorative Glow */}
                        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
                        <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

                        <div className="relative z-10 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (typeof window !== 'undefined' && window.history.length > 1) {
                                                router.back();
                                            } else {
                                                router.push('/marketplace');
                                            }
                                        }}
                                        className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 text-xs font-bold text-white shadow-xs backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:border-white/35 active:scale-95 cursor-pointer"
                                        title="Back to previous page"
                                        aria-label="Back to previous page"
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                                        <span>Back</span>
                                    </button>
                                    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 text-xs font-bold uppercase tracking-wider text-amber-200 backdrop-blur-md">
                                        <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Directory
                                    </span>
                                    <span className="text-xs font-semibold text-blue-200/90 hidden sm:inline-flex items-center gap-1.5">
                                        <span className="h-1 w-1 rounded-full bg-blue-300/60" />
                                        Verified Industrial MSME Partners
                                    </span>
                                </div>
                                <h1 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                                    Discover Trusted Seller Organizations
                                </h1>
                                <p className="mt-0.5 text-xs text-blue-100/80 sm:hidden">
                                    Verified Industrial MSME Partners in Jharsuguda
                                </p>
                            </div>

                            {/* Quick Stat Pill */}
                            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-3.5 py-2 backdrop-blur-md shadow-xs">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-inner">
                                    <BadgeCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="text-xs font-black text-white tracking-wide">{sellerList.length} Verified Suppliers</div>
                                    <div className="text-[10px] font-semibold text-emerald-200/90">GST & Udyam Verified</div>
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
                    <>
                        {viewMode === 'list' ? (
                            <DataTable
                                data={pagedSellers}
                                columns={sellerColumns}
                                showSrNo={false}
                                minWidth="min-w-[1100px]"
                                keyExtractor={(seller) => seller.id}
                                rowClassName="hover:bg-blue-50/40 transition-colors group"
                                page={page}
                                pageSize={pageSize}
                                total={total}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                                pageSizeOptions={[12, 24, 48]}
                                paginationLabel="sellers"
                                mobileLayout="scroll"
                            />
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
                                            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-xl hover:border-blue-400/50 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                                        >
                                            {/* Accent Card Top Header Stripe */}
                                            <div className="h-16 w-full bg-gradient-to-r from-slate-100 via-blue-50/70 to-indigo-50/60 p-3 flex items-start justify-between relative border-b border-slate-100/80">
                                                <span className="inline-flex items-center rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider shadow-2xs border border-slate-200/80 truncate max-w-[150px]">
                                                    {(seller as any).organizationType ? String((seller as any).organizationType).replace(/_/g, ' ') : 'SUPPLIER'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 backdrop-blur-xs shadow-2xs shrink-0">
                                                    <BadgeCheck className="h-3 w-3 text-emerald-600" /> Verified
                                                </span>
                                            </div>

                                            {/* Avatar Box & Location Shortcut */}
                                            <div className="px-4 -mt-8 flex items-end justify-between relative z-10 mb-2">
                                                <Link href={`/marketplace/sellers/${seller.id}`} className="group/avatar shrink-0 block">
                                                    <div className="flex h-16 w-16 sm:h-17 sm:w-17 items-center justify-center rounded-2xl bg-white border-2 border-white shadow-md p-1.5 transition-transform duration-300 group-hover:scale-105 group-hover/avatar:shadow-lg overflow-hidden">
                                                        <SellerLogoImage
                                                            logo={logo}
                                                            name={seller.organizationName}
                                                            orgInitials={initialsText}
                                                            initialsBg={initialsBg}
                                                            size="lg"
                                                        />
                                                    </div>
                                                </Link>
                                                <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-3xs mb-1">
                                                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                                    <span className="truncate max-w-[120px]">{seller.city || profile.city || 'Odisha'}</span>
                                                </span>
                                            </div>

                                            {/* Card Content */}
                                            <div className="px-4 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <Link href={`/marketplace/sellers/${seller.id}`} className="block group/title">
                                                        <h3 title={seller.organizationName} className="text-base font-extrabold text-[#0b2447] group-hover/title:text-blue-600 transition-colors line-clamp-1 leading-snug">
                                                            {seller.organizationName}
                                                        </h3>
                                                    </Link>
                                                    <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                        <span title={location || 'Jharsuguda, Odisha'} className="truncate">
                                                            {location || 'Jharsuguda, Odisha'}
                                                        </span>
                                                    </p>

                                                    {/* Capabilities Tags */}
                                                    <div className="min-h-[2rem] flex items-center my-2.5">
                                                        {categoriesArr.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                                {categoriesArr.slice(0, 2).map((cat, i) => (
                                                                    <span key={i} title={cat} className="inline-flex items-center rounded-lg bg-blue-50/90 border border-blue-200/60 px-2.5 py-0.5 text-[11px] font-semibold text-[#0b2447] leading-tight max-w-[180px] truncate">
                                                                        {cat}
                                                                    </span>
                                                                ))}
                                                                {categoriesArr.length > 2 && (
                                                                    <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                                                        +{categoriesArr.length - 2} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 font-medium italic">Verified Industrial Partner</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Bottom: Stats & Actions */}
                                                <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2.5">
                                                    <div className="flex items-center justify-between text-xs text-slate-600">
                                                        <span className="inline-flex items-center gap-1.5 font-medium">
                                                            <Package className="h-3.5 w-3.5 text-blue-600" />
                                                            <strong className="font-extrabold text-[#0b2447]">{products}</strong> Products
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 font-medium">
                                                            <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                                                            <strong className="font-extrabold text-[#0b2447]">{services}</strong> Services
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 pt-0.5 pb-3">
                                                        <Link
                                                            href={`/marketplace/sellers/${seller.id}`}
                                                            className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0b2447] hover:bg-[#12335f] text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all duration-200 active:scale-95"
                                                        >
                                                            <Building2 className="h-3.5 w-3.5" /> View Store
                                                        </Link>
                                                        {user?.role === 'buyer' ? (
                                                            <Link
                                                                href={sUserId ? `/buyer/rfq?sellerId=${sUserId}` : `/marketplace/sellers/${seller.id}`}
                                                                className="h-9 px-3.5 inline-flex items-center justify-center rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-xs font-bold text-orange-700 shadow-2xs transition-all active:scale-95"
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
                                                                className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                                                            >
                                                                <Bookmark className="h-3.5 w-3.5 text-slate-500" />
                                                                <span>Save</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                        {viewMode === 'grid' && (
                            <Pagination
                                page={page}
                                pageSize={pageSize}
                                total={total}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                                pageSizeOptions={[12, 24, 48]}
                                label="sellers"
                            />
                        )}
                    </>
                )}
            </main>

            <MarketplaceFooter />
        </div>
    );
}
