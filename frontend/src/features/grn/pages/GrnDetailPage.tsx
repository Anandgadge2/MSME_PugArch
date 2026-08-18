/**
 * GrnDetailPage — full GRN view with submit/approve/reject actions and document attachments.
 *
 * Route: /grn/:id
 */
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, FileText, Package, Send, ShieldCheck, X, XCircle } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { usePermissions } from '../../../hooks/useOrgRole';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDateTime, formatRelative } from '../../shared/format';
import { KpiCard } from '../../shared/KpiCard';
import { runWithToast } from '../../../lib/toast';
import { useApproveGrn, useGrn, useRejectGrn, useSubmitGrn } from '../hooks';
import type { GrnStatus } from '../api';

const STATUS_TONE: Record<GrnStatus, string> = {
    DRAFT: 'border-slate-200 bg-slate-50 text-slate-600',
    SUBMITTED: 'border-amber-200 bg-amber-50 text-amber-700',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REJECTED: 'border-red-200 bg-red-50 text-red-700',
    PARTIAL: 'border-blue-200 bg-blue-50 text-blue-700'
};

interface Props {
    id: number;
}

export default function GrnDetailPage({ id }: Props) {
    const router = useRouter();
    const { hasPermission } = usePermissions();
    const canViewGrn = hasPermission('grn.view');
    const canCreateGrn = hasPermission('grn.create');
    const canApproveGrn = hasPermission('grn.approve');
    const { data: grn, isLoading, error, refetch } = useGrn(id, { enabled: canViewGrn });
    const submitMut = useSubmitGrn();
    const approveMut = useApproveGrn();
    const rejectMut = useRejectGrn();
    const [showReject, setShowReject] = useState(false);

    if (!canViewGrn) return <InlineError message="You do not have permission to view this goods receipt note." />;
    if (isLoading) return <LoadingState label="Loading GRN..." />;
    if (error) return <InlineError message={(error as Error).message} onRetry={() => refetch()} />;
    if (!grn) return <InlineError message="GRN not found" />;

    const canSubmit = grn.status === 'DRAFT' && canCreateGrn;
    const canApprove = grn.status === 'SUBMITTED' && canApproveGrn;

    const totalReceived = grn.items.reduce((s, i) => s + Number(i.receivedQty), 0);
    const totalAccepted = grn.items.reduce((s, i) => s + Number(i.acceptedQty), 0);
    const totalRejected = grn.items.reduce((s, i) => s + Number(i.rejectedQty), 0);

    return (
        <div className="space-y-3.5 sm:space-y-4 max-w-7xl mx-auto w-full px-2.5 sm:px-4 pb-8">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3.5 sm:pb-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 flex-1">
                    <button onClick={() => router.push('/grn')} className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-[#12335f] hover:underline cursor-pointer">
                        <ArrowLeft className="mr-1 h-3 w-3" /> All GRNs
                    </button>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-950 break-words">{grn.grnNumber}</h1>
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase ${STATUS_TONE[grn.status]}`}>
                            {grn.status}
                        </span>
                    </div>
                    <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-semibold text-slate-500 break-words">
                        Received by {grn.receivedBy.name} · {formatDateTime(grn.receivedAt)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canSubmit && (
                        <Button
                            onClick={async () => {
                                await runWithToast(() => submitMut.mutateAsync(grn.id), {
                                    loading: 'Submitting...', success: 'GRN submitted', error: 'Submit failed'
                                });
                            }}
                            disabled={submitMut.isPending}
                            className="bg-[#12335f] text-white hover:bg-[#0e2a4f] h-9 sm:h-10 text-xs font-bold w-full sm:w-auto"
                        >
                            {submitMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Submit for Approval
                        </Button>
                    )}
                    {canApprove && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setShowReject(true)}
                                className="border-red-200 text-red-700 hover:bg-red-50 h-9 sm:h-10 text-xs font-bold flex-1 sm:flex-initial"
                            >
                                <XCircle className="mr-2 h-4 w-4" /> Reject
                            </Button>
                            <Button
                                onClick={async () => {
                                    await runWithToast(() => approveMut.mutateAsync({ id: grn.id }), {
                                        loading: 'Approving...', success: 'GRN approved', error: 'Approve failed'
                                    });
                                }}
                                disabled={approveMut.isPending}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 h-9 sm:h-10 text-xs font-bold flex-1 sm:flex-initial"
                            >
                                {approveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Approve
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Status banners */}
            {grn.status === 'APPROVED' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 break-words">
                    GRN approved {grn.approvedAt ? `(${formatRelative(grn.approvedAt)})` : ''}. The seller can now raise an invoice.
                </div>
            )}
            {grn.status === 'PARTIAL' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800 break-words">
                    Partial approval — some items were rejected. The seller has been notified of the discrepancy.
                </div>
            )}
            {grn.status === 'REJECTED' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800 break-words">
                    GRN rejected. Reason: {grn.rejectionReason}
                </div>
            )}

            {/* PO Summary */}
            {grn.purchaseOrder && (
                <Card className="border-slate-200/80 shadow-sm rounded-xl sm:rounded-2xl">
                    <CardContent className="p-3.5 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Linked Purchase Order</p>
                                <div className="mt-1 flex items-center gap-2">
                                    <EntityIdLink label={grn.purchaseOrder.poNumber} id={grn.purchaseOrder.id} size="sm" onClick={() => router.push('/buyer/orders')} />
                                </div>
                                <p className="mt-1 text-xs sm:text-sm font-black text-slate-900 break-words">{grn.purchaseOrder.title}</p>
                                <p className="text-[11px] sm:text-xs font-semibold text-slate-500 break-words">
                                    Seller: {grn.purchaseOrder.seller?.name}
                                </p>
                            </div>
                            <div className="sm:text-right border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">PO Value</p>
                                <p className="mt-0.5 sm:mt-1 text-sm sm:text-base font-black text-slate-950">{formatCurrency(grn.purchaseOrder.amount)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 3-way match panel */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                <KpiCard label="Received" value={totalReceived} icon={Package} tone="slate" />
                <KpiCard label="Accepted" value={totalAccepted} icon={CheckCircle2} tone="emerald" />
                <div className="col-span-2 sm:col-span-1">
                    <KpiCard label="Rejected" value={totalRejected} icon={XCircle} tone="red" />
                </div>
            </div>

            {/* Items table */}
            <Card className="border-slate-200/80 shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="border-b border-slate-100 bg-slate-50/60 px-3.5 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">Items ({grn.items.length})</p>
                    </div>
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-xs sm:text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/40 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                                <tr>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left">Item</th>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-right w-20 sm:w-24">Ordered</th>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-right w-20 sm:w-24">Received</th>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-right w-20 sm:w-24">Accepted</th>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-right w-20 sm:w-24">Rejected</th>
                                    <th className="px-3 py-2 sm:px-4 sm:py-2.5 text-left">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {grn.items.map(item => (
                                    <tr key={item.id || item.itemName}>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5">
                                            <p className="text-xs font-black text-slate-900 break-words">{item.itemName}</p>
                                            <p className="text-[9px] sm:text-[10px] text-slate-500">{item.unitOfMeasure}</p>
                                        </td>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-right font-mono text-xs">{Number(item.orderedQty)}</td>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-right font-mono text-xs">{Number(item.receivedQty)}</td>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-right font-mono text-xs text-emerald-700 font-bold">{Number(item.acceptedQty)}</td>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-right font-mono text-xs text-red-700 font-bold">{Number(item.rejectedQty)}</td>
                                        <td className="px-3 py-2 sm:px-4 sm:py-2.5 text-[11px] sm:text-xs text-slate-700 italic break-words">{item.rejectionReason || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Remarks & inspection */}
            {(grn.remarks || grn.inspectionNote) && (
                <Card className="border-slate-200/80 shadow-sm rounded-xl sm:rounded-2xl">
                    <CardContent className="p-3.5 sm:p-4 space-y-3">
                        {grn.remarks && (
                            <div>
                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Remarks</p>
                                <p className="mt-0.5 sm:mt-1 text-xs font-semibold text-slate-800 break-words">{grn.remarks}</p>
                            </div>
                        )}
                        {grn.inspectionNote && (
                            <div>
                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Inspection Note</p>
                                <p className="mt-0.5 sm:mt-1 text-xs font-semibold text-slate-800 break-words">{grn.inspectionNote}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Documents */}
            <Card className="border-slate-200/80 shadow-sm rounded-xl sm:rounded-2xl">
                <CardContent className="p-3.5 sm:p-4">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">Documents ({grn.documents.length})</p>
                    {grn.documents.length === 0 ? (
                        <p className="mt-1.5 sm:mt-2 text-xs text-slate-500">No documents attached. Upload delivery proof, e-way bills, or inspection photos.</p>
                    ) : (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {grn.documents.map(doc => (
                                <div key={doc.id} className="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-slate-200 bg-slate-50/40 p-2.5 sm:p-3">
                                    <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-900 break-words">{doc.fileAsset.originalName}</p>
                                        <p className="text-[9px] sm:text-[10px] text-slate-500 break-words">{doc.documentType} · by {doc.uploadedBy.name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {showReject && (
                <RejectModal
                    onClose={() => setShowReject(false)}
                    onSubmit={async (reason) => {
                        await runWithToast(
                            () => rejectMut.mutateAsync({ id: grn.id, reason }),
                            { loading: 'Rejecting...', success: 'GRN rejected', error: 'Reject failed' }
                        );
                        setShowReject(false);
                    }}
                    pending={rejectMut.isPending}
                />
            )}
        </div>
    );
}



function RejectModal({ onClose, onSubmit, pending }: { onClose: () => void; onSubmit: (r: string) => Promise<void>; pending: boolean }) {
    const [reason, setReason] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-red-700 to-red-800 px-5 py-4 text-white">
                    <h3 className="text-sm font-black uppercase tracking-widest">Reject GRN</h3>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rejection Reason</label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={4}
                            placeholder="Explain why this GRN is being rejected..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500/20"
                            maxLength={2000}
                        />
                        <p className="text-[10px] text-slate-400">Minimum 5 characters.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button
                            onClick={() => onSubmit(reason.trim())}
                            disabled={pending || reason.trim().length < 5}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                            Confirm Rejection
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
