'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
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

    const handleImageError = () => {
        if (!imgError) {
            setImgError(true);
            setImgSrc(buildCategoryFallbackSvg(category.name, meta.accentColor));
        }
    };

    const cardInner = (
        <div className="flex flex-col items-center text-center w-full group select-none py-1">
            {/* Product Cluster Image Container */}
            <div className={cn(
                "relative flex h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 items-center justify-center rounded-2xl transition-all duration-300 ease-out",
                selected
                    ? "bg-blue-50/90 ring-2 ring-blue-600 shadow-md scale-105"
                    : "bg-slate-50/60 hover:bg-slate-100/80 hover:shadow-md"
            )}>
                <img
                    src={imgSrc}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    onError={handleImageError}
                    className="h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 object-contain drop-shadow-sm transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-0.5"
                />
            </div>

            {/* Category Name */}
            <span className={cn(
                "mt-2 block max-w-[110px] sm:max-w-[125px] md:max-w-[135px] text-center text-[11px] sm:text-xs font-bold leading-tight line-clamp-2 transition-colors duration-200",
                selected
                    ? "text-blue-700 font-extrabold"
                    : "text-slate-800 group-hover:text-blue-600"
            )}>
                {category.name}
            </span>

            {/* Active Indicator Bar */}
            {selected && (
                <span className="mt-1.5 h-1 w-6 rounded-full bg-blue-600 animate-in fade-in zoom-in duration-200" />
            )}
        </div>
    );

    const containerClassName = cn(
        'group flex flex-col items-center justify-start w-[100px] sm:w-[120px] md:w-[135px] shrink-0 p-1.5 rounded-2xl transition-all duration-200 text-center cursor-pointer snap-start',
        selected
            ? 'bg-white shadow-sm ring-1 ring-blue-200'
            : 'hover:bg-white/70'
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
                className={containerClassName}
            >
                {cardInner}
            </button>
        );
    }

    return (
        <Link
            href={`/marketplace/products?categoryId=${category.id}`}
            onClick={onClick}
            className={containerClassName}
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
        <section className={cn('border-y border-slate-100 bg-white/70 backdrop-blur-md py-4 sm:py-5', className)} id="categories">
            <div className="mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                <div className="mb-3 sm:mb-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[#0b2447]">{title}</h2>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500/95">{subtitle}</p>
                    </div>
                    <Link
                        href="/marketplace/categories"
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
                        className="absolute -left-2 lg:-left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-[#0b2447] hover:text-white hover:border-[#0b2447] active:scale-95 lg:flex text-slate-700"
                        aria-label="Scroll categories left"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>

                    {/* Scrollable Track */}
                    <div
                        ref={scrollRef}
                        className="flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto pb-2 pt-1 px-1 no-scrollbar snap-x snap-mandatory lg:px-2 scroll-smooth"
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
                        className="absolute -right-2 lg:-right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-[#0b2447] hover:text-white hover:border-[#0b2447] active:scale-95 lg:flex text-slate-700"
                        aria-label="Scroll categories right"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </section>
    );
}
