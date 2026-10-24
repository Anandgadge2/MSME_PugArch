'use client';
import React, { useState, useId, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  Calendar,
  Hash,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FocusTrap } from '../../../components/ui/FocusTrap';
import { api } from '../../../lib/api';
import { postApi, putApi } from '../../shared/apiClient';
import { formatCurrency } from '../../shared/format';
import { toast } from 'sonner';

export interface UploadExternalInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purchaseOrders?: any[];
  initialPurchaseOrder?: any;
  editInvoice?: any;
}

export function UploadExternalInvoiceModal({
  open,
  onClose,
  onSuccess,
  purchaseOrders = [],
  initialPurchaseOrder = null,
  editInvoice = null
}: UploadExternalInvoiceModalProps) {
  const modalTitleId = useId();
  const fileInputId = useId();

  const [selectedPoId, setSelectedPoId] = useState<number | null>(
    initialPurchaseOrder?.id || null
  );
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [externalPoNumber, setExternalPoNumber] = useState(
    initialPurchaseOrder?.externalPoNumber || ''
  );
  const [vendorCode, setVendorCode] = useState('');
  const [amount, setAmount] = useState(
    initialPurchaseOrder ? String(initialPurchaseOrder.totalValue || initialPurchaseOrder.amount || '') : ''
  );
  const [taxableAmount, setTaxableAmount] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  const [file, setFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editInvoice) {
        setSelectedPoId(editInvoice.purchaseOrderId || editInvoice.purchaseOrder?.id || null);
        setInvoiceNumber(editInvoice.invoiceNumber || '');
        setExternalPoNumber(editInvoice.externalPoNumber || editInvoice.purchaseOrder?.externalPoNumber || '');
        setVendorCode(editInvoice.vendorCode || '');
        setAmount(String(editInvoice.amount || editInvoice.totalAmount || ''));
        setTaxableAmount(String(editInvoice.taxableAmount || ''));
        if (editInvoice.invoiceDate) {
          try {
            setInvoiceDate(new Date(editInvoice.invoiceDate).toISOString().split('T')[0]);
          } catch {
            setInvoiceDate(new Date().toISOString().split('T')[0]);
          }
        }
        setUploadedFileId(editInvoice.invoiceFileId || null);
      } else {
        setSelectedPoId(initialPurchaseOrder?.id || null);
        setInvoiceNumber('');
        setExternalPoNumber(initialPurchaseOrder?.externalPoNumber || '');
        setVendorCode('');
        setAmount(initialPurchaseOrder ? String(initialPurchaseOrder.totalValue || initialPurchaseOrder.amount || '') : '');
        setTaxableAmount('');
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setUploadedFileId(null);
      }
      setFile(null);
      setError(null);
    }
  }, [open, editInvoice, initialPurchaseOrder]);

  if (!open) return null;

  const currentPo = selectedPoId
    ? purchaseOrders.find((p) => p.id === selectedPoId) || initialPurchaseOrder
    : initialPurchaseOrder;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('File size must be under 20MB');
      return;
    }

    setFile(selectedFile);
    setUploadingFile(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entityType', 'invoice');
      formData.append('documentType', 'TAX_INVOICE');

      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'Failed to upload invoice document');
      }

      const resData = await response.json();
      const fileId =
        resData?.fileAssetId ||
        resData?.fileId ||
        resData?.file?.id ||
        resData?.fileAsset?.id ||
        resData?.id;

      if (!fileId) {
        throw new Error('Server did not return a valid file asset ID');
      }

      setUploadedFileId(Number(fileId));
      toast.success('Invoice document uploaded successfully!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'File upload failed');
      toast.error(err.message || 'File upload failed');
      setFile(null);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPoId && !currentPo?.id) {
      setError('Please select a purchase order.');
      toast.error('Please select a purchase order.');
      return;
    }

    const trimmedInvoiceNo = invoiceNumber.trim();
    if (!trimmedInvoiceNo) {
      setError('Please enter your official tax invoice number.');
      toast.error('Please enter your official tax invoice number.');
      return;
    }

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid invoice amount.');
      toast.error('Please enter a valid invoice amount.');
      return;
    }

    if (!uploadedFileId) {
      setError('Please attach the official tax invoice PDF document.');
      toast.error('Please attach the official tax invoice PDF document.');
      return;
    }

    setSubmitting(true);
    try {
      if (editInvoice) {
        await putApi(`/api/invoices/${editInvoice.id}/draft`, {
          invoiceNumber: trimmedInvoiceNo,
          amount: parsedAmount,
          taxableAmount: taxableAmount ? Number(taxableAmount) : parsedAmount,
          externalPoNumber: externalPoNumber.trim() || undefined,
          vendorCode: vendorCode.trim() || undefined,
          invoiceDate: new Date(invoiceDate).toISOString(),
          invoiceFileId: uploadedFileId || undefined,
          resubmit: true,
        });
        toast.success('Invoice updated and resubmitted to buyer successfully!');
      } else {
        await postApi('/api/invoices/upload-external', {
          purchaseOrderId: selectedPoId || currentPo.id,
          invoiceNumber: trimmedInvoiceNo,
          externalPoNumber: externalPoNumber.trim() || undefined,
          vendorCode: vendorCode.trim() || undefined,
          amount: parsedAmount,
          taxableAmount: taxableAmount ? Number(taxableAmount) : parsedAmount,
          invoiceDate: new Date(invoiceDate).toISOString(),
          invoiceFileId: uploadedFileId
        });
        toast.success('External Invoice uploaded successfully!');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit external invoice');
      toast.error(err.message || 'Failed to submit external invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <FocusTrap onEscape={!submitting ? onClose : undefined} className="w-full max-w-xl md:max-w-2xl flex items-center justify-center">
        <div className="relative w-full flex flex-col max-h-[92vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id={modalTitleId} className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  {editInvoice ? 'Edit & Resubmit Invoice' : 'Upload External Invoice'}
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Enterprise ERP
                  </span>
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  {editInvoice
                    ? 'Modify billing details or attach corrected tax invoice bill for buyer review.'
                    : 'Upload your stamped tax invoice PDF and link it to the purchase order.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close dialog"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 flex items-start gap-2.5 text-xs text-red-700 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Purchase Order Selection / Summary */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Purchase Order *
                </label>
                {initialPurchaseOrder ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-900">
                        {initialPurchaseOrder.poNumber} — {initialPurchaseOrder.title || 'Purchase Order'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Total Order Value: <span className="font-bold text-slate-800">{formatCurrency(initialPurchaseOrder.totalValue || initialPurchaseOrder.amount || 0)}</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Linked
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedPoId || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value) || null;
                      setSelectedPoId(id);
                      const po = purchaseOrders.find((p) => p.id === id);
                      if (po) {
                        if (po.externalPoNumber) setExternalPoNumber(po.externalPoNumber);
                        setAmount(String(po.totalValue || po.amount || ''));
                      }
                    }}
                    required
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                  >
                    <option value="">Select an accepted purchase order...</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber} — {po.title} ({formatCurrency(po.totalValue || po.amount || 0)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* ERP Identifiers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    External ERP / PO Number
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={externalPoNumber}
                      onChange={(e) => setExternalPoNumber(e.target.value)}
                      placeholder="e.g. 4500192831"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Customer's internal ERP PO reference</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Customer Vendor Code / ID
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={vendorCode}
                      onChange={(e) => setVendorCode(e.target.value)}
                      placeholder="e.g. VEN-8821"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Your vendor ID in buyer's SAP system</p>
                </div>
              </div>

              {/* Invoice Number & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Official Tax Invoice Number *
                  </label>
                  <div className="relative">
                    <Receipt className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV/2026/0412"
                      required
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Invoice Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      required
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                    />
                  </div>
                </div>
              </div>

              {/* Amounts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Total Invoice Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Total inclusive of all GST</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Taxable Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxableAmount}
                    onChange={(e) => setTaxableAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Base amount before tax (optional)</p>
                </div>
              </div>

              {/* File Attachment Upload */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Official Signed Invoice Document (PDF) *
                </label>
                <div className="rounded-xl border-2 border-dashed border-slate-300 p-4 hover:border-blue-500 transition-all bg-slate-50/50 flex flex-col items-center justify-center text-center">
                  {uploadedFileId && file ? (
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-emerald-200 w-full">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{file.name}</p>
                        <p className="text-[10px] text-emerald-600 font-semibold">Attached & Verified ({(file.size / (1024 * 1024)).toFixed(2)} MB)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setUploadedFileId(null);
                        }}
                        className="text-xs text-red-600 hover:underline font-bold px-2 py-1"
                      >
                        Change
                      </button>
                    </div>
                  ) : uploadingFile ? (
                    <div className="flex flex-col items-center gap-2 py-3">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <p className="text-xs font-semibold text-slate-600">Uploading document to secure vault...</p>
                    </div>
                  ) : (
                    <>
                      <FileText className="h-8 w-8 text-slate-400 mb-1" />
                      <p className="text-xs font-bold text-slate-700">
                        Drag and drop or{' '}
                        <label htmlFor={fileInputId} className="text-blue-600 hover:underline cursor-pointer">
                          browse PDF bill
                        </label>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">PDF or scanned copy up to 20MB</p>
                      <input
                        id={fileInputId}
                        type="file"
                        accept=".pdf,application/pdf,image/png,image/jpeg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploadingFile || !uploadedFileId}
                className="bg-[#12335f] hover:bg-[#0c2340] text-white font-bold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : editInvoice ? (
                  'Save & Resubmit Invoice'
                ) : (
                  'Publish External Invoice'
                )}
              </Button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>
  );
}
