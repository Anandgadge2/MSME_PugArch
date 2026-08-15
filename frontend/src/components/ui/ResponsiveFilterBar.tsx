import React, { useState, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface ResponsiveFilterBarProps {
  searchInput: ReactNode;
  filters: ReactNode;
  endContent?: ReactNode;
  activeFilterCount?: number;
  className?: string;
}

export function ResponsiveFilterBar({ searchInput, filters, endContent, activeFilterCount = 0, className }: ResponsiveFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 py-2 border-y border-slate-100", className)}>
      {/* Mobile: Search bar is full width */}
      <div className="w-full sm:flex-1 min-w-0 sm:min-w-[200px]">
        {searchInput}
      </div>

      {/* Mobile-only toggle button */}
      <div className="w-full sm:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between h-10 rounded-xl border px-4 text-xs font-black tracking-wider uppercase transition-all duration-200",
            activeFilterCount > 0 
              ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
              : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.1)] active:scale-[0.98]"
          )}
        >
          <div className="flex items-center gap-2.5">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </div>

      {/* Mobile End Content (Count & View toggle) */}
      {endContent && (
        <div className="w-full sm:hidden flex items-center justify-between border-t border-slate-100 pt-2 -mt-1">
          {endContent}
        </div>
      )}

      {/* Filters Container (Hidden on mobile unless opened, always flex on sm+) */}
      <div className={cn(
        "w-full sm:w-auto sm:flex sm:flex-wrap sm:items-center gap-3",
        // On mobile, if open, make it a stacked list and force direct children to take full width.
        isOpen ? "flex flex-col [&>div]:!w-full [&>div]:!max-w-none [&>div>select]:w-full pb-2" : "hidden sm:flex"
      )}>
        {filters}
      </div>

      {/* Desktop End Content */}
      {endContent && (
        <div className="hidden sm:flex ml-auto items-center gap-3">
          {endContent}
        </div>
      )}
    </div>
  );
}
