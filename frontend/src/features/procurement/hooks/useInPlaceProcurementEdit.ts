'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { putApi } from '../../shared/apiClient';
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

export interface InPlaceProcurementDraft {
  title: string;
  description: string;
  categoryType: ProcurementCategoryType;
  pricingFormat: ProcurementPricingFormat;
  categoryName: string;
  estimatedValue: string;
  endDate: string;

  // Single item goods
  quantity: string;
  unit: string;
  hsnCode: string;
  brandPreference: string;

  // BOQ line items
  boqItems: BoqLineItem[];

  // Services fields
  contractDurationMonths: string;
  slaRequirements: string;
  deliverablesSummary: string;

  // Works fields
  workSiteLocation: string;
  defectLiabilityPeriod: string;

  // Delivery & location
  deliveryLocation: string;
  state: string;
  district: string;
  pincode: string;

  // Commercial terms
  deliveryTerms: string;
  inspectionMode: string;
  paymentTerms: string;
  termsAndConditions: string;
}

export interface UseInPlaceProcurementEditProps {
  procurement: any;
  onSuccess?: () => void | Promise<void>;
}

export const INCOTERMS_OPTIONS = [
  { value: 'FOR_DESTINATION', label: 'FOR Destination (Freight & Transit Insurance Included)' },
  { value: 'EX_WORKS', label: 'Ex-Works (Buyer arranged transportation)' },
  { value: 'FOB', label: 'FOB - Free on Board' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
  { value: 'DOOR_DELIVERY', label: 'Door Delivery to Consignee Site' }
];

export const INSPECTION_OPTIONS = [
  { value: 'CONSIGNEE_END', label: 'Consignee End Inspection (Upon receipt at site)' },
  { value: 'PRE_DISPATCH', label: 'Pre-dispatch Inspection at Seller Works' },
  { value: 'TPI_RITES', label: 'Third Party Inspection - RITES / SGS / TUV' },
  { value: 'SELF_CERTIFICATION', label: 'OEM Self-Certification with MTC / Test Certificate' },
  { value: 'NOT_APPLICABLE', label: 'Not Applicable / Standard Commercial' }
];

export function useInPlaceProcurementEdit({ procurement, onSuccess }: UseInPlaceProcurementEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const initialDraft = useMemo<InPlaceProcurementDraft>(() => {
    if (!procurement) {
      return {
        title: '',
        description: '',
        categoryType: 'GOODS',
        pricingFormat: 'SINGLE_ITEM',
        categoryName: '',
        estimatedValue: '',
        endDate: '',
        quantity: '',
        unit: 'NOS',
        hsnCode: '',
        brandPreference: '',
        boqItems: [],
        contractDurationMonths: '12',
        slaRequirements: '',
        deliverablesSummary: '',
        workSiteLocation: '',
        defectLiabilityPeriod: '12',
        deliveryLocation: '',
        state: '',
        district: '',
        pincode: '',
        deliveryTerms: INCOTERMS_OPTIONS[0].value,
        inspectionMode: INSPECTION_OPTIONS[0].value,
        paymentTerms: '100% against delivery',
        termsAndConditions: ''
      };
    }

    const tp = (procurement.technicalPacket || {}) as any;
    const fp = (procurement.financialPacket || {}) as any;
    const items = tp?.items || procurement.items || [];
    const firstItem = items[0] || {};

    const rawCategory = procurement.categoryType || tp?.basics?.procurementCategory || 'GOODS';
    const categoryType: ProcurementCategoryType =
      rawCategory === 'SERVICES' ? 'SERVICES' : rawCategory === 'WORKS' ? 'WORKS' : 'GOODS';

    const rawPricing = procurement.pricingFormat || tp?.basics?.pricingFormat || (items.length > 1 ? 'BOQ' : 'SINGLE_ITEM');
    const pricingFormat: ProcurementPricingFormat =
      rawPricing === 'BOQ' ? 'BOQ' : rawPricing === 'SOR' ? 'SOR' : 'SINGLE_ITEM';

    // Format ISO end date for datetime-local input
    let formattedEndDate = '';
    const rawDate = procurement.endDate || procurement.closingDate || procurement.deadlineDate;
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          formattedEndDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
      } catch {
        formattedEndDate = '';
      }
    }

    // BOQ Items
    const rawBoq = tp?.items || procurement.items || fp?.boqSchedule || [];
    const boqItems: BoqLineItem[] = Array.isArray(rawBoq) && rawBoq.length > 0
      ? rawBoq.map((it: any, idx: number) => ({
          id: it.id || `line-${idx + 1}`,
          itemCode: it.itemCode || `ITM-${idx + 1}`,
          itemName: it.itemName || it.name || `Item ${idx + 1}`,
          description: it.description || '',
          hsnCode: it.hsnCode || it.hsn || it.hsnSac || '',
          quantity: it.quantity ?? 1,
          unitOfMeasure: it.unitOfMeasure || it.unit || 'NOS',
          estimatedUnitPrice: it.estimatedUnitPrice || it.unitPrice || '',
          estimatedTotal: it.estimatedTotal || ''
        }))
      : [
          {
            id: 'line-1',
            itemCode: 'ITM-01',
            itemName: procurement.title || procurement.subject || 'Item 1',
            quantity: procurement.quantity ? Number(procurement.quantity) : 1,
            unitOfMeasure: procurement.unit || 'NOS',
            hsnCode: firstItem?.hsnCode || firstItem?.hsn || '',
            estimatedUnitPrice: ''
          }
        ];

    return {
      title: procurement.title || procurement.subject || '',
      description: procurement.description || procurement.scopeDescription || '',
      categoryType,
      pricingFormat,
      categoryName: procurement.category || '',
      estimatedValue: procurement.estimatedValue ? String(procurement.estimatedValue) : (fp?.estimatedBudget ? String(fp.estimatedBudget) : ''),
      endDate: formattedEndDate,

      quantity: procurement.quantity ? String(procurement.quantity) : (firstItem?.quantity ? String(firstItem.quantity) : ''),
      unit: procurement.unit || firstItem?.unit || firstItem?.unitOfMeasure || 'NOS',
      hsnCode: firstItem?.hsnCode || firstItem?.hsn || tp?.basics?.hsnCode || '',
      brandPreference: firstItem?.brandRequirement || firstItem?.make || firstItem?.brand || tp?.basics?.makeBrand || '',

      boqItems,

      contractDurationMonths: String(tp?.service?.durationMonths || tp?.basics?.durationMonths || '12'),
      slaRequirements: tp?.service?.slaRequirements || tp?.specs?.sla || '',
      deliverablesSummary: tp?.service?.deliverables || '',

      workSiteLocation: tp?.works?.siteLocation || procurement.deliveryLocation || '',
      defectLiabilityPeriod: String(tp?.works?.defectLiabilityPeriodMonths || '12'),

      deliveryLocation: procurement.deliveryLocation || '',
      state: procurement.state || '',
      district: procurement.district || '',
      pincode: procurement.pincode || '',

      deliveryTerms: tp?.terms?.deliveryTerms || INCOTERMS_OPTIONS[0].value,
      inspectionMode: tp?.terms?.inspectionMode || tp?.specs?.inspectionMode || INSPECTION_OPTIONS[0].value,
      paymentTerms: fp?.paymentTerms || tp?.terms?.paymentTerms || '100% against delivery',
      termsAndConditions: Array.isArray(procurement.termsAndConditions)
        ? procurement.termsAndConditions.join('\n')
        : (procurement.termsAndConditions || '')
    };
  }, [
    procurement?.id,
    procurement?.title,
    procurement?.subject,
    procurement?.description,
    procurement?.scopeDescription,
    procurement?.category,
    procurement?.categoryType,
    procurement?.pricingFormat,
    procurement?.quantity,
    procurement?.unit,
    procurement?.estimatedValue,
    procurement?.endDate,
    procurement?.closingDate,
    procurement?.deadlineDate,
    procurement?.deliveryLocation,
    procurement?.state,
    procurement?.district,
    procurement?.pincode,
    procurement?.termsAndConditions,
    procurement?.technicalPacket,
    procurement?.financialPacket,
    procurement?.items
  ]);

  const [draft, setDraft] = useState<InPlaceProcurementDraft>(initialDraft);
  const lastInitialDraftJsonRef = useRef<string>(JSON.stringify(initialDraft));

  // Sync draft only when initialDraft content truly changes while not actively editing
  useEffect(() => {
    if (!isEditing) {
      const currentJson = JSON.stringify(initialDraft);
      if (lastInitialDraftJsonRef.current !== currentJson) {
        lastInitialDraftJsonRef.current = currentJson;
        setDraft(initialDraft);
      }
    }
  }, [initialDraft, isEditing]);

  const startEditing = useCallback(() => {
    setDraft(initialDraft);
    setValidationErrors({});
    setIsEditing(true);
  }, [initialDraft]);

  const cancelEditing = useCallback(() => {
    setDraft(initialDraft);
    setValidationErrors({});
    setIsEditing(false);
    setConfirmModalOpen(false);
  }, [initialDraft]);

  const updateDraft = useCallback(<K extends keyof InPlaceProcurementDraft>(field: K, value: InPlaceProcurementDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setValidationErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  }, []);

  const updateBoqItem = useCallback((idx: number, field: keyof BoqLineItem, value: any) => {
    setDraft((prev) => {
      const copy = [...prev.boqItems];
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...prev, boqItems: copy };
    });
  }, []);

  const addBoqItem = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      boqItems: [
        ...prev.boqItems,
        {
          id: `line-${prev.boqItems.length + 1}`,
          itemCode: `ITM-0${prev.boqItems.length + 1}`,
          itemName: '',
          description: '',
          hsnCode: '',
          quantity: 1,
          unitOfMeasure: 'NOS',
          estimatedUnitPrice: ''
        }
      ]
    }));
  }, []);

  const removeBoqItem = useCallback((idx: number) => {
    setDraft((prev) => {
      if (prev.boqItems.length <= 1) {
        toast.error('At least one item is required in the schedule.');
        return prev;
      }
      return { ...prev, boqItems: prev.boqItems.filter((_, i) => i !== idx) };
    });
  }, []);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!draft.title.trim() || draft.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters.';
    }
    if (!draft.description.trim() || draft.description.trim().length < 10) {
      errors.description = 'Scope description must be at least 10 characters.';
    }
    if (!draft.deliveryLocation.trim() || draft.deliveryLocation.trim().length < 2) {
      errors.deliveryLocation = 'Delivery location is required.';
    }

    if (draft.pricingFormat === 'BOQ') {
      if (draft.boqItems.length === 0) {
        errors.boq = 'At least one line item is required in the BOQ schedule.';
      } else {
        draft.boqItems.forEach((item, i) => {
          if (!item.itemName.trim()) {
            errors[`boq_${i}_name`] = `Item #${i + 1} name is required.`;
          }
          if (Number(item.quantity) <= 0) {
            errors[`boq_${i}_qty`] = `Item #${i + 1} quantity must be greater than zero.`;
          }
        });
      }
    } else if (draft.categoryType === 'GOODS') {
      if (draft.quantity && Number(draft.quantity) <= 0) {
        errors.quantity = 'Quantity must be greater than zero.';
      }
    }

    if (draft.endDate) {
      const ed = new Date(draft.endDate);
      if (ed <= new Date()) {
        errors.endDate = 'Submission deadline must be in the future.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [draft]);

  const requestSave = useCallback(() => {
    if (!validate()) {
      toast.error('Please resolve the validation errors before saving.');
      return;
    }
    setConfirmModalOpen(true);
  }, [validate]);

  const confirmAndSave = useCallback(async () => {
    if (!procurement?.id) return;
    try {
      setIsSubmitting(true);

      const baseTechnicalPacket = { ...(procurement.technicalPacket || {}) };
      const baseFinancialPacket = { ...(procurement.financialPacket || {}) };

      let finalItems = draft.boqItems;
      if (draft.pricingFormat === 'SINGLE_ITEM') {
        finalItems = [
          {
            id: 'line-1',
            itemCode: 'ITM-01',
            itemName: draft.title.trim(),
            description: draft.description.trim(),
            hsnCode: draft.hsnCode.trim(),
            quantity: draft.quantity ? Number(draft.quantity) : 1,
            unitOfMeasure: draft.unit || 'NOS',
            estimatedUnitPrice: draft.estimatedValue && draft.quantity
              ? Number(draft.estimatedValue) / Number(draft.quantity)
              : undefined
          }
        ];
      }

      baseTechnicalPacket.items = finalItems;
      baseTechnicalPacket.basics = {
        ...(baseTechnicalPacket.basics || {}),
        title: draft.title.trim(),
        scopeDescription: draft.description.trim(),
        procurementCategory: draft.categoryType,
        pricingFormat: draft.pricingFormat,
        deliveryLocation: draft.deliveryLocation.trim(),
        pincode: draft.pincode.trim(),
        state: draft.state.trim(),
        district: draft.district.trim(),
        makeBrand: draft.brandPreference.trim()
      };

      baseTechnicalPacket.terms = {
        ...(baseTechnicalPacket.terms || {}),
        deliveryTerms: draft.deliveryTerms,
        inspectionMode: draft.inspectionMode,
        paymentTerms: draft.paymentTerms
      };

      if (draft.categoryType === 'SERVICES') {
        baseTechnicalPacket.service = {
          durationMonths: draft.contractDurationMonths,
          slaRequirements: draft.slaRequirements,
          deliverables: draft.deliverablesSummary
        };
      } else if (draft.categoryType === 'WORKS') {
        baseTechnicalPacket.works = {
          siteLocation: draft.workSiteLocation || draft.deliveryLocation,
          defectLiabilityPeriodMonths: draft.defectLiabilityPeriod
        };
      }

      const budgetVal = draft.estimatedValue ? Number(draft.estimatedValue) : undefined;
      baseFinancialPacket.estimatedBudget = budgetVal;
      baseFinancialPacket.paymentTerms = draft.paymentTerms;

      const payload: Record<string, any> = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        categoryType: draft.categoryType,
        pricingFormat: draft.pricingFormat,
        deliveryLocation: draft.deliveryLocation.trim(),
        state: draft.state.trim() || undefined,
        district: draft.district.trim() || undefined,
        pincode: draft.pincode.trim() || undefined,
        technicalPacket: baseTechnicalPacket,
        financialPacket: baseFinancialPacket
      };

      if (draft.pricingFormat === 'SINGLE_ITEM') {
        if (draft.quantity) payload.quantity = Number(draft.quantity);
        if (draft.unit) payload.unit = draft.unit.trim();
      } else {
        payload.quantity = draft.boqItems.length;
        payload.unit = 'Line Items';
      }

      if (budgetVal !== undefined) {
        payload.estimatedValue = budgetVal;
      }

      if (draft.endDate) payload.endDate = new Date(draft.endDate).toISOString();
      if (draft.termsAndConditions.trim()) {
        payload.termsAndConditions = draft.termsAndConditions
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean);
      }

      const targetBidId = procurement.id;
      await putApi(`/api/buyer/procurement-bids/${targetBidId}`, payload);

      toast.success('Procurement updated successfully', {
        description: 'Version 2 published. Standardized specifications synchronized and suppliers notified.'
      });

      setConfirmModalOpen(false);
      setIsEditing(false);

      if (onSuccess) {
        await onSuccess();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update procurement');
    } finally {
      setIsSubmitting(false);
    }
  }, [procurement, draft, onSuccess]);

  return {
    isEditing,
    isSubmitting,
    confirmModalOpen,
    setConfirmModalOpen,
    draft,
    validationErrors,
    startEditing,
    cancelEditing,
    updateDraft,
    updateBoqItem,
    addBoqItem,
    removeBoqItem,
    requestSave,
    confirmAndSave
  };
}
