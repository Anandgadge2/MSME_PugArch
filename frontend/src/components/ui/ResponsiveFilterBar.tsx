import React, { useState, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Filter } from 'lucide-react';

export interface ResponsiveFilterBarProps {
  searchInput: ReactNode;
  filters?: ReactNode;
  endContent?: ReactNode;
  viewToggle?: ReactNode;
  activeFilterCount?: number;
  singleRowDesktop?: boolean;
  className?: string;
  hasFilters?: boolean;
}

export function ResponsiveFilterBar({
  searchInput,
  filters,
  endContent,
  viewToggle,
  activeFilterCount = 0,
  singleRowDesktop = true,
  className,
  hasFilters
}: ResponsiveFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const showFiltersBtn = hasFilters !== false && Boolean(filters);
  const primaryViewToggle = viewToggle;

  return (
    <div className={cn(
      "flex flex-col gap-2 sm:gap-2.5 w-full min-w-0",
      className
    )}>
      {/* Mobile Top Row: [ Search Bar (flex-1) ] [ FILTERS (shrink-0) ] [ List/Grid Toggle (shrink-0) ] on the SAME HORIZONTAL LINE */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0 flex-nowrap sm:hidden">
        {/* Search: flexible width */}
        <div className="flex-1 min-w-0">
          {searchInput}
        </div>

        {/* Mobile-only compact FILTERS toggle button */}
        {showFiltersBtn && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              className={cn(
                "flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-[10px] font-black tracking-wider uppercase transition-all duration-200",
                activeFilterCount > 0 || isOpen
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.1)] active:scale-[0.98]"
              )}
            >
              <Filter className="h-4 w-4 shrink-0" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Mobile View Toggle / End Controls on the SAME horizontal line */}
        {(primaryViewToggle || endContent) && (
          <div className="shrink-0 flex items-center gap-1.5">
            {primaryViewToggle || endContent}
          </div>
        )}
      </div>

      {/* Mobile Expanded Drawer: Filters list when 'Filters' is toggled open */}
      {isOpen && showFiltersBtn && (
        <div className="w-full sm:hidden flex flex-col gap-2 pt-2 border-t border-slate-100 [&>div]:!w-full [&>div]:!max-w-none [&>div>select]:w-full [&>select]:w-full [&>label]:w-full animate-in fade-in slide-in-from-top-1 duration-200">
          {filters}
          {primaryViewToggle && endContent && (
            <div className="pt-1 flex items-center justify-between border-t border-slate-100">
              {endContent}
            </div>
          )}
        </div>
      )}

      {/* Desktop / Tablet Layout */}
      {!singleRowDesktop ? (
        <div className="hidden sm:flex sm:flex-col gap-2.5 w-full min-w-0">
          {/* Top Row: [ Search Bar (flex-1) ] [ View Mode Toggle / End Content (shrink-0) ] */}
          <div className="flex items-center justify-between gap-3 w-full min-w-0">
            <div className="flex-1 min-w-0 max-w-3xl">
              {searchInput}
            </div>
            {(primaryViewToggle || endContent) && (
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                {endContent}
                {primaryViewToggle}
              </div>
            )}
          </div>

          {/* Bottom Row: Filter Ribbon */}
          {filters && (
            <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 w-full min-w-0 pt-2.5 border-t border-slate-100/90">
              {filters}
            </div>
          )}
        </div>
      ) : (
        /* Desktop / Tablet Single-Row Layout (when all filters fit on one line) */
        <div className="hidden sm:flex sm:items-center sm:flex-nowrap gap-2 sm:gap-2.5 w-full min-w-0 overflow-x-auto scrollbar-none">
          <div className="w-52 md:w-60 lg:w-64 xl:w-72 shrink-0">
            {searchInput}
          </div>

          {filters && (
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 flex-wrap">
              {filters}
            </div>
          )}

          {(primaryViewToggle || endContent) && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {endContent}
              {primaryViewToggle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
