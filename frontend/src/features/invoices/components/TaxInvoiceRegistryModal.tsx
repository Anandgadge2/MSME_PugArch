'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  FileText,
  Truck,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Stamp,
  Download,
  ChevronDown,
  Clock,
  Lock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { formatDate } from '../../shared/format';
import { getApi, postApi } from '../../shared/apiClient';
import { TaxInvoiceCard } from './TaxInvoiceCard';
import { SignatureStampUploadModal } from './SignatureStampUploadModal';
import { generateTaxInvoicePdf, TaxInvoiceData, TaxInvoiceItem } from '../lib/invoicePdfGenerator';
import { canDisburseInvoicePayment } from '../../shared/procurementLifecycleUtils';

export interface TaxInvoiceRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: number | null;
  initialInvoiceData?: any | null;
  onInvoiceApproved?: (updatedInvoice: any) => void;
}

export function TaxInvoiceRegistryModal({
  isOpen,
  onClose,
  invoiceId,
  initialInvoiceData = null,
  onInvoiceApproved
}: TaxInvoiceRegistryModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<any>(initialInvoiceData);
  const [loading, setLoading] = useState(!initialInvoiceData && Boolean(invoiceId));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copyType, setCopyType] = useState('Original Copy');
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectedDeliveryId, setConnectedDeliveryId] = useState<number | string | null>(null);
  const [connectedGrnId, setConnectedGrnId] = useState<number | string | null>(null);

  // Refresh invoice data handler
  const handleRefreshInvoice = async () => {
    const effectiveId = invoiceId || initialInvoiceData?.id || invoice?.id;
    if (!effectiveId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const data = await getApi<any>(`/api/invoices/${effectiveId}`, true);
      if (data) {
        setInvoice(prev => ({
          ...(prev || {}),
          ...data,
          purchaseOrder: data.purchaseOrder || prev?.purchaseOrder,
          seller: data.seller || prev?.seller,
          buyer: data.buyer || prev?.buyer
        }));
      }
      const effPoId = data?.purchaseOrderId || data?.purchaseOrder?.id || invoice?.purchaseOrderId || invoice?.purchaseOrder?.id;
      if (effPoId) {
        const [delRes, grnRes]: any = await Promise.allSettled([
          getApi<any>(`/api/delivery/by-purchase-order/${effPoId}`, true),
          getApi<any>(`/api/grn/po/${effPoId}/eligibility`, true)
        ]);
        if (delRes?.status === 'fulfilled') {
          const d = delRes.value?.data || delRes.value;
          if (d?.id) setConnectedDeliveryId(d.id);
        }
        if (grnRes?.status === 'fulfilled') {
          const list = grnRes.value?.existing || grnRes.value?.data?.existing || [];
          if (list?.[0]?.id) setConnectedGrnId(list[0].id);
        }
      }
      toast.success('Tax invoice details refreshed successfully');
    } catch {
      toast.error('Failed to refresh tax invoice details');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Approve invoice handler
  const handleApproveInvoice = async () => {
    const targetId = invoice?.id || invoiceId;
    if (!targetId || isApproving) return;
    setIsApproving(true);
    try {
      const res = await postApi<any>(`/api/invoices/${targetId}/approve`, {});
      toast.success('Tax invoice approved successfully! Payment is now unlocked.');
      const updated = {
        ...(invoice || {}),
        status: 'approved',
        invoiceStatus: 'APPROVED',
        approvedAt: new Date().toISOString(),
        ...(res?.invoice || {})
      };
      setInvoice(updated);
      onInvoiceApproved?.(updated);
    } catch (err: any) {
      toast.error(err?.message || 'Invoice approval failed');
    } finally {
      setIsApproving(false);
    }
  };

  // Seller/Buyer branding
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  const handleOpenBranding = () => {
    setIsBrandingModalOpen(true);
  };

  // Load branding from canonical user invoice-branding endpoint
  useEffect(() => {
    try {
      const storedLogo = localStorage.getItem('msme_invoice_logo') || localStorage.getItem('seller_invoice_logo');
      if (storedLogo) setLogoUrl(storedLogo);
      const storedStamp = localStorage.getItem('msme_invoice_stamp') || localStorage.getItem('seller_invoice_stamp');
      if (storedStamp) setStampUrl(storedStamp);
      const storedSig = localStorage.getItem('msme_invoice_signature') || localStorage.getItem('seller_invoice_signature');
      if (storedSig) setSignatureUrl(storedSig);
    } catch {
      // ignore
    }

    void getApi<any>('/api/user/invoice-branding', true).then((res: any) => {
      const data = res?.data || res;
      if (data?.logoUrl) setLogoUrl(data.logoUrl);
      if (data?.stampUrl) setStampUrl(data.stampUrl);
      if (data?.signatureUrl) setSignatureUrl(data.signatureUrl);
    }).catch(() => {
      // non-blocking
    });
  }, []);

  // Fetch full invoice details
  useEffect(() => {
    if (!isOpen) return;

    // Seed preview with initial data if provided
    if (initialInvoiceData) {
      setInvoice(initialInvoiceData);
    }

    const effectiveId = invoiceId || initialInvoiceData?.id;
    if (!effectiveId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchInvoice = async () => {
      // Only show spinner if we don't have initial items
      if (!initialInvoiceData?.items?.length) {
        setLoading(true);
      }
      try {
        const data = await getApi<any>(`/api/invoices/${effectiveId}`, true);
        if (isMounted && data) {
          // Merge full fetched relations into invoice state
          setInvoice(prev => ({
            ...(prev || {}),
            ...data,
            // Ensure purchaseOrder, seller, buyer are preserved/augmented
            purchaseOrder: data.purchaseOrder || prev?.purchaseOrder,
            seller: data.seller || prev?.seller,
            buyer: data.buyer || prev?.buyer
          }));
        }
      } catch (err: any) {
        if (isMounted && !initialInvoiceData) {
          toast.error(err?.message || 'Failed to load invoice details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInvoice();

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId, initialInvoiceData]);

  // Synchronize and detect connected delivery and GRN records
  useEffect(() => {
    if (!invoice) return;
    const directDelId =
      invoice.deliveryId ||
      (invoice as any).delivery?.id ||
      invoice.purchaseOrder?.deliveryId ||
      invoice.purchaseOrder?.deliveries?.[0]?.id ||
      invoice.purchaseOrder?.deliveryTrackings?.[0]?.id ||
      null;

    const directGrnId =
      invoice.grnId ||
      (invoice as any).goodsReceiptNoteId ||
      invoice.purchaseOrder?.grnId ||
      invoice.purchaseOrder?.grns?.[0]?.id ||
      (invoice as any)?.grn?.id ||
      null;

    if (directDelId) setConnectedDeliveryId(directDelId);
    if (directGrnId) setConnectedGrnId(directGrnId);

    const effPoId = invoice.purchaseOrderId || invoice.purchaseOrder?.id;
    if (effPoId) {
      if (!directDelId) {
        getApi<any>(`/api/delivery/by-purchase-order/${effPoId}`, true)
          .then((res: any) => {
            const d = res?.data || res;
            if (d?.id) setConnectedDeliveryId(d.id);
          })
          .catch(() => {});
      }
      if (!directGrnId) {
        getApi<any>(`/api/grn/po/${effPoId}/eligibility`, true)
          .then((res: any) => {
            const list = res?.existing || res?.data?.existing || [];
            if (list?.[0]?.id) setConnectedGrnId(list[0].id);
          })
          .catch(() => {});
      }
    }
  }, [invoice?.deliveryId, invoice?.grnId, invoice?.purchaseOrderId, invoice?.purchaseOrder]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Construct structured invoice data for TaxInvoiceCard and PDF generator
  const invoiceData: TaxInvoiceData = useMemo(() => {
    if (!invoice) {
      return {
        copyType,
        invoiceNumber: `INV-${invoiceId || 'PENDING'}`,
        dateStr: formatDate(new Date()),
        seller: { name: 'Seller', address: '' },
        billTo: { name: 'Buyer', address: '' },
        shipTo: { name: 'Buyer', address: '' },
        items: [],
        subtotal: 0,
        totalAmount: 0,
        bankDetails: { bankName: '', accountNo: '', ifscCode: '', accountName: '' }
      };
    }

    const totalVal = Number(invoice.totalAmount || invoice.amount || 0);
    const taxableVal = Number(invoice.taxableAmount || (totalVal > 0 ? Number((totalVal / 1.18).toFixed(2)) : 0));
    const totalTaxVal = Number(invoice.totalTaxAmount || (totalVal > taxableVal ? Number((totalVal - taxableVal).toFixed(2)) : 0));

    const details = invoice.items || invoice.purchaseOrder?.items || [];
    const items: TaxInvoiceItem[] = details.length > 0
      ? details.map((it: any, idx: number) => {
          const qty = Number(it.quantity || 1);
          let taxableAmt = Number(it.taxableAmount || 0);
          let unitPrice = Number(it.unitPrice || 0);

          // Prevent 10x inflation if unitPrice was stored as full lot total
          if (qty > 1 && totalVal > 0 && (unitPrice * qty) > (totalVal * 1.5)) {
            unitPrice = Number((unitPrice / qty).toFixed(2));
            taxableAmt = Number((unitPrice * qty).toFixed(2));
          } else if (!taxableAmt && unitPrice > 0) {
            taxableAmt = Number((unitPrice * qty).toFixed(2));
          } else if (taxableAmt > 0 && (!unitPrice || unitPrice === taxableAmt)) {
            unitPrice = Number((taxableAmt / qty).toFixed(2));
          }

          return {
            srNo: idx + 1,
            description: it.itemName || it.description || invoice.purchaseOrder?.title || 'Goods / Services',
            hsn: it.hsnCode || it.hsn || it.product?.hsnCode || '-',
            qty,
            unit: it.unitOfMeasure || 'Unit',
            priceUnit: unitPrice || (taxableAmt / Math.max(qty, 1)),
            amount: taxableAmt || (unitPrice * qty)
          };
        })
      : [{
          srNo: 1,
          description: invoice.purchaseOrder?.title || 'Goods / Services',
          hsn: '-',
          qty: 1,
          priceUnit: taxableVal,
          amount: taxableVal
        }];

    let computedTaxable = 0;
    items.forEach(it => {
      computedTaxable += Number(it.amount) || 0;
    });
    const finalSubtotal = computedTaxable > 0 ? Number(computedTaxable.toFixed(2)) : taxableVal;

    const formatAddress = (...parts: (string | null | undefined)[]) => {
      const valid = parts.filter(
        p => p && typeof p === 'string' && p.trim().length > 0 && p.trim() !== 'null' && p.trim() !== 'undefined'
      );
      return valid.length > 0 ? valid.map(p => p!.trim()).join(', ') : '';
    };

    const sellerUser = invoice.seller || invoice.purchaseOrder?.seller;
    const sellerOrg = sellerUser?.organization;
    const sellerProfile = sellerUser?.sellerProfile;
    const sellerReg = (sellerUser?.registrationDetails as any) || {};

    const sellerName = sellerOrg?.organizationName || sellerProfile?.businessName || sellerReg?.businessName || sellerReg?.companyName || sellerProfile?.nameAsInPan || sellerUser?.name || 'N/A';
    const sellerAddress = sellerProfile?.offices?.[0]?.address || sellerProfile?.registeredAddress || sellerReg?.registeredOfficeAddress || sellerReg?.address || formatAddress(sellerOrg?.addressLine1, sellerOrg?.addressLine2, sellerOrg?.city, sellerOrg?.district, sellerOrg?.state, sellerOrg?.pincode) || formatAddress(sellerReg?.addressLine1, sellerReg?.addressLine2, sellerReg?.city, sellerReg?.state, sellerReg?.pincode) || 'N/A';
    const sellerGstin = sellerOrg?.gstin || sellerProfile?.offices?.[0]?.gstNumber || sellerProfile?.gstNumber || sellerProfile?.gstMasked || sellerReg?.gstin || sellerReg?.gstDetails?.gstin || sellerReg?.gst || '';
    const sellerPhone = sellerUser?.mobile || sellerProfile?.mobile || sellerReg?.mobile || sellerReg?.phone || '';
    const sellerEmail = sellerUser?.email || sellerProfile?.officialEmail || sellerProfile?.email || sellerReg?.email || '';
    const sellerCin = sellerOrg?.cinNumber || sellerProfile?.cinNumber || sellerProfile?.cin || sellerReg?.cin || '';

    const sellerLogo = sellerReg?.logoUrl || sellerOrg?.profile?.logoUrl || (sellerOrg?.organizationLogoFileId ? `/api/files/${sellerOrg.organizationLogoFileId}/view` : null) || logoUrl || null;
    const sellerStamp = sellerReg?.stampUrl || stampUrl || null;
    const sellerSignature = sellerReg?.signatureUrl || signatureUrl || null;

    const buyerUser = invoice.buyer || invoice.purchaseOrder?.buyer;
    const buyerOrg = buyerUser?.organization;
    const buyerProfile = buyerUser?.buyerProfile;
    const buyerReg = (buyerUser?.registrationDetails as any) || {};

    const poDeliv = invoice.purchaseOrder?.deliveryAddress;
    const billToName = buyerOrg?.organizationName || buyerProfile?.businessName || buyerProfile?.organizationName || buyerReg?.businessName || buyerReg?.companyName || buyerUser?.name || 'N/A';
    const billToAddress = poDeliv
      ? (typeof poDeliv === 'string' ? poDeliv : formatAddress(poDeliv.addressLine1, poDeliv.addressLine2, poDeliv.city, poDeliv.state, poDeliv.pincode, poDeliv.country || 'INDIA'))
      : (buyerProfile?.registeredAddress || buyerOrg?.address || buyerReg?.officeZoneName || buyerReg?.address || formatAddress(buyerOrg?.addressLine1, buyerOrg?.addressLine2, buyerOrg?.city, buyerOrg?.district, buyerOrg?.state, buyerOrg?.pincode) || 'N/A');
    const billToPan = buyerOrg?.panNumber || buyerProfile?.pan || buyerProfile?.panNumber || buyerProfile?.panMasked || buyerReg?.pan || buyerReg?.orgPan || '';
    const billToGstin = buyerOrg?.gstin || buyerProfile?.gst || buyerProfile?.gstNumber || buyerProfile?.gstMasked || buyerReg?.gstin || buyerReg?.gst || '';

    const shipToName = (typeof poDeliv === 'object' && poDeliv?.recipientName) || buyerOrg?.organizationName || billToName;
    const shipToAddress = billToAddress;

    const bankName = sellerReg?.bankDetails?.bankName || sellerReg?.bankName || sellerProfile?.bankAccounts?.[0]?.bankName || sellerProfile?.bankName || 'State Bank of India';
    const accountNo = sellerReg?.bankDetails?.accountNumber || sellerReg?.accountNumber || sellerProfile?.bankAccounts?.[0]?.accountNumberMasked || sellerProfile?.bankAccounts?.[0]?.accountNumber || sellerProfile?.bankAccountNo || 'N/A';
    const ifscCode = sellerReg?.bankDetails?.ifscCode || sellerReg?.ifscCode || sellerProfile?.bankAccounts?.[0]?.ifsc || sellerProfile?.bankAccounts?.[0]?.ifscCode || sellerProfile?.bankIfsc || 'N/A';
    const accountName = sellerReg?.bankDetails?.accountHolderName || sellerReg?.accountHolderName || sellerProfile?.bankAccounts?.[0]?.holderName || sellerProfile?.accountHolderName || sellerProfile?.businessName || sellerName;

    // Detect interstate based on GSTIN codes or different states
    const sellerGstinCode = (sellerGstin || '').trim().substring(0, 2);
    const buyerGstinCode = (billToGstin || '').trim().substring(0, 2);
    const hasDifferentGstCodes = /^\d{2}$/.test(sellerGstinCode) && /^\d{2}$/.test(buyerGstinCode) && sellerGstinCode !== buyerGstinCode;
    const hasDifferentStates = Boolean(
      (sellerProfile?.state || sellerReg?.state) &&
      (buyerProfile?.state || buyerReg?.state) &&
      String(sellerProfile?.state || sellerReg?.state).trim().toLowerCase() !== String(buyerProfile?.state || buyerReg?.state).trim().toLowerCase()
    );
    const isInterstate = Boolean(invoice.interstate || Number(invoice.igstAmount) > 0 || hasDifferentGstCodes || hasDifferentStates);

    const buyerStateName = buyerProfile?.state || buyerReg?.state || (buyerGstinCode === '21' ? 'Odisha' : 'Other State');
    const placeOfSupply = isInterstate
      ? `${buyerStateName}${buyerGstinCode ? ` (${buyerGstinCode})` : ''} - Inter-State (IGST)`
      : `${sellerProfile?.state || sellerReg?.state || 'Maharashtra'} - State (CGST + SGST)`;

    const cgstAmount = isInterstate ? undefined : (Number(invoice.cgstAmount) || Math.round(finalSubtotal * 0.09 * 100) / 100);
    const sgstAmount = isInterstate ? undefined : (Number(invoice.sgstAmount) || Math.round(finalSubtotal * 0.09 * 100) / 100);
    const igstAmount = isInterstate ? (Number(invoice.igstAmount) || totalTaxVal || Math.round(finalSubtotal * 0.18 * 100) / 100) : undefined;
    const computedTotal = isInterstate ? Math.round((finalSubtotal + (igstAmount || 0)) * 100) / 100 : Math.round((finalSubtotal + (cgstAmount || 0) + (sgstAmount || 0)) * 100) / 100;
    const totalAmount = totalVal > 0 && Math.abs(totalVal - computedTotal) < (computedTotal * 0.1) ? totalVal : computedTotal;

    return {
      copyType,
      invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id}`,
      dateStr: formatDate(invoice.createdAt) || formatDate(new Date()),
      placeOfSupply,
      seller: {
        name: sellerName,
        address: sellerAddress,
        gstin: sellerGstin,
        phone: sellerPhone,
        email: sellerEmail,
        cin: sellerCin,
        logoUrl: sellerLogo,
        stampUrl: sellerStamp,
        signatureUrl: sellerSignature
      },
      billTo: {
        name: billToName,
        address: billToAddress,
        pan: billToPan,
        gstin: billToGstin
      },
      shipTo: {
        name: shipToName,
        address: shipToAddress
      },
      items,
      subtotal: finalSubtotal,
      cgstRate: 9,
      cgstAmount,
      sgstRate: 9,
      sgstAmount,
      igstRate: 18,
      igstAmount,
      otherTaxAmount: Number(invoice.otherTaxAmount || 0),
      totalAmount,
      bankDetails: {
        bankName,
        accountNo,
        ifscCode,
        accountName
      }
    };
  }, [invoice, invoiceId, copyType, logoUrl, stampUrl, signatureUrl]);

  const handleDownloadPdf = async (targetCopy?: string) => {
    const copy = targetCopy || copyType;
    setIsDownloadingPdf(true);
    try {
      const dataToDownload = { ...invoiceData, copyType: copy };
      const doc = await generateTaxInvoicePdf(dataToDownload);
      const cleanInv = (invoiceData.invoiceNumber || 'Tax_Invoice').replace(/[^a-zA-Z0-9-]/g, '_');
      const cleanCopy = copy.replace(/[^a-zA-Z0-9-]/g, '_');
      doc.save(`${cleanInv}_${cleanCopy}.pdf`);
      toast.success(`Downloaded: ${copy}`);
    } catch (err: any) {
      console.error('[PDF Download Error]', err);
      toast.error(err?.message || 'Failed to generate invoice PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!isOpen) return null;

  const rawStatus = String(invoice?.invoiceStatus || invoice?.status || '').toLowerCase();
  const isPaid = rawStatus === 'paid';
  const isSubmitted = rawStatus === 'submitted' || rawStatus === 'draft';
  const isApproved = ['approved', 'payment_initiated', 'paid'].includes(rawStatus);
  const isBuyer = user?.role === 'buyer' || user?.role === 'admin';
  const bidId = invoice?.bidId || invoice?.purchaseOrder?.bidId || invoice?.purchaseOrder?.sourceId;
  const poNumber = invoice?.purchaseOrder?.poNumber || invoice?.poNumber;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Tax Invoice Registry"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          "relative flex flex-col bg-white shadow-2xl transition-all duration-300 overflow-hidden",
          isFullscreen
            ? "fixed inset-0 z-[121] h-screen w-screen max-w-none max-h-none rounded-none p-4 sm:p-6"
            : "w-full max-w-5xl max-h-[92vh] rounded-3xl border border-slate-200 p-5 sm:p-6 my-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 mb-3 shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">
              TAX INVOICE REGISTRY
            </p>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-slate-950 tracking-tight">
                {invoice?.invoiceNumber || (invoiceId ? `INV-${invoiceId}` : 'Tax Invoice')}
              </h2>
              {loading && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  <RefreshCw className="h-3 w-3 animate-spin text-[#12335f]" />
                  Syncing ledger...
                </span>
              )}
              {isApproved && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {isPaid ? 'PAID & SETTLED' : 'APPROVED'}
                </span>
              )}
              {isSubmitted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  <Clock className="h-3 w-3 text-amber-600" />
                  SUBMITTED (PENDING APPROVAL)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Created on {invoice?.createdAt ? formatDate(invoice.createdAt) : formatDate(new Date())}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshInvoice}
              disabled={isRefreshing || loading}
              title="Refresh invoice details"
              aria-label="Refresh invoice details"
              className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
            >
              <RefreshCw className={cn("h-4 w-4", (isRefreshing || loading) && "animate-spin text-[#12335f]")} />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              title={isFullscreen ? "Restore window size" : "Full screen view"}
              aria-label={isFullscreen ? "Restore window size" : "Full screen view"}
              className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close invoice view"
              aria-label="Close invoice view"
              className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {loading && !invoice ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin text-[#12335f]" />
              <p className="text-xs font-bold text-slate-500">Retrieving digital bill ledger from MSME vaults...</p>
            </div>
          ) : (
            <>
              {/* Payment Locked Alert Banner for Buyer */}
              {isSubmitted && isBuyer && (
                <div
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/95 p-3.5 sm:p-4 text-amber-900 shadow-xs"
                  role="alert"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-300">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-tight">
                          Payment Locked &bull; Invoice Pending Buyer Approval
                        </h4>
                        <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900">
                          Action Required
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-amber-800 leading-relaxed">
                        Payment disbursement and settlement release are locked while this invoice is in <strong className="font-black text-amber-950">SUBMITTED</strong> status. Review the items and click <strong className="font-black text-emerald-800">&ldquo;Approve Invoice&rdquo;</strong> to authorize settlement and unlock payment.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isApproving}
                    onClick={handleApproveInvoice}
                    className="shrink-0 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider shadow-sm gap-1.5 cursor-pointer transition-all self-end sm:self-center"
                  >
                    {isApproving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>Approve Invoice</span>
                  </Button>
                </div>
              )}

              {/* Informative notice for Seller when invoice is submitted */}
              {isSubmitted && !isBuyer && (
                <div
                  className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-800"
                  role="status"
                >
                  <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Invoice Submitted:</strong> Awaiting buyer review and approval. Payment options will be unlocked once approved by the buyer.
                  </span>
                </div>
              )}

              {/* Connected Lifecycle Bar */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gradient-to-r from-slate-100 via-indigo-50/50 to-slate-100 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2 py-0.5">
                  CONNECTED LIFECYCLE:
                </span>

                {bidId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      router.push(`/bids/${bidId}`);
                    }}
                    className="h-7 border-slate-250 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                  >
                    <FileText className="h-3 w-3 text-slate-500" />
                    <span>View Quotation</span>
                  </Button>
                )}

                {poNumber && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const poId = invoice?.purchaseOrderId || invoice?.purchaseOrder?.id;
                      const orderTarget = poId || poNumber;
                      const rolePath = user?.role === 'buyer' ? '/buyer/orders' : '/seller/orders';
                      router.push(`${rolePath}?orderId=${encodeURIComponent(orderTarget)}`);
                    }}
                    className="h-7 border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                  >
                    <FileText className="h-3 w-3 text-indigo-600" />
                    <span>View PO</span>
                  </Button>
                )}

                {/* View Delivery: ONLY if delivery is generated */}
                {connectedDeliveryId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      router.push(`/delivery/${connectedDeliveryId}`);
                    }}
                    className="h-7 border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                  >
                    <Truck className="h-3 w-3 text-blue-600" />
                    <span>View Delivery</span>
                  </Button>
                )}

                {/* View GRN: ONLY if GRN is generated */}
                {connectedGrnId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      router.push(`/grn/${connectedGrnId}`);
                    }}
                    className="h-7 border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>View GRN</span>
                  </Button>
                )}

                {(() => {
                  const payPath = isBuyer ? '/buyer/payments' : '/seller/payments';
                  const searchParam = encodeURIComponent(invoice?.invoiceNumber || '');
                  if (isPaid) {
                    return (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          router.push(`${payPath}?search=${searchParam}`);
                        }}
                        className="h-7 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        <span>View Payment Proof (Paid)</span>
                      </Button>
                    );
                  }
                  if (isBuyer) {
                    if (isSubmitted) {
                      return (
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isApproving}
                            onClick={handleApproveInvoice}
                            className="h-7 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                            title="Approve this tax invoice to unlock payment disbursement"
                          >
                            {isApproving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            <span>Approve Invoice</span>
                          </Button>
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded-lg"
                            title="Payment is locked until the tax invoice is approved"
                          >
                            <Lock className="h-3 w-3 text-amber-700" />
                            <span>Payment Locked</span>
                          </span>
                        </div>
                      );
                    }
                    if (isApproved) {
                      const { canPay: canDisbursePayment, reason: paymentGateReason } = canDisburseInvoicePayment({
                        invoice,
                        order: invoice?.purchaseOrder,
                        delivery: invoice?.delivery,
                        grn: invoice?.grn || (connectedGrnId ? { id: connectedGrnId, status: 'APPROVED' } : null),
                        isApproved: true
                      });

                      return (
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Approved</span>
                          </span>
                          {canDisbursePayment ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                router.push(`${payPath}?search=${searchParam}`);
                              }}
                              className="h-7 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                            >
                              <CreditCard className="h-3 w-3" />
                              <span>Pay Now / Upload Payment Proof</span>
                            </Button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg cursor-not-allowed"
                              title={paymentGateReason}
                            >
                              <Lock className="h-3 w-3 text-slate-400" />
                              <span>Payment Locked (Awaiting Delivery)</span>
                            </span>
                          )}
                        </div>
                      );
                    }
                  }
                  if (isSubmitted) {
                    return (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                        <Clock className="h-3 w-3 text-amber-600" />
                        <span>Awaiting Buyer Approval</span>
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      <Clock className="h-3 w-3 text-amber-600" />
                      <span>Payment Pending from Buyer</span>
                    </span>
                  );
                })()}
              </div>

              {/* Toolbar: Copy Type, Stamp & Signature, Download PDF */}
              <div className="flex items-center justify-between gap-2.5 bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-2xl flex-nowrap overflow-x-auto scrollbar-none">
                {/* Left: Copy Type Dropdown */}
                <div className="flex items-center gap-2 shrink-0">
                  <label htmlFor="modal-copy-type-select" className="text-xs font-black text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    COPY TYPE:
                  </label>
                  <select
                    id="modal-copy-type-select"
                    value={copyType}
                    onChange={(e) => setCopyType(e.target.value)}
                    className="h-9 px-2.5 sm:px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-[#12335f] focus:outline-none min-w-[170px] max-w-[220px] cursor-pointer"
                  >
                    <option value="Original Copy">Original Copy (Buyer)</option>
                    <option value="Duplicate Copy">Duplicate Copy (Transporter)</option>
                    <option value="Triplicate Copy">Triplicate Copy (Supplier)</option>
                    <option value="Quadruplicate Copy">Quadruplicate Copy (Extra)</option>
                  </select>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-nowrap shrink-0 ml-auto">
                  {isBuyer && isSubmitted && (
                    <Button
                      type="button"
                      disabled={isApproving}
                      onClick={handleApproveInvoice}
                      className="h-9 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs shrink-0 whitespace-nowrap cursor-pointer"
                      title="Approve this tax invoice"
                    >
                      {isApproving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>Approve Invoice</span>
                    </Button>
                  )}
                  {/* Stamp & Signature Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleOpenBranding}
                    aria-label="Manage official seal, logo and signature"
                    title="Manage official seal, logo and signature"
                    className="h-9 px-3 rounded-xl border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <Stamp className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                    <span className="hidden sm:inline">STAMP & SIGNATURE</span>
                    <span className="sm:hidden">STAMP</span>
                  </Button>

                  {/* Download PDF Button with Split Dropdown */}
                  <div className="relative inline-flex rounded-xl shadow-xs shrink-0">
                    <Button
                      type="button"
                      disabled={isDownloadingPdf}
                      onClick={() => void handleDownloadPdf()}
                      className="h-9 rounded-l-xl rounded-r-none bg-[#12335f] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 px-3 whitespace-nowrap cursor-pointer"
                    >
                      {isDownloadingPdf ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      DOWNLOAD PDF ({copyType.replace(' Copy', '').toUpperCase()})
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setDownloadDropdownOpen(prev => !prev)}
                      className="h-9 rounded-r-xl rounded-l-none bg-[#0e2a4f] hover:bg-slate-900 text-white px-2 border-l border-slate-700 cursor-pointer"
                      title="Download other copies"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>

                    {downloadDropdownOpen && (
                      <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in-50">
                        <p className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                          Download Invoice Copies
                        </p>
                        {[
                          { id: 'Original Copy', label: 'Original Copy (Buyer)' },
                          { id: 'Duplicate Copy', label: 'Duplicate Copy (Transporter)' },
                          { id: 'Triplicate Copy', label: 'Triplicate Copy (Supplier)' },
                          { id: 'Quadruplicate Copy', label: 'Quadruplicate Copy (Extra)' }
                        ].map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCopyType(c.id);
                              setDownloadDropdownOpen(false);
                              void handleDownloadPdf(c.id);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-950 rounded-lg flex items-center justify-between cursor-pointer"
                          >
                            <span>{c.label}</span>
                            <Download className="h-3 w-3 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tax Invoice Document View */}
              <div className="overflow-x-auto py-2">
                <TaxInvoiceCard
                  copyType={copyType}
                  invoiceNumber={invoiceData.invoiceNumber}
                  dateStr={invoiceData.dateStr}
                  placeOfSupply={invoiceData.placeOfSupply}
                  seller={invoiceData.seller}
                  billTo={invoiceData.billTo}
                  shipTo={invoiceData.shipTo}
                  items={invoiceData.items}
                  subtotal={invoiceData.subtotal}
                  cgstRate={invoiceData.cgstRate}
                  cgstAmount={invoiceData.cgstAmount}
                  sgstRate={invoiceData.sgstRate}
                  sgstAmount={invoiceData.sgstAmount}
                  igstRate={invoiceData.igstRate}
                  igstAmount={invoiceData.igstAmount}
                  otherTaxAmount={invoiceData.otherTaxAmount}
                  totalAmount={invoiceData.totalAmount}
                  bankDetails={invoiceData.bankDetails}
                  logoUrl={invoiceData.seller.logoUrl}
                  stampUrl={invoiceData.seller.stampUrl}
                  signatureUrl={invoiceData.seller.signatureUrl}
                  onOpenUploadBranding={handleOpenBranding}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* In-Place Stamp, Signature & Logo Upload Modal */}
      <SignatureStampUploadModal
        isOpen={isBrandingModalOpen}
        onClose={() => setIsBrandingModalOpen(false)}
        initialLogo={invoiceData.seller.logoUrl || logoUrl}
        initialStamp={invoiceData.seller.stampUrl || stampUrl}
        initialSignature={invoiceData.seller.signatureUrl || signatureUrl}
        onSaved={(branding) => {
          if (branding.logoUrl !== undefined) setLogoUrl(branding.logoUrl);
          if (branding.stampUrl !== undefined) setStampUrl(branding.stampUrl);
          if (branding.signatureUrl !== undefined) setSignatureUrl(branding.signatureUrl);
          if (invoice) {
            setInvoice((prev: any) => {
              if (!prev) return prev;
              const prevSeller = prev.seller || {};
              const prevReg = (prevSeller.registrationDetails as any) || {};
              return {
                ...prev,
                seller: {
                  ...prevSeller,
                  registrationDetails: {
                    ...prevReg,
                    ...(branding.logoUrl !== undefined && { logoUrl: branding.logoUrl }),
                    ...(branding.stampUrl !== undefined && { stampUrl: branding.stampUrl }),
                    ...(branding.signatureUrl !== undefined && { signatureUrl: branding.signatureUrl }),
                  }
                }
              };
            });
          }
        }}
      />
    </div>
  );
}