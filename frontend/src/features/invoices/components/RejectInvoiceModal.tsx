'use client';

import React, { useState } from 'react';
import { X, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { postApi } from '../../shared/apiClient';
import { FocusTrap } from '../../../components/ui/FocusTrap';

export interface RejectInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: number | null;
  invoiceNumber?: string;
  onSuccess: () => void;
}

const COMMON_REASONS = [
  'Quantity / Unit count mismatch with delivered goods',
  'Rate / Unit price does not match agreed Purchase Order',
  'Incorrect GSTIN / HSN code or tax calculation error',
  'Damaged / Non-conforming goods rejected during inspection',
  'External ERP PO number missing or invalid',
  'Missing supporting documents / delivery challan',
  'Other / Custom discrepancy',
];

export function RejectInvoiceModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  onSuccess,
}: RejectInvoiceModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_REASONS[0]);
  const [detailedNotes, setDetailedNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !invoiceId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullReason = selectedReason === 'Other / Custom discrepancy'
      ? detailedNotes.trim()
      : detailedNotes.trim()
        ? `${selectedReason}: ${detailedNotes.trim()}`
        : selectedReason;

    if (!fullReason || fullReason.length < 5) {
      setError('Please provide a specific reason for rejection (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await postApi(`/api/invoices/${invoiceId}/reject`, {
        rejectionReason: fullReason,
      });
      toast.success('Invoice rejected and returned to seller for correction.');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reject invoice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-invoice-title"
    >
      <FocusTrap active={isOpen}>
        <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 ring-1 ring-rose-200">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 id="reject-invoice-title" className="text-base font-black text-slate-900">
                  Reject Invoice for Correction
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Invoice {invoiceNumber || `#${invoiceId}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close rejection dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              <p className="font-bold">Notice to Buyer:</p>
              <p className="mt-0.5 text-amber-800">
                Rejecting this invoice will unlock it for the supplier. The supplier will be notified with your feedback and will be allowed to modify and resubmit their tax invoice or SAP bill.
              </p>
            </div>

            {error && (
              <div
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="rejection-category"
                className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Discrepancy Category <span className="text-rose-500">*</span>
              </label>
              <select
                id="rejection-category"
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
              >
                {COMMON_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="detailed-notes"
                className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Detailed Explanation & Instructions for Seller <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="detailed-notes"
                rows={3}
                value={detailedNotes}
                onChange={(e) => setDetailedNotes(e.target.value)}
                placeholder="State the exact discrepancy (e.g., 'Billed for 50 units but only 40 received as per GRN #12, please adjust to ₹40,000')."
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/20 resize-none"
                required={selectedReason === 'Other / Custom discrepancy'}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="h-9 px-4 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </Button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>
  );
}
