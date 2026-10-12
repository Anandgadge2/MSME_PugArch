'use client';

import React, { useState, useEffect } from 'react';
import { Pencil, X, Loader2, AlertTriangle, Calendar, MapPin, Package, IndianRupee, FileText } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ConfirmOneTimeEditModal } from './ConfirmOneTimeEditModal';
import { putApi } from '../../shared/apiClient';
import { toast } from 'sonner';

export interface EditPublishedProcurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  procurement: {
    id: number | string;
    referenceNumber?: string;
    title?: string;
    description?: string;
    category?: string;
    quantity?: string | number;
    unit?: string;
    estimatedValue?: number | string;
    deliveryLocation?: string;
    pincode?: string;
    endDate?: string | Date;
    termsAndConditions?: string[];
  } | null;
  onSuccess?: () => void | Promise<void>;
}

export function EditPublishedProcurementModal({
  isOpen,
  onClose,
  procurement,
  onSuccess
}: EditPublishedProcurementModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [pincode, setPincode] = useState('');
  const [endDate, setEndDate] = useState('');
  const [terms, setTerms] = useState('');

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (procurement && isOpen) {
      setTitle(procurement.title || '');
      setDescription(procurement.description || '');
      setQuantity(procurement.quantity ? String(procurement.quantity) : '');
      setUnit(procurement.unit || '');
      setEstimatedValue(procurement.estimatedValue ? String(procurement.estimatedValue) : '');
      setDeliveryLocation(procurement.deliveryLocation || '');
      setPincode(procurement.pincode || '');

      if (procurement.endDate) {
        try {
          const d = new Date(procurement.endDate);
          if (!isNaN(d.getTime())) {
            // Format for datetime-local: YYYY-MM-DDTHH:mm
            const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setEndDate(iso);
          }
        } catch {
          setEndDate('');
        }
      } else {
        setEndDate('');
      }

      setTerms(Array.isArray(procurement.termsAndConditions) ? procurement.termsAndConditions.join('\n') : '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [procurement, isOpen]);

  if (!isOpen || !procurement) return null;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }
    if (deliveryLocation.trim().length < 2) {
      setError('Delivery location is required.');
      return;
    }
    if (endDate) {
      const ed = new Date(endDate);
      if (ed <= new Date()) {
        setError('Submission deadline must be in the future.');
        return;
      }
    }

    setConfirmModalOpen(true);
  };

  const handleExecuteSave = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        deliveryLocation: deliveryLocation.trim()
      };

      if (quantity) payload.quantity = Number(quantity);
      if (unit) payload.unit = unit.trim();
      if (estimatedValue) payload.estimatedValue = Number(estimatedValue);
      if (pincode) payload.pincode = pincode.trim();
      if (endDate) payload.endDate = new Date(endDate).toISOString();
      if (terms.trim()) {
        payload.termsAndConditions = terms
          .split('\n')
          .map(t => t.trim())
          .filter(Boolean);
      }

      await putApi(`/api/buyer/procurement-bids/${procurement.id}`, payload);

      toast.success('Procurement updated successfully (V2)', {
        description: 'One-time grace edit utilized. Eligible suppliers have been notified.'
      });

      setConfirmModalOpen(false);
      onClose();
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update procurement. Please try again.');
      setConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs transition-opacity duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-procurement-modal-title"
      >
        <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shrink-0 shadow-2xs">
                <Pencil className="h-5 w-5" />
              </span>
              <div>
                <h2 id="edit-procurement-modal-title" className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  Edit Published Procurement
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Ref: <span className="font-mono font-bold text-slate-700">{procurement.referenceNumber || `#${procurement.id}`}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Grace Notice Callout */}
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <p className="leading-relaxed font-medium">
              <strong>One-Time Edit Window:</strong> You are allowed <strong>exactly 1 edit</strong> within the first 6 hours of publishing. After saving, no further edits will be permitted. An update email will be dispatched to matching suppliers.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleOpenConfirm} className="space-y-3.5">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Procurement Title <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Scope Description &amp; Specifications <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <Package className="h-3.5 w-3.5 text-slate-500" />
                  Required Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Unit of Measurement
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="e.g. MT, Units, Boxes"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Estimated Value & Closing Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                  Estimated Budget (INR)
                </label>
                <input
                  type="number"
                  step="any"
                  value={estimatedValue}
                  onChange={e => setEstimatedValue(e.target.value)}
                  placeholder="e.g. 250000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Submission Deadline
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Delivery Location & Pincode */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  Delivery Location <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryLocation}
                  onChange={e => setDeliveryLocation(e.target.value)}
                  required
                  placeholder="City, Plant, Warehouse Address"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Pincode
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={pincode}
                  onChange={e => setPincode(e.target.value)}
                  placeholder="e.g. 768201"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Terms &amp; Conditions (One per line)
              </label>
              <textarea
                rows={2}
                value={terms}
                onChange={e => setTerms(e.target.value)}
                placeholder="Payment within 30 days&#10;Inspection at buyer premises"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9 px-4 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black tracking-wide shadow-xs active:scale-95 border-none cursor-pointer flex items-center gap-1.5"
              >
                <span>Review &amp; Save (1 of 1)</span>
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmOneTimeEditModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleExecuteSave}
        procurementTitle={title}
        referenceNumber={procurement.referenceNumber || `#${procurement.id}`}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
