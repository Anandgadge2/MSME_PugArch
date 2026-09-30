'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Truck,
  Calendar,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Layers,
  Info,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { createCallOffOrder, type RateContractMetadata, type RateContractUtilizationDto } from '../api';
import { cn } from '../../../lib/utils';
import { FocusTrap } from '../../../components/ui/FocusTrap';

export interface IssueCallOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: number;
  contractNumber?: string;
  contractTitle?: string;
  sellerId: number;
  sellerName?: string;
  metadata?: RateContractMetadata | any;
  utilization?: RateContractUtilizationDto | null;
  defaultDeliveryAddress?: string;
  onSuccess?: (createdPO: any) => void;
}

export function IssueCallOffModal({
  isOpen,
  onClose,
  contractId,
  contractNumber,
  contractTitle,
  sellerId,
  sellerName = 'Empanelled Rate Contract Supplier',
  metadata,
  utilization,
  defaultDeliveryAddress = '',
  onSuccess,
}: IssueCallOffModalProps) {
  const meta: any = metadata || {};
  const scheduleItems: any[] = Array.isArray(meta.itemRateSchedule) ? meta.itemRateSchedule : [];
  const minOrderQty = Number(meta.minimumOrderQuantity || 0);
  const maxOrderQty = Number(meta.maximumOrderQuantityPerCallOff || 0);
  const slaDays = Number(meta.deliverySlaDays || 15);

  const [deliveryAddress, setDeliveryAddress] = useState(defaultDeliveryAddress);
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [orderTitle, setOrderTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Pre-calculate default expected delivery date (Today + SLA Days)
  useEffect(() => {
    if (isOpen) {
      const d = new Date();
      d.setDate(d.getDate() + slaDays);
      setExpectedDelivery(d.toISOString().slice(0, 10));
      if (!deliveryAddress && defaultDeliveryAddress) {
        setDeliveryAddress(defaultDeliveryAddress);
      }
      // Initialize items with 0
      const initial: Record<string, number> = {};
      scheduleItems.forEach(it => {
        const key = it.itemName || it.name || it.id;
        initial[key] = 0;
      });
      setItemQuantities(initial);
      setValidationErrors([]);
    }
  }, [isOpen, slaDays, defaultDeliveryAddress, scheduleItems]);

  // Lookup map for item utilization / remaining balance
  const remainingQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    if (utilization?.items && Array.isArray(utilization.items)) {
      for (const u of utilization.items) {
        map.set(String(u.itemName).trim().toLowerCase(), Number(u.remainingQuantity ?? u.contractedQuantity ?? 0));
      }
    } else {
      // Fallback to estimated annual quantity
      for (const it of scheduleItems) {
        const key = String(it.itemName || it.name || '').trim().toLowerCase();
        map.set(key, Number(it.estimatedAnnualQuantity || it.quantity || 999999));
      }
    }
    return map;
  }, [utilization, scheduleItems]);

  // Compute summary totals for current call-off input
  const { totalCallOffQty, totalEstimatedValue, activeItemsList } = useMemo(() => {
    let qtySum = 0;
    let valSum = 0;
    const activeList: Array<{
      itemName: string;
      quantity: number;
      unitOfMeasure: string;
      unitPrice: number;
      taxRate: number;
      lineTotal: number;
    }> = [];

    for (const it of scheduleItems) {
      const name = String(it.itemName || it.name || '').trim();
      const key = it.itemName || it.name || it.id;
      const q = Number(itemQuantities[key] || 0);
      const unitRate = Number(it.baseRate ?? it.unitPrice ?? 0);
      const gst = Number(it.gst ?? it.taxRate ?? 18);
      const lineCost = q * unitRate * (1 + gst / 100);

      if (q > 0) {
        qtySum += q;
        valSum += lineCost;
        activeList.push({
          itemName: name,
          quantity: q,
          unitOfMeasure: String(it.uom || it.unitOfMeasure || 'Nos'),
          unitPrice: unitRate,
          taxRate: gst,
          lineTotal: lineCost,
        });
      }
    }
    return {
      totalCallOffQty: qtySum,
      totalEstimatedValue: valSum,
      activeItemsList: activeList,
    };
  }, [scheduleItems, itemQuantities]);

  const handleQtyChange = (key: string, valStr: string, maxAvailable: number) => {
    const n = Math.max(0, parseInt(valStr, 10) || 0);
    setItemQuantities(prev => ({
      ...prev,
      [key]: n,
    }));
  };

  const handleSetMaxForLine = (key: string, maxAvailable: number) => {
    setItemQuantities(prev => ({
      ...prev,
      [key]: maxAvailable,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!deliveryAddress.trim()) {
      errors.push('Delivery consignee address is mandatory.');
    }
    if (activeItemsList.length === 0) {
      errors.push('Please enter a quantity greater than zero for at least one item.');
    }
    if (minOrderQty > 0 && totalCallOffQty < minOrderQty) {
      errors.push(`Total call-off quantity (${totalCallOffQty}) is below the minimum allowed quantity of ${minOrderQty} units.`);
    }
    if (maxOrderQty > 0 && totalCallOffQty > maxOrderQty) {
      errors.push(`Total call-off quantity (${totalCallOffQty}) exceeds the maximum allowed release ceiling of ${maxOrderQty} units per call-off.`);
    }

    // Check individual line ceilings
    for (const item of activeItemsList) {
      const remaining = remainingQtyMap.get(item.itemName.toLowerCase()) ?? 999999;
      if (item.quantity > remaining) {
        errors.push(`Requested quantity (${item.quantity}) for "${item.itemName}" exceeds remaining contract balance (${remaining} available).`);
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error(errors[0]);
      return;
    }

    setValidationErrors([]);
    setIsSubmitting(true);

    try {
      const createdPO = await createCallOffOrder(contractId, {
        sellerId,
        title: orderTitle.trim() || `Call-off Release for ${contractNumber || `RC-${contractId}`}`,
        deliveryAddress: deliveryAddress.trim(),
        expectedDelivery: expectedDelivery || undefined,
        items: activeItemsList.map(it => ({
          itemName: it.itemName,
          quantity: it.quantity,
          unitOfMeasure: it.unitOfMeasure,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
        })),
      });

      toast.success('Call-Off Purchase Order generated and dispatched to seller successfully!');
      if (onSuccess) onSuccess(createdPO);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to issue call-off purchase order';
      toast.error(msg);
      setValidationErrors([msg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-calloff-title"
    >
      <FocusTrap>
        <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-[#12335f] text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white border border-white/20">
                <Truck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="issue-calloff-title" className="text-base font-black tracking-tight">
                  Issue Call-Off Purchase Order
                </h3>
                <p className="text-xs text-white/80 font-medium">
                  {contractNumber ? `Rate Contract #${contractNumber}` : 'Master Rate Contract'} • {sellerName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[calc(85vh-140px)] overflow-y-auto">
            {/* Context callout & bounds notice */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-700 shrink-0" />
                <span className="font-medium">
                  Unit rates are locked under this contract. Specify the exact delivery quantities needed for this release tranche.
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] shrink-0 font-bold bg-white/80 px-2.5 py-1 rounded-lg border border-blue-200">
                <span>Min: {minOrderQty > 0 ? `${minOrderQty} units` : 'None'}</span>
                <span>•</span>
                <span>Max: {maxOrderQty > 0 ? `${maxOrderQty} units` : 'No Cap'}</span>
              </div>
            </div>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 uppercase tracking-wider">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>Validation Warning</span>
                </div>
                <ul className="list-disc list-inside text-xs font-medium text-rose-700 space-y-0.5">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Line Items Quantity Selection Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#12335f]" />
                  <span>Select Items &amp; Release Quantities</span>
                </label>
                <span className="text-[11px] font-semibold text-slate-500">
                  {scheduleItems.length} contracted item{scheduleItems.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item Details</th>
                        <th className="py-2.5 px-3">Locked Unit Rate</th>
                        <th className="py-2.5 px-3">Available Balance</th>
                        <th className="py-2.5 px-3 text-right w-44">Call-Off Quantity</th>
                        <th className="py-2.5 px-3 text-right">Estimated Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {scheduleItems.map((item, idx) => {
                        const name = String(item.itemName || item.name || `Item #${idx + 1}`);
                        const key = item.itemName || item.name || item.id || String(idx);
                        const unitRate = Number(item.baseRate ?? item.unitPrice ?? 0);
                        const gst = Number(item.gst ?? item.taxRate ?? 18);
                        const uom = String(item.uom || item.unitOfMeasure || 'Nos');
                        const remaining = remainingQtyMap.get(name.toLowerCase()) ?? Number(item.estimatedAnnualQuantity || 0);
                        const currentQty = itemQuantities[key] || 0;
                        const isExceeded = currentQty > remaining;
                        const lineTotal = currentQty * unitRate * (1 + gst / 100);

                        return (
                          <tr key={key} className={cn("hover:bg-slate-50/80 transition-colors", currentQty > 0 && "bg-blue-50/20")}>
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-slate-900">{name}</p>
                              {item.specification && (
                                <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{item.specification}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-bold text-slate-800">₹{unitRate.toLocaleString('en-IN')}</span>
                              <span className="text-[10px] text-slate-500 block">+{gst}% GST</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                                remaining <= 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              )}>
                                {remaining.toLocaleString('en-IN')} {uom} left
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={remaining > 0 ? remaining : undefined}
                                  value={currentQty === 0 ? '' : currentQty}
                                  onChange={e => handleQtyChange(key, e.target.value, remaining)}
                                  placeholder="0"
                                  className={cn(
                                    "h-8 w-24 rounded-lg border px-2 text-right text-xs font-bold outline-none transition focus:ring-2",
                                    isExceeded
                                      ? "border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-500/20"
                                      : currentQty > 0
                                      ? "border-blue-300 bg-blue-50/50 text-blue-900 focus:ring-blue-500/20"
                                      : "border-slate-200 text-slate-800 focus:ring-slate-300"
                                  )}
                                  aria-label={`Quantity for ${name}`}
                                />
                                {remaining > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetMaxForLine(key, remaining)}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline px-1 py-0.5 rounded"
                                    title="Fill maximum remaining balance"
                                  >
                                    Max
                                  </button>
                                )}
                              </div>
                              {isExceeded && (
                                <span className="block text-[9.5px] font-bold text-rose-600 mt-0.5">
                                  Exceeds {remaining} {uom} available
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-slate-900">
                              {lineTotal > 0 ? `₹${lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Totals */}
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700">Total Call-Off Quantity:</span>
                    <span className="font-black text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-[13px]">
                      {totalCallOffQty.toLocaleString('en-IN')} units
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700">Estimated PO Value (incl. GST):</span>
                    <span className="font-black text-emerald-700 text-sm sm:text-base font-mono bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                      ₹{totalEstimatedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery & Release Details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="calloff-delivery-address" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Delivery Consignee Site / Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="calloff-delivery-address"
                    type="text"
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="Enter warehouse, plant, or hospital consignee delivery address..."
                    required
                    className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs font-medium text-slate-900 outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/20"
                  />
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="calloff-expected-date" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Target Delivery Date <span className="text-slate-400 font-normal">({slaDays}-day SLA)</span>
                </label>
                <div className="relative">
                  <input
                    id="calloff-expected-date"
                    type="date"
                    value={expectedDelivery}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setExpectedDelivery(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs font-medium text-slate-900 outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/20"
                  />
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="calloff-po-title" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Order Reference / Title <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="calloff-po-title"
                  type="text"
                  value={orderTitle}
                  onChange={e => setOrderTitle(e.target.value)}
                  placeholder="e.g. October Batch 1 Dispatch / Site A Restocking"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-900 outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/20"
                />
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-10 px-4 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || totalCallOffQty === 0}
                className="h-10 px-6 gap-2 bg-[#12335f] hover:bg-[#0b2445] text-white text-xs font-bold shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Issuing Call-Off PO...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm &amp; Issue Call-Off PO ({totalCallOffQty} units)</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>
  );
}
