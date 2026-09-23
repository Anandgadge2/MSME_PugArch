import { cn } from '../../lib/utils';
import type React from 'react';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-md bg-slate-200/75 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent',
                className
            )}
            {...props}
        />
    );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div role="status" aria-busy="true" aria-live="polite" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="sr-only">Loading card data...</span>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            {Array.from({ length: rows - 2 }).map((_, idx) => (
                <Skeleton key={idx} className="h-3 w-full" />
            ))}
        </div>
    );
}

export function TableSkeleton({
    rows = 5,
    cols = 6,
    showPagination = true,
    className
}: {
    rows?: number;
    cols?: number;
    showPagination?: boolean;
    className?: string;
}) {
    // Natural realistic column widths for portal records:
    // # (narrow), Ref/Invoice No, PO/Sub-ref, Party/Vendor, Taxable (right-aligned), Tax (right-aligned), Total (right-aligned), Status pill, Action icon
    const colHeaderWidths = ['w-12', 'w-28', 'w-28', 'w-36', 'w-24', 'w-20', 'w-24', 'w-24', 'w-16'];
    const rowCellConfigs = [
        ['w-5', 'w-24', 'w-20', 'w-32', 'w-20 ml-auto', 'w-16 ml-auto', 'w-20 ml-auto', 'w-20 rounded-full h-6', 'w-8 h-8 rounded-lg ml-auto'],
        ['w-5', 'w-20', 'w-24', 'w-36', 'w-24 ml-auto', 'w-16 ml-auto', 'w-24 ml-auto', 'w-16 rounded-full h-6', 'w-8 h-8 rounded-lg ml-auto'],
        ['w-5', 'w-28', 'w-20', 'w-28', 'w-18 ml-auto', 'w-14 ml-auto', 'w-20 ml-auto', 'w-24 rounded-full h-6', 'w-8 h-8 rounded-lg ml-auto'],
        ['w-5', 'w-24', 'w-24', 'w-36', 'w-20 ml-auto', 'w-16 ml-auto', 'w-22 ml-auto', 'w-20 rounded-full h-6', 'w-8 h-8 rounded-lg ml-auto'],
        ['w-5', 'w-20', 'w-20', 'w-32', 'w-24 ml-auto', 'w-16 ml-auto', 'w-24 ml-auto', 'w-16 rounded-full h-6', 'w-8 h-8 rounded-lg ml-auto'],
        ['w-5', 'w-28', 'w-24', 'w-36', 'w-20 ml-auto', 'w-14 ml-auto', 'w-20 ml-auto', 'w-24 rounded-full h-6', 'w-8 h-8 rounded-lg ml-auto'],
    ];

    const displayCols = Math.min(Math.max(cols, 4), colHeaderWidths.length);

    return (
        <div role="status" aria-busy="true" aria-live="polite" className={cn("overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs", className)}>
            <span className="sr-only">Loading table data...</span>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200/90 bg-slate-50/75 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <tr>
                            {Array.from({ length: displayCols }).map((_, idx) => (
                                <th key={idx} className={cn("px-4 py-3.5", colHeaderWidths[idx] || "w-32")}>
                                    <Skeleton className={cn("h-3 rounded", idx === 0 ? "w-6" : (idx >= 4 && idx <= 6) ? "w-16 ml-auto" : idx === displayCols - 1 ? "w-8 ml-auto" : "w-16")} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: rows }).map((_, rowIdx) => {
                            const configs = rowCellConfigs[rowIdx % rowCellConfigs.length];
                            return (
                                <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                                    {Array.from({ length: displayCols }).map((_, colIdx) => (
                                        <td key={colIdx} className="px-4 py-3.5 align-middle">
                                            <Skeleton className={cn("h-3.5 rounded", configs[colIdx] || "w-24")} />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {showPagination && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-slate-150 px-4 py-3 bg-slate-50/40 gap-3">
                    <Skeleton className="h-3.5 w-44 rounded" />
                    <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                        <Skeleton className="h-8 w-16 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 w-16 rounded-lg" />
                    </div>
                </div>
            )}
        </div>
    );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div role="status" aria-busy="true" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading list items...</span>
            {Array.from({ length: rows }).map((_, idx) => (
                <CardSkeleton key={idx} />
            ))}
        </div>
    );
}

export function MetricCardSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-live="polite" className="flex items-start justify-between rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-2xs">
            <span className="sr-only">Loading metric data...</span>
            <div className="space-y-1.5 min-w-0 flex-1">
                <Skeleton className="h-2.5 w-16 rounded" />
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-2 w-24 rounded" />
            </div>
            <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl shrink-0" />
        </div>
    );
}

export function KpiSkeleton() {
    return <MetricCardSkeleton />;
}

export function ChartSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-4">
            <span className="sr-only">Loading chart data...</span>
            <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <div className="flex h-56 items-end gap-3">
                {[45, 70, 52, 88, 64, 78, 58].map((height, index) => (
                    <Skeleton key={index} className="flex-1 rounded-t-lg" style={{ height: `${height}%` }} />
                ))}
            </div>
        </div>
    );
}

export function FormSectionSkeleton({ fields = 6 }: { fields?: number }) {
    return (
        <div role="status" aria-busy="true" aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-4">
            <span className="sr-only">Loading form fields...</span>
            <Skeleton className="mb-4 h-4 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: fields }).map((_, index) => (
                    <div key={index} className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function PageSectionSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => <KpiSkeleton key={index} />)}
            </div>
            <CardSkeleton rows={4} />
            <TableSkeleton rows={5} cols={6} />
        </div>
    );
}

export function RequirementCardSkeleton() {
    return (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="mt-2 h-5 w-3/4" />
            <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
            </div>
        </article>
    );
}

export function RequirementTableRowSkeleton() {
    return (
        <tr className="border-b border-slate-100">
            <td className="px-4 py-3"><Skeleton className="h-3 w-8" /></td>
            <td className="px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1 h-3 w-16" />
            </td>
            <td className="px-4 py-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="mt-1 h-3 w-24" />
            </td>
            <td className="px-4 py-3"><Skeleton className="h-6 w-24 rounded-md" /></td>
            <td className="px-4 py-3"><Skeleton className="h-6 w-20 rounded-md" /></td>
            <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-24" /></td>
            <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
            <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
            <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-16 rounded-md" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                </div>
            </td>
        </tr>
    );
}

export function RequirementsGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: count }).map((_, idx) => (
                <RequirementCardSkeleton key={idx} />
            ))}
        </div>
    );
}

export function RequirementsTableSkeleton({ rows = 10 }: { rows?: number }) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="overflow-x-auto">
                <div className="overflow-x-auto w-full rounded-xl border border-slate-200 bg-white mb-6 shadow-sm">
<table data-ux-wrapped="true" className="w-full min-w-[920px] text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <tr>
                            <th className="px-4 py-2.5 text-left w-12">#</th>
                            <th className="px-4 py-2.5 text-left w-40">Requirement ID</th>
                            <th className="px-4 py-2.5 text-left">Title</th>
                            <th className="px-4 py-2.5 text-left w-32">Method</th>
                            <th className="px-4 py-2.5 text-left w-32">Status</th>
                            <th className="px-4 py-2.5 text-right w-32">Estimated Value</th>
                            <th className="px-4 py-2.5 text-left w-44">Required By</th>
                            <th className="px-4 py-2.5 text-left w-44">Updated</th>
                            <th className="px-4 py-2.5 text-right w-44">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: rows }).map((_, idx) => (
                            <RequirementTableRowSkeleton key={idx} />
                        ))}
                    </tbody>
                </table>
</div>
            </div>
        </div>
    );
}

export function ProductDetailSkeleton({ useDashboardShell = false }: { useDashboardShell?: boolean }) {
    return (
        <div className={useDashboardShell ? "min-h-full bg-white p-6 max-w-7xl mx-auto space-y-6" : "min-h-dvh bg-white flex flex-col p-6 max-w-7xl mx-auto space-y-6"}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <Skeleton className="h-96 w-full rounded-2xl" />
                    <div className="flex gap-3">
                        <Skeleton className="h-16 w-16 rounded-xl" />
                        <Skeleton className="h-16 w-16 rounded-xl" />
                        <Skeleton className="h-16 w-16 rounded-xl" />
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-8 w-3/4 rounded" />
                    <Skeleton className="h-10 w-48 rounded" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}

export function ServiceDetailSkeleton({ useDashboardShell = false }: { useDashboardShell?: boolean }) {
    return <ProductDetailSkeleton useDashboardShell={useDashboardShell} />;
}

export function MarketplaceHomeSkeleton() {
    return (
        <div className="min-h-dvh bg-[#f8fafc] text-slate-900 pb-20">
            {/* Hero Banner Skeleton */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
                <Skeleton className="w-full h-72 sm:h-96 rounded-3xl" />
            </div>

            {/* Category Pills Skeleton */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
                <div className="flex items-center gap-3 overflow-x-hidden">
                    {Array.from({ length: 8 }).map((_, idx) => (
                        <Skeleton key={idx} className="h-10 w-28 rounded-full shrink-0" />
                    ))}
                </div>
            </div>

            {/* Featured Grid Skeleton */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-10 space-y-8">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <Skeleton className="h-6 w-48 rounded" />
                        <Skeleton className="h-4 w-20 rounded" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                <Skeleton className="h-44 w-full rounded-xl" />
                                <Skeleton className="h-4 w-3/4 rounded" />
                                <Skeleton className="h-3 w-1/2 rounded" />
                                <div className="flex justify-between items-center pt-2">
                                    <Skeleton className="h-5 w-20 rounded" />
                                    <Skeleton className="h-8 w-20 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4">
                        <Skeleton className="h-6 w-56 rounded" />
                        <Skeleton className="h-4 w-20 rounded" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-3/4 rounded" />
                                        <Skeleton className="h-3 w-1/2 rounded" />
                                    </div>
                                </div>
                                <Skeleton className="h-16 w-full rounded-lg" />
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <Skeleton className="h-4 w-24 rounded" />
                                    <Skeleton className="h-8 w-28 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function BuyerRequirementDetailSkeleton() {
    return (
        <div className="flex min-h-dvh flex-col bg-white">
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
                <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                        <Skeleton className="h-3 w-32 rounded" />
                        <Skeleton className="h-8 w-3/4 rounded" />
                        <div className="flex gap-3">
                            <Skeleton className="h-4 w-28 rounded" />
                            <Skeleton className="h-4 w-28 rounded" />
                        </div>
                        <Skeleton className="h-40 w-full rounded-lg mt-4" />
                        <Skeleton className="h-28 w-full rounded-lg" />
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                            <Skeleton className="h-4 w-28 rounded" />
                            <Skeleton className="h-12 w-full rounded-lg" />
                            <Skeleton className="h-10 w-full rounded-lg" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export function PageTableSkeleton({
    kpiCount = 4,
    showToolbar = true,
    showPagination = true,
    rows = 6,
    cols = 8,
    title,
    subtitle,
    className
}: {
    kpiCount?: number;
    showToolbar?: boolean;
    showPagination?: boolean;
    rows?: number;
    cols?: number;
    title?: string;
    subtitle?: string;
    className?: string;
}) {
    return (
        <div className={cn("space-y-6 animate-in fade-in duration-200", className)}>
            {/* Page Header */}
            <div className="flex flex-col gap-2 py-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    {title ? (
                        <>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
                            {subtitle && <p className="text-xs font-semibold text-slate-500 mt-1">{subtitle}</p>}
                        </>
                    ) : (
                        <div className="space-y-1.5">
                            <Skeleton className="h-8 w-44 rounded-xl" />
                            <Skeleton className="hidden sm:block h-3.5 w-64 rounded" />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-36 rounded-lg shadow-2xs" />
                    <Skeleton className="h-10 w-24 rounded-lg shadow-2xs" />
                </div>
            </div>

            {/* KPI Metric Cards Grid */}
            {kpiCount > 0 && (
                <div className={cn(
                    "grid gap-2.5 sm:gap-3",
                    kpiCount >= 6 ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" :
                    kpiCount === 5 ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" :
                    "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"
                )}>
                    {Array.from({ length: kpiCount }).map((_, i) => (
                        <div
                            key={i}
                            className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-2xs"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1.5 min-w-0 flex-1">
                                    <Skeleton className="h-2.5 w-16 rounded" />
                                    <Skeleton className={cn(
                                        "h-6 rounded-md",
                                        i === 0 ? "w-14" : i === 1 ? "w-10" : i === 2 ? "w-12" : i === 3 ? "w-28" : "w-10"
                                    )} />
                                    <Skeleton className="h-2 w-20 rounded" />
                                </div>
                                <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl shrink-0" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Search & Filter Toolbar Skeleton */}
            {showToolbar && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-sm">
                    <div className="flex items-center flex-nowrap gap-2 sm:gap-2.5 w-full min-w-0 overflow-hidden">
                        <Skeleton className="h-10 min-w-[170px] sm:min-w-[190px] max-w-[240px] xl:max-w-[270px] flex-1 shrink-0 rounded-xl" />
                        <Skeleton className="h-10 w-24 sm:w-28 rounded-xl shrink-0" />
                        <Skeleton className="h-10 w-24 sm:w-28 rounded-xl shrink-0" />
                        <Skeleton className="h-10 w-24 sm:w-28 rounded-xl shrink-0" />
                        <Skeleton className="hidden md:block h-10 w-24 sm:w-28 rounded-xl shrink-0" />
                        <Skeleton className="hidden lg:block h-10 w-24 sm:w-28 rounded-xl shrink-0" />
                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                            <Skeleton className="h-9 w-16 rounded-xl" />
                        </div>
                    </div>
                </div>
            )}

            {/* Table Skeleton */}
            <TableSkeleton rows={rows} cols={cols} showPagination={showPagination} />
        </div>
    );
}

export function GridCardSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48 rounded-md" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: count }).map((_, idx) => (
                    <CardSkeleton key={idx} rows={4} />
                ))}
            </div>
        </div>
    );
}

export function ProfileSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-6">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48 rounded-md" />
                    <Skeleton className="h-4 w-32 rounded" />
                </div>
            </div>
            <FormSectionSkeleton fields={4} />
            <FormSectionSkeleton fields={4} />
        </div>
    );
}

export function BuyerShowcaseFormSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-200" role="status" aria-busy="true" aria-label="Loading showcase profile form">
            <Skeleton className="h-5 w-56 rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                    'w-36', // Organization Name *
                    'w-36', // Department Name *
                    'w-40', // Type of Organisation *
                    'w-36', // Registration Number
                    'w-28', // GST Number
                    'w-28', // PAN Number
                    'w-20', // City
                    'w-20', // State
                    'w-24', // Pincode
                    'w-28', // Official Email
                    'w-28', // Official Phone
                    'w-28', // Website URL
                ].map((labelWidth, idx) => (
                    <div key={idx} className="space-y-2">
                        <Skeleton className={cn("h-3 rounded", labelWidth)} />
                        <Skeleton className="h-11 w-full rounded-xl" />
                    </div>
                ))}
            </div>

            <div className="border-t border-slate-100 pt-6 mt-6 space-y-4">
                <Skeleton className="h-4 w-52 rounded-md" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-40 rounded" />
                        <Skeleton className="h-11 w-full rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-40 rounded" />
                        <Skeleton className="h-11 w-full rounded-xl" />
                    </div>
                </div>
            </div>

            <div className="pt-6 flex justify-end">
                <Skeleton className="h-14 w-56 rounded-2xl" />
            </div>
        </div>
    );
}

export function BuyerProfileSkeleton() {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-label="Loading buyer profile"
            className="flex flex-col lg:flex-row min-h-screen bg-slate-50 animate-in fade-in duration-200"
        >
            <span className="sr-only">Loading buyer settings and profile details...</span>

            {/* Mobile/Tablet Horizontal Tabs Skeleton */}
            <div className="lg:hidden w-full bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
                <div className="flex flex-row overflow-x-auto no-scrollbar px-4 py-3 gap-2 whitespace-nowrap">
                    <Skeleton className="h-9 w-44 rounded-full shrink-0" />
                    <Skeleton className="h-9 w-36 rounded-full shrink-0" />
                    <Skeleton className="h-9 w-36 rounded-full shrink-0" />
                    <Skeleton className="h-9 w-28 rounded-full shrink-0" />
                    <Skeleton className="h-9 w-28 rounded-full shrink-0" />
                </div>
            </div>

            {/* Desktop Vertical Persistent Sidebar Skeleton */}
            <div className="hidden lg:block w-72 flex-shrink-0 bg-white border-r border-gray-200 min-h-screen shadow-xs overflow-y-auto py-6">
                <div className="px-6 mb-4">
                    <Skeleton className="h-3 w-28 rounded" />
                </div>
                <div className="space-y-1">
                    {/* Active item: Organization Showcase Profile */}
                    <div className="flex w-full items-center gap-3 px-8 py-3.5 border-l-4 border-blue-600 bg-slate-50/50">
                        <Skeleton className="h-4 w-4 rounded shrink-0" />
                        <Skeleton className="h-4 w-44 rounded" />
                    </div>
                    {/* Remaining 6 items */}
                    {[
                        'w-36', // Organisation Address
                        'w-36', // Delivery Addresses
                        'w-28', // Update Mobile
                        'w-24', // Change Email
                        'w-32', // Change Password
                        'w-36', // Deactivate Account
                    ].map((width, idx) => (
                        <div key={idx} className="flex w-full items-center gap-3 px-8 py-3.5 border-l-4 border-transparent">
                            <Skeleton className="h-4 w-4 rounded shrink-0" />
                            <Skeleton className={cn("h-4 rounded", width)} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area Skeleton */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Skeleton className="h-2.5 w-24 rounded mb-2" />
                        <Skeleton className="h-8 w-64 rounded-lg" />
                    </div>
                    {/* User profile badge */}
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs self-start sm:self-auto">
                        <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                        <div className="pr-3 space-y-1.5">
                            <Skeleton className="h-3 w-28 rounded" />
                            <Skeleton className="h-2.5 w-20 rounded" />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden bg-white">
                    <div className="p-5 sm:p-6 md:p-8 space-y-6">
                        {/* Showcase Sub-tabs */}
                        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-2 mb-6">
                            <div className="px-4 py-2.5 border-b-2 border-[#12335f]">
                                <Skeleton className="h-3.5 w-36 rounded" />
                            </div>
                            <div className="px-4 py-2.5 border-b-2 border-transparent">
                                <Skeleton className="h-3.5 w-28 rounded" />
                            </div>
                            <div className="px-4 py-2.5 border-b-2 border-transparent">
                                <Skeleton className="h-3.5 w-40 rounded" />
                            </div>
                        </div>

                        {/* Form Details */}
                        <BuyerShowcaseFormSkeleton />
                    </div>
                </div>
            </main>
        </div>
    );
}

export function SettingsSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl mx-auto p-4 sm:p-6">
            <Skeleton className="h-8 w-64 rounded-md mb-6" />
            <FormSectionSkeleton fields={3} />
            <FormSectionSkeleton fields={2} />
            <FormSectionSkeleton fields={4} />
        </div>
    );
}

export function AddressCardSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48 rounded-md" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: count }).map((_, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                        <Skeleton className="h-5 w-3/4 rounded" />
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-4 w-2/3 rounded" />
                        <div className="pt-3 border-t border-slate-100 flex gap-2">
                            <Skeleton className="h-8 w-16 rounded" />
                            <Skeleton className="h-8 w-16 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CheckoutSkeleton() {
    return (
        <div className="min-h-dvh bg-slate-50 flex flex-col">
            <div className="bg-white border-b border-slate-200 p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Skeleton className="h-8 w-32 rounded" />
                    <Skeleton className="h-8 w-64 rounded hidden sm:block" />
                    <Skeleton className="h-8 w-24 rounded" />
                </div>
            </div>
            <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-6">
                        <Skeleton className="h-10 w-48 rounded-lg mb-4" />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4">
                                <Skeleton className="h-24 w-24 rounded-lg shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-3/4 rounded" />
                                    <Skeleton className="h-4 w-1/4 rounded" />
                                    <div className="pt-2 flex justify-between">
                                        <Skeleton className="h-6 w-20 rounded" />
                                        <Skeleton className="h-6 w-24 rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="lg:col-span-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 sticky top-6">
                            <Skeleton className="h-6 w-32 rounded" />
                            <div className="space-y-3">
                                <div className="flex justify-between"><Skeleton className="h-4 w-20 rounded" /><Skeleton className="h-4 w-16 rounded" /></div>
                                <div className="flex justify-between"><Skeleton className="h-4 w-24 rounded" /><Skeleton className="h-4 w-16 rounded" /></div>
                                <div className="flex justify-between pt-3 border-t border-slate-100"><Skeleton className="h-5 w-16 rounded" /><Skeleton className="h-5 w-24 rounded" /></div>
                            </div>
                            <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ComparisonMatrixSkeleton({ suppliers = 3 }: { suppliers?: number }) {
    return (
        <div className="space-y-6 animate-in fade-in duration-200 p-6 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Skeleton className="h-8 w-64 rounded-md mb-2" />
                    <Skeleton className="h-4 w-48 rounded" />
                </div>
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
            
            <div className="overflow-x-auto">
                <div className="min-w-[800px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header Row */}
                    <div className="flex border-b border-slate-200 bg-slate-50">
                        <div className="w-64 p-4 shrink-0 border-r border-slate-200 flex flex-col justify-end">
                            <Skeleton className="h-5 w-32 rounded" />
                        </div>
                        {Array.from({ length: suppliers }).map((_, i) => (
                            <div key={i} className="flex-1 p-4 min-w-[250px] border-r border-slate-200 last:border-0 text-center">
                                <Skeleton className="h-16 w-16 rounded-full mx-auto mb-3" />
                                <Skeleton className="h-6 w-3/4 mx-auto rounded mb-2" />
                                <Skeleton className="h-4 w-1/2 mx-auto rounded" />
                            </div>
                        ))}
                    </div>
                    
                    {/* Data Rows */}
                    {Array.from({ length: 5 }).map((_, rowIdx) => (
                        <div key={rowIdx} className="flex border-b border-slate-100 last:border-0">
                            <div className="w-64 p-4 shrink-0 border-r border-slate-200 bg-slate-50 font-medium">
                                <Skeleton className="h-4 w-3/4 rounded" />
                            </div>
                            {Array.from({ length: suppliers }).map((_, colIdx) => (
                                <div key={colIdx} className="flex-1 p-4 min-w-[250px] border-r border-slate-200 last:border-0 flex items-center justify-center">
                                    <Skeleton className="h-4 w-1/2 rounded" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function StorefrontSkeleton() {
    return (
        <div className="min-h-dvh bg-slate-50">
            <div className="h-48 md:h-64 bg-slate-200 animate-pulse w-full relative">
                <div className="absolute -bottom-12 left-8">
                    <Skeleton className="h-24 w-24 rounded-2xl border-4 border-white shadow-sm" />
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64 rounded-md" />
                        <Skeleton className="h-4 w-48 rounded" />
                        <div className="flex gap-2 pt-2">
                            <Skeleton className="h-6 w-20 rounded-full" />
                            <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                    </div>
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>
                
                <div className="border-b border-slate-200 pb-2">
                    <div className="flex gap-6">
                        <Skeleton className="h-6 w-20 rounded" />
                        <Skeleton className="h-6 w-24 rounded" />
                        <Skeleton className="h-6 w-28 rounded" />
                    </div>
                </div>
                
                <GridCardSkeleton count={6} />
            </div>
        </div>
    );
}

export function ResultsSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            <div className="space-y-2 text-center">
                <Skeleton className="h-8 w-64 mx-auto rounded-md" />
                <Skeleton className="h-4 w-48 mx-auto rounded" />
            </div>
            
            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
                <div className="md:mt-8">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center">
                        <Skeleton className="h-16 w-16 rounded-full mb-4" />
                        <Skeleton className="h-6 w-3/4 rounded mb-2" />
                        <Skeleton className="h-8 w-1/2 rounded font-bold" />
                    </div>
                </div>
                <div className="md:-mt-4">
                    <div className="bg-white rounded-2xl border-2 border-amber-400 p-8 flex flex-col items-center text-center shadow-lg relative transform scale-105">
                        <Skeleton className="h-20 w-20 rounded-full mb-4" />
                        <Skeleton className="h-6 w-3/4 rounded mb-2" />
                        <Skeleton className="h-10 w-1/2 rounded font-bold" />
                    </div>
                </div>
                <div className="md:mt-12">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center">
                        <Skeleton className="h-16 w-16 rounded-full mb-4" />
                        <Skeleton className="h-6 w-3/4 rounded mb-2" />
                        <Skeleton className="h-8 w-1/2 rounded font-bold" />
                    </div>
                </div>
            </div>
            
            <div className="max-w-6xl mx-auto mt-12">
                <Skeleton className="h-6 w-48 rounded mb-4" />
                <TableSkeleton rows={8} cols={6} />
            </div>
        </div>
    );
}

export function ProcurementDetailSkeleton({ procurementTypeLabel = 'Procurement Opportunity' }: { procurementTypeLabel?: string }) {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            aria-label={`Loading ${procurementTypeLabel} details`}
            className="min-h-screen bg-slate-50"
        >
            <span className="sr-only">Loading {procurementTypeLabel} details...</span>
            <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 sm:px-6 lg:px-8">
                {/* Navigation Breadcrumb & Back Button Skeleton */}
                <div className="flex flex-wrap items-center gap-3">
                    <Skeleton className="h-8 w-20 rounded-lg" />
                    <Skeleton className="h-4 w-36 rounded" />
                </div>

                {/* Header Skeleton */}
                <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-2.5">
                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Skeleton className="h-5 w-20 rounded-full" />
                                <Skeleton className="h-5 w-32 rounded-full" />
                                <Skeleton className="h-5 w-28 rounded-full" />
                            </div>
                            {/* Title */}
                            <Skeleton className="h-6 w-3/4 max-w-lg rounded-md" />
                            {/* Subtitle / Metadata */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <Skeleton className="h-4 w-24 rounded" />
                                <span className="text-slate-300">•</span>
                                <Skeleton className="h-4 w-20 rounded" />
                                <span className="text-slate-300">•</span>
                                <Skeleton className="h-4 w-28 rounded" />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:self-center">
                            <Skeleton className="h-8 w-24 rounded-lg" />
                            <Skeleton className="h-8 w-32 rounded-lg" />
                        </div>
                    </div>
                </header>

                {/* 6 KPI Cards Grid */}
                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-2.5 w-16 rounded" />
                                <Skeleton className="h-6 w-6 rounded-md" />
                            </div>
                            <Skeleton className="h-5 w-24 rounded" />
                            <Skeleton className="h-2.5 w-20 rounded" />
                        </div>
                    ))}
                </section>

                {/* Tab Navigation Bar Skeleton */}
                <nav className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                    {['Overview', 'Scope & Docs', 'Terms & Criteria', 'Bid Submission', 'Clarifications'].map((_, idx) => (
                        <Skeleton
                            key={idx}
                            className={cn('h-7 rounded-lg shrink-0', idx === 0 ? 'w-28 bg-slate-900/15' : 'w-24')}
                        />
                    ))}
                </nav>

                {/* 2-Column Info Cards Skeleton */}
                <div className="grid gap-5 lg:grid-cols-2">
                    {/* Card 1: Procurement Information */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Skeleton className="h-5 w-5 rounded" />
                            <Skeleton className="h-4 w-44 rounded" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 6 }).map((_, idx) => (
                                <div key={idx} className="space-y-1.5">
                                    <Skeleton className="h-2.5 w-20 rounded" />
                                    <Skeleton className="h-4 w-28 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card 2: Buyer Profile */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Skeleton className="h-5 w-5 rounded" />
                            <Skeleton className="h-4 w-36 rounded" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 6 }).map((_, idx) => (
                                <div key={idx} className="space-y-1.5">
                                    <Skeleton className="h-2.5 w-20 rounded" />
                                    <Skeleton className="h-4 w-32 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Timeline Ribbon Skeleton */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <Skeleton className="h-2.5 w-14 rounded" />
                                    <Skeleton className="h-3.5 w-20 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Clarification Threads / Secondary Status Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="space-y-1.5">
                                <Skeleton className="h-2.5 w-24 rounded" />
                                <Skeleton className="h-4 w-28 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function GrnDetailSkeleton() {
    return (
        <div className="space-y-4 max-w-7xl mx-auto w-full px-2.5 sm:px-4 pb-8 animate-in fade-in duration-150">
            {/* Header Skeleton */}
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <Skeleton className="h-3 w-3 rounded" />
                        <Skeleton className="h-3 w-20 rounded" />
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Skeleton className="h-7 w-48 rounded-md" />
                        <Skeleton className="h-5 w-20 rounded-md" />
                    </div>
                    <Skeleton className="h-3.5 w-64 rounded" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Skeleton className="h-9 w-28 rounded-lg" />
                    <Skeleton className="h-9 w-36 rounded-lg" />
                </div>
            </div>

            {/* Linked PO Summary Card Skeleton */}
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-2.5 w-32 rounded" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-6 w-28 rounded-md" />
                            <Skeleton className="h-5 w-20 rounded" />
                        </div>
                        <Skeleton className="h-4 w-52 rounded" />
                        <Skeleton className="h-3 w-40 rounded" />
                    </div>
                    <div className="sm:text-right border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 space-y-1.5">
                        <Skeleton className="h-2.5 w-16 sm:ml-auto rounded" />
                        <Skeleton className="h-6 w-28 sm:ml-auto rounded-md" />
                    </div>
                </div>
            </div>

            {/* 3-way Match Metrics (3 cards) */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-xs", i === 2 && "col-span-2 sm:col-span-1")}>
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-2.5 w-20 rounded" />
                            <Skeleton className="h-6 w-6 rounded-lg" />
                        </div>
                        <Skeleton className="mt-3 h-7 w-16 rounded" />
                    </div>
                ))}
            </div>

            {/* Items Table Card Skeleton */}
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center justify-between">
                    <Skeleton className="h-3.5 w-24 rounded" />
                    <Skeleton className="h-3 w-16 rounded" />
                </div>
                <div className="divide-y divide-slate-100">
                    <div className="bg-slate-50/40 px-4 py-2.5 hidden sm:grid sm:grid-cols-6 gap-3">
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-3 w-14 ml-auto rounded" />
                        <Skeleton className="h-3 w-14 ml-auto rounded" />
                        <Skeleton className="h-3 w-14 ml-auto rounded" />
                        <Skeleton className="h-3 w-14 ml-auto rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                    </div>
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="px-4 py-3 flex flex-col sm:grid sm:grid-cols-6 gap-3 items-start sm:items-center">
                            <div className="space-y-1">
                                <Skeleton className="h-3.5 w-32 rounded" />
                                <Skeleton className="h-2.5 w-12 rounded" />
                            </div>
                            <Skeleton className="h-3.5 w-10 sm:ml-auto rounded" />
                            <Skeleton className="h-3.5 w-10 sm:ml-auto rounded" />
                            <Skeleton className="h-3.5 w-10 sm:ml-auto rounded" />
                            <Skeleton className="h-3.5 w-10 sm:ml-auto rounded" />
                            <Skeleton className="h-3.5 w-24 rounded" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Remarks / Inspection Card Skeleton */}
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-24 rounded" />
                    <Skeleton className="h-3.5 w-3/4 rounded" />
                </div>
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <Skeleton className="h-2.5 w-28 rounded" />
                    <Skeleton className="h-3.5 w-1/2 rounded" />
                </div>
            </div>

            {/* Documents Card Skeleton */}
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <Skeleton className="h-3 w-28 rounded" />
                <div className="grid gap-2 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                            <Skeleton className="h-5 w-5 rounded shrink-0" />
                            <div className="flex-1 space-y-1">
                                <Skeleton className="h-3.5 w-36 rounded" />
                                <Skeleton className="h-2.5 w-24 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


