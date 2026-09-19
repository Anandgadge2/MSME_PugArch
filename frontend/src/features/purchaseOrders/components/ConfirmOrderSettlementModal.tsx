'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Building2,
  Calendar,
  AlertCircle,
  Loader2,
  Download,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { postApi } from '../../shared/apiClient';
import { formatCurrency, formatDate } from '../../shared/format';
import { FocusTrap } from '../../../components/ui/FocusTrap';
import { openFileAsset } from '../../../lib/files';

export interface ConfirmOrderSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  invoiceId?: number;
  onSuccess: () => void;
}

export function ConfirmOrderSettlementModal({
  isOpen,
  onClose,
  order,
  invoiceId: propInvoiceId,
  onSuccess
}: ConfirmOrderSettlementModalProps) {
  const activeInvoice = order?.invoices?.find(
    (inv: any) =>
      String(inv.status || inv.invoiceStatus || '').toLowerCase() === 'payment_submitted' ||
      Boolean(inv.paymentReference)
  ) || order?.invoices?.[0];

  const targetInvoiceId = propInvoiceId || activeInvoice?.id;
  const targetAmount = Number(
    activeInvoice?.amount ||
    activeInvoice?.totalAmount ||
    order?.amount ||
    order?.totalValue ||
    0
  );

  const paymentReference = activeInvoice?.paymentReference || 'UTR Recorded by Buyer';
  const bankName = activeInvoice?.bankName || 'Buyer Remitting Bank';
  const paymentDate = activeInvoice?.paymentDate || activeInvoice?.updatedAt || new Date().toISOString();
  const paymentSlipFile = activeInvoice?.paymentSlipFile;

  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const handleConfirm = async () => {
    if (!targetInvoiceId) {
      toast.error('No valid invoice ID found to confirm settlement.');
      return;
    }

    setSubmitting(true);
    try {
      await postApi(`/api/seller/invoices/${targetInvoiceId}/confirm-settlement`, {
        remarks: remarks.trim() || undefined
      });

      toast.success('Payment settlement confirmed and order completed!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to confirm settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSlip = async () => {
    if (!paymentSlipFile) return;
    try {
      await openFileAsset(paymentSlipFile, paymentSlipFile.originalName || 'Bank_Payment_Slip.pdf');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to open bank payment slip');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-settlement-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn"
    >
      <FocusTrap>
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 id="confirm-settlement-title" className="text-base font-black text-slate-900">
                  Confirm Settlement &amp; Close Order
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  PO: {order.poNumber || `PO-${order.id}`} {activeInvoice ? `• Inv: ${activeInvoice.invoiceNumber || `#${activeInvoice.id}`}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close dialog"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 pt-4">
            {/* Payment Summary Box */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                    Remitted Invoice Amount
                  </span>
                  <p className="text-xl font-black text-slate-950">
                    {formatCurrency(targetAmount)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10.5px] font-bold text-white shadow-2xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Funds Remitted
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Bank UTR Reference
                  </span>
                  <p className="font-mono font-black text-slate-900 break-all">
                    {paymentReference}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Remitting Bank
                  </span>
                  <p className="font-bold text-slate-900 truncate">
                    {bankName}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Payment Date
                  </span>
                  <p className="font-bold text-slate-900">
                    {formatDate(paymentDate)}
                  </p>
                </div>
                {paymentSlipFile && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Bank Advice Slip
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenSlip}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer mt-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Bank Slip
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Notice */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Please verify that the credit of <strong>{formatCurrency(targetAmount)}</strong> with UTR <strong>{paymentReference}</strong> has reflected in your bank statement. Confirming will close this order and finalize the contract.
              </p>
            </div>

            {/* Remarks */}
            <div>
              <label
                htmlFor="settlement-remarks"
                className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1"
              >
                Settlement Acknowledgement Remarks (Optional)
              </label>
              <textarea
                id="settlement-remarks"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Confirmed funds credited in corporate bank account..."
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#12335f] focus:outline-none focus:ring-1 focus:ring-[#12335f]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={onClose}
                className="font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleConfirm}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Finalizing Settlement...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirm Funds &amp; Close Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

export default ConfirmOrderSettlementModal;
