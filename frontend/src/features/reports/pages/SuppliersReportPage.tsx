/**
 * SuppliersReportPage — sellers, products, services, ratings.
 *
 * Route: /admin/reports/suppliers
 */
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Store, Package, Wrench, Star } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { Button } from '../../../components/ui/button';
import { InlineError } from '../../shared/FeatureStates';
import { getApi } from '../../shared/apiClient';
import { DataTable, ColumnDef } from '../../../components/ui/data-table';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList,
} from 'recharts';

interface SuppliersStats {
    sellers: number;
    products: number;
    services: number;
    ratings: number;
}

const METRIC_COLORS: Record<string, string> = {
    Sellers: '#10b981',
    Products: '#3b82f6',
    Services: '#8b5cf6',
    Ratings: '#f59e0b',
};

const METRIC_SUBTEXTS: Record<string, string> = {
    Sellers: 'Onboarded vendor base',
    Products: 'Active catalogue items',
    Services: 'Published service listings',
    Ratings: 'Submitted reviews',
};

interface CustomTooltipProps {
    active?: boolean;
    payload?: { value: number; name: string }[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    const color = METRIC_COLORS[label ?? ''] ?? '#64748b';
    const subtext = METRIC_SUBTEXTS[label ?? ''] ?? '';
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg text-xs">
            <p className="font-black uppercase tracking-wide mb-1" style={{ color }}>{label}</p>
            <p className="text-2xl font-black text-slate-900">{payload[0].value.toLocaleString('en-IN')}</p>
            <p className="text-slate-500 font-medium mt-0.5">{subtext}</p>
        </div>
    );
}

const MARKETPLACE_COLUMNS: ColumnDef<any>[] = [
    {
        key: 'name',
        header: 'Metric',
        width: 'w-[25%]',
        cell: (row: any) => {
            const Icon = row.icon;
            return (
                <div className="flex items-center gap-2">
                    <span
                        className="flex h-6 w-6 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${row.color}18` }}
                        aria-hidden="true"
                    >
                        <Icon className="h-3.5 w-3.5" style={{ color: row.color }} />
                    </span>
                    <span className="font-black" style={{ color: row.color }}>
                        {row.name}
                    </span>
                </div>
            );
        },
    },
    {
        key: 'value',
        header: 'Count',
        width: 'w-[20%]',
        align: 'right',
        cell: (row: any) => (
            <span className="font-black text-slate-900">{row.value.toLocaleString('en-IN')}</span>
        ),
    },
    {
        key: 'subtext',
        header: 'Description',
        width: 'w-[35%]',
        cell: (row: any) => <span className="font-semibold text-slate-500">{row.subtext}</span>,
    },
    {
        key: 'status',
        header: 'Status',
        width: 'w-[20%]',
        align: 'right',
        cell: () => (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Active
            </span>
        ),
    },
];

export default function SuppliersReportPage() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['admin', 'reports', 'suppliers'] as const,
        queryFn: () => getApi<SuppliersStats>('/api/admin/reports/suppliers')
    });

    const chartData = data
        ? [
            { name: 'Sellers',  value: data.sellers  },
            { name: 'Products', value: data.products },
            { name: 'Services', value: data.services },
            { name: 'Ratings',  value: data.ratings  },
          ]
        : [];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-end justify-between border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-950">Suppliers Report</h1>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                        Seller registration depth, catalogue size, and rating activity.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => refetch()}
                    className="h-10 rounded-lg text-xs font-black uppercase"
                    aria-label="Refresh suppliers report"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Chart / States */}
            {error ? (
                <InlineError message={(error as Error).message} onRetry={() => refetch()} />
            ) : isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#12335f]" />
                </div>
            ) : data ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Marketplace Metrics Overview
                    </p>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                            data={chartData}
                            margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
                            barCategoryGap="40%"
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                                dy={8}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                allowDecimals={false}
                                width={32}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 8 }} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={80}>
                                {chartData.map((entry) => (
                                    <Cell
                                        key={entry.name}
                                        fill={METRIC_COLORS[entry.name]}
                                        fillOpacity={0.9}
                                    />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    style={{ fontSize: 12, fontWeight: 800, fill: '#1e293b' }}
                                    formatter={(v: number) => v.toLocaleString('en-IN')}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap justify-center gap-4">
                        {chartData.map((entry) => (
                            <div key={entry.name} className="flex items-center gap-1.5">
                                <span
                                    className="inline-block h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: METRIC_COLORS[entry.name] }}
                                    aria-hidden="true"
                                />
                                <span className="text-[11px] font-semibold text-slate-600">{entry.name}</span>
                                <span className="text-[11px] font-black text-slate-900">
                                    {entry.value.toLocaleString('en-IN')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Summary Table */}
            {data && (
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Marketplace Summary
                    </p>
                    <DataTable<any>
                        data={[
                            { name: 'Sellers',  value: data.sellers,  subtext: 'Onboarded vendor base',        icon: Store,   color: '#10b981' },
                            { name: 'Products', value: data.products, subtext: 'Active catalogue items',        icon: Package, color: '#3b82f6' },
                            { name: 'Services', value: data.services, subtext: 'Published service listings',    icon: Wrench,  color: '#8b5cf6' },
                            { name: 'Ratings',  value: data.ratings,  subtext: 'Submitted reviews',             icon: Star,    color: '#f59e0b' },
                        ]}
                        columns={MARKETPLACE_COLUMNS}
                        keyExtractor={(row) => row.name}
                        showSrNo={false}
                    />
                </div>
            )}

            {/* Insight */}
            <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-700">Marketplace Health</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">
                    A healthy marketplace shows sellers with multiple products + services and active rating activity.
                    A low rating-to-PO ratio means buyers aren't reviewing — consider rating prompts post-delivery.
                </p>
            </div>
        </div>
    );
}
