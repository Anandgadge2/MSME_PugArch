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

    const cardInner = (
        <div className="flex flex-col items-center justify-center text-center w-full h-full group select-none p-2 sm:p-3">
            {/* Product Image */}
            <div className="relative flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center mb-2 sm:mb-3">
                <img
                    src={imgSrc}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    onError={handleImageError}
                    className="h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-110"
                />
            </div>

            {/* Category Name */}
            <span className={cn(
                "block w-full text-center text-[11px] sm:text-xs font-bold leading-tight line-clamp-2 transition-colors duration-200",
                selected
                    ? "text-blue-700"
                    : "text-slate-800 group-hover:text-blue-600"
            )}>
                {category.name}
            </span>
        </div>
    );

    const containerClassName = cn(
        'group flex flex-col items-center justify-center w-[130px] sm:w-[150px] md:w-[170px] h-[110px] sm:h-[130px] md:h-[140px] shrink-0 bg-white rounded-xl sm:rounded-2xl transition-all duration-200 text-center cursor-pointer snap-start',
        selected
            ? 'shadow-lg ring-2 ring-blue-500 scale-[1.02]'
            : 'shadow-sm hover:shadow-lg hover:-translate-y-0.5'
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
        <section className={cn('bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-900 py-6 sm:py-8 border-y border-indigo-950', className)} id="categories">
            <div className="mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                <div className="mb-5 sm:mb-6 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white">{title}</h2>
                        <p className="mt-1 text-[11px] sm:text-sm font-medium text-indigo-100 line-clamp-1 sm:line-clamp-none">{subtitle}</p>
                    </div>
                    <Link
                        href="/marketplace/categories"
                        className="inline-flex items-center gap-1 shrink-0 text-[11px] sm:text-sm font-semibold text-white transition hover:text-blue-200 hover:underline"
                    >
                        <span>All categories</span>
                        <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Link>
                </div>

                <div className="relative group/strip">
                    {/* Left Scroll Navigation Button */}
                    <button
                        type="button"
                        onClick={() => scroll('left')}
                        className="absolute -left-2 lg:-left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-[#0b2447] hover:text-white hover:border-[#0b2447] active:scale-95 lg:flex text-slate-700 opacity-0 group-hover/strip:opacity-100 focus:opacity-100 focus-visible:opacity-100"
                        aria-label="Scroll categories left"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>

                    {/* Scrollable Track */}
                    <div
                        ref={scrollRef}
                        className="grid grid-rows-2 grid-flow-col auto-cols-max gap-3 sm:gap-4 overflow-x-auto pb-4 pt-2 px-1 no-scrollbar snap-x snap-mandatory lg:px-2 scroll-smooth"
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
                        className="absolute -right-2 lg:-right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-[#0b2447] hover:text-white hover:border-[#0b2447] active:scale-95 lg:flex text-slate-700 opacity-0 group-hover/strip:opacity-100 focus:opacity-100 focus-visible:opacity-100"
                        aria-label="Scroll categories right"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </section>
    );
}
