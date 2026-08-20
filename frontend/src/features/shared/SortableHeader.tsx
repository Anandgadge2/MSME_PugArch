import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import React from 'react';
import { cn } from '../../lib/utils';

export type SortDirection = 'asc' | 'desc';

export interface SortableHeaderProps<T extends string = string> {
  label: string;
  field: T;
  activeField?: T | string;
  direction?: SortDirection;
  onSort: (field: T) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  title?: string;
}

function SortableHeaderBase<T extends string = string>({
  label,
  field,
  activeField,
  direction = 'asc',
  onSort,
  align = 'left',
  className,
  title
}: SortableHeaderProps<T>) {
  const active = activeField === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      title={title || `Sort by ${label}`}
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] lg:text-xs font-black uppercase tracking-wider transition-colors',
        align === 'right' && 'justify-end w-full text-right',
        align === 'center' && 'justify-center w-full text-center',
        align === 'left' && 'justify-start text-left',
        active ? 'text-[#12335f]' : 'text-slate-500 hover:text-[#12335f]',
        className
      )}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      {active ? (
        direction === 'asc' ? (
          <ArrowUp className="h-3 w-3 lg:h-3.5 lg:w-3.5 shrink-0 text-[#12335f]" />
        ) : (
          <ArrowDown className="h-3 w-3 lg:h-3.5 lg:w-3.5 shrink-0 text-[#12335f]" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 lg:h-3.5 lg:w-3.5 shrink-0 opacity-40 hover:opacity-100" />
      )}
    </button>
  );
}

export const SortableHeader = React.memo(SortableHeaderBase) as typeof SortableHeaderBase;
export default SortableHeader;
