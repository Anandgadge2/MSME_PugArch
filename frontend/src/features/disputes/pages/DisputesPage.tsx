/**
 * DisputesPage — full thread + evidence + admin resolution UI.
 *
 * Routes: /buyer/disputes, /seller/disputes, /admin/disputes
 *
 * View modes:
 *   - List: scrollable list of disputes for the role
 *   - Detail: thread + evidence + status updater (admin)
 */
import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, FileCheck, FileText, Paperclip, Plus, RefreshCw, Send, Shield, Trash2, X, XCircle, Search } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { KpiCard } from '../../shared/KpiCard';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { Pagination } from '../../shared/Pagination';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { usePagination, useFeatureQuery } from '../../shared/hooks';
import { formatCurrency, formatDateTime, formatRelative } from '../../shared/format';
import { runWithToast } from '../../../lib/toast';
import { toast } from 'sonner';
import {
    useCreateDispute, useDispute, useDisputes, useSendDisputeMessage, useUpdateDisputeStatus, useWithdrawDispute
} from '../hooks';
import { useDisputeWebSocket, type WebSocketStatus } from '../hooks/useDisputeWebSocket';
import type { DisputeDto, DisputeStatus } from '../api';
import { usePurchaseOrders } from '../../purchaseOrders/hooks';
import { uploadDeliveryFile, type UploadedFileAsset } from '../../delivery/upload';
import { openFileAsset } from '../../../lib/files';
import type { PurchaseOrderDto } from '../../shared/types';

const STATUS_TONE: Record<DisputeStatus, string> = {
    open: 'border-amber-200 bg-amber-50 text-amber-800',
    under_review: 'border-blue-200 bg-blue-50 text-blue-800',
    clarification_requested: 'border-purple-200 bg-purple-50 text-purple-800',
    responded: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    escalated: 'border-red-300 bg-red-50 text-red-800',
    frozen: 'border-red-200 bg-red-50 text-red-800',
    resolved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rejected: 'border-slate-200 bg-slate-100 text-slate-700',
    closed: 'border-slate-200 bg-slate-100 text-slate-700'
};

export default function DisputesPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    if (selectedId !== null) {
        return <DisputeDetail id={selectedId} onBack={() => setSelectedId(null)} isAdmin={isAdmin} />;
    }

    return (
        <DisputeList
            isAdmin={isAdmin}
            onSelect={setSelectedId}
            onCreate={() => setShowCreate(true)}
            showCreate={showCreate}
            onCloseCreate={() => setShowCreate(false)}
        />
    );
}

function DisputeList({ isAdmin, onSelect, onCreate, showCreate, onCloseCreate }: {
    isAdmin: boolean;
    onSelect: (id: number) => void;
    onCreate: () => void;
    showCreate: boolean;
    onCloseCreate: () => void;
}) {
    const { data, isLoading, error, refetch, isFetching } = useDisputes();
    const items = (data || []) as DisputeDto[];

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');

    const counts = {
        open: items.filter(d => d.status === 'open').length,
        underReview: items.filter(d => d.status === 'under_review').length,
        urgent: items.filter(d => d.priority === 'URGENT').length,
        resolved: items.filter(d => d.status === 'resolved').length,
        total: items.length
    };

    let filteredItems = items;
    if (selectedStatusFilter) {
        if (selectedStatusFilter === 'urgent') {
            filteredItems = filteredItems.filter(d => d.priority === 'URGENT');
        } else {
            filteredItems = filteredItems.filter(d => d.status === selectedStatusFilter);
        }
    }
    if (selectedCategoryFilter) {
        filteredItems = filteredItems.filter(d => d.category === selectedCategoryFilter);
    }
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filteredItems = filteredItems.filter(d =>
            d.disputeNo?.toLowerCase().includes(q) ||
            d.title?.toLowerCase().includes(q) ||
            d.reason?.toLowerCase().includes(q) ||
            d.category?.toLowerCase().includes(q) ||
            d.buyer?.name?.toLowerCase().includes(q) ||
            d.seller?.name?.toLowerCase().includes(q) ||
            String(d.purchaseOrderId || '').includes(q) ||
            String(d.id).includes(q)
        );
    }

    const { page, pageSize, pageItems: pagedItems, total, setPage, setPageSize } = usePagination(filteredItems, 10);

    return (
        <div className="mx-auto max-w-[1560px] space-y-5 px-4 pb-12">
            {/* Header */}
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#12335f]">RESOLUTION CENTER</p>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Disputes & Resolution</h1>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            Raise, track, and resolve disputes for purchase orders, payments, escrow, and milestone delivery.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => refetch()}
                            className="h-10 rounded-lg text-xs font-black uppercase shadow-sm bg-white hover:bg-slate-50 border-slate-200"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 text-[#12335f] ${isFetching ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                        {!isAdmin && (
                            <Button
                                onClick={onCreate}
                                className="h-10 rounded-lg text-xs font-black uppercase shadow-sm bg-[#12335f] hover:bg-[#0b2447] text-white"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Raise Dispute
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <KpiCard
                    label="Total Disputes"
                    value={counts.total}
                    subtext="All recorded case files"
                    icon={FileText}
                    tone="blue"
                    active={selectedStatusFilter === ''}
                    onClick={() => setSelectedStatusFilter('')}
                />
                <KpiCard
                    label="Open Cases"
                    value={counts.open}
                    subtext="Unresolved buyer/seller issues"
                    icon={AlertTriangle}
                    tone="amber"
                    active={selectedStatusFilter === 'open'}
                    onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'open' ? '' : 'open')}
                />
                <KpiCard
                    label="Under Review"
                    value={counts.underReview}
                    subtext="Active mediation in progress"
                    icon={Shield}
                    tone="indigo"
                    active={selectedStatusFilter === 'under_review'}
                    onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'under_review' ? '' : 'under_review')}
                />
                <KpiCard
                    label="Urgent Priority"
                    value={counts.urgent}
                    subtext="Escalated high-impact cases"
                    icon={AlertTriangle}
                    tone="red"
                    active={selectedStatusFilter === 'urgent'}
                    onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'urgent' ? '' : 'urgent')}
                />
                <KpiCard
                    label="Resolved"
                    value={counts.resolved}
                    subtext="Successfully closed disputes"
                    icon={CheckCircle2}
                    tone="green"
                    active={selectedStatusFilter === 'resolved'}
                    onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'resolved' ? '' : 'resolved')}
                />
            </div>

            {/* ── Search + Filter + View Toggle Toolbar ── */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
                <ResponsiveFilterBar
                    activeFilterCount={(searchQuery ? 1 : 0) + (selectedCategoryFilter ? 1 : 0) + (selectedStatusFilter ? 1 : 0)}
                    searchInput={
                        <div className="relative w-full">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search dispute #, PO #, party name..."
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                            />
                        </div>
                    }
                    filters={
                        <>
                            <div className="w-full sm:w-auto sm:min-w-[150px]">
                                <select
                                    value={selectedCategoryFilter}
                                    onChange={e => setSelectedCategoryFilter(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                >
                                    <option value="">All Categories</option>
                                    <option value="PAYMENT_NOT_RELEASED">Payment Not Released</option>
                                    <option value="QUALITY_DEFECT">Quality Defect</option>
                                    <option value="SHORT_DELIVERY">Short Delivery</option>
                                    <option value="LATE_DELIVERY">Late Delivery</option>
                                    <option value="SPECIFICATION_MISMATCH">Specification Mismatch</option>
                                    <option value="INVOICE_DISPUTE">Invoice Dispute</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>

                            <div className="w-full sm:w-auto sm:min-w-[140px]">
                                <select
                                    value={selectedStatusFilter}
                                    onChange={e => setSelectedStatusFilter(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="open">Open</option>
                                    <option value="under_review">Under Review</option>
                                    <option value="clarification_requested">Clarification Requested</option>
                                    <option value="responded">Responded</option>
                                    <option value="escalated">Escalated</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>

                            {(searchQuery || selectedCategoryFilter || selectedStatusFilter) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCategoryFilter('');
                                        setSelectedStatusFilter('');
                                    }}
                                    className="h-10 rounded-xl border-rose-200 bg-rose-50/60 text-xs font-extrabold text-rose-700 hover:bg-rose-100 min-w-[80px]"
                                >
                                    Reset
                                </Button>
                            )}
                        </>
                    }
                />
            </div>

            {error ? <InlineError message={(error as Error).message} onRetry={() => refetch()} /> :
                isLoading ? <LoadingState label="Loading disputes..." /> :
                    items.length === 0 ? (
                        <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-2xl">
                            <CardContent className="py-12">
                                <EmptyState title="No disputes" description={isAdmin ? 'No active disputes across the platform.' : 'You have no disputes. Raise one if you have an issue with a transaction.'} />
                            </CardContent>
                        </Card>
                    ) : filteredItems.length === 0 ? (
                        <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-2xl">
                            <CardContent className="py-12 text-center">
                                <EmptyState title="No matching disputes" description="Try clearing your search or status filter to see all disputes." />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-2xl">
                            <CardContent className="p-0">
                                <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Disputes Records ({filteredItems.length} of {items.length})
                                    </p>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {pagedItems.map(d => (
                                        <div
                                            key={d.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => onSelect(d.id)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    onSelect(d.id);
                                                }
                                            }}
                                            className="w-full text-left px-5 py-4 hover:bg-slate-50/70 transition-colors cursor-pointer outline-none focus-visible:bg-slate-50/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#12335f]/20 block"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <EntityIdLink label={d.disputeNo || `DSP-${d.id}`} id={d.id} size="sm" onClick={() => onSelect(d.id)} />
                                                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_TONE[d.status]}`}>
                                                            {d.status.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">
                                                            {d.category}
                                                        </span>
                                                        {d.priority === 'URGENT' && (
                                                             <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">
                                                                Urgent
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1.5 text-sm font-black text-slate-900 text-wrap-anywhere line-clamp-2">{d.title || d.reason}</p>
                                                    {d.amountInDispute && (
                                                        <p className="mt-1 text-xs font-black text-red-700">
                                                            Amount in Dispute: {formatCurrency(d.amountInDispute)}
                                                        </p>
                                                    )}
                                                    <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
                                                        Buyer: <span className="font-bold text-slate-800">{d.buyer?.name || 'N/A'}</span> ·
                                                        Seller: <span className="font-bold text-slate-800">{d.seller?.name || 'N/A'}</span>
                                                        {d.purchaseOrderId && <span className="ml-1 text-slate-600">· PO #{d.purchaseOrderId}</span>}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{formatRelative(d.updatedAt)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-slate-100 bg-white">
                                    <Pagination
                                        page={page}
                                        pageSize={pageSize}
                                        total={total}
                                        onPageChange={setPage}
                                        onPageSizeChange={setPageSize}
                                        label="disputes"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )
            }

            {showCreate && <CreateDisputeModal onClose={onCloseCreate} onCreated={(id) => { onCloseCreate(); onSelect(id); }} />}
        </div>
    );
}

function MetricCard({
    label,
    value,
    icon: Icon,
    isActive = false,
    onClick,
    activeColorClass,
    inactiveColorClass,
    valueColorClass
}: {
    label: string;
    value: number;
    icon: any;
    isActive?: boolean;
    onClick?: () => void;
    activeColorClass?: string;
    inactiveColorClass?: string;
    valueColorClass?: string;
}) {
    const isClickable = !!onClick;
    return (
        <div
            onClick={onClick}
            className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all duration-200 min-h-[92px] ${
                isClickable ? 'cursor-pointer' : ''
            } ${
                isActive
                    ? `bg-white border-transparent ring-2 ${activeColorClass || 'border-[#12335f] ring-[#12335f]/25'}`
                    : 'bg-white border-slate-200/80 hover:border-slate-350 hover:shadow-md'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-450 leading-tight">
                    {label}
                </p>
                <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
                        isActive ? (activeColorClass || 'bg-[#12335f]/10 text-[#12335f]') : (inactiveColorClass || 'text-slate-600 bg-slate-50 border-slate-200')
                    }`}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className={`mt-2 text-xl font-black tracking-tight leading-none ${valueColorClass || 'text-slate-900'}`}>
                {value}
            </p>
        </div>
    );
}

// ─── Detail with Thread + Status Update ──────────────────────────────────────

function DisputeDetail({ id, onBack, isAdmin }: { id: number; onBack: () => void; isAdmin: boolean }) {
    const { user } = useAuth();
    const { data: dispute, isLoading, error, refetch } = useDispute(id);
    const sendMut = useSendDisputeMessage();
    const statusMut = useUpdateDisputeStatus();
    const withdrawMut = useWithdrawDispute();
    const wsStatus = useDisputeWebSocket(id);
    const [content, setContent] = useState('');
    const [internal, setInternal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);

    const [replyAttachments, setReplyAttachments] = useState<UploadedFileAsset[]>([]);
    const [replyUploading, setReplyUploading] = useState(false);

    if (isLoading) return <LoadingState label="Loading dispute..." />;
    if (error) return <InlineError message={(error as Error).message} onRetry={() => refetch()} />;
    if (!dispute) return <InlineError message="Dispute not found" />;

    const handleReplyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setReplyUploading(true);
        try {
            const newUploaded: UploadedFileAsset[] = [];
            for (let i = 0; i < files.length; i++) {
                const asset = await uploadDeliveryFile(files[i], { entityType: 'dispute' });
                newUploaded.push(asset);
            }
            setReplyAttachments(prev => [...prev, ...newUploaded]);
            toast.success('Evidence file attached');
        } catch (err: any) {
            console.error('Upload Error:', err);
            toast.error(`Failed to attach file: ${err.message || 'Unknown error'}`);
        } finally {
            setReplyUploading(false);
            e.target.value = '';
        }
    };

    const handleSend = async () => {
        if (content.trim().length < 1 && replyAttachments.length === 0) return;
        await runWithToast(() => sendMut.mutateAsync({
            id: dispute.id,
            data: {
                content: content.trim(),
                internal: isAdmin && internal,
                evidenceFileIds: replyAttachments.map(a => a.id)
            }
        }), { loading: 'Sending...', success: 'Message sent', error: 'Send failed' });
        setContent('');
        setReplyAttachments([]);
    };

    const evidenceItems = [...(dispute.evidence || []), ...(dispute.attachments || [])];

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1.5">
                    <button onClick={onBack} className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#12335f] transition-colors mb-1">
                        <ArrowLeft className="mr-1.5 h-3 w-3" /> Back to Disputes
                    </button>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                            {dispute.disputeNo || `DSP-${dispute.id}`}
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_TONE[dispute.status]}`}>
                                {dispute.status.replace(/_/g, ' ')}
                            </span>
                            <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700 shadow-2xs">
                                {dispute.category.replace(/_/g, ' ')}
                            </span>
                            
                            {/* WebSocket Real-time Indicator */}
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                                wsStatus === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                wsStatus === 'RECONNECTING' || wsStatus === 'CONNECTING' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                'bg-slate-50 text-slate-500 border border-slate-200'
                            }`}>
                                {wsStatus === 'CONNECTED' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                                {wsStatus === 'RECONNECTING' || wsStatus === 'CONNECTING' ? <RefreshCw className="h-2 w-2 animate-spin" /> : null}
                                {wsStatus === 'CONNECTED' ? 'Live' : wsStatus === 'RECONNECTING' || wsStatus === 'CONNECTING' ? 'Connecting...' : 'Offline'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 pt-1">
                        <span>Raised {formatDateTime(dispute.createdAt)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                        <span>Last updated {formatRelative(dispute.updatedAt)}</span>
                    </div>
                </div>
                {isAdmin && !['resolved', 'closed', 'rejected'].includes(dispute.status) && (
                    <Button onClick={() => setShowStatusModal(true)} className="bg-[#12335f] text-white shadow-sm mt-2 md:mt-6 shrink-0">
                        <Shield className="mr-2 h-4 w-4" /> Update Status
                    </Button>
                )}
                {!isAdmin && !['resolved', 'closed', 'rejected'].includes(dispute.status) && (
                    <Button 
                        onClick={() => {
                            if (window.confirm('Are you sure you want to withdraw this dispute?')) {
                                runWithToast(() => withdrawMut.mutateAsync(dispute.id), { loading: 'Withdrawing...', success: 'Dispute withdrawn', error: 'Withdrawal failed' });
                            }
                        }} 
                        disabled={withdrawMut.isPending}
                        variant="outline"
                        className="text-slate-600 border-slate-300 shadow-sm mt-2 md:mt-6 shrink-0"
                    >
                        <XCircle className="mr-2 h-4 w-4" /> Withdraw Dispute
                    </Button>
                )}
            </div>

            {/* Original Reason */}
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-orange-50/20 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800/80">Original Reason</p>
                    {dispute.priority && (
                        <span className="rounded-md bg-amber-100/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-900">
                            {dispute.priority} Priority
                        </span>
                    )}
                </div>
                <h3 className="text-base font-black text-slate-900 mb-2">{dispute.title || 'Dispute'}</h3>
                {dispute.responseDueAt && !['resolved', 'closed', 'rejected'].includes(dispute.status) && (
                    <div className="mb-4 rounded bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                        Response is required by: {formatDateTime(dispute.responseDueAt)}
                    </div>
                )}
                {dispute.escalatedAt && (
                    <div className="mb-4 rounded bg-red-100 border border-red-300 px-3 py-2 text-xs font-bold text-red-800">
                        Dispute automatically escalated on {formatDateTime(dispute.escalatedAt)} due to lack of response.
                    </div>
                )}
                <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap mb-4 leading-relaxed">
                    {dispute.description || dispute.reason}
                </p>
                <div className="flex flex-wrap gap-2 pt-4 border-t border-amber-200/40">
                    {dispute.linkedEntityType && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/60 bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-900 shadow-2xs backdrop-blur-sm">
                            <FileText className="h-3 w-3 text-amber-600" />
                            {dispute.linkedEntityType.replace(/_/g, ' ')} #{dispute.linkedEntityId || '-'}
                        </span>
                    )}
                    {dispute.amountInDispute && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200/60 bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-900 shadow-2xs backdrop-blur-sm">
                            Amount: {formatCurrency(dispute.amountInDispute)}
                        </span>
                    )}
                </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 shadow-sm hover:bg-blue-50/50 transition-colors flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12335f]/10 text-lg font-black text-[#12335f]">
                        {(dispute.buyer?.name || 'B').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-600/80">Buyer</p>
                        <p className="truncate text-sm font-black text-slate-900 mt-0.5">{dispute.buyer?.name || `User #${dispute.buyerId}`}</p>
                    </div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 shadow-sm hover:bg-emerald-50/50 transition-colors flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-lg font-black text-emerald-700">
                        {(dispute.seller?.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/80">Seller</p>
                        <p className="truncate text-sm font-black text-slate-900 mt-0.5">{dispute.seller?.name || `User #${dispute.sellerId}`}</p>
                    </div>
                </div>
            </div>

            {/* Attached Evidence Section */}
            {evidenceItems.length > 0 && (
                <Card className="border-slate-200/80 bg-white shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Evidence & Attachments ({evidenceItems.length})</p>
                        <div className="flex flex-wrap gap-2">
                            {evidenceItems.map((item, idx) => (
                                <button
                                    key={item.id || idx}
                                    type="button"
                                    onClick={() => openFileAsset(item.fileAssetId || item, 'Dispute Evidence')}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-[#12335f] transition-all cursor-pointer shadow-xs"
                                >
                                    <Paperclip className="h-3.5 w-3.5 text-[#12335f]" />
                                    <span>Evidence File #{item.fileAssetId || item.id}</span>
                                    <ExternalLink className="h-3 w-3 text-slate-400 ml-0.5" />
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Conversation Thread */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                    <div>
                        <h2 className="text-sm font-black text-slate-900 tracking-tight">Conversation</h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            {!['resolved', 'closed', 'rejected'].includes(dispute.status) ? (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            ) : (
                                <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
                            )}
                            <span className="text-[11px] font-semibold text-slate-500">
                                {dispute.messages?.length || 0} {(dispute.messages?.length === 1) ? 'message' : 'messages'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="max-h-[500px] overflow-y-auto p-5 space-y-4 bg-slate-50/30">
                    {!dispute.messages || dispute.messages.length === 0 ? (
                        <div className="py-12 text-center text-sm font-semibold text-slate-400">
                            No messages yet. Send a message to start the conversation.
                        </div>
                    ) : dispute.messages.map(m => {
                        const isBuyer = m.sender?.role === 'buyer';
                        const isSeller = m.sender?.role === 'seller';
                        
                        const alignRight = isBuyer; 
                        
                        return (
                            <div key={m.id} className={`flex w-full ${alignRight ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex flex-col max-w-[90%] md:max-w-[75%] ${alignRight ? 'items-end' : 'items-start'}`}>
                                    <div className="mb-1.5 flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                            {m.sender?.name || `User #${m.senderId}`}
                                        </span>
                                        {m.sender?.role && (
                                            <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${isBuyer ? 'bg-blue-100/80 text-blue-800' : isSeller ? 'bg-emerald-100/80 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                                                {m.sender.role}
                                            </span>
                                        )}
                                        {m.internal && (
                                            <span className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-800">
                                                Internal
                                            </span>
                                        )}
                                    </div>
                                    <div className={`rounded-2xl px-4 py-3 shadow-sm ${m.internal ? 'bg-amber-50 border border-amber-200/60 rounded-tl-sm' : alignRight ? 'bg-[#12335f]/[0.03] border border-[#12335f]/10 rounded-tr-sm' : 'bg-white border border-slate-200/80 rounded-tl-sm'}`}>
                                        <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                    </div>
                                    <p className="mt-1 text-[9px] font-bold text-slate-400 px-1">{formatRelative(m.createdAt)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!['resolved', 'closed', 'rejected'].includes(dispute.status) && (
                    <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm focus-within:bg-white focus-within:ring-2 focus-within:ring-[#12335f]/20 focus-within:border-[#12335f] transition-all">
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder={isAdmin ? 'Add admin reply or internal note...' : 'Write your response...'}
                                rows={3}
                                maxLength={3000}
                                className="w-full resize-none rounded-t-xl bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
                            />
                            
                            {replyAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 px-4 pb-2">
                                    {replyAttachments.map(att => (
                                        <span key={att.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 shadow-2xs">
                                            <Paperclip className="h-3 w-3 text-slate-400" />
                                            <span className="truncate max-w-[150px]">{att.originalName || `File #${att.id}`}</span>
                                            <button type="button" onClick={() => setReplyAttachments(prev => prev.filter(a => a.id !== att.id))} className="text-rose-500 hover:text-rose-700 ml-0.5 rounded-full hover:bg-rose-50 p-0.5 transition-colors">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-3 py-2.5 bg-slate-100/50 rounded-b-xl">
                                <div className="flex items-center gap-3">
                                    <label className="cursor-pointer inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors">
                                        <Paperclip className="mr-1.5 h-4 w-4 text-slate-500" />
                                        {replyUploading ? 'Attaching...' : 'Attach File'}
                                        <input
                                            type="file"
                                            multiple
                                            disabled={replyUploading}
                                            onChange={handleReplyFileUpload}
                                            className="hidden"
                                            accept="image/*,application/pdf,.doc,.docx"
                                        />
                                    </label>
                                    {isAdmin && (
                                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                                            <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} className="rounded border-slate-300 text-amber-600 focus:ring-amber-600/30" />
                                            Internal note
                                        </label>
                                    )}
                                </div>
                                <Button 
                                    onClick={handleSend} 
                                    disabled={sendMut.isPending || replyUploading || (content.trim().length < 1 && replyAttachments.length === 0)} 
                                    className="h-9 shrink-0 bg-[#12335f] text-white font-black uppercase tracking-wider text-[10px] hover:bg-[#0b2447] shadow-sm transition-all"
                                >
                                    {sendMut.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                                    Send Reply
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Resolution remarks */}
            {dispute.remarks && ['resolved', 'rejected', 'closed'].includes(dispute.status) && (
                <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Admin Resolution</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 text-wrap-anywhere">{dispute.remarks}</p>
                        {dispute.resolvedAt && <p className="mt-1 text-[10px] text-slate-500">{formatDateTime(dispute.resolvedAt)}</p>}
                    </CardContent>
                </Card>
            )}

            {showStatusModal && (
                <StatusUpdateModal
                    dispute={dispute}
                    onClose={() => setShowStatusModal(false)}
                    onSubmit={async (status, remarks) => {
                        await runWithToast(() => statusMut.mutateAsync({ id: dispute.id, data: { status, remarks } }), {
                            loading: 'Updating...', success: 'Status updated', error: 'Update failed'
                        });
                        setShowStatusModal(false);
                    }}
                    pending={statusMut.isPending}
                />
            )}
        </div>
    );
}

function StatusUpdateModal({ dispute, onClose, onSubmit, pending }: {
    dispute: DisputeDto;
    onClose: () => void;
    onSubmit: (s: DisputeStatus, r?: string) => Promise<void>;
    pending: boolean;
}) {
    const [status, setStatus] = useState<DisputeStatus>(dispute.status === 'open' ? 'under_review' : 'resolved');
    const [remarks, setRemarks] = useState('');
    const requiresRemarks = ['resolved', 'rejected', 'closed'].includes(status);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] px-5 py-4 text-white">
                    <h3 className="text-sm font-black uppercase tracking-widest">Update Dispute Status</h3>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-5 space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">New Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value as DisputeStatus)} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-bold">
                            <option value="under_review">Under Review</option>
                            <option value="clarification_requested">Request Clarification</option>
                            <option value="responded">Responded</option>
                            <option value="escalated">Escalated</option>
                            <option value="resolved">Resolved</option>
                            <option value="rejected">Rejected</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                    {requiresRemarks && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Remarks (required)</label>
                            <textarea
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                                rows={4}
                                placeholder="Explain the resolution decision..."
                                maxLength={1000}
                                className="w-full rounded border border-slate-200 px-3 py-2 text-xs font-semibold"
                            />
                            <p className="text-[10px] text-slate-400">Minimum 10 characters.</p>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (requiresRemarks && remarks.trim().length < 10) {
                                    toast.error('Remarks of at least 10 chars required');
                                    return;
                                }
                                onSubmit(status, remarks.trim() || undefined);
                            }}
                            disabled={pending}
                            className="bg-[#12335f] text-white"
                        >
                            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Update Status
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CreateDisputeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
    const { user } = useAuth();
    const isBuyer = user?.role === 'buyer';

    const [linkedEntityType, setLinkedEntityType] = useState<'PURCHASE_ORDER' | 'INVOICE' | 'DELIVERY' | 'GRN' | 'ESCROW_ACCOUNT'>('PURCHASE_ORDER');

    // Fetch existing records for each record type
    const { data: purchaseOrdersData, loading: loadingOrders } = usePurchaseOrders();
    const { data: rawInvoices, loading: loadingInvoices } = useFeatureQuery<any>('/api/invoices', []);
    const { data: rawDeliveries, loading: loadingDeliveries } = useFeatureQuery<any>('/api/deliveries', []);
    const { data: rawGrns, loading: loadingGrns } = useFeatureQuery<any>('/api/grn', []);
    const { data: rawEscrows, loading: loadingEscrows } = useFeatureQuery<any>('/api/escrow/accounts', []);

    const ordersList = Array.isArray(purchaseOrdersData) ? purchaseOrdersData : ((purchaseOrdersData as any)?.purchaseOrders || (purchaseOrdersData as any)?.items || (purchaseOrdersData as any)?.records || []);
    const invoicesList = Array.isArray(rawInvoices) ? rawInvoices : ((rawInvoices as any)?.invoices || (rawInvoices as any)?.items || (rawInvoices as any)?.records || []);
    const deliveriesList = Array.isArray(rawDeliveries) ? rawDeliveries : ((rawDeliveries as any)?.deliveries || (rawDeliveries as any)?.items || (rawDeliveries as any)?.records || []);
    const grnsList = Array.isArray(rawGrns) ? rawGrns : ((rawGrns as any)?.grns || (rawGrns as any)?.items || (rawGrns as any)?.records || []);
    const escrowsList = Array.isArray(rawEscrows) ? rawEscrows : ((rawEscrows as any)?.escrows || (rawEscrows as any)?.items || (rawEscrows as any)?.records || []);

    const [selectedEntityId, setSelectedEntityId] = useState<number | ''>('');
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    const [category, setCategory] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [amountInDispute, setAmountInDispute] = useState<number | ''>('');
    const [uploadedAttachments, setUploadedAttachments] = useState<UploadedFileAsset[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const mut = useCreateDispute();

    // Active records list & loading based on selected linkedEntityType
    const activeRecords: any[] = linkedEntityType === 'PURCHASE_ORDER' ? ordersList :
        linkedEntityType === 'INVOICE' ? invoicesList :
        linkedEntityType === 'DELIVERY' ? deliveriesList :
        linkedEntityType === 'GRN' ? grnsList : escrowsList;

    const activeLoading = linkedEntityType === 'PURCHASE_ORDER' ? loadingOrders :
        linkedEntityType === 'INVOICE' ? loadingInvoices :
        linkedEntityType === 'DELIVERY' ? loadingDeliveries :
        linkedEntityType === 'GRN' ? loadingGrns : loadingEscrows;

    const handleRecordTypeChange = (type: any) => {
        setLinkedEntityType(type);
        setSelectedEntityId('');
        setSelectedRecord(null);
        setAmountInDispute('');
        setTitle('');
    };

    const handleSelectRecord = (idNum: number | '') => {
        setSelectedEntityId(idNum);
        if (idNum === '') {
            setSelectedRecord(null);
            setAmountInDispute('');
            return;
        }
        const found = activeRecords.find((rec: any) => Number(rec.id) === Number(idNum));
        if (found) {
            setSelectedRecord(found);
            const val = Number(found.amount || found.totalAmount || found.totalValue || found.taxableAmount || 0);
            if (val > 0) setAmountInDispute(val);

            const recLabel = linkedEntityType === 'PURCHASE_ORDER' ? `PO #${found.poNumber || found.id}` :
                linkedEntityType === 'INVOICE' ? `Invoice #${found.invoiceNumber || found.id}` :
                linkedEntityType === 'DELIVERY' ? `Delivery #${found.trackingNumber || found.id}` :
                linkedEntityType === 'GRN' ? `GRN #${found.grnNumber || found.id}` :
                `Escrow #${found.accountNumber || found.id}`;
            setTitle(`Issue with ${recLabel}`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const newUploaded: UploadedFileAsset[] = [];
            for (let i = 0; i < files.length; i++) {
                const asset = await uploadDeliveryFile(files[i], { entityType: 'dispute' });
                newUploaded.push(asset);
            }
            setUploadedAttachments(prev => [...prev, ...newUploaded]);
            toast.success(`${newUploaded.length} evidence file(s) uploaded successfully`);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to upload evidence file');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveAttachment = (id: number) => {
        setUploadedAttachments(prev => prev.filter(a => a.id !== id));
    };

    const finalCategory = category === 'Other' ? (customCategory.trim() || 'Other') : category;

    const counterpartyRoleLabel = isBuyer ? 'Seller' : 'Buyer';
    const counterpartyName = selectedRecord ? (
        isBuyer
            ? (selectedRecord.seller?.name || selectedRecord.seller?.email || (selectedRecord.purchaseOrder?.seller?.name) || `Seller #${selectedRecord.sellerId || selectedRecord.purchaseOrder?.sellerId || '-'}`)
            : (selectedRecord.buyer?.name || selectedRecord.buyer?.email || (selectedRecord.purchaseOrder?.buyer?.name) || `Buyer #${selectedRecord.buyerId || selectedRecord.purchaseOrder?.buyerId || '-'}`)
    ) : '-';

    const counterpartyId = selectedRecord ? (
        isBuyer
            ? (selectedRecord.sellerId || selectedRecord.seller?.id || selectedRecord.purchaseOrder?.sellerId || selectedRecord.purchaseOrder?.seller?.id)
            : (selectedRecord.buyerId || selectedRecord.buyer?.id || selectedRecord.purchaseOrder?.buyerId || selectedRecord.purchaseOrder?.buyer?.id)
    ) : undefined;

    const purchaseOrderId = selectedRecord ? (selectedRecord.purchaseOrderId || (linkedEntityType === 'PURCHASE_ORDER' ? selectedRecord.id : undefined)) : undefined;

    const handleSubmit = async () => {
        if (!selectedEntityId || !selectedRecord) {
            toast.error(`Please select a ${linkedEntityType.replace(/_/g, ' ').toLowerCase()} from the dropdown list`);
            return;
        }
        if (!finalCategory) {
            toast.error('Please select a dispute category');
            return;
        }
        if (title.trim().length < 4) {
            toast.error('Title must be at least 4 characters');
            return;
        }
        if (description.trim().length < 10) {
            toast.error('Detailed description must be at least 10 characters');
            return;
        }

        const notifyPartyLabel = isBuyer ? 'seller' : 'buyer';

        const result = await runWithToast(() => mut.mutateAsync({
            linkedEntityType,
            linkedEntityId: Number(selectedRecord.id),
            purchaseOrderId: purchaseOrderId ? Number(purchaseOrderId) : undefined,
            invoiceId: linkedEntityType === 'INVOICE' ? Number(selectedRecord.id) : selectedRecord.invoiceId,
            deliveryId: linkedEntityType === 'DELIVERY' ? Number(selectedRecord.id) : selectedRecord.deliveryId,
            grnId: linkedEntityType === 'GRN' ? Number(selectedRecord.id) : selectedRecord.grnId,
            escrowAccountId: linkedEntityType === 'ESCROW_ACCOUNT' ? Number(selectedRecord.id) : selectedRecord.escrowAccountId,
            counterpartyId: counterpartyId ? Number(counterpartyId) : undefined,
            category: finalCategory,
            title: title.trim(),
            description: description.trim(),
            reason: description.trim(),
            amountInDispute: amountInDispute === '' ? undefined : Number(amountInDispute),
            priority,
            evidenceFileIds: uploadedAttachments.map(a => a.id)
        }), {
            loading: 'Submitting dispute...',
            success: `Dispute raised & ${notifyPartyLabel} notified`,
            error: (err: any) => err?.message || 'Failed to raise dispute'
        });

        if (result?.id) onCreated(result.id);
    };

    const sellerCategories = [
        'Payment Not Received',
        'Payment Delay',
        'Wrong Deduction/Penalty',
        'Order Cancellation',
        'Delivery/Acceptance Issue',
        'Buyer Non-Compliance',
        'PO Terms Violation',
        'Other'
    ];

    const buyerCategories = [
        'Wrong Product/Specification',
        'Short Quantity',
        'Damaged/Defective Goods',
        'Late Delivery',
        'Delivery Not Received',
        'Seller Non-Compliance',
        'Invoice/Payment Issue',
        'PO Terms Violation',
        'Other'
    ];

    const activeCategories = isBuyer ? buyerCategories : sellerCategories;

    const recordTypeLabel = linkedEntityType === 'PURCHASE_ORDER' ? 'Purchase Order' :
        linkedEntityType === 'INVOICE' ? 'Invoice' :
        linkedEntityType === 'DELIVERY' ? 'Delivery' :
        linkedEntityType === 'GRN' ? 'GRN' : 'Escrow Account';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl my-8">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-red-700 to-red-800 px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Raise Dispute</h3>
                        <p className="text-[11px] font-semibold opacity-90">{isBuyer ? 'Buyer Procurement Resolution' : 'Seller Resolution Center'}</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* Linked Record Type & Dynamic Record Select */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Linked Record Type">
                            <select
                                value={linkedEntityType}
                                onChange={e => handleRecordTypeChange(e.target.value as any)}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f]"
                            >
                                <option value="PURCHASE_ORDER">Purchase Order</option>
                                <option value="INVOICE">Invoice</option>
                                <option value="DELIVERY">Delivery</option>
                                <option value="GRN">GRN</option>
                                <option value="ESCROW_ACCOUNT">Escrow Account</option>
                            </select>
                        </Field>

                        <Field label={`Select ${recordTypeLabel}`}>
                            <select
                                value={selectedEntityId}
                                onChange={e => handleSelectRecord(e.target.value === '' ? '' : Number(e.target.value))}
                                disabled={activeLoading}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f]"
                            >
                                <option value="">{activeLoading ? `Loading ${recordTypeLabel.toLowerCase()}s...` : `-- Select ${recordTypeLabel} --`}</option>
                                {activeRecords.map((rec: any) => {
                                    const displayNo = rec.poNumber || rec.invoiceNumber || rec.trackingNumber || rec.grnNumber || rec.accountNumber || `ID-${rec.id}`;
                                    const displayTitle = rec.title || rec.purchaseOrder?.title || rec.carrierName || 'Record';
                                    const val = Number(rec.amount || rec.totalAmount || rec.totalValue || rec.taxableAmount || 0);
                                    const valStr = val > 0 ? ` (${formatCurrency(val)})` : '';
                                    return (
                                        <option key={rec.id} value={rec.id}>
                                            {displayNo} — {displayTitle}{valStr}
                                        </option>
                                    );
                                })}
                            </select>
                        </Field>
                    </div>

                    {activeRecords.length === 0 && !activeLoading && (
                        <p className="text-[11px] font-semibold text-amber-600">No {recordTypeLabel.toLowerCase()}s found in your account.</p>
                    )}

                    {/* Read-Only Summary Box when Record is selected */}
                    {selectedRecord && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1">
                                    <FileCheck className="h-3.5 w-3.5 text-blue-700" /> Linked Record Details
                                </span>
                                <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800 uppercase">
                                    {selectedRecord.status || selectedRecord.poStatus || selectedRecord.invoiceStatus || 'Active'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-slate-700">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{recordTypeLabel}</p>
                                    <p className="font-extrabold text-slate-900">
                                        {selectedRecord.poNumber || selectedRecord.invoiceNumber || selectedRecord.trackingNumber || selectedRecord.grnNumber || selectedRecord.accountNumber || `ID-${selectedRecord.id}`}
                                    </p>
                                    <p className="text-[11px] text-slate-600 line-clamp-1">{selectedRecord.title || selectedRecord.purchaseOrder?.title || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{counterpartyRoleLabel}</p>
                                    <p className="font-extrabold text-slate-900">{counterpartyName}</p>
                                    <p className="text-[11px] text-blue-800 font-bold">
                                        Total: {formatCurrency(selectedRecord.amount || selectedRecord.totalAmount || selectedRecord.totalValue || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Category Selection */}
                    <Field label="Dispute Category">
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f]"
                        >
                            <option value="">-- Select Category --</option>
                            {activeCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </Field>

                    {category === 'Other' && (
                        <Field label="Specify Category">
                            <input
                                value={customCategory}
                                onChange={e => setCustomCategory(e.target.value)}
                                placeholder="Enter custom category details..."
                                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold"
                            />
                        </Field>
                    )}

                    {/* Title */}
                    <Field label="Dispute Title">
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            maxLength={180}
                            placeholder="Brief dispute title"
                            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f]"
                        />
                    </Field>

                    {/* Priority & Amount */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Priority">
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f]"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </Field>
                        <Field label="Amount in Dispute (₹)">
                            <input
                                type="number"
                                value={amountInDispute}
                                onChange={e => setAmountInDispute(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="0.00"
                                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-mono font-bold text-slate-900 outline-none focus:border-[#12335f]"
                            />
                        </Field>
                    </div>

                    {/* Description */}
                    <Field label="Detailed Description">
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={4}
                            maxLength={4000}
                            placeholder="Describe the issue, defect, timeline, and requested resolution in detail..."
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-[#12335f]"
                        />
                        <p className="text-[10px] text-slate-400">Minimum 10 characters. Be specific for prompt review.</p>
                    </Field>

                    {/* Evidence File Upload */}
                    <Field label="Evidence / Attachments">
                        <div className="flex items-center gap-3">
                            <label className="cursor-pointer inline-flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                                <Paperclip className="mr-1.5 h-4 w-4 text-[#12335f]" />
                                {isUploading ? 'Uploading...' : 'Upload Invoices / Photos / Docs'}
                                <input
                                    type="file"
                                    multiple
                                    disabled={isUploading}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                                />
                            </label>
                            <span className="text-[10px] font-semibold text-slate-400">PDF, Photos, Docs (Max 10MB)</span>
                        </div>

                        {uploadedAttachments.length > 0 && (
                            <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                                {uploadedAttachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <Paperclip className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                            <span className="font-semibold text-slate-800 truncate">{att.originalName || `File #${att.id}`}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAttachment(att.id)}
                                            className="text-slate-400 hover:text-rose-600 p-1"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Field>

                    {/* Pre-Submission Summary Card */}
                    {selectedRecord && finalCategory && description.trim().length >= 10 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700" /> Pre-Submission Summary
                                </span>
                                <span className="text-[10px] font-extrabold text-amber-800 uppercase">
                                    Ready to File
                                </span>
                            </div>
                            <div className="space-y-1.5 text-slate-800 text-[11px]">
                                <div className="flex items-center gap-1.5 flex-wrap font-bold">
                                    <span className="rounded bg-amber-200/80 px-2 py-0.5 font-mono text-amber-900">
                                        {recordTypeLabel}: #{selectedRecord.poNumber || selectedRecord.invoiceNumber || selectedRecord.trackingNumber || selectedRecord.grnNumber || selectedRecord.accountNumber || selectedRecord.id}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="rounded bg-white px-2 py-0.5 border border-amber-200 text-slate-900">
                                        {counterpartyName}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="rounded bg-white px-2 py-0.5 border border-amber-200 text-purple-900">
                                        {finalCategory}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="rounded bg-white px-2 py-0.5 border border-amber-200 font-mono text-red-700">
                                        {amountInDispute ? formatCurrency(amountInDispute) : 'Full Value'}
                                    </span>
                                </div>
                                <p className="text-slate-600 line-clamp-2 italic bg-white/60 p-2 rounded border border-amber-100/80 mt-1">
                                    "{description.trim()}"
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={mut.isPending || isUploading || !selectedEntityId}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
                        >
                            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                            Raise Dispute & Notify {counterpartyRoleLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</label>
            {children}
        </div>
    );
}
