'use client';

import React from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  Clock, 
  Send, 
  Truck, 
  CreditCard, 
  MessageSquare, 
  ArrowRight,
  Landmark,
  FileCheck,
  CheckCircle2,
  Package
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { isShgUser } from '../../../lib/shg';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapApiData } from '../../../lib/api';

interface ActionItem {
  id: string;
  type: 'rfq' | 'dispatch' | 'factoring' | 'clarification';
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: string;
  actionHref: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function UrgentActionsInbox() {
  const { user, token } = useAuth();
  const isShg = isShgUser(user) || user?.role === 'shg';
  const prefix = isShg ? '/shg' : '/seller';
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const { data: summaryData } = useQuery({
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

    const rfqCount = summaryData?.sellerReceivedRfqsCount || summaryData?.sellerRfqsCount || 0;
    if (rfqCount > 0) {
      items.push({
        id: 'act-rfq',
        type: 'rfq',
        title: `${rfqCount} Direct RFQ Quotes Requested by Buyers`,
        subtitle: 'Buyer departments requested formal price quotations for catalogue items.',
        badge: 'Quote Due',
        badgeTone: 'bg-rose-50 text-rose-700 border-rose-200',
        actionHref: `${prefix}/opportunities/rfqs`,
        actionLabel: 'Quote Now',
        icon: Send
      });
    }

    const poCount = summaryData?.sellerActivePOsCount || 0;
    if (poCount > 0) {
      items.push({
        id: 'act-po',
        type: 'dispatch',
        title: `${poCount} Purchase Orders in Fulfillment`,
        subtitle: 'Consignments confirmed. Generate delivery challan and track dispatch.',
        badge: 'Dispatch Pending',
        badgeTone: 'bg-amber-50 text-amber-700 border-amber-200',
        actionHref: `${prefix}/orders`,
        actionLabel: 'View Orders',
        icon: Truck
      });
    }

    const factoringCount = summaryData?.invoiceFactoringCount || 0;
    if (factoringCount > 0) {
      items.push({
        id: 'act-fac',
        type: 'factoring',
        title: `${factoringCount} Invoices Eligible for TReDS Early Payout`,
        subtitle: 'Unlock 24-hour invoice discounting on approved buyer purchase orders.',
        badge: 'Fast Liquidity',
        badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        actionHref: '/factoring',
        actionLabel: 'Get Paid Early',
        icon: Landmark
      });
    }

    return items;
  }, [summaryData, prefix]);

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden flex flex-col">
      {/* ── Card Header ── */}
      <div className="bg-slate-50/50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Priority Tasks & Actions
            </h2>
            <p className="text-[10px] font-medium text-slate-500">
              Time-critical items requiring your action
            </p>
          </div>
        </div>

        {actionItems.length > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-100/80 text-rose-700 border border-rose-200">
            {actionItems.length} Urgent
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
          <div className="p-6 text-center bg-slate-50/60 rounded-lg border border-dashed border-slate-200 space-y-1.5">
            <div className="h-9 w-9 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">No Pending Tasks</h3>
            <p className="text-[10px] font-medium text-slate-500 max-w-xs mx-auto">
              All RFQs answered, shipments dispatched, and invoices processed.
            </p>
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

export default React.memo(UrgentActionsInbox);
