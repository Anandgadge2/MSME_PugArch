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

    React.useEffect(() => {
        setImgSrc(getCategoryImageUrl(category));
        setImgError(false);
    }, [category, category.imageUrl]);

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
        <div className="group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-slate-200/70 bg-white p-3 sm:p-4 shadow-xs hover:shadow-lg hover:border-blue-200 transition-all duration-300 ease-out hover:-translate-y-1 overflow-hidden text-center">
            {/* Ambient background glow */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-28 bg-blue-400/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-300" />

            {/* Top Badges */}
            <div className="relative flex items-center justify-between gap-1 z-10 mb-1">
                <span className={cn(
                    "rounded-full px-2 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider",
                    isService
                        ? "bg-amber-50 text-amber-700 border border-amber-200/50"
                        : isBoth
                            ? "bg-purple-50 text-purple-700 border border-purple-200/50"
                            : "bg-blue-50/80 text-blue-700 border border-blue-200/50"
                )}>
                    {isService ? 'Services' : isBoth ? 'Products & Svcs' : 'Products'}
                </span>

                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50/80 border border-emerald-200/40 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold text-emerald-700 shrink-0">
                    <ShieldCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-500" /> Verified
                </span>
            </div>

            <Link
                href={targetHref}
                className="relative flex flex-col items-center text-center w-full focus:outline-none z-10 my-1 group-hover:opacity-95"
            >
                {/* Floating Visual with Soft Ambient Aura (No rigid box border) */}
                <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 md:h-26 md:w-26 items-center justify-center my-0.5">
                    <div className="absolute inset-1 rounded-full bg-slate-100/70 group-hover:bg-blue-50/80 transition-colors duration-300" />
                    <img
                        src={imgSrc}
                        alt={category.name}
                        loading="lazy"
                        decoding="async"
                        onError={handleImageError}
                        className="relative z-10 h-16 w-16 sm:h-20 sm:w-20 md:h-22 md:w-22 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5"
                    />
                </div>

                {/* Category Name & Count */}
                <div className="mt-2 w-full px-0.5">
                    <h3 className="text-xs sm:text-sm md:text-[15px] font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight min-h-[1.9rem] sm:min-h-[2.3rem] flex items-center justify-center">
                        {category.name}
                    </h3>
                    
                    <p className="mt-0.5 text-[10px] sm:text-xs font-semibold text-slate-500 truncate">
                        {(pCount > 0 || sCount > 0) ? (
                            <span>
                                {isBoth
                                    ? `${pCount > 0 ? `${pCount} Products` : ''}${pCount > 0 && sCount > 0 ? ' • ' : ''}${sCount > 0 ? `${sCount} Services` : ''}`
                                    : isService
                                        ? `${sCount} Services`
                                        : `${pCount} Products`}
                            </span>
                        ) : (
                            'Verified MSME Catalog'
                        )}
                    </p>
                </div>
            </Link>

            {/* Bottom Actions - Sleek, lightweight pills */}
            <div className="relative mt-2 pt-1.5 z-10 w-full">
                {isBoth ? (
                    <div className="flex items-center gap-1.5 w-full">
                        <Link
                            href={`/marketplace/products?categoryId=${category.id}`}
                            className="flex-1 py-1 rounded-full bg-slate-50 hover:bg-[#0b2447] text-slate-700 hover:text-white border border-slate-200/70 hover:border-[#0b2447] text-[10px] sm:text-[11px] font-bold transition-all duration-200 text-center shadow-2xs active:scale-95 truncate px-1"
                        >
                            Products
                        </Link>
                        <Link
                            href={`/marketplace/services?categoryId=${category.id}`}
                            className="flex-1 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-700 hover:text-[#0b2447] border border-slate-200 text-[10px] sm:text-[11px] font-bold transition-all duration-200 text-center shadow-2xs active:scale-95 truncate px-1"
                        >
                            Services
                        </Link>
                    </div>
                ) : (
                    <Link
                        href={targetHref}
                        className="w-full py-1 rounded-full bg-slate-50 hover:bg-[#0b2447] text-slate-700 hover:text-white border border-slate-200/70 hover:border-[#0b2447] text-[10px] sm:text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1 shadow-2xs group/btn active:scale-95"
                    >
                        <span>{isService ? 'Explore Services' : 'Browse Products'}</span>
                        <ArrowRight className="h-2.5 w-2.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
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
            <td className="py-3 pl-4 sm:pl-6 pr-4 align-middle">
                <div className="flex items-center gap-3.5">
                    <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 via-white to-blue-50/50 p-2 ring-1 ring-slate-200/80 transition-all duration-300 group-hover:bg-blue-50/80 group-hover:ring-blue-300 shadow-xs">
                        <img
                            src={imgSrc}
                            alt={category.name}
                            loading="lazy"
                            decoding="async"
                            onError={handleImageError}
                            className="w-full h-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                        />
                    </div>
                    <div>
                        <Link
                            href={targetHref}
                            className="text-sm sm:text-base font-extrabold text-[#0b2447] transition hover:text-blue-600 leading-snug"
                        >
                            {category.name}
                        </Link>
                    </div>
                </div>
            </td>
            
            {/* Description */}
            <td className="py-2.5 px-4 align-middle hidden md:table-cell">
                <p className="text-xs text-slate-500 leading-snug">
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
                    viewMode === 'list' ? "py-3 sm:py-5" : "py-4 sm:py-7 md:py-9"
                )}>
                    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 2xl:px-8">
                        <div className="max-w-3xl">
                            <div className={cn(
                                "inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-black",
                                viewMode === 'list' ? "px-2 py-0.5 text-[9px] sm:text-[10px] mb-1.5" : "px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs mb-2 sm:mb-3"
                            )}>
                                <Sparkles className="text-blue-600 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                <span>Official Industrial Category Directory</span>
                            </div>
                            <h1 className={cn(
                                "font-black text-[#0b2447] tracking-tight transition-all leading-tight",
                                viewMode === 'list' ? "text-lg sm:text-2xl md:text-3xl" : "text-xl sm:text-3xl md:text-4xl"
                            )}>
                                Explore All Industrial Categories &amp; Sectors
                            </h1>
                            <p className={cn(
                                "font-medium text-slate-600 leading-relaxed transition-all",
                                viewMode === 'list' ? "mt-1 text-[11px] sm:text-xs md:text-sm" : "mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base"
                            )}>
                                Browse certified product catalogues, engineering machinery, electrical supplies, MRO spares, and industrial contractors from verified MSMEs across Jharsuguda and Odisha.
                            </p>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className={cn(
                            "flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 bg-white rounded-2xl border border-slate-200 shadow-xs transition-all duration-300",
                            viewMode === 'list' ? "mt-3 sm:mt-4 p-2 sm:p-2.5" : "mt-3.5 sm:mt-6 p-2.5 sm:p-3 md:p-4"
                        )}>
                            <div className="relative flex-1 max-w-xl">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by category name, equipment, or keyword..."
                                    className={cn(
                                        "w-full rounded-xl border border-slate-200 bg-slate-50/50 pr-4 font-semibold outline-none transition focus:bg-white focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10",
                                        viewMode === 'list' ? "h-9 pl-10 text-[11px]" : "h-9.5 sm:h-11 pl-10 text-xs"
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
                            <div className="flex items-center justify-between md:justify-end gap-2 overflow-x-auto">
                                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                                    {[
                                        { label: 'All', val: 'ALL' as const },
                                        { label: 'Products', val: 'PRODUCT' as const },
                                        { label: 'Services', val: 'SERVICE' as const },
                                    ].map(tab => (
                                        <button
                                            key={tab.val}
                                            type="button"
                                            onClick={() => setTypeFilter(tab.val)}
                                            className={cn(
                                                "px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold transition",
                                                typeFilter === tab.val
                                                    ? "bg-white text-[#0b2447] shadow-xs"
                                                    : "text-slate-600 hover:text-slate-900"
                                            )}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        className={cn(
                                            "p-1.5 sm:p-2 rounded-lg transition",
                                            viewMode === 'list'
                                                ? "bg-white text-[#0b2447] shadow-xs"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                        title="List View"
                                    >
                                        <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        className={cn(
                                            "p-1.5 sm:p-2 rounded-lg transition",
                                            viewMode === 'grid'
                                                ? "bg-white text-[#0b2447] shadow-xs"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                        title="Grid View"
                                    >
                                        <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Categories Grid Content */}
                <div className={cn(
                    "max-w-[1680px] mx-auto px-3 sm:px-6 2xl:px-8 transition-all duration-300",
                    viewMode === 'list' ? "py-3 sm:py-4" : "py-4 sm:py-6 md:py-8"
                )}>
                    <div className={cn("flex items-center justify-between", viewMode === 'list' ? "mb-2.5 sm:mb-3" : "mb-3.5 sm:mb-5")}>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Boxes className={cn("text-blue-600", viewMode === 'list' ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4 sm:h-5 sm:w-5")} />
                            <h2 className={cn("font-black text-[#0b2447]", viewMode === 'list' ? "text-xs sm:text-sm md:text-base" : "text-sm sm:text-base md:text-lg")}>
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
                            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                                    <div key={i} className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/70 p-3 sm:p-4 shadow-xs animate-pulse flex flex-col justify-between space-y-2.5">
                                        <div className="flex justify-between items-center">
                                            <div className="h-3 w-14 bg-slate-100 rounded-full" />
                                            <div className="h-3 w-12 bg-slate-100 rounded-full" />
                                        </div>
                                        <div className="flex flex-col items-center space-y-2 py-1">
                                            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-slate-100" />
                                            <div className="h-3.5 w-24 sm:w-32 bg-slate-100 rounded-full mt-1.5" />
                                            <div className="h-2.5 w-16 sm:w-20 bg-slate-100 rounded-full" />
                                        </div>
                                        <div className="h-7 w-full bg-slate-100 rounded-full" />
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
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-sm max-w-xl mx-auto my-6">
                            <Boxes className="h-12 w-12 sm:h-16 sm:w-16 text-slate-300 mx-auto mb-3 sm:mb-4" />
                            <h3 className="text-sm sm:text-base font-black text-slate-800">
                                No categories found matching "{searchQuery}"
                            </h3>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                                Try searching for generic industrial terms like electrical, safety, pumps, or tools.
                            </p>
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); }}
                                className="mt-4 h-9 sm:h-10 px-4 sm:px-5 rounded-xl bg-[#0b2447] text-white text-xs font-black hover:bg-[#12335f] transition"
                            >
                                View All Categories
                            </button>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
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
