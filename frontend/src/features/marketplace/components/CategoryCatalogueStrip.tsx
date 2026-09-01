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
    preloadCriticalCategoryPhotos,
} from '../utils/categoryImages';

interface CategoryCardItemProps {
    category: MarketplaceCategory;
    selected: boolean;
    priority?: boolean;
    onSelect?: (category: MarketplaceCategory) => void;
    onClick?: () => void;
}

function CategoryCardItem({ category, selected, priority = false, onSelect, onClick }: CategoryCardItemProps) {
    const [imgSrc, setImgSrc] = useState<string>(() => getCategoryImageUrl(category));
    const [imgError, setImgError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    React.useEffect(() => {
        setImgSrc(getCategoryImageUrl(category));
        setImgError(false);
    }, [category, (category as any).imageUrl]);

    const handleImageError = () => {
        if (!imgError) {
            setImgError(true);
            const meta = getCategoryVisualMeta(category);
            setImgSrc(buildCategoryFallbackSvg(category.name, meta.accentColor));
        }
    };

    const cardInner = (
        <div className="relative flex h-full w-full flex-col justify-end overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-100">
            {/* Background Image with eager high-priority loading for visible cards */}
            <img
                src={imgSrc}
                alt={category.name}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setIsLoaded(true)}
                onError={handleImageError}
                className={cn(
                    "absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105",
                    isLoaded ? "opacity-100" : "opacity-90"
                )}
            />
            
            {/* Ambient 3D Glass Light Sweep */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

            {/* Lower side whitish shade overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/75 via-[4%] to-transparent transition-opacity duration-300" />
            
            {/* Category Name with subtle 3D lift */}
            <div className="relative z-10 w-full p-3 sm:p-4 text-center transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5">
                <span className={cn(
                    "block w-full text-xs sm:text-[13px] font-black leading-tight line-clamp-2 transition-colors duration-300",
                    selected
                        ? "text-blue-700 font-black"
                        : "text-slate-900 group-hover:text-blue-700"
                )}>
                    {category.name}
                </span>
            </div>
        </div>
    );

    const containerClassName = cn(
        'group relative flex flex-col bg-white rounded-2xl sm:rounded-3xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu origin-center cursor-pointer border border-slate-200/80 shadow-sm hover:shadow-[0_28px_60px_-15px_rgba(15,23,42,0.35),0_12px_28px_-8px_rgba(37,99,235,0.25)] hover:-translate-y-2 hover:scale-[1.05] hover:border-blue-400 hover:ring-2 hover:ring-blue-400/30 hover:z-50 w-full aspect-[4/5] sm:aspect-square md:aspect-[4/5] xl:aspect-[4/5]',
        selected && 'shadow-xl ring-2 ring-blue-500 border-blue-400 scale-[1.02] z-10'
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

    React.useEffect(() => {
        preloadCriticalCategoryPhotos(initialCount);
    }, [initialCount]);

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
                'relative overflow-visible py-12 sm:py-16 border-y border-slate-200/70 bg-gradient-to-b from-blue-50/60 via-slate-50/80 to-blue-50/40',
                className
            )}
            id="categories"
        >
            <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                {/* Header Section */}
                <div className="mb-7 sm:mb-9 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs">
                                {categories.length} Industrial Sectors &amp; Work Categories
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-950 leading-tight">
                            {title}
                        </h2>
                        <p className="mt-1.5 text-xs sm:text-base font-semibold text-slate-500 max-w-3xl">
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
                    {displayedCategories.map((category, index) => {
                        const selected = String(selectedCategoryId || '') === String(category.id);
                        return (
                            <CategoryCardItem
                                key={category.id}
                                category={category}
                                selected={selected}
                                priority={index < 14}
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
