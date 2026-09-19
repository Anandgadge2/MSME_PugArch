'use client';

import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api';
import { postApi } from '../../shared/apiClient';
import { formatCurrency, formatDate } from '../../shared/format';
import { FocusTrap } from '../../../components/ui/FocusTrap';

export interface RecordOrderPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  invoiceId?: number;
  onSuccess: () => void;
}

export function RecordOrderPaymentModal({
  isOpen,
  onClose,
  order,
  invoiceId: propInvoiceId,
  onSuccess
}: RecordOrderPaymentModalProps) {
  const activeInvoice = order?.invoices?.find(
    (inv: any) =>
      String(inv.status || inv.invoiceStatus || '').toLowerCase() !== 'cancelled' &&
      String(inv.status || inv.invoiceStatus || '').toLowerCase() !== 'rejected'
  ) || order?.invoices?.[0];

  const targetInvoiceId = propInvoiceId || activeInvoice?.id;
  const targetAmount = Number(
    activeInvoice?.amount ||
    activeInvoice?.totalAmount ||
    order?.amount ||
    order?.totalValue ||
    0
  );

  const [paymentReference, setPaymentReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const handleFileUpload = async (selectedFile: File) => {
    if (!selectedFile) return;
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('Bank slip document must be under 15MB');
      return;
    }
    setFile(selectedFile);
    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entityType', 'payment_proof');
      formData.append('documentType', 'PAYMENT_PROOF');

      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'Failed to upload bank slip');
      }

      const resData = await response.json();
      const fId = resData?.fileAssetId || resData?.fileId || resData?.id || resData?.file?.id;
      if (fId) {
        setUploadedFileId(Number(fId));
        setUploadedFileName(selectedFile.name);
        toast.success('Bank payment slip uploaded successfully');
      } else {
        setUploadedFileName(selectedFile.name);
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to upload bank slip document');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentReference.trim()) {
      toast.error('Please enter the UTR / Bank Transaction Reference number');
      return;
    }
    if (!bankName.trim()) {
      toast.error('Please enter your Bank Name');
      return;
    }
    if (!paymentDate) {
      toast.error('Please specify the payment transfer date');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        paymentReference: paymentReference.trim(),
        bankName: bankName.trim(),
        paymentDate: new Date(paymentDate).toISOString(),
        paymentSlipFileId: uploadedFileId || undefined,
        remarks: remarks.trim() || undefined,
        amount: targetAmount
      };

      if (targetInvoiceId) {
        await postApi(`/api/buyer/invoices/${targetInvoiceId}/record-payment`, payload);
      } else {
        await postApi(`/api/orders/${order.id}/payment/record`, payload);
      }

      toast.success('Payment recorded successfully! Order status updated to PAYMENT_SUBMITTED.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn"
    >
      <FocusTrap>
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#12335f] border border-blue-200">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 id="record-payment-title" className="text-base font-black text-slate-900">
                  Record Payment &amp; Upload Bank Slip
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

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Amount Banner */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">
                  Verified Invoice Amount
                </span>
                <p className="text-lg font-black text-slate-950">
                  {formatCurrency(targetAmount)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-800 border border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                GRN Verified
              </span>
            </div>

            {/* UTR Reference Input */}
            <div>
              <label
                htmlFor="payment-reference"
                className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1"
              >
                UTR / Transaction Reference Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="payment-reference"
                type="text"
                required
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. UTR1234567890 / CMS987654321"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#12335f] focus:outline-none focus:ring-1 focus:ring-[#12335f]"
              />
            </div>

            {/* Payer Bank Name */}
            <div>
              <label
                htmlFor="payer-bank"
                className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1"
              >
                Payer Bank Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="payer-bank"
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India / HDFC Bank / ICICI Bank"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#12335f] focus:outline-none focus:ring-1 focus:ring-[#12335f]"
              />
            </div>

            {/* Payment Transfer Date */}
            <div>
              <label
                htmlFor="payment-date"
                className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1"
              >
                Payment Transfer Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="payment-date"
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-[#12335f] focus:outline-none focus:ring-1 focus:ring-[#12335f]"
              />
            </div>

            {/* File Upload for Bank Slip */}
            <div>
              <label
                htmlFor="payment-slip-file"
                className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1"
              >
                Bank Transfer Slip / Payment Advice Receipt
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="payment-slip-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      void handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingFile}
                  onClick={() => document.getElementById('payment-slip-file')?.click()}
                  className="h-9 px-3 gap-1.5 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {uploadingFile ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  <span>{uploadedFileName ? 'Change Slip File' : 'Attach Bank Slip'}</span>
                </Button>
                {uploadedFileName && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 truncate max-w-[240px]">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {uploadedFileName}
                  </span>
                )}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label
                htmlFor="payment-remarks"
                className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1"
              >
                Remarks / Notes (Optional)
              </label>
              <textarea
                id="payment-remarks"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Additional details regarding this bank transfer..."
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
                type="submit"
                disabled={submitting || uploadingFile}
                className="bg-[#12335f] hover:bg-[#0b2445] text-white font-black text-xs gap-1.5 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Recording Transfer...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3.5 w-3.5" />
                    Confirm &amp; Submit Payment
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

export default RecordOrderPaymentModal;
