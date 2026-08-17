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

  return (
    <div
      className={`flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div>
        Showing <span className="font-extrabold text-slate-900">{start}-{end}</span> of{' '}
        <span className="font-extrabold text-slate-900">{total.toLocaleString('en-IN')}</span> {label}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            aria-label="Records per page"
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]"
          >
            {pageSizeOptions.map(option => (
              <option key={option} value={option}>
                {option} / page
              </option>
            ))}
          </select>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-9 rounded-md px-3 text-xs font-black transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <span className="min-w-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
          {currentPage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-9 rounded-md px-3 text-xs font-black transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
