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
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Plus, RefreshCw, Send, Shield, X, XCircle, Search } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { KpiCard } from '../../shared/KpiCard';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { Pagination } from '../../shared/Pagination';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { usePagination } from '../../shared/hooks';
import { formatCurrency, formatDateTime, formatRelative } from '../../shared/format';
import { runWithToast } from '../../../lib/toast';
import { toast } from 'sonner';
import {
    useCreateDispute, useDispute, useDisputes, useSendDisputeMessage, useUpdateDisputeStatus
} from '../hooks';
import type { DisputeDto, DisputeStatus } from '../api';

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
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => onSelect(d.id)}
                                            className="w-full text-left px-5 py-4 hover:bg-slate-50/70 transition-colors cursor-pointer"
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
                                        </button>
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
    const [content, setContent] = useState('');
    const [internal, setInternal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);

    if (isLoading) return <LoadingState label="Loading dispute..." />;
    if (error) return <InlineError message={(error as Error).message} onRetry={() => refetch()} />;
    if (!dispute) return <InlineError message="Dispute not found" />;

    const handleSend = async () => {
        if (content.trim().length < 1) return;
        await runWithToast(() => sendMut.mutateAsync({
            id: dispute.id,
            data: { content: content.trim(), internal: isAdmin && internal }
        }), { loading: 'Sending...', success: 'Message sent', error: 'Send failed' });
        setContent('');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                    <button onClick={onBack} className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-[#12335f] hover:underline">
                        <ArrowLeft className="mr-1 h-3 w-3" /> Back to Disputes
                    </button>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-black text-slate-950">{dispute.disputeNo || `DSP-${dispute.id}`}</h1>
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-black uppercase ${STATUS_TONE[dispute.status]}`}>
                            {dispute.status.replace(/_/g, ' ')}
                        </span>
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">
                            {dispute.category}
                        </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500 text-wrap-anywhere">
                        Raised {formatDateTime(dispute.createdAt)} · Last update {formatRelative(dispute.updatedAt)}
                    </p>
                </div>
                {isAdmin && !['resolved', 'closed', 'rejected'].includes(dispute.status) && (
                    <Button onClick={() => setShowStatusModal(true)} className="bg-[#12335f] text-white">
                        <Shield className="mr-2 h-4 w-4" /> Update Status
                    </Button>
                )}
            </div>

            {/* Original reason */}
            <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
                <CardContent className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Original Reason</p>
                    <p className="mt-1 text-base font-black text-slate-900 text-wrap-anywhere">{dispute.title || 'Dispute'}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 text-wrap-anywhere whitespace-pre-wrap">{dispute.description || dispute.reason}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase text-slate-600">
                        {dispute.linkedEntityType && <span className="rounded border border-slate-200 bg-white px-2 py-1">{dispute.linkedEntityType.replace(/_/g, ' ')} #{dispute.linkedEntityId || '-'}</span>}
                        {dispute.priority && <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">{dispute.priority}</span>}
                        {dispute.amountInDispute && <span className="rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700">{formatCurrency(dispute.amountInDispute)}</span>}
                    </div>
                </CardContent>
            </Card>

            {/* Parties */}
            <div className="grid gap-3 md:grid-cols-2">
                <Card><CardContent className="p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buyer</p>
                    <p className="mt-1 text-sm font-black text-slate-900 text-wrap-anywhere">{dispute.buyer?.name || `#${dispute.buyerId}`}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Seller</p>
                    <p className="mt-1 text-sm font-black text-slate-900 text-wrap-anywhere">{dispute.seller?.name || `#${dispute.sellerId}`}</p>
                </CardContent></Card>
            </div>

            {/* Thread */}
            <Card className="border-slate-200/80 shadow-sm">
                <CardContent className="p-0">
                    <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Conversation ({dispute.messages?.length || 0})
                        </p>
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                        {!dispute.messages || dispute.messages.length === 0 ? (
                            <p className="p-8 text-center text-xs font-semibold text-slate-500">No messages yet. Add the first one below.</p>
                        ) : dispute.messages.map(m => {
                            const isMe = m.senderId === Number(user?.id);
                            return (
                                <div key={m.id} className={`px-4 py-3 ${m.internal ? 'bg-amber-50/30' : ''}`}>
                                    <div className="flex items-start gap-2 justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-xs font-black ${isMe ? 'text-[#12335f]' : 'text-slate-700'}`}>
                                                    {m.sender?.name || `User #${m.senderId}`}
                                                </span>
                                                {m.sender?.role && (
                                                    <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600">
                                                        {m.sender.role}
                                                    </span>
                                                )}
                                                {m.internal && (
                                                    <span className="inline-flex rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-800">
                                                        Internal
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-slate-800 text-wrap-anywhere whitespace-pre-wrap">{m.content}</p>
                                        </div>
                                        <p className="text-[10px] text-slate-400 shrink-0">{formatRelative(m.createdAt)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {!['resolved', 'closed', 'rejected'].includes(dispute.status) && (
                        <div className="border-t border-slate-100 p-4 space-y-2">
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder={isAdmin ? 'Add admin reply or internal note...' : 'Reply...'}
                                rows={3}
                                maxLength={3000}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                            />
                            <div className="flex items-center justify-between">
                                {isAdmin && (
                                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />
                                        Internal note (not visible to buyer/seller)
                                    </label>
                                )}
                                <Button onClick={handleSend} disabled={sendMut.isPending || content.trim().length < 1} className="ml-auto bg-[#12335f] text-white">
                                    {sendMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Send
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

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

// ─── Create Dispute Modal ────────────────────────────────────────────────────

function CreateDisputeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
    const [linkedEntityType, setLinkedEntityType] = useState('PURCHASE_ORDER');
    const [linkedEntityId, setLinkedEntityId] = useState<number | ''>('');
    const [poId, setPoId] = useState<number | ''>('');
    const [counterpartyId, setCounterpartyId] = useState<number | ''>('');
    const [category, setCategory] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [amountInDispute, setAmountInDispute] = useState<number | ''>('');
    const mut = useCreateDispute();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-red-700 to-red-800 px-5 py-4 text-white">
                    <h3 className="text-sm font-black uppercase tracking-widest">Raise Dispute</h3>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Linked Record Type">
                            <select value={linkedEntityType} onChange={e => setLinkedEntityType(e.target.value)} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-bold">
                                <option value="PURCHASE_ORDER">Purchase Order</option>
                                <option value="INVOICE">Invoice</option>
                                <option value="PAYMENT_TRANSACTION">Payment</option>
                                <option value="DELIVERY">Delivery</option>
                                <option value="GRN">GRN</option>
                                <option value="ESCROW_ACCOUNT">Escrow</option>
                                <option value="REQUIREMENT_RESPONSE">Requirement Response</option>
                                <option value="REVERSE_AUCTION_AWARD">Reverse Auction Award</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </Field>
                        <Field label="Linked Record ID">
                            <input type="number" value={linkedEntityId} onChange={e => setLinkedEntityId(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold" />
                        </Field>
                        <Field label="Purchase Order ID">
                            <input type="number" value={poId} onChange={e => setPoId(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold" />
                        </Field>
                        <Field label="Counterparty User ID">
                            <input type="number" value={counterpartyId} onChange={e => setCounterpartyId(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold" />
                        </Field>
                    </div>
                    <Field label="Category">
                        <select
                            value={['PAYMENT_DELAY', 'PAYMENT_MISMATCH', 'QUALITY_ISSUE', 'QUANTITY_MISMATCH', 'DELIVERY_DELAY', 'DAMAGED_GOODS', 'WRONG_ITEM', 'INVOICE_MISMATCH', 'GRN_REJECTION', 'ESCROW_RELEASE_ISSUE', 'ORDER_CANCELLATION'].includes(category) ? category : (category ? 'OTHER' : '')}
                            onChange={e => setCategory(e.target.value)}
                            className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-bold"
                        >
                            <option value="">Select category...</option>
                            <option value="PAYMENT_DELAY">Payment delay</option>
                            <option value="PAYMENT_MISMATCH">Payment mismatch</option>
                            <option value="QUALITY_ISSUE">Quality issue</option>
                            <option value="QUANTITY_MISMATCH">Quantity mismatch</option>
                            <option value="DELIVERY_DELAY">Delivery delay</option>
                            <option value="DAMAGED_GOODS">Damaged goods</option>
                            <option value="WRONG_ITEM">Wrong item</option>
                            <option value="INVOICE_MISMATCH">Invoice mismatch</option>
                            <option value="GRN_REJECTION">GRN rejection</option>
                            <option value="ESCROW_RELEASE_ISSUE">Escrow release issue</option>
                            <option value="ORDER_CANCELLATION">Order cancellation</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </Field>
                    {!['PAYMENT_DELAY', 'PAYMENT_MISMATCH', 'QUALITY_ISSUE', 'QUANTITY_MISMATCH', 'DELIVERY_DELAY', 'DAMAGED_GOODS', 'WRONG_ITEM', 'INVOICE_MISMATCH', 'GRN_REJECTION', 'ESCROW_RELEASE_ISSUE', 'ORDER_CANCELLATION', ''].includes(category) && (
                        <Field label="Specify Custom Category">
                            <input
                                required
                                value={category === 'OTHER' ? '' : category}
                                onChange={e => setCategory(e.target.value)}
                                placeholder="Type custom category here..."
                                className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-semibold"
                            />
                        </Field>
                    )}
                    <Field label="Title">
                        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={180} placeholder="Short dispute title" className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-semibold" />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Priority">
                            <select value={priority} onChange={e => setPriority(e.target.value)} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-bold">
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </Field>
                        <Field label="Amount in Dispute">
                            <input type="number" value={amountInDispute} onChange={e => setAmountInDispute(e.target.value === '' ? '' : Number(e.target.value))} className="h-9 w-full rounded border border-slate-200 px-3 text-xs font-mono font-semibold" />
                        </Field>
                    </div>
                    <Field label="Detailed Description">
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={4000} placeholder="Describe the issue in detail..." className="w-full rounded border border-slate-200 px-3 py-2 text-xs font-semibold" />
                        <p className="text-[10px] text-slate-400">Minimum 10 characters. Be specific; admin will review.</p>
                    </Field>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button
                            onClick={async () => {
                                if (!category) { toast.error('Choose a category'); return; }
                                if (title.trim().length < 4) { toast.error('Title must be at least 4 chars'); return; }
                                if (description.trim().length < 10) { toast.error('Description must be at least 10 chars'); return; }
                                if (!linkedEntityId && !poId && !counterpartyId) { toast.error('Provide a linked record, PO, or counterparty'); return; }
                                const result = await runWithToast(() => mut.mutateAsync({
                                    linkedEntityType,
                                    linkedEntityId: linkedEntityId === '' ? undefined : linkedEntityId,
                                    purchaseOrderId: poId === '' ? undefined : poId,
                                    counterpartyId: counterpartyId === '' ? undefined : counterpartyId,
                                    category,
                                    title: title.trim(),
                                    description: description.trim(),
                                    reason: description.trim(),
                                    amountInDispute: amountInDispute === '' ? undefined : amountInDispute,
                                    priority
                                }), { loading: 'Creating...', success: 'Dispute raised', error: 'Failed' });
                                if (result?.id) onCreated(result.id);
                            }}
                            disabled={mut.isPending}
                            className="bg-red-600 text-white"
                        >
                            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                            Raise Dispute
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
