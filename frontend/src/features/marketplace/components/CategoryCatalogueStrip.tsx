'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import {
    Armchair,
    BadgeIndianRupee,
    Boxes,
    ChevronLeft,
    ChevronRight,
    Cog,
    Factory,
    FlaskConical,
    Hammer,
    HardHat,
    Monitor,
    Package,
    Printer,
    Shield,
    Truck,
    Users,
    UtensilsCrossed,
    Wrench,
    Zap,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { marketplaceApi, type MarketplaceCategory } from '../api';

const iconRules: [string, React.ReactNode, string][] = [
    ['electrical', <Zap className="h-5 w-5" />, 'bg-amber-50 text-amber-700 border-amber-100'],
    ['machinery', <Cog className="h-5 w-5" />, 'bg-blue-50 text-blue-700 border-blue-100'],
    ['mechanical', <Factory className="h-5 w-5" />, 'bg-slate-50 text-slate-700 border-slate-100'],
    ['safety', <Shield className="h-5 w-5" />, 'bg-emerald-50 text-emerald-700 border-emerald-100'],
    ['construction', <Hammer className="h-5 w-5" />, 'bg-stone-50 text-stone-700 border-stone-100'],
    ['office', <Printer className="h-5 w-5" />, 'bg-sky-50 text-sky-700 border-sky-100'],
    ['it ', <Monitor className="h-5 w-5" />, 'bg-indigo-50 text-indigo-700 border-indigo-100'],
    ['computer', <Monitor className="h-5 w-5" />, 'bg-indigo-50 text-indigo-700 border-indigo-100'],
    ['furniture', <Armchair className="h-5 w-5" />, 'bg-rose-50 text-rose-700 border-rose-100'],
    ['packaging', <Boxes className="h-5 w-5" />, 'bg-violet-50 text-violet-700 border-violet-100'],
    ['chemical', <FlaskConical className="h-5 w-5" />, 'bg-teal-50 text-teal-700 border-teal-100'],
    ['logistics', <Truck className="h-5 w-5" />, 'bg-green-50 text-green-700 border-green-100'],
    ['transport', <Truck className="h-5 w-5" />, 'bg-green-50 text-green-700 border-green-100'],
    ['fabrication', <HardHat className="h-5 w-5" />, 'bg-orange-50 text-orange-700 border-orange-100'],
    ['maintenance', <Wrench className="h-5 w-5" />, 'bg-cyan-50 text-cyan-700 border-cyan-100'],
    ['textile', <Package className="h-5 w-5" />, 'bg-pink-50 text-pink-700 border-pink-100'],
    ['food', <UtensilsCrossed className="h-5 w-5" />, 'bg-lime-50 text-lime-700 border-lime-100'],
    ['shg', <Users className="h-5 w-5" />, 'bg-emerald-50 text-emerald-700 border-emerald-100'],
    ['local', <BadgeIndianRupee className="h-5 w-5" />, 'bg-orange-50 text-orange-700 border-orange-100'],
];

function iconFor(categoryName: string) {
    const lower = ` ${categoryName.toLowerCase()} `;
    const match = iconRules.find(([key]) => lower.includes(key));
    return match ? [match[1], match[2]] as const : [<Package className="h-5 w-5" />, 'bg-slate-50 text-slate-700 border-slate-100'] as const;
}

function categoryCount(category: MarketplaceCategory) {
    const productCount = category.productCount ?? category._count?.products ?? 0;
    const serviceCount = category.serviceCount ?? category._count?.services ?? 0;
    const count = productCount + serviceCount;
    if (!count) return '';
    if (productCount && serviceCount) return `${count} listings`;
    return productCount ? `${productCount} products` : `${serviceCount} services`;
}

interface CategoryCatalogueStripProps {
    categories: MarketplaceCategory[];
    selectedCategoryId?: string | number | null;
    onSelect?: (category: MarketplaceCategory) => void;
    title?: string;
    subtitle?: string;
    className?: string;
}

export function CategoryCatalogueStrip({
    categories,
    selectedCategoryId,
    onSelect,
    title = 'Browse by procurement category',
    subtitle = 'Find verified MSME products and services by work area',
    className,
}: CategoryCatalogueStripProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    if (!categories.length) return null;

    const scroll = (direction: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: direction === 'left' ? -360 : 360, behavior: 'smooth' });
    };

    const trackCategory = (category: MarketplaceCategory) => {
        marketplaceApi.trackInteraction({
            categoryId: category.id,
            action: 'CATEGORY_CLICK',
            metadata: { categoryName: category.name, source: 'category-strip' },
        }).catch(() => undefined);
    };

    return (
        <section className={cn('border-y border-slate-100 bg-white', className)} id="categories">
            <div className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6 2xl:px-8">
                <div className="mb-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-[#0b2447] sm:text-base">{title}</h2>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{subtitle}</p>
                    </div>
                    <Link href="/marketplace/products" className="shrink-0 text-[11px] font-black text-[#0b2447] hover:underline">
                        All categories
                    </Link>
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-1/2 z-10 hidden h-12 w-8 -translate-y-1/2 items-center justify-center rounded-r-md border border-slate-200 bg-white/95 shadow-sm transition hover:bg-slate-50 lg:flex"
                        aria-label="Scroll categories left"
                    >
                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                    </button>

                    <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-1 no-scrollbar lg:px-8">
                        {categories.map((category) => {
                            const selected = String(selectedCategoryId || '') === String(category.id);
                            const [icon, iconClassName] = iconFor(category.name);
                            const content = (
                                <>
                                    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border', iconClassName)}>
                                        {icon}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block line-clamp-2 text-[11px] font-black leading-tight text-slate-800 group-hover:text-[#0b2447]">
                                            {category.name}
                                        </span>
                                        {categoryCount(category) && (
                                            <span className="mt-1 block truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                                {categoryCount(category)}
                                            </span>
                                        )}
                                    </span>
                                </>
                            );

                            const className = cn(
                                'group flex h-[74px] w-[176px] shrink-0 items-center gap-3 rounded-lg border bg-white px-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0b2447]/30 hover:shadow-md',
                                selected ? 'border-[#0b2447] bg-blue-50/70 ring-2 ring-[#0b2447]/10' : 'border-slate-200'
                            );

                            if (onSelect) {
                                return (
                                    <button
                                        key={category.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => {
                                            trackCategory(category);
                                            onSelect(category);
                                        }}
                                        className={className}
                                    >
                                        {content}
                                    </button>
                                );
                            }

                            return (
                                <Link
                                    key={category.id}
                                    href={`/marketplace/products?categoryId=${category.id}`}
                                    onClick={() => trackCategory(category)}
                                    className={className}
                                >
                                    {content}
                                </Link>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-1/2 z-10 hidden h-12 w-8 -translate-y-1/2 items-center justify-center rounded-l-md border border-slate-200 bg-white/95 shadow-sm transition hover:bg-slate-50 lg:flex"
                        aria-label="Scroll categories right"
                    >
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                    </button>
                </div>
            </div>
        </section>
    );
}
