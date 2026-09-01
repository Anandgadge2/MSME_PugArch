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
  FileCheck
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { isShgUser } from '../../../lib/shg';

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
  const { user } = useAuth();
  const isShg = isShgUser(user) || user?.role === 'shg';
  const prefix = isShg ? '/shg' : '/seller';

  const actionItems: ActionItem[] = [
    {
      id: 'act-1',
      type: 'rfq',
      title: '2 RFQ Quotes Requested by Buyer',
      subtitle: 'Zilla Parishad & MIDC requested item quotes. Response due soon.',
      badge: 'Due in 18 hrs',
      badgeTone: 'bg-rose-50 text-rose-700 border-rose-200',
      actionHref: `${prefix}/opportunities/rfqs`,
      actionLabel: 'Quote Now',
      icon: Send
    },
    {
      id: 'act-2',
      type: 'dispatch',
      title: 'PO #8942 Ready for Dispatch',
      subtitle: 'Consignment approved. Please generate delivery challan.',
      badge: '2 Days Left',
      badgeTone: 'bg-amber-50 text-amber-700 border-amber-200',
      actionHref: `${prefix}/orders`,
      actionLabel: 'Create Challan',
      icon: Truck
    },
    {
      id: 'act-3',
      type: 'factoring',
      title: '₹3,40,000 Early Payout Available',
      subtitle: 'Unlock 24-hour TReDS invoice discounting for approved invoices.',
      badge: 'Fast Liquidity',
      badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      actionHref: '/factoring',
      actionLabel: 'Get Paid Early',
      icon: Landmark
    }
  ];

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
              Time-critical items requiring your confirmation
            </p>
          </div>
        </div>

        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-100/80 text-rose-700 border border-rose-200">
          {actionItems.length} Urgent
        </span>
      </div>

      {/* ── Action Items ── */}
      <div className="divide-y divide-slate-100 p-2.5 space-y-2">
        {actionItems.map((item) => {
          const Icon = item.icon;
          return (
            <div 
              key={item.id}
              className="rounded-lg p-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 transition flex items-start gap-2.5"
            >
              <div className="h-7 w-7 rounded-md bg-white text-[#12335f] shadow-xs flex items-center justify-center shrink-0 border border-slate-200/60 mt-0.5">
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <h3 className="text-[11px] font-bold text-slate-900 truncate">
                    {item.title}
                  </h3>
                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${item.badgeTone}`}>
                    {item.badge}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-snug">
                  {item.subtitle}
                </p>
                <div className="mt-2 flex items-center justify-end">
                  <Link href={item.actionHref}>
                    <Button 
                      variant="ghost" 
                      className="h-6 px-2.5 text-[9px] font-bold uppercase tracking-wider text-[#12335f] hover:bg-[#12335f]/10 rounded"
                    >
                      {item.actionLabel}
                      <ArrowRight className="ml-1 h-2.5 w-2.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(UrgentActionsInbox);
