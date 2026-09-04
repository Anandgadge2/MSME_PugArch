/**
 * ProcurementReportPage — method-wise procurement analytics.
 *
 * Route: /admin/reports/procurement
 */
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, TrendingDown, PieChart, Gavel } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from '@/components/ui/loader';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { InlineError } from '../../shared/FeatureStates';
import { getApi } from '../../shared/apiClient';
import { fetchMethodWiseReports } from '../../audit/api';

interface ProcurementStats {
    requirements: number;
    tenders: number;
    directPurchases: number;
    quoteRequests: number;
    purchaseOrders: number;
}

export default function ProcurementReportPage() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['admin', 'reports', 'procurement'] as const,
        queryFn: () => getApi<ProcurementStats>('/api/admin/reports/procurement')
    });

    const methodWise = useQuery({
        queryKey: ['admin', 'reports', 'procurement', 'method-wise'],
        queryFn: () => fetchMethodWiseReports(),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-950">Procurement Report</h1>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                        Method-wise procurement analytics across all organisations.
                    </p>
                </div>
                <Button variant="outline" onClick={() => { refetch(); methodWise.refetch(); }} className="h-10 rounded-lg text-xs font-black uppercase">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {error ? <InlineError message={(error as Error).message} onRetry={() => refetch()} /> :
                isLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#12335f]" /></div>
                ) : (
                    <>
                        {data && (
                            <div className="space-y-6">
                                {/* Procurement Value & Status */}
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                    <Card className="shadow-sm border-slate-200">
                                        <CardContent className="p-5 flex flex-col justify-center items-center h-[280px] text-slate-400">
                                            <TrendingDown className="h-8 w-8 mb-2 opacity-50 text-slate-300" />
                                            <p className="text-sm font-semibold">Insufficient data for selected period</p>
                                            <p className="text-[10px] uppercase tracking-widest mt-1">Procurement Value Trend</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="shadow-sm border-slate-200">
                                        <CardContent className="p-5 flex flex-col justify-center items-center h-[280px] text-slate-400">
                                            <PieChart className="h-8 w-8 mb-2 opacity-50 text-slate-300" />
                                            <p className="text-sm font-semibold">Insufficient data for selected period</p>
                                            <p className="text-[10px] uppercase tracking-widest mt-1">Procurement Status</p>
                                        </CardContent>
                                    </Card>
                                </div>
                                {/* Procurement Lifecycle & Tender Spend */}
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                    <Card className="shadow-sm border-slate-200">
                                        <CardContent className="p-5">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4">Procurement Lifecycle / Volume</h3>
                                            <div className="h-72 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={[
                                                        { name: 'Requirements', value: data.requirements },
                                                        { name: 'Quote Requests', value: data.quoteRequests },
                                                        { name: 'Tenders', value: data.tenders },
                                                        { name: 'Direct Purchases', value: data.directPurchases },
                                                        { name: 'Purchase Orders', value: data.purchaseOrders },
                                                    ]}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                                                        <Bar dataKey="value" name="Volume" fill="#12335f" radius={[4, 4, 0, 0]} barSize={40} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="shadow-sm border-slate-200">
                                        <CardContent className="p-5">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4">Tender Lifecycle / Spend</h3>
                                            {methodWise.data?.tenderComparison ? (
                                                <div className="h-72 w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={methodWise.data.tenderComparison}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                            <XAxis dataKey="label" tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                                            <YAxis tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${(val/10000000).toFixed(1)}Cr`} />
                                                            <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => `₹${val.toLocaleString('en-IN')}`} />
                                                            <Bar dataKey="totalSpend" name="Spend Value (₹)" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            ) : (
                                                <div className="flex justify-center items-center h-72 text-slate-400 text-sm font-semibold">
                                                    <Gavel className="h-5 w-5 mr-2 opacity-50" /> No tender value data available.
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}

                        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Interpretation</p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">
                                Reports show exact canonical procurement methods across all entities. Exception procurement (PAC, Single Source, Emergency) is flagged separately for audit compliance.
                            </p>
                        </div>
                    </>
                )
            }
        </div>
    );
}
