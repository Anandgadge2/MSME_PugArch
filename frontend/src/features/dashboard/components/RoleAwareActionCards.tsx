/**
 * RoleAwareActionCards — shows quick-action KPI cards on the Dashboard tailored
 * to the user's intra-organisation role + their portal role (buyer/seller).
 *
 * Data is fetched from the unified /api/dashboard/summary endpoint with React Query
 * caching for instant rendering.
 */
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useMemo, useEffect } from 'react';
import {
    ClipboardCheck, ClipboardList, FileText, Gavel,
    Inbox, Package, Receipt, Send, Store, Truck, Landmark, IndianRupee
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { getApi } from '../../shared/apiClient';
import { KpiCard, type KpiCardTone } from '../../shared/KpiCard';

interface DashboardSummary {
    cartItemCount?: number;
    pendingApprovalsCount?: number;
    cartApprovalsCount?: number;
    techReviewCount?: number;
    grnsToApproveCount?: number;
    activeDeliveriesCount?: number;
    // Buyer-side
    totalProcurementsCount?: number;
    activeProcurementsCount?: number;
    myTendersCount?: number;
    myActivePOsCount?: number;
    myPendingInvoicesCount?: number;
    myRfqsCount?: number;
    supplierResponsesCount?: number;
    // Seller-side
    sellerOpenTendersCount?: number;
    sellerOpportunitiesCount?: number;
    sellerActivePOsCount?: number;
    sellerCatalogueItemsCount?: number;
    sellerPendingInvoicesCount?: number;
    sellerQuotationsCount?: number;
    reverseAuctionsActive?: number;
    reverseAuctionsScheduled?: number;
    reverseAuctionsClosed?: number;
    reverseAuctionInvites?: number;
    reverseAuctionsLive?: number;
    reverseAuctionBidsSubmitted?: number;
    buyerProcurementActiveBidsCount?: number;
    buyerProcurementTotalSpentValue?: number;
    orgRole?: string;
    isAdmin?: boolean;
}

type ActionCardConfig = {
    label: string;
    count: number;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: KpiCardTone | string;
    show: boolean;
    priority: boolean;
    isCurrency?: boolean;
};

function RoleAwareActionCards() {
    const { user } = useAuth();
    const router = useRouter();

    const summary = useQuery({
        queryKey: ['dashboard', 'summary'] as const,
        queryFn: () => getApi<DashboardSummary>('/api/dashboard/summary', true).catch(() => null),
        enabled: !!user && user.role !== 'admin',
        refetchOnWindowFocus: false,
        staleTime: 60_000,
        placeholderData: (prev) => {
            if (prev) return prev;
            if (typeof window !== 'undefined' && user?.id) {
                const cached = localStorage.getItem(`dashboard_summary_${user.id}`);
                if (cached) {
                    try {
                        return JSON.parse(cached);
                    } catch (e) {
                        return undefined;
                    }
                }
            }
            return undefined;
        }
    });

    useEffect(() => {
        if (summary.data && user?.id) {
            localStorage.setItem(`dashboard_summary_${user.id}`, JSON.stringify(summary.data));
        }
    }, [summary.data, user?.id]);

    const data: DashboardSummary = summary.data || {};
    const isLoading = summary.isLoading && !summary.data;
    const isBuyer = user?.role === 'buyer';
    const isSeller = user?.role === 'seller';
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    const hasPermission = useCallback((permissionCode: string) => {
        return permissions.includes('*') || permissions.includes(permissionCode);
    }, [permissions]);

    const cards: ActionCardConfig[] = useMemo(() => [
        // ─── Buyer baseline tiles ───
        {
            label: 'Active Procurements',
            count: data.activeProcurementsCount ?? data.myTendersCount ?? 0,
            href: '/buyer/my-procurements',
            icon: ClipboardList,
            tone: 'indigo',
            show: isBuyer,
            priority: false
        },
        {
            label: 'Procurement Bids',
            count: data.buyerProcurementActiveBidsCount || 0,
            href: '/marketplace',
            icon: Gavel,
            tone: 'purple',
            show: isBuyer,
            priority: false
        },
        {
            label: 'Procurement Spend',
            count: data.buyerProcurementTotalSpentValue || 0,
            href: '/payments/transactions',
            icon: IndianRupee,
            tone: 'emerald',
            show: isBuyer,
            priority: false,
            isCurrency: true
        },
        {
            label: 'Active Orders',
            count: data.myActivePOsCount || 0,
            href: '/orders',
            icon: Package,
            tone: 'emerald',
            show: isBuyer,
            priority: false
        },
        {
            label: 'Supplier Responses',
            count: data.supplierResponsesCount ?? data.myRfqsCount ?? 0,
            href: '/buyer/procurement/responses',
            icon: Send,
            tone: 'blue',
            show: isBuyer,
            priority: false
        },
        {
            label: 'Negotiate Price',
            count: data.reverseAuctionsActive || data.reverseAuctionsScheduled || 0,
            href: '/buyer/my-procurements?type=Reverse Auction',
            icon: Gavel,
            tone: 'amber',
            show: isBuyer,
            priority: false
        },
        {
            label: 'Pending Payments',
            count: data.myPendingInvoicesCount || 0,
            href: '/payments/invoices',
            icon: Receipt,
            tone: 'rose',
            show: isBuyer,
            priority: false
        },
        {
            label: 'Delivery Confirmation',
            count: data.grnsToApproveCount || 0,
            href: '/orders/delivery-confirmation',
            icon: ClipboardCheck,
            tone: 'teal',
            show: isBuyer && hasPermission('inspection.view'),
            priority: false
        },
        {
            label: 'Carts to Approve',
            count: data.cartApprovalsCount || 0,
            href: '/cart/approvals',
            icon: ClipboardCheck,
            tone: 'cyan',
            show: isBuyer && hasPermission('checkout.approve'),
            priority: false
        },
        {
            label: 'Approvals Pending',
            count: data.pendingApprovalsCount || 0,
            href: '/approvals',
            icon: Inbox,
            tone: 'amber',
            show: isBuyer && hasPermission('approval.view'),
            priority: (data.pendingApprovalsCount || 0) > 0
        },

        // ─── Seller baseline tiles ───
        {
            label: 'New Opportunities',
            count: data.sellerOpportunitiesCount || 0,
            href: '/seller/opportunities',
            icon: ClipboardList,
            tone: 'indigo',
            show: isSeller,
            priority: false
        },
        {
            label: 'Public Tenders',
            count: data.sellerOpenTendersCount || 0,
            href: '/seller/tenders',
            icon: Gavel,
            tone: 'blue',
            show: isSeller,
            priority: false
        },
        {
            label: 'My Bids / Quotations',
            count: data.sellerQuotationsCount || 0,
            href: '/quotations',
            icon: ClipboardCheck,
            tone: 'purple',
            show: isSeller,
            priority: false
        },
        {
            label: 'Orders Received',
            count: data.sellerActivePOsCount || 0,
            href: '/orders',
            icon: Package,
            tone: 'emerald',
            show: isSeller,
            priority: false
        },
        {
            label: 'Catalogue Items',
            count: data.sellerCatalogueItemsCount || 0,
            href: '/seller/catalogue',
            icon: Store,
            tone: 'cyan',
            show: isSeller,
            priority: false
        },
        {
            label: 'Active Deliveries',
            count: data.activeDeliveriesCount || 0,
            href: '/seller/delivery-management',
            icon: Truck,
            tone: 'teal',
            show: isSeller,
            priority: false
        },
        {
            label: 'Payment Status',
            count: data.sellerPendingInvoicesCount || 0,
            href: '/payments/transactions',
            icon: Receipt,
            tone: 'rose',
            show: isSeller,
            priority: false
        },
        {
            label: 'Request Quotations',
            count: data.sellerQuotationsCount || 0,
            href: '/seller/rfq',
            icon: FileText,
            tone: 'purple',
            show: isSeller,
            priority: false
        },
        {
            label: 'Live Auctions',
            count: data.reverseAuctionsLive || data.reverseAuctionInvites || 0,
            href: '/seller/opportunities/auctions',
            icon: Gavel,
            tone: 'amber',
            show: isSeller,
            priority: false
        },
        {
            label: 'Invoice Factoring',
            count: 0,
            href: '/factoring',
            icon: Landmark,
            tone: 'slate',
            show: isSeller,
            priority: false
        }
    ], [data, isBuyer, isSeller, hasPermission]);

    const visible = useMemo(() => cards.filter(c => c.show), [cards]);
    const openCard = useCallback((href: string) => router.push(href), [router]);

    if (visible.length === 0) return null;

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 pl-0.5">
                Overview Metrics & Fast Paths
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {visible.map(card => (
                    <KpiCard
                        key={card.label}
                        label={card.label}
                        value={card.isCurrency ? `₹${Number(card.count).toLocaleString('en-IN')}` : card.count}
                        icon={card.icon}
                        tone={card.tone}
                        loading={isLoading}
                        subtext={card.priority && card.count > 0 ? 'Pending Review' : 'View records'}
                        onClick={() => openCard(card.href)}
                    />
                ))}
            </div>
        </div>
    );
}

export default React.memo(RoleAwareActionCards);
