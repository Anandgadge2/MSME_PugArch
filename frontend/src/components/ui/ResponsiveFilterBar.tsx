import React, { useState, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Filter, SlidersHorizontal, ChevronDown } from 'lucide-react';

export interface ResponsiveFilterBarProps {
  searchInput: ReactNode;
  filters?: ReactNode;
  endContent?: ReactNode;
  viewToggle?: ReactNode;
  activeFilterCount?: number;
  singleRowDesktop?: boolean;
  className?: string;
  hasFilters?: boolean;
  searchWrapperClassName?: string;
  filtersClassName?: string;
  collapsible?: boolean;
  filterTitle?: string;
  onReset?: () => void;
  resetLabel?: string;
  defaultOpen?: boolean;
  gridColsClassName?: string;
}

export function ResponsiveFilterBar({
  searchInput,
  filters,
  endContent,
  viewToggle,
  activeFilterCount = 0,
  singleRowDesktop = false,
  className,
  hasFilters,
  searchWrapperClassName,
  filtersClassName,
  collapsible = true,
  filterTitle = "Filter By Specific Criteria",
  onReset,
  resetLabel = "Reset Filter Options",
  defaultOpen = false,
  gridColsClassName = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
}: ResponsiveFilterBarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const showFiltersBtn = hasFilters !== false && Boolean(filters);
  const primaryViewToggle = viewToggle;

  return (
    <div className={cn("flex flex-col gap-3 w-full min-w-0", className)}>
      {/* Tier 1: Search Input & Primary Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 w-full min-w-0">
        {/* Search Bar */}
        <div className={cn("relative flex-1 min-w-0 w-full", searchWrapperClassName)}>
          {searchInput}
        </div>

        {/* Actions & Filters Toggle Toolbar */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full sm:w-auto">
          {/* Filters Toggle Button */}
          {showFiltersBtn && (
            <button
              type="button"
              onClick={() => setIsOpen(prev => !prev)}
              aria-expanded={isOpen}
              aria-controls="advanced-filters-panel"
              aria-label="Toggle filter options"
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0",
                isOpen || activeFilterCount > 0
                  ? "border-[#12335f] bg-[#12335f]/5 text-[#12335f] hover:bg-[#12335f]/10"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              <Filter className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#12335f] text-white text-[10px] font-black">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 text-slate-500", isOpen && "rotate-180")} aria-hidden="true" />
            </button>
          )}

          {/* View Toggle and End Controls */}
          {(primaryViewToggle || endContent) && (
            <div className="flex items-center gap-2 shrink-0">
              {endContent}
              {primaryViewToggle && (
                <div className="border-l border-slate-200 pl-2">
                  {primaryViewToggle}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tier 2: Collapsible Secondary Filter Tray */}
      {isOpen && showFiltersBtn && (
        <div
          id="advanced-filters-panel"
          role="region"
          aria-label="Filter Options"
          className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:p-4 transition-all duration-200 space-y-3 animate-in fade-in slide-in-from-top-1"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                {filterTitle}
              </span>
            </div>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                {resetLabel}
              </button>
            )}
          </div>

          <div className={cn(
            "grid gap-2.5 sm:gap-3",
            gridColsClassName,
            "[&>div]:!w-full [&>div]:!max-w-none [&>div>select]:!w-full [&>select]:!w-full [&>label]:!w-full [&>div>div]:!w-full",
            filtersClassName
          )}>
            {filters}
          </div>
        </div>
      )}

      {/* Non-collapsible fallback when explicitly opted out */}
      {!collapsible && filters && !isOpen && (
        <div className="hidden sm:flex items-center flex-wrap gap-2 sm:gap-2.5 w-full min-w-0 pt-2.5 border-t border-slate-100/90">
          {filters}
        </div>
      )}
    </div>
  );
}
