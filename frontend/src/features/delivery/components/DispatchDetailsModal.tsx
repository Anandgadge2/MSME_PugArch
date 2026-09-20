/**
 * DispatchDetailsModal — Comprehensive Order Fulfillment & Dispatch Console.
 *
 * Allows sellers to configure:
 * - Carrier partner (popular carriers quick-select)
 * - Tracking / AWB / LR numbers
 * - Driver Name, Driver Phone, Vehicle Number, Transport Mode, Dispatch Timestamps
 * - Expected delivery date (ETA)
 * - E-Way Bill number with Rule 138 advisory
 * - Delivery Challan upload and attachment
 * - Tax Invoice preview, branding, and PDF generation
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Truck,
  Package,
  Send,
  Building2,
  MapPin,
  Calendar,
  FileText,
  ShieldCheck,
  Receipt,
  Upload,
  ChevronDown,
  ChevronUp,
  Boxes,
  Check,
  CheckCircle2,
  ExternalLink,
  Download,
  Printer,
  Sparkles,
  Phone,
  User,
  Clock
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from '@/components/ui/loader';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { openFileAsset } from '../../../lib/files';
import { compressImage } from '../../../lib/compress';
import { formatCurrency, formatDate } from '../../shared/format';
import { runWithToast } from '../../../lib/toast';
import { queryKeys } from '../../shared/queryKeys';
import {
  useUpdateDispatchDetails,
  useMarkDispatched,
  useAddDeliveryDocument,
  useDeliveryDetail
} from '../hooks';
import { invalidateDeliveryCache, labelFor } from '../status';
import type { DeliveryDetailDto } from '../types';
import { generateTaxInvoicePdf, type TaxInvoiceData, type TaxInvoiceItem } from '../../invoices/lib/invoicePdfGenerator';
import { TaxInvoiceCard } from '../../invoices/components/TaxInvoiceCard';

interface DispatchDetailsModalProps {
  isOpen: boolean;
  delivery: DeliveryDetailDto | any;
  onClose: () => void;
  onSuccess?: () => void;
}

const POPULAR_CARRIERS = [
  'Blue Dart',
  'Delhivery',
  'DTDC',
  'FedEx',
  'India Post',
  'Safexpress',
  'TCI Express',
  'Shadowfax'
];

const TRANSPORT_MODES = ['Road', 'Rail', 'Air', 'Express Courier', 'Direct Driver'];

export function DispatchDetailsModal({
  isOpen,
  delivery,
  onClose,
  onSuccess
}: DispatchDetailsModalProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: freshDelivery } = useDeliveryDetail(delivery?.id || 0);
  const activeDelivery = freshDelivery || delivery;
  const po = activeDelivery?.purchaseOrder || delivery?.purchaseOrder;

  // Determine if dispatch details have already been submitted / consignment is dispatched
  const isAlreadyDispatched = useMemo(() => {
    const statusUpper = String(activeDelivery?.status || delivery?.status || '').toUpperCase();
    const hasDispatchedStatus = [
      'DISPATCHED',
      'IN_TRANSIT',
      'AT_HUB',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'CLOSED'
    ].includes(statusUpper);
    const hasSavedTracking = Boolean(
      (activeDelivery?.trackingNumber || delivery?.trackingNumber)?.trim()
    );
    return hasDispatchedStatus || hasSavedTracking;
  }, [activeDelivery, delivery]);

  // Form states
  const [trackingNumber, setTrackingNumber] = useState(delivery?.trackingNumber || '');
  const [carrierName, setCarrierName] = useState(delivery?.carrierName || '');
  const [eta, setEta] = useState((delivery?.expectedDelivery || '').slice(0, 10));
  const [ewayBillNumber, setEwayBillNumber] = useState(delivery?.ewayBillNumber || '');
  const [remarks, setRemarks] = useState(delivery?.remarks || '');

  // Driver & transport controls
  const [driverName, setDriverName] = useState(
    delivery?.metadata?.driverName || ''
  );
  const [driverPhone, setDriverPhone] = useState(
    delivery?.logisticsContact || delivery?.metadata?.driverPhone || ''
  );
  const [vehicleNumber, setVehicleNumber] = useState(
    delivery?.metadata?.vehicleNumber || ''
  );
  const [transportMode, setTransportMode] = useState(
    delivery?.metadata?.transportMode || 'Road'
  );
  const [dispatchTimestamp, setDispatchTimestamp] = useState(
    delivery?.metadata?.dispatchTimestamp
      ? String(delivery.metadata.dispatchTimestamp).slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );

  const [itemsExpanded, setItemsExpanded] = useState(false);

  // Sync state when authoritative fresh delivery loads
  useEffect(() => {
    if (freshDelivery) {
      if (freshDelivery.trackingNumber) setTrackingNumber(freshDelivery.trackingNumber);
      if (freshDelivery.carrierName) setCarrierName(freshDelivery.carrierName);
      if (freshDelivery.expectedDelivery) setEta(freshDelivery.expectedDelivery.slice(0, 10));
      if (freshDelivery.ewayBillNumber) setEwayBillNumber(freshDelivery.ewayBillNumber);
      if (freshDelivery.remarks) setRemarks(freshDelivery.remarks);
      if ((freshDelivery as any).metadata?.driverName) setDriverName((freshDelivery as any).metadata.driverName);
      if ((freshDelivery as any).logisticsContact || (freshDelivery as any).metadata?.driverPhone) {
        setDriverPhone((freshDelivery as any).logisticsContact || (freshDelivery as any).metadata?.driverPhone);
      }
      if ((freshDelivery as any).metadata?.vehicleNumber) setVehicleNumber((freshDelivery as any).metadata.vehicleNumber);
      if ((freshDelivery as any).metadata?.transportMode) setTransportMode((freshDelivery as any).metadata.transportMode);
      if ((freshDelivery as any).metadata?.dispatchTimestamp) {
        setDispatchTimestamp(String((freshDelivery as any).metadata.dispatchTimestamp).slice(0, 16));
      }
    }
  }, [freshDelivery]);

  // Invoice & PDF states
  const [copyType, setCopyType] = useState('Original Copy');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);
  const [fetchedInvoice, setFetchedInvoice] = useState<any | null>(null);

  // Delivery Challan state
  const [challanNumber, setChallanNumber] = useState('');
  const [challanFileAssetId, setChallanFileAssetId] = useState<number | null>(null);
  const [challanUploadedFile, setChallanUploadedFile] = useState<{ name: string; size?: string } | null>(null);
  const [isUploadingChallan, setIsUploadingChallan] = useState(false);

  const updateDispatchMut = useUpdateDispatchDetails(delivery?.id || 0);
  const markDispatchedMut = useMarkDispatched(delivery?.id || 0);
  const addDocMut = useAddDeliveryDocument(delivery?.id || 0);

  const existingChallanDoc = useMemo(() => {
    return (activeDelivery?.documents || delivery?.documents || []).find(
      (d: any) => d.documentType === 'DELIVERY_CHALLAN'
    );
  }, [activeDelivery?.documents, delivery?.documents]);

  const existingInvoiceDoc = useMemo(() => {
    return (activeDelivery?.documents || delivery?.documents || []).find(
      (d: any) => d.documentType === 'TAX_INVOICE'
    );
  }, [activeDelivery?.documents, delivery?.documents]);

  // Load created invoice from API or PO
  useEffect(() => {
    if (!isOpen || !delivery) return;
    const poId = delivery.purchaseOrderId;
    const poNo = delivery.purchaseOrder?.poNumber;

    if (delivery.purchaseOrder?.invoices && delivery.purchaseOrder.invoices.length > 0) {
      setFetchedInvoice(delivery.purchaseOrder.invoices[0]);
    }

    const loadCreatedInvoice = async () => {
      try {
        const searchParam = poNo || (poId ? String(poId) : '');
        if (!searchParam) return;
        const res = await api.fetch(`/api/invoices?search=${encodeURIComponent(searchParam)}`);
        if (res.ok) {
          const data = await res.json();
          const list = data?.invoices || data?.records || data?.items || (Array.isArray(data) ? data : []);
          if (Array.isArray(list) && list.length > 0) {
            const match =
              list.find(
                (i: any) =>
                  (poId && Number(i.purchaseOrderId) === Number(poId)) ||
                  (poNo && i.purchaseOrder?.poNumber === poNo) ||
                  (poNo && i.invoiceNumber?.includes(poNo))
              ) || list[0];
            if (match) {
              setFetchedInvoice(match);
            }
          }
        }
      } catch (err) {
        console.warn('Unable to fetch created invoice from API:', err);
      }
    };

    void loadCreatedInvoice();
  }, [isOpen, delivery]);

  // Keyboard accessibility: Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Construct invoice data for TaxInvoiceCard & PDF
  const invData = useMemo<TaxInvoiceData>(() => {
    const activePo = activeDelivery?.purchaseOrder || delivery?.purchaseOrder;
    const invNo =
      fetchedInvoice?.invoiceNumber ||
      activePo?.invoices?.[0]?.invoiceNumber ||
      existingInvoiceDoc?.description ||
      `INV-${activePo?.poNumber || delivery?.id}`;

    const dateRaw = fetchedInvoice?.createdAt || activePo?.invoices?.[0]?.createdAt;
    const dateStr = formatDate(dateRaw || new Date());
    const totalVal = Number(fetchedInvoice?.totalAmount || fetchedInvoice?.amount || activePo?.amount || 0);

    const sellerUser = fetchedInvoice?.seller || activePo?.seller;
    const sellerOrg = (sellerUser as any)?.organization || (sellerUser as any)?.sellerProfile?.organization;
    const sellerProfile = sellerOrg?.profile || (sellerUser as any)?.organizationProfile || (sellerUser as any)?.sellerProfile;
    const sellerReg = (sellerUser as any)?.registrationDetails || {};

    const sellerName = sellerOrg?.organizationName || sellerOrg?.name || (sellerUser as any)?.organizationName || sellerUser?.name || 'N/A';
    const sellerAddress = sellerOrg?.address || sellerProfile?.address || sellerReg?.address || (sellerUser as any)?.address || 'N/A';
    const sellerGstin = sellerOrg?.gstin || sellerProfile?.gstin || sellerReg?.gstin || undefined;

    const buyerUser = fetchedInvoice?.buyer || activePo?.buyer;
    const buyerOrg = (buyerUser as any)?.organization || (buyerUser as any)?.buyerProfile?.organization;
    const buyerProfile = buyerOrg?.profile || (buyerUser as any)?.organizationProfile || (buyerUser as any)?.buyerProfile;
    const buyerReg = (buyerUser as any)?.registrationDetails || {};

    const buyerName = buyerOrg?.organizationName || buyerOrg?.name || (buyerUser as any)?.organizationName || buyerUser?.name || 'N/A';
    const buyerAddress = activePo?.deliveryAddress || buyerOrg?.address || buyerProfile?.address || buyerReg?.address || 'N/A';
    const buyerGstin = buyerOrg?.gstin || buyerProfile?.gstin || buyerReg?.gstin || undefined;

    const rawItems: any[] = activePo?.items || [];
    const items: TaxInvoiceItem[] = rawItems.length > 0
      ? rawItems.map((item, idx) => {
          const qty = Number(item.quantity || 1);
          const price = Number(item.unitPrice || 0);
          const amount = Number(item.totalAmount || qty * price || totalVal);
          return {
            srNo: idx + 1,
            description: item.itemName || activePo?.title || 'Order Item',
            hsn: '84719000',
            qty,
            priceUnit: price || amount / Math.max(qty, 1),
            amount
          };
        })
      : [
          {
            srNo: 1,
            description: activePo?.title || `Purchase Order #${delivery?.purchaseOrderId}`,
            hsn: '84719000',
            qty: 1,
            priceUnit: totalVal,
            amount: totalVal
          }
        ];

    const subtotal = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
    const cgstAmount = Math.round(subtotal * 0.09 * 100) / 100;
    const sgstAmount = Math.round(subtotal * 0.09 * 100) / 100;
    const grandTotal = Math.round((subtotal + cgstAmount + sgstAmount) * 100) / 100;

    return {
      invoiceNumber: invNo,
      invoiceDate: dateStr,
      dueDate: dateStr,
      dateStr,
      seller: {
        name: sellerName,
        address: sellerAddress,
        gstin: sellerGstin
      },
      billTo: {
        name: buyerName,
        address: buyerAddress,
        gstin: buyerGstin
      },
      shipTo: {
        name: buyerName,
        address: buyerAddress
      },
      items,
      subtotal,
      cgstRate: 9,
      cgstAmount,
      sgstRate: 9,
      sgstAmount,
      totalAmount: grandTotal,
      bankDetails: {
        bankName: sellerReg?.bankName || 'HDFC Bank',
        accountNo: sellerReg?.accountNumber || '002100987654',
        ifscCode: sellerReg?.ifscCode || 'HDFC0000021',
        accountName: sellerName
      }
    };
  }, [delivery, activeDelivery, fetchedInvoice, existingInvoiceDoc]);

  // PDF generation
  const handleGenerateAndAttachPdf = async (targetCopy = copyType, mode: 'download' | 'print' = 'download') => {
    setIsGeneratingInvoice(true);
    try {
      const dataToUse = { ...invData, copyType: targetCopy };
      const doc = await generateTaxInvoicePdf(dataToUse);
      const filename = `${dataToUse.invoiceNumber}-${targetCopy.replace(/\s+/g, '')}.pdf`;

      if (mode === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
        toast.success('Tax Invoice sent to print queue');
      } else {
        doc.save(filename);
        toast.success(`Tax Invoice PDF downloaded (${targetCopy})`);
      }

      // Upload PDF and attach to delivery
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', pdfFile);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await api.fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const fileId = Number(data?.fileId || data?.file?.id || data?.id || 0);
        if (fileId > 0) {
          await addDocMut.mutateAsync({
            documentType: 'TAX_INVOICE',
            fileAssetId: fileId,
            description: `Tax Invoice (${dataToUse.invoiceNumber})`
          });
          toast.success('Tax Invoice attached to shipment record');
        }
      }
    } catch (err: any) {
      console.error('Invoice PDF error:', err);
      toast.error(err?.message || 'Error generating Tax Invoice PDF');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Upload Delivery Challan file
  const validateAndProcessChallan = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
    if (!allowedExts.includes(ext || '')) {
      toast.error('Invalid Delivery Challan document format. Only PDF, JPG, or PNG supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Delivery Challan exceeds 10 MB limit.');
      return;
    }

    setIsUploadingChallan(true);
    try {
      const fileToUpload = await compressImage(file);
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await api.fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const fileId = Number(data?.fileId || data?.file?.id || data?.id || 0);
        if (fileId > 0) {
          setChallanFileAssetId(fileId);
          const formattedSize =
            file.size > 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
              : `${Math.round(file.size / 1024)} KB`;
          setChallanUploadedFile({ name: file.name, size: formattedSize });
          toast.success(`Delivery Challan "${file.name}" uploaded successfully`);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error uploading Delivery Challan');
    } finally {
      setIsUploadingChallan(false);
    }
  };

  const handleSave = async () => {
    if (isAlreadyDispatched) {
      toast.error('Dispatch details have already been submitted. Further modifications are locked.');
      return;
    }

    if (!trackingNumber.trim()) {
      toast.error('Please enter a Tracking / AWB / LR number');
      return;
    }

    await runWithToast(
      async () => {
        // 1. Update dispatch details including driver and transport mode
        await updateDispatchMut.mutateAsync({
          trackingNumber: trackingNumber.trim() || undefined,
          carrierName: carrierName.trim() || undefined,
          expectedDelivery: eta || undefined,
          ewayBillNumber: ewayBillNumber.trim() || undefined,
          driverName: driverName.trim() || undefined,
          driverPhone: driverPhone.trim() || undefined,
          vehicleNumber: vehicleNumber.trim() || undefined,
          transportMode: transportMode || undefined,
          dispatchTimestamp: dispatchTimestamp ? new Date(dispatchTimestamp) : undefined,
          remarks: remarks.trim() || undefined
        });

        // 2. Attach Delivery Challan document if uploaded
        if (challanFileAssetId) {
          await addDocMut.mutateAsync({
            documentType: 'DELIVERY_CHALLAN',
            fileAssetId: challanFileAssetId,
            description: challanNumber.trim()
              ? `Delivery Challan #${challanNumber.trim()}`
              : 'Delivery Challan'
          });
        }

        // 3. Complete dispatch status transition in backend if not yet marked DISPATCHED
        if (
          delivery.status !== 'DISPATCHED' &&
          !['DISPATCHED', 'IN_TRANSIT', 'AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CLOSED'].includes(
            String(delivery.status)
          )
        ) {
          await markDispatchedMut.mutateAsync({});
        }

        // 4. Invalidate delivery caches
        await invalidateDeliveryCache(qc, delivery.id);
        if (onSuccess) onSuccess();
        onClose();
      },
      {
        loading: 'Saving dispatch fulfillment details...',
        success: 'Fulfillment saved and shipment marked as DISPATCHED!',
        error: (err: any) => err?.message || 'Failed to save fulfillment details'
      }
    );
  };

  if (!isOpen) return null;

  const rawItems: any[] = (po as any)?.items || [];
  const totalUnits = rawItems.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
  const orderTotal = Number(invData.totalAmount || (po as any)?.amount || 0);
  const consigneeOrgName =
    (po as any)?.buyer?.organization?.organizationName || (po as any)?.buyer?.name || 'Registered Consignee';
  const consigneeAddress =
    (po as any)?.deliveryAddress || (po as any)?.buyer?.organization?.address || activeDelivery?.currentLocation || 'Consignee Delivery Address';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-dialog-title"
    >
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] via-[#12335f] to-[#1e40af] px-6 py-4 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-blue-200 shadow-inner">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isAlreadyDispatched ? (
                  <span className="rounded bg-emerald-500/30 border border-emerald-400/50 px-2 py-0.5 text-[10px] font-bold text-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    Dispatched & Locked
                  </span>
                ) : (
                  <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    Dispatch & Fulfillment Console
                  </span>
                )}
                <span className="rounded bg-blue-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-200">
                  DLV-{delivery.id}
                </span>
                {po?.poNumber && (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-200">
                    {po.poNumber}
                  </span>
                )}
              </div>
              <h2 id="dispatch-dialog-title" className="mt-0.5 text-base sm:text-lg font-black tracking-tight text-white line-clamp-1">
                {po?.title || 'Order Fulfillment & Logistics Dispatch'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-5 sm:p-6 space-y-6 text-left">
          {/* Dispatch Already Confirmed Locked Banner */}
          {isAlreadyDispatched && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 flex items-start gap-3.5 shadow-2xs">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-black text-emerald-950 text-sm">
                  Dispatch Details Confirmed & Locked
                </p>
                <p className="text-emerald-800 text-[11px] leading-relaxed font-medium">
                  Waybill credentials, carrier partner, driver contacts, and consignment logistics have already been submitted and synchronized with the buyer portal. To preserve logistics chain-of-custody and statutory compliance, dispatch details cannot be submitted or edited twice.
                </p>
              </div>
            </div>
          )}

          {/* A. Top Commercial & Consignee Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-blue-600" />
                PO Commercials
              </span>
              <p className="text-base font-black text-slate-900">{formatCurrency(orderTotal)}</p>
              <p className="text-[10px] text-slate-500 font-semibold truncate">
                {po?.poNumber || `PO-${delivery.purchaseOrderId}`}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                Consignee
              </span>
              <p className="text-xs font-bold text-slate-900 truncate" title={consigneeOrgName}>
                {consigneeOrgName}
              </p>
              <div className="flex items-start gap-1 pt-1 text-[11px] text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2" title={consigneeAddress}>{consigneeAddress}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5 text-emerald-600" />
                Consignment Units
              </span>
              <p className="text-base font-black text-slate-900">{totalUnits} units</p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>Stage:</span>
                <span className="font-bold text-slate-800 uppercase">{labelFor(delivery.status)}</span>
              </div>
            </div>
          </div>

          {/* B. Statutory Advisory */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-950">Statutory Logistics & E-Way Bill Advisory</span>
                {orderTotal >= 50000 ? (
                  <span className="bg-amber-200 text-amber-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                    E-Way Bill Required (≥ ₹50,000)
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-900 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">
                    Under ₹50,000 Threshold
                  </span>
                )}
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Rule 138 of CGST Rules mandates an active 12-digit E-Way Bill for consignments exceeding ₹50,000. Saving dispatch details updates live coordinates on the buyer tracking portal.
              </p>
            </div>
          </div>

          {/* C. Primary Shipment Logistics & Carrier Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#12335f]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Carrier & Logistics Information
                </h3>
              </div>
              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                Waybill Credentials
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Tracking / AWB / LR Number *
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  placeholder="e.g. AWB-98765432 or LR-88219"
                  required
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-bold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-900"
                  )}
                />
                <p className="text-[9px] text-slate-400 mt-1">Air Waybill or Lorry Receipt reference from your carrier</p>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Carrier Partner Name
                </label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={e => setCarrierName(e.target.value)}
                  placeholder="e.g. Blue Dart / Delhivery"
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {POPULAR_CARRIERS.map(c => (
                    <button
                      key={c}
                      type="button"
                      disabled={isAlreadyDispatched}
                      onClick={() => setCarrierName(c)}
                      className={cn(
                        'rounded px-2 py-0.5 text-[9px] font-bold transition border',
                        isAlreadyDispatched && 'cursor-not-allowed opacity-60',
                        carrierName.toLowerCase() === c.toLowerCase()
                          ? 'bg-[#12335f] text-white border-[#12335f]'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Driver, Vehicle, Transport Mode & Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-slate-100">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <User className="h-3 w-3 text-slate-400" />
                  Driver / Dispatch Agent
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  Driver Phone / Contact
                </label>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={e => setDriverPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Vehicle Registration No.
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value)}
                  placeholder="e.g. MH 04 AB 1234"
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Transport Mode
                </label>
                <select
                  value={transportMode}
                  onChange={e => setTransportMode(e.target.value)}
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                >
                  {TRANSPORT_MODES.map(mode => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  Dispatch Timestamp
                </label>
                <input
                  type="datetime-local"
                  value={dispatchTimestamp}
                  onChange={e => setDispatchTimestamp(e.target.value)}
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  Expected Delivery Date (ETA)
                </label>
                <input
                  type="date"
                  value={eta}
                  onChange={e => setEta(e.target.value)}
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                E-Way Bill Number (Rule 138)
              </label>
              <input
                type="text"
                value={ewayBillNumber}
                onChange={e => setEwayBillNumber(e.target.value)}
                placeholder="e.g. 121009876543 (12 digits)"
                maxLength={16}
                disabled={isAlreadyDispatched}
                className={cn(
                  "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                  isAlreadyDispatched
                    ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                    : "bg-white text-slate-800"
                )}
              />
            </div>
          </div>

          {/* D. Delivery Challan & Tax Invoice Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Delivery Challan */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-700" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Delivery Challan (Rule 55)
                  </h4>
                </div>
                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  Transit Document
                </span>
              </div>

              {existingChallanDoc && (
                <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50/70 p-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-purple-950 truncate">
                      {existingChallanDoc.description || 'Delivery Challan'}
                    </p>
                    <p className="text-[10px] text-purple-700">Document Asset #{existingChallanDoc.fileAssetId}</p>
                  </div>
                  {existingChallanDoc.fileAssetId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFileAsset(existingChallanDoc.fileAssetId, 'Delivery Challan')}
                      className="h-7 text-xs text-purple-800 border-purple-200 bg-white"
                    >
                      View
                    </Button>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Challan Number
                </label>
                <input
                  type="text"
                  value={challanNumber}
                  onChange={e => setChallanNumber(e.target.value)}
                  placeholder="e.g. DC-2026-001"
                  disabled={isAlreadyDispatched}
                  className={cn(
                    "h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-mono outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Attach Challan File (PDF, JPG, PNG)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void validateAndProcessChallan(f);
                  }}
                  disabled={isUploadingChallan || isAlreadyDispatched}
                  className={cn(
                    "block w-full text-xs text-slate-500 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#12335f]/10 file:text-[#12335f] hover:file:bg-[#12335f]/20",
                    isAlreadyDispatched ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  )}
                />
                {challanUploadedFile && (
                  <p className="mt-1 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <Check className="h-3 w-3" /> {challanUploadedFile.name} ({challanUploadedFile.size})
                  </p>
                )}
              </div>
            </div>

            {/* Tax Invoice */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-700" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Statutory Tax Invoice
                  </h4>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  GST Compliant
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">{invData.invoiceNumber}</p>
                  <p className="text-[10px] text-slate-500">{formatCurrency(invData.totalAmount)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateAndAttachPdf('Original Copy', 'download')}
                    disabled={isGeneratingInvoice}
                    className="h-8 text-xs font-bold"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateAndAttachPdf('Original Copy', 'print')}
                    disabled={isGeneratingInvoice}
                    className="h-8 text-xs font-bold"
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                  </Button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Fulfillment Remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={2}
                  disabled={isAlreadyDispatched}
                  placeholder="e.g. Carrier collected 2 sealed boxes, driver instructed for express priority…"
                  className={cn(
                    "w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 resize-none",
                    isAlreadyDispatched
                      ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
                      : "bg-white text-slate-800"
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5 shrink-0">
          {isAlreadyDispatched ? (
            <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              Dispatch details have already been submitted. Consignment is locked in transit.
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 font-medium">
              Saves logistics tracking credentials and advances consignment to <strong className="text-slate-800 font-black">DISPATCHED</strong>.
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateDispatchMut.isPending || markDispatchedMut.isPending}
              className="h-9 rounded-xl border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {isAlreadyDispatched ? 'Close' : 'Cancel'}
            </Button>
            {isAlreadyDispatched ? (
              <Button
                type="button"
                disabled
                className="h-9 rounded-xl bg-slate-100 border border-slate-200 px-5 text-xs font-bold text-slate-400 cursor-not-allowed shadow-none flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Dispatch Already Confirmed
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSave}
                disabled={updateDispatchMut.isPending || markDispatchedMut.isPending || isUploadingChallan}
                className="h-9 rounded-xl bg-[#12335f] px-5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#0b2447] shadow-xs cursor-pointer"
              >
                {updateDispatchMut.isPending || markDispatchedMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Dispatch...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Save & Confirm Dispatch
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
