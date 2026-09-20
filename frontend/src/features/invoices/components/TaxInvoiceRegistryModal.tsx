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
import { generateTaxInvoicePdf, TaxInvoiceData, TaxInvoiceItem } from '../lib/invoicePdfGenerator';

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

  const handleStampSignatureRedirect = () => {
    if (user?.role === 'buyer') {
      router.push('/buyer/profile?section=showcase_profile&tab=branding');
    } else if (user?.role === 'shg') {
      router.push('/shg/settings?section=branding');
    } else {
      router.push('/seller/settings?section=branding');
    }
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
      if (res?.logoUrl) setLogoUrl(res.logoUrl);
      if (res?.stampUrl) setStampUrl(res.stampUrl);
      if (res?.signatureUrl) setSignatureUrl(res.signatureUrl);
    }).catch(() => {
      // non-blocking
    });
  }, []);

  // Fetch full invoice details
  useEffect(() => {
    if (!isOpen || !invoiceId) return;

    // If initial data is provided and has items/seller, we can use it
    if (initialInvoiceData && (initialInvoiceData.items || initialInvoiceData.seller)) {
      setInvoice(initialInvoiceData);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchInvoice = async () => {
      setLoading(true);
      try {
        const data = await getApi<any>(`/api/invoices/${invoiceId}`, true);
        if (isMounted && data) {
          setInvoice(data);
        }
      } catch (err: any) {
        if (isMounted) {
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
    const taxableVal = Number(invoice.taxableAmount || totalVal);
    const totalTaxVal = Number(invoice.totalTaxAmount || 0);

    const details = invoice.items || invoice.purchaseOrder?.items || [];
    const items: TaxInvoiceItem[] = details.length > 0
      ? details.map((it: any, idx: number) => ({
          srNo: idx + 1,
          description: it.itemName || it.description || 'MSME Goods / Services Delivery',
          hsn: it.hsnCode || '84719000',
          qty: Number(it.quantity || 1),
          unit: it.unitOfMeasure || 'Unit',
          priceUnit: Number(it.unitPrice || (it.taxableAmount || totalVal)),
          amount: Number(it.totalAmount || it.taxableAmount || (Number(it.unitPrice || 0) * Number(it.quantity || 1)))
        }))
      : [{
          srNo: 1,
          description: invoice.purchaseOrder?.title || 'Contract Deliverables',
          hsn: '84719000',
          qty: 1,
          priceUnit: taxableVal,
          amount: totalVal || taxableVal
        }];

    let computedTaxable = 0;
    items.forEach(it => {
      computedTaxable += Number(it.amount) || 0;
    });
    const finalSubtotal = computedTaxable > 0 ? computedTaxable : taxableVal;

    const formatAddress = (...parts: (string | null | undefined)[]) => {
      const valid = parts.filter(
        p => p && typeof p === 'string' && p.trim().length > 0 && p.trim() !== 'null' && p.trim() !== 'undefined'
      );
      return valid.length > 0 ? valid.map(p => p!.trim()).join(', ') : '';
    };

    const sellerOrg = invoice.seller?.organization;
    const sellerProfile = invoice.seller?.sellerProfile;
    const sellerReg = invoice.seller?.registrationDetails as any;

    const sellerName = sellerProfile?.businessName || sellerOrg?.organizationName || sellerProfile?.nameAsInPan || invoice.seller?.name || 'Seller Organization';
    const sellerAddress = sellerProfile?.offices?.[0]?.address || sellerProfile?.registeredAddress || sellerProfile?.corporateAddress || formatAddress(sellerOrg?.addressLine1, sellerOrg?.addressLine2, sellerOrg?.city, sellerOrg?.district, sellerOrg?.state, sellerOrg?.pincode) || sellerReg?.address || formatAddress(sellerReg?.addressLine1, sellerReg?.addressLine2, sellerReg?.city, sellerReg?.state, sellerReg?.pincode) || '';
    const sellerGstin = sellerProfile?.offices?.[0]?.gstNumber || sellerProfile?.gstNumber || sellerProfile?.gstMasked || sellerOrg?.gstin || sellerReg?.gstin || sellerReg?.gst || '';
    const sellerPhone = invoice.seller?.mobile || sellerProfile?.mobile || sellerReg?.mobile || sellerReg?.phone || '';
    const sellerEmail = invoice.seller?.email || sellerProfile?.officialEmail || sellerProfile?.email || sellerReg?.email || '';
    const sellerCin = sellerOrg?.cinNumber || sellerReg?.cinNumber || sellerReg?.cin || sellerProfile?.cinNumber || '';

    const buyerOrg = invoice.buyer?.organization;
    const buyerProfile = invoice.buyer?.buyerProfile;
    const buyerReg = invoice.buyer?.registrationDetails as any;

    const billToName = buyerProfile?.departmentName || buyerProfile?.businessName || buyerOrg?.organizationName || invoice.buyer?.name || 'Buyer Organization';
    const billToAddress = buyerProfile?.registeredAddress || buyerProfile?.corporateAddress || formatAddress(buyerOrg?.addressLine1, buyerOrg?.addressLine2, buyerOrg?.city, buyerOrg?.district, buyerOrg?.state, buyerOrg?.pincode) || buyerReg?.address || '';
    const billToPan = buyerOrg?.panNumber || buyerProfile?.panNumber || buyerProfile?.panMasked || buyerReg?.pan || buyerReg?.panNumber || '';
    const billToGstin = buyerOrg?.gstin || buyerProfile?.gstNumber || buyerProfile?.gstMasked || buyerReg?.gstin || buyerReg?.gst || '';

    const poDeliv = invoice.purchaseOrder?.deliveryAddress;
    const shipToName = poDeliv?.recipientName || buyerOrg?.organizationName || billToName;
    const shipToAddress = poDeliv
      ? formatAddress(poDeliv.addressLine1, poDeliv.addressLine2, poDeliv.city, poDeliv.state, poDeliv.pincode, poDeliv.country || 'INDIA')
      : billToAddress;

    const bankName = sellerProfile?.bankName || sellerProfile?.bankAccounts?.[0]?.bankName || sellerReg?.bankName || 'State Bank of India';
    const accountNo = sellerProfile?.bankAccountNo || sellerProfile?.bankAccounts?.[0]?.accountNumber || sellerReg?.bankAccountNo || '••••••••1234';
    const ifscCode = sellerProfile?.bankIfsc || sellerProfile?.bankAccounts?.[0]?.ifscCode || sellerReg?.bankIfsc || 'SBIN0001234';
    const accountName = sellerProfile?.accountHolderName || sellerProfile?.businessName || sellerName;

    return {
      copyType,
      invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id}`,
      dateStr: formatDate(invoice.createdAt) || formatDate(new Date()),
      placeOfSupply: invoice.interstate ? 'Other State (IGST)' : 'Maharashtra(27)',
      seller: {
        name: sellerName,
        address: sellerAddress,
        gstin: sellerGstin,
        phone: sellerPhone,
        email: sellerEmail,
        cin: sellerCin,
        logoUrl: sellerOrg?.profile?.logoUrl || sellerReg?.logoUrl || logoUrl || null,
        stampUrl: sellerReg?.stampUrl || stampUrl || null,
        signatureUrl: sellerReg?.signatureUrl || signatureUrl || null
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
      cgstAmount: !invoice.interstate ? (totalTaxVal ? totalTaxVal / 2 : finalSubtotal * 0.09) : undefined,
      sgstRate: 9,
      sgstAmount: !invoice.interstate ? (totalTaxVal ? totalTaxVal / 2 : finalSubtotal * 0.09) : undefined,
      igstRate: 18,
      igstAmount: invoice.interstate ? (totalTaxVal || finalSubtotal * 0.18) : undefined,
      otherTaxAmount: Number(invoice.otherTaxAmount || 0),
      totalAmount: totalVal || (finalSubtotal + (totalTaxVal || finalSubtotal * 0.18)),
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
                      router.push(`/seller/orders?search=${encodeURIComponent(poNumber)}`);
                    }}
                    className="h-7 border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                  >
                    <FileText className="h-3 w-3 text-indigo-600" />
                    <span>View PO</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const search = poNumber || invoice?.invoiceNumber || '';
                    const delRoute = user?.role === 'buyer' ? '/orders/tracking' : '/seller/delivery-management';
                    router.push(`${delRoute}?search=${encodeURIComponent(search)}`);
                  }}
                  className="h-7 border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                >
                  <Truck className="h-3 w-3 text-blue-600" />
                  <span>View Delivery</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const search = poNumber || invoice?.invoiceNumber || '';
                    router.push(`/grn?search=${encodeURIComponent(search)}`);
                  }}
                  className="h-7 border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>View GRN</span>
                </Button>

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
                    return (
                      <div className="inline-flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Approved</span>
                        </span>
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
                      </div>
                    );
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
                    onClick={handleStampSignatureRedirect}
                    aria-label="Manage official seal and signature in settings"
                    title="Manage official seal and signature in settings"
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
                  onOpenUploadBranding={handleStampSignatureRedirect}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}