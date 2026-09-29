import React, { useState, useEffect, useMemo } from 'react';
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
  Loader2,
  Search,
  Receipt,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../lib/api';
import { getApi, normalizeList, postApi } from '../../shared/apiClient';
import { formatCurrency } from '../../shared/format';
import { Button } from '../../../components/ui/button';
import { FocusTrap } from '../../../components/ui/FocusTrap';
import { cn } from '../../../lib/utils';

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
    payer?: { id: number; name?: string; email?: string };
    payee?: { id: number; name?: string; email?: string };
    invoice?: { id: number; invoiceNumber?: string; status?: string };
    purchaseOrder?: { id: number; poNumber?: string; title?: string };
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
  const isGlobalSelectorMode = !invoice && !order && !payment;

  const [referenceType, setReferenceType] = useState<'PO' | 'INVOICE'>('PO');
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');

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

  // Load available orders and invoices when in global selector mode
  useEffect(() => {
    if (!isOpen || !isGlobalSelectorMode) return;
    let isMounted = true;
    setLoadingEntities(true);

    Promise.allSettled([
      getApi<any>('/api/purchase-orders?take=100'),
      getApi<any>('/api/invoices?take=100')
    ]).then(([ordersRes, invoicesRes]) => {
      if (!isMounted) return;
      if (ordersRes.status === 'fulfilled') {
        const list = normalizeList<any>(ordersRes.value);
        setAvailableOrders(list);
      }
      if (invoicesRes.status === 'fulfilled') {
        const list = normalizeList<any>(invoicesRes.value);
        setAvailableInvoices(list);
      }
      setLoadingEntities(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, isGlobalSelectorMode]);

  const selectedOrder = useMemo(() => {
    if (order) return order;
    if (selectedOrderId) {
      return availableOrders.find(o => String(o.id) === selectedOrderId) || null;
    }
    return null;
  }, [order, selectedOrderId, availableOrders]);

  const selectedInvoice = useMemo(() => {
    if (invoice) return invoice;
    if (selectedInvoiceId) {
      return availableInvoices.find(i => String(i.id) === selectedInvoiceId) || null;
    }
    return null;
  }, [invoice, selectedInvoiceId, availableInvoices]);

  const targetAmount = useMemo(() => {
    if (invoice?.amount || invoice?.totalAmount) return Number(invoice.amount || invoice.totalAmount);
    if (order?.amount || order?.totalValue) return Number(order.amount || order.totalValue);
    if (payment?.amount) return Number(payment.amount);
    if (isGlobalSelectorMode) {
      if (referenceType === 'PO' && selectedOrder) {
        return Number(selectedOrder.totalValue || selectedOrder.amount || 0);
      }
      if (referenceType === 'INVOICE' && selectedInvoice) {
        return Number(selectedInvoice.totalAmount || selectedInvoice.amount || 0);
      }
    }
    return 0;
  }, [invoice, order, payment, isGlobalSelectorMode, referenceType, selectedOrder, selectedInvoice]);

  const recipientName = useMemo(() => {
    if (invoice?.party || invoice?.seller?.name) return invoice.party || invoice.seller?.name;
    if (order?.seller?.name) return order.seller.name;
    if (payment?.payee?.name) return payment.payee.name;
    if (isGlobalSelectorMode) {
      if (referenceType === 'PO' && selectedOrder?.seller?.name) {
        return selectedOrder.seller.name;
      }
      if (referenceType === 'INVOICE' && (selectedInvoice?.seller?.name || selectedInvoice?.party)) {
        return selectedInvoice.seller?.name || selectedInvoice.party;
      }
      return 'Select document above';
    }
    return 'Seller Account';
  }, [invoice, order, payment, isGlobalSelectorMode, referenceType, selectedOrder, selectedInvoice]);

  const documentSubtitle = useMemo(() => {
    if (invoice) return `Invoice: ${invoice.invoiceNumber || `INV-${invoice.id}`}`;
    if (order) return `PO: ${order.poNumber || `PO-${order.id}`}`;
    if (payment?.purchaseOrder?.poNumber) return `PO: ${payment.purchaseOrder.poNumber}`;
    if (payment?.invoice?.invoiceNumber) return `Invoice: ${payment.invoice.invoiceNumber}`;
    if (payment?.referenceId) return `Payment: ${payment.referenceId}`;
    if (isGlobalSelectorMode) {
      if (referenceType === 'PO' && selectedOrder) {
        return `PO: ${selectedOrder.poNumber || `PO-${selectedOrder.id}`}`;
      }
      if (referenceType === 'INVOICE' && selectedInvoice) {
        return `Invoice: ${selectedInvoice.invoiceNumber || `INV-${selectedInvoice.id}`}`;
      }
      return 'Select document to link';
    }
    return 'Record Offline Payment';
  }, [invoice, order, payment, isGlobalSelectorMode, referenceType, selectedOrder, selectedInvoice]);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedOrderId('');
    setSelectedInvoiceId('');
    setTransactionReference('');
    setPayerBankName('');
    setPayerAccountLast4('');
    setRemarks('');
    setFile(null);
    setUploadedFileUrl(null);
    setUploadedFileId(null);
    onClose();
  };

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
      formData.append('entityType', 'payment_proof');
      formData.append('documentType', 'PAYMENT_PROOF');

      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'Failed to upload file to server');
      }

      const resData = await response.json();
      const fileUrl =
        resData?.fileUrl ||
        resData?.url ||
        resData?.signedUrl ||
        resData?.file?.url ||
        resData?.file?.documentUrl ||
        resData?.fileAsset?.fileUrl ||
        `/uploads/${selectedFile.name}`;
      const fileId =
        resData?.fileAssetId ||
        resData?.fileId ||
        resData?.file?.id ||
        resData?.fileAsset?.id ||
        resData?.id;

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

    if (isGlobalSelectorMode) {
      if (referenceType === 'PO' && !selectedOrder) {
        toast.error('Please select a Purchase Order to link this payment proof');
        return;
      }
      if (referenceType === 'INVOICE' && !selectedInvoice) {
        toast.error('Please select a Tax Invoice to link this payment proof');
        return;
      }
    }

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
      } else if (referenceType === 'INVOICE' && selectedInvoice?.id) {
        await postApi(`/api/payments/invoice/${selectedInvoice.id}/offline-proof`, payload);
      } else if (referenceType === 'PO' && selectedOrder?.id) {
        await postApi(`/api/payments/${selectedOrder.id}/offline-proof`, payload);
      } else {
        throw new Error('Missing invoice or order reference for proof submission');
      }

      toast.success('Payment receipt submitted successfully for verification!');
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-payment-title"
    >
      <FocusTrap onEscape={!submitting ? handleClose : undefined} className="w-full max-w-xl md:max-w-3xl lg:max-w-4xl flex items-center justify-center">
        <div className="relative w-full flex flex-col max-h-[92vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
          {/* Sticky Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-slate-100 bg-slate-50/90 backdrop-blur-xs px-5 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#12335f]/10 text-[#12335f] border border-[#12335f]/20">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="modal-payment-title" className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Upload Payment Proof & Receipt
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  {documentSubtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              aria-label="Close dialog"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Form Content - Scrollable Body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 sm:space-y-5">
              {/* Reference Selection (Only shown when in global selector mode) */}
              {isGlobalSelectorMode && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                      Payment Reference Type *
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">
                      Choose document to settle
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Segmented Reference Type Switcher */}
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/80 p-1" role="tablist" aria-label="Payment Reference Type">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={referenceType === 'PO'}
                        onClick={() => {
                          setReferenceType('PO');
                          setSelectedInvoiceId('');
                        }}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-black transition-all cursor-pointer",
                          referenceType === 'PO'
                            ? "bg-white text-[#12335f] shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Against Purchase Order</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={referenceType === 'INVOICE'}
                        onClick={() => {
                          setReferenceType('INVOICE');
                          setSelectedOrderId('');
                        }}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-black transition-all cursor-pointer",
                          referenceType === 'INVOICE'
                            ? "bg-white text-[#12335f] shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Against Tax Invoice</span>
                      </button>
                    </div>

                    {/* Dropdown Selector */}
                    <div>
                      {loadingEntities ? (
                        <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin text-[#12335f]" aria-hidden="true" />
                          <span>Loading available {referenceType === 'PO' ? 'purchase orders' : 'tax invoices'}...</span>
                        </div>
                      ) : referenceType === 'PO' ? (
                        <div>
                          <label htmlFor="select-purchase-order" className="sr-only">Select Purchase Order</label>
                          <select
                            id="select-purchase-order"
                            value={selectedOrderId}
                            onChange={e => setSelectedOrderId(e.target.value)}
                            required
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#12335f]/20 cursor-pointer"
                          >
                            <option value="">-- Select a Purchase Order (PO) --</option>
                            {availableOrders.map(o => (
                              <option key={o.id} value={o.id}>
                                {o.poNumber || `PO #${o.id}`} • {o.seller?.name || 'Seller'} • {formatCurrency(o.totalValue || o.amount || 0)} ({String(o.status || 'Active').replace(/_/g, ' ')})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label htmlFor="select-tax-invoice" className="sr-only">Select Tax Invoice</label>
                          <select
                            id="select-tax-invoice"
                            value={selectedInvoiceId}
                            onChange={e => setSelectedInvoiceId(e.target.value)}
                            required
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#12335f]/20 cursor-pointer"
                          >
                            <option value="">-- Select a Tax Invoice --</option>
                            {availableInvoices.map(inv => (
                              <option key={inv.id} value={inv.id}>
                                {inv.invoiceNumber || `INV #${inv.id}`} • {inv.seller?.name || inv.party || 'Seller'} • {formatCurrency(inv.totalAmount || inv.amount || 0)} {inv.purchaseOrder?.poNumber ? `(PO: ${inv.purchaseOrder.poNumber})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Target Summary Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 p-4">
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                    Payable Amount
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl sm:text-2xl font-black text-slate-900">{formatCurrency(targetAmount)}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Escrow Protected
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-center sm:text-right sm:items-end border-t sm:border-t-0 border-blue-100/60 pt-2 sm:pt-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Recipient / Beneficiary
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5 truncate max-w-xs">
                    {recipientName}
                  </p>
                </div>
              </div>

              {/* Payment Method & Transaction Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="payment-route" className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Payment Route *
                  </label>
                  <select
                    id="payment-route"
                    value={method}
                    onChange={e => setMethod(e.target.value as any)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#12335f]/20 cursor-pointer transition-shadow"
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
                  <label htmlFor="transaction-reference" className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Transaction Reference / UTR *
                  </label>
                  <input
                    id="transaction-reference"
                    type="text"
                    required
                    placeholder="e.g. UTR1234567890 or CHEQ-9812"
                    aria-describedby="utr-hint"
                    value={transactionReference}
                    onChange={e => setTransactionReference(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#12335f]/20 uppercase transition-shadow"
                  />
                  <span id="utr-hint" className="text-[10px] text-slate-500 font-medium mt-1 block">
                    Must be the unique bank transaction reference or UTR for this payment transfer.
                  </span>
                </div>
              </div>

              {/* Bank & Date Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="transfer-date" className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Transfer Date *
                  </label>
                  <input
                    id="transfer-date"
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#12335f]/20 transition-shadow"
                  />
                </div>

                <div>
                  <label htmlFor="payer-bank" className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Payer Bank Name *
                  </label>
                  <input
                    id="payer-bank"
                    type="text"
                    required
                    placeholder="e.g. State Bank of India"
                    value={payerBankName}
                    onChange={e => setPayerBankName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#12335f]/20 transition-shadow"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-1">
                  <label htmlFor="payer-ac-last4" className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    A/C Last 4 Digits
                  </label>
                  <input
                    id="payer-ac-last4"
                    type="text"
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="e.g. 8921"
                    value={payerAccountLast4}
                    onChange={e => setPayerAccountLast4(e.target.value.replace(/\D/g, ''))}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#12335f]/20 transition-shadow"
                  />
                </div>
              </div>

              {/* Upload Dropzone & Remarks - 2-Column Grid on Large Screens */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Receipt File Upload Dropzone */}
                <div className="flex flex-col h-full">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Payment Receipt / Bank Slip Proof *
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative flex-1 min-h-[110px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                      isDragging ? 'border-[#12335f] bg-[#12335f]/5' : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                    }`}
                  >
                    {file || uploadedFileUrl ? (
                      <div className="w-full flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileCheck className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden="true" />
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
                          aria-label="Remove attached file"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-100 hover:text-slate-700 transition cursor-pointer"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block w-full py-2">
                        <Upload className="mx-auto h-6 w-6 text-slate-400 mb-1" aria-hidden="true" />
                        <p className="text-xs font-bold text-slate-700">
                          Click to browse or drag & drop receipt
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
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

                {/* Remarks & Settlement Information */}
                <div className="flex flex-col h-full justify-between space-y-3">
                  <div>
                    <label htmlFor="remarks-note" className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Remarks / Payment Note (Optional)
                    </label>
                    <textarea
                      id="remarks-note"
                      rows={2}
                      placeholder="e.g. Paid via corporate netbanking account"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#12335f]/20 transition-shadow resize-none"
                    />
                  </div>

                  <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-2.5 flex items-start gap-2 text-slate-600">
                    <ShieldCheck className="h-4 w-4 text-[#12335f] shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-[11px] leading-tight font-medium text-slate-600">
                      Payment receipts are authenticated against invoice records and audited for compliance before release.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer Actions */}
            <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/90 backdrop-blur-xs">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
                className="h-10 px-4 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploadingFile}
                className="h-10 rounded-lg bg-[#12335f] text-xs font-black uppercase tracking-wider hover:bg-[#0b2445] text-white px-5 shadow-sm cursor-pointer transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" /> Submit Payment Proof
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
