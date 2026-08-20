'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowRight,
    Boxes,
    ChevronRight,
    Factory,
    Layers,
    Search,
    ShieldCheck,
    Sparkles,
    Wrench,
    Zap,
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
    const router = useRouter();
    const meta = getCategoryVisualMeta(category);
    const [imgSrc, setImgSrc] = useState<string>(() => getCategoryImageUrl(category));
    const [imgError, setImgError] = useState(false);

    const handleImageError = () => {
        if (!imgError) {
            setImgError(true);
            setImgSrc(buildCategoryFallbackSvg(category.name, meta.accentColor));
        }
    };

    const subItems = getCategorySubItems(category.name);
    const isService = category.type === 'SERVICE';
    const isBoth = category.type === 'BOTH';

    return (
        <div className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl">
            <div>
                {/* Top Badge & Image Container */}
                <div className="flex items-start justify-between gap-4">
                    <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 p-3 ring-1 ring-slate-100 transition-all duration-300 group-hover:scale-105 group-hover:bg-blue-50/80 group-hover:ring-blue-200">
                        <img
                            src={imgSrc}
                            alt={category.name}
                            loading="lazy"
                            decoding="async"
                            onError={handleImageError}
                            className="h-20 w-20 sm:h-24 sm:w-24 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                        />
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                        <span className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                            isService
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : isBoth
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                        )}>
                            {isService ? 'Services' : isBoth ? 'Products & Services' : 'Products'}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Verified MSME</span>
                        </span>
                    </div>
                </div>

                {/* Category Title */}
                <div className="mt-4">
                    <Link
                        href={`/marketplace/products?categoryId=${category.id}`}
                        className="text-lg font-black text-[#0b2447] transition hover:text-blue-600"
                    >
                        {category.name}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {category.description || `Browse certified ${category.name.toLowerCase()} supplies, equipment, and verified manufacturers in Jharsuguda.`}
                    </p>
                </div>

                {/* Key Subcategories / Item Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {subItems.slice(0, 4).map((sub) => (
                        <span
                            key={sub}
                            className="rounded-lg bg-slate-100/80 px-2 py-1 text-[11px] font-semibold text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-800"
                        >
                            {sub}
                        </span>
                    ))}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                <Link
                    href={`/marketplace/products?categoryId=${category.id}`}
                    className="flex-1 h-10 rounded-xl bg-[#0b2447] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#12335f] active:scale-98"
                >
                    <span>Browse Products</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                {(isService || isBoth) && (
                    <Link
                        href={`/marketplace/services?categoryId=${category.id}`}
                        className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[#0b2447] text-xs font-bold transition hover:bg-slate-50"
                        title="Browse Industrial Services"
                    >
                        Services
                    </Link>
                )}
            </div>
        </div>
    );
}

export default function MarketplaceCategoriesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');

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
                <div className="bg-gradient-to-b from-white to-slate-50/80 border-b border-slate-200/80 py-10">
                    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 2xl:px-8">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800 border border-blue-200 mb-3">
                                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                                <span>Official Industrial Category Directory</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-[#0b2447] tracking-tight">
                                Explore All Industrial Categories &amp; Sectors
                            </h1>
                            <p className="mt-2 text-sm sm:text-base font-medium text-slate-600 leading-relaxed">
                                Browse certified product catalogues, engineering machinery, electrical supplies, MRO spares, and industrial contractors from verified MSMEs across Jharsuguda and Odisha.
                            </p>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="mt-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="relative flex-1 max-w-xl">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by category name, equipment, or keyword (e.g. Safety, Motors, Steel)..."
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold outline-none transition focus:bg-white focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10"
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

                            {/* Type Filter Tabs */}
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
                        </div>
                    </div>
                </div>

                {/* Categories Grid Content */}
                <div className="max-w-[1680px] mx-auto px-4 sm:px-6 2xl:px-8 py-8 sm:py-10">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Boxes className="h-5 w-5 text-blue-600" />
                            <h2 className="text-lg font-black text-[#0b2447]">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <div key={i} className="h-80 rounded-3xl bg-white border border-slate-200 p-6 animate-pulse" />
                            ))}
                        </div>
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
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredCategories.map((category: MarketplaceCategory) => (
                                <CategoryDirectoryCard key={category.id} category={category} />
                            ))}
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}
