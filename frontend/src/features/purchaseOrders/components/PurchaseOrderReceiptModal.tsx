'use client';

import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import {
  Download,
  X,
  ArrowLeft,
  Copy,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  Truck,
  FileText,
  Clock,
  CreditCard,
  User,
  Calendar,
  RefreshCw,
  MapPin,
  Sun,
  Moon,
  Upload,
  Receipt,
  Package,
  Building2,
  Hash,
  ZoomIn,
  ZoomOut,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';
import { api, readJsonResponse, resolveMediaUrl } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import type { DocumentConfig } from '../../../lib/pdfEngine';
import { FocusTrap } from '../../../components/ui/FocusTrap';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';

export interface PurchaseOrderItemDto {
  id?: number;
  itemName?: string;
  name?: string;
  title?: string;
  description?: string;
  quantity?: number | string;
  unitOfMeasure?: string;
  unit?: string;
  unitPrice?: number | string;
  totalAmount?: number | string;
  specifications?: any;
  brand?: string;
  product?: {
    name?: string;
    unitOfMeasure?: string;
    brand?: string;
    model?: string;
    description?: string;
  };
}

export interface PurchaseOrderDto {
  id: number;
  poNumber?: string;
  title?: string;
  amount?: number | string;
  totalValue?: number | string;
  status?: string;
  currency?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  acceptedAt?: string | Date;
  expectedDelivery?: string | Date;
  deliveryAddress?: string;
  deliveryType?: string;
  paymentTerms?: string;
  buyerId?: number;
  sellerId?: number;
  buyer?: any;
  seller?: any;
  items?: PurchaseOrderItemDto[];
  deliveryTrackings?: any[];
  invoices?: any[];
  metadata?: any;
  [key: string]: any;
}

export interface PurchaseOrderReceiptModalProps {
  order: PurchaseOrderDto | null;
  onClose: () => void;
  onPrint?: (order: PurchaseOrderDto) => void;
  onDownloadPdf?: (order: PurchaseOrderDto) => void;
  // Operational actions
  isBuyer?: boolean;
  isSeller?: boolean;
  onAccept?: (order: PurchaseOrderDto) => void;
  onReject?: (order: PurchaseOrderDto) => void;
  onCancel?: (order: PurchaseOrderDto) => void;
  onCreateInvoice?: (order: PurchaseOrderDto) => void;
  onManageDispatch?: (order: PurchaseOrderDto) => void;
  onRepeatOrder?: (order: PurchaseOrderDto) => void;
  onUploadPaymentSlip?: (order: PurchaseOrderDto) => void;
  onViewPaymentSlip?: (order: PurchaseOrderDto) => void;
  activeDelivery?: any;
}

const readableStatus = (value?: string) =>
  String(value || 'generated')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

const formatDate = (val?: string | Date | null) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(val);
  }
};

const formatIsoDate = (val?: string | Date | null) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return String(val);
  }
};

const formatCurrency = (val?: number | string | null) => {
  const num = Number(val || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (val?: number | string | null) => {
  const num = Number(val || 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};



// Neutral Minimal Theme (Clean, official monochrome enterprise receipt format)
export const NEUTRAL_MINIMAL_THEME = {
  headerBg: 'bg-slate-200',
  headerText: 'text-slate-950',
  labelBg: 'bg-slate-50',
  labelText: 'text-slate-800',
  accentLine: 'bg-slate-300',
  totalBg: 'bg-slate-200',
  totalText: 'text-slate-950',
  notesHeaderBg: 'bg-slate-200',
  notesHeaderText: 'text-slate-950',
  tableHeaderBorder: 'border-slate-300',
};

export function PurchaseOrderReceiptModal({
  order: initialOrder,
  onClose,
  onPrint,
  onDownloadPdf,
  isBuyer,
  isSeller,
  onAccept,
  onReject,
  onCancel,
  onCreateInvoice,
  onManageDispatch,
  onRepeatOrder,
  onUploadPaymentSlip,
  onViewPaymentSlip,
  activeDelivery,
}: PurchaseOrderReceiptModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<PurchaseOrderDto | null>(initialOrder);
  const [activeTab, setActiveTab] = useState<'receipt' | 'audit'>('receipt');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasBg, setCanvasBg] = useState<'light' | 'dark'>('light');

  const handleCreateInvoiceAction = () => {
    if (onCreateInvoice && order) {
      onCreateInvoice(order);
    } else if (order) {
      onClose();
      const amountVal = order.amount || (order as any).totalValue || 0;
      const targetRoute = isBuyer ? '/buyer/invoices' : '/seller/invoices';
      router.push(`${targetRoute}?convertPoId=${order.id}&amount=${amountVal}`);
    }
  };

  const handleManageDispatchAction = () => {
    if (onManageDispatch && order) {
      onManageDispatch(order);
    } else if (order) {
      onClose();
      const poNum = order.poNumber || order.id;
      const targetRoute = isBuyer ? '/orders/tracking' : '/seller/delivery-management';
      router.push(`${targetRoute}?search=${encodeURIComponent(poNum)}`);
    }
  };

  // Auto-fit page state to ensure the entire receipt is 100% visible on screen without scrolling
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | '100%' | 'custom'>('fit');
  const [scaleFactor, setScaleFactor] = useState<number>(1);
  const [sheetDims, setSheetDims] = useState<{ w: number; h: number }>({ w: 800, h: 650 });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const currentTheme = NEUTRAL_MINIMAL_THEME;

  // Auto-fit calculation to ensure the entire 1-page receipt is visible without scrolling
  useLayoutEffect(() => {
    if (activeTab !== 'receipt') return;

    const measureAndScale = () => {
      const canvas = canvasRef.current;
      const sheet = sheetRef.current;
      if (!canvas || !sheet) return;

      const unscaledH = sheet.offsetHeight || 650;
      const unscaledW = sheet.offsetWidth || 800;
      setSheetDims({ w: unscaledW, h: unscaledH });

      if (zoomMode === '100%') {
        setScaleFactor(1);
        return;
      }

      if (zoomMode === 'custom') {
        return;
      }

      // Available space inside canvas minus comfortable padding
      const availH = canvas.clientHeight - 32;
      const availW = canvas.clientWidth - 32;

      if (unscaledH > 0 && availH > 0 && unscaledW > 0 && availW > 0) {
        const fitScaleY = availH / unscaledH;
        const fitScaleX = availW / unscaledW;
        // Best scale to fit both height and width completely within screen
        const bestScale = Math.min(fitScaleY, fitScaleX);
        setScaleFactor(Math.max(0.35, Math.min(1.25, Number(bestScale.toFixed(2)))));
      }
    };

    measureAndScale();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvasRef.current) {
      observer = new ResizeObserver(() => {
        measureAndScale();
      });
      observer.observe(canvasRef.current);
    }

    const timer1 = setTimeout(measureAndScale, 50);
    const timer2 = setTimeout(measureAndScale, 150);

    return () => {
      observer?.disconnect();
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [activeTab, zoomMode, order, isFullscreen]);

  // Sync initial order
  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  // Fetch full details whenever the modal opens to guarantee all organization relations are populated
  useEffect(() => {
    if (!initialOrder?.id) return;
    let isMounted = true;

    const fetchFullDetails = async () => {
      try {
        const res = await api.get(`/api/purchase-orders/${initialOrder.id}`);
        const body = await readJsonResponse(res);
        const fullData = (body as any)?.data || body;
        if (fullData && fullData.id && isMounted) {
          setOrder(prev => ({ ...(prev || initialOrder), ...fullData }));
        }
      } catch (err) {
        console.warn('Failed to fetch full PO details for modal', err);
      }
    };

    fetchFullDetails();

    return () => {
      isMounted = false;
    };
  }, [initialOrder?.id]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!order) return null;

  // Authentic Seller & Buyer data extraction with strict N/A fallback (Zero dummy/mock data)
  const sellerReg = (order.seller?.registrationDetails as Record<string, any>) || {};
  const sellerOrg =
    order.seller?.organization?.organizationName ||
    sellerReg.tradeName ||
    sellerReg.legalName ||
    sellerReg.businessName ||
    sellerReg.gstDetails?.tradeName ||
    sellerReg.gstDetails?.legalName ||
    sellerReg.gstDetails?.organizationName ||
    order.seller?.sellerProfile?.businessName ||
    order.seller?.sellerProfile?.companyName ||
    sellerReg.companyName ||
    order.seller?.name ||
    'N/A';

  const sellerOrgAddress = order.seller?.organization?.address ||
    [order.seller?.organization?.addressLine1, order.seller?.organization?.addressLine2, order.seller?.organization?.city, order.seller?.organization?.state, order.seller?.organization?.pincode].filter(Boolean).join(', ');

  const sellerAddress =
    sellerOrgAddress ||
    order.seller?.sellerProfile?.registeredAddress ||
    order.seller?.sellerProfile?.address ||
    sellerReg.businessAddress ||
    sellerReg.registeredAddress ||
    sellerReg.address ||
    sellerReg.gstDetails?.businessAddress ||
    sellerReg.gstDetails?.registeredOfficeAddress ||
    sellerReg.gstDetails?.address ||
    'N/A';

  const sellerPhone =
    order.seller?.mobile ||
    order.seller?.sellerProfile?.mobile ||
    sellerReg.mobile ||
    sellerReg.phone ||
    'N/A';

  const sellerEmail = order.seller?.email || sellerReg.email || 'N/A';

  const sellerGstin =
    order.seller?.organization?.gstin ||
    order.seller?.sellerProfile?.gst ||
    sellerReg.gstin ||
    sellerReg.gstDetails?.gstin ||
    sellerReg.gstDetails?.gstNumber ||
    sellerReg.gstDetails?.responseGstin ||
    'N/A';

  const sellerPan =
    order.seller?.organization?.panNumber ||
    order.seller?.sellerProfile?.pan ||
    sellerReg.pan ||
    sellerReg.orgPan ||
    sellerReg.personalPan ||
    sellerReg.gstDetails?.pan ||
    'N/A';

  const buyerReg = (order.buyer?.registrationDetails as Record<string, any>) || {};
  const buyerOrg =
    order.buyer?.organization?.organizationName ||
    order.buyer?.buyerProfile?.organizationName ||
    order.buyer?.buyerProfile?.companyName ||
    buyerReg.companyName ||
    buyerReg.businessName ||
    buyerReg.legalName ||
    buyerReg.tradeName ||
    order.buyer?.name ||
    'N/A';

  const buyerOrgAddress = order.buyer?.organization?.address ||
    [order.buyer?.organization?.addressLine1, order.buyer?.organization?.addressLine2, order.buyer?.organization?.city, order.buyer?.organization?.state, order.buyer?.organization?.pincode].filter(Boolean).join(', ');

  const buyerAddress =
    buyerOrgAddress ||
    order.buyer?.buyerProfile?.registeredAddress ||
    order.buyer?.buyerProfile?.address ||
    buyerReg.registeredAddress ||
    buyerReg.address ||
    'N/A';

  const deliveryAddress =
    order.deliveryAddress ||
    buyerAddress;

  const buyerPhone =
    order.buyer?.mobile ||
    order.buyer?.buyerProfile?.mobile ||
    buyerReg.mobile ||
    buyerReg.phone ||
    'N/A';

  const buyerEmail = order.buyer?.email || buyerReg.email || 'N/A';

  const buyerGstin =
    order.buyer?.organization?.gstin ||
    order.buyer?.buyerProfile?.gst ||
    buyerReg.gstin ||
    buyerReg.gstDetails?.gstin ||
    buyerReg.gstDetails?.gstNumber ||
    'N/A';

  const buyerPan =
    order.buyer?.organization?.panNumber ||
    order.buyer?.buyerProfile?.pan ||
    buyerReg.pan ||
    buyerReg.gstDetails?.pan ||
    'N/A';

  // Resolving Logos, Stamps and Signatures (Primary: OrganizationProfile -> Backup: registrationDetails -> FileAsset FK)
  const sellerLogo =
    order.seller?.organization?.profile?.logoUrl ||
    sellerReg.logoUrl ||
    order.seller?.organization?.logoFile?.url ||
    order.seller?.organization?.logoFile?.fileUrl ||
    (order.seller?.organization?.organizationLogoFileId ? `/api/files/${order.seller.organization.organizationLogoFileId}/view` : null) ||
    (order.seller?.organization?.organizationLogoFileId ? `/api/files/${order.seller.organization.organizationLogoFileId}/download` : null) ||
    null;

  const buyerLogo =
    order.buyer?.organization?.profile?.logoUrl ||
    buyerReg.logoUrl ||
    order.buyer?.organization?.logoFile?.url ||
    order.buyer?.organization?.logoFile?.fileUrl ||
    (order.buyer?.organization?.organizationLogoFileId ? `/api/files/${order.buyer.organization.organizationLogoFileId}/view` : null) ||
    (order.buyer?.organization?.organizationLogoFileId ? `/api/files/${order.buyer.organization.organizationLogoFileId}/download` : null) ||
    null;

  const isViewingSeller = isSeller || user?.role === 'seller' || user?.role === 'shg' || (order && order.sellerId === user?.id);
  const isViewingBuyer = isBuyer || user?.role === 'buyer' || (order && order.buyerId === user?.id);

  const currentUserReg = (user?.registrationDetails as Record<string, any>) || {};
  const lsStamp = typeof window !== 'undefined' ? localStorage.getItem('msme_invoice_stamp') : null;
  const lsSig = typeof window !== 'undefined' ? localStorage.getItem('msme_invoice_signature') : null;
  const lsLogo = typeof window !== 'undefined' ? localStorage.getItem('msme_invoice_logo') : null;

  const sellerSignature = sellerReg.signatureUrl || null;
  const sellerStamp = sellerReg.stampUrl || null;

  const buyerSignature = buyerReg.signatureUrl || null;
  const buyerStamp = buyerReg.stampUrl || null;

  const effectiveSellerLogo = sellerLogo || (isViewingSeller ? (currentUserReg.logoUrl || lsLogo) : null);
  const effectiveBuyerLogo = buyerLogo || (isViewingBuyer ? (currentUserReg.logoUrl || lsLogo) : null);

  const effectiveSellerSignature = sellerSignature || (isViewingSeller ? (currentUserReg.signatureUrl || lsSig) : null);
  const effectiveSellerStamp = sellerStamp || (isViewingSeller ? (currentUserReg.stampUrl || lsStamp) : null);

  const effectiveBuyerSignature = buyerSignature || (isViewingBuyer ? (currentUserReg.signatureUrl || lsSig) : null);
  const effectiveBuyerStamp = buyerStamp || (isViewingBuyer ? (currentUserReg.stampUrl || lsStamp) : null);

  const topLogo = effectiveSellerLogo || effectiveBuyerLogo;
  const topOrgName = sellerOrg !== 'N/A' ? sellerOrg : (buyerOrg !== 'N/A' ? buyerOrg : 'Enterprise Procurement');

  // Resolve media URLs to ensure local dev proxy & CORS compatibility
  const resolvedTopLogo = resolveMediaUrl(topLogo);
  const resolvedSellerLogo = resolveMediaUrl(effectiveSellerLogo);
  const resolvedBuyerLogo = resolveMediaUrl(effectiveBuyerLogo);
  const resolvedSellerSignature = resolveMediaUrl(effectiveSellerSignature);
  const resolvedSellerStamp = resolveMediaUrl(effectiveSellerStamp);
  const resolvedBuyerSignature = resolveMediaUrl(effectiveBuyerSignature);
  const resolvedBuyerStamp = resolveMediaUrl(effectiveBuyerStamp);

  const shipVia =
    order.deliveryType ? readableStatus(order.deliveryType) : 'Standard Ground Logistics';

  const trackingNumber =
    activeDelivery?.trackingNumber ||
    (order.deliveryTrackings && order.deliveryTrackings[0]?.trackingNumber) ||
    'N/A';

  const poDate = formatIsoDate(order.createdAt);
  const dueDate = formatIsoDate(order.expectedDelivery || order.createdAt);

  // Line items normalization
  const rawItems = order.items && order.items.length > 0
    ? order.items
    : (order.metadata?.cartSnapshot?.items || [{
        itemName: order.title,
        quantity: 1,
        unitPrice: Number(order.amount || order.totalValue || 0),
        totalAmount: Number(order.amount || order.totalValue || 0),
      }]);

  const displayItems = rawItems.map((it: any, idx: number) => {
    const name = it.product?.name || it.itemName || it.name || it.title || `Item ${idx + 1}`;
    const qty = Number(it.quantity || 1);
    const unitPrice = Number(it.unitPrice || (qty > 0 ? Number(it.totalAmount || order.totalValue || 0) / qty : 0));
    const total = Number(it.totalAmount || qty * unitPrice);
    const specs = it.description || it.specifications?.description || (it.product?.brand ? `Brand: ${it.product.brand}` : '');
    const productCode = it.product?.code || (it.productId ? `PRD-${it.productId}` : `SKU-${idx + 101}`);
    const hsn = it.hsnCode || it.product?.hsnCode || 'N/A';
    const unit = it.unitOfMeasure || it.unit || it.product?.unitOfMeasure || 'nos';
    const taxRate = it.taxRate !== undefined && it.taxRate !== null ? `${it.taxRate}%` : '18%';

    return {
      name,
      specs,
      quantity: qty,
      unitPrice,
      total,
      productCode,
      hsn,
      unit,
      taxRate,
    };
  });

  const subtotal = displayItems.reduce((acc, it) => acc + it.total, 0) || Number(order.amount || order.totalValue || 0);
  const grandTotal = Number(order.amount || order.totalValue || subtotal);
  // Real calculation: standard GST breakdown
  const taxAmount = Math.max(0, Math.round((grandTotal * 0.18 / 1.18) * 100) / 100);

  // On screen, only add filler rows if items < 3 to ensure the entire page fits without scrolling
  const fillerRowCount = Math.max(0, 3 - displayItems.length);
  const fillerRows = Array.from({ length: fillerRowCount });

  const handleDirectDownloadPdf = async () => {
    if (isGeneratingPdf) return;

    if (onDownloadPdf) {
      onDownloadPdf(order);
      return;
    }

    try {
      setIsGeneratingPdf(true);
      toast.loading('Generating Purchase Order PDF...', { id: 'po-pdf-dl' });
      const { PdfEngine, moneyPdf } = await import('../../../lib/pdfEngine');

      const config: DocumentConfig = {
        documentTitle: 'PURCHASE ORDER',
        documentNumber: order.poNumber || `PO-${order.id}`,
        dateStr: poDate,
        status: readableStatus(order.status),
        issuerName: topOrgName,
        issuerSubtitle: 'Authorized Vendor & MSME Supplier',
        issuerLogo: topLogo,
        sellerSignatureUrl: effectiveSellerSignature,
        sellerStampUrl: effectiveSellerStamp,
        buyerSignatureUrl: effectiveBuyerSignature,
        buyerStampUrl: effectiveBuyerStamp,
        parties: [
          {
            title: 'Ship To / Buyer',
            name: buyerOrg,
            address: deliveryAddress,
            phone: buyerPhone,
            email: buyerEmail,
            gstin: buyerGstin,
            pan: buyerPan,
            logoUrl: effectiveBuyerLogo,
            details: [
              `Ship Via: ${shipVia}`,
              `Tracking: ${trackingNumber}`,
            ],
          },
          {
            title: 'Vendor / Seller',
            name: sellerOrg,
            address: sellerAddress,
            phone: sellerPhone,
            email: sellerEmail,
            gstin: sellerGstin,
            pan: sellerPan,
            logoUrl: effectiveSellerLogo,
            details: [
              `Vendor Code: ${order.sellerId ? `VNDR-${order.sellerId}` : 'N/A'}`,
            ],
          },
        ],
        infoGrid: {
          'PO Number': order.poNumber || `PO-${order.id}`,
          'Date': poDate,
          'Due Date': dueDate,
          'Ship Via': shipVia,
          'Tracking Number': trackingNumber,
          'Payment Terms': order.paymentTerms ? readableStatus(order.paymentTerms) : 'Escrow Held / Pay on Invoice',
        },
        tableHeaders: ['#', 'Product Code', 'Product Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'Total'],
        tableData: displayItems.map((item, idx) => [
          String(idx + 1),
          item.productCode,
          item.name + (item.specs ? `\n${item.specs}` : ''),
          item.hsn,
          String(item.quantity),
          item.unit,
          moneyPdf(item.unitPrice),
          moneyPdf(item.total),
        ]),
        financials: {
          subtotal: subtotal,
          shipping: 0,
          totalTax: taxAmount,
          grandTotal: grandTotal,
        },
        notes: [
          '1. Delivery must strictly adhere to agreed specifications and timeline.',
          '2. Invoice raised must contain this Purchase Order Number and Date.',
          `3. Payment Terms: ${order.paymentTerms ? readableStatus(order.paymentTerms) : 'Escrow Held / Pay on Invoice'}.`,
          ...(order.metadata?.notes ? [`4. ${order.metadata.notes}`] : []),
        ],
      };

      const engine = new PdfEngine('p');
      const doc = await engine.generate(config);
      const filename = `${order.poNumber || `PO-${order.id}`}.pdf`;
      doc.save(filename);
      toast.success('Purchase Order PDF downloaded', { id: 'po-pdf-dl' });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.error('Failed to download PDF. Please try again.', { id: 'po-pdf-dl' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const viewingStatusLower = String(order.status || '').toLowerCase();
  const isIssued = viewingStatusLower === 'issued' || viewingStatusLower === 'generated' || viewingStatusLower === 'order_placed' || viewingStatusLower === 'pending_approval';
  const isAccepted = viewingStatusLower === 'accepted' || viewingStatusLower === 'in_fulfillment';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden',
        !isFullscreen && 'p-3 sm:p-6 items-center justify-center'
      )}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Purchase Order Receipt"
    >
      {/* Print stylesheet for 1-page physical printing */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #po-receipt-print-sheet, #po-receipt-print-sheet * {
            visibility: visible !important;
          }
          .po-scale-wrapper {
            width: 100% !important;
            height: auto !important;
            transform: none !important;
            display: block !important;
            position: static !important;
          }
          #po-receipt-print-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 6mm !important;
            box-shadow: none !important;
            border: 2px solid black !important;
            background: white !important;
            transform: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
        `
      }} />

      {/* Main Container Card */}
      <FocusTrap onEscape={onClose} className={cn("w-full flex justify-center", isFullscreen ? "h-full" : "h-[92vh] max-h-[95vh] max-w-[880px]")}>
        <div
          className={cn(
            'flex flex-col bg-white overflow-hidden shadow-2xl transition-all duration-300 w-full',
            isFullscreen
              ? 'h-full w-full rounded-none'
              : 'h-full rounded-2xl border border-slate-200'
          )}
        >
        {/* Top Control Header Bar (Hidden in Print) */}
        <header className="no-print bg-[#0b1f3a] text-white px-2.5 sm:px-4 py-2 sm:py-2.5 shrink-0 flex items-center justify-between border-b border-white/10 shadow-md gap-1.5 sm:gap-2 overflow-hidden">
          {/* Left: Navigation, PO info */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 sm:h-8.5 px-2 sm:px-2.5 text-white/90 hover:text-white hover:bg-white/10 text-xs font-bold rounded-xl gap-1 transition-all shrink-0 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </Button>

            <div className="h-4 w-px bg-white/20 hidden sm:block shrink-0" />

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <span className="font-mono font-black text-xs sm:text-sm text-white tracking-tight whitespace-nowrap">
                {order.poNumber}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (order.poNumber) {
                    navigator.clipboard.writeText(order.poNumber);
                    toast.success('PO Number copied to clipboard');
                  }
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0 cursor-pointer"
                title="Copy PO Number"
                aria-label="Copy PO Number"
              >
                <Copy className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>

            <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {readableStatus(order.status)}
            </span>
          </div>

          {/* Center: View Mode Toggle */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/15 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('receipt')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap',
                  activeTab === 'receipt'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                )}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap',
                  activeTab === 'audit'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                )}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Audit & Tracking</span>
                <span className="sm:hidden">Audit</span>
              </button>
            </div>

            {/* Zoom / Page Fit Switcher when in Receipt tab */}
            {activeTab === 'receipt' && (
              <div className="hidden sm:flex items-center bg-white/10 p-0.5 rounded-xl border border-white/15 gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode('custom');
                    setScaleFactor(prev => Math.max(0.4, Number((prev - 0.1).toFixed(2))));
                  }}
                  className="h-6.5 w-6.5 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="h-3 w-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode('fit')}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap',
                    zoomMode === 'fit'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  )}
                  title="Fit whole page in window without scrolling"
                >
                  Fit Page ({Math.round(scaleFactor * 100)}%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode('100%');
                    setScaleFactor(1);
                  }}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap',
                    zoomMode === '100%' || (zoomMode === 'custom' && scaleFactor === 1)
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  )}
                  title="View at regular 100% actual size"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode('custom');
                    setScaleFactor(prev => Math.min(1.5, Number((prev + 0.1).toFixed(2))));
                  }}
                  className="h-6.5 w-6.5 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 sm:h-8.5 sm:w-8.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all shrink-0 cursor-pointer"
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 sm:h-8.5 sm:w-8.5 bg-white/10 text-white hover:bg-rose-600 hover:text-white rounded-xl transition-all shrink-0 ml-0.5 cursor-pointer"
              title="Close"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Modal Body Canvas */}
        <div
          ref={canvasRef}
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden transition-colors duration-200",
            activeTab === 'receipt'
              ? (canvasBg === 'light' ? "bg-slate-100/90" : "bg-slate-950")
              : "bg-slate-50/70"
          )}
        >
          {activeTab === 'receipt' ? (
            /* 1st Page Format: RECEIPT PURCHASE ORDER (Exact Match to Image 1) */
            <div className="min-h-full w-full p-3 sm:p-6 flex flex-col items-center justify-start sm:justify-center overflow-x-auto">
              <div
                className="po-scale-wrapper relative mx-auto my-auto shrink-0 transition-all duration-150"
                style={{
                  width: `${Math.round((sheetDims.w || 800) * scaleFactor)}px`,
                  height: `${Math.round((sheetDims.h || 650) * scaleFactor)}px`,
                  position: 'relative',
                }}
              >
                <div
                  ref={sheetRef}
                  id="po-receipt-print-sheet"
                  style={{
                    width: '800px',
                    maxWidth: '800px',
                    transform: scaleFactor !== 1 ? `scale(${scaleFactor})` : undefined,
                    transformOrigin: 'top left',
                    position: scaleFactor !== 1 ? 'absolute' : 'relative',
                    left: 0,
                    top: 0,
                  }}
                  className={cn(
                    "bg-white text-slate-900 rounded-sm border-2 border-black p-4 sm:p-5 flex flex-col justify-between shrink-0 transition-shadow",
                    canvasBg === 'light' ? "shadow-2xl shadow-slate-400/50" : "shadow-2xl shadow-black/80"
                  )}
                >
                <div>
                  {/* Header Branding & Title */}
                  <div className="flex items-center justify-between border-b pb-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      {resolvedTopLogo && (
                        <img src={resolvedTopLogo} alt="Organization Logo" className="h-10 w-10 object-contain rounded" />
                      )}
                      <div>
                        <h2 className="text-base font-black text-slate-950 uppercase tracking-tight font-sans">
                          {topOrgName}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-medium">Authorized Vendor & MSME Supplier</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-widest font-sans">
                        PURCHASE ORDER
                      </h1>
                      <p className="text-[10px] font-mono text-slate-600 font-bold">{order.poNumber || `PO-${order.id}`}</p>
                    </div>
                  </div>

                  {/* Table 1: Vendor & PO Info */}
                  <table className="w-full border-collapse border border-black text-xs mb-2">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className={cn("w-1/6 font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Vendor Name:</td>
                        <td className="w-2/6 font-semibold p-1.5 text-slate-900 border-r border-black">
                          <div className="flex items-center gap-2">
                            {resolvedSellerLogo && (
                              <img src={resolvedSellerLogo} alt="Seller Logo" className="h-6 w-6 object-contain rounded shrink-0 border border-slate-200 bg-white" />
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-950 truncate">{sellerOrg}</div>
                              {order.seller?.name && order.seller.name !== sellerOrg && (
                                <div className="text-[9px] text-slate-500 font-medium truncate">Contact: {order.seller.name}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={cn("w-1/6 font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>PO Date:</td>
                        <td className="w-2/6 font-semibold p-1.5 text-slate-900 font-mono">{poDate}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className={cn("font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Vendor Address:</td>
                        <td className="font-semibold p-1.5 text-slate-900 border-r border-black leading-tight">{sellerAddress}</td>
                        <td className={cn("font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Vendor Code:</td>
                        <td className="font-black p-1.5 text-slate-950 font-mono">{order.sellerId ? `VNDR-${order.sellerId}` : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className={cn("font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Vendor Tax Info:</td>
                        <td className="font-semibold p-1.5 text-slate-900 border-r border-black font-mono">GSTIN: {sellerGstin} | PAN: {sellerPan}</td>
                        <td className={cn("font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Vendor Contact:</td>
                        <td className="font-semibold p-1.5 text-slate-900 font-mono">{sellerPhone} | {sellerEmail}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Table 2: Ship To & Shipping Details */}
                  <table className="w-full border-collapse border border-black text-xs mb-2">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className={cn("w-1/6 font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Ship To:</td>
                        <td className="w-2/6 font-semibold p-1.5 text-slate-900 border-r border-black">
                          <div className="flex items-center gap-2">
                            {resolvedBuyerLogo && (
                              <img src={resolvedBuyerLogo} alt="Buyer Logo" className="h-6 w-6 object-contain rounded shrink-0 border border-slate-200 bg-white" />
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-950 truncate">{buyerOrg}</div>
                              {order.buyer?.name && order.buyer.name !== buyerOrg && (
                                <div className="text-[9px] text-slate-500 font-medium truncate">Attn: {order.buyer.name}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={cn("w-1/6 font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Ship Via:</td>
                        <td className="w-2/6 font-semibold p-1.5 text-slate-900">{shipVia}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className={cn("font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Delivery Address:</td>
                        <td className="font-semibold p-1.5 text-slate-900 border-r border-black leading-tight">{deliveryAddress}</td>
                        <td className={cn("font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Tracking Number:</td>
                        <td className="font-semibold p-1.5 text-slate-900 font-mono">{trackingNumber}</td>
                      </tr>
                      <tr>
                        <td className={cn("font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Buyer GSTIN:</td>
                        <td className="font-semibold p-1.5 text-slate-900 border-r border-black font-mono">{buyerGstin}</td>
                        <td className={cn("font-bold p-1.5 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Due Date:</td>
                        <td className="font-semibold p-1.5 text-slate-900 font-mono">{dueDate}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Table 3: Line Items (Full Enterprise 8-Column Format) */}
                  <table className="w-full border-collapse border border-black text-xs mb-2">
                    <thead>
                      <tr className={cn("border-b border-black font-bold transition-colors", currentTheme.headerBg, currentTheme.headerText)}>
                        <th className={cn("p-1.5 text-center border-r w-10", currentTheme.tableHeaderBorder)}>#</th>
                        <th className={cn("p-1.5 text-left border-r w-24", currentTheme.tableHeaderBorder)}>Code</th>
                        <th className={cn("p-1.5 text-left border-r", currentTheme.tableHeaderBorder)}>Product Description</th>
                        <th className={cn("p-1.5 text-center border-r w-20", currentTheme.tableHeaderBorder)}>HSN/SAC</th>
                        <th className={cn("p-1.5 text-center border-r w-14", currentTheme.tableHeaderBorder)}>Qty</th>
                        <th className={cn("p-1.5 text-center border-r w-14", currentTheme.tableHeaderBorder)}>Units</th>
                        <th className={cn("p-1.5 text-right border-r w-24", currentTheme.tableHeaderBorder)}>Rate [₹]</th>
                        <th className="p-1.5 text-right w-24">Total [₹]</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="p-1.5 text-center border-r border-slate-300 font-mono">{idx + 1}</td>
                          <td className="p-1.5 text-left border-r border-slate-300 font-mono text-[11px]">{item.productCode}</td>
                          <td className="p-1.5 border-r border-slate-300">
                            <span className="font-bold text-slate-950 block">{item.name}</span>
                            {item.specs && <span className="text-[10px] text-slate-500 block leading-tight">{item.specs}</span>}
                          </td>
                          <td className="p-1.5 text-center border-r border-slate-300 font-mono text-[11px]">{item.hsn}</td>
                          <td className="p-1.5 text-center border-r border-slate-300 font-mono font-semibold">{item.quantity}</td>
                          <td className="p-1.5 text-center border-r border-slate-300 font-mono text-[11px]">{item.unit}</td>
                          <td className="p-1.5 text-right border-r border-slate-300 font-mono">₹{formatNumber(item.unitPrice)}</td>
                          <td className="p-1.5 text-right font-mono font-bold text-slate-950">₹{formatNumber(item.total)}</td>
                        </tr>
                      ))}

                      {/* Placeholder rows matching standard balance */}
                      {fillerRows.map((_, idx) => (
                        <tr key={`fill-${idx}`} className="border-b border-slate-200/60 h-6">
                          <td className="p-1 border-r border-slate-300 text-center text-slate-300 font-mono">-</td>
                          <td className="p-1 border-r border-slate-300 text-slate-300 font-mono">-</td>
                          <td className="p-1 border-r border-slate-300">&nbsp;</td>
                          <td className="p-1 border-r border-slate-300 text-center text-slate-300 font-mono">-</td>
                          <td className="p-1 border-r border-slate-300 text-center text-slate-300 font-mono">-</td>
                          <td className="p-1 border-r border-slate-300 text-center text-slate-300 font-mono">-</td>
                          <td className="p-1 border-r border-slate-300 text-right text-slate-300 font-mono">-</td>
                          <td className="p-1 text-right text-slate-300 font-mono">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Section: ADDITIONAL NOTES & TOTAL AMOUNT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mt-1 pt-1">
                  {/* Left: ADDITIONAL NOTES */}
                  <div className="border border-black overflow-hidden flex flex-col">
                    <div className={cn("border-b border-black p-1.5 font-bold uppercase tracking-wide transition-colors", currentTheme.notesHeaderBg, currentTheme.notesHeaderText)}>
                      ADDITIONAL NOTES & TERMS
                    </div>
                    <div className="p-2 text-[11px] text-slate-800 space-y-1 font-medium leading-relaxed bg-white flex-1">
                      <p>1. Delivery must strictly adhere to agreed specifications and timeline.</p>
                      <p>2. Payment Terms: {order.paymentTerms ? readableStatus(order.paymentTerms) : 'Escrow Held / Pay on Invoice'}.</p>
                      <p>3. Vendor invoice must cross-reference this PO Number and Date.</p>
                      {order.metadata?.notes && <p>4. {order.metadata.notes}</p>}
                    </div>
                  </div>

                  {/* Right: FINANCIAL SUMMARY */}
                  <div className="border border-black overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-b border-slate-300">
                          <td className="p-1.5 font-bold text-slate-800 text-right w-1/2">Subtotal:</td>
                          <td className="p-1.5 font-mono font-semibold text-right w-1/2">₹{formatNumber(subtotal)}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <td className="p-1.5 font-bold text-slate-800 text-right">Shipping & Handling:</td>
                          <td className="p-1.5 font-mono font-semibold text-right">₹0.00</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                          <td className="p-1.5 font-bold text-slate-800 text-right">TAX / GST (18% Included):</td>
                          <td className="p-1.5 font-mono font-semibold text-right">₹{formatNumber(taxAmount)}</td>
                        </tr>
                        <tr className={cn("border-t-2 border-black font-black transition-colors", currentTheme.totalBg, currentTheme.totalText)}>
                          <td className="p-1.5 font-black text-right uppercase tracking-wide text-xs sm:text-sm">TOTAL AMOUNT:</td>
                          <td className="p-1.5 font-mono font-black text-right text-sm sm:text-base">₹{formatNumber(grandTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signatures & Stamp Row */}
                <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-slate-300">
                  <div className="text-left text-xs">
                    <span className="font-bold text-slate-800">For {buyerOrg !== 'N/A' ? buyerOrg : 'Buyer'}:</span>
                    <div className="h-12 flex items-center gap-2 mt-0.5 relative">
                      {resolvedBuyerStamp && (
                        <img src={resolvedBuyerStamp} alt="Buyer Stamp" className="h-10 w-10 object-contain mix-blend-multiply shrink-0" />
                      )}
                      {resolvedBuyerSignature && (
                        <img src={resolvedBuyerSignature} alt="Buyer Signature" className="h-9 w-auto object-contain mix-blend-multiply" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Authorized Signatory (Buyer)</span>
                  </div>

                  <div className="text-right text-xs">
                    <span className="font-bold text-slate-800">For {sellerOrg !== 'N/A' ? sellerOrg : 'Supplier'}:</span>
                    <div className="h-12 flex items-center justify-end gap-2 mt-0.5 relative">
                      {resolvedSellerStamp && (
                        <img src={resolvedSellerStamp} alt="Supplier Stamp" className="h-10 w-10 object-contain mix-blend-multiply shrink-0" />
                      )}
                      {resolvedSellerSignature && (
                        <img src={resolvedSellerSignature} alt="Supplier Signature" className="h-9 w-auto object-contain mix-blend-multiply" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Authorized Signatory (Supplier)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Audit & Workflow Tracking View */
          <div className="min-h-full w-full py-5 sm:py-7 px-3 sm:px-6 lg:px-8 flex justify-center">
            <div className={cn("w-full space-y-5 transition-all duration-200", isFullscreen ? "max-w-6xl 2xl:max-w-7xl" : "max-w-5xl")}>
              {/* Order Title & Overview Card */}
              <div className="rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Purchase Order
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                        {order.poNumber || `PO-${order.id}`}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-xl font-black text-slate-900 leading-snug break-words">
                      {order.title || 'Official Procurement Order'}
                    </h3>
                  </div>
                  <div className="text-left sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Total PO Amount
                    </span>
                    <span className="text-lg sm:text-2xl font-black text-[#12335f] font-mono">
                      {formatCurrency(grandTotal)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 block">
                      Base: ₹{formatNumber(subtotal)} | 18% GST: ₹{formatNumber(taxAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800 shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Status: {readableStatus(order.status)}
                  </span>

                  {order.paymentTerms && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-teal-800 shadow-2xs">
                      <CreditCard className="h-3.5 w-3.5 text-teal-600" />
                      Payment: {readableStatus(order.paymentTerms)}
                    </span>
                  )}

                  {order.deliveryType && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-purple-800 shadow-2xs">
                      <Truck className="h-3.5 w-3.5 text-purple-600" />
                      Delivery: {readableStatus(order.deliveryType)}
                    </span>
                  )}
                </div>

                {/* 4 Summary Stat Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">PO Date</span>
                    <p className="text-xs font-bold text-slate-800">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Expected Delivery</span>
                    <p className="text-xs font-bold text-slate-800">{formatDate(order.expectedDelivery)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Buyer Organization</span>
                    <p className="text-xs font-bold text-slate-800 truncate" title={order.buyer?.name || buyerOrg}>{order.buyer?.name || buyerOrg}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Supplier Organization</span>
                    <p className="text-xs font-bold text-slate-800 truncate" title={order.seller?.name || sellerOrg}>{order.seller?.name || sellerOrg}</p>
                  </div>
                </div>
              </div>

              {/* Purchased Products / Line Items Table Card */}
              <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#12335f]">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900">
                        Purchased Items & Line Specifications
                      </h4>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {displayItems.length} line item{displayItems.length === 1 ? '' : 's'} in order
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                    Total: <span className="font-mono text-slate-900 font-black">₹{formatNumber(grandTotal)}</span>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Item & Description</th>
                        <th className="py-3 px-4 text-center w-24">Qty</th>
                        <th className="py-3 px-4 text-right w-32">Unit Price</th>
                        <th className="py-3 px-4 text-right w-36">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            {item.specs && (
                              <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                                {item.specs}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            ₹{formatNumber(item.unitPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            ₹{formatNumber(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 text-xs font-bold text-slate-700">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-4 text-right text-slate-500 uppercase tracking-wider text-[10px] font-black">
                          Subtotal
                        </td>
                        <td colSpan={2} className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{formatNumber(subtotal)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="py-2.5 px-4 text-right text-slate-500 uppercase tracking-wider text-[10px] font-black">
                          Taxes / GST (18% Included)
                        </td>
                        <td colSpan={2} className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{formatNumber(taxAmount)}
                        </td>
                      </tr>
                      <tr className="border-t border-slate-200 bg-[#12335f]/5 text-slate-950 font-black">
                        <td colSpan={3} className="py-3 px-4 text-right text-[#12335f] uppercase tracking-wider text-xs font-black">
                          Grand Total Amount
                        </td>
                        <td colSpan={2} className="py-3 px-4 text-right font-mono text-sm sm:text-base font-black text-[#12335f]">
                          ₹{formatNumber(grandTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Fulfillment Parties & Settings Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Fulfillment Parties Card */}
                <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <User className="h-4 w-4 text-[#12335f]" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#12335f]">
                      Fulfillment Parties
                    </h4>
                  </div>

                  <div className="space-y-3.5">
                    {/* Buyer Info */}
                    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">
                        BY
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                          Buyer (Requester)
                        </span>
                        <p className="text-xs font-black text-slate-900">
                          {order.buyer?.name || buyerOrg}
                        </p>
                        {order.buyer?.email && (
                          <p className="text-[10px] font-semibold text-slate-500 font-mono">
                            {order.buyer.email}
                          </p>
                        )}
                        {order.deliveryAddress && (
                          <p className="text-[10px] text-slate-600 mt-1 break-words leading-relaxed">
                            {order.deliveryAddress}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Seller Info */}
                    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">
                        SL
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                           Seller (Provider)
                        </span>
                        <p className="text-xs font-black text-slate-900">
                          {order.seller?.name || sellerOrg}
                        </p>
                        {order.seller?.email && (
                          <p className="text-[10px] font-semibold text-slate-500 font-mono">
                            {order.seller.email}
                          </p>
                        )}
                        {sellerAddress && (
                          <p className="text-[10px] text-slate-600 mt-1 break-words leading-relaxed">
                            {sellerAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fulfillment Settings Card */}
                <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <Calendar className="h-4 w-4 text-[#12335f]" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#12335f]">
                      Fulfillment & Schedule
                    </h4>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50/50 p-3 border border-indigo-100">
                      <Clock className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 block">
                          Expected Delivery Date
                        </span>
                        <p className="text-xs font-black text-slate-900">{formatDate(order.expectedDelivery)}</p>
                      </div>
                    </div>

                    {order.deliveryAddress && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                        <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                            Delivery Address
                          </span>
                          <p className="text-xs font-semibold text-slate-800 leading-relaxed break-words whitespace-normal">
                            {order.deliveryAddress}
                          </p>
                        </div>
                      </div>
                    )}

                    {order.deliveryTrackings && order.deliveryTrackings.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                          Delivery Trackings
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {order.deliveryTrackings.map((dt: any) => (
                            <div key={dt.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1">
                              <span className="font-mono text-xs font-bold text-slate-800">{dt.trackingNumber || `DLV-${dt.id}`}</span>
                              <span className="text-[10px] font-bold text-slate-600 uppercase">({readableStatus(dt.status || 'pending')})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipment Tracking Highlight Card */}
              {activeDelivery && (
                <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 p-5 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#12335f] text-white shadow-sm">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#12335f] uppercase tracking-wider">
                          Shipment Tracking Active
                        </h4>
                        <p className="text-[10px] font-semibold text-slate-500">Live dispatch and tracking status</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#12335f] text-white px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                      {readableStatus(activeDelivery.status || 'pending')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/90 rounded-xl p-3.5 border border-blue-100/80 text-xs">
                    {activeDelivery.carrierName && (
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Carrier Partner</span>
                        <p className="font-black text-slate-800 truncate">{activeDelivery.carrierName}</p>
                      </div>
                    )}
                    {activeDelivery.trackingNumber && (
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Tracking Number</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-slate-900 truncate">{activeDelivery.trackingNumber}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(activeDelivery.trackingNumber);
                              toast.success('Tracking number copied');
                            }}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title="Copy Tracking Number"
                            aria-label="Copy Tracking Number"
                          >
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                    {activeDelivery.expectedDelivery && (
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Expected Arrival</span>
                        <p className="font-bold text-slate-800">{formatDate(activeDelivery.expectedDelivery)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Workflow Timeline Section */}
              <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#12335f]" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#12335f]">
                      Workflow Tracking & Timestamps
                    </h4>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">Order Lifecycle Audit</span>
                </div>

                <div className="relative border-l-2 border-slate-200 pl-6 ml-3 space-y-5 py-1">
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-50 text-white shadow-2xs">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="text-xs font-extrabold text-slate-900">Purchase Order Generated</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 mt-1">
                      PO record created from procurement bidding workflow.
                    </p>
                  </div>

                  {viewingStatusLower !== 'generated' && viewingStatusLower !== 'order_placed' && viewingStatusLower !== 'cancelled' && (
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-50 text-white shadow-2xs">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-extrabold text-slate-900">PO Acknowledged by Seller</span>
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {order.acceptedAt ? formatDate(order.acceptedAt) : 'Acknowledged'}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 mt-1">
                        Seller acknowledged and committed to fulfillment.
                      </p>
                    </div>
                  )}

                  {order.status === 'delivered' && (
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-50 text-white shadow-2xs">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-extrabold text-slate-900">Delivered & Completed</span>
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                          Completed
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 mt-1">
                        Consignment has been safely delivered and confirmed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Bottom Action Footer (Hidden in Print) - Single Row */}
        <footer className="no-print border-t border-slate-200 bg-white px-4 sm:px-6 py-2.5 shrink-0 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shadow-md">
          <div className="flex items-center gap-2 shrink-0">
            {isSeller && isIssued && onAccept && onReject && (
              <>
                <Button
                  onClick={() => onAccept(order)}
                  className="h-9 bg-emerald-600 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 shadow-sm rounded-xl px-3.5 whitespace-nowrap"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Accept PO
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onReject(order)}
                  className="h-9 border-rose-200 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl px-3.5 whitespace-nowrap"
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject PO
                </Button>
              </>
            )}

            {(order as any)?.bidId && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  router.push(`/bids/${(order as any).bidId}`);
                }}
                className="h-9 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl px-3.5 whitespace-nowrap cursor-pointer"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> View Quotation
              </Button>
            )}

            {isSeller && isAccepted && (
              <Button
                onClick={handleCreateInvoiceAction}
                className="h-9 bg-emerald-600 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 shadow-sm rounded-xl px-3.5 whitespace-nowrap cursor-pointer"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Convert PO to Invoice
              </Button>
            )}

            {isSeller && (isAccepted || viewingStatusLower === 'delivered') && (
              <Button
                onClick={handleManageDispatchAction}
                className="h-9 bg-[#12335f] text-xs font-black uppercase tracking-wider text-white hover:bg-[#0b2445] shadow-sm rounded-xl px-3.5 whitespace-nowrap cursor-pointer"
              >
                <Truck className="mr-1.5 h-3.5 w-3.5" /> Delivery / Manage Dispatch
              </Button>
            )}

            {(() => {
              const hasGrn = Boolean((order as any)?.grns?.length > 0 || ['grn_completed', 'inspection_accepted', 'delivered', 'completed'].includes(viewingStatusLower));
              const isPaid = viewingStatusLower.includes('paid');
              const payRoute = isBuyer ? '/buyer/payments' : '/payments';
              if (hasGrn && !isPaid) {
                return (
                  <Button
                    onClick={() => {
                      onClose();
                      router.push(`${payRoute}?search=${encodeURIComponent(order?.poNumber || order?.id || '')}`);
                    }}
                    className="h-9 bg-purple-600 text-xs font-black uppercase tracking-wider text-white hover:bg-purple-700 shadow-sm rounded-xl px-3.5 whitespace-nowrap cursor-pointer"
                  >
                    <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Pay Now / Upload Payment Proof
                  </Button>
                );
              }
              if (isPaid) {
                return (
                  <Button
                    onClick={() => {
                      onClose();
                      router.push(`${payRoute}?search=${encodeURIComponent(order?.poNumber || order?.id || '')}`);
                    }}
                    className="h-9 bg-emerald-700 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-800 shadow-sm rounded-xl px-3.5 whitespace-nowrap cursor-pointer"
                  >
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-white" /> View Payment Proof (Paid)
                  </Button>
                );
              }
              return null;
            })()}

            {isBuyer && !['cancelled', 'delivered'].includes(viewingStatusLower) && onCancel && (
              <Button
                onClick={() => onCancel(order)}
                className="h-9 border-rose-200 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl px-3.5 whitespace-nowrap"
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel PO
              </Button>
            )}

            {isBuyer && viewingStatusLower !== 'cancelled' && onUploadPaymentSlip && (
              <Button
                onClick={() => onUploadPaymentSlip(order)}
                className="h-9 bg-indigo-600 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700 shadow-sm rounded-xl px-3.5 whitespace-nowrap"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Slip
              </Button>
            )}

            {onViewPaymentSlip && viewingStatusLower !== 'cancelled' && (
              <Button
                variant="outline"
                onClick={() => onViewPaymentSlip(order)}
                className="h-9 border-indigo-200 text-xs font-black uppercase tracking-wider text-indigo-700 hover:bg-indigo-50 rounded-xl px-3.5 whitespace-nowrap"
              >
                <Receipt className="mr-1.5 h-3.5 w-3.5 text-indigo-600" /> Payment Slip
              </Button>
            )}

            {isBuyer && viewingStatusLower === 'delivered' && onRepeatOrder && (
              <Button
                onClick={() => onRepeatOrder(order)}
                className="h-9 bg-[#12335f] text-xs font-black uppercase tracking-wider text-white hover:bg-[#0b2445] shadow-sm rounded-xl px-3.5 whitespace-nowrap"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Repeat Order
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={isGeneratingPdf}
              onClick={handleDirectDownloadPdf}
              className="h-9 text-xs font-black uppercase tracking-wider rounded-xl border-slate-300 hover:bg-slate-50 px-3.5 whitespace-nowrap cursor-pointer"
              title="Download PDF directly"
              aria-label="Download PDF directly"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-slate-600" aria-hidden="true" /> Download PDF
            </Button>
            <Button
              type="button"
              onClick={onClose}
              className="h-9 bg-slate-900 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 rounded-xl px-4 shadow-sm whitespace-nowrap cursor-pointer"
            >
              Close
            </Button>
          </div>
        </footer>
      </div>
      </FocusTrap>
    </div>
  );
}
