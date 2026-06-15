'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { MarketplaceItemCard, type MarketplaceDiscoveryItem } from './MarketplaceItemCard';

interface MarketplaceSectionCarouselProps {
    title: string;
    subtitle?: string;
    items: MarketplaceDiscoveryItem[];
    loading?: boolean;
    emptyState?: string;
    viewAllUrl?: string;
    sectionKey: string;
    showArrows?: boolean;
    showCompare?: boolean;
    showAddToCart?: boolean;
    showRequestQuote?: boolean;
    className?: string;
}

export function MarketplaceSectionCarousel({
    title,
    subtitle,
    items,
    loading = false,
    emptyState,
    viewAllUrl,
    sectionKey,
    showArrows = true,
    showCompare = true,
    showAddToCart = true,
    showRequestQuote = true,
    className,
}: MarketplaceSectionCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: direction === 'left' ? -520 : 520, behavior: 'smooth' });
    };

    if (!loading && items.length === 0 && !emptyState) return null;

    return (
        <section className={cn('border-b border-slate-100 bg-white', className)} data-section={sectionKey}>
            <div className="mx-auto max-w-[1680px] px-4 pt-5 sm:px-6 2xl:px-8">
                <div className="mb-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-[#0b2447] sm:text-base">{title}</h2>
                        {subtitle && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{subtitle}</p>}
                    </div>
                    {viewAllUrl && (
                        <Link href={viewAllUrl} className="shrink-0 text-[11px] font-black text-[#0b2447] hover:underline">
                            View all
                        </Link>
                    )}
                </div>
            </div>

            <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                {showArrows && items.length > 2 && (
                    <button
                        type="button"
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-1/2 z-10 hidden h-16 w-9 -translate-y-1/2 items-center justify-center rounded-r-md border border-slate-200 bg-white/95 shadow-md transition hover:bg-slate-50 lg:flex"
                        aria-label={`Scroll ${title} left`}
                    >
                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                    </button>
                )}

                {loading ? (
                    <div className="flex gap-4 overflow-hidden pb-5">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="h-[354px] w-56 shrink-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:w-60 2xl:w-64">
                                <div className="h-36 rounded-md bg-slate-100" />
                                <div className="mt-4 h-3 w-24 rounded bg-slate-100" />
                                <div className="mt-3 h-4 w-full rounded bg-slate-100" />
                                <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" />
                                <div className="mt-5 h-5 w-24 rounded bg-slate-100" />
                                <div className="mt-7 h-8 rounded bg-slate-100" />
                            </div>
                        ))}
                    </div>
                ) : items.length > 0 ? (
                    <div ref={scrollRef} className="flex snap-x gap-4 overflow-x-auto pb-5 no-scrollbar xl:gap-5">
                        {items.map((item) => (
                            <MarketplaceItemCard
                                key={`${sectionKey}-${item.id}-${(item as any).itemType || ''}`}
                                item={item}
                                itemType={(item as any).itemType === 'SERVICE' ? 'service' : (item as any).itemType === 'PRODUCT' ? 'product' : undefined}
                                showCompare={showCompare}
                                showAddToCart={showAddToCart}
                                showRequestQuote={showRequestQuote}
                            />
                        ))}
                        {viewAllUrl && (
                            <Link
                                href={viewAllUrl}
                                className="flex min-h-[354px] w-48 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center transition hover:bg-slate-100 sm:w-56"
                            >
                                <PackageSearch className="h-8 w-8 text-[#0b2447]" />
                                <span className="text-xs font-black text-[#0b2447]">View complete section</span>
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="mb-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                        <PackageSearch className="mx-auto h-9 w-9 text-slate-300" />
                        <p className="mt-2 text-xs font-semibold text-slate-500">{emptyState}</p>
                    </div>
                )}

                {showArrows && items.length > 2 && (
                    <button
                        type="button"
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-1/2 z-10 hidden h-16 w-9 -translate-y-1/2 items-center justify-center rounded-l-md border border-slate-200 bg-white/95 shadow-md transition hover:bg-slate-50 lg:flex"
                        aria-label={`Scroll ${title} right`}
                    >
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                    </button>
                )}
            </div>
        </section>
    );
}
