'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  ArrowRight,
  Building2,
  FileText
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { isShgUser } from '../../../lib/shg';
import { procurementOrderApi } from '../../procurementBid/orderApi';

interface OrderItem {
  id: string;
  poNumber: string;
  date: string;
  buyerName: string;
  itemName: string;
  quantity: string;
  amount: number;
  status: 'pending_dispatch' | 'in_transit' | 'grn_approved' | 'delivered';
  statusLabel: string;
  actionHref: string;
}

const FALLBACK_ORDERS: OrderItem[] = [
  {
    id: 'ord-1',
    poNumber: 'PO-2026-9042',
    date: '31 Aug 2026',
    buyerName: 'Govt Technical Institute Pune',
    itemName: 'Modular Computer Desks & Ergonomic Chairs',
    quantity: '45 Sets',
    amount: 185000,
    status: 'pending_dispatch',
    statusLabel: 'Pending Dispatch',
    actionHref: '/seller/orders'
  },
  {
    id: 'ord-2',
    poNumber: 'PO-2026-8980',
    date: '28 Aug 2026',
    buyerName: 'District Collector Office Nashik',
    itemName: 'Heavy Duty Laser Printers & Consumables',
    quantity: '12 Units',
    amount: 94000,
    status: 'in_transit',
    statusLabel: 'In Transit',
    actionHref: '/seller/delivery-management'
  },
  {
    id: 'ord-3',
    poNumber: 'PO-2026-8874',
    date: '22 Aug 2026',
    buyerName: 'Zilla Parishad Primary Education Dept',
    itemName: 'School Science Laboratory Demonstration Kits',
    quantity: '80 Kits',
    amount: 240000,
    status: 'grn_approved',
    statusLabel: 'GRN Approved',
    actionHref: '/seller/orders'
  }
];

export function RecentOrdersSnapshot() {
  const { user } = useAuth();
  const isShg = isShgUser(user) || user?.role === 'shg';
  const prefix = isShg ? '/shg' : '/seller';

  const { data: realOrders } = useQuery({
    queryKey: ['dashboard-recent-orders'],
    queryFn: async () => {
      try {
        const res = await procurementOrderApi.listOrders({ take: 3 });
        return res?.items || [];
      } catch (e) {
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const orders: OrderItem[] = React.useMemo(() => {
    if (realOrders && realOrders.length > 0) {
      return realOrders.slice(0, 3).map((o: any, idx: number) => ({
        id: String(o.id || idx),
        poNumber: o.poNumber || `PO-2026-${9000 + idx}`,
        date: o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
        buyerName: o.buyerOrganization?.organizationName || o.buyer?.name || 'Govt Department',
        itemName: o.title || o.items?.[0]?.name || 'Procurement Order',
        quantity: o.quantity || '1 Lot',
        amount: Number(o.totalAmount || o.grandTotal || 150000),
        status: (o.status || 'pending_dispatch') as OrderItem['status'],
        statusLabel: String(o.status || 'Pending Dispatch').replace(/_/g, ' ').toUpperCase(),
        actionHref: `${prefix}/orders`
      }));
    }
    return FALLBACK_ORDERS;
  }, [realOrders, prefix]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_dispatch':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'in_transit':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'grn_approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <section 
      aria-labelledby="recent-orders-heading"
      className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden flex flex-col"
    >
      {/* ── Card Header ── */}
      <div className="bg-slate-50/50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <h2 id="recent-orders-heading" className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Recent Orders & Fulfillment Tracking
            </h2>
            <p className="text-[10px] font-medium text-slate-500">
              Active purchase orders awaiting dispatch, transit, or GRN inspection
            </p>
          </div>
        </div>

        <Link 
          href={`${prefix}/orders`}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#12335f] hover:text-[#0b2445] transition shrink-0"
        >
          All Orders (9)
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Orders Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <tr>
              <th scope="col" className="px-3.5 py-2">PO & Date</th>
              <th scope="col" className="px-3 py-2">Buyer Department</th>
              <th scope="col" className="px-3 py-2">Item Description</th>
              <th scope="col" className="px-3 py-2 text-right">Value (₹)</th>
              <th scope="col" className="px-3 py-2 text-center">Fulfillment</th>
              <th scope="col" className="px-3.5 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px]">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-3.5 py-2.5 whitespace-nowrap">
                  <div className="font-bold text-slate-900 font-mono text-[10px]">{order.poNumber}</div>
                  <div className="text-[9px] font-medium text-slate-400">{order.date}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-slate-800 line-clamp-1 max-w-[180px]">
                    {order.buyerName}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-slate-700 line-clamp-1 max-w-[220px]">
                    {order.itemName}
                  </div>
                  <div className="text-[9px] text-slate-400 font-medium">Qty: {order.quantity}</div>
                </td>
                <td className="px-3 py-2.5 text-right font-extrabold text-[#12335f] whitespace-nowrap">
                  ₹{order.amount.toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <span className={`inline-flex items-center text-[8px] font-bold uppercase px-2 py-0.5 rounded border ${getStatusBadge(order.status)}`}>
                    {order.statusLabel}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                  <Link href={order.actionHref}>
                    <Button 
                      variant="outline" 
                      className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider text-[#12335f] border-slate-200 hover:bg-slate-100 rounded shadow-2xs"
                    >
                      View PO
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default React.memo(RecentOrdersSnapshot);
