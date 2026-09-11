import React from 'react';
import { SortableHeader, type SortDirection } from '../../../features/shared/SortableHeader';
export type { SortDirection };
import { Pagination } from '../../../features/shared/Pagination';
import { EmptyState, InlineError } from '../../../features/shared/FeatureStates';
import { TableSkeleton } from '../skeleton';
import { cn } from '../../../lib/utils';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  /**
   * Tailwind width class for colgroup (e.g., 'w-[4%]', 'w-[24%]', 'w-16', 'w-32')
   */
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortKey?: string;
  cell: (item: T, index: number, startIndex: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string | number;

  // Sorting
  sortKey?: string;
  sortDirection?: SortDirection;
  onSort?: (field: string) => void;

  // Pagination
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  paginationLabel?: string;

  // State Overlays
  isLoading?: boolean;
  skeletonRows?: number;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };

  // Row Interactions & Styling
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: string | ((item: T, index: number) => string);
  showSrNo?: boolean;
  srNoHeader?: string;
  srNoWidth?: string;
  minWidth?: string;
  className?: string;
  tableClassName?: string;
  caption?: string;
  footer?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  sortKey,
  sortDirection = 'asc',
  onSort,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  paginationLabel = 'records',
  isLoading = false,
  skeletonRows,
  error = null,
  onRetry,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  onRowClick,
  rowClassName,
  showSrNo = true,
  srNoHeader = 'Sr. No',
  srNoWidth = 'w-[4%]',
  minWidth = 'min-w-[1000px]',
  className,
  tableClassName,
  caption,
  footer,
}: DataTableProps<T>) {
  const safePageSize = Math.max(1, pageSize || 10);
  const safePage = Math.max(1, page || 1);
  const startIndex = (safePage - 1) * safePageSize;
  const resolvedTotal = total !== undefined ? total : data.length;

  if (isLoading) {
    const colsCount = columns.length + (showSrNo ? 1 : 0);
    const rowsCount = skeletonRows || Math.min(safePageSize, 8);
    return (
      <div className={cn("overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm", className)}>
        <TableSkeleton rows={rowsCount} cols={colsCount} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm", className)}>
        <InlineError message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden", className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className
      )}
    >
      <div className="overflow-x-auto w-full max-w-full">
        <table
          className={cn(
            "w-full border-collapse text-left text-xs table-fixed",
            minWidth,
            tableClassName
          )}
        >
          {caption && <caption className="sr-only">{caption}</caption>}
          {/* Colgroup enforces fixed percentage proportions across headers and rows */}
          <colgroup>
            {showSrNo && <col className={srNoWidth} />}
            {columns.map((col) => (
              <col key={col.key} className={col.width || ''} />
            ))}
          </colgroup>

          {/* Table Header */}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75">
              {showSrNo && (
                <th
                  scope="col"
                  className="p-3 text-[10px] font-black uppercase tracking-wider text-slate-500"
                >
                  {srNoHeader}
                </th>
              )}
              {columns.map((col) => {
                const headerContent = typeof col.header === 'string' ? (
                  col.sortable && onSort ? (
                    <SortableHeader
                      label={col.header}
                      field={col.sortKey || col.key}
                      activeField={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                      align={col.align || 'left'}
                    />
                  ) : (
                    <span>{col.header}</span>
                  )
                ) : (
                  col.header
                );

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "p-3 text-[10px] font-black uppercase tracking-wider text-slate-500",
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.headerClassName
                    )}
                  >
                    {headerContent}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {data.map((item, index) => {
              const rowIndex = startIndex + index + 1;
              const rowKey = keyExtractor(item, index);
              const customRowClass =
                typeof rowClassName === 'function'
                  ? rowClassName(item, index)
                  : rowClassName;

              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick?.(item, index)}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick(item, index);
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  className={cn(
                    "hover:bg-slate-50/50 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#12335f] focus-visible:ring-inset",
                    onRowClick && "cursor-pointer",
                    customRowClass
                  )}
                >
                  {showSrNo && (
                    <td className="p-3 font-mono text-xs text-slate-500">
                      {String(rowIndex).padStart(2, '0')}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "p-3 align-middle",
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.cellClassName
                      )}
                    >
                      {col.cell(item, index, startIndex)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {footer && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50/80 font-bold">
              {footer}
            </tfoot>
          )}
        </table>
      </div>

      {/* Integrated Responsive Pagination Bar */}
      {onPageChange && resolvedTotal > 0 && (
        <Pagination
          page={safePage}
          pageSize={safePageSize}
          total={resolvedTotal}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
          label={paginationLabel}
        />
      )}
    </div>
  );
}

export default DataTable;
