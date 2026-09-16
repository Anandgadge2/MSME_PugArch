import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  Calendar,
  MapPin,
  Package,
  ShieldCheck,
  Plus,
  Minus,
  X,
  Building2,
  Copy,
  Clock,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../shared/format';
import type { PurchaseOrderDto } from '../../shared/types';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';

export interface RepeatPurchaseOrderModalProps {
  order: PurchaseOrderDto;
  onClose: () => void;
  onSuccess?: (newPo?: any) => void;
}

const readableStatus = (value?: string) =>
  String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export function RepeatPurchaseOrderModal({
  order,
  onClose,
  onSuccess
}: RepeatPurchaseOrderModalProps) {
  // First item or order fallback
  const firstItem = order.items?.[0];
  const originalQty = Number(firstItem?.quantity || 1);
  const unitPrice = Number(firstItem?.unitPrice || order.amount || order.totalValue || 0);

  // Form states
  const [quantity, setQuantity] = useState<number>(originalQty || 1);
  const [deliveryAddress, setDeliveryAddress] = useState<string>(order.deliveryAddress || '');
  
  // Default delivery date: 14 days from today
  const defaultDeliveryDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  }, []);
  
  const [expectedDelivery, setExpectedDelivery] = useState<string>(defaultDeliveryDate);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Quick quantity presets
  const quantityPresets = useMemo(() => {
    const base = Math.max(1, originalQty);
    return [
      { label: `1x (${base})`, val: base },
      { label: `2x (${base * 2})`, val: base * 2 },
      { label: `5x (${base * 5})`, val: base * 5 },
      { label: `10x (${base * 10})`, val: base * 10 },
    ];
  }, [originalQty]);

  // Quick delivery date presets
  const datePresets = useMemo(() => {
    const getFutureDate = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };
    return [
      { label: '+7 Days (Express)', val: getFutureDate(7) },
      { label: '+14 Days (Standard)', val: getFutureDate(14) },
      { label: '+30 Days (Scheduled)', val: getFutureDate(30) },
    ];
  }, []);

  // Calculated values
  const totalAmount = useMemo(() => {
    return Math.max(0, quantity) * unitPrice;
  }, [quantity, unitPrice]);

  const originalTotal = useMemo(() => {
    return Number(order.amount || order.totalValue || (originalQty * unitPrice));
  }, [order, originalQty, unitPrice]);

  const priceDelta = totalAmount - originalTotal;

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      toast.error('Order quantity must be at least 1');
      return;
    }
    if (!deliveryAddress.trim()) {
      toast.error('Delivery Address is required');
      return;
    }
    if (!expectedDelivery) {
      toast.error('Expected Delivery Date is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/api/purchase-orders/${order.id}/repeat`, {
        quantity: Number(quantity),
        deliveryAddress: deliveryAddress.trim(),
        expectedDelivery: new Date(expectedDelivery).toISOString()
      });

      const data = await res.json().catch(() => ({}));
      toast.success('Repeat Purchase Order placed successfully!');
      onClose();
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to place repeat purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repeat-order-title"
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Top Header - Portal Navy Gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#07172e] via-[#12335f] to-[#1e4b8a] text-white px-6 py-5 shrink-0">
          <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-indigo-400/10 blur-2xl pointer-events-none" />

          <div className="relative flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-200 border border-white/15 backdrop-blur-sm">
                  <RefreshCw className="h-3 w-3 text-blue-300" /> Reorder & Replenishment
                </span>
              </div>
              <h2 id="repeat-order-title" className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-sm">
                Repeat Purchase Order
              </h2>
              <div className="flex items-center gap-2 flex-wrap text-xs text-blue-100/90 pt-0.5">
                <span>Replicating completed order</span>
                <span className="inline-flex items-center gap-1 font-mono font-bold bg-white/15 px-2 py-0.5 rounded text-white border border-white/10">
                  {order.poNumber || `PO-${order.id}`}
                  <button
                    type="button"
                    onClick={() => {
                      if (order.poNumber) {
                        navigator.clipboard.writeText(order.poNumber);
                        toast.success('PO number copied');
                      }
                    }}
                    className="hover:text-blue-200 transition-colors p-0.5 cursor-pointer"
                    title="Copy PO Number"
                    aria-label="Copy PO Number"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-all border border-white/15 shadow-sm shrink-0 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4 flex-1 bg-slate-50/50">
          
          {/* Historical Insights Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 block">Unit Rate Continuity</span>
              <p className="text-xs font-black text-slate-900 mt-0.5 font-mono">
                {formatCurrency(unitPrice)} <span className="text-[10px] font-medium text-slate-500 font-sans">/ unit</span>
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 block">Supplier Status</span>
              <p className="text-xs font-black text-slate-900 mt-0.5 truncate flex items-center gap-1" title={order.seller?.name || 'Verified Supplier'}>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                {order.seller?.name || 'Verified Supplier'}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 block">Original Fulfilled</span>
              <p className="text-xs font-black text-slate-900 mt-0.5">
                {formatDate(order.expectedDelivery || order.updatedAt || order.createdAt)}
              </p>
            </div>
          </div>

          <form id="repeat-po-form" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Product / Material Card */}
            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                    Product / Material Details
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                    {firstItem?.itemName || order.title}
                  </h3>
                </div>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {readableStatus(order.paymentTerms || 'Standard Invoice')}
                </span>
              </div>

              {(firstItem as any)?.itemDescription && (
                <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                  {(firstItem as any).itemDescription}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Contracted Unit Rate</span>
                  <span className="font-mono font-black text-slate-900 text-xs mt-0.5 block">{formatCurrency(unitPrice)}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Original Order Volume</span>
                  <span className="font-mono font-bold text-slate-700 text-xs mt-0.5 block">{originalQty} unit(s)</span>
                </div>
              </div>
            </div>

            {/* Quantity Selector with Stepper and Presets */}
            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="repeat-quantity-input" className="block text-xs font-black uppercase tracking-wider text-slate-800">
                    Order Quantity
                  </label>
                  <p className="text-[10px] font-semibold text-slate-400">Specify replenishment units required</p>
                </div>
                <span className="font-mono text-xs font-bold text-[#12335f] bg-blue-50 border border-blue-200/60 px-2.5 py-1 rounded-lg">
                  {quantity} unit(s)
                </span>
              </div>

              {/* Stepper Input */}
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-2xs p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={quantity <= 1}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    aria-label="Decrease quantity by 1"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <input
                    id="repeat-quantity-input"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center font-mono font-black text-sm text-slate-900 outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => prev + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#12335f] text-white hover:bg-[#0b2445] transition-all cursor-pointer shadow-2xs"
                    aria-label="Increase quantity by 1"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                  {quantityPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setQuantity(preset.val)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        quantity === preset.val
                          ? "bg-[#12335f] text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Expected Delivery Date with Timeline Chips */}
            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
              <div>
                <label htmlFor="repeat-date-input" className="block text-xs font-black uppercase tracking-wider text-slate-800">
                  Expected Delivery Date
                </label>
                <p className="text-[10px] font-semibold text-slate-400">Target fulfillment timeline for this shipment</p>
              </div>

              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="repeat-date-input"
                  type="date"
                  required
                  value={expectedDelivery}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-xs font-bold text-slate-900 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs transition-colors"
                />
              </div>

              {/* Quick Date Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {datePresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setExpectedDelivery(preset.val)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer",
                      expectedDelivery === preset.val
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="repeat-address-input" className="block text-xs font-black uppercase tracking-wider text-slate-800">
                  Consignment Delivery Address
                </label>
                {order.deliveryAddress && deliveryAddress !== order.deliveryAddress && (
                  <button
                    type="button"
                    onClick={() => setDeliveryAddress(order.deliveryAddress || '')}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Reset to Original PO Address
                  </button>
                )}
              </div>

              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <textarea
                  id="repeat-address-input"
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter detailed delivery premises, gate no., pin code..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs transition-colors leading-relaxed"
                />
              </div>
            </div>

            {/* Financial Summary Breakdown */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-[#12335f] text-white p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2.5">
                <span className="text-slate-300">Rate Calculation ({quantity} × {formatCurrency(unitPrice)})</span>
                <span className="font-mono font-bold text-white">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 block">
                    Estimated Total Value
                  </span>
                  <p className="text-[10px] text-slate-300">
                    {priceDelta === 0 ? (
                      'Same value as previous fulfillment'
                    ) : priceDelta > 0 ? (
                      `+${formatCurrency(priceDelta)} higher volume than original`
                    ) : (
                      `-${formatCurrency(Math.abs(priceDelta))} lower volume than original`
                    )}
                  </p>
                </div>
                <span className="text-xl font-black font-mono text-white tracking-tight">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

          </form>
        </div>

        {/* Modal Sticky Footer - Single Row */}
        <div className="border-t border-slate-200 bg-white px-6 py-3.5 shrink-0 flex items-center justify-between gap-3 shadow-lg">
          <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
            Generates a new PO with status <span className="font-bold text-slate-800">Order Placed</span>.
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 rounded-xl border-slate-300 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 px-4"
            >
              Cancel
            </Button>
            <Button
              form="repeat-po-form"
              type="submit"
              disabled={submitting}
              className="h-9 bg-[#12335f] text-xs font-black uppercase tracking-wider text-white hover:bg-[#0b2445] rounded-xl px-5 shadow-sm flex items-center gap-2"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", submitting && "animate-spin")} />
              {submitting ? 'Placing Order...' : 'Confirm Repeat Order'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
