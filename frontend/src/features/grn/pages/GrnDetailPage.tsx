/**
 * GrnDetailPage — full GRN view with submit/approve/reject actions,
 * interactive PO modal dialog, document attachments, and quality inspection details.
 *
 * Route: /grn/:id
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Download,
    ExternalLink,
    FileText,
    Package,
    Printer,
    Send,
    ShieldAlert,
    ShieldCheck,
    X,
    XCircle
} from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/useOrgRole';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { InlineError } from '../../shared/FeatureStates';
import { GrnDetailSkeleton } from '../../../components/ui/skeleton';
import { formatCurrency, formatDateTime } from '../../shared/format';
import { KpiCard } from '../../shared/KpiCard';
import { runWithToast, notify } from '../../../lib/toast';
import { useApproveGrn, useGrn, useRejectGrn, useSubmitGrn } from '../hooks';
import type { GrnStatus } from '../api';
import { DataTable } from '../../../components/ui/data-table';
import { PurchaseOrderReceiptModal } from '../../purchaseOrders/components/PurchaseOrderReceiptModal';

const STATUS_CONFIG: Record<GrnStatus, { label: string; tone: string; icon: typeof Clock }> = {
    DRAFT: {
        label: 'Draft',
        tone: 'border-slate-300 bg-slate-100 text-slate-700',
        icon: Clock
    },
    SUBMITTED: {
        label: 'Submitted for Review',
        tone: 'border-amber-300 bg-amber-50 text-amber-800',
        icon: Clock
    },
    APPROVED: {
        label: 'Approved',
        tone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
        icon: CheckCircle2
    },
    REJECTED: {
        label: 'Rejected',
        tone: 'border-rose-300 bg-rose-50 text-rose-800',
        icon: XCircle
    },
    PARTIAL: {
        label: 'Partially Accepted',
        tone: 'border-blue-300 bg-blue-50 text-blue-800',
        icon: AlertTriangle
    }
};

interface Props {
    id: number;
}

export default function GrnDetailPage({ id }: Props) {
    const router = useRouter();
    const { user } = useAuth();
    const { hasPermission } = usePermissions();
    const canViewGrn = hasPermission('grn.view');
    const canCreateGrn = hasPermission('grn.create');
    const canApproveGrn = hasPermission('grn.approve');
    const { data: grn, isLoading, error, refetch } = useGrn(id, { enabled: canViewGrn });
    const submitMut = useSubmitGrn();
    const approveMut = useApproveGrn();
    const rejectMut = useRejectGrn();
    const [showReject, setShowReject] = useState(false);
    const [showApprove, setShowApprove] = useState(false);
    const [copied, setCopied] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<any | null>(null);

    if (!canViewGrn) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <InlineError message="You do not have permission to view this Goods Receipt Note." />
            </div>
        );
    }

    if (isLoading) {
        return <GrnDetailSkeleton />;
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <InlineError message={(error as Error).message} onRetry={() => refetch()} />
            </div>
        );
    }

    if (!grn) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <InlineError message="Goods Receipt Note not found" />
            </div>
        );
    }

    const canSubmit = grn.status === 'DRAFT' && canCreateGrn;
    const canApprove = grn.status === 'SUBMITTED' && canApproveGrn;

    const totalOrdered = grn.items.reduce((s, i) => s + Number(i.orderedQty || 0), 0);
    const totalReceived = grn.items.reduce((s, i) => s + Number(i.receivedQty || 0), 0);
    const totalAccepted = grn.items.reduce((s, i) => s + Number(i.acceptedQty || 0), 0);
    const totalRejected = grn.items.reduce((s, i) => s + Number(i.rejectedQty || 0), 0);

    const hasDiscrepancy = totalRejected > 0;
    const hasDiscrepancyNotes = grn.items?.some(
        (item: any) => Boolean(item.rejectionReason && item.rejectionReason.trim())
    );
    const hasInspectionNote = Boolean(grn.inspectionNote && grn.inspectionNote.trim());
    const hasRemarks = Boolean(grn.remarks && grn.remarks.trim());
    const isFullMatch = totalReceived > 0 && totalRejected === 0 && totalReceived === totalAccepted;
    const statusMeta = STATUS_CONFIG[grn.status] || STATUS_CONFIG.DRAFT;
    const StatusIcon = statusMeta.icon;

    const handleCopyGrn = () => {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(grn.grnNumber);
            setCopied(true);
            notify.success('GRN number copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-4 max-w-7xl mx-auto w-full px-2.5 sm:px-4 pb-12 print:p-0 print:m-0 animate-in fade-in duration-200">
            {/* Navigation & Header */}
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between print:border-b-2">
                <div className="min-w-0 flex-1">
                    <button
                        onClick={() => router.push('/grn')}
                        className="inline-flex items-center text-[11px] font-black uppercase tracking-wider text-[#12335f] hover:text-[#0a1e38] transition-colors cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#12335f]/30 rounded px-1 -ml-1 print:hidden"
                        aria-label="Back to Goods Receipt Notes register"
                    >
                        <ArrowLeft className="mr-1 h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                        All Goods Receipt Notes
                    </button>
                    <div className="mt-1 flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight break-words">
                            {grn.grnNumber}
                        </h1>
                        <button
                            onClick={handleCopyGrn}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-300 print:hidden"
                            title="Copy GRN Number"
                            aria-label="Copy GRN Number"
                        >
                            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold uppercase shadow-2xs ${statusMeta.tone}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusMeta.label}
                        </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-600 break-words">
                        Received by <span className="font-semibold text-slate-900">{grn.receivedBy.name}</span> ({grn.receivedBy.email}) ·{' '}
                        <span>{formatDateTime(grn.receivedAt)}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                    <Button
                        variant="outline"
                        onClick={handlePrint}
                        className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9 sm:h-10 text-xs font-bold shadow-2xs gap-1.5"
                        title="Print GRN receipt"
                    >
                        <Printer className="h-3.5 w-3.5 text-slate-500" />
                        Print Summary
                    </Button>

                    {canSubmit && (
                        <Button
                            onClick={async () => {
                                await runWithToast(() => submitMut.mutateAsync(grn.id), {
                                    loading: 'Submitting GRN for review...',
                                    success: 'GRN submitted for verification',
                                    error: 'Submit failed'
                                });
                            }}
                            disabled={submitMut.isPending}
                            className="bg-[#12335f] text-white hover:bg-[#0e2a4f] h-9 sm:h-10 text-xs font-bold shadow-sm"
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
                                className="border-rose-200 text-rose-700 hover:bg-rose-50 h-9 sm:h-10 text-xs font-bold shadow-2xs"
                            >
                                <XCircle className="mr-1.5 h-4 w-4 text-rose-600" />
                                Reject
                            </Button>
                            <Button
                                onClick={() => setShowApprove(true)}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 h-9 sm:h-10 text-xs font-bold shadow-sm"
                            >
                                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                Approve
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Status Banners */}
            {grn.status === 'APPROVED' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs font-medium text-emerald-900 flex items-start gap-2.5 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold">Goods Receipt Note Approved</span>
                        {grn.approvedAt ? ` on ${formatDateTime(grn.approvedAt)}` : ''}.
                        All received goods have passed inspection. The vendor is authorized to raise the final invoice against this GRN.
                    </div>
                </div>
            )}
            {grn.status === 'PARTIAL' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-3.5 text-xs font-medium text-blue-900 flex items-start gap-2.5 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold">Partial Receipt Approved</span>. Discrepancies were identified during quality inspection. The vendor has been formally notified with the line item rejection notes.
                    </div>
                </div>
            )}
            {grn.status === 'REJECTED' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs font-medium text-rose-900 flex items-start gap-2.5 shadow-2xs">
                    <ShieldAlert className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold">Goods Receipt Note Rejected</span>: {grn.rejectionReason || 'Inspection requirements not met'}.
                    </div>
                </div>
            )}

            {/* Lifecycle Stepper / Timeline */}
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Lifecycle & Verification Flow</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-black text-xs">
                            ✓
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">1. Goods Received</p>
                            <p className="text-[11px] text-slate-500 truncate">By {grn.receivedBy?.name || 'Store Officer'}</p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{formatDateTime(grn.receivedAt || grn.createdAt)}</p>
                        </div>
                    </div>

                    <div className={`flex items-start gap-3 rounded-xl border p-3 ${grn.status !== 'DRAFT' ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/60'}`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-black text-xs ${grn.status !== 'DRAFT' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {grn.status !== 'DRAFT' ? '✓' : '2'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">2. Submitted for Review</p>
                            <p className="text-[11px] text-slate-500 truncate">
                                {grn.status === 'DRAFT' ? 'Draft pending submission' : 'Quality verification requested'}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                {grn.status !== 'DRAFT' ? formatDateTime(grn.updatedAt) : 'Pending'}
                            </p>
                        </div>
                    </div>

                    <div className={`flex items-start gap-3 rounded-xl border p-3 ${grn.status === 'APPROVED' ? 'border-emerald-100 bg-emerald-50/50' : grn.status === 'REJECTED' ? 'border-rose-100 bg-rose-50/50' : grn.status === 'PARTIAL' ? 'border-blue-100 bg-blue-50/50' : 'border-slate-200 bg-slate-50/60'}`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-black text-xs ${grn.status === 'APPROVED' ? 'bg-emerald-600 text-white' : grn.status === 'REJECTED' ? 'bg-rose-600 text-white' : grn.status === 'PARTIAL' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {grn.status === 'APPROVED' ? '✓' : grn.status === 'REJECTED' ? '✕' : '3'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                                {grn.status === 'APPROVED' ? '3. Approved' : grn.status === 'REJECTED' ? '3. Rejected' : grn.status === 'PARTIAL' ? '3. Partial Acceptance' : '3. Quality Inspection'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                                {grn.approvedAt ? formatDateTime(grn.approvedAt) : grn.rejectedAt ? formatDateTime(grn.rejectedAt) : 'Awaiting inspection decision'}
                            </p>
                            {grn.inspectionNote && (
                                <p className="text-[10px] italic text-slate-600 mt-0.5 truncate">&ldquo;{grn.inspectionNote}&rdquo;</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Linked Purchase Order Summary Card */}
            {grn.purchaseOrder && (
                <Card className="border-slate-200/80 shadow-xs rounded-xl sm:rounded-2xl overflow-hidden">
                    <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-[#12335f]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Associated Purchase Order</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingOrder(grn.purchaseOrder)}
                            className="h-7 px-2.5 text-xs font-bold text-[#12335f] hover:bg-[#12335f]/10 gap-1 print:hidden"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Open PO Dialog
                        </Button>
                    </div>
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Clicking the PO ID opens the PO Dialog Modal */}
                                    <EntityIdLink
                                        label={grn.purchaseOrder.poNumber}
                                        id={grn.purchaseOrder.id}
                                        size="md"
                                        onClick={() => setViewingOrder(grn.purchaseOrder)}
                                    />
                                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                        PO Status: {grn.purchaseOrder.status}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm sm:text-base font-black text-slate-900 break-words">
                                    {grn.purchaseOrder.title}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                                    <p>
                                        <span className="text-slate-400 font-medium">Seller:</span>{' '}
                                        <span className="font-semibold text-slate-800">{grn.purchaseOrder.seller?.name || '—'}</span>
                                    </p>
                                    {grn.purchaseOrder.buyer && (
                                        <p>
                                            <span className="text-slate-400 font-medium">Buyer:</span>{' '}
                                            <span className="font-semibold text-slate-800">{grn.purchaseOrder.buyer.name}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="sm:text-right border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 shrink-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total PO Value</p>
                                <p className="mt-0.5 text-lg sm:text-xl font-black text-slate-950">
                                    {formatCurrency(grn.purchaseOrder.amount)}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setViewingOrder(grn.purchaseOrder)}
                                    className="mt-2 h-7 text-[11px] font-bold border-slate-200 hover:bg-slate-50 gap-1 print:hidden"
                                >
                                    <ExternalLink className="h-3 w-3 text-slate-500" />
                                    View Receipt Modal
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 3-Way Match & Discrepancy KPI Cards */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">3-Way Match Analysis</p>
                    {isFullMatch ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            100% Accepted · Zero Discrepancy
                        </span>
                    ) : hasDiscrepancy ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                            <AlertTriangle className="h-3 w-3" />
                            Discrepancy: {totalRejected} Units Rejected
                        </span>
                    ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    <KpiCard label="Total Ordered" value={totalOrdered} icon={Package} tone="slate" />
                    <KpiCard label="Received at Gate" value={totalReceived} icon={Package} tone="blue" />
                    <KpiCard label="Accepted Quality" value={totalAccepted} icon={CheckCircle2} tone="emerald" />
                    <div className="col-span-2 sm:col-span-1">
                        <KpiCard label="Rejected Qty" value={totalRejected} icon={XCircle} tone={totalRejected > 0 ? 'red' : 'slate'} />
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <Card className="border-slate-200/80 shadow-xs rounded-xl sm:rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-slate-800">
                                Line Items Received ({grn.items.length})
                            </p>
                            <p className="text-[11px] text-slate-500">Verified against purchase order specifications</p>
                        </div>
                    </div>
                    <DataTable
                        data={grn.items}
                        columns={[
                            {
                                key: 'itemName',
                                header: 'Item Specification',
                                cell: (item: any) => (
                                    <div>
                                        <p className="text-xs font-black text-slate-900 break-words">{item.itemName}</p>
                                        <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                                            {item.unitOfMeasure}
                                        </span>
                                    </div>
                                )
                            },
                            {
                                key: 'orderedQty',
                                header: 'Ordered',
                                width: 'w-20 sm:w-24',
                                align: 'right',
                                cell: (item: any) => (
                                    <span className="font-mono text-xs font-semibold text-slate-700">{Number(item.orderedQty)}</span>
                                )
                            },
                            {
                                key: 'receivedQty',
                                header: 'Received',
                                width: 'w-20 sm:w-24',
                                align: 'right',
                                cell: (item: any) => (
                                    <span className="font-mono text-xs font-semibold text-blue-700">{Number(item.receivedQty)}</span>
                                )
                            },
                            {
                                key: 'acceptedQty',
                                header: 'Accepted',
                                width: 'w-20 sm:w-24',
                                align: 'right',
                                cell: (item: any) => (
                                    <span className="font-mono text-xs text-emerald-700 font-bold">{Number(item.acceptedQty)}</span>
                                )
                            },
                            {
                                key: 'rejectedQty',
                                header: 'Rejected',
                                width: 'w-20 sm:w-24',
                                align: 'right',
                                cell: (item: any) => {
                                    const rej = Number(item.rejectedQty);
                                    return (
                                        <span className={`font-mono text-xs font-bold ${rej > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                                            {rej}
                                        </span>
                                    );
                                }
                            },
                            {
                                key: 'status',
                                header: 'Match Status',
                                width: 'w-28 sm:w-32',
                                cell: (item: any) => {
                                    const rec = Number(item.receivedQty);
                                    const acc = Number(item.acceptedQty);
                                    const rej = Number(item.rejectedQty);
                                    if (rej === 0 && acc === rec) {
                                        return (
                                            <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                                Accepted
                                            </span>
                                        );
                                    }
                                    if (rej > 0 && acc > 0) {
                                        return (
                                            <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                Partial
                                            </span>
                                        );
                                    }
                                    return (
                                        <span className="inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                            Rejected
                                        </span>
                                    );
                                }
                            },
                            ...(hasDiscrepancyNotes ? [
                                {
                                    key: 'rejectionReason',
                                    header: 'Discrepancy / Inspection Note',
                                    cell: (item: any) => (
                                        <span className="text-[11px] sm:text-xs text-slate-700 break-words">
                                            {item.rejectionReason ? (
                                                <span className="text-rose-700 font-medium">⚠️ {item.rejectionReason}</span>
                                            ) : (
                                                <span className="text-slate-400 italic">—</span>
                                            )}
                                        </span>
                                    )
                                }
                            ] : [])
                        ]}
                        keyExtractor={(item: any, idx: number) => item.id || `grn-item-${idx}`}
                        rowClassName="text-xs sm:text-sm hover:bg-slate-50/50"
                    />
                </CardContent>
            </Card>

            {/* Remarks & Quality Inspection Notes */}
            {(hasInspectionNote || hasRemarks) && (
                <div className={`grid grid-cols-1 ${hasInspectionNote && hasRemarks ? 'md:grid-cols-2' : ''} gap-3.5 sm:gap-4`}>
                    {hasInspectionNote && (
                        <Card className="border-slate-200/80 shadow-xs rounded-xl sm:rounded-2xl">
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Inspection Observations</p>
                                </div>
                                <p className="text-xs font-medium text-slate-800 bg-slate-50 rounded-lg p-3 border border-slate-100 break-words">
                                    {grn.inspectionNote}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {hasRemarks && (
                        <Card className="border-slate-200/80 shadow-xs rounded-xl sm:rounded-2xl">
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <FileText className="h-4 w-4 text-[#12335f]" />
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">General Gate Remarks</p>
                                </div>
                                <p className="text-xs font-medium text-slate-800 bg-slate-50 rounded-lg p-3 border border-slate-100 break-words">
                                    {grn.remarks}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Documents & Attachments */}
            {grn.documents && grn.documents.length > 0 && (
                <Card className="border-slate-200/80 shadow-xs rounded-xl sm:rounded-2xl">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Attached Documents ({grn.documents.length})
                                </p>
                                <p className="text-[11px] text-slate-400">Delivery proof, e-way bills, and inspection certificates</p>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                            {grn.documents.map(doc => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50/80 transition-colors shadow-2xs"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-slate-900 truncate" title={doc.fileAsset.originalName}>
                                                {doc.fileAsset.originalName}
                                            </p>
                                            <p className="text-[10px] text-slate-500 truncate">
                                                <span className="font-semibold text-slate-700">{doc.documentType}</span> · by {doc.uploadedBy.name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <a
                                            href={`/api/files/${doc.fileAsset.id}/view`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                            title="Open document in new tab"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            View
                                        </a>
                                        <a
                                            href={`/api/files/${doc.fileAsset.id}/download`}
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                            title="Download document"
                                        >
                                            <Download className="h-3 w-3" />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Reject Modal Dialog */}
            {showReject && (
                <RejectModal
                    onClose={() => setShowReject(false)}
                    onSubmit={async (reason) => {
                        await runWithToast(
                            () => rejectMut.mutateAsync({ id: grn.id, reason }),
                            { loading: 'Rejecting GRN...', success: 'GRN rejected', error: 'Reject failed' }
                        );
                        setShowReject(false);
                    }}
                    pending={rejectMut.isPending}
                />
            )}

            {/* Approve Modal Dialog with optional inspection note */}
            {showApprove && (
                <ApproveModal
                    onClose={() => setShowApprove(false)}
                    onSubmit={async (inspectionNote) => {
                        await runWithToast(
                            () => approveMut.mutateAsync({ id: grn.id, inspectionNote }),
                            { loading: 'Approving GRN...', success: 'GRN approved successfully', error: 'Approve failed' }
                        );
                        setShowApprove(false);
                    }}
                    pending={approveMut.isPending}
                />
            )}

            {/* Interactive Purchase Order Receipt Modal Dialog */}
            {viewingOrder && (
                <PurchaseOrderReceiptModal
                    order={viewingOrder}
                    onClose={() => setViewingOrder(null)}
                    isBuyer={user?.role === 'buyer'}
                    isSeller={user?.role === 'seller'}
                />
            )}
        </div>
    );
}

function RejectModal({
    onClose,
    onSubmit,
    pending
}: {
    onClose: () => void;
    onSubmit: (r: string) => Promise<void>;
    pending: boolean;
}) {
    const [reason, setReason] = useState('');
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-rose-700 bg-gradient-to-r from-rose-700 to-rose-800 px-5 py-4 text-white">
                    <h3 id="reject-modal-title" className="text-sm font-black uppercase tracking-wider">
                        Reject Goods Receipt Note
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close reject modal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label htmlFor="rejection-reason-input" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                            Rejection Reason (Required)
                        </label>
                        <textarea
                            id="rejection-reason-input"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={4}
                            placeholder="Specify why this consignment is being rejected (e.g., damaged transit packaging, failed quality check)..."
                            className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all"
                            maxLength={2000}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Minimum 5 characters required.</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button variant="outline" onClick={onClose} disabled={pending}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onSubmit(reason.trim())}
                            disabled={pending || reason.trim().length < 5}
                            className="bg-rose-600 text-white hover:bg-rose-700"
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

function ApproveModal({
    onClose,
    onSubmit,
    pending
}: {
    onClose: () => void;
    onSubmit: (note?: string) => Promise<void>;
    pending: boolean;
}) {
    const [note, setNote] = useState('');
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-modal-title"
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-emerald-700 bg-gradient-to-r from-emerald-700 to-emerald-800 px-5 py-4 text-white">
                    <h3 id="approve-modal-title" className="text-sm font-black uppercase tracking-wider">
                        Approve Goods Receipt Note
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close approve modal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                        Approving this GRN marks the delivered quantities as verified and enables the seller to raise the official invoice.
                    </div>
                    <div>
                        <label htmlFor="inspection-note-input" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                            Inspection Note (Optional)
                        </label>
                        <textarea
                            id="inspection-note-input"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            placeholder="Add quality inspection remarks, batch numbers, or verification remarks..."
                            className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            maxLength={2000}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button variant="outline" onClick={onClose} disabled={pending}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onSubmit(note.trim() ? note.trim() : undefined)}
                            disabled={pending}
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirm Approval
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

