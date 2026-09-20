/**
 * GrnDetailPage — full GRN view with submit/approve/reject actions,
 * interactive PO modal dialog, document attachments, and quality inspection details.
 *
 * Route: /grn/:id
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
    Receipt,
    Send,
    ShieldAlert,
    ShieldCheck,
    Truck,
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
import { downloadGrnPdf } from '../lib/grnPdfGenerator';
import { openFileAsset } from '../../../lib/files';
import { getDeliveryByPurchaseOrder } from '../../delivery/api';

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
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    const { data: mappedDelivery } = useQuery({
        queryKey: ['delivery', 'by-po', grn?.purchaseOrderId],
        queryFn: () => getDeliveryByPurchaseOrder(grn!.purchaseOrderId),
        enabled: Boolean(grn?.purchaseOrderId && canViewGrn)
    });

    const handleViewPo = () => {
        if (!grn) return;
        if (grn.purchaseOrder) {
            setViewingOrder(grn.purchaseOrder);
        } else if (grn.purchaseOrderId) {
            setViewingOrder({ id: grn.purchaseOrderId, poNumber: grn.grnNumber });
        }
    };

    const handleViewDelivery = () => {
        if (!grn) return;
        const poNum = grn.purchaseOrder?.poNumber || '';
        const delId = mappedDelivery?.id;
        const poId = grn.purchaseOrderId || grn.purchaseOrder?.id;

        const queryParams = new URLSearchParams();
        if (poNum) queryParams.set('search', poNum);
        if (poId) queryParams.set('poId', String(poId));
        if (delId) {
            queryParams.set('deliveryId', String(delId));
            queryParams.set('dispatch', String(delId));
        }

        const isSellerOrShg = user?.role === 'seller' || user?.role === 'shg';
        const targetRoute = isSellerOrShg ? '/seller/delivery-management' : '/orders/tracking';
        router.push(`${targetRoute}?${queryParams.toString()}`);
    };

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

    const requiresApprovalWorkflow = grn.requiresApprovalWorkflow ?? true;
    const isSingleUserOrNoApprover = !requiresApprovalWorkflow;
    const canSubmit = grn.status === 'DRAFT' && canCreateGrn && requiresApprovalWorkflow;
    const canApprove = (canApproveGrn || (canCreateGrn && isSingleUserOrNoApprover)) && (
        grn.status === 'SUBMITTED' ||
        (grn.status === 'DRAFT' && isSingleUserOrNoApprover)
    );

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

    const handleDownloadPdf = () => {
        if (!grn) return;
        try {
            setIsDownloadingPdf(true);
            downloadGrnPdf(grn);
            notify.success('Goods Receipt Note (GRN) PDF downloaded successfully');
        } catch (err: any) {
            console.error('Failed to generate GRN PDF:', err);
            notify.error('Failed to download GRN PDF: ' + (err?.message || 'Unknown error'));
        } finally {
            setIsDownloadingPdf(false);
        }
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
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-300 print:hidden cursor-pointer"
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <p>
                            Received by <span className="font-semibold text-slate-900">{grn.receivedBy.name}</span>{' '}
                            <span className="text-slate-500 font-normal">({grn.receivedBy.email})</span>
                        </p>
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <p>
                            <span className="text-slate-400 font-medium">Receipt Date:</span>{' '}
                            <span className="font-semibold text-slate-800">{formatDateTime(grn.receivedAt)}</span>
                        </p>
                        {grn.purchaseOrder?.poNumber && (
                            <>
                                <span className="text-slate-300 hidden sm:inline">•</span>
                                <p>
                                    <span className="text-slate-400 font-medium">PO:</span>{' '}
                                    <button
                                        type="button"
                                        onClick={handleViewPo}
                                        className="font-mono font-bold text-[#12335f] hover:underline cursor-pointer"
                                    >
                                        {grn.purchaseOrder.poNumber}
                                    </button>
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                    {(grn.purchaseOrder || grn.purchaseOrderId) && (
                        <Button
                            variant="outline"
                            onClick={handleViewPo}
                            className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-[#12335f] hover:border-[#12335f]/50 h-9 sm:h-10 text-xs font-bold shadow-2xs gap-1.5 transition-all cursor-pointer"
                            title="Open interactive Purchase Order Dialog"
                        >
                            <FileText className="h-3.5 w-3.5 text-indigo-600" />
                            View Purchase Order
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        onClick={handleViewDelivery}
                        className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-blue-700 hover:border-blue-400 h-9 sm:h-10 text-xs font-bold shadow-2xs gap-1.5 transition-all cursor-pointer"
                        title="Open delivery management for this GRN consignment"
                    >
                        <Truck className="h-3.5 w-3.5 text-blue-600" />
                        <span>View Delivery</span>
                        {mappedDelivery?.status && (
                            <span className="ml-1 hidden sm:inline-block rounded bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 font-semibold">
                                {mappedDelivery.status.replace(/_/g, ' ')}
                            </span>
                        )}
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => {
                            const poId = grn.purchaseOrderId || grn.purchaseOrder?.id;
                            const amt = grn.purchaseOrder?.amount || 0;
                            const invRoute = user?.role === 'buyer' ? '/buyer/invoices' : '/seller/invoices';
                            router.push(`${invRoute}?convertPoId=${poId}&amount=${amt}`);
                        }}
                        className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-400 h-9 sm:h-10 text-xs font-bold shadow-2xs gap-1.5 transition-all cursor-pointer"
                    >
                        <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                        View / Create Invoice
                    </Button>

                    {/* GRN Payment Gate: Pay Now / Upload Payment Proof */}
                    {(() => {
                        const poStatus = String(grn.purchaseOrder?.status || grn.status || '').toLowerCase();
                        const isPaid = poStatus.includes('paid');
                        const isBuyer = user?.role === 'buyer';
                        const payRoute = isBuyer ? '/buyer/payments' : '/seller/payments';
                        const searchVal = grn.grnNumber || grn.purchaseOrder?.poNumber || '';
                        if (!isPaid) {
                            if (!isBuyer) {
                                return (
                                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800">
                                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                                        <span>Payment Pending from Buyer</span>
                                    </span>
                                );
                            }
                            return (
                                <Button
                                    onClick={() => router.push(`${payRoute}${searchVal ? `?search=${encodeURIComponent(searchVal)}` : ''}`)}
                                    className="bg-[#12335f] text-white hover:bg-[#0e2a4f] h-9 sm:h-10 text-xs font-bold shadow-sm gap-1.5 cursor-pointer"
                                >
                                    <ShieldCheck className="h-3.5 w-3.5 text-blue-200" />
                                    Pay Now / Upload Payment Proof
                                </Button>
                            );
                        }
                        return (
                            <Button
                                onClick={() => router.push(`${payRoute}${searchVal ? `?search=${encodeURIComponent(searchVal)}` : ''}`)}
                                className="bg-emerald-700 text-white hover:bg-emerald-800 h-9 sm:h-10 text-xs font-bold shadow-sm gap-1.5 cursor-pointer"
                            >
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-100" />
                                View Payment Proof (Paid)
                            </Button>
                        );
                    })()}

                    <Button
                        variant="outline"
                        onClick={handleDownloadPdf}
                        disabled={isDownloadingPdf}
                        className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-[#12335f] h-9 sm:h-10 text-xs font-bold shadow-2xs gap-1.5 transition-all cursor-pointer"
                        title="Download official Goods Receipt Note (GRN) PDF"
                    >
                        {isDownloadingPdf ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#12335f]" />
                        ) : (
                            <Download className="h-3.5 w-3.5 text-[#12335f]" />
                        )}
                        Download GRN
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
                            className="bg-[#12335f] text-white hover:bg-[#0e2a4f] h-9 sm:h-10 text-xs font-bold shadow-sm cursor-pointer"
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
                                className="border-rose-200 text-rose-700 hover:bg-rose-50 h-9 sm:h-10 text-xs font-bold shadow-2xs cursor-pointer"
                            >
                                <XCircle className="mr-1.5 h-4 w-4 text-rose-600" />
                                Reject
                            </Button>
                            <Button
                                onClick={() => setShowApprove(true)}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 h-9 sm:h-10 text-xs font-bold shadow-sm cursor-pointer"
                            >
                                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                {grn.status === 'DRAFT' ? 'Approve & Finalize GRN' : 'Approve'}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Status Banners */}
            {grn.status === 'DRAFT' && !requiresApprovalWorkflow && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-3.5 text-xs font-medium text-indigo-950 flex items-start gap-2.5 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-indigo-700 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold">Direct Verification</span>: Single-user / sole-approver organization. Review line items below and directly approve or reject this Goods Receipt Note.
                    </div>
                </div>
            )}
            {grn.status === 'DRAFT' && requiresApprovalWorkflow && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs font-medium text-amber-950 flex items-start gap-2.5 shadow-2xs">
                    <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold">Draft Pending Submission</span>: Review all received and accepted quantities before submitting for approval by your organization's inspection team.
                    </div>
                </div>
            )}
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
                            <p className="text-xs font-bold text-slate-900">
                                {requiresApprovalWorkflow ? '2. Submitted for Review' : '2. Quality Verification'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                                {grn.status === 'DRAFT'
                                    ? (requiresApprovalWorkflow ? 'Draft pending submission' : 'Ready for direct verification')
                                    : (requiresApprovalWorkflow ? 'Quality verification requested' : 'Direct verification processed')}
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
                                {grn.approvedAt ? `Decision on ${formatDateTime(grn.approvedAt)}` : grn.rejectedAt ? `Decision on ${formatDateTime(grn.rejectedAt)}` : 'Awaiting inspection decision'}
                            </p>
                            {grn.status === 'APPROVED' && (
                                <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">Quality inspection verified · Invoicing enabled</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Linked Purchase Order Summary Card */}
            {(grn.purchaseOrder || grn.purchaseOrderId) && (
                <Card className="border-slate-200/80 shadow-xs rounded-xl sm:rounded-2xl overflow-hidden">
                    <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-[#12335f]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Associated Purchase Order</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleViewPo}
                            className="h-7 px-2.5 text-xs font-bold text-[#12335f] hover:bg-[#12335f]/10 gap-1.5 print:hidden cursor-pointer"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Open Purchase Order Dialog
                        </Button>
                    </div>
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Clicking the PO ID opens the PO Dialog Modal */}
                                    <button
                                        type="button"
                                        onClick={handleViewPo}
                                        className="inline-flex items-center gap-1 font-mono font-black text-xs sm:text-sm text-[#12335f] hover:underline cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors"
                                        title="Click to view Purchase Order Dialog"
                                    >
                                        <span>{grn.purchaseOrder?.poNumber || `PO #${grn.purchaseOrderId}`}</span>
                                        <ExternalLink className="h-3 w-3 opacity-60" />
                                    </button>
                                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                        PO Status: {grn.purchaseOrder?.status || 'Active'}
                                    </span>
                                    {mappedDelivery && (
                                        <button
                                            type="button"
                                            onClick={handleViewDelivery}
                                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                                            title="Open mapped delivery management"
                                        >
                                            <Truck className="h-3 w-3" />
                                            <span>Delivery: DLV-{mappedDelivery.id} ({mappedDelivery.status.replace(/_/g, ' ')})</span>
                                        </button>
                                    )}
                                </div>
                                <p className="mt-2 text-sm sm:text-base font-black text-slate-900 break-words">
                                    {grn.purchaseOrder?.title || 'Purchase Order Consignment'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
                                    <p>
                                        <span className="text-slate-400 font-medium">Seller:</span>{' '}
                                        <span className="font-semibold text-slate-800">{grn.purchaseOrder?.seller?.name || '—'}</span>
                                    </p>
                                    {grn.purchaseOrder?.buyer && (
                                        <p>
                                            <span className="text-slate-400 font-medium">Buyer:</span>{' '}
                                            <span className="font-semibold text-slate-800">{grn.purchaseOrder.buyer.name}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="sm:text-right border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total PO Value</p>
                                    <p className="mt-0.5 text-lg sm:text-xl font-black text-slate-950">
                                        {formatCurrency(grn.purchaseOrder?.amount || 0)}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleViewPo}
                                    className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-100 hover:text-[#12335f] gap-1.5 print:hidden cursor-pointer"
                                >
                                    <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                                    View PO Receipt Dialog
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
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const fileTarget = doc.fileAsset || (doc as any).fileAssetId || doc.id;
                                                openFileAsset(fileTarget, doc.documentType || 'GRN Document').catch(err => {
                                                    notify.error(err?.message || 'Failed to open document');
                                                });
                                            }}
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-400"
                                            title="Open document in new tab"
                                            aria-label={`View ${doc.documentType || 'Document'}`}
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            View
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const fileTarget = doc.fileAsset || (doc as any).fileAssetId || doc.id;
                                                openFileAsset(fileTarget, doc.documentType || 'GRN Document').catch(err => {
                                                    notify.error(err?.message || 'Failed to download document');
                                                });
                                            }}
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-400"
                                            title="Download document"
                                            aria-label={`Download ${doc.documentType || 'Document'}`}
                                        >
                                            <Download className="h-3 w-3" />
                                        </button>
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

