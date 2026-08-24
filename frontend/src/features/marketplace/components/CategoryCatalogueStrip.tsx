'use client';

import React, { useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Compass,
    Sparkles,
    Layers,
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
        <div className="flex flex-col items-center justify-between text-center w-full h-full group select-none p-3 sm:p-3.5">
            {/* Category Image with soft subtle backdrop */}
            <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 md:h-18 md:w-18 items-center justify-center mb-1.5 rounded-2xl bg-gradient-to-br from-blue-50/90 via-slate-50 to-indigo-50/70 shadow-inner border border-slate-200/80 p-1.5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md group-hover:border-blue-400">
                <img
                    src={imgSrc}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    onError={handleImageError}
                    className="h-full w-full object-contain drop-shadow-sm transition-transform duration-300 ease-out"
                />
            </div>

            {/* Category Name */}
            <div className="w-full flex-1 flex items-center justify-center">
                <span className={cn(
                    "block w-full text-center text-xs sm:text-[13px] font-extrabold leading-tight line-clamp-2 transition-colors duration-200",
                    selected
                        ? "text-blue-700 font-black"
                        : "text-slate-800 group-hover:text-blue-600"
                )}>
                    {category.name}
                </span>
            </div>
        </div>
    );

    const containerClassName = cn(
        'group relative flex flex-col items-center justify-between bg-white rounded-2xl sm:rounded-3xl transition-all duration-300 text-center cursor-pointer overflow-hidden border border-white/90 shadow-md hover:shadow-2xl hover:-translate-y-1.5 hover:border-blue-300 w-full min-h-[135px] sm:min-h-[150px] md:min-h-[160px]',
        selected && 'shadow-2xl ring-2 ring-blue-500 scale-[1.03] bg-blue-50/80 border-blue-400'
    );

    if (onSelect) {
        return (
            <button
                type="button"
                data-category-id={category.id}
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
            data-category-id={category.id}
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
    initialCount?: number;
}

export function CategoryCatalogueStrip({
    categories,
    selectedCategoryId,
    onSelect,
    title = 'Official category catalogue',
    subtitle = 'Select a work category to explore verified MSME products and equipment',
    className,
    initialCount = 14,
}: CategoryCatalogueStripProps) {
    const sectionRef = useRef<HTMLElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    if (!categories.length) return null;

    const trackCategory = (category: MarketplaceCategory) => {
        marketplaceApi.trackInteraction({
            categoryId: category.id,
            action: 'CATEGORY_CLICK',
            metadata: { categoryName: category.name, source: 'category-strip' },
        }).catch(() => undefined);
    };

    const hasMore = categories.length > initialCount;
    const displayedCategories = isExpanded || !hasMore ? categories : categories.slice(0, initialCount);
    const remainingCount = categories.length - initialCount;

    const handleToggleExpand = () => {
        if (isExpanded) {
            setIsExpanded(false);
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            setIsExpanded(true);
        }
    };

    return (
        <section
            ref={sectionRef}
            className={cn(
                'relative overflow-hidden py-9 sm:py-12 border-t border-slate-200/80 bg-gradient-to-br from-[#0e2554] via-[#133878] to-[#0c1e44] bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(96,165,250,0.35),rgba(15,37,84,0))]',
                className
            )}
            id="categories"
        >
            {/* Top Luminous Shimmer Line */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/80 via-blue-400/80 to-transparent" />

            <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                {/* Header Section */}
                <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200/80 shadow-xs backdrop-blur-md">
                                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                                {categories.length} Industrial Sectors &amp; Work Categories
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#0b2447] leading-tight">
                            {title}
                        </h2>
                        <p className="mt-1.5 text-xs sm:text-base font-semibold text-slate-600 max-w-3xl">
                            {subtitle}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <Link
                            href="/marketplace/categories"
                            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#0b2447] bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs hover:shadow-sm hover:border-[#0b2447]/30 transition-all"
                        >
                            <Compass className="h-4 w-4 text-blue-600" />
                            <span>Browse Directory</span>
                            <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                        </Link>
                    </div>
                </div>

                {/* Clean, Non-Scrolling Responsive Grid Layout */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3.5 sm:gap-4.5">
                    {displayedCategories.map((category) => {
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

                {/* Load More / Expand Button */}
                {hasMore && (
                    <div className="mt-8 sm:mt-10 flex flex-col items-center justify-center">
                        <button
                            type="button"
                            onClick={handleToggleExpand}
                            className={cn(
                                "group relative inline-flex items-center gap-3 px-8 sm:px-10 py-3 rounded-full text-xs sm:text-sm font-black tracking-wide text-white transition-all duration-300 shadow-md hover:shadow-lg overflow-hidden active:scale-95 cursor-pointer",
                                isExpanded
                                    ? "bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-blue-100"
                                    : "bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 border border-cyan-300/40 hover:scale-105"
                            )}
                        >
                            {/* Animated Shimmer Sweep */}
                            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

                            <Layers className="h-4 w-4 text-cyan-200 transition-transform duration-300 group-hover:rotate-12" />

                            <span className="font-extrabold tracking-tight">
                                {isExpanded
                                    ? 'Show Fewer Categories'
                                    : `Load More Categories (+${remainingCount} More)`
                                }
                            </span>

                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
                            ) : (
                                <ChevronDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5 animate-bounce" />
                            )}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
