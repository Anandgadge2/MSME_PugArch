import React, { useState } from 'react';
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  CreditCard,
  FileCheck,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { postApi } from '../../shared/apiClient';
import { formatCurrency } from '../../shared/format';
import { Button } from '../../../components/ui/button';

export interface PaymentReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: {
    id: number;
    invoiceNumber?: string;
    amount?: number | string;
    totalAmount?: number | string;
    purchaseOrderId?: number;
    party?: string;
    seller?: { name?: string };
  } | null;
  order?: {
    id: number;
    poNumber?: string;
    amount?: number | string;
    totalValue?: number | string;
    seller?: { name?: string };
  } | null;
  payment?: {
    id: number;
    referenceId?: string;
    amount?: number | string;
    invoiceId?: number;
    purchaseOrderId?: number;
  } | null;
  onSuccess?: () => void;
}

export function PaymentReceiptUploadModal({
  isOpen,
  onClose,
  invoice,
  order,
  payment,
  onSuccess
}: PaymentReceiptUploadModalProps) {
  const targetAmount = Number(
    invoice?.amount ||
    invoice?.totalAmount ||
    order?.amount ||
    order?.totalValue ||
    payment?.amount ||
    0
  );

  const [method, setMethod] = useState<'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CHEQUE' | 'DEMAND_DRAFT' | 'BANK_TRANSFER'>('NEFT');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [payerBankName, setPayerBankName] = useState('');
  const [payerAccountLast4, setPayerAccountLast4] = useState('');
  const [beneficiaryBankName, setBeneficiaryBankName] = useState('PugArch Escrow / ICICI Bank');
  const [remarks, setRemarks] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<number | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = async (selectedFile: File) => {
    if (!selectedFile) return;
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('File size must be under 15MB');
      return;
    }
    setFile(selectedFile);
    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', 'PAYMENT_PROOF');

      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload file to server');
      }

      const resData = await response.json();
      const fileUrl = resData?.fileUrl || resData?.url || resData?.fileAsset?.fileUrl || `/uploads/${selectedFile.name}`;
      const fileId = resData?.fileAssetId || resData?.fileAsset?.id || resData?.id;

      setUploadedFileUrl(fileUrl);
      if (fileId) setUploadedFileId(Number(fileId));
      toast.success('Receipt file uploaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Unable to upload receipt file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionReference.trim()) {
      toast.error('Please enter the Transaction Reference / UTR Number');
      return;
    }
    if (!payerBankName.trim()) {
      toast.error('Please enter your Bank Name');
      return;
    }
    if (!uploadedFileUrl && !uploadedFileId && !file) {
      toast.error('Please attach the payment receipt document');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        amount: targetAmount,
        method,
        transactionReference: transactionReference.trim(),
        paymentDate: new Date(paymentDate).toISOString(),
        payerBankName: payerBankName.trim(),
        payerAccountLast4: payerAccountLast4.trim() ? payerAccountLast4.trim() : undefined,
        beneficiaryBankName: beneficiaryBankName.trim() ? beneficiaryBankName.trim() : undefined,
        receiptFileUrl: uploadedFileUrl || (file ? `/uploads/${file.name}` : undefined),
        receiptFileId: uploadedFileId || undefined,
        remarks: remarks.trim() ? remarks.trim() : undefined
      };

      if (invoice?.id) {
        await postApi(`/api/payments/invoice/${invoice.id}/offline-proof`, payload);
      } else if (order?.id) {
        await postApi(`/api/payments/${order.id}/offline-proof`, payload);
      } else if (payment?.purchaseOrderId) {
        await postApi(`/api/payments/${payment.purchaseOrderId}/offline-proof`, payload);
      } else if (payment?.invoiceId) {
        await postApi(`/api/payments/invoice/${payment.invoiceId}/offline-proof`, payload);
      } else {
        throw new Error('Missing invoice or order reference for proof submission');
      }

      toast.success('Payment receipt submitted successfully for verification!');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#12335f]/10 text-[#12335f]">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Upload Payment Proof & Receipt</h2>
              <p className="text-xs font-semibold text-slate-500">
                {invoice ? `Invoice: ${invoice.invoiceNumber || `INV-${invoice.id}`}` : order ? `PO: ${order.poNumber || `PO-${order.id}`}` : 'Record Offline Payment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Summary Banner */}
          <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Payable Amount</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{formatCurrency(targetAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Recipient / Beneficiary</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {invoice?.party || invoice?.seller?.name || order?.seller?.name || 'Seller Account'}
              </p>
            </div>
          </div>

          {/* Payment Method & UTR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Payment Route *
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as any)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20"
              >
                <option value="NEFT">NEFT (National Electronic Fund Transfer)</option>
                <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                <option value="IMPS">IMPS (Immediate Payment Service)</option>
                <option value="UPI">UPI / QR Transfer</option>
                <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                <option value="CHEQUE">Bank Cheque / DD</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Transaction Reference / UTR *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. UTR1234567890 or CHEQ-9812"
                value={transactionReference}
                onChange={e => setTransactionReference(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20 uppercase"
              />
            </div>
          </div>

          {/* Bank & Date Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Transfer Date *
              </label>
              <input
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Payer Bank Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. State Bank of India"
                value={payerBankName}
                onChange={e => setPayerBankName(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                A/C Last 4 Digits
              </label>
              <input
                type="text"
                maxLength={4}
                pattern="\d{4}"
                placeholder="e.g. 8921"
                value={payerAccountLast4}
                onChange={e => setPayerAccountLast4(e.target.value.replace(/\D/g, ''))}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20"
              />
            </div>
          </div>

          {/* Receipt File Upload Dropzone */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
              Payment Receipt / Bank Slip Proof *
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                isDragging ? 'border-[#12335f] bg-[#12335f]/5' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              {file || uploadedFileUrl ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left">
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{file?.name || 'Attached Payment Receipt'}</p>
                      <p className="text-[10px] font-semibold text-emerald-700">
                        {uploadingFile ? 'Uploading file...' : 'Ready for submission'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setUploadedFileUrl(null); setUploadedFileId(null); }}
                    className="rounded p-1 text-slate-400 hover:bg-emerald-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block py-3">
                  <Upload className="mx-auto h-7 w-7 text-slate-400 mb-1.5" />
                  <p className="text-xs font-bold text-slate-700">
                    Click to browse or drag and drop payment receipt
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    Supports PDF, JPG, PNG (Max 15MB)
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => e.target.files?.[0] && void handleFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
              Remarks / Payment Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid via corporate netbanking account"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="h-10 rounded-lg text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || uploadingFile}
              className="h-10 rounded-lg bg-[#12335f] text-xs font-black uppercase tracking-wider hover:bg-[#0b2445] text-white px-5 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Submit Payment Proof
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
