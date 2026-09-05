'use client';

import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import {
  Printer,
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
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';

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

const maskEmail = (email?: string | null) => {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name.slice(0, 2)}${'*'.repeat(Math.min(name.length - 2, 8))}@${domain}`;
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
  activeDelivery,
}: PurchaseOrderReceiptModalProps) {
  const [order, setOrder] = useState<PurchaseOrderDto | null>(initialOrder);
  const [activeTab, setActiveTab] = useState<'receipt' | 'audit'>('receipt');
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [canvasBg, setCanvasBg] = useState<'light' | 'dark'>('light');

  // Auto-fit page state to ensure the entire receipt is 100% visible on screen without scrolling
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | '100%'>('100%');
  const [scaleFactor, setScaleFactor] = useState<number>(1);
  const [sheetDims, setSheetDims] = useState<{ w: number; h: number }>({ w: 800, h: 650 });

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

      // Available space inside canvas minus comfortable padding
      const availH = canvas.clientHeight - 20;
      const availW = canvas.clientWidth - 20;

      if (unscaledH > 0 && availH > 0 && unscaledW > 0 && availW > 0) {
        const fitScaleY = availH / unscaledH;
        const fitScaleX = availW / unscaledW;
        // Best scale to fit both height and width completely within screen
        const bestScale = Math.min(fitScaleY, fitScaleX, 1);
        setScaleFactor(Math.max(0.35, Math.min(1, Number(bestScale.toFixed(3)))));
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

  // Fetch full details if order items or details are sparse
  useEffect(() => {
    if (!initialOrder?.id) return;
    let isMounted = true;

    const fetchFullDetails = async () => {
      try {
        const res: any = await api.get(`/api/purchase-orders/${initialOrder.id}`);
        const fullData = res?.data || res;
        if (fullData && isMounted) {
          setOrder(prev => ({ ...(prev || initialOrder), ...fullData }));
        }
      } catch {
        // Fall back to initialOrder
      }
    };

    if (!initialOrder.items || initialOrder.items.length === 0) {
      fetchFullDetails();
    }

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

  // Extract Seller Information
  const sellerOrg =
    order.seller?.organization?.organizationName ||
    order.seller?.sellerProfile?.organizationName ||
    order.seller?.sellerProfile?.companyName ||
    order.seller?.name ||
    'XYZ Supplier';

  const sellerAddress =
    order.seller?.organization?.address ||
    order.seller?.sellerProfile?.registeredAddress ||
    order.seller?.sellerProfile?.address ||
    order.seller?.organization?.city ||
    'Registered MSME Facility, Industrial Area';

  const sellerContact =
    order.seller?.sellerProfile?.contactPerson ||
    order.seller?.name ||
    order.seller?.mobile ||
    (order.seller?.email ? maskEmail(order.seller.email) : 'Procurement Desk');

  // Extract Buyer Information
  const buyerOrg =
    order.buyer?.organization?.organizationName ||
    order.buyer?.buyerProfile?.organizationName ||
    order.buyer?.buyerProfile?.department ||
    order.buyer?.name ||
    'ABC Corporation';

  const deliveryAddress =
    order.deliveryAddress ||
    order.buyer?.organization?.address ||
    order.buyer?.buyerProfile?.address ||
    'Designated Consignee Warehouse, Main Campus';

  const shipVia =
    order.deliveryType ? readableStatus(order.deliveryType) : 'Standard Ground Logistics';

  const trackingNumber =
    activeDelivery?.trackingNumber ||
    (order.deliveryTrackings && order.deliveryTrackings[0]?.trackingNumber) ||
    'TRK-' + (order.id * 1847 + 1000);

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

    return {
      name,
      specs,
      quantity: qty,
      unitPrice,
      total,
    };
  });

  const subtotal = displayItems.reduce((acc, it) => acc + it.total, 0) || Number(order.amount || order.totalValue || 0);
  const grandTotal = Number(order.amount || order.totalValue || subtotal);
  // Real calculation: standard GST breakdown
  const taxAmount = Math.max(0, Math.round((grandTotal * 0.18 / 1.18) * 100) / 100);

  // On screen, only add filler rows if items < 3 to ensure the entire page fits without scrolling
  const fillerRowCount = Math.max(0, 3 - displayItems.length);
  const fillerRows = Array.from({ length: fillerRowCount });

  const handlePrint = () => {
    if (onPrint) {
      onPrint(order);
    } else {
      window.print();
    }
  };

  const handleDownload = () => {
    if (onDownloadPdf) {
      onDownloadPdf(order);
    } else {
      toast.info('Downloading PDF receipt...');
      window.print();
    }
  };

  const viewingStatusLower = String(order.status || '').toLowerCase();
  const isIssued = viewingStatusLower === 'issued' || viewingStatusLower === 'generated' || viewingStatusLower === 'order_placed';
  const isAccepted = viewingStatusLower === 'accepted' || viewingStatusLower === 'in_fulfillment';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden',
        !isFullscreen && 'p-3 sm:p-6 items-center justify-center'
      )}
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
      <div
        className={cn(
          'flex flex-col bg-white overflow-hidden shadow-2xl transition-all duration-300 w-full',
          isFullscreen
            ? 'h-full w-full rounded-none'
            : 'max-h-[95vh] max-w-5xl rounded-2xl border border-slate-200'
        )}
      >
        {/* Top Control Header Bar (Hidden in Print) */}
        <header className="no-print bg-[#0b1f3a] text-white px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between border-b border-white/10 shadow-md">
          {/* Left: Navigation, PO info */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 px-3 text-white/90 hover:text-white hover:bg-white/10 text-xs font-bold rounded-xl gap-1.5 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>

            <div className="h-4 w-px bg-white/20 hidden sm:block" />

            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-black text-sm sm:text-base text-white tracking-tight truncate">
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
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all"
                title="Copy PO Number"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>

            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {readableStatus(order.status)}
            </span>
          </div>

          {/* Center: View Mode Toggle & Theme Options */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => setActiveTab('receipt')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
                  activeTab === 'receipt'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Receipt (1st Page)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
                  activeTab === 'audit'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Audit & Tracking</span>
              </button>
            </div>


            {/* Zoom / Page Fit Switcher (Active on receipt tab) */}
            {activeTab === 'receipt' && (
              <div className="hidden sm:flex items-center bg-white/10 p-1 rounded-xl border border-white/15 gap-1">
                <button
                  type="button"
                  onClick={() => setZoomMode('100%')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                    zoomMode === '100%'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  )}
                  title="View at regular 100% actual size"
                >
                  Regular Size (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode('fit')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                    zoomMode === 'fit'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  )}
                  title="Fit whole page in window without scrolling"
                >
                  Fit Page {zoomMode === 'fit' && `(${Math.round(scaleFactor * 100)}%)`}
                </button>
              </div>
            )}
          </div>

          {/* Right: Actions & Canvas Toggle */}
          <div className="flex items-center gap-2">
            {/* Canvas Backdrop Toggle (Light Studio vs Dark Studio) */}
            {/* <button
              type="button"
              onClick={() => setCanvasBg(prev => prev === 'light' ? 'dark' : 'light')}
              className="inline-flex h-8 sm:h-9 items-center gap-1.5 px-2.5 text-xs font-bold rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
              title={`Toggle Canvas (${canvasBg === 'light' ? 'Light Studio' : 'Dark Studio'})`}
            >
              {canvasBg === 'light' ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-blue-200" />
                  <span className="hidden xl:inline text-[10px] font-black uppercase tracking-wider">Dark Canvas</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-300" />
                  <span className="hidden xl:inline text-[10px] font-black uppercase tracking-wider">Light Canvas</span>
                </>
              )}
            </button> */}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs font-bold rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white gap-1.5 cursor-pointer transition-all"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print PO</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs font-bold rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white gap-1.5 cursor-pointer transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download PDF</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all hidden lg:flex"
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Modal Body Canvas */}
        <div
          ref={canvasRef}
          className={cn(
            "flex-1 overflow-auto p-2 sm:p-3 flex justify-center items-center transition-colors duration-200",
            canvasBg === 'light' ? "bg-[#edf2f7]" : "bg-slate-950"
          )}
        >
          {activeTab === 'receipt' ? (
            /* 1st Page Format: RECEIPT PURCHASE ORDER (Exact Match to Image 1) */
            <div
              className="po-scale-wrapper relative flex justify-center items-center mx-auto my-auto shrink-0 transition-all duration-150"
              style={{
                width: sheetDims.w ? `${Math.round(sheetDims.w * scaleFactor)}px` : '800px',
                height: sheetDims.h ? `${Math.round(sheetDims.h * scaleFactor)}px` : 'auto',
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
                }}
                className={cn(
                  "bg-white text-slate-900 rounded-sm border-2 border-black p-4 sm:p-5 flex flex-col justify-between shrink-0 transition-shadow",
                  canvasBg === 'light' ? "shadow-2xl shadow-slate-400/50" : "shadow-2xl shadow-black/80"
                )}
              >
                <div>
                  {/* Header Title */}
                  <div className="text-center pb-1 mb-2.5">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-widest font-sans">
                      RECEIPT PURCHASE ORDER
                    </h1>
                    <div className={cn("h-1 w-full mt-1.5 rounded-full transition-colors", currentTheme.accentLine)} />
                  </div>

                  {/* Table 1: Vendor & PO Info */}
                  <table className="w-full border-collapse border border-black text-xs mb-2">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className={cn("w-1/6 font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Vendor Name:</td>
                        <td className="w-2/6 font-semibold p-1.5 sm:p-2 text-slate-900 border-r border-black">{sellerOrg}</td>
                        <td className={cn("w-1/6 font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Date:</td>
                        <td className="w-2/6 font-semibold p-1.5 sm:p-2 text-slate-900 font-mono">{poDate}</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className={cn("font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Vendor Address:</td>
                        <td className="font-semibold p-1.5 sm:p-2 text-slate-900 border-r border-black leading-tight">{sellerAddress}</td>
                        <td className={cn("font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>PO Number:</td>
                        <td className="font-black p-1.5 sm:p-2 text-slate-950 font-mono">{order.poNumber}</td>
                      </tr>
                      <tr>
                        <td className={cn("font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Contact:</td>
                        <td className="font-semibold p-1.5 sm:p-2 text-slate-900 border-r border-black">{sellerContact}</td>
                        <td className={cn("font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Due Date:</td>
                        <td className="font-semibold p-1.5 sm:p-2 text-slate-900 font-mono">{dueDate}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Table 2: Ship To & Shipping Details */}
                  <table className="w-full border-collapse border border-black text-xs mb-2">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className={cn("w-1/6 font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Ship To:</td>
                        <td className="w-2/6 font-semibold p-1.5 sm:p-2 text-slate-900 border-r border-black">{buyerOrg}</td>
                        <td className={cn("w-1/6 font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Ship Via:</td>
                        <td className="w-2/6 font-semibold p-1.5 sm:p-2 text-slate-900">{shipVia}</td>
                      </tr>
                      <tr>
                        <td className={cn("font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Ship To Address:</td>
                        <td className="font-semibold p-1.5 sm:p-2 text-slate-900 border-r border-black leading-tight">{deliveryAddress}</td>
                        <td className={cn("font-bold p-1.5 sm:p-2 border-r border-slate-400 transition-colors", currentTheme.labelBg, currentTheme.labelText)}>Tracking Number:</td>
                        <td className="font-semibold p-1.5 sm:p-2 text-slate-900 font-mono">{trackingNumber}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Table 3: Line Items (Matching Image 1 Format) */}
                  <table className="w-full border-collapse border border-black text-xs mb-2">
                    <thead>
                      <tr className={cn("border-b border-black font-bold transition-colors", currentTheme.headerBg, currentTheme.headerText)}>
                        <th className={cn("p-2 text-left border-r w-1/2", currentTheme.tableHeaderBorder)}>Product Description</th>
                        <th className={cn("p-2 text-center border-r w-1/6", currentTheme.tableHeaderBorder)}>Quantity</th>
                        <th className={cn("p-2 text-right border-r w-1/6", currentTheme.tableHeaderBorder)}>Unit Price</th>
                        <th className="p-2 text-right w-1/6">Total [₹]</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="p-2 border-r border-slate-300">
                            <span className="font-bold text-slate-950 block">{item.name}</span>
                            {item.specs && <span className="text-[10px] text-slate-500 block leading-tight">{item.specs}</span>}
                          </td>
                          <td className="p-2 text-center border-r border-slate-300 font-mono font-semibold">{item.quantity}</td>
                          <td className="p-2 text-right border-r border-slate-300 font-mono">₹{formatNumber(item.unitPrice)}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-950">₹{formatNumber(item.total)}</td>
                        </tr>
                      ))}

                      {/* Placeholder rows matching Image 1 to maintain physical receipt balance */}
                      {fillerRows.map((_, idx) => (
                        <tr key={`fill-${idx}`} className="border-b border-slate-200/60 h-6">
                          <td className="p-1.5 border-r border-slate-300">&nbsp;</td>
                          <td className="p-1.5 text-center border-r border-slate-300 text-slate-300 font-mono">-</td>
                          <td className="p-1.5 text-right border-r border-slate-300 text-slate-300 font-mono">-</td>
                          <td className="p-1.5 text-right text-slate-300 font-mono">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Section: ADDITIONAL NOTES & TOTAL AMOUNT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mt-2 pt-1">
                  {/* Left: ADDITIONAL NOTES */}
                  <div className="border border-black overflow-hidden flex flex-col">
                    <div className={cn("border-b border-black p-1.5 font-bold uppercase tracking-wide transition-colors", currentTheme.notesHeaderBg, currentTheme.notesHeaderText)}>
                      ADDITIONAL NOTES
                    </div>
                    <div className="p-2 text-[11px] text-slate-800 space-y-1 font-medium leading-relaxed bg-white flex-1">
                      <p>1. Please deliver to the designated address by the due date.</p>
                      <p>2. Payment Terms: {order.paymentTerms ? readableStatus(order.paymentTerms) : 'Escrow Held / Pay on Invoice'}.</p>
                      <p>3. If you have any questions, contact {sellerContact || 'the designated procurement officer'}.</p>
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
              </div>
            </div>
          ) : (
            /* Audit & Workflow Tracking View (Retains Image 2 functionality) */
            <div className="w-full max-w-4xl space-y-5">
              {/* Order Title & Badges Card */}
              <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-sm space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Order Title & Reference
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                      {order.title}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                      Total
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#12335f] font-mono">
                      {formatCurrency(order.amount || order.totalValue)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800 shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {readableStatus(order.status)}
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
                    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">
                        BY
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                          Buyer (Requester)
                        </span>
                        <p className="text-xs font-black text-slate-900 truncate">
                          {order.buyer?.name || buyerOrg}
                        </p>
                        {order.buyer?.email && (
                          <p className="text-[10px] font-semibold text-slate-500 font-mono truncate">
                            {maskEmail(order.buyer.email)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Seller Info */}
                    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">
                        SL
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                          Seller (Provider)
                        </span>
                        <p className="text-xs font-black text-slate-900 truncate">
                          {order.seller?.name || sellerOrg}
                        </p>
                        {order.seller?.email && (
                          <p className="text-[10px] font-semibold text-slate-500 font-mono truncate">
                            {maskEmail(order.seller.email)}
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
                        <div className="min-w-0">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                            Delivery Address
                          </span>
                          <p title={order.deliveryAddress} className="text-xs font-semibold text-slate-700 leading-relaxed line-clamp-2">
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/80 rounded-xl p-3 border border-blue-100/80 text-xs">
                    {activeDelivery.carrierName && (
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Carrier Partner</span>
                        <p className="font-black text-slate-800 truncate">{activeDelivery.carrierName}</p>
                      </div>
                    )}
                    {activeDelivery.trackingNumber && (
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Tracking Number</span>
                        <p className="font-mono font-bold text-slate-900 truncate">{activeDelivery.trackingNumber}</p>
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
          )}
        </div>

        {/* Bottom Action Footer (Hidden in Print) */}
        <footer className="no-print border-t border-slate-200 bg-white px-4 sm:px-6 py-2 shrink-0 flex flex-wrap items-center justify-between gap-2 shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            {isSeller && isIssued && onAccept && onReject && (
              <>
                <Button
                  onClick={() => onAccept(order)}
                  className="h-9 bg-emerald-600 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 shadow-sm rounded-xl px-4"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Accept PO
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onReject(order)}
                  className="h-9 border-rose-200 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl px-4"
                >
                  <XCircle className="mr-1.5 h-4 w-4" /> Reject PO
                </Button>
              </>
            )}

            {isSeller && isAccepted && onCreateInvoice && (
              <Button
                onClick={() => onCreateInvoice(order)}
                className="h-9 bg-emerald-600 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 shadow-sm rounded-xl px-4"
              >
                <FileText className="mr-1.5 h-4 w-4" /> Create Invoice
              </Button>
            )}

            {isSeller && (isAccepted || viewingStatusLower === 'delivered') && onManageDispatch && (
              <Button
                onClick={() => onManageDispatch(order)}
                className="h-9 bg-[#12335f] text-xs font-black uppercase tracking-wider text-white hover:bg-[#0b2445] shadow-sm rounded-xl px-4"
              >
                <Truck className="mr-1.5 h-4 w-4" /> Delivery / Manage Dispatch
              </Button>
            )}

            {isBuyer && !['cancelled', 'delivered'].includes(viewingStatusLower) && onCancel && (
              <Button
                onClick={() => onCancel(order)}
                className="h-9 border-rose-200 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl px-4"
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Cancel PO
              </Button>
            )}

            {isBuyer && viewingStatusLower === 'delivered' && onRepeatOrder && (
              <Button
                onClick={() => onRepeatOrder(order)}
                className="h-9 bg-[#12335f] text-xs font-black uppercase tracking-wider text-white hover:bg-[#0b2445] shadow-sm rounded-xl px-4"
              >
                <RefreshCw className="mr-1.5 h-4 w-4" /> Repeat Order
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="h-9 text-xs font-black uppercase tracking-wider rounded-xl border-slate-300 hover:bg-slate-50 px-4"
            >
              <Printer className="mr-1.5 h-4 w-4 text-slate-600" /> Print PO
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="h-9 text-xs font-black uppercase tracking-wider rounded-xl border-slate-300 hover:bg-slate-50 px-4"
            >
              <Download className="mr-1.5 h-4 w-4 text-slate-600" /> Download PDF
            </Button>
            <Button
              onClick={onClose}
              className="h-9 bg-slate-900 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 rounded-xl px-5 shadow-sm"
            >
              Close
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
