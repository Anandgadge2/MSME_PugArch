/**
 * PageToolbar - the search box + filters + reset row used by every list page.
 *
 * Layout rules:
 *   - Phones: search box and a compact "Filters" button share one row.
 *     Tapping the button reveals every filter stacked below. An active-count
 *     badge sits on the button so applied filters stay visible when collapsed.
 *   - Tablets: search wide, filters in a 2-column grid, all inline.
 *   - Desktops: single row using a CSS grid template generated from the
 *     filter count.
 *
 * Usage:
 *   <PageToolbar
 *     search={q} onSearchChange={setQ}
 *     onReset={() => { setQ(''); setStatus(''); }}
 *     filters={[
 *       { kind: 'select', value: status, onChange: setStatus, options: [...] },
 *       { kind: 'select', value: range, onChange: setRange, options: [...] }
 *     ]}
 *   />
 */

import React, { useMemo, useState } from 'react';
import { Filter, SlidersHorizontal, ChevronDown, Search } from 'lucide-react';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { cn } from '../../lib/utils';

export type ToolbarFilterOption = { value: string; label: string };

export type ToolbarFilter =
    | {
        kind: 'select';
        value: string;
        onChange: (value: string) => void;
        options: ToolbarFilterOption[];
        placeholder?: string;
        ariaLabel?: string;
        className?: string;
    }
    | {
        kind: 'date';
        value: string;
        onChange: (value: string) => void;
        ariaLabel?: string;
        placeholder?: string;
        className?: string;
    }
    | {
        kind: 'custom';
        render: () => React.ReactNode;
        className?: string;
        /** Optional callable that reports whether this custom filter is "active"
         *  so the mobile Filters button can show an accurate applied-count. */
        isActive?: () => boolean;
    };

export interface PageToolbarProps {
    search?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    filters?: ToolbarFilter[];
    onReset?: () => void;
    /** Optional right-aligned button cluster (e.g. "+ New Rule"). */
    actions?: React.ReactNode;
    className?: string;
    /** Disable the rounded card styling when embedding the toolbar inline. */
    embedded?: boolean;
    /** If true, the search and filters will be on a single row on desktop/tablet. */
    singleRowDesktop?: boolean;
    filterTitle?: string;
    resetLabel?: string;
    defaultOpen?: boolean;
}

const inputBase =
    'h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer';

const renderFilter = (f: ToolbarFilter, idx: number) => {
    if (f.kind === 'select') {
        return (
            <select
                key={idx}
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                aria-label={f.ariaLabel || 'Filter'}
                className={cn(inputBase, 'w-full', f.className)}
            >
                {f.placeholder && <option value="">{f.placeholder}</option>}
                {f.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        );
    }
    if (f.kind === 'date') {
        return (
            <div key={idx} className={cn('w-full', f.className)}>
                <DateTimePicker
                    mode="date"
                    size="sm"
                    value={f.value}
                    onChange={val => f.onChange(val)}
                    aria-label={f.ariaLabel || 'Date filter'}
                    placeholder={f.placeholder || 'Filter date'}
                />
            </div>
        );
    }
    return (
        <div key={idx} className={cn('min-w-0 w-full', f.className)}>{f.render()}</div>
    );
};

const isFilterApplied = (f: ToolbarFilter) => {
    if (f.kind === 'select' || f.kind === 'date') return Boolean(f.value);
    return f.isActive ? f.isActive() : false;
};

export function PageToolbar({
    search,
    onSearchChange,
    searchPlaceholder = 'Search...',
    filters = [],
    onReset,
    actions,
    className,
    embedded,
    filterTitle = 'Filter By Specific Criteria',
    resetLabel = 'Reset Filter Options',
    defaultOpen = false,
}: PageToolbarProps) {
    const hasSearch = onSearchChange !== undefined;
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const appliedCount = useMemo(
        () => filters.filter(isFilterApplied).length,
        [filters]
    );

    const showFiltersBtn = filters.length > 0;

    return (
        <div
            className={cn(
                embedded ? 'space-y-3' : 'rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-sm space-y-3',
                'overflow-x-hidden',
                className
            )}
        >
            {/* Tier 1: Search Bar & Actions / Filter Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 w-full min-w-0">
                {hasSearch && (
                    <div className="relative flex-1 min-w-0 w-full">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search ?? ''}
                            onChange={e => onSearchChange?.(e.target.value)}
                            placeholder={searchPlaceholder}
                            aria-label="Search"
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full sm:w-auto">
                    {showFiltersBtn && (
                        <button
                            type="button"
                            onClick={() => setIsOpen(prev => !prev)}
                            aria-expanded={isOpen}
                            aria-controls="page-toolbar-filters-panel"
                            aria-label="Toggle filter options"
                            className={cn(
                                'inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0',
                                isOpen || appliedCount > 0
                                    ? 'border-[#12335f] bg-[#12335f]/5 text-[#12335f] hover:bg-[#12335f]/10'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                            )}
                        >
                            <Filter className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" />
                            <span>Filters</span>
                            {appliedCount > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#12335f] text-white text-[10px] font-black">
                                    {appliedCount}
                                </span>
                            )}
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 text-slate-500", isOpen && "rotate-180")} aria-hidden="true" />
                        </button>
                    )}

                    {actions && <div className="shrink-0 flex items-center">{actions}</div>}
                </div>
            </div>

            {/* Tier 2: Collapsible Secondary Filter Tray */}
            {isOpen && showFiltersBtn && (
                <div
                    id="page-toolbar-filters-panel"
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 [&>div]:!w-full [&>div]:!max-w-none [&>div>select]:!w-full [&>select]:!w-full [&>label]:!w-full [&>div>div]:!w-full">
                        {filters.map((f, idx) => renderFilter(f, idx))}
                    </div>
                </div>
            )}
        </div>
    );
}
