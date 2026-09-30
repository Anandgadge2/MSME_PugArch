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
  Clock,
  Copy,
  ClipboardCheck,
  RefreshCw
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from '@/components/ui/loader';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { DateTimePicker } from '../../../components/ui/DateTimePicker';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import { openFileAsset } from '../../../lib/files';
import { compressImage } from '../../../lib/compress';
import { formatCurrency, formatDate } from '../../shared/format';
import { runWithToast } from '../../../lib/toast';
import { queryKeys } from '../../shared/queryKeys';
import { useAuth } from '../../../hooks/useAuth';
import {
  useUpdateDispatchDetails,
  useMarkDispatched,
  useAddDeliveryDocument,
  useDeliveryDetail,
  useManualDeliveryStatusUpdate
} from '../hooks';
import { invalidateDeliveryCache, labelFor } from '../status';
import type { DeliveryDetailDto } from '../types';
import { generateTaxInvoicePdf, type TaxInvoiceData, type TaxInvoiceItem } from '../../invoices/lib/invoicePdfGenerator';
import { TaxInvoiceCard } from '../../invoices/components/TaxInvoiceCard';
import { DeliveryTimeline } from './DeliveryTimeline';

interface DispatchDetailsModalProps {
  isOpen: boolean;
  delivery: DeliveryDetailDto | any;
  onClose: () => void;
  onSuccess?: () => void;
  isBuyer?: boolean;
  onOpenGrnCreate?: () => void;
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

const getCarrierTrackingUrl = (carrier?: string, trackingNo?: string): string | null => {
  if (!trackingNo) return null;
  const c = String(carrier || '').toLowerCase().trim();
  const t = encodeURIComponent(trackingNo.trim());
  if (c.includes('blue dart')) return `https://www.bluedart.com/tracking?trackNumber=${t}`;
  if (c.includes('delhivery')) return `https://www.delhivery.com/track/package/${t}`;
  if (c.includes('dtdc')) return `https://www.dtdc.in/tracking.asp`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c.includes('india post')) return `https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx`;
  if (c.includes('safexpress')) return `https://www.safexpress.com/track-and-trace?waybill=${t}`;
  if (c.includes('shadowfax')) return `https://tracker.shadowfax.in/#/track?tracking_id=${t}`;
  return null;
};

export function DispatchDetailsModal({
  isOpen,
  delivery,
  onClose,
  onSuccess,
  isBuyer,
  onOpenGrnCreate
}: DispatchDetailsModalProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: freshDelivery, refetch: refetchDelivery } = useDeliveryDetail(delivery?.id || 0);
  const activeDelivery = freshDelivery || delivery;
  const po = activeDelivery?.purchaseOrder || delivery?.purchaseOrder;

  const [isRefreshingDispatch, setIsRefreshingDispatch] = useState(false);
  const handleRefreshDispatch = async () => {
    if (isRefreshingDispatch) return;
    setIsRefreshingDispatch(true);
    try {
      await invalidateDeliveryCache(qc);
      await refetchDelivery();
      toast.success('Dispatch details refreshed');
    } catch {
      toast.error('Failed to refresh dispatch details');
    } finally {
      setIsRefreshingDispatch(false);
    }
  };

  const existingGrn = useMemo(() => {
    const list = (activeDelivery as any)?.grns || (delivery as any)?.grns || (po as any)?.grns || [];
    if (Array.isArray(list) && list.length > 0) return list[0];
    if ((activeDelivery as any)?.grn) return (activeDelivery as any).grn;
    if ((delivery as any)?.grn) return (delivery as any).grn;
    if ((po as any)?.grn) return (po as any).grn;
    return null;
  }, [activeDelivery, delivery, po]);

  const existingGrnId = existingGrn?.id || (activeDelivery as any)?.grnId || (delivery as any)?.grnId || (po as any)?.grnId;
  const existingGrnNumber = existingGrn?.grnNumber;
  const hasExistingGrn = Boolean(existingGrnId || existingGrn);

  const effectiveIsBuyer = isBuyer !== undefined
    ? isBuyer
    : (user?.role === 'buyer' || (po?.buyerId && Number(user?.id) === Number(po.buyerId)));

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
  const statusUpdateMut = useManualDeliveryStatusUpdate(delivery?.id || 0);

  // Status advancement logic for post-dispatch flow
  const [isAdvancing, setIsAdvancing] = useState(false);
  const TRACKING_FLOW = ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
  const currentStatus = String(activeDelivery?.status || delivery?.status || '').toUpperCase();
  const nextStatus = useMemo(() => {
    if (currentStatus === 'DISPATCHED') return 'IN_TRANSIT';
    const idx = TRACKING_FLOW.findIndex(s => s === currentStatus);
    if (idx < 0 || idx >= TRACKING_FLOW.length - 1) return null;
    return TRACKING_FLOW[idx + 1];
  }, [currentStatus]);

  const handleAdvanceStatus = async () => {
    if (!nextStatus || isAdvancing) return;
    setIsAdvancing(true);
    await runWithToast(
      async () => {
        await statusUpdateMut.mutateAsync({
          status: nextStatus as any,
          remarks: remarks.trim() || undefined,
          occurredAt: new Date().toISOString()
        });
        await invalidateDeliveryCache(qc, delivery.id);
        if (onSuccess) onSuccess();
      },
      {
        loading: `Advancing status to ${nextStatus.replace(/_/g, ' ')}...`,
        success: `Status updated to ${nextStatus.replace(/_/g, ' ')}!`,
        error: (err: any) => err?.message || 'Status update failed'
      }
    );
    setIsAdvancing(false);
  };

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
            const match = list.find(
              (i: any) =>
                (poId && Number(i.purchaseOrderId) === Number(poId)) ||
                (poNo && i.purchaseOrder?.poNumber === poNo) ||
                (delivery?.id && Number(i.deliveryId) === Number(delivery.id)) ||
                (poNo && i.invoiceNumber && i.invoiceNumber.includes(poNo))
            );
            if (match) {
              if (match.id) {
                try {
                  const detailRes = await api.fetch(`/api/invoices/${match.id}`);
                  if (detailRes.ok) {
                    const detailData = await detailRes.json();
                    setFetchedInvoice(detailData?.invoice || detailData);
                    return;
                  }
                } catch {
                  // fallback to match
                }
              }
              setFetchedInvoice(match);
            } else {
              setFetchedInvoice(null);
            }
          }
        }
      } catch (err) {
        console.warn('Unable to fetch created invoice from API:', err);
      }
    };

    void loadCreatedInvoice();
  }, [isOpen, delivery]);

  // Determine if seller has generated an official invoice
  const hasGeneratedInvoice = useMemo(() => {
    return Boolean(
      fetchedInvoice?.id ||
      fetchedInvoice?.invoiceNumber ||
      (activeDelivery?.purchaseOrder?.invoices && activeDelivery.purchaseOrder.invoices.length > 0) ||
      (delivery?.purchaseOrder?.invoices && delivery.purchaseOrder.invoices.length > 0) ||
      existingInvoiceDoc
    );
  }, [fetchedInvoice, activeDelivery?.purchaseOrder?.invoices, delivery?.purchaseOrder?.invoices, existingInvoiceDoc]);

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
    const poVal = Number(activePo?.amount ?? activePo?.totalValue ?? delivery?.purchaseOrder?.amount ?? 0);
    const invoiceTotal = Number(fetchedInvoice?.totalAmount || fetchedInvoice?.amount || poVal || 0);
    const baseTaxableVal = Number(
      fetchedInvoice?.taxableAmount ||
      (invoiceTotal > 0 ? Number((invoiceTotal / 1.18).toFixed(2)) : 0)
    );

    const formatAddress = (...parts: (string | null | undefined)[]) => {
      const valid = parts.filter(
        p => p && typeof p === 'string' && p.trim().length > 0 && p.trim() !== 'null' && p.trim() !== 'undefined'
      );
      return valid.length > 0 ? valid.map(p => p!.trim()).join(', ') : '';
    };

    const sellerUser = fetchedInvoice?.seller || activePo?.seller;
    const sellerOrg = (sellerUser as any)?.organization || (sellerUser as any)?.sellerProfile?.organization;
    const sellerProfile = (sellerUser as any)?.sellerProfile || sellerOrg?.profile || (sellerUser as any)?.organizationProfile;
    const sellerReg = (sellerUser as any)?.registrationDetails || {};

    const sellerName = sellerOrg?.organizationName || sellerProfile?.businessName || sellerReg?.businessName || sellerReg?.companyName || sellerProfile?.nameAsInPan || sellerUser?.name || 'N/A';
    const sellerAddress = sellerProfile?.offices?.[0]?.address || sellerProfile?.registeredAddress || sellerReg?.registeredOfficeAddress || sellerReg?.address || formatAddress(sellerOrg?.addressLine1, sellerOrg?.addressLine2, sellerOrg?.city, sellerOrg?.district, sellerOrg?.state, sellerOrg?.pincode) || formatAddress(sellerReg?.addressLine1, sellerReg?.addressLine2, sellerReg?.city, sellerReg?.state, sellerReg?.pincode) || 'N/A';
    const sellerGstin = sellerOrg?.gstin || sellerProfile?.offices?.[0]?.gstNumber || sellerProfile?.gstNumber || sellerProfile?.gstMasked || sellerReg?.gstin || sellerReg?.gstDetails?.gstin || sellerReg?.gst || '';
    const sellerPhone = sellerUser?.mobile || sellerProfile?.mobile || sellerReg?.mobile || sellerReg?.phone || '';
    const sellerEmail = sellerUser?.email || sellerProfile?.officialEmail || sellerProfile?.email || sellerReg?.email || '';
    const sellerCin = sellerOrg?.cinNumber || sellerOrg?.cin || sellerProfile?.cinNumber || sellerProfile?.cin || sellerReg?.cin || '';

    const sellerLogo = sellerReg?.logoUrl || sellerOrg?.profile?.logoUrl || (sellerOrg?.organizationLogoFileId ? `/api/files/${sellerOrg.organizationLogoFileId}/view` : null) || null;
    const sellerStamp = sellerReg?.stampUrl || null;
    const sellerSignature = sellerReg?.signatureUrl || null;

    const buyerUser = fetchedInvoice?.buyer || activePo?.buyer;
    const buyerOrg = (buyerUser as any)?.organization || (buyerUser as any)?.buyerProfile?.organization;
    const buyerProfile = (buyerUser as any)?.buyerProfile || buyerOrg?.profile || (buyerUser as any)?.organizationProfile;
    const buyerReg = (buyerUser as any)?.registrationDetails || {};

    const poDeliv = (activePo?.deliveryAddress as any);
    const buyerName = buyerOrg?.organizationName || buyerProfile?.businessName || buyerProfile?.organizationName || buyerReg?.businessName || buyerReg?.companyName || buyerUser?.name || 'N/A';
    const buyerAddress = poDeliv
      ? (typeof poDeliv === 'string' ? poDeliv : formatAddress(poDeliv?.addressLine1, poDeliv?.addressLine2, poDeliv?.city, poDeliv?.state, poDeliv?.pincode, poDeliv?.country || 'INDIA'))
      : (buyerProfile?.registeredAddress || buyerOrg?.address || buyerReg?.officeZoneName || buyerReg?.address || formatAddress(buyerOrg?.addressLine1, buyerOrg?.addressLine2, buyerOrg?.city, buyerOrg?.district, buyerOrg?.state, buyerOrg?.pincode) || 'N/A');
    const buyerPan = buyerOrg?.panNumber || buyerProfile?.pan || buyerProfile?.panNumber || buyerProfile?.panMasked || buyerReg?.pan || buyerReg?.orgPan || '';
    const buyerGstin = buyerOrg?.gstin || buyerProfile?.gst || buyerProfile?.gstNumber || buyerProfile?.gstMasked || buyerReg?.gstin || buyerReg?.gst || '';

    const rawItems: any[] = fetchedInvoice?.items || activePo?.items || [];
    const items: TaxInvoiceItem[] = rawItems.length > 0
      ? rawItems.map((item, idx) => {
          const qty = Number(item.quantity || 1);
          let price = Number(item.unitPrice || 0);
          let taxableAmt = Number(item.taxableAmount || 0);

          if (!taxableAmt && price > 0) {
            taxableAmt = Number((price * qty).toFixed(2));
          } else if (!taxableAmt && item.totalAmount) {
            taxableAmt = Number((Number(item.totalAmount) / 1.18).toFixed(2));
          }

          if (price === 0 && taxableAmt > 0 && qty > 0) {
            price = Number((taxableAmt / qty).toFixed(2));
          } else if (qty > 1 && invoiceTotal > 0 && (price * qty) > (invoiceTotal * 1.5)) {
            price = Number((price / qty).toFixed(2));
            taxableAmt = Number((price * qty).toFixed(2));
          }

          return {
            srNo: idx + 1,
            description: item.itemName || item.description || activePo?.title || 'Order Item',
            hsn: item.hsnCode || item.hsn || '-',
            qty,
            unit: item.unitOfMeasure || 'units',
            priceUnit: price || (taxableAmt / Math.max(qty, 1)),
            amount: taxableAmt || (price * qty)
          };
        })
      : [
          {
            srNo: 1,
            description: activePo?.title || `Purchase Order #${delivery?.purchaseOrderId}`,
            hsn: '-',
            qty: 1,
            priceUnit: baseTaxableVal,
            amount: baseTaxableVal
          }
        ];

    let computedTaxable = 0;
    items.forEach(it => {
      computedTaxable += Number(it.amount) || 0;
    });
    const subtotal = fetchedInvoice?.taxableAmount
      ? Number(fetchedInvoice.taxableAmount)
      : (computedTaxable > 0 ? Number(computedTaxable.toFixed(2)) : baseTaxableVal);

    // Interstate detection based on GSTIN codes or different registered states
    const sellerGstinCode = (sellerGstin || '').trim().substring(0, 2);
    const buyerGstinCode = (buyerGstin || '').trim().substring(0, 2);
    const hasDifferentGstCodes = /^\d{2}$/.test(sellerGstinCode) && /^\d{2}$/.test(buyerGstinCode) && sellerGstinCode !== buyerGstinCode;
    const hasDifferentStates = Boolean(
      (sellerProfile?.state || sellerReg?.state) &&
      (buyerProfile?.state || buyerReg?.state) &&
      String(sellerProfile?.state || sellerReg?.state).trim().toLowerCase() !== String(buyerProfile?.state || buyerReg?.state).trim().toLowerCase()
    );
    const isInterstate = Boolean(fetchedInvoice?.interstate || Number(fetchedInvoice?.igstAmount) > 0 || hasDifferentGstCodes || hasDifferentStates);

    const buyerStateName = buyerProfile?.state || buyerReg?.state || (buyerGstinCode === '21' ? 'Odisha' : 'Other State');
    const placeOfSupply = isInterstate
      ? `${buyerStateName}${buyerGstinCode ? ` (${buyerGstinCode})` : ''} - Inter-State (IGST)`
      : `${sellerProfile?.state || sellerReg?.state || 'Maharashtra'} - State (CGST + SGST)`;

    const cgstAmount = isInterstate ? undefined : (fetchedInvoice?.cgstAmount !== undefined && fetchedInvoice?.cgstAmount !== null ? Number(fetchedInvoice.cgstAmount) : Math.round(subtotal * 0.09 * 100) / 100);
    const sgstAmount = isInterstate ? undefined : (fetchedInvoice?.sgstAmount !== undefined && fetchedInvoice?.sgstAmount !== null ? Number(fetchedInvoice.sgstAmount) : Math.round(subtotal * 0.09 * 100) / 100);
    const igstAmount = isInterstate ? (fetchedInvoice?.igstAmount !== undefined && fetchedInvoice?.igstAmount !== null && Number(fetchedInvoice.igstAmount) > 0 ? Number(fetchedInvoice.igstAmount) : Math.round(subtotal * 0.18 * 100) / 100) : undefined;

    const grandTotal = (fetchedInvoice?.totalAmount || fetchedInvoice?.amount)
      ? Number(fetchedInvoice.totalAmount || fetchedInvoice.amount)
      : (isInterstate
          ? Math.round((subtotal + (igstAmount || 0)) * 100) / 100
          : Math.round((subtotal + (cgstAmount || 0) + (sgstAmount || 0)) * 100) / 100);

    const bankName = sellerReg?.bankDetails?.bankName || sellerReg?.bankName || sellerProfile?.bankAccounts?.[0]?.bankName || sellerProfile?.bankName || 'Kotak Mahindra Bank';
    const accountNo = sellerReg?.bankDetails?.accountNumber || sellerReg?.accountNumber || sellerProfile?.bankAccounts?.[0]?.accountNumberMasked || sellerProfile?.bankAccounts?.[0]?.accountNumber || sellerProfile?.bankAccountNo || 'N/A';
    const ifscCode = sellerReg?.bankDetails?.ifscCode || sellerReg?.ifscCode || sellerProfile?.bankAccounts?.[0]?.ifsc || sellerProfile?.bankAccounts?.[0]?.ifscCode || sellerProfile?.bankIfsc || 'N/A';
    const accountName = sellerReg?.bankDetails?.accountHolderName || sellerReg?.accountHolderName || sellerProfile?.bankAccounts?.[0]?.holderName || sellerProfile?.accountHolderName || sellerProfile?.businessName || sellerName;

    return {
      invoiceNumber: invNo,
      invoiceDate: dateStr,
      dueDate: dateStr,
      dateStr,
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
        name: buyerName,
        address: buyerAddress,
        pan: buyerPan,
        gstin: buyerGstin
      },
      shipTo: {
        name: buyerName,
        address: buyerAddress
      },
      items,
      subtotal,
      cgstRate: isInterstate ? undefined : 9,
      cgstAmount,
      sgstRate: isInterstate ? undefined : 9,
      sgstAmount,
      igstRate: isInterstate ? 18 : undefined,
      igstAmount,
      totalAmount: grandTotal,
      bankDetails: {
        bankName,
        accountNo,
        ifscCode,
        accountName
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

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (!isOpen) return null;

  const rawItems: any[] = (po as any)?.items || [];
  const totalUnits = rawItems.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
  const poCommercialAmount = Number(
    (po as any)?.amount ?? (po as any)?.totalValue ?? delivery?.purchaseOrder?.amount ?? 0
  );
  const orderTotal = poCommercialAmount > 0 ? poCommercialAmount : Number(invData.totalAmount || 0);
  const consigneeOrgName =
    (po as any)?.buyer?.organization?.organizationName || (po as any)?.buyer?.name || 'Registered Consignee';
  const consigneeAddress =
    (po as any)?.deliveryAddress || (po as any)?.buyer?.organization?.address || activeDelivery?.currentLocation || 'Consignee Delivery Address';
  const carrierTrackingUrl = getCarrierTrackingUrl(carrierName, trackingNumber);

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
              <div className="flex items-center gap-2 flex-wrap">
                {effectiveIsBuyer ? (
                  <span className="rounded bg-sky-500/30 border border-sky-400/50 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                    Buyer Tracking Portal
                  </span>
                ) : isAlreadyDispatched ? (
                  <span className="rounded bg-emerald-500/30 border border-emerald-400/50 px-2 py-0.5 text-[10px] font-bold text-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    Dispatched &amp; Locked
                  </span>
                ) : (
                  <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    Dispatch &amp; Fulfillment Console
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
                <span className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                  isAlreadyDispatched ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/40" : "bg-amber-500/30 text-amber-200 border border-amber-400/40"
                )}>
                  {labelFor(delivery.status)}
                </span>
              </div>
              <h2 id="dispatch-dialog-title" className="mt-0.5 text-base sm:text-lg font-black tracking-tight text-white line-clamp-1">
                {effectiveIsBuyer
                  ? (po?.title ? `Consignment Tracking: ${po.title}` : 'Consignment Tracking & Logistics')
                  : (po?.title || 'Order Fulfillment & Logistics Dispatch')}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRefreshDispatch}
              disabled={isRefreshingDispatch}
              title="Refresh dispatch details"
              aria-label="Refresh dispatch details"
              className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
            >
              <RefreshCw className={cn("h-5 w-5", isRefreshingDispatch && "animate-spin")} />
            </button>
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
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-5 sm:p-6 space-y-6 text-left">
          {/* Top Commercial & Consignee Summary (Common to all roles) */}
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

          {effectiveIsBuyer ? (
            /* ========================================================================= */
            /* BUYER TRACKING & LOGISTICS VIEW (READ-ONLY, CONTEXTUAL, NO EDITABLE FORM) */
            /* ========================================================================= */
            <>
              {/* Status Alert Banner */}
              {(delivery.status === 'DELIVERED' || String(activeDelivery?.status || '').toUpperCase() === 'DELIVERED') ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 flex items-start gap-3.5 shadow-2xs">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-black text-emerald-950 text-sm">
                      Consignment Delivered at Consignee Destination
                    </p>
                    <p className="text-emerald-800 text-[11px] leading-relaxed font-medium">
                      The carrier has completed delivery of the physical packages. Please conduct a physical verification of the goods and proceed to generate the formal Goods Receipt Note (GRN) to complete receiving inspection.
                    </p>
                  </div>
                </div>
              ) : isAlreadyDispatched ? (
                <div className="rounded-xl border border-blue-300 bg-blue-50/90 p-4 flex items-start gap-3.5 shadow-2xs">
                  <Truck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-black text-blue-950 text-sm">
                      Consignment Dispatched &amp; In Transit
                    </p>
                    <p className="text-blue-800 text-[11px] leading-relaxed font-medium">
                      The seller has dispatched the consignment via <strong>{carrierName || 'the assigned logistics partner'}</strong>. Live tracking credentials, vehicle details, and waybill documents are listed below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 flex items-start gap-3.5 shadow-2xs">
                  <Package className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-black text-amber-950 text-sm">
                      Seller Preparing &amp; Packaging Order
                    </p>
                    <p className="text-amber-800 text-[11px] leading-relaxed font-medium">
                      The seller has accepted this Purchase Order and is packaging the units for logistics dispatch. Real-time carrier waybill credentials, driver contact details, and transit documents will appear here automatically as soon as the consignment is handed over to the courier.
                    </p>
                  </div>
                </div>
              )}

              {/* Carrier & Tracking Credentials Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[#12335f]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Carrier &amp; Logistics Tracking Credentials
                    </h3>
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold px-2.5 py-0.5 rounded-full border",
                    isAlreadyDispatched
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-amber-700 bg-amber-50 border-amber-200"
                  )}>
                    {isAlreadyDispatched ? 'Active Waybill' : 'Awaiting Seller Dispatch'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Carrier */}
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Carrier Partner
                    </span>
                    <p className="text-xs font-black text-slate-900 truncate">
                      {carrierName || 'Pending Assignment'}
                    </p>
                    {carrierTrackingUrl && (
                      <a
                        href={carrierTrackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline pt-0.5"
                      >
                        Track on Carrier Site <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>

                  {/* Tracking / AWB */}
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Tracking / AWB / LR
                    </span>
                    {trackingNumber ? (
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-black text-blue-900 truncate">
                          {trackingNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(trackingNumber, 'AWB / Tracking Number')}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                          title="Copy Tracking Number"
                          aria-label="Copy Tracking Number"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Not yet assigned</p>
                    )}
                  </div>

                  {/* ETA */}
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Expected Delivery (ETA)
                    </span>
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      {eta ? formatDate(eta) : 'Pending Schedule'}
                    </p>
                  </div>

                  {/* Mode & Vehicle */}
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Mode &amp; Vehicle
                    </span>
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {transportMode || 'Road Freight'}
                      {vehicleNumber && (
                        <span className="font-mono text-[10px] text-slate-500 block truncate">
                          {vehicleNumber}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Driver & Contact & E-Way Bill */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-100">
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Driver / Dispatch Agent
                    </span>
                    <p className="text-xs font-bold text-slate-800">
                      {driverName || 'Not Assigned'}
                    </p>
                    {driverPhone && (
                      <a
                        href={`tel:${driverPhone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline pt-0.5"
                      >
                        <Phone className="h-3 w-3 text-blue-600" />
                        {driverPhone}
                      </a>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Statutory E-Way Bill (Rule 138)
                    </span>
                    {ewayBillNumber ? (
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-black text-emerald-800">
                          {ewayBillNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(ewayBillNumber, 'E-Way Bill Number')}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                          title="Copy E-Way Bill"
                          aria-label="Copy E-Way Bill"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">
                        {orderTotal >= 50000 ? 'Pending generation by seller' : 'Exempt (< ₹50,000 threshold)'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Transit Milestones Timeline */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#12335f]" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Fulfillment &amp; Transit Milestones
                    </h4>
                  </div>
                  <span className="text-[9px] font-medium text-slate-500">Live Status Audit</span>
                </div>
                <DeliveryTimeline
                  status={activeDelivery?.status || delivery?.status}
                  events={activeDelivery?.events || delivery?.events}
                  statusLogs={activeDelivery?.statusLogs || delivery?.statusLogs}
                />
              </div>

              {/* Transit Documents Section */}
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
                  {existingChallanDoc ? (
                    <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50/70 p-2.5 text-xs">
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
                          className="h-8 text-xs font-bold text-purple-800 border-purple-300 bg-white hover:bg-purple-100"
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" /> View / Download
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                      Delivery Challan will be available once uploaded by the seller upon dispatch.
                    </div>
                  )}
                </div>

                {/* Tax Invoice (Only shown if generated by seller) */}
                {hasGeneratedInvoice && (
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
                        <p className="text-[10px] text-slate-500 font-semibold">{formatCurrency(invData.totalAmount)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateAndAttachPdf('Original Copy', 'download')}
                          disabled={isGeneratingInvoice}
                          className="h-8 text-xs font-bold border-slate-300 hover:bg-slate-50"
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateAndAttachPdf('Original Copy', 'print')}
                          disabled={isGeneratingInvoice}
                          className="h-8 text-xs font-bold border-slate-300 hover:bg-slate-50"
                        >
                          <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ========================================================================= */
            /* SELLER FULFILLMENT CONSOLE (EDITABLE FORM, LOGISTICS SUBMISSION)          */
            /* ========================================================================= */
            <>
              {/* Dispatch Already Confirmed Locked Banner */}
              {isAlreadyDispatched && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 flex items-start gap-3.5 shadow-2xs">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-black text-emerald-950 text-sm">
                      Dispatch Details Confirmed &amp; Locked
                    </p>
                    <p className="text-emerald-800 text-[11px] leading-relaxed font-medium">
                      Waybill credentials, carrier partner, driver contacts, and consignment logistics have already been submitted and synchronized with the buyer portal. To preserve logistics chain-of-custody and statutory compliance, dispatch details cannot be submitted or edited twice.
                    </p>
                  </div>
                </div>
              )}

              {/* Statutory Advisory */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-950">Statutory Logistics &amp; E-Way Bill Advisory</span>
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

              {/* Primary Shipment Logistics & Carrier Section */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[#12335f]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Carrier &amp; Logistics Information
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
                    <DateTimePicker
                      label="Dispatch Timestamp"
                      labelClassName="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500"
                      mode="datetime"
                      value={dispatchTimestamp}
                      onChange={val => setDispatchTimestamp(val)}
                      disabled={isAlreadyDispatched}
                      placeholder="Select dispatch date & time"
                    />
                  </div>

                  <div>
                    <DateTimePicker
                      label="Expected Delivery Date (ETA)"
                      labelClassName="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500"
                      mode="date"
                      value={eta}
                      onChange={val => setEta(val)}
                      disabled={isAlreadyDispatched}
                      placeholder="Select expected delivery date"
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

              {/* Delivery Challan & Tax Invoice Section */}
              <div className={cn("grid grid-cols-1 gap-4", hasGeneratedInvoice ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
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

                {/* Tax Invoice (Only shown if generated by seller) */}
                {hasGeneratedInvoice && (
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
                  </div>
                )}
              </div>

              {/* Fulfillment Remarks Section */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2">
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
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5 shrink-0">
          {effectiveIsBuyer ? (
            <>
              <div className="text-[11px] text-slate-500 font-medium">
                {(delivery.status === 'DELIVERED' || String(activeDelivery?.status || '').toUpperCase() === 'DELIVERED') ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Consignment delivered. Ready for goods inspection &amp; GRN generation.
                  </span>
                ) : isAlreadyDispatched ? (
                  <span className="text-blue-700 font-bold flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                    Consignment in transit with {carrierName || 'carrier partner'}.
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-amber-600 shrink-0" />
                    Consignment currently in preparation with the seller.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-9 rounded-xl border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </Button>
                {hasExistingGrn ? (
                  <Button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (existingGrnId) router.push(`/grn/${existingGrnId}`);
                      else router.push('/grn');
                    }}
                    className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    View GRN {existingGrnNumber ? `#${existingGrnNumber}` : ''}
                  </Button>
                ) : (
                  (delivery.status === 'DELIVERED' || String(activeDelivery?.status || '').toUpperCase() === 'DELIVERED') && onOpenGrnCreate && (
                    <Button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenGrnCreate();
                      }}
                      className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Inspect Goods &amp; Create GRN
                    </Button>
                  )
                )}
              </div>
            </>
          ) : (
            <>
              {isAlreadyDispatched ? (
                <div className="text-[11px] font-bold flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-slate-700">
                    Current: <strong className="text-slate-900 uppercase">{currentStatus.replace(/_/g, ' ')}</strong>
                    {nextStatus && <span className="text-blue-700"> → Next: <strong className="uppercase">{nextStatus.replace(/_/g, ' ')}</strong></span>}
                    {!nextStatus && <span className="text-emerald-700"> — Delivery Complete</span>}
                  </span>
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
                  nextStatus ? (
                    <Button
                      type="button"
                      onClick={handleAdvanceStatus}
                      disabled={isAdvancing || statusUpdateMut.isPending}
                      className="h-9 rounded-xl bg-[#12335f] px-5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#0b2447] shadow-xs cursor-pointer"
                    >
                      {isAdvancing || statusUpdateMut.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Truck className="mr-2 h-4 w-4" />
                          Update → {nextStatus.replace(/_/g, ' ')}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled
                      className="h-9 rounded-xl bg-emerald-50 border border-emerald-200 px-5 text-xs font-bold text-emerald-700 cursor-not-allowed shadow-none flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Delivered ✓
                    </Button>
                  )
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
                        Save &amp; Confirm Dispatch
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
