'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { MarketplaceCategory } from '../api';
import {
    getCategoryVisualMeta,
    getCategoryImageUrl,
    buildCategoryFallbackSvg,
} from '../utils/categoryImages';

interface CategoryHorizontalBarProps {
    categories: MarketplaceCategory[];
    selectedCategoryId?: string | number | null;
    selectedCategoryIds?: string[];
    onSelectCategory: (categoryId: string) => void;
    onClearCategory: () => void;
    className?: string;
}

function CategoryChip({
    category,
    isSelected,
    onClick,
}: {
    category: MarketplaceCategory;
    isSelected: boolean;
    onClick: () => void;
}) {
    const meta = getCategoryVisualMeta(category);
    const [imgSrc, setImgSrc] = useState<string>(() => getCategoryImageUrl(category));
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgSrc(getCategoryImageUrl(category));
        setImgError(false);
    }, [category, category.imageUrl]);

    const handleImageError = () => {
        if (!imgError) {
            setImgError(true);
            setImgSrc(buildCategoryFallbackSvg(category.name, meta.accentColor));
        }
    };

    return (
        <button
            type="button"
            onClick={onClick}
            title={category.name}
            className={cn(
                "group shrink-0 inline-flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 select-none border cursor-pointer",
                isSelected
                    ? "bg-[#0b2447] text-white border-[#0b2447] shadow-md shadow-[#0b2447]/20 scale-[1.02] ring-2 ring-[#0b2447]/30"
                    : "bg-white text-slate-700 border-slate-200/90 hover:border-blue-400/80 hover:bg-blue-50/40 hover:text-[#0b2447] shadow-xs"
            )}
        >
            {/* Category Icon / Image thumbnail */}
            <div className={cn(
                "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg p-0.5 transition-transform duration-200 group-hover:scale-105",
                isSelected
                    ? "bg-white/15"
                    : "bg-slate-100/90 border border-slate-200/60"
            )}>
                <img
                    src={imgSrc}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    onError={handleImageError}
                    className="h-full w-full object-contain"
                />
            </div>

            {/* Category Name */}
            <span className="whitespace-nowrap max-w-[180px] sm:max-w-[220px] truncate tracking-tight text-left">
                {category.name}
            </span>
        </button>
    );
}

export function CategoryHorizontalBar({
    categories,
    selectedCategoryId,
    selectedCategoryIds = [],
    onSelectCategory,
    onClearCategory,
    className,
}: CategoryHorizontalBarProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const updateScrollButtons = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateScrollButtons();
        el.addEventListener('scroll', updateScrollButtons, { passive: true });
        window.addEventListener('resize', updateScrollButtons);
        return () => {
            el.removeEventListener('scroll', updateScrollButtons);
            window.removeEventListener('resize', updateScrollButtons);
        };
    }, [categories]);

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollAmount = direction === 'left' ? -350 : 350;
        el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    };

    const isAllSelected = (!selectedCategoryId || selectedCategoryId === '') && selectedCategoryIds.length === 0;

    return (
        <div className={cn("relative w-full rounded-2xl bg-white border border-slate-200/80 shadow-xs p-2", className)}>
            <div className="relative flex items-center">
                {/* Left Scroll Button */}
                {canScrollLeft && (
                    <div className="absolute -left-1 z-10 flex h-full items-center bg-gradient-to-r from-white via-white/95 to-transparent pr-4 pl-1">
                        <button
                            type="button"
                            onClick={() => scroll('left')}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-all hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 hover:scale-105 active:scale-95 cursor-pointer"
                            aria-label="Scroll left"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Single Row Horizontal Scrollable Category Track */}
                <div
                    ref={scrollRef}
                    className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 w-full"
                >
                    {/* All Categories Option */}
                    <button
                        type="button"
                        onClick={onClearCategory}
                        className={cn(
                            "group shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 select-none border cursor-pointer",
                            isAllSelected
                                ? "bg-[#0b2447] text-white border-[#0b2447] shadow-md shadow-[#0b2447]/20 ring-2 ring-[#0b2447]/30"
                                : "bg-white text-slate-700 border-slate-200/90 hover:border-blue-400/80 hover:bg-blue-50/40 hover:text-[#0b2447] shadow-xs"
                        )}
                    >
                        <div className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
                            isAllSelected ? "bg-white/15 text-white" : "bg-blue-50 text-blue-700 border border-blue-100"
                        )}>
                            <LayoutGrid className="h-3.5 w-3.5" />
                        </div>
                        <span className="whitespace-nowrap tracking-tight">All Categories</span>
                        <span className={cn(
                            "rounded-full px-1.5 py-0.2 text-[10px] font-black",
                            isAllSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                        )}>
                            {categories.length}
                        </span>
                    </button>

                    {/* Category Chips */}
                    {categories.map((category) => {
                        const catIdStr = String(category.id);
                        const isSelected = String(selectedCategoryId || '') === catIdStr || selectedCategoryIds.includes(catIdStr);
                        return (
                            <CategoryChip
                                key={category.id}
                                category={category}
                                isSelected={isSelected}
                                onClick={() => onSelectCategory(catIdStr)}
                            />
                        );
                    })}
                </div>

                {/* Right Scroll Button */}
                {canScrollRight && (
                    <div className="absolute -right-1 z-10 flex h-full items-center bg-gradient-to-l from-white via-white/95 to-transparent pl-4 pr-1">
                        <button
                            type="button"
                            onClick={() => scroll('right')}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-all hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 hover:scale-105 active:scale-95 cursor-pointer"
                            aria-label="Scroll right"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
