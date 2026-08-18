/**
 * SuppliersReportPage — sellers, products, services, ratings.
 *
 * Route: /admin/reports/suppliers
 */
import { useQuery } from '@tanstack/react-query';
import { Package, RefreshCw, Star, Store, Wrench } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { Button } from '../../../components/ui/button';
import { InlineError } from '../../shared/FeatureStates';
import { getApi } from '../../shared/apiClient';
import { KpiCard } from '../../shared/KpiCard';

interface SuppliersStats {
    sellers: number;
    products: number;
    services: number;
    ratings: number;
}

export default function SuppliersReportPage() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['admin', 'reports', 'suppliers'] as const,
        queryFn: () => getApi<SuppliersStats>('/api/admin/reports/suppliers')
    });

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between border-b border-slate-200 pb-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Admin · MIS</p>
                    <h1 className="text-2xl font-black text-slate-950">Suppliers Report</h1>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                        Seller registration depth, catalogue size, and rating activity.
                    </p>
                </div>
                <Button variant="outline" onClick={() => refetch()} className="h-10 rounded-lg text-xs font-black uppercase">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {error ? <InlineError message={(error as Error).message} onRetry={() => refetch()} /> :
                isLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#12335f]" /></div>
                ) : data ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <KpiCard label="Sellers" value={data.sellers} icon={Store} tone="emerald" />
                        <KpiCard label="Products" value={data.products} icon={Package} tone="blue" />
                        <KpiCard label="Services" value={data.services} icon={Wrench} tone="purple" />
                        <KpiCard label="Ratings" value={data.ratings} icon={Star} tone="amber" />
                    </div>
                ) : null
            }

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
