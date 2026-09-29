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
    Inbox, Package, Receipt, Send, Store, Truck, Landmark, IndianRupee,
    Layers, RotateCcw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { isShgUser } from '../../../lib/shg';
import { getApi } from '../../shared/apiClient';
import { KpiCard, type KpiCardTone } from '../../shared/KpiCard';

interface DashboardSummary {
    cartItemCount?: number;
    pendingApprovalsCount?: number;
    cartApprovalsCount?: number;
    techReviewCount?: number;
    grnsToApproveCount?: number;
    grnsCount?: number;
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
    sellerRfpsCount?: number;
    sellerOpportunitiesCount?: number;
    sellerActivePOsCount?: number;
    sellerCatalogueItemsCount?: number;
    sellerPendingInvoicesCount?: number;
    sellerQuotationsCount?: number;
    sellerSubmittedBidsCount?: number;
    sellerRfqsCount?: number;
    sellerReceivedRfqsCount?: number;
    sellerRateContractsCount?: number;
    invoiceFactoringCount?: number;
    reverseAuctionsActive?: number;
    reverseAuctionsScheduled?: number;
    reverseAuctionsClosed?: number;
    reverseAuctionInvites?: number;
    reverseAuctionsLive?: number;
    reverseAuctionBidsSubmitted?: number;
    buyerProcurementActiveBidsCount?: number;
    buyerProcurementTotalSpentValue?: number;
    buyerPaymentTransactionsCount?: number;
    buyerPaymentTransactionsTotal?: number;
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
    subtext: string;
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
    const isShgAccount = isShgUser(user) || user?.role === 'shg';
    const isSeller = (user?.role === 'seller' || isShgAccount) && !isBuyer;
    const sellerPrefix = isShgAccount ? '/shg' : '/seller';

    // Strictly 6 KPI cards per role
    const cards: ActionCardConfig[] = useMemo(() => {
        if (isBuyer) {
            return [
                {
                    label: 'Active Procurements',
                    count: data.activeProcurementsCount ?? data.myTendersCount ?? 0,
                    href: '/buyer/my-procurements',
                    icon: ClipboardList,
                    tone: 'indigo',
                    show: true,
                    priority: false,
                    subtext: 'Published requisitions'
                },
                {
                    label: 'Bids Under Review',
                    count: data.buyerProcurementActiveBidsCount ?? data.supplierResponsesCount ?? 0,
                    href: '/buyer/my-procurements?tab=evaluation',
                    icon: Gavel,
                    tone: 'purple',
                    show: true,
                    priority: false,
                    subtext: 'Vendor bids received'
                },
                {
                    label: 'Active Orders',
                    count: data.myActivePOsCount || 0,
                    href: '/orders?tab=Open',
                    icon: Package,
                    tone: 'blue',
                    show: true,
                    priority: false,
                    subtext: 'Orders in fulfillment'
                },
                {
                    label: 'Payment Outflow',
                    count: data.buyerPaymentTransactionsTotal ?? 0,
                    href: '/payments/transactions',
                    icon: IndianRupee,
                    tone: 'emerald',
                    show: true,
                    priority: false,
                    isCurrency: true,
                    subtext: `${data.buyerPaymentTransactionsCount || 0} transactions processed`
                },
                {
                    label: 'Goods Receipt (GRN)',
                    count: data.grnsCount ?? data.grnsToApproveCount ?? 0,
                    href: '/buyer/grn',
                    icon: ClipboardCheck,
                    tone: 'amber',
                    show: true,
                    priority: (data.grnsToApproveCount ?? 0) > 0,
                    subtext: (data.grnsToApproveCount ?? 0) > 0 
                        ? `${data.grnsToApproveCount} pending inspection` 
                        : (data.grnsCount ?? 0) > 0 
                            ? `${data.grnsCount} verified receipts` 
                            : 'Consignments received'
                },
                {
                    label: 'Pending Invoices',
                    count: data.myPendingInvoicesCount || 0,
                    href: '/payments/invoices',
                    icon: Receipt,
                    tone: 'rose',
                    show: true,
                    priority: false,
                    subtext: 'Awaiting 3-way clearance'
                }
            ];
        }

        if (isShgAccount) {
            return [
                {
                    label: 'Open Demands',
                    count: data.sellerOpportunitiesCount ?? 0,
                    href: '/shg/opportunities',
                    icon: ClipboardList,
                    tone: 'indigo',
                    show: true,
                    priority: false,
                    subtext: 'SHG eligible leads'
                },
                {
                    label: 'Submitted Quotes',
                    count: data.sellerSubmittedBidsCount ?? data.sellerQuotationsCount ?? 0,
                    href: '/shg/bids/submitted',
                    icon: Gavel,
                    tone: 'purple',
                    show: true,
                    priority: false,
                    subtext: 'Quotations in review'
                },
                {
                    label: 'Orders to Fulfill',
                    count: data.sellerActivePOsCount || 0,
                    href: '/shg/orders',
                    icon: Package,
                    tone: 'emerald',
                    show: true,
                    priority: false,
                    subtext: 'Active work orders'
                },
                {
                    label: 'Catalogue Items',
                    count: data.sellerCatalogueItemsCount || 0,
                    href: '/shg/products',
                    icon: Store,
                    tone: 'cyan',
                    show: true,
                    priority: false,
                    subtext: 'Listed products'
                },
                {
                    label: 'Active Deliveries',
                    count: data.activeDeliveriesCount || 0,
                    href: '/shg/delivery-management',
                    icon: Truck,
                    tone: 'teal',
                    show: true,
                    priority: false,
                    subtext: 'Shipments in transit'
                },
                {
                    label: 'Payment Receivables',
                    count: data.sellerPendingInvoicesCount || 0,
                    href: '/shg/payments',
                    icon: Receipt,
                    tone: 'rose',
                    show: true,
                    priority: false,
                    subtext: 'Invoices under review'
                }
            ];
        }

        // Standard Seller
        return [
            {
                label: 'Live Opportunities',
                count: data.sellerOpportunitiesCount ?? ((data.sellerOpenTendersCount || 0) + (data.sellerRfqsCount || 0)),
                href: `${sellerPrefix}/opportunities`,
                icon: ClipboardList,
                tone: 'indigo',
                show: true,
                priority: false,
                subtext: 'Tenders & RFQs open'
            },
            {
                label: 'Submitted Proposals',
                count: data.sellerSubmittedBidsCount ?? data.sellerQuotationsCount ?? 0,
                href: `${sellerPrefix}/bids/submitted`,
                icon: Gavel,
                tone: 'purple',
                show: true,
                priority: false,
                subtext: 'Bids under evaluation'
            },
            {
                label: 'Orders Received',
                count: data.sellerActivePOsCount || 0,
                href: `${sellerPrefix}/orders`,
                icon: Package,
                tone: 'emerald',
                show: true,
                priority: false,
                subtext: 'Orders to fulfill'
            },
            {
                label: 'Realized Revenue',
                count: (data as any).sellerRealizedRevenue || 0,
                href: '/payments/transactions',
                icon: IndianRupee,
                tone: 'emerald',
                show: true,
                priority: false,
                isCurrency: true,
                subtext: 'Cumulative sales volume'
            },
            {
                label: 'Active Deliveries',
                count: data.activeDeliveriesCount || 0,
                href: `${sellerPrefix}/delivery-management`,
                icon: Truck,
                tone: 'teal',
                show: true,
                priority: false,
                subtext: 'Shipments in transit'
            },
            {
                label: 'Payment Status',
                count: data.sellerPendingInvoicesCount || 0,
                href: '/payments/invoices',
                icon: Receipt,
                tone: 'rose',
                show: true,
                priority: false,
                subtext: 'Invoices under payout'
            }
        ];
    }, [data, isBuyer, isShgAccount, sellerPrefix]);

    const visible = useMemo(() => cards.filter(c => c.show).slice(0, 6), [cards]);
    const openCard = useCallback((href: string) => router.push(href), [router]);

    if (visible.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 pl-0.5 flex items-center gap-1.5">
                    Overview Metrics & Quick Actions
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        6 KPIs
                    </span>
                </h4>
            </div>
            {/* Strictly 6 KPI cards in a single row on desktop (lg:grid-cols-6) and 2 in mobile (grid-cols-2) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {visible.map(card => (
                    <KpiCard
                        key={card.label}
                        label={card.label}
                        value={card.isCurrency ? `₹${Number(card.count).toLocaleString('en-IN')}` : card.count}
                        icon={card.icon}
                        tone={card.tone}
                        loading={isLoading}
                        subtext={card.subtext}
                        onClick={() => openCard(card.href)}
                    />
                ))}
            </div>
        </div>
    );
}

export default React.memo(RoleAwareActionCards);
