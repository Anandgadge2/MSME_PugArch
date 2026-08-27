/**
* CartPage — organisation-level shopping cart.
*
* Route: /cart
* Access: any org member except VIEWER
*
* Active cart shows current items. Buttons: Update qty, Remove, Submit for Approval.
* If cart is in another state (submitted/approved/rejected), shows status with timeline.
*/
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, History, Minus, Plus, RefreshCw, Send, ShoppingCart, Store, Trash2, X, XCircle, ArrowUpDown, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { useAuth } from '../../../hooks/useAuth';
import { useOrgRole, usePermissions } from '../../../hooks/useOrgRole';
import { cn } from '../../../lib/utils';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDateTime, formatRelative } from '../../shared/format';
import { KpiCard } from '../../shared/KpiCard';
import { runWithToast } from '../../../lib/toast';
import { postApi } from '../../shared/apiClient';
import { CreateConversationModal } from '../../messages/pages/MessagesPage';
import {
    useActiveCart,
    useApproveCart,
    useCartDetail,
    useCartHistory,
    useRejectCart,
    useRemoveCartItem,
    useSubmitCart,
    useUpdateCartItem
} from '../hooks';
import { useStartCartApprovalChain, useApprovalTrail } from '../../approvals/hooks';
import { ApprovalTrail } from '../../approvals/components/ApprovalTrail';
import type { CartItemDto, CartStatus } from '../api';

const STATUS_TONE: Record<CartStatus, string> = {
    ACTIVE: 'border-blue-200 bg-blue-50 text-blue-700',
    SUBMITTED_FOR_APPROVAL: 'border-amber-200 bg-amber-50 text-amber-700',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REJECTED: 'border-red-200 bg-red-50 text-red-700',
    CONVERTED_TO_ORDER: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    ABANDONED: 'border-slate-200 bg-slate-100 text-slate-500'
};

export default function CartPage() {
    const { user } = useAuth();
    const { isApproved } = useOrgRole();
    const { permissions, hasPermission, loading: permissionsLoading } = usePermissions();
    const canViewCart = hasPermission('cart.view') || user?.role === 'buyer' || user?.role === 'admin';
    const canEditCart = hasPermission('cart.add') || user?.role === 'buyer' || user?.role === 'admin';
    const canSubmitCart = hasPermission('cart.submit_for_approval') || user?.role === 'buyer' || user?.role === 'admin';
    const canApproveCheckout = hasPermission('checkout.approve');
    const canStartApprovalChain = hasPermission('approval.submit');
    const isViewer = permissions.length > 0 && permissions.every(code => code.endsWith('.view'));
    const canTransact = isApproved && (canEditCart || canSubmitCart);

    const router = useRouter();
    const searchParams = useSearchParams();

    const paramId = searchParams.get('id') || searchParams.get('cartId');
    const selectedCartId = paramId ? Number(paramId) : null;

    const activeCartQuery = useActiveCart({ enabled: canViewCart && !selectedCartId });
    const cartDetailQuery = useCartDetail(selectedCartId || undefined, { enabled: canViewCart && !!selectedCartId });
    const cartQuery = selectedCartId ? cartDetailQuery : activeCartQuery;

    const historyQuery = useCartHistory({ enabled: canViewCart });
    const removeMut = useRemoveCartItem();
    const updateMut = useUpdateCartItem();
    const submitMut = useSubmitCart();
    const startChainMut = useStartCartApprovalChain();
    const approveCartMut = useApproveCart();
    const rejectCartMut = useRejectCart();
    const [showHistory, setShowHistory] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState<number | null>(null);

    type SortField = 'item' | 'seller' | 'unitPrice' | 'quantity' | 'total' | 'techStatus' | 'createdAt' | null;
    type SortDirection = 'asc' | 'desc' | null;
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDir, setSortDir] = useState<SortDirection>(null);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
    const [quoteModalState, setQuoteModalState] = useState<{
        sellerId: string;
        subject: string;
        message: string;
        estimatedPrice: string;
    } | null>(null);

    const cart = cartQuery.data;
    const history = historyQuery.data || [];
    const trailQuery = useApprovalTrail('cart', cart?.id);
    const hasChain = !!(trailQuery.data?.trail && trailQuery.data.trail.length > 0);

    const totals = useMemo(() => {
        if (!cart) return { lineCount: 0, total: 0, sellerCount: 0 };
        const sellerSet = new Set(cart.items.map(i => i.sellerId));
        const total = cart.items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unitPrice), 0);
        return { lineCount: cart.items.length, total, sellerCount: sellerSet.size };
    }, [cart]);

    const techApprovalNeeded = cart?.items.some(i => i.technicalApproved === null) ?? false;
    const allTechApproved = cart?.items.every(i => i.technicalApproved === true) ?? false;
    const isSubmittable = canSubmitCart && cart?.status === 'ACTIVE' && cart.items.length > 0;

    const sortedItems = useMemo(() => {
        if (!cart?.items) return [];
        if (!sortField || !sortDir) return cart.items;
        return [...cart.items].sort((a, b) => {
            let valA: any, valB: any;
            switch (sortField) {
                case 'item': valA = a.itemName?.toLowerCase() || ''; valB = b.itemName?.toLowerCase() || ''; break;
                case 'seller': valA = a.seller?.name?.toLowerCase() || ''; valB = b.seller?.name?.toLowerCase() || ''; break;
                case 'unitPrice': valA = Number(a.unitPrice); valB = Number(b.unitPrice); break;
                case 'quantity': valA = Number(a.quantity); valB = Number(b.quantity); break;
                case 'total': valA = Number(a.quantity) * Number(a.unitPrice); valB = Number(b.quantity) * Number(b.unitPrice); break;
                case 'techStatus':
                    valA = a.technicalApproved === null ? 0 : a.technicalApproved ? 1 : -1;
                    valB = b.technicalApproved === null ? 0 : b.technicalApproved ? 1 : -1;
                    break;
                case 'createdAt': valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
            }
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [cart?.items, sortField, sortDir]);

    const isAllSelected = sortedItems.length > 0 && sortedItems.every(i => selectedItemIds.has(i.id));
    const isSomeSelected = sortedItems.some(i => selectedItemIds.has(i.id)) && !isAllSelected;

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedItemIds(new Set());
        } else {
            setSelectedItemIds(new Set(sortedItems.map(i => i.id)));
        }
    };

    const toggleSelectItem = (id: number) => {
        setSelectedItemIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedItems = useMemo(() => {
        return sortedItems.filter(i => selectedItemIds.has(i.id));
    }, [sortedItems, selectedItemIds]);

    const selectedTotal = useMemo(() => {
        return selectedItems.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unitPrice), 0);
    }, [selectedItems]);

    const formatCartQuoteData = (items: CartItemDto[]) => {
        const totalValue = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unitPrice), 0);
        const firstItem = items[0];
        const subject = items.length === 1
            ? `Quote request: ${firstItem.itemName}`
            : `Quote request: ${firstItem.itemName} + ${items.length - 1} other item(s)`;

        const itemsText = items.map((item, idx) => {
            const lineTotal = Number(item.quantity) * Number(item.unitPrice);
            const unit = item.unitOfMeasure || (item.serviceId ? 'Service' : 'PCS');
            return `${idx + 1}. ${item.itemName}\n   Quantity: ${item.quantity} ${unit}\n   Reference Unit Price: ${formatCurrency(item.unitPrice)}\n   Estimated Line Total: ${formatCurrency(lineTotal)}`;
        }).join('\n\n');

        const message = `Hello, I would like to request a formal quotation for the following ${items.length} item(s) from my cart:\n\n${itemsText}\n\nEstimated Total: ${formatCurrency(totalValue)}\n\nPlease share your best offered unit prices, delivery timeline, payment terms, and applicable GST/taxes.`;

        return { subject, message, totalValue };
    };

    const handleRequestQuote = () => {
        if (selectedItems.length === 0) {
            toast.info('Select at least one cart item to request a quote.');
            return;
        }

        if (!user) {
            toast.info('Login is required to send a quote request.');
            return;
        }

        if (user.role !== 'buyer' && user.role !== 'admin') {
            toast.info('Quote requests are available from buyer accounts.');
            return;
        }

        // Determine primary seller ID from selected items
        const primaryItem = selectedItems.find(i => Number(i.sellerId || i.seller?.id || 0) > 0) || selectedItems[0];
        const sellerId = Number(primaryItem?.sellerId || primaryItem?.seller?.id || 0);

        // Format quote data for ALL selected items
        const { subject, message, totalValue } = formatCartQuoteData(selectedItems);

        setQuoteModalState({
            sellerId: sellerId > 0 ? String(sellerId) : '',
            subject,
            message,
            estimatedPrice: String(totalValue)
        });
    };

    const handleQuoteCreated = (id: number) => {
        toast.success('Quote request sent to seller');
        setQuoteModalState(null);
        router.push(`/buyer/messages?conversationId=${id}`);
    };
    if (permissionsLoading && !canViewCart) {
        return <LoadingState label="Loading cart..." />;
    }

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDir === 'asc') setSortDir('desc');
            else { setSortField(null); setSortDir(null); }
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const SortHeader = ({ label, field, className, align = 'left' }: { label: string; field: SortField; className?: string; align?: 'left' | 'center' | 'right' }) => (
        <th className={className} aria-sort={sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button
                type="button"
                onClick={() => handleSort(field)}
                className={cn("inline-flex items-center gap-1 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20 rounded px-1 -mx-1 transition-colors", align === 'right' && 'flex-row-reverse')}
                aria-label={`Sort by ${label.toLowerCase()}`}
            >
                <span>{label}</span>
                {sortField !== field ? (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                ) : sortDir === 'asc' ? (
                    <ArrowUp className="h-3 w-3 text-[#12335f]" />
                ) : (
                    <ArrowDown className="h-3 w-3 text-[#12335f]" />
                )}
            </button>
        </th>
    );

    if (!canViewCart) {
        return <InlineError message="You do not have permission to view organisation carts." />;
    }

    const handleRemove = (item: CartItemDto) => {
        removeMut.mutate(item.id, {
            onSuccess: () => {
                toast.success('Item removed');
            },
            onError: (err: any) => {
                toast.error(err?.message || 'Failed to remove');
            }
        });
    };

    const handleUpdate = async (id: number, qty: number) => {
        if (qty < 1) return;
        await runWithToast(() => updateMut.mutateAsync({ id, quantity: qty }), {
            loading: 'Updating...',
            success: 'Quantity updated',
            error: 'Failed to update'
        });
    };

    if (cartQuery.isLoading) return <LoadingState label="Loading cart..." />;
    if (cartQuery.error) {
        const msg = (cartQuery.error as Error).message || '';
        return <InlineError message={msg} onRetry={() => cartQuery.refetch()} />;
    }

    return (
        <div className="space-y-4">
            {/* <div className="brand-tricolor-strip rounded-full" /> */}
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                    {/* <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Procurement</p> */}
                    <h1 className="text-2xl font-black text-slate-950">My Organisation Cart</h1>
                    {/* <p className="mt-1 text-xs font-semibold text-slate-500">
                        Add items to cart, get them approved by Finance and Technical Officers, then convert to PO/RFQ.
                    </p> */}
                </div>
                <div className="flex items-center gap-2">
                    {selectedCartId && (
                        <Button variant="outline" onClick={() => router.push('/cart')} className="h-10 rounded-lg text-xs font-black uppercase">
                            <ShoppingCart className="mr-2 h-4 w-4" /> Active Cart
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="h-10 rounded-lg text-xs font-black uppercase">
                        <History className="mr-2 h-4 w-4" /> History ({history.length})
                    </Button>
                    <Button variant="outline" onClick={() => cartQuery.refetch()} className="h-10 rounded-lg text-xs font-black uppercase">
                        <RefreshCw className={`mr-2 h-4 w-4 ${cartQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            {isViewer && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                    You have viewer access. You can see the cart but cannot make changes.
                </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard label="Status" value={(cart?.status || 'ACTIVE').replace(/_/g, ' ')} icon={ShoppingCart} tone="blue" subtext="Current lifecycle state" />
                <KpiCard label="Line Items" value={totals.lineCount} icon={ShoppingCart} tone="purple" subtext="Unique products/services" />
                <KpiCard label="Sellers" value={totals.sellerCount} icon={Store} tone="green" subtext="Supplying vendors" />
                <KpiCard label="Total Value" value={formatCurrency(totals.total)} icon={ShoppingCart} tone="amber" subtext="Estimated total value" />
            </div>

            {/* Status banners */}
            {cart?.status === 'SUBMITTED_FOR_APPROVAL' && (
                <>
                    <Banner
                        icon={Clock}
                        tone="amber"
                        title="Awaiting Finance Approval"
                        description={`Submitted ${formatRelative(cart.updatedAt)}. ${techApprovalNeeded ? 'Some items still need technical review.' : 'All items technically approved.'}`}
                    />
                    {canApproveCheckout && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-700">Finance Approval Pending</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-700">
                                        As a Finance Officer / Org Admin, you can decide on this cart. {techApprovalNeeded ? 'Note: Some items still need technical review before you can approve.' : 'All items have been technically approved.'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowRejectModal(cart.id)}
                                        disabled={approveCartMut.isPending || rejectCartMut.isPending}
                                        className="border-red-200 text-red-700 hover:bg-red-50"
                                    >
                                        <XCircle className="mr-2 h-4 w-4" /> Reject Cart
                                    </Button>
                                    <Button
                                        onClick={async () => {
                                            await runWithToast(() => approveCartMut.mutateAsync(cart.id), {
                                                loading: 'Approving cart...',
                                                success: 'Cart approved by Finance',
                                                error: 'Failed to approve cart'
                                            });
                                        }}
                                        disabled={approveCartMut.isPending || techApprovalNeeded}
                                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        {approveCartMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        Approve Cart
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {cart?.status === 'APPROVED' && (
                <>
                    <Banner
                        icon={CheckCircle2}
                        tone="emerald"
                        title="Cart Approved by Finance"
                        description={`Approved by ${cart.approvedBy?.name || 'Finance'} ${formatRelative(cart.approvedAt)}. Procurement Officer can now start the multi-level approval chain to convert this to a Purchase Order.`}
                    />
                    {canStartApprovalChain && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                            {!hasChain ? (
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-blue-700">Procurement Approval Chain</p>
                                        <p className="mt-1 text-xs font-semibold text-slate-700">
                                            Start the multi-level approval (Department Head → Finance → Procurement Head) to convert this cart to a Purchase Order.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={async () => {
                                            await runWithToast(() => startChainMut.mutateAsync(cart.id), {
                                                loading: 'Starting approval chain...',
                                                success: 'Approval chain started',
                                                error: 'Failed to start chain'
                                            });
                                        }}
                                        disabled={startChainMut.isPending}
                                        className="bg-[#12335f] text-white hover:bg-[#0e2a4f]"
                                    >
                                        {startChainMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Start Approval Chain
                                    </Button>
                                </div>
                            ) : (
                                <div className="mb-3">
                                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">Procurement Approval Chain Started</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-700">
                                        The multi-stage approval (Department Head → Finance → Procurement Head) is currently active or completed.
                                    </p>
                                </div>
                            )}
                            <div className={cn("mt-3", !hasChain && "hidden")}>
                                <ApprovalTrail entityType="cart" entityId={cart.id} />
                            </div>
                        </div>
                    )}
                </>
            )}
            {cart?.status === 'REJECTED' && (
                <Banner
                    icon={XCircle}
                    tone="red"
                    title="Cart Rejected"
                    description={`Rejected by ${cart.rejectedBy?.name || 'Finance'}: ${cart.rejectionNote}`}
                />
            )}

            {/* Cart Items */}
            <Card className="border-slate-200/80 shadow-sm">
                <CardContent className="p-0">
                    <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cart Items ({totals.lineCount})</p>
                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_TONE[cart?.status || 'ACTIVE']}`}>
                                {(cart?.status || 'ACTIVE').replace(/_/g, ' ')}
                            </span>
                            {selectedItemIds.size > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                                    {selectedItemIds.size} of {sortedItems.length} selected ({formatCurrency(selectedTotal)})
                                </span>
                            )}
                        </div>
                        {cart && cart.items.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleRequestQuote}
                                    disabled={selectedItemIds.size === 0}
                                    className={cn(
                                        "h-8 gap-1.5 rounded-lg text-xs font-black uppercase transition",
                                        selectedItemIds.size > 0
                                            ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                            : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                    )}
                                    title={selectedItemIds.size === 0 ? "Select items from the cart to request a quote" : `Send quote request for ${selectedItemIds.size} item(s)`}
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    Request Quote {selectedItemIds.size > 0 ? `(${selectedItemIds.size})` : ''}
                                </Button>
                            </div>
                        )}
                    </div>
                    {!cart || cart.items.length === 0 ? (
                        <EmptyState
                            title="Cart is empty"
                            description="Browse the marketplace and add products or services to your cart."
                        />
                    ) : (
                        <div className="overflow-x-auto w-full">
                            <table data-ux-wrapped="true" className="w-full min-w-[760px] text-sm">
                                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 text-center w-10">
                                            <input
                                                type="checkbox"
                                                checked={isAllSelected}
                                                ref={el => {
                                                    if (el) el.indeterminate = isSomeSelected;
                                                }}
                                                onChange={toggleSelectAll}
                                                className="h-4 w-4 rounded border-slate-300 text-[#12335f] focus:ring-[#12335f]/30 cursor-pointer"
                                                title="Select all items"
                                                aria-label="Select all items"
                                            />
                                        </th>
                                        <th className="px-3 py-2 text-left w-10">#</th>
                                        <SortHeader label="Item" field="item" className="px-3 py-2 text-left min-w-[140px]" />
                                        <SortHeader label="Seller" field="seller" className="px-3 py-2 text-left min-w-[120px] max-w-[160px]" />
                                        <SortHeader label="Unit Price" field="unitPrice" className="px-3 py-2 text-right w-24 whitespace-nowrap" align="right" />
                                        <SortHeader label="Quantity" field="quantity" className="px-3 py-2 text-center w-24 whitespace-nowrap" align="center" />
                                        <SortHeader label="Total" field="total" className="px-3 py-2 text-right w-24 whitespace-nowrap" align="right" />
                                        <SortHeader label="Tech Status" field="techStatus" className="px-3 py-2 text-left w-24 whitespace-nowrap" />
                                        <SortHeader label="Date & Time" field="createdAt" className="px-3 py-2 text-left w-28 min-w-[110px]" />
                                        <th className="px-3 py-2 text-right w-12 whitespace-nowrap">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedItems.map((item, idx) => {
                                        const lineTotal = Number(item.quantity) * Number(item.unitPrice);
                                        const isSelected = selectedItemIds.has(item.id);
                                        return (
                                            <tr key={item.id} className={cn("hover:bg-slate-50/60 group transition-colors", isSelected && "bg-indigo-50/20")}>
                                                <td className="px-3 py-2.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectItem(item.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-[#12335f] focus:ring-[#12335f]/30 cursor-pointer"
                                                        aria-label={`Select ${item.itemName}`}
                                                    />
                                                </td>
                                                <td className="px-3 py-2.5 font-mono text-[10px] font-bold text-slate-400">{String(idx + 1).padStart(2, '0')}</td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="text-xs font-bold text-[#12335f] break-words leading-tight">{item.itemName}</p>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <EntityIdLink
                                                                label={`${item.productId ? 'PRD' : 'SVC'}-${item.productId || item.serviceId}`}
                                                                id={item.productId || item.serviceId || 0}
                                                                size="sm"
                                                                onClick={() => { }}
                                                            />
                                                            <span className="text-[9px] font-medium text-slate-500">{item.unitOfMeasure}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <p className="text-[11px] font-bold text-slate-900 break-words leading-tight">{item.seller?.name || `Seller #${item.sellerId}`}</p>
                                                    {item.seller?.email && <p className="text-[9px] font-medium text-slate-500 break-all mt-0.5">{item.seller.email}</p>}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-[11px] font-bold text-slate-700 whitespace-nowrap">{formatCurrency(item.unitPrice)}</td>
                                                <td className="px-3 py-2.5">
                                                    {cart.status === 'ACTIVE' && canTransact ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdate(item.id, Number(item.quantity) - 1)}
                                                                disabled={Number(item.quantity) <= 1 || item.id < 0}
                                                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="min-w-[20px] text-center font-mono text-[11px] font-bold text-slate-900">{Number(item.quantity)}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdate(item.id, Number(item.quantity) + 1)}
                                                                disabled={item.id < 0}
                                                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-center font-mono text-[11px] font-bold text-slate-900">{Number(item.quantity)}</p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-[11px] font-black text-slate-900 whitespace-nowrap">{formatCurrency(lineTotal)}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {item.technicalApproved === null ? (
                                                        <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
                                                    ) : item.technicalApproved ? (
                                                        <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">Approved</span>
                                                    ) : (
                                                        <span className="inline-flex rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700" title={item.technicalNote || ''}>Rejected</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-[10px] font-medium text-slate-500 leading-tight">
                                                    {formatDateTime(item.createdAt)}
                                                </td>
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                    {cart.status === 'ACTIVE' && canTransact && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemove(item)}
                                                            disabled={removeMut.isPending || item.id < 0}
                                                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                            title="Remove from cart"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="border-t-2 border-slate-200 bg-slate-50/80">
                                    <tr>
                                        <td colSpan={6} className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Grand Total</td>
                                        <td className="px-3 py-2.5 text-right text-sm font-black text-slate-900 whitespace-nowrap">{formatCurrency(totals.total)}</td>
                                        <td colSpan={3} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {cart && cart.items.length > 0 && (
                        <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-500">
                                    Created by {cart.createdBy?.name} · {formatDateTime(cart.createdAt)}
                                </p>
                                {selectedItemIds.size > 0 && (
                                    <p className="text-xs font-bold text-slate-700 mt-0.5">
                                        Selected for Quote: <span className="font-extrabold text-[#12335f]">{selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''}</span> ({formatCurrency(selectedTotal)})
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    onClick={handleRequestQuote}
                                    disabled={selectedItemIds.size === 0}
                                    className={cn(
                                        "gap-1.5 font-bold transition shadow-xs",
                                        selectedItemIds.size > 0
                                            ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                            : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                    )}
                                    title={selectedItemIds.size === 0 ? "Select items from the cart to request a quote" : `Send quote request for ${selectedItemIds.size} item(s)`}
                                >
                                    <FileText className="h-4 w-4" />
                                    Request Quote {selectedItemIds.size > 0 ? `(${selectedItemIds.size} Selected)` : ''}
                                </Button>
                                {isSubmittable && (
                                    <Button
                                        onClick={() => router.push('/buyer/procurement/checkout')}
                                        className="bg-[#12335f] text-white hover:bg-[#0e2a4f] font-bold"
                                    >
                                        Proceed to Procurement Checkout
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* History */}
            {showHistory && (
                <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-0">
                        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cart History (last 50)</p>
                        </div>
                        {history.length === 0 ? (
                            <EmptyState title="No past carts" />
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {history.map(c => {
                                    const total = c.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
                                    return (
                                        <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <EntityIdLink
                                                        label={`CART-${c.id}`}
                                                        id={c.id}
                                                        size="sm"
                                                        onClick={() => {
                                                            router.push(`/cart?id=${c.id}`);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                    />
                                                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_TONE[c.status]}`}>
                                                        {c.status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs font-semibold text-slate-700">
                                                    {c.items.length} items · {formatCurrency(total)} · by {c.createdBy?.name}
                                                </p>
                                                <p className="text-[10px] text-slate-400">{formatDateTime(c.updatedAt)} ({formatRelative(c.updatedAt)})</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Submit Modal */}
            {showSubmitModal && cart && (
                <SubmitModal
                    onClose={() => setShowSubmitModal(false)}
                    onSubmit={async (notes) => {
                        const submittedCart = await runWithToast(() => submitMut.mutateAsync(notes), {
                            loading: 'Submitting...',
                            success: 'Cart submitted for Finance approval',
                            error: 'Failed to submit'
                        });
                        if (submittedCart?.id) {
                            router.push(`/cart?id=${submittedCart.id}`);
                        }
                        setShowSubmitModal(false);
                    }}
                    pending={submitMut.isPending}
                    itemCount={cart.items.length}
                    total={totals.total}
                />
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <RejectCartModal
                    cartId={showRejectModal}
                    onClose={() => setShowRejectModal(null)}
                    onSubmit={async (note) => {
                        await runWithToast(() => rejectCartMut.mutateAsync({ id: showRejectModal, note }), {
                            loading: 'Rejecting...',
                            success: 'Cart rejected',
                            error: 'Failed to reject'
                        });
                        setShowRejectModal(null);
                    }}
                    pending={rejectCartMut.isPending}
                />
            )}

            {/* Request Quote Modal */}
            {quoteModalState && (
                <CreateConversationModal
                    key={quoteModalState.sellerId || 'cart-quote'}
                    initialCounterpartyId={quoteModalState.sellerId}
                    initialRecipientRole="seller"
                    initialSubject={quoteModalState.subject}
                    initialMessage={quoteModalState.message}
                    initialIntent="quote"
                    initialPrice={quoteModalState.estimatedPrice}
                    onClose={() => setQuoteModalState(null)}
                    onCreated={handleQuoteCreated}
                />
            )}
        </div>
    );
}

function RejectCartModal({ cartId, onClose, onSubmit, pending }: { cartId: number; onClose: () => void; onSubmit: (note: string) => Promise<void>; pending: boolean }) {
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-red-700 to-red-800 px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Reject Cart</h3>
                        <p className="mt-0.5 text-[10px] text-white/70">CART-{cartId}</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reason for Rejection</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Tell the requester why this cart is being rejected..."
                            rows={4}
                            maxLength={2000}
                            required
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500/20"
                        />
                        <p className="text-[10px] text-slate-400">Minimum 5 characters.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button
                            onClick={() => onSubmit(note.trim())}
                            disabled={pending || note.trim().length < 5}
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

function Banner({ icon: Icon, tone, title, description }: { icon: any; tone: 'amber' | 'emerald' | 'red'; title: string; description: string }) {
    const tones = {
        amber: 'bg-amber-50 border-amber-200 text-amber-800 [--icon:#f59e0b]',
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800 [--icon:#10b981]',
        red: 'bg-red-50 border-red-200 text-red-800 [--icon:#ef4444]'
    };
    return (
        <div className={`rounded-lg border p-3 ${tones[tone]}`}>
            <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--icon)' }} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider">{title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-wrap-anywhere">{description}</p>
                </div>
            </div>
        </div>
    );
}

function SubmitModal({ onClose, onSubmit, pending, itemCount, total }: { onClose: () => void; onSubmit: (notes: string) => Promise<void>; pending: boolean; itemCount: number; total: number }) {
    const [notes, setNotes] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Submit Cart for Approval</h3>
                        <p className="mt-0.5 text-[10px] text-white/70">Notify your Finance Officer</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Summary</p>
                        <p className="mt-1">{itemCount} items · {formatCurrency(total)}</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Notes for Finance Officer (optional)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Reason for purchase, urgency, project reference..."
                            rows={3}
                            maxLength={2000}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={() => onSubmit(notes.trim() || undefined as any)} disabled={pending} className="bg-[#12335f] text-white">
                            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Submit for Approval
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
