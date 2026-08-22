'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowRight,
    Boxes,
    ChevronRight,
    Search,
    ShieldCheck,
    Sparkles,
    List,
    LayoutGrid,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { api, unwrapApiData } from '../../../lib/api';
import { marketplaceApi, type MarketplaceCategory } from '../api';
import {
    getCategoryVisualMeta,
    getCategoryImageUrl,
    buildCategoryFallbackSvg,
} from '../utils/categoryImages';

// Rich subcategory highlights per category keyword
const CATEGORY_SUB_ITEMS: Record<string, string[]> = {
    'electrical': ['Induction Motors', 'Industrial Cables & Wires', 'MCCB & Switchgears', 'VFD Inverters', 'High Bay Lighting'],
    'safety': ['Safety Footwear', 'Industrial Helmets & Visors', 'Fall Protection Harnesses', 'Fire Extinguishers', 'PPE Coveralls'],
    'tool': ['Arc Welders', 'Impact Wrenches', 'Welding Electrodes', 'Grinding Machines', 'Torque Tools'],
    'bearing': ['Deep Groove Ball Bearings', 'Pillow Block Units', 'Tapered Roller Bearings', 'Bearing Grease & Seals'],
    'pipe': ['Seamless Steel Pipes', 'Flanged Industrial Valves', 'Pipe Fittings', 'High-Pressure Hoses'],
    'machinery': ['Conveyor Systems', 'Hydraulic Pumps', 'Industrial Gearboxes', 'Pneumatic Actuators'],
    'steel': ['Structural Steel Channels', 'MS Beams & Angles', 'Chequered Plates', 'Steel Fabrications'],
    'cement': ['OPC 53 Grade Cement', 'PPC High Strength Cement', 'Concrete Admixtures', 'Ready Mix Mortars'],
    'chemical': ['Degreasers & Solvents', 'Boiler Water Treatment', 'Industrial Lubricants', 'Refractory Castables'],
    'office': ['Ergonomic Workstations', 'Document Printers', 'Copier Paper', 'Stationery Supplies'],
    'medical': ['First Aid Trauma Kits', 'Disinfectants & Sanitizers', 'Medical PPE', 'Health Diagnostics'],
    'agri': ['Industrial Nursery Supplies', 'Sprayers & Drip Kits', 'Organic Compost', 'Gardening Tools'],
    'automation': ['PLC Controllers', 'Sensors & Transducers', 'SCADA Panels', 'Robotic Servo Drives'],
};

function getCategorySubItems(categoryName: string): string[] {
    const lower = categoryName.toLowerCase();
    for (const [key, items] of Object.entries(CATEGORY_SUB_ITEMS)) {
        if (lower.includes(key)) return items;
    }
    return ['Industrial Equipment', 'MRO Spares', 'Consumables', 'Verified MSME Supply'];
}

function CategoryDirectoryCard({ category }: { category: MarketplaceCategory }) {
    const meta = getCategoryVisualMeta(category);
    const [imgSrc, setImgSrc] = useState<string>(() => getCategoryImageUrl(category));
    const [imgError, setImgError] = useState(false);

    const handleImageError = () => {
        if (!imgError) {
            setImgError(true);
            setImgSrc(buildCategoryFallbackSvg(category.name, meta.accentColor));
        }
    };

    const isService = category.type === 'SERVICE';
    const isBoth = category.type === 'BOTH';
    const targetHref = isService
        ? `/marketplace/services?categoryId=${category.id}`
        : `/marketplace/products?categoryId=${category.id}`;

    const pCount = category.productCount ?? category._count?.products ?? 0;
    const sCount = category.serviceCount ?? category._count?.services ?? 0;

    return (
        <div className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5">
            <Link
                href={targetHref}
                className="flex flex-col items-center text-center w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
            >
                {/* Big Image/Icon Container */}
                <div className="relative w-full aspect-square max-h-[190px] sm:max-h-[220px] flex items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100/50 p-4 ring-1 ring-slate-100 transition-all duration-300 group-hover:scale-[1.02] group-hover:bg-blue-50/60 group-hover:ring-blue-200">
                    {/* Type Badge */}
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
                        <span className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-xs backdrop-blur-sm",
                            isService
                                ? "bg-amber-50/90 text-amber-700 border border-amber-200"
                                : isBoth
                                    ? "bg-purple-50/90 text-purple-700 border border-purple-200"
                                    : "bg-blue-50/90 text-blue-700 border border-blue-200"
                        )}>
                            {isService ? 'Services' : isBoth ? 'Products & Services' : 'Products'}
                        </span>
                    </div>

                    {/* Verified Badge */}
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 shadow-xs backdrop-blur-sm border border-slate-100">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span className="hidden sm:inline">Verified</span>
                    </div>

                    {/* Big Category Icon/Image */}
                    <img
                        src={imgSrc}
                        alt={category.name}
                        loading="lazy"
                        decoding="async"
                        onError={handleImageError}
                        className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 lg:h-36 lg:w-36 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                    />
                </div>

                {/* Category Name below */}
                <div className="mt-3.5 w-full">
                    <h3 className="text-sm sm:text-base font-black text-[#0b2447] tracking-tight group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                        {category.name}
                    </h3>
                    
                    {/* Item count or brief description */}
                    <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500">
                        {(pCount > 0 || sCount > 0) ? (
                            <span>
                                {isBoth
                                    ? `${pCount > 0 ? `${pCount} Products` : ''}${pCount > 0 && sCount > 0 ? ' • ' : ''}${sCount > 0 ? `${sCount} Services` : ''}`
                                    : isService
                                        ? `${sCount} Services`
                                        : `${pCount} Products`}
                            </span>
                        ) : (
                            <span className="text-slate-400">Verified MSME Supplies</span>
                        )}
                    </div>
                </div>
            </Link>

            {/* Bottom Actions / Secondary links */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 w-full">
                <Link
                    href={targetHref}
                    className="flex-1 h-9 rounded-xl bg-[#0b2447] text-white text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#12335f] active:scale-98"
                >
                    <span>{isService ? 'Explore Services' : 'Browse Products'}</span>
                    <ArrowRight className="h-3 w-3" />
                </Link>

                {isBoth && (
                    <Link
                        href={`/marketplace/services?categoryId=${category.id}`}
                        className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-[#0b2447] text-[11px] font-bold transition hover:bg-slate-50 flex items-center justify-center"
                        title="Browse Industrial Services"
                    >
                        Services
                    </Link>
                )}
            </div>
        </div>
    );
}

function CategoryDirectoryRow({ category }: { category: MarketplaceCategory }) {
    const meta = getCategoryVisualMeta(category);
    const [imgSrc, setImgSrc] = useState<string>(() => getCategoryImageUrl(category));
    const [imgError, setImgError] = useState(false);

    const handleImageError = () => {
        if (!imgError) {
            setImgError(true);
            setImgSrc(buildCategoryFallbackSvg(category.name, meta.accentColor));
        }
    };

    const isService = category.type === 'SERVICE';
    const isBoth = category.type === 'BOTH';
    const isProduct = category.type === 'PRODUCT' || category.type === 'PRODUCTS';
    const targetHref = isService
        ? `/marketplace/services?categoryId=${category.id}`
        : `/marketplace/products?categoryId=${category.id}`;

    const pCount = category.productCount ?? category._count?.products ?? 0;
    const sCount = category.serviceCount ?? category._count?.services ?? 0;

    return (
        <tr className="group border-b border-slate-100 bg-white hover:bg-blue-50/50 transition-colors">
            {/* Category Name and Icon */}
            <td className="py-2 pl-4 sm:pl-6 pr-4 align-middle">
                <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/50 p-1.5 ring-1 ring-slate-100 transition-all duration-300 group-hover:bg-blue-50/80 group-hover:ring-blue-200">
                        <img
                            src={imgSrc}
                            alt={category.name}
                            loading="lazy"
                            decoding="async"
                            onError={handleImageError}
                            className="h-7 w-7 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                        />
                    </div>
                    <div>
                        <Link
                            href={targetHref}
                            className="text-[13px] sm:text-sm font-black text-[#0b2447] transition hover:text-blue-600 line-clamp-1 leading-tight"
                        >
                            {category.name}
                        </Link>
                    </div>
                </div>
            </td>
            
            {/* Description */}
            <td className="py-2 px-4 align-middle hidden md:table-cell max-w-[220px]">
                <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 leading-snug">
                    {category.description || `Browse certified ${category.name.toLowerCase()} supplies and equipment.`}
                </p>
            </td>

            {/* Type */}
            <td className="py-2 px-4 align-middle hidden sm:table-cell">
                <span className={cn(
                    "inline-block rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider whitespace-nowrap",
                    isService
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : isBoth
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                )}>
                    {isService ? 'Services' : isBoth ? 'Products & Services' : 'Products'}
                </span>
            </td>

            {/* Verification & Counts */}
            <td className="py-2 px-4 align-middle hidden lg:table-cell">
                <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span>Verified MSME</span>
                    </span>
                    {(pCount > 0 || sCount > 0) && (
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                            {(isBoth || isProduct) && pCount > 0 && <span>{pCount} Products</span>}
                            {(isBoth || isService) && sCount > 0 && <span>{sCount} Services</span>}
                        </div>
                    )}
                </div>
            </td>

            {/* Action Buttons */}
            <td className="py-2 pr-4 sm:pr-6 pl-4 align-middle text-right w-[120px] sm:w-[130px]">
                <div className="flex flex-col gap-1.5 items-end justify-center">
                    {(!isService || isBoth) && (
                        <Link
                            href={`/marketplace/products?categoryId=${category.id}`}
                            className="w-full h-7 rounded-md bg-[#0b2447] text-white text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm hover:bg-[#12335f] active:scale-95"
                        >
                            <span>Products</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                    )}
                    {(isService || isBoth) && (
                        <Link
                            href={`/marketplace/services?categoryId=${category.id}`}
                            className={cn(
                                "w-full h-7 rounded-md text-[10px] font-bold transition flex items-center justify-center gap-1 active:scale-95",
                                isService ? "bg-[#0b2447] text-white shadow-sm hover:bg-[#12335f]" : "border border-slate-200 bg-white text-[#0b2447] hover:bg-slate-50"
                            )}
                        >
                            <span>Services</span>
                            {isService && <ArrowRight className="h-2.5 w-2.5" />}
                        </Link>
                    )}
                </div>
            </td>
        </tr>
    );
}

export default function MarketplaceCategoriesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const { data: homeData, isLoading: isHomeLoading } = useQuery({
        queryKey: ['marketplaceHomeData'],
        queryFn: () => marketplaceApi.getHomeData(),
        initialData: () => {
            const cached = api.peek('/api/marketplace/home');
            return cached ? unwrapApiData(cached) : undefined;
        }
    });

    const { data: featuredCategoryData, isLoading: isFeaturedLoading } = useQuery({
        queryKey: ['marketplaceFeaturedCategories'],
        queryFn: () => marketplaceApi.getFeaturedCategories(),
        staleTime: 5 * 60_000
    });

    const categories = featuredCategoryData?.categories?.length ? featuredCategoryData.categories : homeData?.categories || [];
    const isLoading = isHomeLoading && isFeaturedLoading;

    // Filter categories by search query and type
    const filteredCategories = useMemo(() => {
        return categories.filter((category: MarketplaceCategory) => {
            const matchesQuery = !searchQuery.trim() ||
                category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                getCategorySubItems(category.name).some(sub => sub.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesType = typeFilter === 'ALL' ||
                (typeFilter === 'PRODUCT' && ['PRODUCT', 'BOTH'].includes(category.type)) ||
                (typeFilter === 'SERVICE' && ['SERVICE', 'BOTH'].includes(category.type));

            return matchesQuery && matchesType;
        });
    }, [categories, searchQuery, typeFilter]);

    return (
        <div className="min-h-dvh bg-slate-50/50 flex flex-col text-slate-800">
            <main className="flex-1">
                {/* Breadcrumbs */}
                <div className="bg-white border-b border-slate-200">
                    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 2xl:px-8 py-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Link href="/" className="hover:text-[#0b2447] transition">Home</Link>
                        <ChevronRight className="h-3 w-3" />
                        <Link href="/marketplace/products" className="hover:text-[#0b2447] transition">Marketplace</Link>
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-[#0b2447] font-black">All Categories</span>
                    </div>
                </div>

                {/* Hero Header Banner */}
                <div className={cn(
                    "bg-gradient-to-b from-white to-slate-50/80 border-b border-slate-200/80 transition-all duration-300",
                    viewMode === 'list' ? "py-4 sm:py-6" : "py-10"
                )}>
                    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 2xl:px-8">
                        <div className="max-w-3xl">
                            <div className={cn(
                                "inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-black",
                                viewMode === 'list' ? "px-2.5 py-0.5 text-[10px] mb-2" : "px-3 py-1 text-xs mb-3"
                            )}>
                                <Sparkles className={cn("text-blue-600", viewMode === 'list' ? "h-3 w-3" : "h-3.5 w-3.5")} />
                                <span>Official Industrial Category Directory</span>
                            </div>
                            <h1 className={cn(
                                "font-black text-[#0b2447] tracking-tight transition-all",
                                viewMode === 'list' ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
                            )}>
                                Explore All Industrial Categories &amp; Sectors
                            </h1>
                            <p className={cn(
                                "font-medium text-slate-600 leading-relaxed transition-all",
                                viewMode === 'list' ? "mt-1.5 text-xs sm:text-sm" : "mt-2 text-sm sm:text-base"
                            )}>
                                Browse certified product catalogues, engineering machinery, electrical supplies, MRO spares, and industrial contractors from verified MSMEs across Jharsuguda and Odisha.
                            </p>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className={cn(
                            "flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all duration-300",
                            viewMode === 'list' ? "mt-4 sm:mt-5 p-2 sm:p-2.5" : "mt-8 p-3 sm:p-4 gap-4"
                        )}>
                            <div className="relative flex-1 max-w-xl">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by category name, equipment, or keyword (e.g. Safety, Motors, Steel)..."
                                    className={cn(
                                        "w-full rounded-xl border border-slate-200 bg-slate-50/50 pr-4 font-semibold outline-none transition focus:bg-white focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10",
                                        viewMode === 'list' ? "h-9 pl-10 text-[11px]" : "h-11 pl-10 text-xs"
                                    )}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-600"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Type Filter Tabs & View Toggle */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                                    {[
                                        { label: 'All Categories', val: 'ALL' as const },
                                        { label: 'Products', val: 'PRODUCT' as const },
                                        { label: 'Services', val: 'SERVICE' as const },
                                    ].map(tab => (
                                        <button
                                            key={tab.val}
                                            type="button"
                                            onClick={() => setTypeFilter(tab.val)}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-xs font-bold transition",
                                                typeFilter === tab.val
                                                    ? "bg-white text-[#0b2447] shadow-sm"
                                                    : "text-slate-600 hover:text-slate-900"
                                            )}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        className={cn(
                                            "p-2 rounded-lg transition",
                                            viewMode === 'list'
                                                ? "bg-white text-[#0b2447] shadow-sm"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                        title="List View"
                                    >
                                        <List className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        className={cn(
                                            "p-2 rounded-lg transition",
                                            viewMode === 'grid'
                                                ? "bg-white text-[#0b2447] shadow-sm"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                        title="Grid View"
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Categories Grid Content */}
                <div className={cn(
                    "max-w-[1680px] mx-auto px-4 sm:px-6 2xl:px-8 transition-all duration-300",
                    viewMode === 'list' ? "py-3 sm:py-4" : "py-8 sm:py-10"
                )}>
                    <div className={cn("flex items-center justify-between", viewMode === 'list' ? "mb-3" : "mb-6")}>
                        <div className="flex items-center gap-2">
                            <Boxes className={cn("text-blue-600", viewMode === 'list' ? "h-4 w-4" : "h-5 w-5")} />
                            <h2 className={cn("font-black text-[#0b2447]", viewMode === 'list' ? "text-sm sm:text-base" : "text-lg")}>
                                Showing {filteredCategories.length} Categories
                            </h2>
                        </div>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); }}
                                className="text-xs font-bold text-red-600 hover:underline"
                            >
                                Clear search
                            </button>
                        )}
                    </div>

                    {isLoading ? (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 gap-3.5 sm:gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                                    <div key={i} className="rounded-3xl bg-white border border-slate-200 p-3.5 sm:p-4 animate-pulse flex flex-col justify-between">
                                        <div className="w-full aspect-square max-h-[190px] sm:max-h-[220px] rounded-2xl bg-slate-100 mb-3" />
                                        <div className="h-4 w-3/4 bg-slate-100 rounded mx-auto mb-2" />
                                        <div className="h-3 w-1/2 bg-slate-100 rounded mx-auto mb-4" />
                                        <div className="h-9 w-full bg-slate-100 rounded-xl" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <div className="w-full overflow-x-auto">
                                    <table className="w-full min-w-[600px] text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/80">
                                                <th className="py-2 px-4 sm:px-6 text-[10px] font-black uppercase tracking-wider text-slate-500">Category</th>
                                                <th className="py-2 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden md:table-cell">Description</th>
                                                <th className="py-2 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden sm:table-cell">Type</th>
                                                <th className="py-2 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden lg:table-cell">Details</th>
                                                <th className="py-2 px-4 sm:px-6 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[1, 2, 3, 4, 5, 6].map(i => (
                                                <tr key={i} className="border-b border-slate-100 bg-white">
                                                    <td className="py-2 px-6">
                                                        <div className="flex items-center gap-3 animate-pulse">
                                                            <div className="h-9 w-9 rounded-lg bg-slate-100 shrink-0" />
                                                            <div className="h-3 w-28 bg-slate-100 rounded" />
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-4 hidden md:table-cell">
                                                        <div className="h-2.5 w-40 bg-slate-100 rounded animate-pulse" />
                                                    </td>
                                                    <td className="py-2 px-4 hidden sm:table-cell">
                                                        <div className="h-4 w-16 bg-slate-100 rounded-md animate-pulse" />
                                                    </td>
                                                    <td className="py-2 px-4 hidden lg:table-cell">
                                                        <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                                                    </td>
                                                    <td className="py-2 px-6">
                                                        <div className="h-7 w-20 bg-slate-100 rounded-md ml-auto animate-pulse" />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    ) : filteredCategories.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm max-w-xl mx-auto my-8">
                            <Boxes className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-base font-black text-slate-800">
                                No categories found matching "{searchQuery}"
                            </h3>
                            <p className="mt-1.5 text-xs font-medium text-slate-500">
                                Try searching for generic industrial terms like electrical, safety, pumps, or tools.
                            </p>
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); }}
                                className="mt-5 h-10 px-5 rounded-xl bg-[#0b2447] text-white text-xs font-black hover:bg-[#12335f] transition"
                            >
                                View All Categories
                            </button>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 gap-3.5 sm:gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
                            {filteredCategories.map((category: MarketplaceCategory) => (
                                <CategoryDirectoryCard key={category.id} category={category} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <div className="w-full overflow-x-auto">
                                <table className="w-full min-w-[600px] text-left">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50/80">
                                            <th className="py-2 px-4 sm:px-6 text-[10px] font-black uppercase tracking-wider text-slate-500">Category</th>
                                            <th className="py-2 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden md:table-cell">Description</th>
                                            <th className="py-2 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden sm:table-cell">Type</th>
                                            <th className="py-2 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden lg:table-cell">Details</th>
                                            <th className="py-2 px-4 sm:px-6 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCategories.map((category: MarketplaceCategory) => (
                                            <CategoryDirectoryRow key={category.id} category={category} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}
