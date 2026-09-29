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
  ShieldCheck,
  Zap,
  ArrowRight
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

  const [activeTab, setActiveTab] = useState<'online' | 'offline'>('online');

  // Offline Payment State
  const [paymentReference, setPaymentReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !order) return null;

  const handleFileUpload = async (selectedFile: File) => {
    if (!selectedFile) return;
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('Payment proof document must be under 15MB');
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
        throw new Error(errData?.message || 'Failed to upload payment proof');
      }

      const resData = await response.json();
      const fId = resData?.fileAssetId || resData?.fileId || resData?.id || resData?.file?.id;
      if (fId) {
        setUploadedFileId(Number(fId));
        setUploadedFileName(selectedFile.name);
        toast.success('Payment proof document uploaded successfully');
      } else {
        setUploadedFileName(selectedFile.name);
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to upload payment proof document');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleOnlinePaymentSubmit = async () => {
    setSubmitting(true);
    try {
      const generatedRef = `ESCROW-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        paymentReference: generatedRef,
        bankName: 'PugArch Escrow / Direct Gateway',
        paymentDate: new Date().toISOString(),
        paymentMode: 'ONLINE_ESCROW',
        remarks: remarks.trim() || 'Direct online escrow payment authorized by buyer',
        amount: targetAmount,
        orderId: Number(order?.id),
        invoiceId: targetInvoiceId || undefined
      };

      if (targetInvoiceId) {
        await postApi(`/api/buyer/invoices/${targetInvoiceId}/record-payment`, payload);
      } else {
        await postApi(`/api/orders/${order.id}/payment/record`, payload);
      }

      toast.success('Instant online payment processed successfully! Status updated to PAYMENT_SUBMITTED.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process online payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfflineSubmit = async (e: React.FormEvent) => {
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
        fileAssetId: uploadedFileId || undefined,
        paymentMode: 'OFFLINE_BANK_TRANSFER',
        remarks: remarks.trim() || undefined,
        amount: targetAmount,
        orderId: Number(order?.id),
        invoiceId: targetInvoiceId || undefined
      };

      if (targetInvoiceId) {
        await postApi(`/api/buyer/invoices/${targetInvoiceId}/record-payment`, payload);
      } else {
        await postApi(`/api/orders/${order.id}/payment/record`, payload);
      }

      toast.success('Payment proof recorded successfully! Status updated to PAYMENT_SUBMITTED.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="make-payment-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-100"
    >
      <FocusTrap className="w-full max-w-lg md:max-w-xl flex items-center justify-center">
        <div className="w-full max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 transform-gpu will-change-[transform,opacity] animate-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 id="make-payment-title" className="text-base font-black text-slate-900">
                  Make Payment
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
              aria-label="Close payment dialog"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Amount Due Banner */}
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                Total Payable Amount
              </span>
              <p className="text-xl font-black text-slate-950">
                {formatCurrency(targetAmount)}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-900 border border-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              GRN Verified
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div
            role="tablist"
            aria-label="Payment Mode Selection"
            className="mt-4 grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-slate-100 border border-slate-200"
          >
            <button
              type="button"
              role="tab"
              id="tab-pay-online"
              aria-selected={activeTab === 'online'}
              aria-controls="panel-pay-online"
              onClick={() => {
                setActiveTab('online');
                document.getElementById('btn-pay-online-action')?.focus();
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTab === 'online'
                  ? 'bg-[#12335f] text-white shadow-sm ring-2 ring-[#12335f]/25'
                  : 'bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-950 border border-slate-300 shadow-2xs'
              }`}
            >
              <Zap className={`h-4 w-4 shrink-0 ${activeTab === 'online' ? 'text-amber-300 fill-amber-300' : 'text-amber-500 fill-amber-500'}`} />
              <span>Pay Online Now</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-upload-proof"
              aria-selected={activeTab === 'offline'}
              aria-controls="panel-upload-proof"
              onClick={() => setActiveTab('offline')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTab === 'offline'
                  ? 'bg-[#12335f] text-white shadow-sm ring-2 ring-[#12335f]/25'
                  : 'bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-950 border border-slate-300 shadow-2xs'
              }`}
            >
              <Upload className={`h-4 w-4 shrink-0 ${activeTab === 'offline' ? 'text-cyan-300' : 'text-blue-600'}`} />
              <span>Upload Payment Proof</span>
            </button>
          </div>

          {activeTab === 'online' ? (
            /* ── Tab 1: Instant Online Payment ── */
            <div
              id="panel-pay-online"
              role="tabpanel"
              aria-labelledby="tab-pay-online"
              className="mt-4 space-y-4"
            >
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Settlement Beneficiary</span>
                  <span className="font-bold text-slate-900">{order?.seller?.name || 'Verified Supplier'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Escrow Security</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> ICICI PugArch Escrow Account
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Payment Modes</span>
                  <span className="font-medium text-slate-700">UPI / Net Banking / RTGS Direct</span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="online-remarks"
                  className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1"
                >
                  Payment Notes (Optional)
                </label>
                <input
                  id="online-remarks"
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Authorized milestone payment as per contract"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#12335f] focus:outline-none focus:ring-1 focus:ring-[#12335f]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={onClose}
                  className="font-bold text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  id="btn-pay-online-action"
                  disabled={submitting}
                  onClick={handleOnlinePaymentSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-sm cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Processing Escrow Payment...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
                      <span>Pay Online Now • {formatCurrency(targetAmount)}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* ── Tab 2: Offline Transfer & Proof Upload ── */
            <form
              id="panel-upload-proof"
              role="tabpanel"
              aria-labelledby="tab-upload-proof"
              onSubmit={handleOfflineSubmit}
              className="space-y-4 pt-4"
            >
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

              {/* File Upload for Payment Proof */}
              <div>
                <label
                  htmlFor="payment-proof-file"
                  className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1"
                >
                  Payment Proof Document (Bank Receipt / Transfer Advice)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="payment-proof-file"
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
                    onClick={() => document.getElementById('payment-proof-file')?.click()}
                    className="h-9 px-3 gap-1.5 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {uploadingFile ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    <span>{uploadedFileName ? 'Change Proof File' : 'Attach Payment Proof'}</span>
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
                  onClick={() => setActiveTab('online')}
                  className="font-bold text-xs cursor-pointer"
                  title="Return to Pay Online Now"
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
                      Submitting Proof...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-3.5 w-3.5" />
                      Submit Payment Proof
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </FocusTrap>
    </div>
  );
}

export default RecordOrderPaymentModal;
