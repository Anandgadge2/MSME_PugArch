import React, { useState, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Filter } from 'lucide-react';

interface ResponsiveFilterBarProps {
  searchInput: ReactNode;
  filters: ReactNode;
  endContent?: ReactNode;
  activeFilterCount?: number;
  singleRowDesktop?: boolean;
  className?: string;
}

export function ResponsiveFilterBar({ searchInput, filters, endContent, activeFilterCount = 0, singleRowDesktop = true, className }: ResponsiveFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center sm:flex-nowrap gap-2 sm:gap-2.5 w-full min-w-0 overflow-x-auto scrollbar-none",
      className
    )}>
      {/* Row 1: Search bar + FILTERS toggle side-by-side on mobile (compact contained width on desktop) */}
      <div className="flex items-center gap-2 w-full min-w-0 sm:w-auto sm:shrink-0">
        {/* Search: flexible on mobile, compact fixed width on desktop */}
        <div className="flex-1 min-w-0 sm:w-52 md:w-60 lg:w-64 xl:w-72 sm:shrink-0">
          {searchInput}
        </div>

        {/* Mobile-only compact FILTERS toggle button */}
        <div className="shrink-0 sm:hidden">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-[10px] font-black tracking-wider uppercase transition-all duration-200",
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
      </div>

      {/* Filters Container (Hidden on mobile unless opened, always in-line on sm+) */}
      <div className={cn(
        "w-full sm:w-auto sm:flex sm:items-center sm:flex-nowrap gap-2 sm:gap-2.5 min-w-0",
        // On mobile, if open, make it a stacked list and force direct children to take full width.
        isOpen ? "flex flex-col [&>div]:!w-full [&>div]:!max-w-none [&>div>select]:w-full [&>select]:w-full [&>label]:w-full pb-2" : "hidden sm:flex"
      )}>
        {filters}
      </div>

      {/* Mobile End Content (Count & View toggle) */}
      {endContent && (
        <div className="w-full sm:hidden flex items-center justify-between border-t border-slate-100 pt-2 -mt-1">
          {endContent}
        </div>
      )}

      {/* Desktop End Content (Pinned to right side) */}
      {endContent && (
        <div className="hidden sm:flex sm:ml-auto items-center gap-2 shrink-0">
          {endContent}
        </div>
      )}
    </div>
  );
}
