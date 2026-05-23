import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  label?: string;
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  label = 'records'
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(total, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-3 py-3 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="text-[11px] sm:text-xs">
        Showing <span className="text-slate-900">{start}-{end}</span> of <span className="text-slate-900">{total}</span> {label}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            className="h-9 min-w-[110px] rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600"
          >
            {pageSizeOptions.map(option => (
              <option key={option} value={option}>{option} / page</option>
            ))}
          </select>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-9 rounded-md px-2.5 text-[11px] font-black sm:px-3 sm:text-xs"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <span className="min-w-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 sm:min-w-20">
          {currentPage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-9 rounded-md px-2.5 text-[11px] font-black sm:px-3 sm:text-xs"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
