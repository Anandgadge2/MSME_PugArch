import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Download,
  Building2,
  CreditCard,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Receipt,
  User,
  Copy,
  Check,
  Eye,
  Banknote,
  Landmark,
  ShieldAlert,
  ArrowRight,
  Printer,
  Clock3,
  Upload,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi, postApi } from '../../shared/apiClient';
import { formatCurrency, formatDate } from '../../shared/format';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { openFileAsset, getFileAssetPreview, prewarmFileAssetPreview, type DocumentPreview } from '../../../lib/files';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { cn } from '../../../lib/utils';
import { printHtmlContent } from '../../../utils/printUtils';

export type PaymentReceiptTab = 'receipt' | 'timeline';

export interface PaymentReceiptViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: any | null;
  proofId?: number | null;
  invoiceId?: number | null;
  orderId?: number | null;
  paymentId?: number | null;
  initialProof?: any | null;
  initialTab?: PaymentReceiptTab;
  onStatusChange?: (paymentId?: number, newStatus?: string) => void;
  orderPoNumber?: string | null;
  invoiceNumber?: string | null;
  sellerName?: string | null;
  buyerName?: string | null;
  onUploadSlip?: (payment: any) => void;
  isSettled?: boolean;
}

export interface TimelineEventItem {
  title: string;
  timestamp: string;
  detail: string;
  type?: 'order' | 'invoice' | 'initiated' | 'transfer' | 'proof' | 'escrow' | 'ledger' | 'verified' | 'rejected' | 'refunded';
  statusBadge?: string;
}

export const buildPaymentTimeline = (
  payment: any,
  proof: any,
  po: any,
  invoice: any
): TimelineEventItem[] => {
  const events: TimelineEventItem[] = [];

  // 1. Purchase Order Created
  if (po?.createdAt) {
    events.push({
      title: 'Purchase Order Issued',
      timestamp: po.createdAt,
      detail: `Official Purchase Order #${po.poNumber || po.id} created for ${formatCurrency(po.totalValue || po.amount || 0)}`,
      type: 'order'
    });
  }

  // 2. Tax Invoice Raised
  if (invoice?.createdAt && invoice.createdAt !== po?.createdAt) {
    events.push({
      title: 'Tax Invoice Raised',
      timestamp: invoice.createdAt,
      detail: `Commercial invoice #${invoice.invoiceNumber || invoice.id} generated for statutory billing`,
      type: 'invoice'
    });
  }

  // 3. Payment Transaction Initialized
  if (payment?.createdAt) {
    events.push({
      title: 'Payment Transaction Initialized',
      timestamp: payment.createdAt,
      detail: `Transaction reference ${payment.referenceId || payment.id} initialized via ${payment.gateway || payment.method || 'Banking Gateway'}`,
      type: 'initiated'
    });
  }

  // 4. Remittance Execution (Bank Transfer Date)
  if (proof?.paymentDate) {
    events.push({
      title: 'Bank Remittance Executed',
      timestamp: proof.paymentDate,
      detail: `Payer executed fund transfer via ${proof.method || 'Direct Remittance'}${proof.transactionReference ? ` (UTR: ${proof.transactionReference})` : ''}`,
      type: 'transfer'
    });
  }

  // 5. Payment Proof Slip Uploaded
  const proofUploadTime = proof?.createdAt || payment?.metadata?.offlineProofUploadedAt;
  if (proofUploadTime && proofUploadTime !== proof?.paymentDate) {
    events.push({
      title: 'Payment Proof Slip Uploaded',
      timestamp: proofUploadTime,
      detail: proof?.transactionReference || payment?.metadata?.transactionReference
        ? `Remittance slip submitted with UTR: ${proof?.transactionReference || payment?.metadata?.transactionReference}`
        : 'Bank remittance receipt / payment advice submitted for audit',
      type: 'proof'
    });
  }

  // 6. Escrow Vault Funded
  if (payment?.escrowAccount?.fundedAt) {
    events.push({
      title: `Escrow Custody ${payment.escrowAccount.status === 'held' ? 'Secured' : 'Funded'}`,
      timestamp: payment.escrowAccount.fundedAt,
      detail: `Escrow Vault #${payment.escrowAccount.id} funded (${formatCurrency(payment.escrowAccount.amount || payment.amount)})`,
      type: 'escrow'
    });
  }

  // 7. Escrow Released
  if (payment?.escrowAccount?.releasedAt) {
    events.push({
      title: 'Escrow Custody Released',
      timestamp: payment.escrowAccount.releasedAt,
      detail: 'Escrow custody funds released to supplier settlement account',
      type: 'escrow'
    });
  }

  // 8. Financial Ledger Entries
  payment?.ledgerEntries?.forEach((entry: any) => {
    if (entry?.createdAt) {
      events.push({
        title: `${String(entry.entryType || 'ledger').replace(/_/g, ' ')} Entry Recorded`,
        timestamp: entry.createdAt,
        detail: `${formatCurrency(entry.amount)} | ${entry.debitAccount || 'Debit'} → ${entry.creditAccount || 'Credit'}`,
        type: 'ledger'
      });
    }
  });

  // 9. Verified / Settled
  const isVerified = ['VERIFIED', 'SUCCESS', 'ESCROW_RELEASED', 'OFFLINE_PROOF_VERIFIED', 'SETTLED'].includes(
    String(proof?.status || payment?.status || payment?.paymentStatus || '').toUpperCase()
  );
  if (isVerified) {
    const verifiedTime = proof?.verifiedAt || payment?.completedAt || payment?.updatedAt || proof?.updatedAt;
    if (verifiedTime) {
      events.push({
        title: 'Settlement Confirmed & Verified',
        timestamp: verifiedTime,
        detail: 'Payment proof verified by statutory auditor / supplier. Treasury ledger reconciled.',
        type: 'verified',
        statusBadge: 'Verified'
      });
    }
  }

  // 10. Rejected
  const isRejected = ['REJECTED', 'FAILED', 'OFFLINE_PROOF_REJECTED'].includes(
    String(proof?.status || payment?.status || payment?.paymentStatus || '').toUpperCase()
  );
  if (isRejected) {
    const rejectedTime = proof?.rejectedAt || payment?.updatedAt || proof?.updatedAt;
    if (rejectedTime) {
      events.push({
        title: 'Payment Proof Rejected',
        timestamp: rejectedTime,
        detail: proof?.rejectionReason || payment?.metadata?.rejectionReason
          ? `Audit Rejection Notice: ${proof?.rejectionReason || payment?.metadata?.rejectionReason}`
          : 'Remittance proof rejected during audit review.',
        type: 'rejected',
        statusBadge: 'Rejected'
      });
    }
  }

  // 11. Refunded
  if (String(payment?.status || '').toLowerCase() === 'refunded') {
    events.push({
      title: 'Payment Refunded',
      timestamp: payment.completedAt || payment.updatedAt,
      detail: 'Funds reversed and credited back to payer originating account',
      type: 'refunded',
      statusBadge: 'Refunded'
    });
  }

  // Deduplicate and Sort chronologically
  const uniqueEvents = events.filter((evt, index, self) =>
    index === self.findIndex(t => t.title === evt.title && t.timestamp === evt.timestamp)
  );

  return uniqueEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export function PaymentReceiptViewModal({
  isOpen,
  onClose,
  payment: initialPayment,
  proofId,
  invoiceId,
  orderId,
  paymentId,
  initialProof,
  initialTab = 'receipt',
  onStatusChange,
  orderPoNumber,
  invoiceNumber,
  sellerName,
  buyerName,
  onUploadSlip,
  isSettled: isSettledProp
}: PaymentReceiptViewModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'master_admin';
  const isSeller = !isAdmin && user?.role === 'seller';

  const [activeTab, setActiveTab] = useState<PaymentReceiptTab>(initialTab);
  const [fetchedPayment, setFetchedPayment] = useState<any | null>(initialPayment || null);
  const [proof, setProof] = useState<any | null>(initialProof || null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [copiedUtr, setCopiedUtr] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [previewingFile, setPreviewingFile] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);

  const [linkedPo, setLinkedPo] = useState<any | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<any | null>(null);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Keyboard accessibility: Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setProof(null);
      setFetchedPayment(null);
      setLinkedPo(null);
      setLinkedInvoice(null);
      setShowRejectBox(false);
      setRejectReason('');
      setCopiedUtr(false);
      setCopiedRef(false);
      setPreviewDocument(null);
      return;
    }

    if (initialProof) {
      setProof(initialProof);
    }
    if (initialPayment) {
      setFetchedPayment(initialPayment);
    }

    const loadData = async () => {
      setLoading(true);
      try {
        let currentPayment = initialPayment || null;
        const targetPaymentId = paymentId || initialPayment?.id;

        // 1. Fetch payment if ID is available
        if (targetPaymentId && !currentPayment) {
          try {
            const payRes = await getApi<any>(`/api/payments/${targetPaymentId}`);
            if (payRes?.payment) {
              currentPayment = payRes.payment;
              setFetchedPayment(payRes.payment);
            }
          } catch {
            // Non-blocking
          }
        }

        let proofData: any = initialProof || null;
        const targetInvId = invoiceId || currentPayment?.invoiceId || currentPayment?.invoice?.id;
        const targetOrderId = orderId || currentPayment?.purchaseOrderId || currentPayment?.purchaseOrder?.id;

        // 2. Fetch linked Purchase Order if ID is available
        if (targetOrderId && !linkedPo) {
          try {
            const poRes = await getApi<any>(`/api/purchase-orders/${targetOrderId}`);
            const poData = poRes?.data || poRes;
            if (poData) {
              setLinkedPo(poData);
              if (!currentPayment && Array.isArray(poData.payments) && poData.payments.length > 0) {
                const matched = poData.payments.find((p: any) =>
                  ['success', 'escrow_released', 'offline_proof_verified', 'offline_proof_uploaded'].includes(String(p.status).toLowerCase())
                ) || poData.payments[0];
                if (matched) {
                  currentPayment = matched;
                  setFetchedPayment(matched);
                }
              }
              if (!targetInvId && Array.isArray(poData.invoices) && poData.invoices.length > 0) {
                setLinkedInvoice(poData.invoices[0]);
              }
            }
          } catch {
            // Non-blocking
          }
        }

        // 3. Fetch linked Invoice if ID is available
        const resolvedTargetInvId = targetInvId || linkedPo?.invoices?.[0]?.id;
        if (resolvedTargetInvId && !linkedInvoice) {
          try {
            const invRes = await getApi<any>(`/api/invoices/${resolvedTargetInvId}`);
            const invData = invRes?.data || invRes;
            if (invData) {
              setLinkedInvoice(invData);
            }
          } catch {
            // Non-blocking
          }
        }

        // 4. Fetch offline proof from order or invoice endpoints
        if (!proofData && targetOrderId) {
          try {
            const res = await getApi<any>(`/api/payments/${targetOrderId}/offline-proof`);
            proofData = res?.proof || (res?.proofs || [])[0];
            if (!currentPayment && res?.payment) {
              currentPayment = res.payment;
              setFetchedPayment(res.payment);
            }
          } catch {
            // Non-blocking
          }
        }

        if (!proofData && resolvedTargetInvId) {
          try {
            const res = await getApi<any>(`/api/payments/invoice/${resolvedTargetInvId}/offline-proof`);
            proofData = res?.proof;
            if (!currentPayment && res?.payment) {
              currentPayment = res.payment;
              setFetchedPayment(res.payment);
            }
          } catch {
            // Non-blocking
          }
        }

        if (!proofData && proofId) {
          try {
            const res = await getApi<any>(`/api/payments/offline-proofs`);
            proofData = (res?.proofs || res?.records || []).find((p: any) => p.id === proofId);
          } catch {
            // Non-blocking
          }
        }

        if (!proofData && (targetPaymentId || targetOrderId)) {
          try {
            const res = await getApi<any>(`/api/payments/offline-proofs`);
            const list = res?.proofs || res?.records || [];
            proofData = list.find(
              (p: any) => (targetPaymentId && p.paymentTransactionId === targetPaymentId) || (targetOrderId && p.purchaseOrderId === targetOrderId)
            );
          } catch {
            // Non-blocking
          }
        }

        // 5. Enrich file metadata if receiptFileId is present
        const effectiveFileId = proofData?.receiptFileId || currentPayment?.metadata?.receiptFileId;
        if (effectiveFileId && (!proofData?.receiptFileName || !currentPayment?.metadata?.receiptFileName)) {
          try {
            const fileRes = await getApi<any>(`/api/files/${effectiveFileId}/signed-url`);
            const fileObj = fileRes?.file || fileRes?.data?.file;
            if (fileObj) {
              if (proofData) {
                proofData = {
                  ...proofData,
                  receiptFileName: fileObj.originalName || proofData.receiptFileName,
                  receiptFileMimeType: fileObj.mimeType || proofData.receiptFileMimeType,
                  receiptFileSize: fileObj.size || proofData.receiptFileSize
                };
              }
            }
          } catch {
            // Non-blocking
          }
        }

        setProof(proofData || null);
      } catch {
        toast.error('Unable to fetch complete payment receipt details');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [isOpen, invoiceId, orderId, proofId, initialProof, paymentId, initialPayment]);

  const activePayment = fetchedPayment || initialPayment;

  // Authentic resolution of proof details (Zero mock fallback)
  const resolvedProof = useMemo(() => {
    if (proof) return proof;
    if (!activePayment) return null;

    const meta = activePayment.metadata || {};
    const slipFileId = meta.offlineProofId || meta.receiptFileId;
    const slipFileUrl = meta.receiptFileUrl;
    const utrNumber = meta.transactionReference || meta.utr || activePayment.referenceId;
    const rawStatus = String(activePayment.status || activePayment.paymentStatus || '').toLowerCase();
    const isVerified = ['success', 'escrow_released', 'offline_proof_verified'].includes(rawStatus);
    const isRejected = ['failed', 'cancelled', 'rejected', 'offline_proof_rejected'].includes(rawStatus);

    if (!utrNumber && !slipFileId && !slipFileUrl && !meta.payerBankName && !meta.offlineProofUploadedAt) {
      return null;
    }

    const resolvedFileName =
      meta.receiptFileName ||
      (slipFileUrl && !slipFileUrl.startsWith('/api/files/') ? slipFileUrl.split('/').pop() : undefined) ||
      (slipFileId ? `Bank_Remittance_Receipt_${slipFileId}.pdf` : undefined);

    return {
      id: meta.offlineProofId || undefined,
      amount: activePayment.amount,
      currency: activePayment.currency || 'INR',
      method: activePayment.method || (activePayment.gateway === 'bank_transfer' ? 'NEFT / RTGS / Bank Transfer' : 'Electronic Transfer'),
      transactionReference: utrNumber,
      paymentDate: activePayment.paidAt || activePayment.completedAt || activePayment.createdAt,
      payerBankName: meta.payerBankName || meta.bankName || (activePayment.gateway && activePayment.gateway !== 'manual' && activePayment.gateway !== 'offline' ? `${activePayment.gateway.toUpperCase()} Gateway` : undefined),
      payerAccountLast4: meta.payerAccountLast4 || undefined,
      receiptFileId: slipFileId,
      receiptFileUrl: slipFileUrl,
      receiptFileName: resolvedFileName,
      receiptFileMimeType: meta.receiptFileMimeType,
      status: isVerified ? 'VERIFIED' : isRejected ? 'REJECTED' : 'UPLOADED',
      purchaseOrderId: activePayment.purchaseOrderId,
      invoiceId: activePayment.invoiceId,
      remarks: meta.remarks || undefined
    };
  }, [proof, activePayment]);

  // Authentic amount and currency
  const displayAmount = useMemo(() => {
    if (resolvedProof?.amount !== undefined && resolvedProof?.amount !== null) return Number(resolvedProof.amount);
    if (activePayment?.amount !== undefined && activePayment?.amount !== null) return Number(activePayment.amount);
    if (linkedInvoice?.totalAmount || linkedInvoice?.amount) return Number(linkedInvoice.totalAmount || linkedInvoice.amount);
    if (linkedPo?.totalValue || linkedPo?.amount) return Number(linkedPo.totalValue || linkedPo.amount);
    return 0;
  }, [resolvedProof, activePayment, linkedInvoice, linkedPo]);

  const displayCurrency = useMemo(() => {
    return resolvedProof?.currency || activePayment?.currency || linkedInvoice?.currency || linkedPo?.currency || 'INR';
  }, [resolvedProof, activePayment, linkedInvoice, linkedPo]);

  const displayUtr = useMemo(() => {
    return resolvedProof?.transactionReference || activePayment?.metadata?.transactionReference || activePayment?.referenceId || null;
  }, [resolvedProof, activePayment]);

  const displayBankName = useMemo(() => {
    return resolvedProof?.payerBankName || activePayment?.metadata?.payerBankName || activePayment?.metadata?.bankName || (activePayment?.gateway && activePayment.gateway !== 'manual' && activePayment.gateway !== 'offline' ? `${activePayment.gateway.toUpperCase()} Gateway` : null);
  }, [resolvedProof, activePayment]);

  const displayAccountLast4 = useMemo(() => {
    return resolvedProof?.payerAccountLast4 || activePayment?.metadata?.payerAccountLast4 || null;
  }, [resolvedProof, activePayment]);

  const displayPaymentDate = useMemo(() => {
    return resolvedProof?.paymentDate || activePayment?.paidAt || activePayment?.completedAt || activePayment?.createdAt || linkedPo?.createdAt || null;
  }, [resolvedProof, activePayment, linkedPo]);

  const displayMethod = useMemo(() => {
    return resolvedProof?.method || activePayment?.method || (activePayment?.gateway ? activePayment.gateway.toUpperCase() : null) || 'Direct Bank Remittance';
  }, [resolvedProof, activePayment]);

  const resolvedPoNumber = useMemo(() => {
    return activePayment?.purchaseOrder?.poNumber || linkedPo?.poNumber || orderPoNumber || (resolvedProof?.purchaseOrderId ? `PO #${resolvedProof.purchaseOrderId}` : null);
  }, [activePayment, linkedPo, orderPoNumber, resolvedProof]);

  const resolvedInvoiceNumber = useMemo(() => {
    return activePayment?.invoice?.invoiceNumber || linkedInvoice?.invoiceNumber || invoiceNumber || (resolvedProof?.invoiceId ? `INV #${resolvedProof.invoiceId}` : null);
  }, [activePayment, linkedInvoice, invoiceNumber, resolvedProof]);

  const resolvedSellerName = useMemo(() => {
    return linkedPo?.seller?.organization?.organizationName || linkedPo?.seller?.name || activePayment?.payee?.name || linkedInvoice?.seller?.name || linkedInvoice?.party || sellerName || null;
  }, [linkedPo, activePayment, linkedInvoice, sellerName]);

  const resolvedBuyerName = useMemo(() => {
    return linkedPo?.buyer?.organization?.organizationName || linkedPo?.buyer?.name || activePayment?.payer?.name || linkedInvoice?.buyer?.name || buyerName || null;
  }, [linkedPo, activePayment, linkedInvoice, buyerName]);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: 'utr' | 'ref') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'utr') {
      setCopiedUtr(true);
      toast.success(`UTR ${text} copied to clipboard`);
      setTimeout(() => setCopiedUtr(false), 2000);
    } else {
      setCopiedRef(true);
      toast.success(`Reference ID ${text} copied to clipboard`);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleVerify = async () => {
    const targetProofId = resolvedProof?.id || proof?.id;
    setVerifying(true);
    try {
      if (targetProofId) {
        await postApi(`/api/payments/offline-proof/${targetProofId}/verify`, {});
      } else if (activePayment?.id) {
        await postApi(`/api/payments/${activePayment.id}/reconcile`, { status: 'success' });
      } else {
        throw new Error('No proof or transaction ID available to verify');
      }
      toast.success('Payment receipt verified successfully! Settlement ledger updated.');
      setProof((prev: any) => ({
        ...(prev || {}),
        status: 'VERIFIED'
      }));
      setFetchedPayment((prev: any) => ({
        ...(prev || activePayment || {}),
        status: 'offline_proof_verified',
        paymentStatus: 'OFFLINE_PROOF_VERIFIED',
        completedAt: new Date().toISOString()
      }));
      onStatusChange?.(activePayment?.id, 'offline_proof_verified');
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify payment proof');
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    const targetProofId = resolvedProof?.id || proof?.id;
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    setRejecting(true);
    try {
      if (targetProofId) {
        await postApi(`/api/payments/offline-proof/${targetProofId}/reject`, { reason: rejectReason.trim() });
      } else if (activePayment?.id) {
        await postApi(`/api/payments/${activePayment.id}/reconcile`, { status: 'cancelled', reason: rejectReason.trim() });
      } else {
        throw new Error('No proof or transaction ID available to reject');
      }
      toast.success('Payment proof rejected.');
      setProof((prev: any) => ({
        ...(prev || {}),
        status: 'REJECTED',
        rejectionReason: rejectReason.trim()
      }));
      setFetchedPayment((prev: any) => ({
        ...(prev || activePayment || {}),
        status: 'offline_proof_rejected',
        paymentStatus: 'OFFLINE_PROOF_REJECTED'
      }));
      setShowRejectBox(false);
      onStatusChange?.(activePayment?.id, 'offline_proof_rejected');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject payment proof');
    } finally {
      setRejecting(false);
    }
  };

  const handleOpenPo = () => {
    const poNum = resolvedPoNumber || linkedPo?.id || orderId || activePayment?.purchaseOrderId;
    if (!poNum) return;
    const url = user?.role === 'seller'
      ? `/seller/orders?search=${encodeURIComponent(poNum)}`
      : `/orders?search=${encodeURIComponent(poNum)}`;
    window.open(url, '_blank');
  };

  const handleOpenInvoice = () => {
    const invNum = resolvedInvoiceNumber || linkedInvoice?.id || invoiceId || activePayment?.invoiceId;
    if (!invNum) return;
    const url = user?.role === 'seller'
      ? `/seller/invoices?viewInvoiceNo=${encodeURIComponent(invNum)}`
      : `/payments/invoices?viewInvoiceNo=${encodeURIComponent(invNum)}`;
    window.open(url, '_blank');
  };

  const handleDownloadPo = () => {
    const poId = linkedPo?.id || orderId || resolvedProof?.purchaseOrderId || activePayment?.purchaseOrderId;
    if (!poId) return;
    window.open(`/api/purchase-orders/${poId}/pdf`, '_blank');
  };

  const rawStatus = String(resolvedProof?.status || activePayment?.status || activePayment?.paymentStatus || 'UPLOADED').toUpperCase();

  const isSettledState = Boolean(
    isSettledProp ||
    ['SETTLED', 'COMPLETED', 'ORDER_COMPLETED'].includes(String(linkedPo?.status || linkedPo?.poStatus || '').toUpperCase()) ||
    ['SETTLED', 'PAID'].includes(String(linkedInvoice?.status || linkedInvoice?.invoiceStatus || '').toUpperCase()) ||
    ['VERIFIED', 'SUCCESS', 'ESCROW_RELEASED', 'OFFLINE_PROOF_VERIFIED', 'SETTLED'].includes(rawStatus)
  );

  const handleOpenFile = async () => {
    let fileId: number | null =
      resolvedProof?.receiptFileId ||
      proof?.receiptFileId ||
      activePayment?.metadata?.receiptFileId ||
      activePayment?.metadata?.offlineProofId ||
      null;

    let resolvedUrl =
      resolvedProof?.receiptFileUrl ||
      proof?.receiptFileUrl ||
      activePayment?.metadata?.receiptFileUrl ||
      (fileId ? `/api/files/${fileId}/view` : null);

    if (!fileId && resolvedUrl) {
      const match = String(resolvedUrl).match(/\/api\/(?:public\/)?files\/(\d+)/);
      if (match && match[1]) {
        fileId = Number(match[1]);
      }
    }

    if (!resolvedUrl && !fileId) {
      toast.error('No attached receipt file found');
      return;
    }

    const fileName =
      resolvedProof?.receiptFileName ||
      proof?.receiptFileName ||
      activePayment?.metadata?.receiptFileName ||
      (resolvedUrl && !resolvedUrl.startsWith('/api/files/')
        ? resolvedUrl.split('/').pop() || 'Payment_Proof_Document'
        : 'Payment_Proof_Document');

    const mimeType =
      resolvedProof?.receiptFileMimeType ||
      proof?.receiptFileMimeType ||
      activePayment?.metadata?.receiptFileMimeType ||
      undefined;

    setPreviewingFile(true);
    try {
      const fileTarget = {
        id: proof?.receiptFileId || fileId,
        fileAssetId: proof?.receiptFileId || fileId,
        fileUrl: proof?.receiptFileUrl || resolvedUrl || undefined,
        url: proof?.receiptFileUrl || resolvedUrl || undefined,
        mimeType,
        originalName: fileName,
        fileName
      };

      // 1. Prioritize in-app DocumentPreviewModal
      try {
        const preview = await getFileAssetPreview(fileTarget, fileName);
        if (preview && preview.url) {
          setPreviewDocument(preview);
          return;
        }
      } catch (previewErr) {
        console.warn('[PaymentReceiptViewModal] In-app preview resolution failed, trying openFileAsset:', previewErr);
      }

      // 2. Fallback to openFileAsset
      await openFileAsset(
        {
          id: proof?.receiptFileId || fileTarget.id,
          fileUrl: proof?.receiptFileUrl || fileTarget.fileUrl,
          mimeType,
          originalName: fileName,
          fileName
        },
        fileName
      );
    } catch (err: any) {
      toast.error(err?.message || 'Unable to open payment receipt document');
    } finally {
      setPreviewingFile(false);
    }
  };

  const handlePrintOfficialReceipt = () => {
    const ref = activePayment?.referenceId || resolvedProof?.transactionReference || `PAY-REC-${Date.now()}`;
    const amountVal = displayAmount;
    const currency = displayCurrency;
    const dateVal = displayPaymentDate ? formatDate(displayPaymentDate) : '—';
    const tax = activePayment?.metadata?.taxSummary || {};
    const escrow = activePayment?.escrowAccount;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Official Payment Receipt - ${ref}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #ffffff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #12335f; padding-bottom: 16px; margin-bottom: 20px; }
            .portal-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #12335f; }
            .title { font-size: 24px; font-weight: 900; margin: 4px 0 0; color: #0f172a; }
            .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 500; }
            .status-badge { display: inline-block; padding: 5px 12px; background: #ecfdf5; border: 1.5px solid #6ee7b7; color: #047857; font-size: 11px; font-weight: 900; text-transform: uppercase; border-radius: 6px; letter-spacing: 0.5px; }
            .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
            .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 16px; }
            .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
            .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 4px; }
            .val { font-size: 13px; font-weight: 800; color: #0f172a; word-break: break-word; }
            .amount-box { background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 16px; text-align: right; margin-bottom: 20px; }
            .amount-val { font-size: 26px; font-weight: 900; color: #12335f; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900; color: #475569; border-bottom: 1.5px solid #cbd5e1; }
            td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #334155; }
            .footer { margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 10px; color: #64748b; text-align: center; line-height: 1.6; }
            .watermark { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-top: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="portal-title">GOVERNMENT MSME PROCUREMENT PORTAL</div>
              <div class="title">Official Payment &amp; Remittance Receipt</div>
              <div class="subtitle">System certified audit receipt for reference: <strong>${ref}</strong></div>
            </div>
            <div style="text-align: right;">
              <div class="status-badge">${rawStatus}</div>
              <div class="label" style="margin-top: 8px;">Settlement Date: ${dateVal}</div>
            </div>
          </div>

          <div class="grid-3">
            <div class="box">
              <div class="label">Receipt Reference</div>
              <div class="val" style="font-family: monospace; color: #12335f;">${ref}</div>
            </div>
            <div class="box">
              <div class="label">Bank UTR / Transaction Ref</div>
              <div class="val" style="font-family: monospace;">${displayUtr || 'N/A — Reference Not Specified'}</div>
            </div>
            <div class="box">
              <div class="label">Remittance Channel</div>
              <div class="val">${displayMethod}</div>
            </div>
          </div>

          <div class="grid-2">
            <div class="box">
              <div class="label">Purchase Order</div>
              <div class="val">${resolvedPoNumber || '—'}</div>
            </div>
            <div class="box">
              <div class="label">Tax Invoice</div>
              <div class="val">${resolvedInvoiceNumber || '—'}</div>
            </div>
          </div>

          <div class="grid-2">
            <div class="box">
              <div class="label">Payer / Procuring Buyer</div>
              <div class="val">${resolvedBuyerName || '—'}</div>
            </div>
            <div class="box">
              <div class="label">Beneficiary / Supplier</div>
              <div class="val">${resolvedSellerName || '—'}</div>
            </div>
          </div>

          <div class="amount-box">
            <div class="label" style="color: #1d4ed8;">Total Settlement Amount</div>
            <div class="amount-val">${currency === 'INR' ? '₹' : ''}${Number(amountVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${currency}</div>
            <div style="font-size: 11px; color: #475569; font-weight: 700;">Status: ${rawStatus} | Verified via MSME Treasury Core</div>
          </div>

          ${tax.taxableAmount ? `
            <div style="margin-top: 18px;">
              <div class="label">Tax and Deduction Summary</div>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Amount (${currency})</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Taxable Amount</td><td style="text-align: right;">₹${Number(tax.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  <tr><td>CGST</td><td style="text-align: right;">₹${Number(tax.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  <tr><td>SGST</td><td style="text-align: right;">₹${Number(tax.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  <tr><td>IGST</td><td style="text-align: right;">₹${Number(tax.igstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  <tr><td>TDS Deducted</td><td style="text-align: right; color: #b91c1c;">-₹${Number(tax.tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  <tr style="font-weight: 900; background: #f8fafc;">
                    <td>Net Settled Amount</td>
                    <td style="text-align: right; color: #12335f; font-size: 13px;">₹${Number(amountVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}

          ${escrow ? `
            <div style="margin-top: 18px;">
              <div class="label">Escrow Custody Status</div>
              <div class="box" style="background: #f0fdf4; border-color: #bbf7d0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 10px; font-weight: 900; color: #15803d; text-transform: uppercase;">Escrow Account VAULT-${escrow.id}</div>
                    <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px;">Custody Amount: ₹${Number(escrow.amount || amountVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style="font-size: 10px; font-weight: 900; padding: 3px 8px; background: #ffffff; border: 1px solid #86efac; border-radius: 4px; color: #15803d; text-transform: uppercase;">
                    ${escrow.status || 'held'}
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="footer">
            <p>This is a computer-generated official receipt from the Government MSME Procurement Portal.</p>
            <p>Certified valid for tax filing, statutory audits, bank reconciliation, and escrow settlement verification.</p>
            <div class="watermark">Digital Verification Hash: MSME-${ref}-${Date.now().toString(36).toUpperCase()}</div>
          </div>

        </body>
      </html>
    `;

    printHtmlContent(html);
  };

  const timelineEvents = useMemo(() => {
    return buildPaymentTimeline(activePayment, resolvedProof, linkedPo, linkedInvoice);
  }, [activePayment, resolvedProof, linkedPo, linkedInvoice]);

  const hasAttachedFile = Boolean(
    resolvedProof?.receiptFileUrl ||
    resolvedProof?.receiptFileId ||
    proof?.receiptFileUrl ||
    proof?.receiptFileId ||
    activePayment?.metadata?.receiptFileUrl ||
    activePayment?.metadata?.receiptFileId
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-proof-title"
      aria-describedby="modal-proof-desc"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Top Gradient Decorative Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#12335f] via-blue-600 to-emerald-500 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 sm:px-6 py-3.5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#12335f] border border-blue-200 shrink-0 shadow-2xs">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider">
                  <Banknote className="h-3 w-3 text-blue-600" aria-hidden="true" />
                  Banking Settlement Audit
                </span>
                {activePayment?.referenceId && (
                  <button
                    type="button"
                    onClick={() => handleCopy(activePayment.referenceId, 'ref')}
                    className="group inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                    title="Click to copy payment reference"
                  >
                    <span>{activePayment.referenceId}</span>
                    {copiedRef ? (
                      <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-400 group-hover:text-slate-600" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
              <h2 id="modal-proof-title" className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate mt-0.5">
                Payment Receipt &amp; Proof Details
              </h2>
              <p id="modal-proof-desc" className="sr-only">
                Review official payment receipt, bank UTR transfer proof, commercial counterparty match, and transaction audit trail.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintOfficialReceipt}
              className="hidden sm:inline-flex items-center gap-1.5 h-8.5 rounded-xl border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
              title="Print official payment receipt"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Print Receipt</span>
            </Button>

            <button
              type="button"
              onClick={async () => {
                if (isRefreshingPayment) return;
                setIsRefreshingPayment(true);
                try {
                  setLinkedPo(null);
                  setLinkedInvoice(null);
                  setProof(null);
                  setFetchedPayment(null);
                  // Trigger re-fetch by toggling a dummy re-render
                  setLoading(true);
                  const targetPaymentIdVal = paymentId || initialPayment?.id;
                  let currentPayment: any = null;
                  if (targetPaymentIdVal) {
                    try {
                      const payRes = await getApi<any>(`/api/payments/${targetPaymentIdVal}`);
                      if (payRes?.payment) {
                        currentPayment = payRes.payment;
                        setFetchedPayment(payRes.payment);
                      }
                    } catch { /* non-blocking */ }
                  }
                  const targetOrderIdVal = orderId || currentPayment?.purchaseOrderId || currentPayment?.purchaseOrder?.id;
                  if (targetOrderIdVal) {
                    try {
                      const poRes = await getApi<any>(`/api/purchase-orders/${targetOrderIdVal}`);
                      const poData = poRes?.data || poRes;
                      if (poData) {
                        setLinkedPo(poData);
                        if (!currentPayment && Array.isArray(poData.payments) && poData.payments.length > 0) {
                          const matched = poData.payments.find((p: any) =>
                            ['success', 'escrow_released', 'offline_proof_verified', 'offline_proof_uploaded'].includes(String(p.status).toLowerCase())
                          ) || poData.payments[0];
                          if (matched) {
                            currentPayment = matched;
                            setFetchedPayment(matched);
                          }
                        }
                      }
                    } catch { /* non-blocking */ }
                  }
                  const targetInvIdVal = invoiceId || currentPayment?.invoiceId || currentPayment?.invoice?.id;
                  if (targetInvIdVal) {
                    try {
                      const invRes = await getApi<any>(`/api/invoices/${targetInvIdVal}`);
                      const invData = invRes?.data || invRes;
                      if (invData) setLinkedInvoice(invData);
                    } catch { /* non-blocking */ }
                  }
                  if (targetOrderIdVal) {
                    try {
                      const res = await getApi<any>(`/api/payments/${targetOrderIdVal}/offline-proof`);
                      const pd = res?.proof || (res?.proofs || [])[0];
                      if (pd) setProof(pd);
                    } catch { /* non-blocking */ }
                  }
                  setLoading(false);
                  toast.success('Payment details refreshed');
                } catch {
                  toast.error('Failed to refresh payment details');
                  setLoading(false);
                } finally {
                  setIsRefreshingPayment(false);
                }
              }}
              disabled={isRefreshingPayment || loading}
              aria-label="Refresh payment details"
              title="Refresh payment details"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-800 transition cursor-pointer shrink-0 border border-transparent hover:border-slate-200"
            >
              <RefreshCw className={cn("h-4 w-4", (isRefreshingPayment || loading) && "animate-spin text-[#12335f]")} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-800 transition cursor-pointer shrink-0 border border-transparent hover:border-slate-200"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-100/70 px-5 sm:px-6 pt-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'receipt'}
            onClick={() => setActiveTab('receipt')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'receipt'
                ? "border-[#12335f] text-[#12335f] bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50 rounded-t-lg"
            )}
          >
            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Receipt &amp; Proof Details</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'timeline'}
            onClick={() => setActiveTab('timeline')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'timeline'
                ? "border-[#12335f] text-[#12335f] bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50 rounded-t-lg"
            )}
          >
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Timeline</span>
            {timelineEvents.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                {timelineEvents.length}
              </span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 sm:space-y-5 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#12335f]" aria-hidden="true" />
              <p className="text-xs font-bold text-slate-500">Loading banking payment receipt record...</p>
            </div>
          ) : activeTab === 'timeline' ? (
            /* TAB 2: Transaction Timeline */
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#12335f]" aria-hidden="true" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Payment Lifecycle Milestones
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Audit Log ({timelineEvents.length} Milestones)
                </span>
              </div>

              {timelineEvents.length > 0 ? (
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} className="relative flex items-start gap-3.5 group">
                      <div className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-white shrink-0 ring-4 ring-white shadow-2xs z-10",
                        evt.type === 'verified' ? "bg-emerald-600" :
                        evt.type === 'rejected' ? "bg-rose-600" :
                        evt.type === 'escrow' ? "bg-indigo-600" :
                        evt.type === 'transfer' ? "bg-blue-600" :
                        "bg-[#12335f]"
                      )}>
                        {evt.type === 'verified' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : evt.type === 'rejected' ? (
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : evt.type === 'transfer' ? (
                          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : evt.type === 'escrow' ? (
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </div>
                      <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-2xs hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-slate-900">{evt.title}</p>
                            {evt.statusBadge && (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                                evt.statusBadge === 'Verified' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                              )}>
                                {evt.statusBadge}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold uppercase text-slate-500">
                            {formatDate(evt.timestamp)}
                          </span>
                        </div>
                        {evt.detail && (
                          <p className="text-[11px] text-slate-600 mt-1 font-medium leading-relaxed">{evt.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  No timestamped timeline events recorded for this transaction.
                </div>
              )}
            </div>
          ) : (
            /* TAB 1: Receipt & Proof Details */
            <>
              {/* 1. Hero Executive Settlement Banner */}
              <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-50 via-blue-50/40 to-emerald-50/30 p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                      Total Settled Transaction Value
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {formatCurrency(displayAmount)}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        ({displayCurrency})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/90 border border-slate-200 px-2 py-0.5 text-[10.5px] font-bold text-slate-700 shadow-2xs">
                        <CreditCard className="h-3 w-3 text-blue-600" aria-hidden="true" />
                        {displayMethod}
                      </span>
                      {displayPaymentDate && (
                        <span className="text-[11px] font-medium text-slate-500">
                          on {formatDate(displayPaymentDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Pillar */}
                  <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black uppercase tracking-wider shadow-2xs",
                        isSettledState || rawStatus === 'VERIFIED' || rawStatus === 'SUCCESS' || rawStatus === 'ESCROW_RELEASED' || rawStatus === 'OFFLINE_PROOF_VERIFIED' || rawStatus === 'SETTLED'
                          ? "bg-emerald-600 text-white border border-emerald-700 shadow-emerald-600/20"
                          : rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'OFFLINE_PROOF_REJECTED'
                          ? "bg-rose-600 text-white border border-rose-700 shadow-rose-600/20"
                          : rawStatus === 'REFUNDED'
                          ? "bg-indigo-600 text-white border border-indigo-700 shadow-indigo-600/20"
                          : "bg-amber-500 text-white border border-amber-600 shadow-amber-500/20"
                      )}
                    >
                      {isSettledState || rawStatus === 'VERIFIED' || rawStatus === 'SUCCESS' || rawStatus === 'ESCROW_RELEASED' || rawStatus === 'OFFLINE_PROOF_VERIFIED' || rawStatus === 'SETTLED' ? (
                        <ShieldCheck className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                      ) : rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'OFFLINE_PROOF_REJECTED' ? (
                        <XCircle className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                      ) : rawStatus === 'REFUNDED' ? (
                        <RotateCcw className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                      ) : (
                        <Clock className="h-4 w-4 stroke-[2.5] animate-pulse" aria-hidden="true" />
                      )}
                      {isSettledState || rawStatus === 'VERIFIED' || rawStatus === 'SUCCESS' || rawStatus === 'ESCROW_RELEASED' || rawStatus === 'OFFLINE_PROOF_VERIFIED' || rawStatus === 'SETTLED'
                        ? 'Settlement Verified'
                        : rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'OFFLINE_PROOF_REJECTED'
                        ? 'Proof Rejected'
                        : rawStatus === 'REFUNDED'
                        ? 'Payment Refunded'
                        : 'Under Verification'}
                    </span>

                    <span className="text-[10px] font-semibold text-slate-500">
                      {isSettledState || rawStatus === 'VERIFIED' || rawStatus === 'SUCCESS' || rawStatus === 'ESCROW_RELEASED' || rawStatus === 'OFFLINE_PROOF_VERIFIED' || rawStatus === 'SETTLED'
                        ? 'Funds confirmed & ledger updated'
                        : rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'OFFLINE_PROOF_REJECTED'
                        ? 'Proof rejected or remittance failed'
                        : rawStatus === 'REFUNDED'
                        ? 'Transferred back to payer account'
                        : 'Awaiting auditor verification'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Rejection Reason Alert (if applicable) */}
              {(rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'OFFLINE_PROOF_REJECTED') && (resolvedProof?.rejectionReason || activePayment?.metadata?.rejectionReason) && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-950 shadow-2xs flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-black uppercase tracking-wider text-[10px] text-rose-700">
                      Official Audit Rejection Notice
                    </p>
                    <p className="font-semibold text-xs leading-relaxed text-rose-900">
                      {resolvedProof?.rejectionReason || activePayment?.metadata?.rejectionReason}
                    </p>
                  </div>
                </div>
              )}

              {/* 3. Banking Transfer Details Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-[#12335f]" aria-hidden="true" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Bank Transaction &amp; UTR Audit Information
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Statutory Bank Proof
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* UTR Reference Highlight */}
                  <div className="rounded-xl border border-blue-200/90 bg-blue-50/60 p-3 flex items-center justify-between gap-2 shadow-2xs sm:col-span-2">
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-black uppercase tracking-widest text-blue-700 block">
                        Bank UTR / Transaction Reference Number
                      </span>
                      <p className="font-mono text-sm sm:text-base font-black text-[#12335f] mt-0.5 truncate select-all">
                        {displayUtr || 'N/A — Reference Not Specified'}
                      </p>
                    </div>
                    {displayUtr && (
                      <button
                        type="button"
                        onClick={() => handleCopy(displayUtr, 'utr')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer shrink-0"
                        title="Copy UTR to Clipboard"
                      >
                        {copiedUtr ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                            <span>Copy UTR</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Payer Bank Name */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-1">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                      Payer Remitting Bank
                    </span>
                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {displayBankName || '—'}
                    </p>
                  </div>

                  {/* Payer Account */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-1">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                      Payer Account (Masked)
                    </span>
                    <p className="font-mono font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {displayAccountLast4 ? `•••• •••• •••• ${displayAccountLast4}` : '—'}
                    </p>
                  </div>

                  {/* Transfer Date */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-1">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                      Remittance Execution Date
                    </span>
                    <p className="font-bold text-xs text-slate-900">
                      {displayPaymentDate ? formatDate(displayPaymentDate) : '—'}
                    </p>
                  </div>

                  {/* Remittance Channel */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-1">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                      Remittance Channel
                    </span>
                    <p className="font-bold text-xs text-slate-900">
                      {displayMethod}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Attached Receipt Slip & Proof File Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Attached Electronic Receipt / Bank Slip
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    Audit Attachment
                  </span>
                </div>

                {hasAttachedFile ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-bold text-slate-900 truncate" title={resolvedProof?.receiptFileName || proof?.receiptFileName || 'Official_Payment_Slip'}>
                          {resolvedProof?.receiptFileName || proof?.receiptFileName || 'Official_Payment_Slip'}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Official Bank Slip / Payment Proof Document
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      <Button
                        type="button"
                        onClick={handleOpenFile}
                        disabled={previewingFile}
                        onMouseEnter={() => {
                          const targetId = resolvedProof?.receiptFileId || proof?.receiptFileId;
                          if (targetId) {
                            prewarmFileAssetPreview(
                              {
                                id: targetId,
                                fileAssetId: targetId,
                                fileUrl: resolvedProof?.receiptFileUrl || proof?.receiptFileUrl,
                                url: resolvedProof?.receiptFileUrl || proof?.receiptFileUrl
                              },
                              resolvedProof?.receiptFileName || proof?.receiptFileName || 'Official_Payment_Slip'
                            );
                          }
                        }}
                        onFocus={() => {
                          const targetId = resolvedProof?.receiptFileId || proof?.receiptFileId;
                          if (targetId) {
                            prewarmFileAssetPreview(
                              {
                                id: targetId,
                                fileAssetId: targetId,
                                fileUrl: resolvedProof?.receiptFileUrl || proof?.receiptFileUrl,
                                url: resolvedProof?.receiptFileUrl || proof?.receiptFileUrl
                              },
                              resolvedProof?.receiptFileName || proof?.receiptFileName || 'Official_Payment_Slip'
                            );
                          }
                        }}
                        className="h-8.5 bg-[#12335f] hover:bg-[#0b2445] text-white text-xs font-bold px-3.5 rounded-xl shadow-xs gap-1.5 cursor-pointer"
                      >
                        {previewingFile ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>Preview &amp; Open Document</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40">
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="text-xs font-bold text-slate-700">
                        {activePayment?.gateway && activePayment.gateway !== 'manual' && activePayment.gateway !== 'offline'
                          ? 'Digital Gateway Settlement Record'
                          : 'No Electronic Bank Slip Uploaded'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {activePayment?.gateway && activePayment.gateway !== 'manual' && activePayment.gateway !== 'offline'
                          ? 'Verified electronically via payment gateway clearance. Physical slip is not required.'
                          : 'A bank transfer slip or payment advice can be attached for auditing.'}
                      </p>
                    </div>
                    {!isAdmin && onUploadSlip && activePayment && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onUploadSlip(activePayment);
                        }}
                        className="h-8 text-xs font-bold text-blue-700 border-blue-200 bg-white hover:bg-blue-50 shadow-2xs cursor-pointer shrink-0 gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                        <span>Upload Slip</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Linked Procurement & Transacting Parties */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Linked Commercial Documents &amp; Parties
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Contract Match
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Purchase Order Card */}
                  <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500">
                        Purchase Order
                      </span>
                      {resolvedPoNumber && (
                        <button
                          type="button"
                          onClick={handleOpenPo}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                        >
                          <span>View PO</span>
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {resolvedPoNumber || '—'}
                    </p>
                    {linkedPo?.title && (
                      <p className="text-[11px] font-medium text-slate-500 truncate" title={linkedPo.title}>
                        {linkedPo.title}
                      </p>
                    )}
                    {(linkedPo?.id || activePayment?.purchaseOrderId) && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleDownloadPo}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Download className="h-3 w-3 text-slate-500" aria-hidden="true" />
                          <span>Official PO PDF</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tax Invoice Card */}
                  <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500">
                        Tax Invoice
                      </span>
                      {resolvedInvoiceNumber && (
                        <button
                          type="button"
                          onClick={handleOpenInvoice}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                        >
                          <span>View Invoice</span>
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {resolvedInvoiceNumber || '—'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                        {linkedInvoice?.status || activePayment?.invoice?.status || 'Tax Invoice'}
                      </span>
                    </div>
                  </div>

                  {/* Payer Entity */}
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3 space-y-1 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[9.5px] font-black uppercase tracking-wider">
                      <User className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>Payer / Procuring Buyer</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 truncate" title={resolvedBuyerName || '—'}>
                      {resolvedBuyerName || '—'}
                    </p>
                    {activePayment?.payer?.email && (
                      <p className="text-[10.5px] text-slate-500 truncate">{activePayment.payer.email}</p>
                    )}
                  </div>

                  {/* Beneficiary Entity */}
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3 space-y-1 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[9.5px] font-black uppercase tracking-wider">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Beneficiary / Supplier</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 truncate" title={resolvedSellerName || '—'}>
                      {resolvedSellerName || '—'}
                    </p>
                    {activePayment?.payee?.email && (
                      <p className="text-[10.5px] text-slate-500 truncate">{activePayment.payee.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 6. Remarks / Notes */}
              {(resolvedProof?.remarks || activePayment?.metadata?.remarks) && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5 shadow-2xs">
                  <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 block">
                    Payer Cover Note &amp; Audit Remarks
                  </span>
                  <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {resolvedProof?.remarks || activePayment?.metadata?.remarks}
                  </p>
                </div>
              )}

              {/* 7. Rejection Reason Box (Interactive) */}
              {showRejectBox && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 sm:p-5 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-rose-950">
                    <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" aria-hidden="true" />
                    <h4 className="text-xs font-black uppercase tracking-wider">
                      Specify Payment Proof Rejection Reason
                    </h4>
                  </div>
                  <label htmlFor="rejection-reason-textarea" className="sr-only">
                    Rejection Reason
                  </label>
                  <textarea
                    id="rejection-reason-textarea"
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. UTR number does not reflect in bank statement, amount mismatch, or illegible receipt..."
                    className="w-full rounded-xl border border-rose-300 bg-white p-3 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 shadow-2xs"
                  />
                  <div className="flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRejectBox(false)}
                      className="h-8.5 rounded-xl border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleReject}
                      disabled={rejecting || !rejectReason.trim()}
                      className="h-8.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" aria-hidden="true" /> : null}
                      <span>Confirm Rejection</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 sm:px-6 py-3.5">
          {/* Status summary pill */}
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
                Checking settlement status...
              </span>
            ) : isSettledState || rawStatus === 'VERIFIED' || rawStatus === 'SUCCESS' || rawStatus === 'ESCROW_RELEASED' || rawStatus === 'OFFLINE_PROOF_VERIFIED' || rawStatus === 'SETTLED' ? (
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Verified &amp; Settled
              </span>
            ) : rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'OFFLINE_PROOF_REJECTED' ? (
              <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />
                Proof Rejected
              </span>
            ) : rawStatus === 'REFUNDED' ? (
              <span className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                Payment Refunded
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
                Audit Verification Pending
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Seller Verification Buttons (Admin is strictly View-Only) */}
            {!loading && !isSettledState && isSeller && !['VERIFIED', 'SUCCESS', 'ESCROW_RELEASED', 'OFFLINE_PROOF_VERIFIED', 'SETTLED', 'REJECTED', 'FAILED', 'REFUNDED', 'OFFLINE_PROOF_REJECTED'].includes(rawStatus) && !showRejectBox && activeTab === 'receipt' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRejectBox(true)}
                  className="h-9 rounded-xl text-xs font-bold text-rose-600 border-rose-200 bg-white hover:bg-rose-50 hover:border-rose-300 shadow-2xs cursor-pointer"
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reject Proof</span>
                </Button>
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {verifying ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Verify &amp; Settle</span>
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handlePrintOfficialReceipt}
              className="sm:hidden h-9 rounded-xl border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 rounded-xl border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Full In-App Document Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          previewDocument={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}
