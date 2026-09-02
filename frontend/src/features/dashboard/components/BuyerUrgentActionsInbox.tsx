'use client';

import React from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  Clock, 
  Gavel, 
  Truck, 
  CreditCard, 
  ArrowRight,
  ClipboardCheck,
  FileCheck,
  Inbox,
  CheckCircle2,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapApiData } from '../../../lib/api';

interface ActionItem {
  id: string;
  type: 'evaluation' | 'grn' | 'invoice' | 'approval';
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: string;
  actionHref: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function BuyerUrgentActionsInbox() {
  const { user, token } = useAuth();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.fetch('/api/dashboard/summary', { headers: authHeaders });
      if (!res.ok) return null;
      const json = await res.json();
      return unwrapApiData<any>(json);
    },
    enabled: !!token,
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const actionItems: ActionItem[] = React.useMemo(() => {
    const items: ActionItem[] = [];

    // 1. Pending Bid Evaluations
    const bidsCount = summaryData?.supplierResponsesCount || summaryData?.buyerProcurementActiveBidsCount || 0;
    if (bidsCount > 0) {
      items.push({
        id: 'act-bids',
        type: 'evaluation',
        title: `${bidsCount} Vendor Bids Awaiting Evaluation`,
        subtitle: 'Technical evaluation and L1 compliance review required before opening commercials.',
        badge: 'Evaluation Due',
        badgeTone: 'bg-amber-50 text-amber-700 border-amber-200',
        actionHref: '/buyer/procurement/responses',
        actionLabel: 'Evaluate Bids',
        icon: Gavel
      });
    }

    // 2. Goods Receipt & Inspection Verification (GRN)
    const grnCount = summaryData?.grnsToApproveCount || 0;
    if (grnCount > 0) {
      items.push({
        id: 'act-grn',
        type: 'grn',
        title: `${grnCount} Consignments Delivered — Confirm GRN`,
        subtitle: 'Physical goods delivered at warehouse. Verify inspection check & issue GRN.',
        badge: 'Inspection Due',
        badgeTone: 'bg-blue-50 text-blue-700 border-blue-200',
        actionHref: '/orders/delivery-confirmation',
        actionLabel: 'Verify GRN',
        icon: Truck
      });
    }

    // 3. Invoices Awaiting Payment Clearance (3-Way Match)
    const invoiceCount = summaryData?.myPendingInvoicesCount || 0;
    if (invoiceCount > 0) {
      items.push({
        id: 'act-inv',
        type: 'invoice',
        title: `${invoiceCount} Verified Invoices Ready for Payment`,
        subtitle: '3-Way Match (PO + GRN + Invoice) cleared. Ready for milestone payment release.',
        badge: 'Payment Due',
        badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        actionHref: '/payments/invoices',
        actionLabel: 'Release Payment',
        icon: CreditCard
      });
    }

    // 4. Cart / Requisition Approvals (If department approver)
    const pendingApprovals = (summaryData?.pendingApprovalsCount || 0) + (summaryData?.cartApprovalsCount || 0);
    if (pendingApprovals > 0) {
      items.push({
        id: 'act-appr',
        type: 'approval',
        title: `${pendingApprovals} Internal Requisitions to Approve`,
        subtitle: 'Department purchases submitted for authorization and budget sign-off.',
        badge: 'Approval Queue',
        badgeTone: 'bg-purple-50 text-purple-700 border-purple-200',
        actionHref: '/cart/approvals',
        actionLabel: 'Review Cart',
        icon: Inbox
      });
    }

    return items;
  }, [summaryData]);

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden flex flex-col transition-all">
      {/* ── Card Header ── */}
      <div className="bg-slate-50/50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Procurement Tasks & Action Inbox
            </h2>
            <p className="text-[10px] font-medium text-slate-500">
              Time-critical evaluations, GRN sign-offs, and approvals
            </p>
          </div>
        </div>

        {actionItems.length > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100/80 text-amber-800 border border-amber-200">
            {actionItems.length} Actions
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            All Clear
          </span>
        )}
      </div>

      {/* ── Action Items / Empty State ── */}
      <div className="p-2.5">
        {actionItems.length === 0 ? (
          <div className="p-6 text-center bg-slate-50/60 rounded-lg border border-dashed border-slate-200 space-y-2">
            <div className="h-9 w-9 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">All Caught Up!</h3>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5 max-w-xs mx-auto leading-relaxed">
                No urgent tasks pending. All bids evaluated, deliveries confirmed, and invoices processed.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <Link href="/buyer/marketplace">
                <Button variant="outline" className="h-7 px-2.5 text-[9px] font-bold uppercase tracking-wider bg-white">
                  <ShoppingBag className="mr-1 h-3 w-3" />
                  Explore Market
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 space-y-2">
            {actionItems.map((item) => {
              const Icon = item.icon;
              return (
                <div 
                  key={item.id}
                  className="group p-2.5 rounded-lg border border-slate-100 bg-white hover:border-[#12335f]/20 hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 text-[#12335f] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#12335f] group-hover:text-white transition">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs font-bold text-slate-900 truncate leading-tight">
                          {item.title}
                        </h3>
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${item.badgeTone}`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-snug line-clamp-2">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex sm:justify-end">
                    <Link href={item.actionHref} className="w-full sm:w-auto">
                      <Button 
                        className="w-full sm:w-auto h-7 px-3 text-[10px] font-bold uppercase tracking-wide bg-[#12335f] hover:bg-[#0b2445] text-white rounded transition flex items-center justify-center gap-1 shadow-xs"
                      >
                        {item.actionLabel}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(BuyerUrgentActionsInbox);
