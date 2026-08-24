/**
 * PaymentsReportPage — payment & escrow stats.
 *
 * Route: /admin/reports/payments
 */
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, FileText, Landmark, RefreshCw } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { Button } from '../../../components/ui/button';
import { InlineError } from '../../shared/FeatureStates';
import { getApi } from '../../shared/apiClient';
import { KpiCard } from '../../shared/KpiCard';

interface PaymentsStats {
    invoices: number;
    payments: number;
    escrows: number;
    milestones: number;
}

export default function PaymentsReportPage() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['admin', 'reports', 'payments'] as const,
        queryFn: () => getApi<PaymentsStats>('/api/admin/reports/payments')
    });

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between border-b border-slate-200 pb-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Admin · MIS</p>
                    <h1 className="text-2xl font-black text-slate-950">Payments Report</h1>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                        Settlement, escrow custody, milestone, and invoice volume.
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
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 md:grid-cols-4">
                        <KpiCard label="Invoices" value={data.invoices} subtext="Registered invoice volume" icon={FileText} tone="amber" />
                        <KpiCard label="Payments" value={data.payments} subtext="Processed transactions" icon={CreditCard} tone="emerald" />
                        <KpiCard label="Escrow Accounts" value={data.escrows} subtext="Escrow custody accounts" icon={Landmark} tone="blue" />
                        <KpiCard label="Milestones" value={data.milestones} subtext="Completed milestone releases" icon={CheckCircle2} tone="purple" />
                    </div>
                ) : null
            }

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Compliance Insight</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">
                    The MSMED Act requires payment to MSME suppliers within 45 days. Track payment-vs-invoice ratio
                    in the Dashboard summary — anything below 0.95 indicates buyer payment delays.
                </p>
            </div>
        </div>
    );
}
