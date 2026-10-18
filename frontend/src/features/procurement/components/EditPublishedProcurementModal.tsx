'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Pencil,
  X,
  Loader2,
  AlertTriangle,
  Calendar,
  MapPin,
  Package,
  IndianRupee,
  FileText,
  Plus,
  Trash2,
  Building,
  CheckCircle2,
  Truck,
  ShieldCheck,
  CreditCard,
  Layers,
  Wrench,
  Clock
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ConfirmOneTimeEditModal } from './ConfirmOneTimeEditModal';
import { putApi } from '../../shared/apiClient';
import { fetchDeliveryAddresses, type DeliveryAddressDto } from '../../directPurchase/api';
import { UNIT_OPTIONS, PAYMENT_TERM_OPTIONS, DELIVERY_TYPE_OPTIONS } from '../../procurementWizard/procurementOptions';
import { toast } from 'sonner';

export type ProcurementCategoryType = 'GOODS' | 'SERVICES' | 'WORKS';
export type ProcurementPricingFormat = 'SINGLE_ITEM' | 'BOQ' | 'SOR';

export interface BoqLineItem {
  id?: string | number;
  itemCode?: string;
  itemName: string;
  description?: string;
  hsnCode?: string;
  quantity: number | string;
  unitOfMeasure: string;
  estimatedUnitPrice?: number | string;
  estimatedTotal?: number | string;
}

export interface EditPublishedProcurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  procurement: {
    id: number | string;
    referenceNumber?: string;
    title?: string;
    description?: string;
    category?: string;
    categoryType?: ProcurementCategoryType | string;
    pricingFormat?: ProcurementPricingFormat | string;
    canonicalMethod?: string;
    quantity?: string | number;
    unit?: string;
    estimatedValue?: number | string;
    deliveryLocation?: string;
    state?: string;
    district?: string;
    pincode?: string;
    endDate?: string | Date;
    termsAndConditions?: string[];
    technicalPacket?: Record<string, any> | null;
    financialPacket?: Record<string, any> | null;
    items?: any[];
    hsnCode?: string;
    brandPreference?: string;
    makeBrand?: string;
  } | null;
  onSuccess?: () => void | Promise<void>;
}

const INCOTERMS_OPTIONS = [
  { value: 'FOR_DESTINATION', label: 'FOR Destination (Freight & Transit Insurance Included)' },
  { value: 'EX_WORKS', label: 'Ex-Works (Buyer arranged transportation)' },
  { value: 'FOB', label: 'FOB - Free on Board' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
  { value: 'DOOR_DELIVERY', label: 'Door Delivery to Consignee Site' }
];

const INSPECTION_OPTIONS = [
  { value: 'CONSIGNEE_END', label: 'Consignee End Inspection (Upon receipt at site)' },
  { value: 'PRE_DISPATCH', label: 'Pre-dispatch Inspection at Seller Works' },
  { value: 'TPI_RITES', label: 'Third Party Inspection - RITES / SGS / TUV' },
  { value: 'SELF_CERTIFICATION', label: 'OEM Self-Certification with MTC / Test Certificate' },
  { value: 'NOT_APPLICABLE', label: 'Not Applicable / Standard Commercial' }
];

export function EditPublishedProcurementModal({
  isOpen,
  onClose,
  procurement,
  onSuccess
}: EditPublishedProcurementModalProps) {
  // Method, Category & Format
  const [categoryType, setCategoryType] = useState<ProcurementCategoryType>('GOODS');
  const [pricingFormat, setPricingFormat] = useState<ProcurementPricingFormat>('SINGLE_ITEM');

  // Core Basic Information
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [endDate, setEndDate] = useState('');

  // Single Item Goods specific
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('NOS');
  const [hsnCode, setHsnCode] = useState('');
  const [brandPreference, setBrandPreference] = useState('');

  // Multi-line BOQ items
  const [boqItems, setBoqItems] = useState<BoqLineItem[]>([]);

  // Services (SOW) specific
  const [contractDurationMonths, setContractDurationMonths] = useState('');
  const [slaRequirements, setSlaRequirements] = useState('');
  const [deliverablesSummary, setDeliverablesSummary] = useState('');

  // Works (SOR) specific
  const [workSiteLocation, setWorkSiteLocation] = useState('');
  const [defectLiabilityPeriod, setDefectLiabilityPeriod] = useState('');

  // Address Book & Consignee Location
  const [deliveryAddresses, setDeliveryAddresses] = useState<DeliveryAddressDto[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('custom');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');

  // Commercial Dropdowns
  const [deliveryTerms, setDeliveryTerms] = useState(INCOTERMS_OPTIONS[0].value);
  const [inspectionMode, setInspectionMode] = useState(INSPECTION_OPTIONS[0].value);
  const [paymentTerms, setPaymentTerms] = useState(PAYMENT_TERM_OPTIONS[0]);
  const [terms, setTerms] = useState('');

  // Modal / submission state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper: Format address for display/storage
  const formatAddressString = (addr: DeliveryAddressDto): string => {
    const street = [addr.addressLine1, addr.addressLine2].filter(Boolean).map(s => s?.trim()).filter(Boolean).join(', ');
    const locParts = [addr.city?.trim(), addr.district?.trim(), addr.state?.trim()].filter(Boolean).join(', ');
    const pin = addr.pincode ? ` - ${addr.pincode.trim()}` : '';
    return `${street}${street && locParts ? ', ' : ''}${locParts}${pin}`;
  };

  // Load saved delivery addresses
  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      setLoadingAddresses(true);
      fetchDeliveryAddresses()
        .then(res => {
          if (isMounted && res) {
            setDeliveryAddresses(res);
          }
        })
        .catch(err => {
          console.warn('Failed to load delivery addresses in edit modal:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingAddresses(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen]);

  // Synchronize state when procurement data is supplied
  useEffect(() => {
    if (procurement && isOpen) {
      const tp = (procurement.technicalPacket || {}) as any;
      const fp = (procurement.financialPacket || {}) as any;

      // Detect category
      const detectedCat: ProcurementCategoryType =
        (procurement.categoryType?.toUpperCase() as ProcurementCategoryType) ||
        (tp?.basics?.procurementCategory?.toUpperCase() as ProcurementCategoryType) ||
        (procurement.category?.toLowerCase().includes('service') ? 'SERVICES' :
         procurement.category?.toLowerCase().includes('work') ? 'WORKS' : 'GOODS');
      setCategoryType(detectedCat);

      // Detect pricing format
      const detectedFormat: ProcurementPricingFormat =
        (procurement.pricingFormat?.toUpperCase() as ProcurementPricingFormat) ||
        (tp?.basics?.pricingFormat?.toUpperCase() as ProcurementPricingFormat) ||
        (tp?.items && Array.isArray(tp.items) && tp.items.length > 1 ? 'BOQ' : 'SINGLE_ITEM');
      setPricingFormat(detectedFormat);

      setTitle(procurement.title || '');
      setDescription(procurement.description || tp?.basics?.scopeDescription || '');
      setCategoryName(procurement.category || tp?.basics?.categoryName || 'General Procurement');

      // Scalar Quantity and Unit
      const firstItem = (tp?.items && tp.items[0]) || (procurement.items && procurement.items[0]) || (fp?.boqSchedule && fp.boqSchedule[0]) || {};

      // Parse numeric quantity
      let resolvedQty = '';
      if (procurement.quantity !== undefined && procurement.quantity !== null && String(procurement.quantity).toLowerCase() !== 'not specified') {
        const qtyMatch = String(procurement.quantity).match(/[\d.]+/);
        if (qtyMatch) resolvedQty = qtyMatch[0];
      }
      if (!resolvedQty && firstItem?.quantity !== undefined && firstItem?.quantity !== null) {
        const qtyMatch = String(firstItem.quantity).match(/[\d.]+/);
        if (qtyMatch) resolvedQty = qtyMatch[0];
      }
      if (!resolvedQty && tp?.basics?.quantity) {
        const qtyMatch = String(tp.basics.quantity).match(/[\d.]+/);
        if (qtyMatch) resolvedQty = qtyMatch[0];
      }
      setQuantity(resolvedQty);

      // Parse unit
      let resolvedUnit = procurement.unit || firstItem?.unitOfMeasure || firstItem?.unit || tp?.basics?.unit || '';
      if (!resolvedUnit && procurement.quantity) {
        const unitMatch = String(procurement.quantity).replace(/^[\d.\s]+/, '').trim();
        if (unitMatch) resolvedUnit = unitMatch;
      }
      const matchedUnitOption = UNIT_OPTIONS.find(opt => 
        opt.value.toUpperCase() === String(resolvedUnit).toUpperCase() ||
        opt.label.toUpperCase().startsWith(String(resolvedUnit).toUpperCase()) ||
        String(resolvedUnit).toUpperCase().startsWith(opt.value.toUpperCase())
      );
      setUnit(matchedUnitOption ? matchedUnitOption.value : (resolvedUnit ? String(resolvedUnit).toUpperCase() : 'NOS'));

      // Parse HSN / SAC Code
      const resolvedHsn = 
        firstItem?.hsnCode ||
        firstItem?.hsn ||
        firstItem?.hsnSac ||
        firstItem?.sac ||
        firstItem?.sacCode ||
        firstItem?.specifications?.hsnCode ||
        firstItem?.specifications?.hsn ||
        tp?.basics?.hsnCode ||
        tp?.basics?.hsn ||
        (procurement as any)?.hsnCode ||
        '';
      setHsnCode(String(resolvedHsn));

      // Parse Make / Brand Preference
      const resolvedBrand = 
        firstItem?.brandRequirement ||
        firstItem?.brand ||
        firstItem?.make ||
        firstItem?.brandPreference ||
        firstItem?.oemBrandName ||
        firstItem?.specifications?.brand ||
        firstItem?.specifications?.make ||
        tp?.specs?.brand ||
        tp?.basics?.makeBrand ||
        tp?.basics?.brandPreference ||
        tp?.basics?.brand ||
        (procurement as any)?.brandPreference ||
        '';
      setBrandPreference(String(resolvedBrand));

      // Budget
      setEstimatedValue(procurement.estimatedValue ? String(procurement.estimatedValue) : (fp?.estimatedBudget ? String(fp.estimatedBudget) : ''));

      // End Date
      if (procurement.endDate) {
        try {
          const d = new Date(procurement.endDate);
          if (!isNaN(d.getTime())) {
            const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setEndDate(iso);
          }
        } catch {
          setEndDate('');
        }
      } else {
        setEndDate('');
      }

      // BOQ Line items
      const rawLineItems = tp?.items || procurement.items || fp?.boqSchedule || [];
      if (Array.isArray(rawLineItems) && rawLineItems.length > 0) {
        setBoqItems(rawLineItems.map((it: any, idx: number) => ({
          id: it.id || `line-${idx + 1}`,
          itemCode: it.itemCode || `ITM-${idx + 1}`,
          itemName: it.itemName || it.name || `Item ${idx + 1}`,
          description: it.description || '',
          hsnCode: it.hsnCode || it.hsn || it.hsnSac || '',
          quantity: it.quantity || 1,
          unitOfMeasure: it.unitOfMeasure || it.unit || 'NOS',
          estimatedUnitPrice: it.estimatedUnitPrice || it.unitPrice || '',
          estimatedTotal: it.estimatedTotal || ''
        })));
      } else {
        setBoqItems([
          {
            id: 'line-1',
            itemCode: 'ITM-01',
            itemName: procurement.title || 'Item 1',
            quantity: resolvedQty ? Number(resolvedQty) : 1,
            unitOfMeasure: matchedUnitOption ? matchedUnitOption.value : (resolvedUnit ? String(resolvedUnit).toUpperCase() : 'NOS'),
            hsnCode: String(resolvedHsn),
            estimatedUnitPrice: ''
          }
        ]);
      }

      // Services fields
      setContractDurationMonths(String(tp?.service?.durationMonths || tp?.basics?.durationMonths || '12'));
      setSlaRequirements(tp?.service?.slaRequirements || tp?.specs?.sla || '');
      setDeliverablesSummary(tp?.service?.deliverables || '');

      // Works fields
      setWorkSiteLocation(tp?.works?.siteLocation || procurement.deliveryLocation || '');
      setDefectLiabilityPeriod(String(tp?.works?.defectLiabilityPeriodMonths || '12'));

      // Locations
      const curLoc = procurement.deliveryLocation || '';
      setDeliveryLocation(curLoc);
      setState(procurement.state || '');
      setDistrict(procurement.district || '');
      setPincode(procurement.pincode || '');

      // Commercial Terms
      const pTerms = fp?.paymentTerms || tp?.terms?.paymentTerms || PAYMENT_TERM_OPTIONS[0];
      setPaymentTerms(pTerms);

      const dTerms = tp?.terms?.deliveryTerms || INCOTERMS_OPTIONS[0].value;
      setDeliveryTerms(dTerms);

      const insp = tp?.terms?.inspectionMode || tp?.specs?.inspectionMode || INSPECTION_OPTIONS[0].value;
      setInspectionMode(insp);

      setTerms(Array.isArray(procurement.termsAndConditions) ? procurement.termsAndConditions.join('\n') : '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [procurement, isOpen]);

  // Handle Delivery Address Selection
  const handleSelectAddress = (val: string) => {
    setSelectedAddressId(val);
    if (val === 'custom') {
      return;
    }
    const found = deliveryAddresses.find(a => String(a.id) === String(val));
    if (found) {
      setDeliveryLocation(formatAddressString(found));
      setState(found.state || '');
      setDistrict(found.district || '');
      setPincode(found.pincode || '');
    }
  };

  // Add a line item to BOQ
  const handleAddBoqItem = () => {
    const nextIdx = boqItems.length + 1;
    setBoqItems(prev => [
      ...prev,
      {
        id: `line-${Date.now()}-${nextIdx}`,
        itemCode: `ITM-${String(nextIdx).padStart(2, '0')}`,
        itemName: '',
        description: '',
        hsnCode: '',
        quantity: 1,
        unitOfMeasure: 'NOS',
        estimatedUnitPrice: ''
      }
    ]);
  };

  // Remove a line item from BOQ
  const handleRemoveBoqItem = (idx: number) => {
    if (boqItems.length <= 1) {
      toast.error('At least one item is required in the schedule.');
      return;
    }
    setBoqItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Update BOQ line item field
  const handleUpdateBoqItem = (idx: number, field: keyof BoqLineItem, value: any) => {
    setBoqItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  // Calculate sum of BOQ items if unit prices entered
  const computedBoqTotal = useMemo(() => {
    let sum = 0;
    for (const item of boqItems) {
      const q = Number(item.quantity) || 0;
      const p = Number(item.estimatedUnitPrice) || 0;
      if (q > 0 && p > 0) {
        sum += q * p;
      }
    }
    return sum;
  }, [boqItems]);

  if (!isOpen || !procurement) return null;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Scope Description must be at least 10 characters.');
      return;
    }
    if (deliveryLocation.trim().length < 2) {
      setError('Delivery / Site location is required.');
      return;
    }

    if (pricingFormat === 'BOQ') {
      if (boqItems.length === 0) {
        setError('At least one line item is required in the BOQ schedule.');
        return;
      }
      for (let i = 0; i < boqItems.length; i++) {
        if (!boqItems[i].itemName.trim()) {
          setError(`Item #${i + 1} must have a valid item name.`);
          return;
        }
        if (Number(boqItems[i].quantity) <= 0) {
          setError(`Item #${i + 1} quantity must be greater than zero.`);
          return;
        }
      }
    } else if (categoryType === 'GOODS') {
      if (quantity && Number(quantity) <= 0) {
        setError('Required quantity must be greater than zero.');
        return;
      }
    }

    if (endDate) {
      const ed = new Date(endDate);
      if (ed <= new Date()) {
        setError('Submission deadline must be in the future.');
        return;
      }
    }

    setConfirmModalOpen(true);
  };

  const handleExecuteSave = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Construct deeply integrated packets
      const baseTechnicalPacket = { ...(procurement.technicalPacket || {}) };
      const baseFinancialPacket = { ...(procurement.financialPacket || {}) };

      // Update technical items
      let finalItems = boqItems;
      if (pricingFormat === 'SINGLE_ITEM') {
        finalItems = [
          {
            id: 'line-1',
            itemCode: 'ITM-01',
            itemName: title.trim(),
            description: description.trim(),
            hsnCode: hsnCode.trim(),
            quantity: quantity ? Number(quantity) : 1,
            unitOfMeasure: unit || 'NOS',
            estimatedUnitPrice: estimatedValue && quantity ? (Number(estimatedValue) / Number(quantity)) : undefined
          }
        ];
      }

      baseTechnicalPacket.items = finalItems;
      baseTechnicalPacket.basics = {
        ...(baseTechnicalPacket.basics || {}),
        title: title.trim(),
        scopeDescription: description.trim(),
        procurementCategory: categoryType,
        pricingFormat: pricingFormat,
        deliveryLocation: deliveryLocation.trim(),
        pincode: pincode.trim(),
        state: state.trim(),
        district: district.trim(),
        makeBrand: brandPreference.trim()
      };

      baseTechnicalPacket.terms = {
        ...(baseTechnicalPacket.terms || {}),
        deliveryTerms,
        inspectionMode,
        paymentTerms
      };

      if (categoryType === 'SERVICES') {
        baseTechnicalPacket.service = {
          durationMonths: contractDurationMonths,
          slaRequirements,
          deliverables: deliverablesSummary
        };
      } else if (categoryType === 'WORKS') {
        baseTechnicalPacket.works = {
          siteLocation: workSiteLocation || deliveryLocation,
          defectLiabilityPeriodMonths: defectLiabilityPeriod
        };
      }

      const budgetVal = estimatedValue ? Number(estimatedValue) : (computedBoqTotal > 0 ? computedBoqTotal : undefined);
      baseFinancialPacket.estimatedBudget = budgetVal;
      baseFinancialPacket.paymentTerms = paymentTerms;

      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        categoryType,
        pricingFormat,
        deliveryLocation: deliveryLocation.trim(),
        state: state.trim() || undefined,
        district: district.trim() || undefined,
        pincode: pincode.trim() || undefined,
        technicalPacket: baseTechnicalPacket,
        financialPacket: baseFinancialPacket
      };

      if (pricingFormat === 'SINGLE_ITEM') {
        if (quantity) payload.quantity = Number(quantity);
        if (unit) payload.unit = unit.trim();
      } else {
        payload.quantity = boqItems.length;
        payload.unit = 'Line Items';
      }

      if (budgetVal !== undefined) {
        payload.estimatedValue = budgetVal;
      }

      if (endDate) payload.endDate = new Date(endDate).toISOString();
      if (terms.trim()) {
        payload.termsAndConditions = terms
          .split('\n')
          .map(t => t.trim())
          .filter(Boolean);
      }

      await putApi(`/api/buyer/procurement-bids/${procurement.id}`, payload);

      toast.success('Procurement updated successfully', {
        description: 'Grace edit utilized. Standardized specifications have been synchronized.'
      });

      setConfirmModalOpen(false);
      onClose();
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update procurement. Please try again.');
      setConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs transition-opacity duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-procurement-modal-title"
      >
        <div className="w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shrink-0 shadow-xs">
                <Pencil className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="edit-procurement-modal-title" className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                    Edit Published Procurement
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
                    {procurement.canonicalMethod || 'TENDER'}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-extrabold text-blue-700 border border-blue-200">
                    {categoryType}
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-700 border border-indigo-200">
                    {pricingFormat === 'BOQ' ? 'Multi-line BOQ' : pricingFormat === 'SOR' ? 'Schedule of Rates' : 'Single Item'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Ref: <span className="font-mono font-bold text-slate-700">{procurement.referenceNumber || `#${procurement.id}`}</span> • Category: <span className="font-semibold text-slate-800">{categoryName}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Grace Notice Callout */}
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <p className="leading-relaxed font-medium">
              <strong>One-Time Grace Edit Window (GFR 173):</strong> You are allowed <strong>exactly 1 post-publication edit</strong> within the 6-hour grace window prior to bids opening. Any changes made here immediately recalculate technical requirements and update matching suppliers.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleOpenConfirm} className="space-y-6">
            {/* SECTION 1: Category & Pricing Format Config */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-500" />
                Procurement Classification &amp; Pricing Architecture
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Procurement Category Type <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={categoryType}
                    onChange={e => setCategoryType(e.target.value as ProcurementCategoryType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="GOODS">GOODS - Physical Products, Machinery &amp; Consumables</option>
                    <option value="SERVICES">SERVICES - SOW, Consulting, IT &amp; Facility Management</option>
                    <option value="WORKS">WORKS - Civil Contracts, EPC, Schedule of Rates (SOR)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Pricing &amp; Line-Item Format <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={pricingFormat}
                    onChange={e => setPricingFormat(e.target.value as ProcurementPricingFormat)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="SINGLE_ITEM">Single Item / Turnkey Lump Sum Quote</option>
                    <option value="BOQ">Multi-line BOQ (Bill of Quantities Schedule)</option>
                    <option value="SOR">Schedule of Rates (SOR Rate Card Contract)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: General Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <FileText className="h-4 w-4 text-blue-600" />
                General Tender Information
              </h3>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Procurement Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Supply of Industrial Bearings / Facility Management Services"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Scope Description &amp; Specifications <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  placeholder="Provide detailed technical specifications, operational parameters, or service scope requirements..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                    Estimated Total Budget (INR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={estimatedValue}
                    onChange={e => setEstimatedValue(e.target.value)}
                    placeholder={pricingFormat === 'BOQ' && computedBoqTotal > 0 ? `Calculated from BOQ: ₹${computedBoqTotal.toLocaleString('en-IN')}` : 'e.g. 500000'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  {pricingFormat === 'BOQ' && computedBoqTotal > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Sum of BOQ unit prices: <span className="font-bold text-emerald-700">₹{computedBoqTotal.toLocaleString('en-IN')}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    Submission Deadline <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Dynamic Category Specific Section */}
            {categoryType === 'GOODS' && pricingFormat === 'SINGLE_ITEM' && (
              <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-200/80 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-blue-600" />
                  Product Specifications &amp; Quantity (Single Item)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Required Quantity <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Unit of Measurement (UoM) <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {UNIT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      HSN Code (Indian Customs / GST)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={hsnCode}
                      onChange={e => setHsnCode(e.target.value)}
                      placeholder="e.g. 848210"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Make / OEM Brand Restriction
                    </label>
                    <input
                      type="text"
                      value={brandPreference}
                      onChange={e => setBrandPreference(e.target.value)}
                      placeholder="e.g. SKF, Timken, or Any Standard"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3B: BOQ (Bill of Quantities) Line Items Table */}
            {pricingFormat === 'BOQ' && (
              <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-indigo-600" />
                    Bill of Quantities (BOQ) Schedule of Items
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddBoqItem}
                    className="h-8 px-3 rounded-lg border-indigo-300 text-indigo-700 hover:bg-indigo-100 text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </Button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="px-3 py-2.5 w-12 text-center">#</th>
                        <th className="px-3 py-2.5 min-w-[160px]">Item Name *</th>
                        <th className="px-3 py-2.5 w-24">HSN</th>
                        <th className="px-3 py-2.5 w-24">Qty *</th>
                        <th className="px-3 py-2.5 w-36">Unit (UoM) *</th>
                        <th className="px-3 py-2.5 w-32">Est. Unit Rate (₹)</th>
                        <th className="px-3 py-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {boqItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={e => handleUpdateBoqItem(idx, 'itemName', e.target.value)}
                              placeholder="Item description / name"
                              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium focus:border-indigo-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.hsnCode || ''}
                              onChange={e => handleUpdateBoqItem(idx, 'hsnCode', e.target.value)}
                              placeholder="HSN"
                              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium focus:border-indigo-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="any"
                              value={item.quantity}
                              onChange={e => handleUpdateBoqItem(idx, 'quantity', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium focus:border-indigo-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={item.unitOfMeasure}
                              onChange={e => handleUpdateBoqItem(idx, 'unitOfMeasure', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium focus:border-indigo-600 focus:outline-none bg-white"
                            >
                              {UNIT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="any"
                              value={item.estimatedUnitPrice || ''}
                              onChange={e => handleUpdateBoqItem(idx, 'estimatedUnitPrice', e.target.value)}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium focus:border-indigo-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveBoqItem(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 3C: Services (SOW) Scope & Milestones */}
            {categoryType === 'SERVICES' && (
              <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Scope of Work (SOW) &amp; Service Commitments
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Contract Duration (Months)
                    </label>
                    <input
                      type="number"
                      value={contractDurationMonths}
                      onChange={e => setContractDurationMonths(e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      SLA / Key Performance Indicators (KPIs)
                    </label>
                    <input
                      type="text"
                      value={slaRequirements}
                      onChange={e => setSlaRequirements(e.target.value)}
                      placeholder="e.g. 99.5% Uptime, 2-Hour Response Time for critical failures"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Key Deliverables &amp; Manpower Summary
                  </label>
                  <textarea
                    rows={2}
                    value={deliverablesSummary}
                    onChange={e => setDeliverablesSummary(e.target.value)}
                    placeholder="List required deliverables, certified personnel, monthly reporting obligations..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* SECTION 3D: Works (SOR) Specifics */}
            {categoryType === 'WORKS' && (
              <div className="p-4 rounded-2xl bg-orange-50/40 border border-orange-200/80 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-950 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-orange-600" />
                  Work Contract &amp; Site Execution Parameters
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Project Site Location / Works Area
                    </label>
                    <input
                      type="text"
                      value={workSiteLocation}
                      onChange={e => setWorkSiteLocation(e.target.value)}
                      placeholder="e.g. Substation Yard Plot #4, Jharsuguda Industrial Complex"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Defect Liability Period (Months)
                    </label>
                    <input
                      type="number"
                      value={defectLiabilityPeriod}
                      onChange={e => setDefectLiabilityPeriod(e.target.value)}
                      placeholder="e.g. 12 or 24 Months"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: Delivery Location & Consignee Address Dropdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  Delivery &amp; Consignee Destination
                </h3>
                {deliveryAddresses.length > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {deliveryAddresses.length} Registered Plants Available
                  </span>
                )}
              </div>

              {/* Plant / Address Dropdown Selector */}
              {deliveryAddresses.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-slate-500" />
                    Select from Registered Organization Locations:
                  </label>
                  <select
                    value={selectedAddressId}
                    onChange={e => handleSelectAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="custom">-- Enter Custom / Unlisted Address --</option>
                    {deliveryAddresses.map(addr => (
                      <option key={addr.id} value={String(addr.id)}>
                        {addr.addressLabel || addr.addressType || 'Location'} • {addr.addressLine1}, {addr.city} ({addr.pincode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Detailed Location Breakdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Full Delivery Address String <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryLocation}
                  onChange={e => setDeliveryLocation(e.target.value)}
                  required
                  placeholder="Premises name, street, plot number, industrial area"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    placeholder="e.g. Odisha"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">District / City</label>
                  <input
                    type="text"
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    placeholder="e.g. Jharsuguda"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Postal PIN Code</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    placeholder="e.g. 768201"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: Standardized Commercial Terms Dropdowns */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Standard Commercial &amp; Inspection Terms
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5 text-slate-500" />
                    Delivery / Incoterms
                  </label>
                  <select
                    value={deliveryTerms}
                    onChange={e => setDeliveryTerms(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {INCOTERMS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                    Inspection Agency / Protocol
                  </label>
                  <select
                    value={inspectionMode}
                    onChange={e => setInspectionMode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {INSPECTION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                    Payment Milestone Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {PAYMENT_TERM_OPTIONS.map(pt => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Special Conditions / Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Additional Contractual Clauses (One per line)
                </label>
                <textarea
                  rows={2}
                  value={terms}
                  onChange={e => setTerms(e.target.value)}
                  placeholder="e.g. Guarantee/Warranty period 18 months from commissioning&#10;Consignee receipt acknowledgement mandatory within 48 hours"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-10 px-4 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black tracking-wide shadow-md active:scale-95 border-none cursor-pointer flex items-center gap-2"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Review &amp; Publish Final Edit</span>
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmOneTimeEditModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleExecuteSave}
        procurementTitle={title}
        referenceNumber={procurement.referenceNumber || `#${procurement.id}`}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
