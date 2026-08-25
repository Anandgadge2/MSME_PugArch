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
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi, postApi } from '../../shared/apiClient';
import { formatCurrency, formatDate } from '../../shared/format';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';

export interface PaymentReceiptViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proofId?: number | null;
  invoiceId?: number | null;
  orderId?: number | null;
  paymentId?: number | null;
  initialProof?: any | null;
  onStatusChange?: () => void;
}

export function PaymentReceiptViewModal({
  isOpen,
  onClose,
  proofId,
  invoiceId,
  orderId,
  paymentId,
  initialProof,
  onStatusChange
}: PaymentReceiptViewModalProps) {
  const { user } = useAuth();
  const isAdminOrSeller = user?.role === 'admin' || user?.role === 'seller' || user?.role === 'master_admin';

  const [proof, setProof] = useState<any | null>(initialProof || null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setProof(null);
      setShowRejectBox(false);
      setRejectReason('');
      return;
    }

    if (initialProof) {
      setProof(initialProof);
      return;
    }

    const loadProof = async () => {
      setLoading(true);
      try {
        let data: any = null;
        if (invoiceId) {
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
      } catch (err: any) {
        toast.error('Unable to fetch payment proof details');
      } finally {
        setLoading(false);
      }
    };

    void loadProof();
  }, [isOpen, invoiceId, orderId, proofId, initialProof]);

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

  const status = String(proof?.status || 'UPLOADED').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Payment Receipt & Proof Details</h2>
              <p className="text-xs font-semibold text-slate-500">
                {proof?.transactionReference ? `UTR: ${proof.transactionReference}` : 'Offline Bank Transfer Record'}
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#12335f]" />
            <p className="text-xs font-bold text-slate-500">Loading payment proof record...</p>
          </div>
        ) : !proof ? (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800">No Payment Receipt Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No offline bank transfer receipt or UTR proof has been uploaded for this transaction yet.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Status Pill Card */}
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Paid Amount</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">{formatCurrency(proof.amount)}</p>
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
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : status === 'REJECTED' ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
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
                    <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {proof.receiptFileUrl.split('/').pop() || 'Payment_Receipt.pdf'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={proof.receiptFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#12335f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0b2445] transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View / Download
                    </a>
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
                    className="h-8 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleReject}
                    disabled={rejecting || !rejectReason.trim()}
                    className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                  >
                    {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            )}

            {/* Admin / Seller Action Buttons */}
            {isAdminOrSeller && status !== 'VERIFIED' && !showRejectBox && (
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRejectBox(true)}
                  className="h-10 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50"
                >
                  <XCircle className="mr-1.5 h-4 w-4" /> Reject Proof
                </Button>
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider px-5 shadow-sm"
                >
                  {verifying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Verify & Settle Payment
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
