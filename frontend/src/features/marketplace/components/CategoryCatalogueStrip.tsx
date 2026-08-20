'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    Check,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { marketplaceApi, type MarketplaceCategory } from '../api';
import {
    getCategoryVisualMeta,
    getCategoryImageUrl,
    buildCategoryFallbackSvg,
} from '../utils/categoryImages';

function categoryCount(category: MarketplaceCategory) {
    const productCount = category.productCount ?? category._count?.products ?? 0;
    const serviceCount = category.serviceCount ?? category._count?.services ?? 0;
    const count = productCount + serviceCount;
    if (!count) return '';
    if (productCount && serviceCount) return `${count} listings`;
    return productCount ? `${productCount} products` : `${serviceCount} services`;
}

interface CategoryCardItemProps {
    category: MarketplaceCategory;
    selected: boolean;
    onSelect?: (category: MarketplaceCategory) => void;
    onClick?: () => void;
}

function CategoryCardItem({ category, selected, onSelect, onClick }: CategoryCardItemProps) {
    const meta = getCategoryVisualMeta(category);
    const [imgSrc, setImgSrc] = useState<string>(() => getCategoryImageUrl(category));
    const [imgError, setImgError] = useState(false);

    const countLabel = categoryCount(category);

    const handleImageError = () => {
        if (!imgError) {
            setImgError(true);
            setImgSrc(buildCategoryFallbackSvg(category.name, meta.accentColor));
        }
    };

    const cardInner = (
        <>
            {/* Image Section with hover zoom & gradient overlay */}
            <div className="relative h-24 sm:h-28 md:h-32 w-full overflow-hidden bg-slate-100">
                <img
                    src={imgSrc}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    onError={handleImageError}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-40" />

                {/* Active Indicator check badge */}
                {selected && (
                    <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-md text-[10px] font-black animate-in fade-in zoom-in duration-200">
                        <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                )}
            </div>

            {/* Bottom Content & Meta */}
            <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3 bg-white transition-colors duration-200 group-hover:bg-slate-50/60">
                <div>
                    <h3 className="line-clamp-2 text-xs sm:text-[13px] font-bold leading-snug text-slate-800 transition-colors duration-200 group-hover:text-blue-700">
                        {category.name}
                    </h3>
                </div>

                <div className="mt-2 flex items-center justify-between gap-1">
                    {countLabel ? (
                        <span className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider transition-colors duration-200",
                            selected
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600"
                        )}>
                            {countLabel}
                        </span>
                    ) : (
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors inline-flex items-center gap-0.5">
                            Explore <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                    )}
                </div>
            </div>
        </>
    );

    const cardClassName = cn(
        'group flex flex-col h-[180px] sm:h-[200px] md:h-[215px] w-[140px] sm:w-[165px] md:w-[185px] shrink-0 overflow-hidden rounded-2xl border text-left transition-all duration-300 ease-out select-none',
        selected
            ? 'border-blue-600 bg-white shadow-md ring-2 ring-blue-500/25 scale-[1.02]'
            : 'border-slate-200/80 bg-white shadow-sm hover:-translate-y-1.5 hover:border-blue-400/50 hover:shadow-xl hover:bg-white'
    );

    if (onSelect) {
        return (
            <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                    onClick?.();
                    onSelect(category);
                }}
                className={cardClassName}
            >
                {cardInner}
            </button>
        );
    }

    return (
        <Link
            href={`/marketplace/products?categoryId=${category.id}`}
            onClick={onClick}
            className={cardClassName}
        >
            {cardInner}
        </Link>
    );
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
    title = 'Official category catalogue',
    subtitle = 'Select a work category to focus products, services, sellers, and buyer actions',
    className,
}: CategoryCatalogueStripProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    if (!categories.length) return null;

    const scroll = (direction: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: direction === 'left' ? -380 : 380, behavior: 'smooth' });
    };

    const trackCategory = (category: MarketplaceCategory) => {
        marketplaceApi.trackInteraction({
            categoryId: category.id,
            action: 'CATEGORY_CLICK',
            metadata: { categoryName: category.name, source: 'category-strip' },
        }).catch(() => undefined);
    };

    return (
        <section className={cn('border-y border-slate-100 bg-white/60 backdrop-blur-md py-4 sm:py-6', className)} id="categories">
            <div className="mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                <div className="mb-4 sm:mb-5 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[#0b2447]">{title}</h2>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500/95">{subtitle}</p>
                    </div>
                    <Link
                        href="/marketplace/products"
                        className="inline-flex items-center gap-1 shrink-0 text-xs font-black text-[#0b2447] transition hover:text-blue-600 hover:underline"
                    >
                        <span>All categories</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                <div className="relative group/strip">
                    {/* Left Scroll Navigation Button */}
                    <button
                        type="button"
                        onClick={() => scroll('left')}
                        className="absolute -left-2 lg:-left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-[#0b2447] hover:text-white hover:border-[#0b2447] active:scale-95 lg:flex text-slate-700"
                        aria-label="Scroll categories left"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>

                    {/* Scrollable Track */}
                    <div
                        ref={scrollRef}
                        className="flex gap-3.5 sm:gap-4 overflow-x-auto pb-3 pt-2 px-1 no-scrollbar lg:px-2 scroll-smooth"
                    >
                        {categories.map((category) => {
                            const selected = String(selectedCategoryId || '') === String(category.id);
                            return (
                                <CategoryCardItem
                                    key={category.id}
                                    category={category}
                                    selected={selected}
                                    onSelect={onSelect}
                                    onClick={() => trackCategory(category)}
                                />
                            );
                        })}
                    </div>

                    {/* Right Scroll Navigation Button */}
                    <button
                        type="button"
                        onClick={() => scroll('right')}
                        className="absolute -right-2 lg:-right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-[#0b2447] hover:text-white hover:border-[#0b2447] active:scale-95 lg:flex text-slate-700"
                        aria-label="Scroll categories right"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </section>
    );
}
