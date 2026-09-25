import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  label?: string;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  label = 'records',
  className = ''
}: PaginationProps) {
  const safePageSize = Math.max(1, pageSize || 10);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(Math.max(page || 1, 1), totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const end = Math.min(total, currentPage * safePageSize);
  const resolvedPageSizeOptions = Array.from(new Set([...pageSizeOptions, safePageSize])).sort((a, b) => a - b);

  return (
    <div
      className={`flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 text-xs lg:text-sm font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between w-full max-w-full box-border ${className}`}
    >
      <div className="shrink flex-1 min-w-0 text-center sm:text-left text-xs sm:text-sm text-slate-600">
        Showing <span className="font-extrabold text-slate-900">{start}-{end}</span> of{' '}
        <span className="font-extrabold text-slate-900">{total.toLocaleString('en-IN')}</span> {label}
      </div>
      <div className="flex flex-row items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
        {onPageSizeChange && (
          <select
            suppressHydrationWarning
            value={safePageSize}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            aria-label="Records per page"
            className="h-11 min-h-[44px] sm:h-9 sm:min-h-0 max-w-[140px] shrink min-w-0 flex-[0_1_auto] rounded-lg border border-slate-200 bg-white px-2.5 sm:px-2 text-xs sm:text-xs lg:text-sm font-bold text-slate-700 outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]"
          >
            {resolvedPageSizeOptions.map(option => (
              <option key={option} value={option}>
                {option} / page
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous Page"
            aria-label="Previous Page"
            className="h-11 min-h-[44px] min-w-[44px] w-11 sm:h-9 sm:w-auto sm:min-h-0 sm:min-w-0 rounded-lg px-0 sm:px-3 text-xs lg:text-sm font-black transition-colors hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center active:scale-95"
          >
            <ChevronLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Prev</span>
          </Button>
          <span className="min-w-10 sm:min-w-14 min-h-[44px] sm:min-h-0 flex items-center justify-center px-1 sm:px-2 text-center text-xs lg:text-sm font-bold text-slate-700 font-mono">
            {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next Page"
            aria-label="Next Page"
            className="h-11 min-h-[44px] min-w-[44px] w-11 sm:h-9 sm:w-auto sm:min-h-0 sm:min-w-0 rounded-lg px-0 sm:px-3 text-xs lg:text-sm font-black transition-colors hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center active:scale-95"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 sm:ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Pagination;
