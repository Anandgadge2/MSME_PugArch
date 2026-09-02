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
  FileText,
  Loader2,
  PlusCircle
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { isShgUser } from '../../../lib/shg';
import { procurementOrderApi } from '../../procurementBid/orderApi';

interface OrderItem {
  id: string;
  poNumber: string;
  date: string;
  partyName: string;
  itemName: string;
  quantity: string;
  amount: number;
  status: 'pending_dispatch' | 'in_transit' | 'grn_approved' | 'delivered';
  statusLabel: string;
  actionHref: string;
  actionLabel: string;
}

export function RecentOrdersSnapshot() {
  const { user } = useAuth();
  const isBuyer = user?.role === 'buyer';
  const isShg = isShgUser(user) || user?.role === 'shg';
  const prefix = isBuyer ? '/orders' : (isShg ? '/shg/orders' : '/seller/orders');

  const { data: realOrders, isLoading } = useQuery({
    queryKey: ['dashboard-recent-orders'],
    queryFn: async () => {
      try {
        const res = await procurementOrderApi.listOrders({ take: 5 });
        return res?.items || (Array.isArray(res) ? res : []);
      } catch (e) {
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const orders: OrderItem[] = React.useMemo(() => {
    if (realOrders && realOrders.length > 0) {
      return realOrders.slice(0, 5).map((o: any, idx: number) => {
        const partyName = isBuyer
          ? (o.sellerOrganization?.organizationName || o.seller?.name || o.vendorName || 'Verified MSME Vendor')
          : (o.buyerOrganization?.organizationName || o.buyer?.name || o.departmentName || 'Govt Department');

        const rawStatus = (o.status || 'pending_dispatch') as OrderItem['status'];
        let actionLabel = 'View PO';
        if (isBuyer) {
          if (rawStatus === 'in_transit') actionLabel = 'Confirm GRN';
          else if (rawStatus === 'delivered') actionLabel = 'Inspect';
          else if (rawStatus === 'grn_approved') actionLabel = 'Invoiced';
        } else {
          if (rawStatus === 'pending_dispatch') actionLabel = 'Challan';
          else if (rawStatus === 'in_transit') actionLabel = 'Track';
        }

        return {
          id: String(o.id || idx),
          poNumber: o.poNumber || `PO-${o.id || 9000 + idx}`,
          date: o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
          partyName,
          itemName: o.title || o.items?.[0]?.name || o.description || 'Procurement Order',
          quantity: o.quantity || (o.items?.length ? `${o.items.length} items` : '1 Lot'),
          amount: Number(o.totalAmount || o.grandTotal || o.amount || 0),
          status: rawStatus,
          statusLabel: String(o.status || (isBuyer ? 'In Fulfillment' : 'Pending Dispatch')).replace(/_/g, ' ').toUpperCase(),
          actionHref: isBuyer ? `/orders` : `${prefix}`,
          actionLabel
        };
      });
    }
    return [];
  }, [realOrders, isBuyer, prefix]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_dispatch':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'in_transit':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'delivered':
        return 'bg-purple-50 text-purple-700 border-purple-200';
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
              {isBuyer ? 'Inbound Orders & Delivery Tracking' : 'Recent Orders & Fulfillment Tracking'}
            </h2>
            <p className="text-[10px] font-medium text-slate-500">
              {isBuyer 
                ? 'Active purchase orders in dispatch, inbound transit, or awaiting GRN sign-off'
                : 'Active purchase orders awaiting dispatch, transit, or GRN inspection'}
            </p>
          </div>
        </div>

        <Link 
          href={isBuyer ? '/orders' : prefix}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#12335f] hover:text-[#0b2445] transition shrink-0"
        >
          All Orders ({orders.length})
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Orders Table / Empty State ── */}
      {isLoading ? (
        <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#12335f]" />
          <span className="text-xs font-medium">Loading orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center bg-slate-50/50 border-t border-slate-100">
          <Package className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-700">No purchase orders found.</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isBuyer 
              ? 'Awarded contracts and purchase orders awaiting fulfillment will appear here.'
              : 'Orders received from buyer departments will appear here.'}
          </p>
          {isBuyer && (
            <Link href="/buyer/procurement/create" className="mt-3 inline-block">
              <Button className="h-7 bg-[#12335f] hover:bg-[#0b2445] text-white rounded text-[10px] font-bold uppercase">
                <PlusCircle className="mr-1 h-3 w-3" />
                Create Procurement
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                <th scope="col" className="px-3.5 py-2">PO & Date</th>
                <th scope="col" className="px-3 py-2">{isBuyer ? 'Supplier / MSME Vendor' : 'Buyer Department'}</th>
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
                      {order.partyName}
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
                        {order.actionLabel}
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default React.memo(RecentOrdersSnapshot);
