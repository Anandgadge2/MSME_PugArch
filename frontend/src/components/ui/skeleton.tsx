import { cn } from '../../lib/utils';
import type React from 'react';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-md bg-slate-100 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
                className
            )}
            {...props}
        />
    );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            {Array.from({ length: rows - 2 }).map((_, idx) => (
                <Skeleton key={idx} className="h-3 w-full" />
            ))}
        </div>
    );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50/60 p-3">
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {Array.from({ length: cols }).map((_, idx) => (
                        <Skeleton key={idx} className="h-3 w-full" />
                    ))}
                </div>
            </div>
            <div className="divide-y divide-slate-100">
                {Array.from({ length: rows }).map((_, idx) => (
                    <div key={idx} className="p-3">
                        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                            {Array.from({ length: cols }).map((__, cellIdx) => (
                                <Skeleton key={cellIdx} className="h-3 w-full" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, idx) => (
                <CardSkeleton key={idx} />
            ))}
        </div>
    );
}

export function MetricCardSkeleton() {
    return (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
    );
}

export function KpiSkeleton() {
    return <MetricCardSkeleton />;
}

export function ChartSkeleton() {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
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
        <div className="rounded-xl border border-slate-200 bg-white p-4">
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
                <table className="w-full min-w-[920px] text-sm">
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
