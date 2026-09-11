'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  X,
  Loader2,
  Ban,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';

export interface CancelTargetProcurement {
  id: number;
  type: string;
  title: string;
  referenceNumber: string;
  typeLabel?: string;
  estimatedValue?: number;
  status?: string;
  statusGroup?: string;
}

interface CancelProcurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  procurement: CancelTargetProcurement | null;
  onConfirm: (params: { type: string; id: number; reason: string; remarks?: string }) => Promise<void>;
}

const STANDARD_CANCELLATION_REASONS = [
  { value: 'Administrative Reasons / Scope Revision', label: 'Administrative Reasons / Scope Revision' },
  { value: 'Technical Specification Changes', label: 'Technical Specification Changes' },
  { value: 'Budgetary Constraint / Fund Allocation Shift', label: 'Budgetary Constraint / Fund Allocation Shift' },
  { value: 'Market Price Fluctuation / Non-Reasonable Bids', label: 'Market Price Fluctuation / Non-Reasonable Bids' },
  { value: 'Demand Withdrawn by Department / Re-tendering', label: 'Demand Withdrawn by Department / Re-tendering' },
  { value: 'Other Justification', label: 'Other Justification' },
];

export function CancelProcurementModal({
  isOpen,
  onClose,
  procurement,
  onConfirm,
}: CancelProcurementModalProps) {
  const [selectedReason, setSelectedReason] = useState(STANDARD_CANCELLATION_REASONS[0].value);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const reasonSelectRef = useRef<HTMLSelectElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedReason(STANDARD_CANCELLATION_REASONS[0].value);
      setRemarks('');
      setError(null);
      setIsSubmitting(false);

      // Accessibility: Focus the reason select element when opened
      const timer = setTimeout(() => {
        reasonSelectRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Accessibility: Handle Escape key & trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !procurement) return null;

  const isPendingReview = procurement.statusGroup === 'pending_approval' || procurement.status === 'SUBMITTED_FOR_APPROVAL' || procurement.status === 'SUBMITTED';
  const actionTitle = isPendingReview ? 'Withdraw Procurement Request' : 'Cancel Procurement';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const effectiveReason = selectedReason === 'Other Justification'
      ? remarks.trim()
      : selectedReason;

    if (!effectiveReason || effectiveReason.length < 5) {
      setError('Please provide a valid cancellation reason of at least 5 characters.');
      return;
    }

    if (selectedReason === 'Other Justification' && remarks.trim().length < 10) {
      setError('Detailed remarks must be at least 10 characters when selecting "Other Justification".');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm({
        type: procurement.type,
        id: procurement.id,
        reason: effectiveReason,
        remarks: remarks.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to cancel procurement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-procurement-title"
      aria-describedby="cancel-procurement-desc"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
              <Ban className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="cancel-procurement-title" className="text-lg font-black tracking-tight text-slate-900">
                {actionTitle}
              </h2>
              <p id="cancel-procurement-desc" className="text-xs text-slate-500 font-medium mt-0.5">
                {isPendingReview
                  ? 'Withdraw this request from administrative approval and revert commitment.'
                  : 'Permanently cancel active sourcing and notify all participating suppliers.'}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Procurement Summary Card */}
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-white border border-slate-200 text-slate-700">
              {procurement.typeLabel || procurement.type}
            </span>
            <span className="font-mono text-xs font-bold text-slate-500">
              {procurement.referenceNumber || `#${procurement.id}`}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-900 line-clamp-1">
            {procurement.title}
          </p>
          {procurement.estimatedValue !== undefined && procurement.estimatedValue > 0 && (
            <div className="text-xs font-semibold text-slate-600 flex items-center gap-1 pt-1 border-t border-slate-200/50">
              <span>Estimated Value:</span>
              <strong className="text-slate-900">
                ₹{procurement.estimatedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </strong>
            </div>
          )}
        </div>

        {/* Alert Warning */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed font-medium">
            <strong>Important:</strong> In accordance with statutory procurement audit compliance, this action will be logged in the immutable audit trail.
            {isPendingReview
              ? ' Pending approvals will be terminated.'
              : ' Any participating bidders will receive immediate cancellation notices.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Reason Selection */}
          <div className="space-y-1.5">
            <label
              htmlFor="cancel-reason"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Cancellation Category <span className="text-rose-600" aria-hidden="true">*</span>
            </label>
            <select
              ref={reasonSelectRef}
              id="cancel-reason"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
            >
              {STANDARD_CANCELLATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Remarks Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="cancel-remarks"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Justification Remarks{' '}
                {selectedReason === 'Other Justification' && (
                  <span className="text-rose-600" aria-hidden="true">*</span>
                )}
              </label>
              <span className="text-[10px] font-semibold text-slate-400">
                {remarks.length} / 1000
              </span>
            </div>
            <textarea
              id="cancel-remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isSubmitting}
              maxLength={1000}
              placeholder={
                selectedReason === 'Other Justification'
                  ? 'Mandatory: Provide clear departmental justification for cancelling this procurement...'
                  : 'Optional: Provide any additional context, authority file numbers, or instructions...'
              }
              aria-invalid={!!error}
              aria-describedby={error ? 'cancel-error-text' : undefined}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-none font-medium"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div
              id="cancel-error-text"
              role="alert"
              aria-live="polite"
              className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700"
            >
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Keep Procurement
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 border-none cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Processing...
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                  {isPendingReview ? 'Confirm Withdrawal' : 'Confirm Cancellation'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
