import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Download,
  Building2,
  Calendar,
  CreditCard,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Receipt,
  User,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi, postApi } from '../../shared/apiClient';
import { formatCurrency, formatDate } from '../../shared/format';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { openFileAsset } from '../../../lib/files';

export interface PaymentReceiptViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proofId?: number | null;
  invoiceId?: number | null;
  orderId?: number | null;
  paymentId?: number | null;
  initialProof?: any | null;
  onStatusChange?: () => void;
  orderPoNumber?: string | null;
  invoiceNumber?: string | null;
  sellerName?: string | null;
  buyerName?: string | null;
}

export function PaymentReceiptViewModal({
  isOpen,
  onClose,
  proofId,
  invoiceId,
  orderId,
  paymentId,
  initialProof,
  onStatusChange,
  orderPoNumber,
  invoiceNumber,
  sellerName,
  buyerName
}: PaymentReceiptViewModalProps) {
  const { user } = useAuth();
  const isAdminOrSeller = user?.role === 'admin' || user?.role === 'seller' || user?.role === 'master_admin';

  const [proof, setProof] = useState<any | null>(initialProof || null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [linkedPo, setLinkedPo] = useState<any | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProof(null);
      setLinkedPo(null);
      setLinkedInvoice(null);
      setShowRejectBox(false);
      setRejectReason('');
      return;
    }

    if (initialProof) {
      setProof(initialProof);
    }

    const loadData = async () => {
      setLoading(true);
      try {
        let data: any = initialProof || null;
        if (!data && invoiceId) {
          const res = await getApi<any>(`/api/payments/invoice/${invoiceId}/offline-proof`);
          data = res?.proof;
        }
        if (!data && orderId) {
          const res = await getApi<any>(`/api/payments/${orderId}/offline-proof`);
          data = res?.proof || (res?.proofs || [])[0];
        }
        if (!data && proofId) {
          const res = await getApi<any>(`/api/payments/offline-proofs`);
          data = (res?.proofs || []).find((p: any) => p.id === proofId);
        }
        if (!data && (paymentId || orderId)) {
          const res = await getApi<any>(`/api/payments/offline-proofs`);
          data = (res?.proofs || []).find((p: any) => (paymentId && p.paymentTransactionId === paymentId) || (orderId && p.purchaseOrderId === orderId));
        }
        setProof(data || null);

        // Auto-fetch linked Purchase Order
        const targetPoId = orderId || data?.purchaseOrderId;
        if (targetPoId) {
          try {
            const poRes = await getApi<any>(`/api/purchase-orders/${targetPoId}`);
            const poData = poRes?.data || poRes;
            setLinkedPo(poData);
            if (!invoiceId && poData?.invoices?.length > 0) {
              setLinkedInvoice(poData.invoices[0]);
            }
          } catch {}
        }

        // Auto-fetch linked Invoice
        const targetInvId = invoiceId || data?.invoiceId;
        if (targetInvId) {
          try {
            const invRes = await getApi<any>(`/api/invoices/${targetInvId}`);
            setLinkedInvoice(invRes?.data || invRes);
          } catch {}
        }
      } catch (err: any) {
        toast.error('Unable to fetch payment proof details');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [isOpen, invoiceId, orderId, proofId, initialProof, paymentId]);

  if (!isOpen) return null;

  const handleVerify = async () => {
    if (!proof?.id) return;
    setVerifying(true);
    try {
      await postApi(`/api/payments/offline-proof/${proof.id}/verify`, {});
      toast.success('Payment proof verified successfully! Order/Invoice marked as paid.');
      setProof((prev: any) => prev ? { ...prev, status: 'VERIFIED' } : null);
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify payment proof');
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!proof?.id) return;
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    setRejecting(true);
    try {
      await postApi(`/api/payments/offline-proof/${proof.id}/reject`, { reason: rejectReason.trim() });
      toast.success('Payment proof rejected.');
      setProof((prev: any) => prev ? { ...prev, status: 'REJECTED', rejectionReason: rejectReason.trim() } : null);
      setShowRejectBox(false);
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject payment proof');
    } finally {
      setRejecting(false);
    }
  };

  const resolvedPoNumber = linkedPo?.poNumber || orderPoNumber || (proof?.purchaseOrderId ? `PO #${proof.purchaseOrderId}` : null);
  const resolvedInvoiceNumber = linkedInvoice?.invoiceNumber || invoiceNumber || (proof?.invoiceId ? `INV #${proof.invoiceId}` : null);
  const resolvedSellerName = linkedPo?.seller?.name || linkedInvoice?.seller?.name || linkedInvoice?.party || sellerName || 'Seller Account';
  const resolvedBuyerName = linkedPo?.buyer?.name || linkedInvoice?.buyer?.name || buyerName || 'Buyer Account';

  const handleOpenPo = () => {
    const poNum = resolvedPoNumber || linkedPo?.id || orderId;
    if (!poNum) return;
    const url = user?.role === 'seller'
      ? `/seller/orders?search=${encodeURIComponent(poNum)}`
      : `/orders?search=${encodeURIComponent(poNum)}`;
    window.open(url, '_blank');
  };

  const handleOpenInvoice = () => {
    const invNum = resolvedInvoiceNumber || linkedInvoice?.id || invoiceId;
    if (!invNum) return;
    const url = user?.role === 'seller'
      ? `/seller/invoices?viewInvoiceNo=${encodeURIComponent(invNum)}`
      : `/payments/invoices?viewInvoiceNo=${encodeURIComponent(invNum)}`;
    window.open(url, '_blank');
  };

  const handleDownloadPo = () => {
    const poId = linkedPo?.id || orderId || proof?.purchaseOrderId;
    if (!poId) return;
    window.open(`/api/purchase-orders/${poId}/pdf`, '_blank');
  };

  const status = String(proof?.status || 'UPLOADED').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-proof-title">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="modal-proof-title" className="text-base font-black text-slate-900">Payment Receipt & Proof Details</h2>
              <p className="text-xs font-semibold text-slate-500">
                {resolvedPoNumber ? `PO: ${resolvedPoNumber}` : ''}
                {resolvedPoNumber && proof?.transactionReference ? ' • ' : ''}
                {proof?.transactionReference ? `UTR: ${proof.transactionReference}` : 'Offline Bank Transfer Record'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#12335f]" aria-hidden="true" />
            <p className="text-xs font-bold text-slate-500">Loading payment proof record...</p>
          </div>
        ) : !proof ? (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-black text-slate-800">No Payment Receipt Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No offline bank transfer receipt or UTR proof has been uploaded for this transaction yet.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Status & Amount Card */}
            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Total Paid Amount</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(proof.amount)}</p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                    status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : status === 'REJECTED'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {status === 'VERIFIED' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : status === 'REJECTED' ? (
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {status === 'VERIFIED' ? 'Proof Verified' : status === 'REJECTED' ? 'Proof Rejected' : 'Under Review'}
                </span>
                {proof.paymentDate && (
                  <p className="text-[10px] font-bold text-slate-500 mt-1">
                    Paid on {formatDate(proof.paymentDate)}
                  </p>
                )}
              </div>
            </div>

            {/* Linked Documents & Parties Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Linked Procurement Documents
                </p>
                <div className="flex items-center gap-2">
                  {resolvedPoNumber && (
                    <button
                      type="button"
                      onClick={handleOpenPo}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>View PO</span>
                    </button>
                  )}
                  {linkedPo?.id && (
                    <button
                      type="button"
                      onClick={handleDownloadPo}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition cursor-pointer"
                      title="Download Official PO PDF"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>PO PDF</span>
                    </button>
                  )}
                  {resolvedInvoiceNumber && (
                    <button
                      type="button"
                      onClick={handleOpenInvoice}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer"
                    >
                      <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>View Invoice</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Purchase Order</p>
                  <p className="font-bold text-slate-900 mt-0.5">{resolvedPoNumber || 'Not explicitly linked'}</p>
                  {linkedPo?.title && (
                    <p className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">{linkedPo.title}</p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Tax Invoice</p>
                  <p className="font-bold text-slate-900 mt-0.5">{resolvedInvoiceNumber || 'Pending / Direct PO'}</p>
                  {linkedInvoice?.status && (
                    <p className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Status: {linkedInvoice.status}</p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Payer / Buyer</p>
                  <p className="font-bold text-slate-900 mt-0.5">{resolvedBuyerName}</p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Beneficiary / Seller</p>
                  <p className="font-bold text-slate-900 mt-0.5">{resolvedSellerName}</p>
                </div>
              </div>
            </div>

            {/* Rejection Alert if rejected */}
            {status === 'REJECTED' && proof.rejectionReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900">
                <p className="font-black uppercase tracking-wider text-[10px] text-red-700 mb-1">Rejection Reason</p>
                <p className="font-semibold">{proof.rejectionReason}</p>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Payment Route</p>
                <p className="font-bold text-slate-800 mt-1">{proof.method || 'NEFT / RTGS'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">UTR / Reference No</p>
                <p className="font-mono font-bold text-[#12335f] mt-1">{proof.transactionReference || '-'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Payer Bank Name</p>
                <p className="font-bold text-slate-800 mt-1">{proof.payerBankName || '-'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">A/C Last 4 Digits</p>
                <p className="font-mono font-bold text-slate-800 mt-1">{proof.payerAccountLast4 ? `•••• ${proof.payerAccountLast4}` : '-'}</p>
              </div>
            </div>

            {/* Attached Receipt File Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Attached Receipt Slip / Proof Document
              </p>
              {proof.receiptFileUrl ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {proof.receiptFileUrl.split('/').pop() || 'Payment_Receipt.pdf'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await openFileAsset(
                            {
                              id: proof.receiptFileId,
                              fileUrl: proof.receiptFileUrl,
                              mimeType: 'application/pdf'
                            },
                            'Payment Receipt Document'
                          );
                        } catch (err: any) {
                          toast.error(err?.message || 'Unable to open payment receipt document');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#12335f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0b2445] transition cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> View / Download
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-400">No electronic file attached.</p>
              )}
            </div>

            {/* Remarks */}
            {proof.remarks && (
              <div className="text-xs">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Remarks</p>
                <p className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-medium text-slate-700">{proof.remarks}</p>
              </div>
            )}

            {/* Reject Form Box */}
            {showRejectBox && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-3">
                <p className="text-xs font-black text-red-900">Provide reason for rejecting this payment proof:</p>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. UTR number does not match bank settlement statement"
                  className="w-full rounded-lg border border-red-200 bg-white p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-400"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRejectBox(false)}
                    className="h-8 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleReject}
                    disabled={rejecting || !rejectReason.trim()}
                    className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            )}

            {/* Admin / Seller Action Buttons: Render ONLY when pending review */}
            {isAdminOrSeller && !['VERIFIED', 'REJECTED'].includes(status) && !showRejectBox && (
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRejectBox(true)}
                  className="h-10 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                >
                  <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" /> Reject Proof
                </Button>
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider px-5 shadow-sm cursor-pointer"
                >
                  {verifying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Verify & Settle Payment
                </Button>
              </div>
            )}

            {/* Read-only status banner when already verified or settled */}
            {status === 'VERIFIED' && (
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-emerald-100 bg-emerald-50/60 p-3 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>This payment proof has been verified and settled in full.</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-600 text-white shadow-2xs">
                  Settled
                </span>
              </div>
            )}

            {/* Read-only status banner when already rejected */}
            {status === 'REJECTED' && (
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-rose-100 bg-rose-50/60 p-3 rounded-xl">
                <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>This payment proof was rejected. {proof.rejectionReason ? `Reason: ${proof.rejectionReason}` : ''}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-rose-600 text-white shadow-2xs">
                  Rejected
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
