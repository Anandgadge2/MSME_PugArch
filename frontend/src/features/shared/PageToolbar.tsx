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
import { Filter, RefreshCw, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
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
    /** Optional eyebrow shown above the row, e.g. "Filters". */
    eyebrow?: string;
    /** Disable the rounded card styling when embedding the toolbar inline. */
    embedded?: boolean;
    /** If true, the search and filters will be on a single row on desktop/tablet. */
    singleRowDesktop?: boolean;
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
                className={cn(inputBase, 'w-full sm:w-auto sm:min-w-[130px]', f.className)}
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
            <input
                key={idx}
                type="date"
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                aria-label={f.ariaLabel || 'Date filter'}
                placeholder={f.placeholder}
                className={cn(inputBase, 'w-full sm:w-auto sm:min-w-[140px] font-semibold', f.className)}
            />
        );
    }
    return (
        <div key={idx} className={cn('min-w-0', f.className)}>{f.render()}</div>
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
    eyebrow,
    embedded,
    singleRowDesktop
}: PageToolbarProps) {
    const hasSearch = onSearchChange !== undefined;
    const [mobileOpen, setMobileOpen] = useState(false);

    const appliedCount = useMemo(
        () => filters.filter(isFilterApplied).length,
        [filters]
    );

    return (
        <div
            className={cn(
                embedded ? 'space-y-3' : 'rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm space-y-3 sm:space-y-0',
                'overflow-x-hidden',
                className
            )}
        >
            {eyebrow && (
                <div className="flex items-center gap-2 text-[#12335f] mb-3">
                    <Filter className="h-4 w-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">{eyebrow}</p>
                </div>
            )}

            {/* Mobile layout: search + compact "Filters" toggle + actions/toggle on the SAME horizontal row */}
            <div className="space-y-2 sm:hidden">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-nowrap">
                    {hasSearch && (
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search ?? ''}
                                onChange={e => onSearchChange?.(e.target.value)}
                                placeholder={searchPlaceholder}
                                aria-label="Search"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                            />
                        </div>
                    )}

                    {(filters.length > 0 || onReset) && (
                        <button
                            type="button"
                            onClick={() => setMobileOpen(prev => !prev)}
                            aria-expanded={mobileOpen}
                            aria-controls="page-toolbar-mobile-filters"
                            className={cn(
                                'flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-[10px] font-black tracking-wider uppercase transition-all duration-200',
                                appliedCount > 0 || mobileOpen
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.1)] active:scale-[0.98]'
                            )}
                        >
                            <Filter className="h-4 w-4 shrink-0" />
                            Filters
                            {appliedCount > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                                    {appliedCount}
                                </span>
                            )}
                        </button>
                    )}

                    {actions && <div className="shrink-0 flex items-center">{actions}</div>}
                </div>

                {mobileOpen && (
                    <div id="page-toolbar-mobile-filters" className="space-y-2 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                        {filters.map((f, idx) => renderFilter(f, idx))}
                        {onReset && (
                            <Button
                                variant="outline"
                                className="h-10 w-full rounded-xl text-xs font-black uppercase text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100"
                                onClick={() => {
                                    onReset();
                                    setMobileOpen(false);
                                }}
                                type="button"
                            >
                                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reset Filters
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Tablet & Desktop layout: search full-width on top (or compact on left), filters in flex row */}
            <div className={cn("hidden sm:flex gap-2.5 sm:gap-3 w-full", singleRowDesktop ? "sm:flex-row sm:items-center sm:flex-nowrap" : "sm:flex-col")}>
                {hasSearch && (
                    <div className={cn("relative min-w-0", singleRowDesktop ? "w-64 sm:w-72 md:w-80 shrink-0" : "w-full")}>
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

                {(filters.length > 0 || onReset) && (
                    <div className={cn("flex items-center gap-2.5 sm:gap-3", singleRowDesktop ? "flex-nowrap shrink-0" : "flex-wrap")}>
                        {filters.map((f, idx) => renderFilter(f, idx))}

                        {onReset && (
                            <Button
                                variant="outline"
                                className="h-10 rounded-xl text-xs font-black uppercase px-3.5 text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 shrink-0"
                                onClick={onReset}
                                type="button"
                            >
                                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reset
                            </Button>
                        )}
                    </div>
                )}

                {actions && (
                    <div className={cn("flex items-center gap-2 shrink-0", singleRowDesktop ? "ml-auto" : "sm:ml-auto")}>
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
