/**
 * PackedOrderDialog — Enhanced & Informative Pack Order Console.
 *
 * Provides:
 * 1. Purchase Order & Consignment Context Header (PO#, Title, Buyer, Destination, Item Count).
 * 2. PO Line Items Checklist for physical carton verification before packing.
 * 3. Parcel Metrics & Dynamic Volumetric Weight calculation ((L × W × H) / 5000 kg).
 * 4. Handling & Special Instructions badges (Fragile, Handle with Care, Keep Dry, Temperature Sensitive, This Side Up).
 * 5. Strict validation (weight > 0, count > 0) with Loader2 & toast feedback.
 * 6. Full VPAT keyboard operability (Escape to close, accessible labels).
 */

import { useState, useMemo, useEffect, useId } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package,
  X,
  Boxes,
  Building2,
  MapPin,
  Check,
  CheckCircle2,
  Scale,
  Ruler,
  Tag
} from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { Button } from '../../../components/ui/button';
import { runWithToast } from '../../../lib/toast';
import { api } from '../../../lib/api';
import { useMarkDeliveryPacked } from '../hooks';
import { invalidateDeliveryCache } from '../status';
import type { DeliveryDetailDto } from '../types';

interface PackedOrderDialogProps {
  isOpen: boolean;
  delivery: DeliveryDetailDto | any;
  onClose: () => void;
  onSuccess?: () => void;
}

const HANDLING_OPTIONS = [
  { id: 'fragile', label: 'Fragile Goods' },
  { id: 'handle_with_care', label: 'Handle with Care' },
  { id: 'keep_dry', label: 'Keep Dry' },
  { id: 'temperature_sensitive', label: 'Temperature Sensitive' },
  { id: 'this_side_up', label: 'This Side Up (↑)' }
];

export function PackedOrderDialog({
  isOpen,
  delivery,
  onClose,
  onSuccess
}: PackedOrderDialogProps) {
  const qc = useQueryClient();
  const mut = useMarkDeliveryPacked(delivery?.id || 0);

  const po = delivery?.purchaseOrder;
  const poId = delivery?.purchaseOrderId || po?.id;

  // Generate unique accessible IDs
  const weightId = useId();
  const tareId = useId();
  const countId = useId();
  const lengthId = useId();
  const widthId = useId();
  const heightId = useId();
  const remarksId = useId();
  const sealId = useId();

  // Parse existing dimensions if set
  const parsedDims = useMemo(() => {
    if (!delivery?.packageDimensions) return ['', '', ''];
    const matches = String(delivery.packageDimensions).match(/\d+(\.\d+)?/g);
    if (matches && matches.length >= 3) {
      return [matches[0], matches[1], matches[2]];
    }
    return ['', '', ''];
  }, [delivery?.packageDimensions]);

  // Form states
  const [grossWeight, setGrossWeight] = useState<string>(
    delivery?.packageWeightKg ? String(delivery.packageWeightKg) : ''
  );
  const [tareWeight, setTareWeight] = useState<string>(
    delivery?.metadata?.tareWeightKg ? String(delivery.metadata.tareWeightKg) : ''
  );
  const [packageCount, setPackageCount] = useState<string>(
    delivery?.packageCount ? String(delivery.packageCount) : '1'
  );
  const [length, setLength] = useState<string>(parsedDims[0]);
  const [width, setWidth] = useState<string>(parsedDims[1]);
  const [height, setHeight] = useState<string>(parsedDims[2]);
  const [remarks, setRemarks] = useState<string>(delivery?.remarks || '');
  const [packagingNotes, setPackagingNotes] = useState<string>(
    delivery?.metadata?.packagingNotes || ''
  );
  const [handlingFlags, setHandlingFlags] = useState<string[]>(
    Array.isArray(delivery?.metadata?.handlingFlags) ? delivery.metadata.handlingFlags : []
  );

  // Line items state (loaded from PO or delivery.purchaseOrder.items)
  const [items, setItems] = useState<any[]>(po?.items || []);
  const [loadingItems, setLoadingItems] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !poId) return;

    if (po?.items && po.items.length > 0) {
      setItems(po.items);
      const initCheck: Record<string, boolean> = {};
      po.items.forEach((it: any, idx: number) => {
        initCheck[String(it.id || idx)] = true;
      });
      setCheckedItems(initCheck);
      return;
    }

    let isSubscribed = true;
    setLoadingItems(true);
    api
      .get(`/api/purchase-orders/${poId}`)
      .then(async res => {
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data || json;
      })
      .then(data => {
        if (!isSubscribed || !data) return;
        const fetchedItems = data.items || [];
        setItems(fetchedItems);
        const initCheck: Record<string, boolean> = {};
        fetchedItems.forEach((it: any, idx: number) => {
          initCheck[String(it.id || idx)] = true;
        });
        setCheckedItems(initCheck);
      })
      .catch(err => {
        console.warn('Could not fetch PO items for packing checklist:', err);
      })
      .finally(() => {
        if (isSubscribed) setLoadingItems(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, poId, po?.items]);

  // Keyboard accessibility: Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate real-time volumetric weight: (L * W * H) / 5000 kg
  const volumetricWeightKg = useMemo(() => {
    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);
    if (!isNaN(l) && !isNaN(w) && !isNaN(h) && l > 0 && w > 0 && h > 0) {
      const vol = (l * w * h) / 5000;
      return Math.round(vol * 100) / 100;
    }
    return null;
  }, [length, width, height]);

  // Total items quantity
  const totalItemQuantity = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
  }, [items]);

  const toggleHandlingFlag = (id: string) => {
    setHandlingFlags(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const toggleItemCheck = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const validateAndSave = async () => {
    const gWeight = parseFloat(grossWeight);
    if (isNaN(gWeight) || gWeight <= 0) {
      toast.error('Gross package weight must be a valid positive number greater than 0 kg');
      return;
    }

    const countNum = parseInt(packageCount, 10);
    if (isNaN(countNum) || countNum <= 0) {
      toast.error('Package count must be a positive whole number (at least 1 carton/box)');
      return;
    }

    let dimsFormatted = '';
    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);
    if (l > 0 && w > 0 && h > 0) {
      dimsFormatted = `${l} × ${w} × ${h} cm`;
    }

    const payload = {
      packageWeightKg: gWeight,
      tareWeightKg: tareWeight ? parseFloat(tareWeight) : undefined,
      volumetricWeightKg: volumetricWeightKg || undefined,
      packageDimensions: dimsFormatted || undefined,
      packageCount: countNum,
      handlingFlags,
      packagingNotes: packagingNotes.trim() || undefined,
      remarks: remarks.trim() || undefined
    };

    await runWithToast(
      async () => {
        await mut.mutateAsync(payload);
        await invalidateDeliveryCache(qc, delivery.id);
        if (onSuccess) onSuccess();
        onClose();
      },
      {
        loading: 'Confirming order packing details...',
        success: `DLV-${delivery.id} successfully marked as PACKED!`,
        error: (err: any) => err?.message || 'Failed to update packing details'
      }
    );
  };

  if (!isOpen) return null;

  const consigneeName =
    po?.buyer?.organization?.organizationName ||
    po?.buyer?.name ||
    'Registered Consignee';
  const consigneeAddress =
    po?.deliveryAddress ||
    po?.buyer?.organization?.address ||
    delivery?.currentLocation ||
    'Direct Consignee Delivery Address';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-dialog-title"
    >
      <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] via-[#12335f] to-[#1e40af] px-6 py-4 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-blue-200 shadow-inner">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  Pack Order Console
                </span>
                <span className="rounded bg-blue-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-200">
                  DLV-{delivery.id}
                </span>
                {po?.poNumber && (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-200">
                    {po.poNumber}
                  </span>
                )}
              </div>
              <h2 id="pack-dialog-title" className="mt-0.5 text-base sm:text-lg font-black tracking-tight text-white line-clamp-1">
                {po?.title || 'Consignment Packaging Verification'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-5 sm:p-6 space-y-5 text-left">
          {/* 1. Context & Destination Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                Consignee & Buyer
              </span>
              <p className="text-xs font-bold text-slate-900 truncate" title={consigneeName}>
                {consigneeName}
              </p>
              <div className="flex items-start gap-1 pt-1 text-[11px] text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2" title={consigneeAddress}>{consigneeAddress}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5 text-emerald-600" />
                Consignment Units
              </span>
              <div className="flex items-baseline justify-between">
                <p className="text-base font-black text-slate-900">
                  {items.length} <span className="text-xs font-semibold text-slate-500">line item{items.length !== 1 ? 's' : ''}</span>
                </p>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {totalItemQuantity} Total Units
                </span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                Verify each item physically into the carton before confirming seal.
              </p>
            </div>
          </div>

          {/* 2. Line Items Physical Checklist */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#12335f]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  PO Items Packing Checklist
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500">
                Cross-verify contents
              </span>
            </div>

            <div className="p-3">
              {loadingItems ? (
                <div className="py-6 flex items-center justify-center text-slate-400 text-xs font-semibold gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#12335f]" />
                  Loading line items...
                </div>
              ) : items.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  Standard consignment package for PO #{po?.poNumber || delivery?.purchaseOrderId}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-2 px-2.5 w-10 text-center">Verify</th>
                        <th className="py-2 px-2.5">Item Description</th>
                        <th className="py-2 px-2.5 text-right">Ordered Qty</th>
                        <th className="py-2 px-2.5 text-right">UOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                      {items.map((item, idx) => {
                        const key = String(item.id || idx);
                        const isChecked = checkedItems[key] ?? true;
                        return (
                          <tr
                            key={key}
                            onClick={() => toggleItemCheck(key)}
                            className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          >
                            <td className="py-2.5 px-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleItemCheck(key)}
                                className="h-4 w-4 rounded border-slate-300 text-[#12335f] focus:ring-[#12335f]/20 cursor-pointer"
                                aria-label={`Verify ${item.itemName || item.title || 'Item'}`}
                              />
                            </td>
                            <td className="py-2.5 px-2.5">
                              <span className={isChecked ? 'font-bold text-slate-900' : 'text-slate-500 line-through'}>
                                {item.itemName || item.title || `Consignment Item #${idx + 1}`}
                              </span>
                              {item.description && (
                                <p className="text-[10px] text-slate-400 font-normal line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900">
                              {item.quantity || 1}
                            </td>
                            <td className="py-2.5 px-2.5 text-right text-slate-500 font-mono text-[11px]">
                              {item.uom || item.unitOfMeasure || 'Nos'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 3. Parcel Metrics & Volumetric Weight */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-[#12335f]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Parcel Metrics & Volumetric Weight
                </h3>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                Logistics Scale
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor={weightId} className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Gross Weight (kg) *
                </label>
                <input
                  id={weightId}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={grossWeight}
                  onChange={e => setGrossWeight(e.target.value)}
                  placeholder="e.g. 12.5"
                  required
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-bold text-slate-900 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                />
                <p className="mt-0.5 text-[9px] text-slate-400">Total packed weight on scale</p>
              </div>

              <div>
                <label htmlFor={tareId} className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Tare Weight (kg)
                </label>
                <input
                  id={tareId}
                  type="number"
                  step="0.01"
                  min="0"
                  value={tareWeight}
                  onChange={e => setTareWeight(e.target.value)}
                  placeholder="e.g. 1.2"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                />
                <p className="mt-0.5 text-[9px] text-slate-400">Box & packaging weight</p>
              </div>

              <div>
                <label htmlFor={countId} className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Total Packages / Cartons *
                </label>
                <input
                  id={countId}
                  type="number"
                  step="1"
                  min="1"
                  value={packageCount}
                  onChange={e => setPackageCount(e.target.value)}
                  placeholder="e.g. 1"
                  required
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-bold text-slate-900 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                />
                <p className="mt-0.5 text-[9px] text-slate-400">Cartons / crates count</p>
              </div>
            </div>

            {/* Dimensions */}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Package Dimensions — L × W × H (cm)</span>
                <span className="text-[9px] text-slate-400 normal-case">Formula: (L × W × H) / 5000</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <input
                    id={lengthId}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={length}
                    onChange={e => setLength(e.target.value)}
                    placeholder="Length (cm)"
                    aria-label="Length in cm"
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                  />
                </div>
                <div>
                  <input
                    id={widthId}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={width}
                    onChange={e => setWidth(e.target.value)}
                    placeholder="Width (cm)"
                    aria-label="Width in cm"
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                  />
                </div>
                <div>
                  <input
                    id={heightId}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    placeholder="Height (cm)"
                    aria-label="Height in cm"
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                  />
                </div>
              </div>
            </div>

            {/* Real-time Volumetric Comparison Alert */}
            {volumetricWeightKg !== null && (
              <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-blue-700 shrink-0" />
                  <span className="text-blue-900 font-semibold">
                    Volumetric Weight: <strong className="font-mono">{volumetricWeightKg} kg</strong>
                  </span>
                </div>
                {grossWeight && parseFloat(grossWeight) > 0 && (
                  <span className="text-[10px] font-bold text-blue-800">
                    Billable Weight:{' '}
                    <strong className="font-mono text-xs">
                      {Math.max(parseFloat(grossWeight), volumetricWeightKg)} kg
                    </strong>{' '}
                    ({parseFloat(grossWeight) >= volumetricWeightKg ? 'Actual Gross' : 'Volumetric'})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 4. Handling & Special Instructions */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Handling & Special Instructions
                </h3>
              </div>
              <span className="text-[9px] font-bold text-slate-400">Carrier Safety Flags</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {HANDLING_OPTIONS.map(opt => {
                const isSelected = handlingFlags.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleHandlingFlag(opt.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-[#12335f] text-white border-[#12335f] shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label htmlFor={sealId} className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Tamper-Proof Seal / Carton IDs
                </label>
                <input
                  id={sealId}
                  type="text"
                  value={packagingNotes}
                  onChange={e => setPackagingNotes(e.target.value)}
                  placeholder="e.g. Seal #SEAL-9982, Box 1/2 & 2/2"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                />
              </div>

              <div>
                <label htmlFor={remarksId} className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  General Remarks / Instructions
                </label>
                <input
                  id={remarksId}
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Staged at Warehouse Bay 2 for courier handover"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            Status will advance to <strong className="text-slate-800 uppercase font-black">PACKED</strong> upon confirmation.
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mut.isPending}
              className="h-9 rounded-xl border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={validateAndSave}
              disabled={mut.isPending}
              className="h-9 rounded-xl bg-[#12335f] px-5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#0b2447] shadow-xs cursor-pointer"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Confirm Packed
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
