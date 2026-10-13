'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  MapPin,
  CreditCard,
  Hash,
  Package,
  Plus,
  Trash2,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { putApi, postApi } from '../../shared/apiClient';
import { formatCurrency, formatDate } from '../../shared/format';
import { FocusTrap } from '../../../components/ui/FocusTrap';

export interface EditableLineItem {
  id?: number;
  itemName: string;
  description?: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  taxRate: number;
  totalAmount: number;
}

export interface EditPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  mode: 'draft' | 'amend';
  onSuccess: () => void;
}

export function EditPurchaseOrderModal({
  isOpen,
  onClose,
  order,
  mode,
  onSuccess,
}: EditPurchaseOrderModalProps) {
  const [title, setTitle] = useState('');
  const [externalPoNumber, setExternalPoNumber] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');
  const [pdfFileId, setPdfFileId] = useState<number | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [items, setItems] = useState<EditableLineItem[]>([]);

  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order && isOpen) {
      setTitle(order.title || '');
      setExternalPoNumber(order.externalPoNumber || '');
      if (order.expectedDelivery) {
        try {
          const d = new Date(order.expectedDelivery);
          setExpectedDelivery(d.toISOString().split('T')[0]);
        } catch {
          setExpectedDelivery('');
        }
      } else {
        setExpectedDelivery('');
      }
      setDeliveryAddress(typeof order.deliveryAddress === 'string' ? order.deliveryAddress : '');
      setPaymentTerms(order.paymentTerms || 'Net 30 Days');
      setAmendmentReason('');
      setPdfFileId(order.externalPdfFileId || null);
      setPdfFileName(order.externalPdfFile?.originalName || (order.externalPdfFileId ? 'Attached PO Document' : ''));
      setError(null);

      // Populate line items
      const existingItems = Array.isArray(order.items) && order.items.length > 0
        ? order.items.map((it: any) => {
            const qty = Number(it.quantity) || 1;
            const price = Number(it.unitPrice) || 0;
            const tax = Number(it.taxRate ?? 18);
            const subtotal = qty * price;
            const total = Number(it.totalAmount) || Math.round((subtotal + (subtotal * tax) / 100) * 100) / 100;
            return {
              id: it.id,
              itemName: it.itemName || 'Item',
              description: it.description || '',
              quantity: qty,
              unitOfMeasure: it.unitOfMeasure || 'units',
              unitPrice: price,
              taxRate: tax,
              totalAmount: total
            };
          })
        : [{
            itemName: order.title || 'Product Item',
            description: '',
            quantity: 1,
            unitOfMeasure: 'units',
            unitPrice: Number(order.totalValue || order.amount || 0),
            taxRate: 18,
            totalAmount: Number(order.totalValue || order.amount || 0)
          }];
      setItems(existingItems);
    }
  }, [order, isOpen]);

  // Recalculate totals dynamically
  const { subtotalTaxable, totalTax, calculatedTotalValue } = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    items.forEach((it) => {
      const lineSubtotal = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      const lineTax = (lineSubtotal * (Number(it.taxRate) || 0)) / 100;
      subtotal += lineSubtotal;
      tax += lineTax;
    });
    return {
      subtotalTaxable: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(tax * 100) / 100,
      calculatedTotalValue: Math.round((subtotal + tax) * 100) / 100
    };
  }, [items]);

  if (!isOpen || !order) return null;

  const handleUpdateItem = (index: number, field: keyof EditableLineItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
      const price = Number(field === 'unitPrice' ? value : item.unitPrice) || 0;
      const taxRate = Number(field === 'taxRate' ? value : item.taxRate) || 0;
      const sub = qty * price;
      item.totalAmount = Math.round((sub + (sub * taxRate) / 100) * 100) / 100;
      copy[index] = item;
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemName: `Item ${prev.length + 1}`,
        description: '',
        quantity: 1,
        unitOfMeasure: 'units',
        unitPrice: 0,
        taxRate: 18,
        totalAmount: 0
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('A Purchase Order must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload an authentic PDF document.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size must be less than 15MB.');
      return;
    }

    setError(null);
    setUploadingPdf(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'purchase_order');

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const fileAsset = data.fileAsset || data;
      setPdfFileId(fileAsset.id);
      setPdfFileName(file.name);
      toast.success('Official PO PDF attached successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to upload PDF file');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSaveDraft = async (issueImmediately = false) => {
    setError(null);
    if (!title.trim()) {
      setError('Order Title is required.');
      return;
    }

    if (!items || items.length === 0) {
      setError('At least one line item is required.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.itemName.trim()) {
        setError(`Line Item #${i + 1} requires an item name.`);
        return;
      }
      if (item.quantity <= 0) {
        setError(`Line Item #${i + 1} ("${item.itemName}") quantity must be greater than zero.`);
        return;
      }
      if (item.unitPrice < 0) {
        setError(`Line Item #${i + 1} ("${item.itemName}") unit price cannot be negative.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const sanitizedItems = items.map((it) => ({
        id: it.id,
        itemName: it.itemName.trim(),
        description: it.description?.trim() || undefined,
        quantity: Number(it.quantity),
        unitOfMeasure: it.unitOfMeasure.trim() || 'units',
        unitPrice: Number(it.unitPrice),
        taxRate: Number(it.taxRate ?? 18),
        totalAmount: Number(it.totalAmount)
      }));

      if (mode === 'draft') {
        await putApi(`/api/purchase-orders/${order.id}/draft`, {
          title: title.trim(),
          externalPoNumber: externalPoNumber.trim() || undefined,
          expectedDelivery: expectedDelivery || undefined,
          deliveryAddress: deliveryAddress.trim() || undefined,
          paymentTerms: paymentTerms.trim() || undefined,
          externalPdfFileId: pdfFileId || undefined,
          items: sanitizedItems
        });

        if (issueImmediately) {
          await postApi(`/api/purchase-orders/${order.id}/issue`, {});
          toast.success('PO saved and officially issued to seller!');
        } else {
          toast.success('Draft PO updated successfully.');
        }
      } else {
        // Amend mode
        if (!amendmentReason.trim() || amendmentReason.trim().length < 5) {
          setError('Please provide a specific reason for this amendment (at least 5 characters).');
          setSubmitting(false);
          return;
        }

        await postApi(`/api/purchase-orders/${order.id}/amend`, {
          title: title.trim(),
          externalPoNumber: externalPoNumber.trim() || undefined,
          expectedDelivery: expectedDelivery || undefined,
          deliveryAddress: deliveryAddress.trim() || undefined,
          paymentTerms: paymentTerms.trim() || undefined,
          externalPdfFileId: pdfFileId || undefined,
          reason: amendmentReason.trim(),
          amendmentReason: amendmentReason.trim(),
          items: sanitizedItems
        });

        toast.success(`Amendment V${(order.amendmentVersion || 1) + 1} proposed! Awaiting seller acceptance.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-po-modal-title"
    >
      <FocusTrap active={isOpen}>
        <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 id="edit-po-modal-title" className="text-base font-black text-slate-900">
                  {mode === 'draft' ? 'Edit Draft Purchase Order' : `Propose PO Amendment (V${(order.amendmentVersion || 1) + 1})`}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  PO #{order.poNumber || order.id} • Base Value: {formatCurrency(order.amount || order.totalValue)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {error && (
              <div
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'amend' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Amendment & Line-Item Revision Protocol:
                </p>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  Modifying line item quantities, prices, or delivery terms creates a formal version snapshot with SHA-256 non-repudiation sealing. The supplier will be prompted to review and accept the revised terms before order execution continues.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="po-edit-title" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Order Title / Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  id="po-edit-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Supply of Industrial Bearings"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  required
                />
              </div>

              <div>
                <label htmlFor="po-edit-external-po" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  SAP Ariba / ERP PO Number (Optional)
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="po-edit-external-po"
                    type="text"
                    value={externalPoNumber}
                    onChange={(e) => setExternalPoNumber(e.target.value)}
                    placeholder="e.g. 4500981244"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-800 shadow-2xs focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="po-edit-expected-date" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Expected Delivery Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="po-edit-expected-date"
                    type="date"
                    value={expectedDelivery}
                    onChange={(e) => setExpectedDelivery(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="po-edit-payment-terms" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Payment Terms
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="po-edit-payment-terms"
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g. Net 30 Days, 100% on GRN"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="po-edit-address" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Delivery / Consignee Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="po-edit-address"
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Plant Warehouse, Gate No. 2, MIDC..."
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                  />
                </div>
              </div>
            </div>

            {/* ─── Line Items Editor ─── */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#12335f]" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#12335f]">
                    Line Items & Quantities ({items.length})
                  </h4>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddItem}
                  className="h-7 text-[11px] font-bold text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Line Item
                </Button>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={item.id ? `po-item-${item.id}` : `new-item-${idx}`}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Item name / specification *"
                        value={item.itemName}
                        onChange={(e) => handleUpdateItem(idx, 'itemName', e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-800 focus:border-[#12335f] focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove Item"
                        aria-label={`Remove Item ${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Quantity *</label>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 font-mono font-bold text-slate-800 focus:border-[#12335f] focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                        <input
                          type="text"
                          value={item.unitOfMeasure}
                          onChange={(e) => handleUpdateItem(idx, 'unitOfMeasure', e.target.value)}
                          placeholder="units, kg, meters..."
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-slate-800 focus:border-[#12335f] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit Price (₹) *</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 font-mono font-bold text-slate-800 focus:border-[#12335f] focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">GST Rate (%)</label>
                        <select
                          value={item.taxRate}
                          onChange={(e) => handleUpdateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 font-mono text-slate-800 focus:border-[#12335f] focus:outline-none"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-500 font-medium">
                        Subtotal: {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                      <span className="font-mono font-bold text-indigo-700">
                        Line Total (incl. GST): {formatCurrency(item.totalAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic Order Value Summary */}
              <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono font-bold">{formatCurrency(subtotalTaxable)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Applicable GST:</span>
                  <span className="font-mono font-bold">{formatCurrency(totalTax)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-black text-slate-900">
                  <span className="flex items-center gap-1.5 text-[#12335f]">
                    <Calculator className="h-4 w-4" /> Revised PO Total:
                  </span>
                  <span className="font-mono text-indigo-700">
                    {formatCurrency(calculatedTotalValue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Official PDF Document Upload */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Official Buyer Purchase Order PDF (SAP Ariba / ERP Document)
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-2xs border border-slate-200">
                  {uploadingPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {pdfFileName || 'Upload official digitally signed PO PDF'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    PDF format up to 15MB. Accessible to seller upon issuance.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="po-pdf-file-upload"
                    className="cursor-pointer rounded-xl bg-white border border-slate-300 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs inline-block"
                  >
                    {pdfFileName ? 'Change PDF' : 'Select PDF'}
                  </label>
                  <input
                    id="po-pdf-file-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="sr-only"
                    disabled={uploadingPdf || submitting}
                  />
                </div>
              </div>
            </div>

            {mode === 'amend' && (
              <div>
                <label htmlFor="po-edit-amendment-reason" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Reason for Amendment (Required) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="po-edit-amendment-reason"
                  rows={3}
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  placeholder="State the reason for amending this purchase order (e.g. 'Quantity revised per site engineering change; unit price adjusted per mutual agreement')."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 shadow-2xs focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/20 resize-none"
                  required
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="h-10 px-4 text-xs font-bold"
              >
                Cancel
              </Button>

              {mode === 'draft' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSaveDraft(false)}
                    disabled={submitting || uploadingPdf}
                    className="h-10 px-4 text-xs font-black uppercase tracking-wider border-slate-300 text-slate-800 hover:bg-slate-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Draft'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSaveDraft(true)}
                    disabled={submitting || uploadingPdf}
                    className="h-10 px-4 bg-[#12335f] hover:bg-[#0e2a4f] text-white text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Save & Issue PO</span>
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleSaveDraft(false)}
                  disabled={submitting || uploadingPdf}
                  className="h-10 px-5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Submit Amendment</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
