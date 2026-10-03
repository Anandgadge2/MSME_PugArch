'use client';

import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Save,
  Pencil,
  History,
  Loader2,
  X,
  ClipboardCheck,
  ShieldCheck,
  Package,
  Users,
  CalendarClock,
  FileText,
  Upload,
  Gavel,
  BarChart3,
  BadgeCheck,
  ArrowRight,
  ChevronRight,
  Info,
  ShoppingCart,
  Trash2,
  Download,
  FileSpreadsheet,
  Copy,
  Paperclip,
  Check,
  AlertCircle,
  Eye,
  ExternalLink,
  File,
  FileCheck,
  FolderUp,
  FileUp,
  FilePlus,
  Wrench,
  Sparkles,
  Percent,
  Tag,
  HelpCircle,
  CheckCircle2,
  Truck,
  Lock,
  Scale,
  TrendingDown,
  Activity,
  Repeat,
  Clock,
  RefreshCw,
  IndianRupee,
  Calendar,
} from 'lucide-react';

import { Button } from '../../../components/ui/button';
import { DateTimePicker } from '../../../components/ui/DateTimePicker';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { getFileAssetPreview, openFileAsset, type DocumentPreview } from '../../../lib/files';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../hooks/useAuth';
import { useOrgRole } from '../../../hooks/useOrgRole';
import { getResolvedOrgName, getResolvedBuyerAddress, getResolvedBuyerAddressInfo, type ResolvedAddressInfo } from '../../../utils/organizationUtils';
import { marketplaceApi } from '../../marketplace/api';
import { DELIVERY_TYPES, PAYMENT_TERMS, QUANTITY_UNITS } from '../../../constants/dropdowns';
import { formatRefId } from '../../../utils/refIdUtils';
import {
  PROCUREMENT_DRAFTS_ROUTE,
  fetchProcurementDraft,
  saveProcurementDraft,
  submitProcurementDraft
} from '../api';
import { api, BASE_URL, readJsonResponse, unwrapApiData } from '../../../lib/api';
import { authHeaders, unwrap } from '../../shared/apiClient';
import { downloadCsv } from '../../shared/exportUtils';
import { fetchDeliveryAddresses, createDeliveryAddress, type DeliveryAddressDto } from '../../directPurchase/api';
import { cleanDeliveryAddress } from '../../shared/format';
import { useActiveCart } from '../../cart/hooks';
import type { CartItemDto } from '../../cart/api';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { Input } from '../../../components/ui/input';
import { STATE_OPTIONS, getDistrictOptions } from '../../../data/indianLocations';
import {
  suggestProcurementMethod,
  mapToDatabaseMethod,
  METHOD_DEFINITIONS,
  type ProcurementMethodId
} from '../procurementMethodsConfig';
import { normalizeProcurementMethod } from '../procurementMethodHelpers';
import { getWizardConfig } from '../modules';

// Import Reusable Sourcing components from Loop 3
import {
  ProcurementStepper,
  ProcurementMethodCard,
  ProcurementStatusBadge,
  MethodBadge,
  SectionCard,
  StickyActionBar,
  EmptyState,
  BOQTable,
  SupplierSelector,
  DocumentRequirementBuilder,
  EvaluationCriteriaBuilder,
  ApprovalTimeline,
  ProcurementSummaryPanel,
  type BOQRow,
  type Supplier,
  type SourcingDoc,
  type EvalCriteria
} from '../components/SourcingWizardComponents';
import { ProcurementAdvisorModal } from '../components/ProcurementAdvisorModal';
import { ProcurementGlossaryTooltip } from '../../../components/common/ProcurementGlossaryTooltip';

type StepKind = 'selection' | 'basics' | 'internal' | 'items' | 'vendors' | 'schedule' | 'terms' | 'documents' | 'evaluation' | 'publish';

type ItemAttachment = {
  id: string;
  name: string;
  fileAssetId: number;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
};

type ItemRow = {
  id: string;
  itemType?: 'Product' | 'Service';
  name: string;
  category?: string;
  categoryId?: number | null;
  specification: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gst: number;
  deliveryDate: string;
  brandPolicy: string;
  technicalSpecification: string;
  specificationFileName: string;
  fileAssetId?: number | null;
  hsn_sac_code?: string;
  brand_preference?: string;
  brand_flexible?: string;
  attachments?: ItemAttachment[];
};

type DocumentRow = {
  id: string;
  name: string;
  required: boolean;
  fileType: string;
  maxSize: number;
  instructions: string;
  fileAssetId?: number | null;
  fileName?: string;
};

type AuctionConfig = {
  auctionNumber: string;
  auctionTitle: string;
  auctionDescription: string;
  procurementMethod: 'REVERSE_AUCTION' | 'BID_WITH_REVERSE_AUCTION';
  auctionCategory: string;
  currency: string;
  auctionStatus: 'DRAFT';
  buyerOrganization: string;
  department: string;
  purchaseGroup: string;
  purchaseOrganization: string;
  auctionType: 'ENGLISH_REVERSE' | 'RANK_BASED_REVERSE';
  auctionMode: 'ONLINE';
  startDateTime: string;
  endDateTime: string;
  durationMinutes: number;
  startingBidPrice: number;
  reservePrice: number | null;
  minimumBidDecrement: number;
  autoExtensionEnabled: boolean;
  extensionTriggerMinutes: number;
  extensionDurationMinutes: number;
  maximumExtensions: number;
  rankVisibility: 'SHOW_RANK_ONLY' | 'SHOW_LOWEST_PRICE' | 'HIDDEN';
  minimumQualifiedBidders: number;
  termsDocumentFileId: number | null;
  termsDocumentName: string;
  buyerMonitorSettings: {
    showLiveRank: boolean;
    alertOnReserveBreach: boolean;
    allowManualExtension: boolean;
  };
  triggerConfiguration: {
    trigger: 'AFTER_TECHNICAL_QUALIFICATION' | 'TOP_N_BIDDERS' | 'ALL_TECHNICALLY_QUALIFIED';
    topN: number;
    preBidStageRequired: boolean;
    auctionAfterTechnicalQualification?: boolean;
    auctionAmongAllTechnicallyQualified?: boolean;
    auctionAmongTopNBidders?: number | null;
  };
};

type RateContractItem = {
  id: string;
  itemName: string;
  specification: string;
  uom: string;
  estimatedAnnualQuantity: number;
  baseRate: number;
  gst: number;
  discount: number;
  slabPricingEnabled: boolean;
  slabPricing: Array<{ id: string; minQuantity: number; maxQuantity: number | null; rate: number }>;
};

type RateContractConfig = {
  rateContractNumber: string;
  contractTitle: string;
  contractDescription: string;
  contractCategory: string;
  periodStartDate: string;
  periodEndDate: string;
  rateValidityPeriod: string;
  supplierSelectionStrategy: 'SINGLE_SUPPLIER';
  selectedSuppliers: Array<{ supplierId: number; supplierUserId?: number | null; supplierName?: string | null }>;
  itemRateSchedule: RateContractItem[];
  priceVariationClause: 'FIXED_PRICE';
  callOffOrderAllowed: boolean;
  maximumOrderQuantityPerCallOff: number;
  minimumOrderQuantity: number;
  deliverySla: string;
  deliverySlaDays?: number | null;
  penaltyClause: string;
  penaltyRatePerWeek?: number | null;
  penaltyGraceDays?: number | null;
  maxPenaltyCapPercentage?: number | null;
  securityDepositRequired: boolean;
  securityDepositAmount: number;
  approvalWorkflow: string;
  contractDocument: {
    fileAssetId: number | null;
    fileName: string;
    fileSize?: number | null;
    uploadedAt?: string | null;
  };
};

type Draft = {
  id?: number;
  type: ProcurementMethodId;
  basics: {
    buyerType?: string;
    title: string;
    procurementCategory: 'GOODS' | 'SERVICES' | 'WORKS';
    pricingFormat: 'SINGLE_ITEM' | 'BOQ' | 'SOR';
    category: string;
    department: string;
    priority: 'Normal' | 'Urgent' | 'Emergency';
    estimatedValue: number;
    discloseEstimatedCost: boolean;
    requiredByDate: string;
    deliveryLocation: string;
    isCatalogueAvailable: boolean;
    isOnlyOneVendor: boolean;
    isReverseAuctionNeeded: boolean;
    isTechnicalEvaluationNeeded: boolean;
    justification: string;
    isSpecClear: boolean;
    isRepeatedSupply: boolean;
    marketResearchOnly: boolean;
  };
  internal: {
    orgName: string;
    department: string;
    costCenter: string;
    budgetHead: string;
    projectCode: string;
    contactPerson: string;
    email: string;
    mobile: string;
    competentAuthority: string;
    approvalAuthority: string;
    internalFileNumber: string;
    justification: string;
    budgetConfirmed: boolean;
  };
  items: ItemRow[];
  serviceDetails: {
    serviceTitle: string;
    scopeOfWork: string;
    deliverables: string;
    inclusions: string;
    exclusions: string;
    slaResponseTime: string;
    duration: string;
    manpowerRequired: string;
    experienceRequired: string;
    milestones: Array<{ id: string; label: string; percentage: string; trigger: string }>;
    penaltyClause: string;
    location: string;
    sowFileAssetId?: number | null;
    sowFileName?: string;
    sowFileUrl?: string;
  };
  boqTable: BOQRow[];
  boqFileAssetId: number | null;
  boqFileName: string;
  vendors: {
    selection: 'Open' | 'Selected' | 'Category' | 'Past';
    inviteCount: number;
    msmePreference: boolean;
    localVendorPreference: boolean;
    excludeBlacklisted: boolean;
    selectedSellerId: number | null;
    selectedSellerName: string;
    selectedSellerCode: string;
    invitedSellers: number[];
  };
  schedule: {
    packetType: 'Single' | 'Two';
    publishDate: string;
    submissionDate: string;
    validityDays: number | string;
    submissionStartDate: string;
    clarificationAllowed: boolean;
    technicalOpeningDate: string;
    financialOpeningDate: string;
    bidValidityDate: string;
    autoClose: boolean;
    minimumBidders: number | string;
  };
  terms: {
    paymentTerms: string;
    deliveryTerms: string;
    freightIncluded: boolean;
    gstIncluded: boolean;
    warrantyTerms: string;
    penaltyClause: string;
    advanceAllowed: boolean;
    retentionAmount: number;
    securityDeposit: number;
    documentFee: number;
  };
  requiredDocs: DocumentRow[];
  evaluation: {
    method: string;
    techWeight: number;
    commWeight: number;
    minQualifyingMarks: number;
    technicalCriteria: EvalCriteria[];
  };
  approval: {
    workflow: string;
    approver: string;
    notes: string;
  };
  auctionConfig: AuctionConfig;
  rateContractConfig: RateContractConfig;
  rfqType?: 'OPEN' | 'LIMITED' | '';
  questionnaire?: Array<{ id: string; type: 'TEXT' | 'YES_NO' | 'ATTACHMENT'; text: string }>;
  requireDemo?: boolean;
  tenderType?: 'OPEN' | 'LIMITED' | 'SEALED' | '';
  limitedTenderJustification?: string;
  sealedSubmissionFlag?: boolean;
  draftStep?: number;
  maxVisitedStep?: number;
  completedStepIds?: string[];
  completedSteps?: string[];
  updatedAt?: string;
};

const DRAFT_KEY = 'msme:guided-procurement-create:v2';

const today = new Date().toISOString().split('T')[0];
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
const nextFortnight = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
const toDateTimeLocal = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const todayDateTime = toDateTimeLocal(new Date());
const nextWeekDateTime = toDateTimeLocal(new Date(Date.now() + 7 * 86400000));
const nextWeekPlusOneHourDateTime = toDateTimeLocal(new Date(Date.now() + 7 * 86400000 + 60 * 60000));
const nextFortnightDateTime = toDateTimeLocal(new Date(Date.now() + 14 * 86400000));

const makeId = () => Math.random().toString(36).substring(2, 9);
const isReverseAuctionMethod = (method: ProcurementMethodId) => method === 'REVERSE_AUCTION';
const isRateContractMethod = (method: ProcurementMethodId) => method === 'RATE_CONTRACT';

const calculateDurationBetweenDates = (startDateStr: string, endDateStr: string): string => {
  if (!startDateStr || !endDateStr) return '';
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return '';

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays <= 0) return '';
  if (diffDays < 28) return `${diffDays} Day${diffDays === 1 ? '' : 's'}`;

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const dayDiff = end.getDate() - start.getDate();
  if (dayDiff >= 20) months += 1;
  else if (dayDiff < -10 && months > 0) months -= 1;

  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return `${years} Year${years === 1 ? '' : 's'} (${months} Months)`;
  }
  if (months > 0) {
    return `${months} Month${months === 1 ? '' : 's'}`;
  }
  return `${diffDays} Days`;
};

const addMonthsToDate = (startDateStr: string, monthsToAdd: number): string => {
  const base = startDateStr ? new Date(startDateStr) : new Date();
  if (isNaN(base.getTime())) return '';
  const target = new Date(base);
  target.setMonth(target.getMonth() + monthsToAdd);
  return target.toISOString().split('T')[0];
};
const itemTemplateHeaders = [
  'Item Type',
  'Item Name',
  'Description / Scope of Work',
  'Quantity',
  'Unit',
  'Unit Price',
  'GST %',
  'HSN/SAC',
  'Preferred Brand',
  'Brand Flexible',
  'Delivery Date'
];

const parseCsvText = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value.trim());
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value.trim());
      if (row.some(cell => cell.length > 0)) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value.trim());
  if (row.some(cell => cell.length > 0)) rows.push(row);
  return rows;
};

const readSpreadsheetRows = async (file: File): Promise<string[][]> => {
  const lowerName = file.name.toLowerCase();
  const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

  if (isExcel) {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowValues: string[] = [];
      const values = row.values;
      if (Array.isArray(values)) {
        for (let i = 1; i < values.length; i++) {
          const val = values[i];
          if (val === null || val === undefined) {
            rowValues.push('');
          } else if (typeof val === 'object' && 'result' in val) {
            rowValues.push(String((val as any).result ?? '').trim());
          } else if (typeof val === 'object' && 'text' in val) {
            rowValues.push(String((val as any).text ?? '').trim());
          } else {
            rowValues.push(String(val).trim());
          }
        }
      }
      if (rowValues.some(c => c.length > 0)) {
        rows.push(rowValues);
      }
    });
    return rows;
  }

  return parseCsvText(await file.text());
};

const normalizeImportHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const DESCRIPTION_SCOPE_ALIASES = [
  'descriptionscopeofwork',
  'descriptionscope',
  'scopeofwork',
  'scopeofworkdeliverables',
  'scopeofworkanddeliverables',
  'scopeofworkdeliverablesdetails',
  'scopeofworkdetails',
  'scopedeliverables',
  'specificationsscope',
  'specificationsscopeofwork',
  'specificationscope',
  'specificationscopeofwork',
  'scopespecifications',
  'scopespecification',
  'technicalspecification',
  'technicalspecifications',
  'technicalspecs',
  'detailedtechnicalspecifications',
  'detailedtechnicalspecification',
  'technicaldetails',
  'itemdescription',
  'productdescription',
  'servicedescription',
  'workdescription',
  'detailedscopeofwork',
  'detailedscope',
  'description',
  'specification',
  'specifications',
  'scope',
  'sow',
  'details',
  'desc',
  'remarks',
  'technicalnote',
  'technicalnotes',
  'requirements',
  'requirement',
  'specificationname',
  'specificationvalue'
];

const ITEM_NAME_ALIASES = [
  'itemname',
  'name',
  'itemservicename',
  'productservicename',
  'productname',
  'servicename',
  'itemservice',
  'item',
  'product',
  'service',
  'title',
  'itemtitle',
  'particulars',
  'itemparticulars',
  'materialname',
  'equipmentname',
  'productservice'
];

const importedCsvRowToItem = (headers: string[], row: string[], index: number): ItemRow | null => {
  const normHeaders = headers.map(normalizeImportHeader);

  const getByAliases = (...aliases: string[]) => {
    const idx = normHeaders.findIndex(h => aliases.includes(h));
    return idx >= 0 ? String(row[idx] || '').trim() : '';
  };

  let name = getByAliases(...ITEM_NAME_ALIASES);
  let nameColIdx = normHeaders.findIndex(h => ITEM_NAME_ALIASES.includes(h));

  // 1. Direct alias match for Description / Scope of Work
  let specification = '';
  for (const alias of DESCRIPTION_SCOPE_ALIASES) {
    const idx = normHeaders.indexOf(alias);
    if (idx >= 0 && idx !== nameColIdx && String(row[idx] || '').trim()) {
      specification = String(row[idx] || '').trim();
      break;
    }
  }

  // 2. Fallback: match any column containing scope, spec, desc, sow, detail (excluding name col)
  if (!specification) {
    const candidateIdx = normHeaders.findIndex((h, i) => {
      if (i === nameColIdx) return false;
      return (
        (h.includes('scope') || h.includes('spec') || h.includes('desc') || h.includes('sow') || h.includes('detail')) &&
        !h.includes('file') && !h.includes('doc') && !h.includes('attach')
      );
    });
    if (candidateIdx >= 0 && String(row[candidateIdx] || '').trim()) {
      specification = String(row[candidateIdx] || '').trim();
    }
  }

  // If name wasn't found, check if a descriptive column exists to use as name
  if (!name) {
    const descColIdx = normHeaders.findIndex(h => h.includes('itemdescription') || h === 'particulars' || h === 'description');
    if (descColIdx >= 0 && String(row[descColIdx] || '').trim()) {
      name = String(row[descColIdx] || '').trim();
      nameColIdx = descColIdx;
      const remColIdx = normHeaders.findIndex(h => h.includes('remark') || h.includes('spec') || h.includes('scope'));
      if (remColIdx >= 0 && remColIdx !== descColIdx && String(row[remColIdx] || '').trim()) {
        specification = String(row[remColIdx] || '').trim();
      } else {
        specification = name;
      }
    }
  }

  if (!name) return null;

  const rawType = getByAliases('itemtype', 'type', 'category', 'kind', 'itemkind', 'productservice', 'classification').toLowerCase();
  const itemType: 'Product' | 'Service' = rawType.includes('service') ? 'Service' : 'Product';
  const quantity = Math.max(1, Math.round(Number(getByAliases('quantity', 'qty', 'count', 'units', 'numberofunits', 'targetqty', 'requiredqty', 'monthlyrequirement', 'estimatedmonthlyrequirement', 'estimatedquantity')) || 1));

  const uom = getByAliases('unit', 'uom', 'unitofmeasure', 'measuringunit', 'unittype', 'measurementunit') || (itemType === 'Service' ? 'Set' : 'Nos');
  const unitPrice = Number(getByAliases('unitprice', 'rate', 'estimatedunitprice', 'estimatedrate', 'price', 'baseprice', 'cost', 'unitrate', 'estimatedrateinr', 'targetprice')) || 0;
  const gst = Number(getByAliases('gst', 'gstpercent', 'gstpercentage', 'gstrate', 'tax', 'taxpercent', 'taxpercentage')) || 18;
  const deliveryDate = getByAliases('deliverydate', 'requireddate', 'expecteddate', 'deliverytimeline', 'date') || nextFortnight;
  const hsn_sac_code = getByAliases('hsnsac', 'hsn', 'sac', 'hsncode', 'saccode', 'hsnsaccode');
  const brand_preference = getByAliases('preferredbrand', 'brandpreference', 'brand', 'make', 'brandname', 'manufacturer', 'makemodel');
  const brand_flexible = getByAliases('brandflexible', 'alternatebrandsallowed', 'brandflexibility') || 'Yes';

  return {
    id: `import:${Date.now()}:${index}:${makeId()}`,
    itemType,
    name,
    specification,
    quantity,
    unit: uom,
    unitPrice,
    gst,
    deliveryDate,
    brandPolicy: 'Equivalent allowed',
    technicalSpecification: specification,
    specificationFileName: '',
    hsn_sac_code,
    brand_preference,
    brand_flexible,
    fileAssetId: null,
    attachments: [],
  };
};

const normalizeDraftItem = (it: any, idx: number): ItemRow => {
  const sp = (typeof it.specifications === 'object' && it.specifications) ? it.specifications : {};
  const specText = it.specification || it.technicalSpecification || sp.specification || sp.technicalSpecification || sp.scopeOfWork || sp.description || it.description || it.scopeOfWork || '';
  const hsnSac = it.hsn_sac_code || it.hsnSacCode || it.hsnSac || it.hsn || it.hsnCode || it.sac || it.sacCode || sp.hsn_sac_code || sp.hsnSacCode || sp.sacCode || sp.sac || sp.hsnCode || sp.hsn || '';
  return {
    ...it,
    id: it.id || `item:${Date.now()}:${idx}:${makeId()}`,
    itemType: (it.itemType || sp.itemType || 'Product').toLowerCase().includes('service') ? 'Service' : 'Product',
    name: it.name || it.itemName || sp.name || sp.itemName || `Item #${idx + 1}`,
    category: it.category || sp.category || '',
    categoryId: it.categoryId || sp.categoryId || null,
    specification: specText,
    technicalSpecification: it.technicalSpecification || specText,
    unit: it.unit || it.unitOfMeasure || sp.unit || 'Nos',
    unitPrice: Number(it.unitPrice || it.estimatedUnitPrice || 0),
    gst: Number(it.gst || sp.gst || 18),
    hsn_sac_code: hsnSac,
  };
};

const defaultAuctionConfig = (method: ProcurementMethodId): AuctionConfig => ({
  auctionNumber: `RA-${Math.floor(10000 + Math.random() * 90000)}`,
  auctionTitle: '',
  auctionDescription: '',
  procurementMethod: 'REVERSE_AUCTION',
  auctionCategory: '',
  currency: 'INR',
  auctionStatus: 'DRAFT',
  buyerOrganization: '',
  department: '',
  purchaseGroup: '',
  purchaseOrganization: '',
  auctionType: 'ENGLISH_REVERSE',
  auctionMode: 'ONLINE',
  startDateTime: nextWeekDateTime,
  endDateTime: nextWeekPlusOneHourDateTime,
  durationMinutes: 60,
  startingBidPrice: 0,
  reservePrice: null,
  minimumBidDecrement: 0,
  autoExtensionEnabled: false,
  extensionTriggerMinutes: 5,
  extensionDurationMinutes: 5,
  maximumExtensions: 3,
  rankVisibility: 'SHOW_RANK_ONLY',
  minimumQualifiedBidders: 2,
  termsDocumentFileId: null,
  termsDocumentName: '',
  buyerMonitorSettings: {
    showLiveRank: true,
    alertOnReserveBreach: true,
    allowManualExtension: true,
  },
  triggerConfiguration: {
    trigger: 'AFTER_TECHNICAL_QUALIFICATION',
    topN: 3,
    preBidStageRequired: false,
  },
});

const syncAuctionDefaults = (draft: Draft, method: ProcurementMethodId): Draft => {
  if (!isReverseAuctionMethod(method)) {
    return { ...draft, type: method };
  }

  const base = draft.auctionConfig || defaultAuctionConfig(method);
  return {
    ...draft,
    type: method,
    basics: {
      ...draft.basics,
      isReverseAuctionNeeded: true,
      isTechnicalEvaluationNeeded: draft.basics.isTechnicalEvaluationNeeded,
    },
    schedule: {
      ...draft.schedule,
      packetType: draft.schedule.packetType,
      minimumBidders: Math.max(Number(draft.schedule.minimumBidders || 0), base.minimumQualifiedBidders || 2),
    },
    auctionConfig: {
      ...base,
      procurementMethod: 'REVERSE_AUCTION',
      auctionTitle: base.auctionTitle || draft.basics.title,
      auctionDescription: base.auctionDescription || draft.basics.justification,
      auctionCategory: base.auctionCategory || draft.basics.category,
      buyerOrganization: base.buyerOrganization || draft.internal.orgName,
      department: base.department || draft.internal.department || draft.basics.department,
      startingBidPrice: base.startingBidPrice || draft.basics.estimatedValue || 0,
      triggerConfiguration: {
        ...base.triggerConfiguration,
        preBidStageRequired: false,
      },
    },
  };
};

const defaultRateContractConfig = (): RateContractConfig => {
  const rcStart = today;
  const rcEnd = addMonthsToDate(rcStart, 12);
  return {
    rateContractNumber: '',
    contractTitle: '',
    contractDescription: '',
    contractCategory: '',
    periodStartDate: rcStart,
    periodEndDate: rcEnd,
    rateValidityPeriod: '1 Year (12 Months)',
    supplierSelectionStrategy: 'SINGLE_SUPPLIER',
  selectedSuppliers: [],
  itemRateSchedule: [],
  priceVariationClause: 'FIXED_PRICE',
  callOffOrderAllowed: true,
  maximumOrderQuantityPerCallOff: 0,
  minimumOrderQuantity: 0,
  deliverySla: '',
  deliverySlaDays: null,
  penaltyClause: '',
  penaltyRatePerWeek: null,
  penaltyGraceDays: null,
  maxPenaltyCapPercentage: null,
  securityDepositRequired: false,
  securityDepositAmount: 0,
  approvalWorkflow: 'Finance + Procurement',
  contractDocument: {
    fileAssetId: null,
    fileName: '',
    fileSize: null,
    uploadedAt: null,
  },
  };
};

const rateScheduleFromDraftItems = (draft: Draft): RateContractItem[] => {
  const isBoq = draft.basics.pricingFormat === 'BOQ' || draft.basics.pricingFormat === 'SOR';
  const source = isBoq
    ? draft.boqTable.map(row => ({
      name: row.description,
      specification: row.remarks || row.category || '',
      unit: row.uom,
      quantity: row.quantity,
      rate: row.estimatedRate,
      gst: row.taxPercent || 0,
    }))
    : draft.items.map(item => ({
      name: item.name,
      specification: item.specification || item.technicalSpecification || '',
      unit: item.unit,
      quantity: item.quantity,
      rate: item.unitPrice,
      gst: item.gst || 0,
    }));

  return source
    .filter(item => String(item.name || '').trim())
    .map(item => ({
      id: makeId(),
      itemName: String(item.name || ''),
      specification: String(item.specification || ''),
      uom: String(item.unit || 'Nos'),
      estimatedAnnualQuantity: Number(item.quantity || 1),
      baseRate: Number(item.rate || 0),
      gst: Number(item.gst || 0),
      discount: 0,
      slabPricingEnabled: false,
      slabPricing: [],
    }));
};

// Single source of truth for "total procurement quantity" — the value that drives the
// auto-generated consignee and must be > 0 for the backend submit validator to pass.
const getTotalProcurementQty = (draft: Draft): number => {
  const isBoq = draft.basics.pricingFormat === 'BOQ' || draft.basics.pricingFormat === 'SOR';
  const rows = isBoq ? draft.boqTable : draft.items;
  return rows.reduce((acc: number, row: any) => acc + Number(row.quantity || 0), 0);
};

export const computeProcurementTotals = (items: ItemRow[]) => {
  let baseValue = 0;
  let gstAmount = 0;
  let totalQty = 0;

  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity || 0));
    const rate = Math.max(0, Number(item.unitPrice || 0));
    const gstPct = Math.max(0, Number(item.gst ?? 18));
    const itemBase = qty * rate;
    const itemGst = (itemBase * gstPct) / 100;

    baseValue += itemBase;
    gstAmount += itemGst;
    totalQty += qty;
  }

  const grossValue = baseValue + gstAmount;

  return {
    baseValue,
    gstAmount,
    grossValue,
    totalQty,
    itemCount: items.length,
  };
};

const cartItemToProcurementItem = (item: CartItemDto): ItemRow => {
  const product = item.product;
  const service = item.service;
  const description = product?.description || service?.description || service?.scopeOfWork || item.technicalNote || item.itemName;
  const unitPrice = Number(item.unitPrice || product?.price || service?.basePrice || 0);

  const serviceSacCode = service?.specifications?.find((s: any) => /sac/i.test(s.name))?.value || (service as any)?.sacCode || '';
  const code = (service ? serviceSacCode : product?.hsnCode) || product?.hsnCode || serviceSacCode || '';
  const categoryName = product?.category?.name || service?.category?.name || '';
  const categoryId = product?.categoryId || service?.categoryId || null;

  return {
    id: `cart:${item.id}`,
    itemType: service ? 'Service' : 'Product',
    name: item.itemName || product?.name || service?.name || 'Catalogue Item',
    category: categoryName,
    categoryId: categoryId,
    specification: description || '',
    quantity: Math.max(1, Number(item.quantity || 1)),
    unit: item.unitOfMeasure || product?.unitOfMeasure || (service ? 'Set' : 'Nos'),
    unitPrice,
    gst: 18,
    deliveryDate: nextFortnight,
    brandPolicy: 'Equivalent allowed',
    technicalSpecification: description || '',
    specificationFileName: '',
    hsn_sac_code: code,
    brand_preference: '',
    brand_flexible: 'Yes',
    fileAssetId: null,
    attachments: [],
  };
};

const syncRateContractDefaults = (draft: Draft): Draft => {
  const base = draft.rateContractConfig || defaultRateContractConfig();
  const itemRateSchedule = base.itemRateSchedule.length ? base.itemRateSchedule : rateScheduleFromDraftItems(draft);
  const selectedSuppliers = base.selectedSuppliers.length
    ? base.selectedSuppliers
    : draft.vendors.invitedSellers.map(supplierId => ({ supplierId }));

  const defaultValidity = base.rateValidityPeriod || (
    base.periodStartDate && base.periodEndDate
      ? calculateDurationBetweenDates(base.periodStartDate, base.periodEndDate)
      : (draft.serviceDetails.duration || '1 Year (12 Months)')
  );
  const unifiedPenalty = base.penaltyClause || draft.terms.penaltyClause || draft.serviceDetails.penaltyClause || '';

  return {
    ...draft,
    type: 'RATE_CONTRACT',
    basics: {
      ...draft.basics,
      isRepeatedSupply: true,
    },
    serviceDetails: {
      ...draft.serviceDetails,
      duration: draft.serviceDetails.duration || defaultValidity,
      penaltyClause: draft.serviceDetails.penaltyClause || unifiedPenalty,
    },
    terms: {
      ...draft.terms,
      penaltyClause: draft.terms.penaltyClause || unifiedPenalty,
    },
    rateContractConfig: {
      ...base,
      contractTitle: base.contractTitle || draft.basics.title,
      contractDescription: base.contractDescription || draft.basics.justification,
      contractCategory: base.contractCategory || draft.basics.category,
      selectedSuppliers,
      itemRateSchedule,
      rateValidityPeriod: defaultValidity,
      deliverySla: base.deliverySla || draft.terms.deliveryTerms,
      penaltyClause: unifiedPenalty,
      securityDepositRequired: false,
      securityDepositAmount: 0,
      approvalWorkflow: base.approvalWorkflow || draft.approval.workflow || 'Finance + Procurement',
    },
  };
};

export type ProcurementCategoryValue = 'GOODS' | 'SERVICES' | 'WORKS';
export type ProcurementPricingFormatValue = 'SINGLE_ITEM' | 'BOQ' | 'SOR';

export const CATEGORIES_BY_METHOD: Record<ProcurementMethodId, Array<{ value: ProcurementCategoryValue; label: string }>> = {
  RFQ: [
    { value: 'GOODS', label: 'Goods / Products' },
    { value: 'SERVICES', label: 'Services & Maintenance' }
  ],
  RFP: [
    { value: 'SERVICES', label: 'Services & Solutions' },
    { value: 'WORKS', label: 'Works & Construction' },
    { value: 'GOODS', label: 'Custom Goods / Machinery' }
  ],
  OPEN_TENDER: [
    { value: 'GOODS', label: 'Goods / Products' },
    { value: 'SERVICES', label: 'Services & Maintenance' },
    { value: 'WORKS', label: 'Works & Construction' }
  ],
  LIMITED_TENDER: [
    { value: 'GOODS', label: 'Goods / Products' },
    { value: 'SERVICES', label: 'Services & Maintenance' },
    { value: 'WORKS', label: 'Works & Construction' }
  ],
  REVERSE_AUCTION: [
    { value: 'GOODS', label: 'Goods / Commodities' },
    { value: 'SERVICES', label: 'Standardized Services' }
  ],
  RATE_CONTRACT: [
    { value: 'GOODS', label: 'Goods & Consumables' },
    { value: 'SERVICES', label: 'Recurring Services / Maintenance' }
  ],
  REPEAT_ORDER: [
    { value: 'GOODS', label: 'Goods / Products' },
    { value: 'SERVICES', label: 'Services & Maintenance' },
    { value: 'WORKS', label: 'Works & Construction' }
  ]
};

export const FORMATS_BY_METHOD: Record<ProcurementMethodId, Array<{ value: ProcurementPricingFormatValue; label: string }>> = {
  RFQ: [
    { value: 'SINGLE_ITEM', label: 'Single Item / Direct Catalog' },
    { value: 'BOQ', label: 'Multi-line BOQ (Bill of Quantities)' }
  ],
  RFP: [
    { value: 'BOQ', label: 'Multi-line BOQ (Milestones & Deliverables)' },
    { value: 'SOR', label: 'Schedule of Rates (SOR)' }
  ],
  OPEN_TENDER: [
    { value: 'SINGLE_ITEM', label: 'Single Item / Direct Catalog' },
    { value: 'BOQ', label: 'Multi-line BOQ (Bill of Quantities)' },
    { value: 'SOR', label: 'Schedule of Rates (SOR)' }
  ],
  LIMITED_TENDER: [
    { value: 'SINGLE_ITEM', label: 'Single Item / Direct Catalog' },
    { value: 'BOQ', label: 'Multi-line BOQ (Bill of Quantities)' }
  ],
  REVERSE_AUCTION: [
    { value: 'SINGLE_ITEM', label: 'Single Item / Live Auction' },
    { value: 'BOQ', label: 'Multi-line BOQ Total Auction' }
  ],
  RATE_CONTRACT: [
    { value: 'SOR', label: 'Schedule of Rates (SOR Rate Card)' },
    { value: 'BOQ', label: 'Multi-item Rate Schedule (BOQ)' }
  ],
  REPEAT_ORDER: [
    { value: 'SINGLE_ITEM', label: 'Single Item' },
    { value: 'BOQ', label: 'Multi-line BOQ' },
    { value: 'SOR', label: 'Schedule of Rates (SOR)' }
  ]
};

const applyMethodDefaults = (draft: Draft, method: ProcurementMethodId): Draft => {
  let updated = { ...draft, type: method };
  if (isReverseAuctionMethod(method)) {
    updated = syncAuctionDefaults(updated, method);
  } else if (isReverseAuctionMethod(draft.type)) {
    updated = {
      ...updated,
      basics: {
        ...updated.basics,
        isReverseAuctionNeeded: false,
      },
      auctionConfig: defaultAuctionConfig(method),
    };
  }
  if (isRateContractMethod(method)) updated = syncRateContractDefaults(updated);

  const allowedCategories = CATEGORIES_BY_METHOD[method] || CATEGORIES_BY_METHOD.RFQ;
  const allowedFormats = FORMATS_BY_METHOD[method] || FORMATS_BY_METHOD.RFQ;

  let nextCat = updated.basics.procurementCategory || 'GOODS';
  if (!allowedCategories.some(c => c.value === nextCat)) {
    nextCat = allowedCategories[0].value;
  }

  let nextFormat = updated.basics.pricingFormat || 'SINGLE_ITEM';
  if (!allowedFormats.some(f => f.value === nextFormat)) {
    nextFormat = allowedFormats[0].value;
  }

  updated = {
    ...updated,
    basics: {
      ...updated.basics,
      procurementCategory: nextCat,
      pricingFormat: nextFormat
    }
  };
  return updated;
};

const stepLibrary = {
  selection: { id: 'selection', label: 'Select Sourcing Method', description: 'Select the sourcing method', icon: ClipboardCheck },
  basics: { id: 'basics', label: 'Procurement Intent', description: 'Buyer type, title, value', icon: FileText },
  internal: { id: 'internal', label: 'Internal Details', description: 'Cost center, CFA & justifications', icon: ShieldCheck },
  items: { id: 'items', label: 'Item / Service / BOQ', description: 'Quantities, specs and BOQ items', icon: Package },
  vendors: { id: 'vendors', label: 'Suppliers', description: 'MSME reach, invite selection pool', icon: Users },
  schedule: { id: 'schedule', label: 'Timeline & Rules', description: 'Envelope bids & deadline schedules', icon: CalendarClock },
  terms: { id: 'terms', label: 'Commercial Terms', description: 'Payment, delivery', icon: BadgeCheck },
  documents: { id: 'documents', label: 'Required Documents', description: 'Checklists and validation requests', icon: Upload },
  evaluation: { id: 'evaluation', label: 'Evaluation Basis', description: 'L1 Lowest Landed Cost evaluation', icon: BarChart3 },
  publish: { id: 'publish', label: 'Approval & Publish', description: 'Summary review & workflow release', icon: BadgeCheck },
} as const;

const ALL_STEPS: StepKind[] = ['selection', 'basics', 'internal', 'items', 'vendors', 'schedule', 'terms', 'documents', 'evaluation', 'publish'];

const defaultRequiredDocs = (_method?: ProcurementMethodId): DocumentRow[] => {
  const docs: DocumentRow[] = [
    { id: 'gst', name: 'GST Certificate', required: true, fileType: 'pdf', maxSize: 5, instructions: 'Upload verified GST registration document.' },
    { id: 'pan', name: 'PAN Card', required: true, fileType: 'pdf', maxSize: 2, instructions: 'Upload official PAN card.' },
    { id: 'bank', name: 'Bank Details', required: true, fileType: 'pdf', maxSize: 2, instructions: 'Cancelled cheque or passbook.' },
    { id: 'tech_compliance', name: 'Technical Compliance Sheet', required: true, fileType: 'pdf,docx', maxSize: 10, instructions: 'Compliance report against specified standards.' },
    { id: 'financial_quote', name: 'Detailed Price Breakup', required: true, fileType: 'pdf,xlsx', maxSize: 5, instructions: 'Itemized cost schedule.' },
  ];

  return docs;
};

const defaultDraft = (type: ProcurementMethodId = 'RFQ'): Draft => ({
  type,
  basics: {
    title: '',
    procurementCategory: 'GOODS',
    pricingFormat: 'SINGLE_ITEM',
    category: 'Office Supplies & Stationery',
    department: '',
    priority: 'Normal',
    estimatedValue: 0,
    discloseEstimatedCost: false,
    requiredByDate: nextFortnightDateTime,
    deliveryLocation: '',
    isCatalogueAvailable: false,
    isOnlyOneVendor: false,
    isReverseAuctionNeeded: false,
    isTechnicalEvaluationNeeded: false,
    justification: '',
    isSpecClear: true,
    isRepeatedSupply: false,
    marketResearchOnly: false,
  },
  internal: {
    orgName: '',
    department: '',
    costCenter: '',
    budgetHead: '',
    projectCode: '',
    contactPerson: '',
    email: '',
    mobile: '',
    competentAuthority: '',
    approvalAuthority: '',
    internalFileNumber: '',
    justification: '',
    budgetConfirmed: false,
  },
  items: [],
  serviceDetails: {
    serviceTitle: '',
    scopeOfWork: '',
    deliverables: '',
    inclusions: '',
    exclusions: '',
    slaResponseTime: '',
    duration: '',
    manpowerRequired: '0',
    experienceRequired: '0',
    milestones: [],
    penaltyClause: '',
    location: '',
    sowFileAssetId: null,
    sowFileName: '',
    sowFileUrl: '',
  },
  boqTable: [],
  boqFileAssetId: null,
  boqFileName: '',
  vendors: {
    selection: 'Open',
    inviteCount: 0,
    msmePreference: true,
    localVendorPreference: false,
    excludeBlacklisted: true,
    selectedSellerId: null,
    selectedSellerName: '',
    selectedSellerCode: '',
    invitedSellers: [],
  },
  schedule: {
    packetType: 'Single',
    publishDate: todayDateTime,
    submissionDate: nextWeekDateTime,
    validityDays: 90,
    submissionStartDate: todayDateTime,
    clarificationAllowed: true,
    technicalOpeningDate: '',
    financialOpeningDate: '',
    bidValidityDate: nextFortnight,
    autoClose: true,
    minimumBidders: 3,
  },
  terms: {
    paymentTerms: 'ON_DELIVERY',
    deliveryTerms: 'Door delivery to site',
    freightIncluded: true,
    gstIncluded: false,
    warrantyTerms: '',
    penaltyClause: '',
    advanceAllowed: false,
    retentionAmount: 0,
    securityDeposit: 0,
    documentFee: 0,
  },
  requiredDocs: defaultRequiredDocs(type),
  evaluation: {
    method: 'L1 total value',
    techWeight: 70,
    commWeight: 30,
    minQualifyingMarks: 60,
    technicalCriteria: [],
  },
  approval: {
    workflow: 'Single Stage (Commercial Only)',
    approver: '',
    notes: '',
  },
  auctionConfig: defaultAuctionConfig(type),
  rateContractConfig: defaultRateContractConfig(),
  rfqType: '',
  questionnaire: [],
  requireDemo: false,
  tenderType: '',
  limitedTenderJustification: '',
  sealedSubmissionFlag: false,
});

export default function CreateProcurementPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  const { orgStatus } = useOrgRole();
  const resolvedOrgName = useMemo(() => getResolvedOrgName(user, orgStatus), [user, orgStatus]);
  const resolvedAddress = useMemo(() => getResolvedBuyerAddress(user, orgStatus), [user, orgStatus]);
  const resolvedAddressInfo = useMemo(() => getResolvedBuyerAddressInfo(user, orgStatus), [user, orgStatus]);
  const { data: activeCart, isLoading: isCartLoading } = useActiveCart({ enabled: true });
  const searchParams = useSearchParams();
  const draftIdParam = searchParams?.get('id') || searchParams?.get('draftId');
  const fromCart = searchParams?.get('fromCart') === '1';

  const userRef = React.useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const initialMethod = useMemo<ProcurementMethodId>(
    () => normalizeProcurementMethod(searchParams?.get('method'), 'RFQ'),
    [searchParams]
  );

  const [draft, setDraft] = useState<Draft>(() => {
    let cachedOrg = '';
    let cachedAddress = '';
    if (typeof window !== 'undefined') {
      try {
        const rawUser = localStorage.getItem('msme_user_cache');
        if (rawUser) {
          const parsedUser = JSON.parse(rawUser);
          cachedOrg = getResolvedOrgName(parsedUser);
          cachedAddress = getResolvedBuyerAddress(parsedUser);
        }
      } catch {
        // ignore
      }
      try {
        const raw = localStorage.getItem('msme:guided-procurement-create:v2');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && typeof saved === 'object') {
            if (Array.isArray(saved.items)) {
              saved.items = saved.items.map((it: any, idx: number) => normalizeDraftItem(it, idx));
            }
            if (saved.internal && !saved.internal.orgName && cachedOrg) {
              saved.internal.orgName = cachedOrg;
            }
            if (saved.basics && !saved.basics.deliveryLocation && cachedAddress) {
              saved.basics.deliveryLocation = cachedAddress;
            }
            if (saved.schedule) {
              saved.schedule = {
                ...saved.schedule,
                submissionStartDate: saved.schedule.submissionStartDate || '',
                submissionDate: saved.schedule.submissionDate || '',
                technicalOpeningDate: saved.schedule.technicalOpeningDate || '',
                financialOpeningDate: saved.schedule.financialOpeningDate || '',
              };
            }
            if (saved.auctionConfig) {
              saved.auctionConfig = {
                ...saved.auctionConfig,
                startDateTime: saved.auctionConfig.startDateTime || '',
                endDateTime: saved.auctionConfig.endDateTime || '',
              };
            }
            return saved;
          }
        }
      } catch (e) {
        console.error('Failed to load local draft from localStorage', e);
      }
    }
    const def = defaultDraft(initialMethod);
    if (cachedOrg) {
      def.internal.orgName = cachedOrg;
    }
    if (cachedAddress) {
      def.basics.deliveryLocation = cachedAddress;
    }
    return def;
  });
  const draftIdRef = React.useRef<number | undefined>(draft?.id);
  useEffect(() => {
    if (draft?.id) {
      draftIdRef.current = draft.id;
    }
  }, [draft?.id]);
  const [activeStep, setActiveStep] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('msme:guided-procurement-create:v2');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && typeof saved.draftStep === 'number') {
            return saved.draftStep;
          }
        }
      } catch (e) {
        console.error('Failed to load local draft activeStep from localStorage', e);
      }
    }
    return 0;
  });
  const [completedStepIds, setCompletedStepIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const ids = saved?.completedStepIds || saved?.completedSteps;
          if (Array.isArray(ids)) return ids;
          if (typeof saved?.draftStep === 'number') {
            return ALL_STEPS.slice(0, saved.draftStep);
          }
        }
      } catch (e) {
        console.error('Failed to parse completedStepIds from localStorage', e);
      }
    }
    return [];
  });
  const [maxVisitedStep, setMaxVisitedStep] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (typeof saved?.maxVisitedStep === 'number') return saved.maxVisitedStep;
          if (typeof saved?.draftStep === 'number') return saved.draftStep;
        }
      } catch (e) {
        console.error('Failed to parse maxVisitedStep from localStorage', e);
      }
    }
    return 0;
  });
  const changeActiveStep = (newIdx: number) => {
    setActiveStep(newIdx);
    setMaxVisitedStep(prev => Math.max(prev, newIdx));
  };
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [triedNext, setTriedNext] = useState(false);
  const [legalComplianceAccepted, setLegalComplianceAccepted] = useState(false);
  const [showItemDrawer, setShowItemDrawer] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<ItemRow | null>(null);
  const [hasAutofilled, setHasAutofilled] = useState(false);
  const [isMobileStepperOpen, setIsMobileStepperOpen] = useState(false);

  // A cart-to-RFQ launch is a new procurement intent. Prefer the live cart over
  // any draft left in localStorage, force RFQ, and populate the same normalized
  // item rows used by the manual "Import Cart" action.
  useEffect(() => {
    if (!fromCart || draftIdParam || !activeCart?.items?.length) return;

    const importedItems = activeCart.items.map(cartItemToProcurementItem);
    const totals = computeProcurementTotals(importedItems);
    const hasServices = activeCart.items.some(i => Boolean(i.service || i.serviceId));
    const hasProducts = activeCart.items.some(i => !i.service && !i.serviceId);
    const detectedCategory: 'GOODS' | 'SERVICES' = (hasServices && !hasProducts) ? 'SERVICES' : 'GOODS';

    setDraft(current => {
      const next = {
        ...current,
        type: 'RFQ' as ProcurementMethodId,
        basics: {
          ...current.basics,
          procurementCategory: detectedCategory,
          pricingFormat: 'SINGLE_ITEM' as const,
          title: current.basics.title || (detectedCategory === 'SERVICES' ? 'Request for Quotation - Services from Cart' : 'Request for Quotation from Cart'),
          estimatedValue: Math.round(totals.grossValue),
        },
        items: importedItems,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      return next;
    });
    setActiveStep(0);
    setMaxVisitedStep(0);
    setHasAutofilled(true);
  }, [fromCart, draftIdParam, activeCart]);

  // Lock body scroll when item drawer is open to prevent window scroll lock conflict
  useEffect(() => {
    if (showItemDrawer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showItemDrawer]);

  // Auto-fill and reactively keep buyer details, organization, and delivery address in sync from authenticated profile
  useEffect(() => {
    if (!user && !orgStatus) return;
    const u = user as any;
    const org = resolvedOrgName || u?.organization?.organizationName || u?.buyerProfile?.organizationName || '';
    const department = u?.buyerProfile?.department || '';
    const contactPerson = u?.buyerProfile?.representativeName || u?.name || '';
    const email = u?.buyerProfile?.email || u?.email || '';
    const mobile = u?.buyerProfile?.mobile || u?.mobile || '';
    const addr = resolvedAddress;

    setDraft(current => {
      let changed = false;
      const nextInternal = { ...current.internal };
      const nextBasics = { ...current.basics };

      if (!nextBasics.deliveryLocation?.trim() && addr) {
        nextBasics.deliveryLocation = addr;
        changed = true;
      }
      if (!nextInternal.orgName?.trim() && org) {
        nextInternal.orgName = org;
        changed = true;
      }
      if (!nextInternal.department?.trim() && department) {
        nextInternal.department = department;
        changed = true;
      }
      if (!nextInternal.contactPerson?.trim() && contactPerson) {
        nextInternal.contactPerson = contactPerson;
        changed = true;
      }
      if (!nextInternal.email?.trim() && email) {
        nextInternal.email = email;
        changed = true;
      }
      if (!nextInternal.mobile?.trim() && mobile) {
        nextInternal.mobile = mobile;
        changed = true;
      }

      if (!changed) return current;

      const nextDraft = { ...current, basics: nextBasics, internal: nextInternal };
      if (!draftIdParam && typeof window !== 'undefined') {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
        } catch {
          // ignore
        }
      }
      return nextDraft;
    });
    setHasAutofilled(true);
  }, [user, orgStatus, resolvedOrgName, resolvedAddress, draftIdParam]);

  // Save activeStep and updatedAt when activeStep changes for local draft
  useEffect(() => {
    if (!draftIdParam) {
      queueMicrotask(() => {
        setDraft(current => {
          if (current.draftStep === activeStep && current.maxVisitedStep === maxVisitedStep) return current;
          const next = { ...current, draftStep: activeStep, maxVisitedStep, completedStepIds, completedSteps: completedStepIds, updatedAt: new Date().toISOString() };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
          return next;
        });
      });
    }
  }, [activeStep, maxVisitedStep, completedStepIds, draftIdParam]);

  // Load draft
  useEffect(() => {
    if (!draftIdParam) return;
    const id = parseInt(draftIdParam, 10);
    if (isNaN(id)) return;

    fetchProcurementDraft(id)
      .then((res) => {
        const payload = res?.payload;
        if (!payload) return;

        const base = defaultDraft(payload.type || 'RFQ');

        const u = userRef.current as any;
        const orgName = resolvedOrgName || u?.organization?.organizationName || u?.buyerProfile?.organizationName || '';
        const department = u?.buyerProfile?.department || '';
        const contactPerson = u?.buyerProfile?.representativeName || u?.name || '';
        const email = u?.buyerProfile?.email || u?.email || '';
        const mobile = u?.buyerProfile?.mobile || u?.mobile || '';

        const internalPayload = payload.internal || {};

        draftIdRef.current = res.id;
        setDraft({
          ...base,
          ...payload,
          id: res.id,
          basics: {
            ...base.basics,
            ...(payload.basics || {}),
            procurementCategory: payload.basics?.procurementCategory || 'GOODS',
            pricingFormat: payload.basics?.pricingFormat || (payload.type === 'RATE_CONTRACT' ? 'SOR' : 'SINGLE_ITEM'),
            estimatedValue: Number(payload.basics?.estimatedValue || res.estimatedValue || base.basics.estimatedValue || 0),
            discloseEstimatedCost: Boolean(payload.basics?.discloseEstimatedCost ?? payload.discloseEstimatedCost ?? (res as any)?.discloseEstimatedCost ?? false),
            deliveryLocation: payload.basics?.deliveryLocation || payload.tender?.deliveryLocation || base.basics.deliveryLocation || resolvedAddress || ''
          },
          internal: {
            ...base.internal,
            ...internalPayload,
            orgName: (internalPayload.orgName || '').trim() || orgName,
            department: internalPayload.department || department,
            contactPerson: internalPayload.contactPerson || contactPerson,
            email: internalPayload.email || email,
            mobile: internalPayload.mobile || mobile,
          },
          serviceDetails: {
            ...base.serviceDetails,
            ...(payload.serviceDetails || {}),
            serviceTitle: payload.serviceDetails?.serviceTitle || payload.basics?.title || res.title || base.serviceDetails.serviceTitle || '',
          },
          vendors: {
            ...base.vendors,
            ...(payload.vendors || {}),
            inviteCount: Array.isArray(payload.vendors?.invitedSellers)
              ? Math.max(payload.vendors.invitedSellers.length, Number(payload.vendors?.inviteCount) || 0)
              : (Number(payload.vendors?.inviteCount) || 0)
          },
          schedule: {
            ...base.schedule,
            ...(payload.schedule || {}),
            submissionStartDate: payload.schedule?.submissionStartDate || base.schedule.submissionStartDate || '',
            submissionDate: payload.schedule?.submissionDate || base.schedule.submissionDate || '',
            technicalOpeningDate: payload.schedule?.technicalOpeningDate || '',
            financialOpeningDate: payload.schedule?.financialOpeningDate || '',
          },
          terms: { ...base.terms, ...(payload.terms || {}) },
          evaluation: {
            ...base.evaluation,
            ...(payload.evaluation || {}),
            method: payload.evaluation?.method || payload.evaluationMethod || payload.rules?.evaluationMethod || payload.evaluation?.evaluationMethod || base.evaluation.method
          },
          approval: {
            ...base.approval,
            ...(payload.approval || {}),
            workflow: (payload.schedule?.packetType === 'Two' || payload.packetType === 'Two')
              ? 'Two-Stage (Technical + Financial)'
              : 'Single Stage (Commercial Only)',
          },
          auctionConfig: {
            ...base.auctionConfig,
            ...(payload.auctionConfig || payload.rules?.auctionConfig || {}),
            startDateTime: (payload.auctionConfig?.startDateTime || payload.rules?.auctionConfig?.startDateTime || base.auctionConfig.startDateTime || ''),
            endDateTime: (payload.auctionConfig?.endDateTime || payload.rules?.auctionConfig?.endDateTime || base.auctionConfig.endDateTime || ''),
            termsDocumentName: (payload.auctionConfig?.termsDocumentName === 'NOT REQUIRED' || payload.rules?.auctionConfig?.termsDocumentName === 'NOT REQUIRED')
              ? ''
              : (payload.auctionConfig?.termsDocumentName || payload.rules?.auctionConfig?.termsDocumentName || base.auctionConfig.termsDocumentName || '')
          },
          rateContractConfig: {
            ...base.rateContractConfig,
            ...(payload.rateContractConfig || payload.rateContract || {}),
          },
          items: Array.isArray(payload.items) ? payload.items.map((it: any, idx: number) => normalizeDraftItem(it, idx)) : base.items,
          boqTable: Array.isArray(payload.boqTable) ? payload.boqTable : base.boqTable,
          requiredDocs: Array.isArray(payload.requiredDocs) ? payload.requiredDocs : base.requiredDocs,
        });
        const loadedStep = res.draftStep || 0;
        const loadedCompletedStepIds = Array.from(new Set([
          ...(payload.completedStepIds || payload.completedSteps || []),
          ...ALL_STEPS.slice(0, loadedStep)
        ]));
        const loadedMax = Math.max(
          loadedStep,
          payload.maxVisitedStep || 0,
          loadedCompletedStepIds.length > 0 ? ALL_STEPS.indexOf(loadedCompletedStepIds[loadedCompletedStepIds.length - 1]) : 0
        );
        setCompletedStepIds(loadedCompletedStepIds);
        setMaxVisitedStep(loadedMax);
        setActiveStep(loadedStep);
      })
      .catch((err) => {
        toast.error('Failed to load draft: ' + err.message);
      });
  }, [draftIdParam]);

  const updateDraft = (updater: (current: Draft) => Draft) => {
    setDraft(current => {
      const next = { ...updater(current), maxVisitedStep, completedStepIds, completedSteps: completedStepIds, updatedAt: new Date().toISOString() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Sourcing Validation Checklist
  const getReadiness = (d: Draft) => {
    const list: Array<{ label: string; ok: boolean; severity: 'error' | 'warning' | 'info'; stepIdx?: number }> = [];
    
    // Step 0 Selection - Errors
    list.push({ label: 'Sourcing Method is selected', ok: Boolean(d.type), severity: 'error', stepIdx: 0 });

    // Step 1 Basics - Errors
    list.push({ label: 'Title is required (min 3 chars)', ok: d.basics.title.trim().length >= 3, severity: 'error', stepIdx: 1 });
    list.push({ label: 'Estimated budget must be set (> 0)', ok: d.basics.estimatedValue > 0, severity: 'error', stepIdx: 1 });
    list.push({ label: 'Required by date & time is required', ok: Boolean(d.basics.requiredByDate), severity: 'error', stepIdx: 1 });
    list.push({ label: 'Delivery location is required', ok: d.basics.deliveryLocation.trim().length > 0, severity: 'error', stepIdx: 1 });
    const isLimitedSourcing = d.type === 'LIMITED_TENDER' || (d.type === 'RFQ' && d.rfqType === 'LIMITED');
    if (isLimitedSourcing) {
      const just = (d.limitedTenderJustification || d.basics.justification || '').trim();
      list.push({
        label: 'Limited Tender / RFQ requires a written justification (min 15 chars)',
        ok: just.length >= 15,
        severity: 'error',
        stepIdx: 1
      });
    }

    // Step 2 Internal Details - Errors
    list.push({ label: 'Internal Org Name is required', ok: d.internal.orgName.trim().length > 0, severity: 'error', stepIdx: 2 });

    // Step 3 Sourcing specification items - Errors
    // Total procurement quantity drives the auto-generated consignee. If it is 0, the backend
    // rejects submit with "Total consignee quantity must equal total procurement quantity", so
    // gate it here on the Items step where the user can actually fix it.
    const totalProcurementQty = getTotalProcurementQty(d);

    // For RFP method, Scope of Work (SOW) dossier or detailed justification is mandatory
    if (d.type === 'RFP') {
      const hasSowDoc = Boolean(d.serviceDetails.sowFileAssetId || d.serviceDetails.sowFileName || d.boqFileName);
      const sowLen = (d.serviceDetails.scopeOfWork || d.basics.justification || d.internal.justification || d.approval.notes || '').trim().length;
      list.push({
        label: hasSowDoc ? 'RFP Scope of Work (SOW / BOQ Document Attached)' : 'RFP Scope of Work / SOW Document is required (min 10 chars or upload SOW document)',
        ok: hasSowDoc || sowLen >= 10,
        severity: 'error',
        stepIdx: 3
      });
    }

    const isBoqSchedule = d.basics.pricingFormat === 'BOQ' || d.basics.pricingFormat === 'SOR';
    const isServiceContract = d.basics.procurementCategory === 'SERVICES';

    if (isBoqSchedule) {
      list.push({ label: d.basics.procurementCategory === 'WORKS' ? 'At least one Work Schedule / BOQ item is required' : 'At least one BOQ item is required', ok: d.boqTable.length > 0 && d.boqTable.some(r => r.description.trim()), severity: 'error', stepIdx: 3 });
      if (d.boqTable.length > 0) {
        list.push({ label: 'All BOQ rows must have positive quantities & rates', ok: d.boqTable.every(r => r.quantity > 0 && r.estimatedRate >= 0), severity: 'error', stepIdx: 3 });
      }
      list.push({ label: 'Total BOQ quantity must be greater than 0', ok: totalProcurementQty > 0, severity: 'error', stepIdx: 3 });
    } else if (isServiceContract) {
      const serviceTitle = (d.serviceDetails.serviceTitle || d.basics.title || '').trim();
      const hasSowDoc = Boolean(d.serviceDetails.sowFileAssetId || d.serviceDetails.sowFileName);
      list.push({ label: 'Service Contract Title is required', ok: serviceTitle.length > 0, severity: 'error', stepIdx: 3 });
      list.push({
        label: hasSowDoc ? 'Service Scope of Work (SOW Document Attached)' : 'Service Contract SOW is required (min 10 chars or upload SOW document)',
        ok: hasSowDoc || d.serviceDetails.scopeOfWork.trim().length >= 10,
        severity: 'error',
        stepIdx: 3
      });
      list.push({
        label: hasSowDoc ? 'Key Deliverables & Milestones (Covered in SOW Document)' : 'Service Deliverables list is required (min 3 chars or upload SOW document)',
        ok: hasSowDoc || d.serviceDetails.deliverables.trim().length >= 3,
        severity: 'error',
        stepIdx: 3
      });
      if (!isRateContractMethod(d.type)) {
        list.push({ label: 'Service Duration is required', ok: d.serviceDetails.duration.trim().length > 0, severity: 'error', stepIdx: 3 });
      }
      list.push({ label: 'Add at least one service line with quantity > 0', ok: totalProcurementQty > 0, severity: 'error', stepIdx: 3 });
    } else {
      list.push({ label: 'At least one product item is required', ok: d.items.length > 0, severity: 'error', stepIdx: 3 });
      if (d.items.length > 0) {
        list.push({ label: 'All product items must have valid name & quantity > 0', ok: d.items.every(i => i.name.trim().length > 0 && i.quantity > 0), severity: 'error', stepIdx: 3 });
      }
      list.push({ label: 'Total item quantity must be greater than 0', ok: totalProcurementQty > 0, severity: 'error', stepIdx: 3 });
    }

    // Step 4 Sourcing reach - Errors
    if (d.vendors.selection !== 'Open' || isLimitedSourcing) {
      list.push({ label: 'At least one invited supplier is required for non-open / limited sourcing', ok: (d.vendors.invitedSellers || []).length > 0, severity: 'error', stepIdx: 4 });
    }

    // Step 5 Event timeline - Errors
    list.push({ label: 'Submission deadline date is required', ok: Boolean(d.schedule.submissionDate), severity: 'error', stepIdx: 5 });
    if (d.schedule.submissionDate) {
      list.push({
        label: 'Submission deadline must be set in the future',
        ok: new Date(d.schedule.submissionDate).getTime() > Date.now(),
        severity: 'error',
        stepIdx: 5
      });
    }
    if (d.schedule.submissionDate && d.schedule.submissionStartDate) {
      list.push({ label: 'Submission deadline must be after submission start date', ok: new Date(d.schedule.submissionDate) > new Date(d.schedule.submissionStartDate), severity: 'error', stepIdx: 5 });
    }
    if (d.basics.isTechnicalEvaluationNeeded || d.schedule.packetType === 'Two') {
      list.push({ label: 'Technical opening date is required', ok: Boolean(d.schedule.technicalOpeningDate), severity: 'error', stepIdx: 5 });
      if (d.schedule.technicalOpeningDate && d.schedule.submissionDate) {
        list.push({ label: 'Technical opening date must be after submission deadline', ok: new Date(d.schedule.technicalOpeningDate) > new Date(d.schedule.submissionDate), severity: 'error', stepIdx: 5 });
      }
    }
    if (d.schedule.packetType === 'Two') {
      list.push({ label: 'Financial opening date is required for two packet flows', ok: Boolean(d.schedule.financialOpeningDate), severity: 'error', stepIdx: 5 });
      if (d.schedule.financialOpeningDate && d.schedule.technicalOpeningDate) {
        list.push({ label: 'Financial opening date must be after technical envelope opening', ok: new Date(d.schedule.financialOpeningDate) > new Date(d.schedule.technicalOpeningDate), severity: 'error', stepIdx: 5 });
      }
    }
    const hasReverseAuction = isReverseAuctionMethod(d.type) || Boolean(d.basics.isReverseAuctionNeeded);
    if (hasReverseAuction) {
      const isStandaloneRA = isReverseAuctionMethod(d.type);
      const isStartingBidValid = isStandaloneRA
        ? (d.auctionConfig.startingBidPrice > 0 || (d.auctionConfig.startingBidPrice === -1 && d.basics.estimatedValue > 0))
        : (d.auctionConfig.startingBidPrice > 0 || d.auctionConfig.startingBidPrice === -1);
      list.push({
        label: 'Reverse auction starting opening price must be set (> 0)',
        ok: isStartingBidValid,
        severity: 'error',
        stepIdx: 8
      });
      list.push({ label: 'Reverse auction minimum bid decrement must be greater than 0', ok: d.auctionConfig.minimumBidDecrement > 0, severity: 'error', stepIdx: 8 });
      list.push({ label: 'Reverse auction duration must be greater than 0 minutes', ok: (d.auctionConfig.durationMinutes || 0) > 0, severity: 'error', stepIdx: 8 });
      if (d.auctionConfig.reservePrice !== null && d.auctionConfig.startingBidPrice > 0) {
        list.push({ label: 'Reserve price cannot exceed starting price', ok: d.auctionConfig.reservePrice <= d.auctionConfig.startingBidPrice, severity: 'error', stepIdx: 8 });
      }
    }

    if (isRateContractMethod(d.type)) {
      list.push({
        label: 'Rate Contract Validity Period is required',
        ok: Boolean(d.rateContractConfig.rateValidityPeriod?.trim()),
        severity: 'error',
        stepIdx: 5
      });
    }

    // Step 6 Commercial Terms - Errors
    list.push({ label: 'Payment terms are required', ok: Boolean(d.terms.paymentTerms), severity: 'error', stepIdx: 6 });
    list.push({ label: 'Delivery terms are required', ok: Boolean(d.terms.deliveryTerms), severity: 'error', stepIdx: 6 });
    list.push({
      label: 'Penalty clause is required',
      ok: Boolean((d.terms.penaltyClause || d.rateContractConfig.penaltyClause || d.serviceDetails.penaltyClause || '').trim()),
      severity: 'error',
      stepIdx: 6
    });

    // Step 7 Documents - Errors
    list.push({ label: 'At least one required document must be checklist', ok: d.requiredDocs.length > 0, severity: 'error', stepIdx: 7 });
    
    // Step 8 Evaluation criteria - Errors
    list.push({ label: 'Evaluation method is required', ok: Boolean(d.evaluation.method), severity: 'error', stepIdx: 8 });
    // QCBS weightage check commented out as requested
    // if (d.evaluation.method === 'QCBS / weighted technical-commercial score') {
    //   const qcbsTotal = d.evaluation.technicalCriteria.reduce((sum, c) => sum + Number(c.weightage || 0), 0);
    //   list.push({ label: 'QCBS evaluation weightage sum must be exactly 100%', ok: qcbsTotal === 100, severity: 'error', stepIdx: 7 });
    // }

    // Warnings / Advisories
    if (d.basics.isOnlyOneVendor) {
      list.push({
        label: 'Only one vendor justification note is short (recommend min 15 chars)',
        ok: d.internal.justification.trim().length >= 15,
        severity: 'warning'
      });
    }
   
    if (d.basics.priority === 'Emergency') {
      const hasEmergencyDoc = d.requiredDocs.some(doc => doc.name.toLowerCase().includes('emergency') || doc.name.toLowerCase().includes('justification'));
      list.push({
        label: 'Emergency procurement priority selected: emergency approval file is recommended in checklist.',
        ok: hasEmergencyDoc,
        severity: 'warning'
      });
    }

    // Info (Sourcing Overrides)
    const customDocs = d.requiredDocs.filter(doc => !['PAN Card', 'GST Certificate', 'MSME Certificate', 'Technical Proposal', 'Sanction Letter'].includes(doc.name));
    customDocs.forEach(c => {
      list.push({ label: `Custom document checklist added: "${c.name}"`, ok: true, severity: 'info' });
    });
    
    return list;
  };

  const readiness = useMemo(() => getReadiness(draft), [draft]);

  const completionPercentage = useMemo(() => {
    const valid = readiness.filter(r => r.ok).length;
    return Math.round((valid / readiness.length) * 100);
  }, [readiness]);
  
  const isStepValid = (d: Draft, stepIdx: number): boolean => {
    if (stepIdx === 0) {
      return Boolean(d.type);
    } else if (stepIdx === 1) {
      if (d.basics.title.trim().length < 3) return false;
      if (d.basics.estimatedValue <= 0) return false;
      if (!d.basics.requiredByDate) return false;
      if (!d.basics.deliveryLocation.trim()) return false;
      const isLimited = d.type === 'LIMITED_TENDER' || (d.type === 'RFQ' && d.rfqType === 'LIMITED');
      if (isLimited && (d.limitedTenderJustification || d.basics.justification || '').trim().length < 15) return false;
    } else if (stepIdx === 2) {
      if (!d.internal.orgName.trim()) return false;
      if (!d.internal.contactPerson.trim()) return false;
      if (!d.internal.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.internal.email.trim())) return false;
      if (!d.internal.mobile.trim() || !/^\d{10}$/.test(d.internal.mobile.trim())) return false;
    } else if (stepIdx === 3) {
      if (d.type === 'RFP') {
        const hasSowDoc = Boolean(d.serviceDetails.sowFileAssetId || d.serviceDetails.sowFileName || d.boqFileName);
        const sowLen = (d.serviceDetails.scopeOfWork || d.basics.justification || d.internal.justification || d.approval.notes || '').trim().length;
        if (!hasSowDoc && sowLen < 10) return false;
      }
      const isBoqSchedule = d.basics.pricingFormat === 'BOQ' || d.basics.pricingFormat === 'SOR';
      const isServiceContract = d.basics.procurementCategory === 'SERVICES';
      if (isBoqSchedule) {
        if (d.boqTable.length === 0 || !d.boqTable.some(r => r.description.trim())) return false;
        if (d.boqTable.some(r => r.quantity <= 0 || r.estimatedRate < 0)) return false;
      } else if (isServiceContract) {
        const title = (d.serviceDetails.serviceTitle || d.basics.title || '').trim();
        if (!title) return false;
        const hasSowDoc = Boolean(d.serviceDetails.sowFileAssetId || d.serviceDetails.sowFileName);
        if (!hasSowDoc && d.serviceDetails.scopeOfWork.trim().length < 10) return false;
        if (!hasSowDoc && d.serviceDetails.deliverables.trim().length < 3) return false;
        if (!isRateContractMethod(d.type) && !d.serviceDetails.duration.trim()) return false;
      } else {
        if (d.items.length === 0 || d.items.some(i => !i.name.trim() || i.quantity <= 0)) return false;
      }
    } else if (stepIdx === 4) {
      if (d.vendors.selection !== 'Open' && (!d.vendors.invitedSellers || d.vendors.invitedSellers.length === 0)) return false;
      if (isReverseAuctionMethod(d.type) && d.vendors.selection !== 'Open' && d.vendors.invitedSellers.length < d.auctionConfig.minimumQualifiedBidders) return false;
      if (isRateContractMethod(d.type) && d.vendors.selection !== 'Open' && d.rateContractConfig.selectedSuppliers.length === 0 && d.vendors.invitedSellers.length === 0) return false;
    } else if (stepIdx === 5) {
      if (!d.schedule.submissionDate) return false;
      const nowTime = new Date(d.schedule.submissionStartDate).getTime();
      const endTime = new Date(d.schedule.submissionDate).getTime();
      if (endTime <= Date.now()) return false;
      if (endTime <= nowTime) return false;
      if (d.basics.isTechnicalEvaluationNeeded || d.schedule.packetType === 'Two') {
        if (!d.schedule.technicalOpeningDate) return false;
        if (new Date(d.schedule.technicalOpeningDate) <= new Date(d.schedule.submissionDate)) return false;
      }
      if (d.schedule.packetType === 'Two') {
        if (!d.schedule.financialOpeningDate) return false;
        if (new Date(d.schedule.financialOpeningDate) <= new Date(d.schedule.technicalOpeningDate)) return false;
      }
      if (isReverseAuctionMethod(d.type)) {
        const auction = d.auctionConfig;
        const start = new Date(auction.startDateTime).getTime();
        const end = new Date(auction.endDateTime).getTime();
        const title = (auction.auctionTitle || d.basics.title || '').trim();
        const category = (auction.auctionCategory || d.basics.category || '').trim();
        const currency = (auction.currency || 'INR').trim();
        if (!title) return false;
        if (!category || category === 'Other') return false;
        if (!currency || currency === 'Other') return false;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return false;
        if (auction.durationMinutes <= 0) return false;
        if (auction.startingBidPrice !== -1 && auction.startingBidPrice <= 0) return false;
        if (auction.startingBidPrice === -1 && d.basics.estimatedValue <= 0) return false;
        if (auction.startingBidPrice !== -1 && auction.reservePrice !== null && auction.reservePrice > auction.startingBidPrice) return false;
        if (auction.minimumBidDecrement <= 0) return false;
        if (auction.autoExtensionEnabled && (
          auction.extensionTriggerMinutes <= 0 ||
          auction.extensionDurationMinutes <= 0 ||
          auction.maximumExtensions <= 0
        )) return false;
      }
      if (d.basics.isReverseAuctionNeeded) {
        if (d.auctionConfig.minimumBidDecrement <= 0) return false;
        if (d.auctionConfig.startingBidPrice !== -1 && d.auctionConfig.reservePrice !== null && d.auctionConfig.reservePrice > d.auctionConfig.startingBidPrice) return false;
      }
      if (isRateContractMethod(d.type)) {
        const contract = d.rateContractConfig;
        const start = new Date(contract.periodStartDate).getTime();
        const end = new Date(contract.periodEndDate).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return false;
        if (!contract.rateValidityPeriod.trim()) return false;
        if (contract.callOffOrderAllowed && contract.maximumOrderQuantityPerCallOff > 0 && contract.maximumOrderQuantityPerCallOff < contract.minimumOrderQuantity) return false;
      }
    } else if (stepIdx === 6) {
      if (!d.terms.paymentTerms) return false;
      if (!d.terms.deliveryTerms) return false;
    } else if (stepIdx === 7) {
      if (d.requiredDocs.length === 0) return false;
    } else if (stepIdx === 8) {
      if (!d.evaluation.method) return false;
      if (d.basics.isReverseAuctionNeeded && d.auctionConfig.minimumBidDecrement <= 0) return false;
    }
    return true;
  };

  const effectiveCompletedSteps = useMemo(() => {
    return ALL_STEPS.filter((stepId, idx) => {
      const isVisitedOrRecorded = completedStepIds.includes(stepId) || idx <= maxVisitedStep || idx < activeStep;
      return isVisitedOrRecorded && isStepValid(draft, idx);
    });
  }, [completedStepIds, draft, activeStep, maxVisitedStep]);

  // Save Draft to Backend
  const saveDraftLocally = async (silent = false, stepOverride?) => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const stepToSave = stepOverride !== undefined ? stepOverride : activeStep;
      const effectiveDraftId = draftIdRef.current || draft.id;
      const currentDraftWithId = {
        ...draft,
        id: effectiveDraftId
      };
      const payload = buildProcurementApiPayload(currentDraftWithId, stepToSave);
      let savedAsNewDraft = false;
      let res: any;
      try {
        res = await saveProcurementDraft(payload);
      } catch (err) {
        if (!payload.id || !shouldRetryDraftSaveAsNew(err)) {
          throw err;
        }
        res = await saveProcurementDraft(withoutServerDraftId(payload));
        savedAsNewDraft = true;
      }
      const serverId = Number(res?.id || res?.data?.id || effectiveDraftId || draft.id || 0);
      if (serverId) {
        draftIdRef.current = serverId;
        updateDraft(current => ({ ...current, id: serverId }));
        if (typeof window !== 'undefined' && !draftIdParam) {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('id', String(serverId));
            window.history.replaceState(null, '', url.toString());
          } catch {}
        }
      }
      if (!silent) toast.success(savedAsNewDraft ? 'Draft saved as a new draft' : 'Draft saved successfully');
    } catch (err: any) {
      if (!silent) toast.error(err?.message ? `Failed to save draft: ${err.message}` : 'Failed to save draft on server');
    } finally {
      setSavingDraft(false);
    }
  };

  // Validations per Step
  const validateStep = (stepIdx: number): boolean => {
    const d = draft;
    if (stepIdx === 0) {
      // Step 0 Selection
      if (!d.type) {
        toast.error('Please select a sourcing method.');
        return false;
      }
    } else if (stepIdx === 1) {
      // Step 1 Basics
      if (d.basics.title.trim().length < 3) {
        toast.error('Procurement title is required (min 3 chars).');
        return false;
      }
      if (d.basics.estimatedValue <= 0) {
        toast.error('Estimated value must be greater than 0.');
        return false;
      }
      if (!d.basics.requiredByDate) {
        toast.error('Required by date & time is required.');
        return false;
      }
      if (!d.basics.deliveryLocation.trim()) {
        toast.error('Delivery location is required.');
        return false;
      }
      const isLimitedSourcing = d.type === 'LIMITED_TENDER' || (d.type === 'RFQ' && d.rfqType === 'LIMITED');
      if (isLimitedSourcing) {
        const just = (d.limitedTenderJustification || d.basics.justification || '').trim();
        if (just.length < 15) {
          toast.error('Limited Tender / RFQ requires a written justification of at least 15 characters.');
          return false;
        }
      }
    } else if (stepIdx === 2) {
      // Step 2 Internal details
      if (!d.internal.orgName.trim()) {
        toast.error('Organization name is required.');
        return false;
      }
      if (!d.internal.contactPerson.trim()) {
        toast.error('Contact Person Name is required.');
        return false;
      }
      if (!d.internal.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.internal.email.trim())) {
        toast.error('A valid Contact Email Address is required.');
        return false;
      }
      if (!d.internal.mobile.trim() || !/^\d{10}$/.test(d.internal.mobile.trim())) {
        toast.error('A valid 10-digit Contact Mobile Number is required (e.g. 9876543210).');
        return false;
      }
      const auth = (d.internal.approvalAuthority || '').trim();
      if (!auth || auth.length < 3) {
        toast.error('Internal Approval Authority is required (minimum 3 characters).');
        return false;
      }
      if (/^(.)\1{3,}$/i.test(auth) || !/[a-zA-Z]/.test(auth)) {
        toast.error('Please enter a valid title or name for Internal Approval Authority.');
        return false;
      }

      const just = (d.internal.justification || '').trim();
      if (!just || just.length < 10) {
        toast.error('Purchase justification & compliance reason is required (minimum 10 characters).');
        return false;
      }
      if (/^(.)\1{4,}$/i.test(just) || /^(faf|asdf|test|xyz|abc|qwer)+$/i.test(just.replace(/\s+/g, ''))) {
        toast.error('Please provide a legitimate business justification or statutory compliance reason.');
        return false;
      }
    } else if (stepIdx === 3) {
      // Step 3 Items details
      if (d.type === 'RFP') {
        const hasSowDoc = Boolean(d.serviceDetails.sowFileAssetId || d.serviceDetails.sowFileName || d.boqFileName);
        const sowLen = (d.serviceDetails.scopeOfWork || d.basics.justification || d.internal.justification || d.approval.notes || '').trim().length;
        if (!hasSowDoc && sowLen < 10) {
          toast.error('RFP requires a Scope of Work (min 10 chars) or an uploaded SOW / BOQ document.');
          return false;
        }
      }
      const isBoqSchedule = d.basics.pricingFormat === 'BOQ' || d.basics.pricingFormat === 'SOR';
      const isServiceContract = d.basics.procurementCategory === 'SERVICES';
      if (isBoqSchedule) {
        if (d.boqTable.length === 0 || !d.boqTable.some(r => r.description.trim())) {
          toast.error(d.basics.procurementCategory === 'WORKS' ? 'At least one Work Schedule / BOQ row must be filled.' : 'At least one Bill of Quantities (BOQ) row must be filled.');
          return false;
        }
        if (d.boqTable.some(r => r.quantity <= 0 || r.estimatedRate < 0)) {
          toast.error('All BOQ rows must have positive quantities & rates.');
          return false;
        }
      } else if (isServiceContract) {
        const effectiveTitle = (d.serviceDetails.serviceTitle || d.basics.title || '').trim();
        if (!effectiveTitle) {
          toast.error('Service Contract Title is required.');
          return false;
        }
        if (!d.serviceDetails.serviceTitle?.trim()) {
          d.serviceDetails.serviceTitle = effectiveTitle;
        }
        const hasSowDoc = Boolean(d.serviceDetails.sowFileAssetId || d.serviceDetails.sowFileName);
        if (!hasSowDoc && d.serviceDetails.scopeOfWork.trim().length < 10) {
          toast.error('Scope of Work is required (min 10 chars) or upload an SOW document.');
          return false;
        }
        if (!hasSowDoc && d.serviceDetails.deliverables.trim().length < 3) {
          toast.error('Service deliverables list is required or upload an SOW document.');
          return false;
        }
        if (!isRateContractMethod(d.type) && !d.serviceDetails.duration.trim()) {
          toast.error('Service duration is required.');
          return false;
        }
      } else {
        if (d.items.length === 0 || d.items.some(i => !i.name.trim() || i.quantity <= 0)) {
          toast.error('At least one product item with a valid name and quantity is required.');
          return false;
        }
      }
    } else if (stepIdx === 4) {
      // Step 4 Suppliers
      if (d.vendors.selection !== 'Open' && (!d.vendors.invitedSellers || d.vendors.invitedSellers.length === 0)) {
        toast.error('Please invite at least 1 supplier or change sourcing scope to Open.');
        return false;
      }
      if (isReverseAuctionMethod(d.type) && d.vendors.selection !== 'Open' && d.vendors.invitedSellers.length < d.auctionConfig.minimumQualifiedBidders) {
        toast.error(`Reverse auction requires at least ${d.auctionConfig.minimumQualifiedBidders} qualified suppliers.`);
        return false;
      }
      if (isRateContractMethod(d.type) && d.vendors.selection !== 'Open' && d.rateContractConfig.selectedSuppliers.length === 0 && d.vendors.invitedSellers.length === 0) {
        toast.error('Rate Contract requires at least one selected supplier when using targeted invitation strategy.');
        return false;
      }
    } else if (stepIdx === 5) {
      // Step 5 Event timeline
      if (!d.schedule.submissionDate) {
        toast.error('Submission deadline date is required.');
        return false;
      }
      const endTime = new Date(d.schedule.submissionDate).getTime();
      if (endTime <= Date.now()) {
        toast.error('Submission deadline must be set to a future date & time.');
        return false;
      }
      const nowTime = new Date(d.schedule.submissionStartDate).getTime();
      if (endTime <= nowTime) {
        toast.error('Submission closing date must be after submission start date.');
        return false;
      }
      if (d.basics.isTechnicalEvaluationNeeded || d.schedule.packetType === 'Two') {
        if (!d.schedule.technicalOpeningDate) {
          toast.error('Technical opening date is required.');
          return false;
        }
        if (new Date(d.schedule.technicalOpeningDate) <= new Date(d.schedule.submissionDate)) {
          const techDateOnly = d.schedule.technicalOpeningDate.split('T')[0];
          const subDateOnly = d.schedule.submissionDate.split('T')[0];
          if (techDateOnly < subDateOnly) {
            toast.error(`Technical opening date (${techDateOnly}) is earlier than submission deadline (${subDateOnly}).`);
          } else {
            toast.error('Technical opening time must be after submission deadline.');
          }
          return false;
        }
      }
      if (d.schedule.packetType === 'Two') {
        if (!d.schedule.financialOpeningDate) {
          toast.error('Financial opening date is required for Two Packet flow.');
          return false;
        }
        if (new Date(d.schedule.financialOpeningDate) <= new Date(d.schedule.technicalOpeningDate)) {
          const finDateOnly = d.schedule.financialOpeningDate.split('T')[0];
          const techDateOnly = d.schedule.technicalOpeningDate.split('T')[0];
          if (finDateOnly < techDateOnly) {
            toast.error(`Financial opening date (${finDateOnly}) is earlier than technical opening date (${techDateOnly}).`);
          } else {
            toast.error('Financial opening time must be after technical envelope opening.');
          }
          return false;
        }
      }
      if (isReverseAuctionMethod(d.type)) {
        const auction = d.auctionConfig;
        const start = new Date(auction.startDateTime).getTime();
        const end = new Date(auction.endDateTime).getTime();
        const title = (auction.auctionTitle || d.basics.title || '').trim();
        const category = (auction.auctionCategory || d.basics.category || '').trim();
        const currency = (auction.currency || 'INR').trim();
        if (!title) {
          toast.error('Procurement title is required.');
          return false;
        }
        if (!category || category === 'Other') {
          toast.error('Procurement category is required.');
          return false;
        }
        if (!currency || currency === 'Other') {
          toast.error('Currency is required.');
          return false;
        }
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
          toast.error('Auction start datetime must be before auction end datetime.');
          return false;
        }
        if (auction.durationMinutes <= 0) {
          toast.error('Auction duration must be greater than 0 minutes.');
          return false;
        }
        if (auction.startingBidPrice !== -1 && auction.startingBidPrice <= 0) {
          toast.error('Starting bid price must be greater than 0.');
          return false;
        }
        if (auction.startingBidPrice === -1 && d.basics.estimatedValue <= 0) {
          toast.error('Estimated budget must be greater than 0 when using dynamic L1 starting price.');
          return false;
        }
        if (auction.startingBidPrice !== -1 && auction.reservePrice !== null && auction.reservePrice > auction.startingBidPrice) {
          toast.error('Reserve price cannot exceed starting bid price.');
          return false;
        }
        if (auction.minimumBidDecrement <= 0) {
          toast.error('Minimum bid decrement must be greater than 0.');
          return false;
        }
        if (auction.autoExtensionEnabled && (
          auction.extensionTriggerMinutes <= 0 ||
          auction.extensionDurationMinutes <= 0 ||
          auction.maximumExtensions <= 0
        )) {
          toast.error('Auto extension trigger, duration, and maximum extensions are required.');
          return false;
        }
      }
      if (d.basics.isReverseAuctionNeeded) {
        if (d.auctionConfig.minimumBidDecrement <= 0) {
          toast.error('Minimum bid decrement must be greater than 0.');
          return false;
        }
        if (d.auctionConfig.startingBidPrice !== -1 && d.auctionConfig.reservePrice !== null && d.auctionConfig.reservePrice > d.auctionConfig.startingBidPrice) {
          toast.error('Reserve price cannot exceed starting bid price.');
          return false;
        }
      }
      if (isRateContractMethod(d.type)) {
        const contract = d.rateContractConfig;
        const start = new Date(contract.periodStartDate).getTime();
        const end = new Date(contract.periodEndDate).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
          toast.error('Rate Contract start date must be before end date.');
          return false;
        }
        if (!contract.rateValidityPeriod.trim()) {
          toast.error('Rate validity duration is required.');
          return false;
        }
        if (contract.callOffOrderAllowed && contract.maximumOrderQuantityPerCallOff > 0 && contract.maximumOrderQuantityPerCallOff < contract.minimumOrderQuantity) {
          toast.error('Maximum call-off quantity cannot be lower than minimum order quantity.');
          return false;
        }
      }
    } else if (stepIdx === 6) {
      // Step 6 Terms
      if (!d.terms.paymentTerms) {
        toast.error('Payment terms are required.');
        return false;
      }
      if (!d.terms.deliveryTerms) {
        toast.error('Delivery terms are required.');
        return false;
      }
    } else if (stepIdx === 7) {
      // Step 7 Documents
      if (d.requiredDocs.length === 0) {
        toast.error('Please specify at least 1 required verification document.');
        return false;
      }
    } else if (stepIdx === 8) {
      // Step 8 Evaluation criteria
      if (!d.evaluation.method) {
        toast.error('Evaluation method is required.');
        return false;
      }
      // QCBS weightage check commented out as requested
      // if (d.evaluation.method === 'QCBS / weighted technical-commercial score') {
      //   const total = d.evaluation.technicalCriteria.reduce((sum, c) => sum + Number(c.weightage || 0), 0);
      //   if (total !== 100) {
      //     toast.error('QCBS evaluation weightage sum must be exactly 100%.');
      //     return false;
      //   }
      // }
    }
    return true;
  };

  const goNext = async () => {
    if (!validateStep(activeStep)) {
      setTriedNext(true);
      return;
    }
    setTriedNext(false);
    const currentKind = ALL_STEPS[activeStep];
    setCompletedStepIds(prev => Array.from(new Set([...prev, currentKind])));
    if (activeStep < ALL_STEPS.length - 1) {
      changeActiveStep(activeStep + 1);
    }
  };

  const goBack = async () => {
    setTriedNext(false);
    if (activeStep > 0) {
      const prevStep = activeStep - 1;
      changeActiveStep(prevStep);
    } else {
      router.push('/buyer/my-procurements');
    }
  };

  const submitProcurement = async () => {
    const failed = readiness.filter(r => !r.ok && r.severity === 'error');
    if (failed.length > 0) {
      toast.error(`Please fix missing details: ${failed[0].label}`);
      if (failed[0].stepIdx !== undefined) {
        changeActiveStep(failed[0].stepIdx);
        setTriedNext(true);
      }
      return;
    }
    if (!legalComplianceAccepted) {
      toast.error('Please read and accept the Order Placement & Procurement Facilitation Policy before publishing.');
      return;
    }
    setSubmittingDraft(true);
    try {
      const effectiveDraftId = draftIdRef.current || draft.id;
      const currentDraftWithId = {
        ...draft,
        id: effectiveDraftId
      };
      const payload = buildProcurementApiPayload(currentDraftWithId, activeStep);
      console.log('[SubmitProcurement] Sending payload with method:', payload.methodSlug, 'id:', payload.id);
      try {
        await submitProcurementDraft(payload);
      } catch (err) {
        if (!payload.id || !shouldRetryDraftSaveAsNew(err)) {
          throw err;
        }
        console.warn('[SubmitProcurement] Retrying submission without draft ID');
        await submitProcurementDraft(withoutServerDraftId(payload));
      }
      localStorage.removeItem(DRAFT_KEY);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('buyer_my_procurements_cached_data_v1');
          localStorage.removeItem('buyer_my_procurements_cached_data_v1');
        } catch {}
      }
      api.invalidate('/api/buyer/my-procurements');
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['buyerMyProcurements'] }),
        queryClient.invalidateQueries({ queryKey: ['buyer-dashboard-my-procurements'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['procurement-counts'] }),
      ]);
      toast.success('Procurement request submitted successfully');
      router.push(`/buyer/my-procurements`);
    } catch (err: any) {
      console.error('[SubmitProcurement] Submission failed:', err);
      const rawMsg = String(err?.message || 'Unknown error');
      const lower = rawMsg.toLowerCase();

      // Intelligent Error Recovery & Focus Trapping
      if (lower.includes('auction') || lower.includes('startingbidprice') || lower.includes('starting bid') || lower.includes('decrement') || lower.includes('reserve price') || lower.includes('reserveprice') || lower.includes('duration')) {
        const evalStepIdx = ALL_STEPS.indexOf('evaluation');
        if (evalStepIdx !== -1) {
          changeActiveStep(evalStepIdx);
          setTriedNext(true);
          setTimeout(() => {
            if (lower.includes('starting') || lower.includes('ceiling') || lower.includes('price')) {
              const el = document.getElementById('auction-starting-bid-price') || document.getElementById('auction-starting-price-mode');
              el?.focus();
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (lower.includes('decrement')) {
              const el = document.getElementById('auction-min-bid-decrement');
              el?.focus();
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (lower.includes('reserve')) {
              const el = document.getElementById('auction-reserve-price');
              el?.focus();
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 350);
        }
      }

      toast.error('Submission failed: ' + rawMsg, { duration: 8000 });
    } finally {
      setSubmittingDraft(false);
    }
  };

  const currentStepKind = ALL_STEPS[activeStep];
  const stepConfig = stepLibrary[currentStepKind];

  return (
    <div className="w-full min-w-0 bg-[radial-gradient(circle_at_top,#eef5ff_0,#f7f9fc_42%,#eef2f7_100%)] pb-28 text-slate-950">
      {/* Accent Header Line */}
      <div className="h-1.5 w-full bg-[#12335f]" />

      <div className="mx-auto max-w-[1560px] px-4 py-6 lg:px-6">
        
        {/* Step Header Row */}
        <div className="mb-6 flex flex-col gap-4 rounded-[24px] bg-white/95 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-wider">
      
              <MethodBadge method={draft.type} />
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight mt-1 truncate">
              {draft.basics.title || 'Draft Sourcing Event'}
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              Step {activeStep + 1} of {ALL_STEPS.length}: {stepConfig.label} &middot; {completionPercentage}% Form Completion
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => saveDraftLocally()} disabled={savingDraft} className="h-9 font-bold text-slate-700">
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Draft
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push(PROCUREMENT_DRAFTS_ROUTE)} className="h-9 font-bold text-slate-700">
              <History className="h-4 w-4 mr-1.5" /> Drafts History
            </Button>
          </div>
        </div>

        {/* Wizard Main Layout */}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          
          {/* Stepper Sidebar */}
<aside className="hidden sm:block space-y-4 lg:sticky lg:top-4 self-start">
            <div className="rounded-[24px] bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <h2 className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2.5 px-0.5">Wizard Progression</h2>
              <ProcurementStepper
                steps={ALL_STEPS.map(s => ({
                  id: s,
                  label: stepLibrary[s].label,
                  description: stepLibrary[s].description,
                  icon: stepLibrary[s].icon
                }))}
                currentStep={activeStep}
                completedSteps={effectiveCompletedSteps}
                maxVisitedStep={maxVisitedStep}
                onStepClick={async (idx) => {
                  if (idx <= maxVisitedStep || effectiveCompletedSteps.includes(ALL_STEPS[idx])) {
                    setTriedNext(false);
                    changeActiveStep(idx);
                  } else if (validateStep(activeStep)) {
                    const currentKind = ALL_STEPS[activeStep];
                    setCompletedStepIds(prev => Array.from(new Set([...prev, currentKind])));
                    setTriedNext(false);
                    changeActiveStep(idx);
                  } else {
                    setTriedNext(true);
                  }
                }}
                disabledFutureSteps={true}
              />
            </div>
          </aside>

          {/* Mobile Compact Progress Indicator */}
          <div className="sm:hidden flex items-center justify-between rounded-[20px] bg-white p-4 ring-1 ring-slate-200/80 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Step {activeStep + 1} of {ALL_STEPS.length}</p>
              <h2 className="mt-0.5 text-sm font-black text-slate-900">{stepLibrary[ALL_STEPS[activeStep]].label}</h2>
              <button 
                onClick={() => setIsMobileStepperOpen(true)}
                className="mt-1.5 text-[11px] font-bold text-[#12335f] flex items-center gap-1 hover:underline focus:outline-none"
              >
                View All Steps <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12335f]/10 text-xs font-black text-[#12335f]">
              {Math.round(((activeStep + 1) / ALL_STEPS.length) * 100)}%
            </div>
          </div>

          {/* Mobile Stepper Modal */}
          {isMobileStepperOpen && (
            <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm sm:hidden" onClick={() => setIsMobileStepperOpen(false)}>
              <div 
                className="bg-white rounded-t-[24px] p-5 w-full max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">Wizard Progression</h2>
                  <button onClick={() => setIsMobileStepperOpen(false)} className="rounded-full p-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-y-auto pb-4 hide-scrollbar">
                  <ProcurementStepper
                    steps={ALL_STEPS.map(s => ({
                      id: s,
                      label: stepLibrary[s].label,
                      description: stepLibrary[s].description,
                      icon: stepLibrary[s].icon
                    }))}
                    currentStep={activeStep}
                    completedSteps={effectiveCompletedSteps}
                    maxVisitedStep={maxVisitedStep}
                    onStepClick={async (idx) => {
                      if (idx <= maxVisitedStep || effectiveCompletedSteps.includes(ALL_STEPS[idx])) {
                        setTriedNext(false);
                        changeActiveStep(idx);
                        setIsMobileStepperOpen(false);
                      } else if (validateStep(activeStep)) {
                        const currentKind = ALL_STEPS[activeStep];
                        setCompletedStepIds(prev => Array.from(new Set([...prev, currentKind])));
                        setTriedNext(false);
                        changeActiveStep(idx);
                        setIsMobileStepperOpen(false);
                      } else {
                        setTriedNext(true);
                      }
                    }}
                    disabledFutureSteps={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Step Body Wrapper */}
          <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-full">
            
            {/* Step 0 Sourcing Method Selection */}
            {currentStepKind === 'selection' && (
              <SectionCard title="Select Sourcing Method" description="Choose the appropriate sourcing method based on your procurement requirements" icon={stepLibrary.selection.icon}>
                <SelectionsStepForm
                  draft={draft}
                  updateDraft={updateDraft}
                />
              </SectionCard>
            )}

            {/* Step 1 Sourcing Intent */}
            {currentStepKind === 'basics' && (
              <SectionCard title="Procurement Intent & Strategy" description="Specify sourcing title, categories, priority and delivery location" icon={stepLibrary.basics.icon}>
                <BasicsStepForm
                  draft={draft}
                  updateDraft={updateDraft}
                  resolvedAddress={resolvedAddress}
                  resolvedAddressInfo={resolvedAddressInfo}
                />
              </SectionCard>
            )}

            {/* Step 2 Buyer details */}
            {currentStepKind === 'internal' && (
              <SectionCard title="Buyer & Internal Details" description="Fill out organization hierarchy, project cost codes, and statutory approvals" icon={stepLibrary.internal.icon}>
                <InternalDetailsForm
                  draft={draft}
                  updateDraft={updateDraft}
                  resolvedOrgName={resolvedOrgName}
                />
              </SectionCard>
            )}

            {/* Step 3 Items specs */}
            {currentStepKind === 'items' && (
              <SectionCard title="Item / Service / BOQ details" description="Upload or map required products, custom SLA contracts, or multiple BOQ schedules" icon={stepLibrary.items.icon} className="w-full min-w-0 max-w-full">
                <ItemsDetailsForm
                  draft={draft}
                  updateDraft={updateDraft}
                  showItemDrawer={showItemDrawer}
                  setShowItemDrawer={setShowItemDrawer}
                  selectedItemForEdit={selectedItemForEdit}
                  setSelectedItemForEdit={setSelectedItemForEdit}
                />
              </SectionCard>
            )}

            {/* Step 4 Sellers Selection */}
            {currentStepKind === 'vendors' && (
              <SectionCard title="Supplier Reach & Invites" description="Configure bidding scopes and invite registered verified companies" icon={stepLibrary.vendors.icon}>
                <VendorsStepForm
                  draft={draft}
                  updateDraft={updateDraft}
                />
              </SectionCard>
            )}

            {/* Step 5 Timeline Event Rules */}
            {currentStepKind === 'schedule' && (
              <SectionCard title="Event Timeline & Auction Rules" description="Set submission windows, envelope opening schedules, and transparency parameters" icon={stepLibrary.schedule.icon}>
                <ScheduleStepForm
                  draft={draft}
                  updateDraft={updateDraft}
                  showErrors={triedNext}
                />
              </SectionCard>
            )}

            {/* Step 6 Commercial Terms */}
            {currentStepKind === 'terms' && (
              <SectionCard title="Commercial & Payment Terms" description="Configure delivery, warranty clauses, and financial deposit parameters" icon={stepLibrary.terms.icon}>
                <CommercialTermsForm
                  draft={draft}
                  updateDraft={updateDraft}
                  showErrors={triedNext}
                />
              </SectionCard>
            )}

            {/* Step 7 Document Checklists */}
            {currentStepKind === 'documents' && (
              <SectionCard title="Required Document Checklists" description="Add mandatory credentials required from bidders at technical opening" icon={stepLibrary.documents.icon}>
                <DocumentsStepForm
                  draft={draft}
                  updateDraft={updateDraft}
                />
              </SectionCard>
            )}

            {/* Step 8 Evaluation scoring */}
            {currentStepKind === 'evaluation' && (
              <SectionCard title="Evaluation Basis" description="L1 Lowest Landed Cost evaluation basis" icon={stepLibrary.evaluation.icon}>
                <EvaluationBasisForm
                  draft={draft}
                  updateDraft={updateDraft}
                />
              </SectionCard>
            )}

            {/* Step 9 Preview & approval */}
            {currentStepKind === 'publish' && (
              <SectionCard title="Review, Approval & Publish Sourcing Event" description="Overview all configurations and submit for corporate/regulatory compliance workflow" icon={stepLibrary.publish.icon}>
                <PreviewPublishForm
                  draft={draft}
                  updateDraft={updateDraft}
                  readiness={readiness}
                  complianceAccepted={legalComplianceAccepted}
                  onComplianceAcceptedChange={setLegalComplianceAccepted}
                />
              </SectionCard>
            )}

            {/* Sticky Actions control bar */}
            <div className="pt-4 pb-2">
              <StickyActionBar
                onBack={goBack}
                onSaveDraft={() => saveDraftLocally()}
                onContinue={goNext}
                continueText={activeStep === ALL_STEPS.length - 2 ? 'Review & Submit' : 'Next Step'}
                onSubmit={submitProcurement}
                isSaving={savingDraft}
                isSubmitting={submittingDraft}
                disableSubmit={activeStep === ALL_STEPS.length - 1 && !legalComplianceAccepted}
                showSubmit={activeStep === ALL_STEPS.length - 1}
              />
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}




function SelectionsStepForm({
  draft,
  updateDraft
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
}) {
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);

  const availableMethods = useMemo(() => {
    const allowed = ['RFQ', 'RFP', 'OPEN_TENDER', 'LIMITED_TENDER', 'REVERSE_AUCTION', 'RATE_CONTRACT'];
    return METHOD_DEFINITIONS.filter(m => allowed.includes(m.id));
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Interactive Procurement Advisor Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 border border-blue-200/90 rounded-2xl shadow-3xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#12335f] text-white shadow-xs">
            <Sparkles className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
              Not sure which sourcing method is right for your purchase?
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed mt-0.5">
              Answer 3 quick questions about your category, budget, and urgency — our Procurement Advisor will recommend the compliant, optimal workflow.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setIsAdvisorOpen(true)}
          className="h-9 px-4 bg-[#12335f] hover:bg-[#0b2445] text-white text-xs font-bold uppercase tracking-wider rounded-xl shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span>Help Me Choose</span>
        </Button>
      </div>

      <ProcurementAdvisorModal
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        onApplyMethod={(methodId) => {
          const validMethod = methodId as ProcurementMethodId;
          updateDraft(current => ({
            ...applyMethodDefaults(current, validMethod),
            requiredDocs: defaultRequiredDocs(validMethod)
          }));
          toast.success(`Applied ${methodId} method to your procurement!`);
        }}
      />

      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide pl-0.5">Select Sourcing Method</h3>
          <span className="text-[11px] font-semibold text-slate-400">Click a card to configure defaults</span>
        </div>
        <div className="grid gap-2.5 sm:gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {availableMethods.map(method => (
            <ProcurementMethodCard
              key={method.id}
              title={method.title}
              subtitle={method.subtitle}
              icon={method.icon}
              complexity={method.complexity}
              estimatedTime={method.estimatedTime}
              termKey={method.id}
              isSelected={draft.type === method.id}
              onSelect={() => {
                updateDraft(current => ({
                  ...applyMethodDefaults(current, method.id),
                  requiredDocs: defaultRequiredDocs(method.id)
                }));
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 Form components: Sourcing Intent
// ─────────────────────────────────────────────────────────────────────────────
function BasicsStepForm({
  draft,
  updateDraft,
  resolvedAddress,
  resolvedAddressInfo
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
  resolvedAddress?: string;
  resolvedAddressInfo?: ResolvedAddressInfo;
}) {
  // Delivery address dropdown and modal states
  const [deliveryAddressesList, setDeliveryAddressesList] = useState<DeliveryAddressDto[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // Helper to format clean, non-redundant delivery address string
  const formatDeliveryAddressString = (addr: DeliveryAddressDto): string => {
    const street = [addr.addressLine1, addr.addressLine2].filter(Boolean).map(s => s?.trim()).filter(Boolean).join(', ');
    const city = addr.city?.trim() || '';
    const dist = addr.district?.trim() || '';
    const isCitySameDist = city && dist && (
      city.toLowerCase() === dist.toLowerCase() ||
      (city.length >= 5 && dist.length >= 5 && (city.toLowerCase().startsWith(dist.toLowerCase().slice(0, 5)) || dist.toLowerCase().startsWith(city.toLowerCase().slice(0, 5))))
    );
    const locParts = [
      isCitySameDist ? (dist.length >= city.length ? dist : city) : [city, dist].filter(Boolean).join(', '),
      addr.state?.trim(),
    ].filter(Boolean).join(', ');
    const pin = addr.pincode ? ` - ${addr.pincode.trim()}` : '';
    const raw = `${street}${street && locParts ? ', ' : ''}${locParts}${pin}`;
    return cleanDeliveryAddress(raw) || raw;
  };

  // Filter allowed categories and pricing formats strictly by selected procurement method
  const allowedCategories = useMemo(() => {
    return CATEGORIES_BY_METHOD[draft.type] || CATEGORIES_BY_METHOD.RFQ;
  }, [draft.type]);

  const allowedFormats = useMemo(() => {
    return FORMATS_BY_METHOD[draft.type] || FORMATS_BY_METHOD.RFQ;
  }, [draft.type]);

  useEffect(() => {
    const isCatAllowed = allowedCategories.some(c => c.value === draft.basics.procurementCategory);
    const isFormatAllowed = allowedFormats.some(f => f.value === draft.basics.pricingFormat);

    if (!isCatAllowed || !isFormatAllowed) {
      const nextCat = isCatAllowed ? (draft.basics.procurementCategory || 'GOODS') : allowedCategories[0].value;
      const nextFormat = isFormatAllowed ? (draft.basics.pricingFormat || 'SINGLE_ITEM') : allowedFormats[0].value;

      updateDraft(c => ({
        ...c,
        basics: {
          ...c.basics,
          procurementCategory: nextCat,
          pricingFormat: nextFormat
        }
      }));
    }
  }, [allowedCategories, allowedFormats, draft.basics.procurementCategory, draft.basics.pricingFormat, updateDraft]);

  // Dynamic categories from database
  const [categoriesList, setCategoriesList] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Address form fields state
  const [addressLabel, setAddressLabel] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [addressType, setAddressType] = useState('OFFICE');
  const [contactPersonName, setContactPersonName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [alternateMobileNumber, setAlternateMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [gstState, setGstState] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoadingAddresses(true);
        setLoadingCategories(true);
      }
    });
    fetchDeliveryAddresses()
      .then(res => {
        if (active) {
          const list = res || [];
          setDeliveryAddressesList(list);

          // If draft delivery location is still empty, auto-select default saved address or resolved profile/GST address
          if (!draft.basics.deliveryLocation?.trim()) {
            const def = list.find(a => a.isDefault) || list[0];
            if (def) {
              const fullAddr = formatDeliveryAddressString(def);
              updateDraft(c => ({
                ...c,
                basics: { ...c.basics, deliveryLocation: fullAddr }
              }));
            } else if (resolvedAddress) {
              updateDraft(c => ({
                ...c,
                basics: { ...c.basics, deliveryLocation: resolvedAddress }
              }));
            }
          }
        }
      })
      .catch(err => {
        console.warn('Failed to load saved addresses:', err);
        if (active && !draft.basics.deliveryLocation?.trim() && resolvedAddress) {
          updateDraft(c => ({
            ...c,
            basics: { ...c.basics, deliveryLocation: resolvedAddress }
          }));
        }
      })
      .finally(() => {
        if (active) setLoadingAddresses(false);
      });

    api.get('/api/categories')
      .then(res => readJsonResponse(res))
      .then(body => unwrapApiData<any>(body))
      .then(cats => {
        if (active && Array.isArray(cats)) {
          setCategoriesList(
            cats
              .map((c: any) => ({ id: Number(c.id || 0), name: String(c.name || '').trim() }))
              .filter(c => Boolean(c.name))
          );
        }
      })
      .catch(err => {
        console.warn('Failed to load categories from database:', err);
      })
      .finally(() => {
        if (active) setLoadingCategories(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleStateChange = (val: string) => {
    setState(val);
    setDistrict('');
  };

  const handleDistrictChange = (val: string) => {
    setDistrict(val);
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newAddr = await createDeliveryAddress({
        addressLabel,
        organizationName: organizationName || null,
        contactPersonName,
        mobileNumber,
        alternateMobileNumber: alternateMobileNumber || null,
        email: email || null,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        district,
        state,
        pincode,
        landmark: landmark || null,
        gstState: gstState || null,
        placeOfSupply: placeOfSupply || null,
        addressType,
        isDefault: deliveryAddressesList.length === 0
      });
      toast.success('New delivery address added.');
      setIsAddressModalOpen(false);
      
      // Update delivery address list
      setDeliveryAddressesList(prev => [newAddr, ...prev]);
      
      // Autofetch and populate delivery location
      const fullAddr = formatDeliveryAddressString(newAddr);
      updateDraft(c => ({
        ...c,
        basics: { ...c.basics, deliveryLocation: fullAddr }
      }));

      // Reset address form fields
      setAddressLabel('');
      setOrganizationName('');
      setAddressType('OFFICE');
      setContactPersonName('');
      setMobileNumber('');
      setAlternateMobileNumber('');
      setEmail('');
      setAddressLine1('');
      setAddressLine2('');
      setState('');
      setDistrict('');
      setCity('');
      setPincode('');
      setLandmark('');
      setGstState('');
      setPlaceOfSupply('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add address.');
    }
  };

  const openNewAddressModal = () => {
    if (resolvedAddressInfo && resolvedAddressInfo.source !== 'none') {
      setAddressLabel(prev => prev || 'Office Delivery Address');
      setOrganizationName(prev => prev || draft.internal.orgName || '');
      setContactPersonName(prev => prev || draft.internal.contactPerson || '');
      setMobileNumber(prev => prev || draft.internal.mobile || '');
      setEmail(prev => prev || draft.internal.email || '');
      setAddressLine1(prev => prev || resolvedAddressInfo.street || '');
      setCity(prev => prev || resolvedAddressInfo.city || '');
      setDistrict(prev => prev || resolvedAddressInfo.district || '');
      setState(prev => prev || resolvedAddressInfo.state || '');
      setPincode(prev => prev || resolvedAddressInfo.pincode || '');
    }
    setIsAddressModalOpen(true);
  };

  const selectedAddressId = useMemo(() => {
    if (!draft.basics.deliveryLocation?.trim()) return '';
    const currentLoc = draft.basics.deliveryLocation.trim().toLowerCase();
    const match = deliveryAddressesList.find(a => {
      const formatted = formatDeliveryAddressString(a).toLowerCase();
      return formatted === currentLoc ||
        Boolean(a.addressLine1 && currentLoc.includes(a.addressLine1.trim().toLowerCase()));
    });
    return match ? String(match.id) : '';
  }, [deliveryAddressesList, draft.basics.deliveryLocation]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      <div className="grid gap-4 sm:grid-cols-2 min-w-0">

        {['RFQ', 'RFP', 'OPEN_TENDER', 'LIMITED_TENDER', 'RATE_CONTRACT', 'REVERSE_AUCTION'].includes(draft.type) && (
          <Field
            label={
              draft.type === 'RATE_CONTRACT'
                ? 'Rate Contract Number'
                : draft.type === 'REVERSE_AUCTION'
                ? 'Reverse Auction Reference'
                : `${draft.type.includes('TENDER') ? 'Tender' : draft.type} Number`
            }
          >
            <input
              type="text"
              value={
                draft.type === 'RATE_CONTRACT'
                  ? ((draft as any).requirementNumber ? formatRefId('RC', draft.id, (draft as any).requirementNumber, 'RATE_CONTRACT') : (draft.id ? formatRefId('RC', draft.id, null, 'RATE_CONTRACT') : 'Auto-generated upon creation'))
                  : draft.type === 'REVERSE_AUCTION'
                  ? ((draft.auctionConfig as any)?.auctionCode || (draft as any).requirementNumber || (draft.id ? formatRefId('REVERSE_AUCTION', draft.id, null, 'REVERSE_AUCTION') : 'Auto-generated upon creation'))
                  : (draft as any).requirementNumber
                  ? formatRefId(draft.type, draft.id, (draft as any).requirementNumber, draft.type)
                  : (draft.id ? formatRefId(draft.type, draft.id, null, draft.type) : 'Auto-generated upon creation')
              }
              disabled
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 outline-none cursor-not-allowed font-mono"
            />
          </Field>
        )}

        {draft.type === 'RFQ' && (
          <Field label="RFQ Type" required>
            <select
              value={draft.rfqType === 'LIMITED' ? 'LIMITED' : 'OPEN'}
              onChange={e => updateDraft(c => ({ ...c, rfqType: e.target.value as 'OPEN' | 'LIMITED' }))}
              className={inputClass}
            >
              <option value="OPEN">Open RFQ (All registered sellers can quote)</option>
              <option value="LIMITED">Limited RFQ (Only invited/selected sellers can quote)</option>
            </select>
            <p className="text-[10px] text-slate-500 font-medium mt-1">
              {draft.rfqType === 'LIMITED'
                ? 'Limited RFQ restricts bidding to invited/selected suppliers (requires internal audit justification).'
                : 'Open RFQ broadcasts to all registered MSME suppliers for broad market price discovery.'}
            </p>
          </Field>
        )}

        {(draft.type === 'LIMITED_TENDER' || (draft.type === 'RFQ' && draft.rfqType === 'LIMITED')) && (
          <div className="sm:col-span-2">
            <Field label="Limited Tender / RFQ Justification" required>
              <div className="space-y-1.5">
                <textarea
                  value={draft.limitedTenderJustification || ''}
                  onChange={e => updateDraft(c => ({ ...c, limitedTenderJustification: e.target.value }))}
                  rows={3}
                  className={cn(
                    textareaClass,
                    (draft.limitedTenderJustification || '').length > 0 && (draft.limitedTenderJustification || '').trim().length < 15 && 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/20'
                  )}
                  placeholder="Explain why this event is restricted to a limited vendor list (minimum 15 characters)..."
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
                  {[
                    'Proprietary OEM Item / Sole Distributor Channel',
                    'Urgent Operational Requirement / Immediate Business Need',
                    'Standardized Equipment Compatibility & Maintenance',
                    'Limited Empaneled & Pre-Qualified Sourcing Pool'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateDraft(c => ({ ...c, limitedTenderJustification: preset }))}
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                        draft.limitedTenderJustification === preset
                          ? "border-[#0b2447] bg-[#0b2447] text-white"
                          : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] px-0.5">
                  <span className={cn(
                    "font-semibold",
                    (draft.limitedTenderJustification || '').trim().length < 15 ? "text-amber-600 font-bold" : "text-emerald-600"
                  )}>
                    {(draft.limitedTenderJustification || '').trim().length < 15
                      ? `Minimum 15 characters required (${(draft.limitedTenderJustification || '').trim().length}/15)`
                      : '✓ Justification requirement satisfied'}
                  </span>
                  <span className="text-slate-400">{(draft.limitedTenderJustification || '').length} chars</span>
                </div>
              </div>
            </Field>
          </div>
        )}

        <Field label="Procurement title" required>
          <input
            value={draft.basics.title}
            onChange={e => {
              const val = e.target.value;
              updateDraft(c => ({
                ...c,
                basics: { ...c.basics, title: val },
                serviceDetails: {
                  ...c.serviceDetails,
                  serviceTitle: (!c.serviceDetails.serviceTitle || c.serviceDetails.serviceTitle === c.basics.title)
                    ? val
                    : c.serviceDetails.serviceTitle
                }
              }));
            }}
            className={inputClass}
            placeholder="Office computers, AMC maintenance, raw supply..."
          />
        </Field>

        <Field label="Procurement Category" required>
          <select
            id="procurement-category-select"
            value={draft.basics.procurementCategory || 'GOODS'}
            onChange={e => {
              const val = e.target.value as ProcurementCategoryValue;
              updateDraft(c => ({
                ...c,
                basics: {
                  ...c.basics,
                  procurementCategory: val
                }
              }));
            }}
            className={inputClass}
            aria-label="Procurement Category"
          >
            {allowedCategories.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 font-semibold mt-1">
            Primary category of what is being procured (Goods, Services, or Works).
          </p>
        </Field>

        <Field label="Sourcing & Pricing Format" required>
          <select
            id="pricing-format-select"
            value={draft.basics.pricingFormat || 'SINGLE_ITEM'}
            onChange={e => {
              const val = e.target.value as ProcurementPricingFormatValue;
              const isBoqType = val === 'BOQ' || val === 'SOR';

              updateDraft(c => ({
                ...c,
                basics: {
                  ...c.basics,
                  pricingFormat: val
                },
                boqTable: isBoqType && c.boqTable.length === 0
                  ? [{ srNo: 1, description: '', category: 'General', quantity: 1, uom: 'Nos', estimatedRate: 0, taxPercent: 18, hsnSacCode: '', attachments: [], fileAssetId: null, fileName: '', fileSize: null, total: 0, remarks: '' }]
                  : !isBoqType
                    ? []
                    : c.boqTable
              }));
            }}
            className={inputClass}
            aria-label="Sourcing and Pricing Format"
          >
            {allowedFormats.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 font-semibold mt-1">
            Pricing structure: Direct Item quote, Multi-line BOQ schedule, or Schedule of Rates (SOR).
          </p>
        </Field>

        <Field label="Estimated value (INR)" required>
          <input
            type="number"
            min={0}
            value={draft.basics.estimatedValue || ''}
            onChange={e => updateDraft(c => ({ ...c, basics: { ...c.basics, estimatedValue: Number(e.target.value || 0) } }))}
            onWheel={e => (e.target as HTMLElement).blur()}
            className={inputClass}
            placeholder="0"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
            {[
              { label: '₹2.5L', value: 250000 },
              { label: '₹5L', value: 500000 },
              { label: '₹10L', value: 1000000 },
              { label: '₹25L', value: 2500000 },
              { label: '₹50L', value: 5000000 },
              { label: '₹1 Cr', value: 10000000 },
            ].map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => updateDraft(c => ({ ...c, basics: { ...c.basics, estimatedValue: p.value } }))}
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                  draft.basics.estimatedValue === p.value
                    ? "border-[#0b2447] bg-[#0b2447] text-white"
                    : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {draft.items.length > 0 && (() => {
            const itemTotals = computeProcurementTotals(draft.items);
            const grossRounded = Math.round(itemTotals.grossValue);
            if (grossRounded > 0 && grossRounded !== draft.basics.estimatedValue) {
              return (
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] bg-blue-50 border border-blue-200/80 px-2.5 py-1.5 rounded-lg text-[#12335f]">
                  <span>
                    Schedule BOQ Total (Incl. GST): <strong>₹{grossRounded.toLocaleString('en-IN')}</strong> ({draft.items.length} line items)
                  </span>
                  <button
                    type="button"
                    onClick={() => updateDraft(c => ({ ...c, basics: { ...c.basics, estimatedValue: grossRounded } }))}
                    className="font-bold underline hover:text-blue-900 cursor-pointer shrink-0"
                  >
                    Sync with Schedule Total
                  </button>
                </div>
              );
            }
            return null;
          })()}
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-1 rounded-md">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Internal Benchmark — Used for financial validation and CFA approval tier.</span>
          </div>

          <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 transition-colors hover:bg-slate-50">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.basics.discloseEstimatedCost || false}
                onChange={e => updateDraft(c => ({ ...c, basics: { ...c.basics, discloseEstimatedCost: e.target.checked } }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#12335f] focus:ring-[#12335f]/20 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                  Disclose estimated budget to participating bidders
                  {draft.basics.discloseEstimatedCost ? (
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">Public</span>
                  ) : (
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">Confidential (Recommended)</span>
                  )}
                </span>
                <p className="text-[10.5px] text-slate-500 mt-0.5 font-normal leading-normal">
                  {draft.basics.discloseEstimatedCost
                    ? "The budget estimate will be visible on the public tender view and opportunities feed."
                    : "Recommended: Keep unchecked to prevent bid anchoring and encourage genuine market competition. Bidders only see item specs, quantity, and delivery timeline."}
                </p>
              </div>
            </label>
          </div>
        </Field>

        <Field label="Procurement category" required>
          <select
            value={
              categoriesList.some(c => c.name === draft.basics.category)
                ? draft.basics.category
                : (draft.basics.category ? 'Other' : '')
            }
            onChange={e => updateDraft(c => ({ ...c, basics: { ...c.basics, category: e.target.value } }))}
            className={inputClass}
          >
            <option value="">{loadingCategories ? 'Loading categories...' : '-- Select Procurement Category --'}</option>
            {categoriesList.map(opt => (
              <option key={opt.id || opt.name} value={opt.name}>
                {opt.name}
              </option>
            ))}
            <option value="Other">Other / Custom Category</option>
          </select>
          {(draft.basics.category === 'Other' || (draft.basics.category && !categoriesList.some(c => c.name === draft.basics.category))) && (
            <input
              type="text"
              value={draft.basics.category === 'Other' ? '' : draft.basics.category}
              onChange={e => {
                const customVal = e.target.value;
                updateDraft(c => ({ ...c, basics: { ...c.basics, category: customVal || 'Other' } }));
              }}
              placeholder="Specify category..."
              className={cn(inputClass, 'mt-2')}
              required
            />
          )}
        </Field>

        <Field label="Urgency priority">
          <select
            value={draft.basics.priority}
            onChange={e => {
              const newPriority = e.target.value as any;
              updateDraft(c => {
                let updatedDocs = c.requiredDocs;
                if (newPriority === 'Emergency') {
                  const hasEmergencyDoc = updatedDocs.some(
                    d => d.name.toLowerCase().includes('emergency') || d.name.toLowerCase().includes('justification')
                  );
                  if (!hasEmergencyDoc) {
                    updatedDocs = [
                      ...updatedDocs,
                      {
                        id: `doc_emergency_${Date.now()}`,
                        name: 'Emergency Approval Note',
                        required: true,
                        fileType: 'pdf',
                        maxSize: 5,
                        instructions: 'Upload official emergency procurement approval note.'
                      }
                    ];
                  }
                }
                return {
                  ...c,
                  basics: { ...c.basics, priority: newPriority },
                  requiredDocs: updatedDocs
                };
              });
            }}
            className={inputClass}
          >
            <option value="Normal">Normal</option>
            <option value="Urgent">Urgent</option>
            <option value="Emergency">Emergency</option>
          </select>
        </Field>

        <Field label="Required by Date & Time" required>
          <DateTimePicker
            id="basics-required-by-datetime"
            value={
              draft.basics.requiredByDate
                ? draft.basics.requiredByDate.includes('T')
                  ? draft.basics.requiredByDate.slice(0, 16)
                  : `${draft.basics.requiredByDate}T17:00`
                : ''
            }
            onChange={val => updateDraft(c => ({ ...c, basics: { ...c.basics, requiredByDate: val } }))}
            placeholder="Select required date & time (12-hr AM/PM)"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
            {[
              { label: '+15 Days', days: 15 },
              { label: '+30 Days (1 Mo)', days: 30 },
              { label: '+60 Days (2 Mo)', days: 60 },
              { label: '+90 Days (Quarter)', days: 90 },
            ].map(p => {
              const target = new Date(Date.now() + p.days * 86400000);
              const year = target.getFullYear();
              const month = String(target.getMonth() + 1).padStart(2, '0');
              const day = String(target.getDate()).padStart(2, '0');
              const isoVal = `${year}-${month}-${day}T17:00`;
              return (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => updateDraft(c => ({ ...c, basics: { ...c.basics, requiredByDate: isoVal } }))}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="sm:col-span-2 space-y-4 w-full min-w-0">
          <div className="w-full min-w-0">
            {deliveryAddressesList.length > 0 ? (
              <div className="mb-2 w-full min-w-0">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                  Select From Saved Addresses
                </label>
                <div className="flex gap-2 items-center w-full min-w-0">
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      placeholder={loadingAddresses ? "Loading addresses..." : "Search and select a saved address..."}
                      options={deliveryAddressesList.map(addr => {
                        const labelParts = [addr.addressLabel || 'Address'];
                        if (addr.city || addr.district) {
                          labelParts.push(addr.city || addr.district);
                        }
                        const line = addr.addressLine1
                          ? (addr.addressLine1.length > 45 ? `${addr.addressLine1.slice(0, 42)}...` : addr.addressLine1)
                          : '';
                        if (line) labelParts.push(line);
                        const contact = addr.contactPersonName ? `(${addr.contactPersonName})` : '';
                        return {
                          value: String(addr.id),
                          label: `${labelParts.join(' — ')}${contact ? ` ${contact}` : ''}`
                        };
                      })}
                      value={selectedAddressId}
                      onChange={(val) => {
                        if (!val) return;
                        const selected = deliveryAddressesList.find(a => String(a.id) === String(val));
                        if (selected) {
                          const fullAddr = formatDeliveryAddressString(selected);
                          updateDraft(c => ({
                            ...c,
                            basics: { ...c.basics, deliveryLocation: fullAddr }
                          }));
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openNewAddressModal}
                    className="h-10 text-xs font-bold shrink-0 whitespace-nowrap border-slate-300 hover:bg-slate-50 text-slate-700"
                  >
                    + Add Address
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-2 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">
                  {loadingAddresses ? "Checking saved addresses..." : "No saved addresses found."}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openNewAddressModal}
                  className="h-8 text-xs font-bold border-slate-300 hover:bg-slate-50 text-slate-700"
                >
                  + Add Address
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="basics-delivery-location" className="text-[9px] sm:text-[10px] font-bold sm:font-black uppercase tracking-wide sm:tracking-wider text-slate-500">
                Delivery location <span className="text-rose-600">*</span>
              </label>
              {resolvedAddress && draft.basics.deliveryLocation?.trim().toLowerCase() !== resolvedAddress.trim().toLowerCase() && (
                <button
                  type="button"
                  onClick={() => updateDraft(c => ({ ...c, basics: { ...c.basics, deliveryLocation: resolvedAddress } }))}
                  className="text-[11px] font-bold text-[#12335f] hover:text-[#0d2342] bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1"
                  title="Auto-fill with authentic address from verified onboarding / GST"
                >
                  Auto-fill from profile / GST
                </button>
              )}
            </div>
            <textarea
              id="basics-delivery-location"
              value={draft.basics.deliveryLocation}
              onChange={e => updateDraft(c => ({ ...c, basics: { ...c.basics, deliveryLocation: e.target.value } }))}
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
              placeholder="Warehouse yard, Central office..."
              aria-required="true"
            />
            {Boolean(
              draft.basics.deliveryLocation?.trim() &&
              (
                (resolvedAddress && draft.basics.deliveryLocation.trim().toLowerCase() === resolvedAddress.trim().toLowerCase()) ||
                deliveryAddressesList.some(a => formatDeliveryAddressString(a).toLowerCase() === draft.basics.deliveryLocation.trim().toLowerCase())
              )
            ) && (
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Auto-fetched from {resolvedAddressInfo?.source === 'gst' ? 'verified GST registration' : 'verified onboarding profile'}
              </p>
            )}
          </div>
        </div>
      </div>

    

      {isAddressModalOpen && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200" onWheel={e => e.stopPropagation()}>
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#12335f]">
                  Add New Delivery Address
                </h2>
                {resolvedAddressInfo && resolvedAddressInfo.source !== 'none' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddressLabel('Registered Head Office');
                      setOrganizationName(draft.internal.orgName || '');
                      setContactPersonName(draft.internal.contactPerson || '');
                      setMobileNumber(draft.internal.mobile || '');
                      setEmail(draft.internal.email || '');
                      setAddressLine1(resolvedAddressInfo.street || '');
                      setCity(resolvedAddressInfo.city || '');
                      setDistrict(resolvedAddressInfo.district || '');
                      setState(resolvedAddressInfo.state || '');
                      setPincode(resolvedAddressInfo.pincode || '');
                    }}
                    className="text-xs text-[#12335f] hover:underline font-bold mt-1 inline-flex items-center gap-1"
                  >
                    Auto-fill from verified onboarding / GST details
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAddress} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Address Label *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Headquarters, Warehouse A"
                    value={addressLabel}
                    onChange={e => setAddressLabel(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Organisation Name
                  </label>
                  <Input
                    placeholder="Company / Department Name"
                    value={organizationName}
                    onChange={e => setOrganizationName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Address Type *
                  </label>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                    value={['OFFICE', 'WAREHOUSE', 'PROJECT_SITE', 'FACTORY'].includes(addressType) ? addressType : 'OTHER'}
                    onChange={e => setAddressType(e.target.value)}
                  >
                    <option value="OFFICE">Office</option>
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="PROJECT_SITE">Project Site</option>
                    <option value="FACTORY">Factory</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {!['OFFICE', 'WAREHOUSE', 'PROJECT_SITE', 'FACTORY'].includes(addressType) && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Specify Address Type *
                    </label>
                    <Input
                      required
                      placeholder="e.g. Temporary, SHG Center, Hub"
                      value={addressType === 'OTHER' ? '' : addressType}
                      onChange={e => setAddressType(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Contact Person Name *
                  </label>
                  <Input
                    required
                    placeholder="Receiver Name"
                    value={contactPersonName}
                    onChange={e => setContactPersonName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Mobile Number *
                  </label>
                  <Input
                    required
                    type="tel"
                    pattern="[0-9]{10,15}"
                    minLength={10}
                    maxLength={15}
                    title="Mobile number must be between 10 and 15 digits"
                    placeholder="10-digit Mobile Number"
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Alternate Mobile
                  </label>
                  <Input
                    type="tel"
                    pattern="[0-9]{10,15}"
                    maxLength={15}
                    title="Alternate mobile number must be between 10 and 15 digits"
                    placeholder="Optional Mobile"
                    value={alternateMobileNumber}
                    onChange={e => setAlternateMobileNumber(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="Receiver Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Address Line 1 *
                </label>
                <Input
                  required
                  placeholder="Building/Flat/Plot Number, Street Name"
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Address Line 2
                </label>
                <Input
                  placeholder="Locality, Sector, Area (Optional)"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    State *
                  </label>
                  <select
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
                    value={state}
                    onChange={e => handleStateChange(e.target.value)}
                  >
                    <option value="">Select State</option>
                    {STATE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    District *
                  </label>
                  <select
                    required
                    disabled={!state}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    value={district}
                    onChange={e => handleDistrictChange(e.target.value)}
                  >
                    <option value="">Select District</option>
                    {getDistrictOptions(state).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    City *
                  </label>
                  <Input
                    required
                    placeholder="Enter city / town / village"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Pincode *
                  </label>
                  <Input
                    required
                    pattern="[0-9]{6,10}"
                    minLength={6}
                    maxLength={10}
                    title="Pincode must be between 6 and 10 digits"
                    placeholder="6 digits"
                    value={pincode}
                    onChange={e => setPincode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Landmark
                  </label>
                  <Input
                    placeholder="Nearby popular spot"
                    value={landmark}
                    onChange={e => setLandmark(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    GST State Code
                  </label>
                  <Input
                    placeholder="e.g. 27-Maharashtra"
                    value={gstState}
                    onChange={e => setGstState(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Place of Supply
                  </label>
                  <Input
                    placeholder="e.g. Maharashtra"
                    value={placeOfSupply}
                    onChange={e => setPlaceOfSupply(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="h-10 text-xs font-bold border-slate-300 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10 text-xs font-bold bg-[#12335f] hover:bg-[#12335f]/90 text-white"
                >
                  Save Address
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 Form components: Buyer & Internal details
// ─────────────────────────────────────────────────────────────────────────────
function InternalDetailsForm({
  draft,
  updateDraft,
  resolvedOrgName
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
  resolvedOrgName?: string;
}) {
  const updateInternal = (key: keyof Draft['internal'], val: string | boolean) => {
    updateDraft(c => ({ ...c, internal: { ...c.internal, [key]: val } }));
  };

  useEffect(() => {
    if (!draft.internal.orgName?.trim() && resolvedOrgName) {
      updateInternal('orgName', resolvedOrgName);
    }
  }, [draft.internal.orgName, resolvedOrgName]);

  const isAutoFetched = Boolean(resolvedOrgName && draft.internal.orgName?.trim().toLowerCase() === resolvedOrgName.trim().toLowerCase());

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization name" required>
          <div className="space-y-1.5">
            <div className="relative flex items-center">
              <input
                value={draft.internal.orgName}
                onChange={e => updateInternal('orgName', e.target.value)}
                className={inputClass}
                placeholder="Enter organization title"
              />
              {resolvedOrgName && !isAutoFetched && (
                <button
                  type="button"
                  onClick={() => updateInternal('orgName', resolvedOrgName)}
                  className="absolute right-2 text-[11px] font-bold text-[#12335f] hover:text-[#0d2342] bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition"
                  title={`Use verified organization: ${resolvedOrgName}`}
                >
                  Auto-fill from profile
                </button>
              )}
            </div>
            {isAutoFetched && (
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Auto-fetched from verified organization profile</span>
              </p>
            )}
          </div>
        </Field>

        {/* Buying Department field commented out as requested */}
        {/* <Field label="Buying Department" required>
          <input
            value={draft.internal.department}
            onChange={e => updateInternal('department', e.target.value)}
            className={inputClass}
            placeholder="Sourcing, Procurement, IT Dept..."
          />
        </Field> */}

        <Field label="Contact Person Name" required>
          <input
            value={draft.internal.contactPerson}
            onChange={e => updateInternal('contactPerson', e.target.value)}
            className={inputClass}
            placeholder="John Doe"
          />
        </Field>

        <Field label="Contact Email Address" required>
          <input
            type="email"
            value={draft.internal.email}
            onChange={e => updateInternal('email', e.target.value)}
            className={inputClass}
            placeholder="john.doe@company.com"
          />
        </Field>

        <Field label="Contact Mobile Number" required>
          <input
            value={draft.internal.mobile}
            onChange={e => updateInternal('mobile', e.target.value)}
            className={inputClass}
            placeholder="9876543210"
          />
        </Field>

        <Field label="Internal Approval Authority" required>
          <input
            value={draft.internal.approvalAuthority}
            onChange={e => updateInternal('approvalAuthority', e.target.value)}
            className={inputClass}
            placeholder="Chief Sourcing Officer"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
            {[
              'Department Head / HOD',
              'Chief Procurement Officer (CPO)',
              'Managing Director / CEO',
              'Finance Director / CFO',
              'Tender Committee'
            ].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => updateInternal('approvalAuthority', preset)}
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                  draft.internal.approvalAuthority === preset
                    ? "border-[#0b2447] bg-[#0b2447] text-white"
                    : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </Field>

        {/* Government specific fields commented out as requested
        <Field label="Department File / Case Number" required>
          <input
            value={draft.internal.internalFileNumber}
            onChange={e => updateInternal('internalFileNumber', e.target.value)}
            className={inputClass}
            placeholder="DEPT/2026/RFQ/8801"
          />
        </Field>

        <Field label="Competent Financial Authority (CFA)" required>
          <input
            value={draft.internal.competentAuthority}
            onChange={e => updateInternal('competentAuthority', e.target.value)}
            className={inputClass}
            placeholder="Director of Finance (DF)"
          />
        </Field>

        <Field label="Sanction Approval Authority" required>
          <input
            value={draft.internal.approvalAuthority}
            onChange={e => updateInternal('approvalAuthority', e.target.value)}
            className={inputClass}
            placeholder="Joint Secretary Sourcing"
          />
        </Field>
        */}

        <Field label="Purchase justification & compliance reason" className="sm:col-span-2" required>
          <div className="space-y-1.5">
            <textarea
              value={draft.internal.justification}
              onChange={e => updateInternal('justification', e.target.value)}
              rows={4}
              maxLength={1000}
              className={textareaClass}
              placeholder="State business justification, urgency reason, or GFR rule compliance justification..."
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
              {[
                'Annual replenishment for operational continuity',
                'Capex modernization & capacity expansion',
                'Statutory compliance & safety standard upgrade',
                'Emergency breakdown replacement & continuity'
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateInternal('justification', preset)}
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                    draft.internal.justification === preset
                      ? "border-[#0b2447] bg-[#0b2447] text-white"
                      : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </Field>
      </div>

      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
        <label className="flex items-start gap-2.5 sm:gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={draft.internal.budgetConfirmed}
            onChange={e => updateInternal('budgetConfirmed', e.target.checked)}
            className="h-5 w-5 rounded mt-0.5 accent-[#12335f]"
          />
          <div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Confirm Budget Allocation & Sanction</span>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">
              I verify that sufficient funds are allocated and sanctioned for this procurement purchase order under GFR/Corporate compliance guidelines.
            </p>
          </div>
        </label>
      </div>

      {/* Guidance Note Section commented out as related fields are commented out */}
      {/* <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-[#12335f]" /> Guidance on Accounting Codes & Project References
        </h4>
        <div className="grid gap-4 md:grid-cols-3 text-[11px] text-slate-600 font-medium leading-relaxed">
          <div className="space-y-1">
            <span className="font-bold text-slate-800 uppercase text-[9px] tracking-wide block">Cost Center *</span>
            <p>
              An internal unit or department code (e.g., <code className="bg-slate-100/80 px-1 py-0.5 rounded text-slate-700 font-semibold">CC-MKTG-102</code>) responsible for the expense. Required for ERP routing and tracking department-level spending.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-slate-800 uppercase text-[9px] tracking-wide block">Budget Head / Code</span>
            <p>
              The specific budget category or ledger line item (e.g., <code className="bg-slate-100/80 px-1 py-0.5 rounded text-slate-700 font-semibold">BH-CAPEX-IT</code>) to deduct funds from. Standard for category-wise limit control.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-slate-800 uppercase text-[9px] tracking-wide block">Project Code Reference</span>
            <p>
              The unique code for a temporary project or initiative (e.g., <code className="bg-slate-100/80 px-1 py-0.5 rounded text-slate-700 font-semibold">PROJ-2026-CLOUD</code>). Used to aggregate and monitor total project expenditure.
            </p>
          </div>
        </div>
      </div> */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 Form components: Items / Service / BOQ details (Enterprise Standard)
// ─────────────────────────────────────────────────────────────────────────────

const DOCUMENT_CATEGORIES = [
  { id: 'Technical Specification', label: 'Technical Specification', desc: 'Detailed specs, parameters, standards' },
  { id: 'Engineering Drawing / CAD', label: 'Engineering Drawing / CAD', desc: 'Blueprints, schematics, 2D/3D layouts' },
  { id: 'Datasheet / Brochure', label: 'Datasheet / Brochure', desc: 'OEM product sheet, catalog excerpt' },
  { id: 'Scope of Work (SOW)', label: 'Scope of Work (SOW)', desc: 'Deliverables, milestones, SLA clauses' },
  { id: 'Bill of Materials (BOM)', label: 'Bill of Materials / BOQ', desc: 'Component breakdown schedule' },
  { id: 'Compliance / Certificate', label: 'Compliance / Certificate', desc: 'ISO, BIS, CE, warranty guidelines' },
  { id: 'Other Supporting Document', label: 'Other Supporting Document', desc: 'General attachments, guidelines' },
];

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeDetails(fileName: string) {
  const ext = (fileName.substring(fileName.lastIndexOf('.')).toLowerCase()) || '';
  if (['.pdf'].includes(ext)) {
    return { ext: 'PDF', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: FileText };
  }
  if (['.doc', '.docx'].includes(ext)) {
    return { ext: 'DOC', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: FileText };
  }
  if (['.xls', '.xlsx', '.csv'].includes(ext)) {
    return { ext: 'XLS', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FileSpreadsheet };
  }
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return { ext: 'IMG', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: File };
  }
  return { ext: 'FILE', bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: FileText };
}

/** Enterprise Drag-and-Drop Document Uploader */
function EnterpriseDocumentDropzone({
  onUploadFile,
  isUploading,
  attachments,
  onRemoveAttachment,
  token,
  defaultCategory = 'Technical Specification',
  onPreviewAttachment,
}: {
  onUploadFile: (file: File, category: string) => Promise<void>;
  isUploading: boolean;
  attachments: ItemAttachment[];
  onRemoveAttachment: (attachmentId: string) => void;
  token: string | null;
  defaultCategory?: string;
  onPreviewAttachment?: (attachment: ItemAttachment) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [customDocName, setCustomDocName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const docName = customDocName.trim() || selectedCategory;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await onUploadFile(file, docName);
    }
    setCustomDocName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Attached files list - Displayed first for immediate viewing */}
      {attachments.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-emerald-600" />
              Uploaded Documents ({attachments.length})
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">Click View to preview any document</span>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {attachments.map(att => {
              const fileType = getFileTypeDetails(att.fileName);
              const viewUrl = `/api/files/${att.fileAssetId}/view?token=${encodeURIComponent(token || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''))}`;

              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black border", fileType.bg)}>
                      {fileType.ext}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate" title={att.fileName}>
                          {att.fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5">
                        {att.name && att.name !== att.fileName ? <span className="text-slate-600 font-bold bg-slate-100 px-1.5 py-0.2 rounded text-[9px]">{att.name}</span> : null}
                        {att.fileSize ? <span>{formatFileSize(att.fileSize)}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => onPreviewAttachment ? onPreviewAttachment(att) : window.open(viewUrl, '_blank')}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-black text-[#12335f] hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer shadow-3xs"
                      title={`Preview ${att.fileName}`}
                    >
                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove attachment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload New / Additional Document Section */}
      <div className="space-y-3 pt-1">
        <div className="text-[11px] font-bold text-slate-700">
          {attachments.length > 0 ? '+ Upload Another Document' : 'Upload Specification / Document'}
        </div>

        {/* Category selector & optional custom label */}
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
              Document Type
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f] transition-all"
            >
              {DOCUMENT_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="text"
              value={customDocName}
              onChange={e => setCustomDocName(e.target.value)}
              placeholder="Custom label / note (Optional)"
              className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f] transition-all"
              maxLength={100}
            />
          </div>
        </div>

        {/* Drag & Drop Dropzone */}
        <div
          onDragOver={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(true);
          }}
          onDragLeave={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
          }}
          onDrop={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            handleFileSelection(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "group relative cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all duration-200 select-none",
            isDragOver
              ? "border-[#12335f] bg-blue-50/80 ring-2 ring-[#12335f]/20 scale-[0.99]"
              : "border-slate-300 bg-slate-50/60 hover:border-[#12335f]/60 hover:bg-slate-100/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
            multiple
            onChange={e => handleFileSelection(e.target.files)}
            className="hidden"
            disabled={isUploading}
          />
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110",
              isUploading ? "bg-blue-100 text-[#12335f]" : "bg-[#12335f]/10 text-[#12335f]"
            )}>
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderUp className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                {isUploading ? 'Uploading file...' : (
                  <>
                    <span className="text-[#12335f] underline underline-offset-2">Browse</span> or drag & drop file
                  </>
                )}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                PDF, Word, Excel, Images (up to 10MB)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Quick Document Manager Modal for In-Table Trigger */
function QuickDocumentModal({
  item,
  onClose,
  onSaveAttachments,
  token,
  onPreviewAttachment,
}: {
  item: ItemRow;
  onClose: () => void;
  onSaveAttachments: (updatedAttachments: ItemAttachment[]) => void;
  token: string | null;
  onPreviewAttachment?: (attachment: ItemAttachment) => void;
}) {
  const [attachments, setAttachments] = useState<ItemAttachment[]>(() => {
    if (item.attachments && item.attachments.length > 0) {
      return item.attachments;
    }
    if (item.fileAssetId && item.specificationFileName) {
      return [{
        id: makeId(),
        name: 'Technical Specification',
        fileAssetId: item.fileAssetId,
        fileName: item.specificationFileName,
        uploadedAt: new Date().toISOString(),
      }];
    }
    return [];
  });
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File, category: string) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be 10MB or less');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'procurement_draft');
      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const resData = await unwrap<any>(response);
      const asset = resData.file || resData;
      const fileId = Number(resData.fileId || asset.id || 0);

      const newAtt: ItemAttachment = {
        id: makeId(),
        name: category,
        fileAssetId: fileId,
        fileName: asset.originalName || file.name,
        fileSize: asset.size || file.size,
        mimeType: asset.mimeType || file.type,
        uploadedAt: new Date().toISOString(),
      };
      const nextList = [...attachments, newAtt];
      setAttachments(nextList);
      onSaveAttachments(nextList);
      toast.success(`Attached "${newAtt.fileName}" successfully`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (id: string) => {
    const nextList = attachments.filter(a => a.id !== id);
    setAttachments(nextList);
    onSaveAttachments(nextList);
    toast.info('Document removed');
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-[999990] p-4 animate-in fade-in duration-150"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#12335f]/10 text-[#12335f]">
              <Paperclip className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Specifications & Documents
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold truncate max-w-md">
                {item.name || 'Selected Line Item'} • {item.itemType || 'Product'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <EnterpriseDocumentDropzone
            onUploadFile={handleUpload}
            isUploading={isUploading}
            attachments={attachments}
            onRemoveAttachment={handleRemove}
            token={token}
            defaultCategory="Technical Specification"
            onPreviewAttachment={onPreviewAttachment}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold text-slate-500">
            {attachments.length} document{attachments.length === 1 ? '' : 's'} attached
          </span>
          <Button
            type="button"
            onClick={onClose}
            className="h-9 px-5 text-xs font-black bg-[#12335f] text-white hover:bg-[#0b2445]"
          >
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type ItemModalFormData = Omit<ItemRow, 'quantity' | 'unitPrice'> & {
  quantity: number | string;
  unitPrice: number | string;
};

/** Full Add / Edit Line Item Modal Dialog (Modern Centered Horizontal 2-Column Layout) */
function ItemDrawerOrModal({
  isOpen,
  item,
  onClose,
  onSave,
  onSaveAndAddAnother,
  token,
  onPreviewDocument,
  categoriesList = [],
  defaultCategory = '',
}: {
  isOpen: boolean;
  item: ItemRow | null;
  onClose: () => void;
  onSave: (item: ItemRow) => void;
  onSaveAndAddAnother: (item: ItemRow) => void;
  token: string | null;
  onPreviewDocument?: (doc: any, label?: string) => void;
  categoriesList?: Array<{ id: number; name: string }>;
  defaultCategory?: string;
}) {
  const [formData, setFormData] = useState<ItemModalFormData | null>(() => {
    if (!item) return null;
    return {
      ...item,
      category: item.category || defaultCategory || '',
      categoryId: item.categoryId ?? null,
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice && Number(item.unitPrice) > 0 ? String(item.unitPrice) : '',
    };
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        ...item,
        category: item.category || defaultCategory || '',
        categoryId: item.categoryId ?? null,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice && Number(item.unitPrice) > 0 ? String(item.unitPrice) : '',
      });
    } else {
      setFormData(null);
    }
    setValidationErrors({});
  }, [item, defaultCategory]);

  if (!isOpen || !formData) return null;

  const isService = formData.itemType === 'Service';
  const qty = Number(formData.quantity || 0);
  const rate = Number(formData.unitPrice || 0);
  const gstPct = Number(formData.gst || 0);
  const baseSubtotal = qty * rate;
  const gstAmount = (baseSubtotal * gstPct) / 100;
  const totalLineValue = baseSubtotal + gstAmount;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name?.trim()) {
      errs.name = isService ? 'Service title is required' : 'Item / Product Name is required';
    } else if (formData.name.length > 150) {
      errs.name = 'Must be at most 150 characters';
    }

    if (!formData.specification?.trim()) {
      errs.specification = isService ? 'Service Scope & Deliverables description is required' : 'Technical Specifications are required';
    } else if (formData.specification.length > 500) {
      errs.specification = 'Description must be at most 500 characters';
    }

    const parsedQty = parseInt(String(formData.quantity), 10);
    if (!formData.quantity || isNaN(parsedQty) || parsedQty <= 0) {
      errs.quantity = 'Must be a positive whole number';
    }

    if (!formData.unit) {
      errs.unit = 'Unit is required';
    }

    if (formData.hsn_sac_code && !/^\d+$/.test(formData.hsn_sac_code)) {
      errs.hsn_sac_code = 'Numbers only';
    }

    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please resolve the highlighted fields.');
      return false;
    }
    return true;
  };

  const handleUploadFile = async (file: File, category: string) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be 10MB or less');
      return;
    }
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entityType', 'procurement_draft');
      const res = await api.fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const resData = await unwrap<any>(res);
      const asset = resData.file || resData;
      const fileId = Number(resData.fileId || asset.id || 0);

      const newAtt: ItemAttachment = {
        id: makeId(),
        name: category,
        fileAssetId: fileId,
        fileName: asset.originalName || file.name,
        fileSize: asset.size || file.size,
        mimeType: asset.mimeType || file.type,
        uploadedAt: new Date().toISOString(),
      };
      const nextAtts = [...(formData.attachments || []), newAtt];
      setFormData({
        ...formData,
        attachments: nextAtts,
        fileAssetId: fileId,
        specificationFileName: newAtt.fileName,
      });
      toast.success(`Attached "${newAtt.fileName}" successfully`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    const nextAtts = (formData.attachments || []).filter(a => a.id !== attId);
    const first = nextAtts[0];
    setFormData({
      ...formData,
      attachments: nextAtts,
      fileAssetId: first?.fileAssetId || null,
      specificationFileName: first?.fileName || '',
    });
    toast.info('Document removed');
  };

  const preparePayload = (): ItemRow => {
    return {
      ...formData,
      quantity: Math.max(1, parseInt(String(formData.quantity), 10) || 1),
      unitPrice: Math.max(0, parseFloat(String(formData.unitPrice)) || 0),
      category: formData.category || defaultCategory || '',
      categoryId: formData.categoryId ?? null,
      hsn_sac_code: formData.hsn_sac_code?.trim() || '',
    };
  };

  const handleSaveClick = () => {
    if (!validate()) return;
    onSave(preparePayload());
  };

  const handleSaveAndAddClick = () => {
    if (!validate()) return;
    onSaveAndAddAnother(preparePayload());
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-[999999] p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl font-bold transition-colors shadow-2xs",
              isService ? "bg-[#0b2447]/10 text-[#0b2447]" : "bg-[#0b2447] text-white"
            )}>
              {isService ? <Wrench className="h-5 w-5" /> : <Package className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {formData.name ? `Edit: ${formData.name}` : (isService ? 'Add Service Line Item' : 'Add Product Line Item')}
                </h3>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                  isService ? "bg-[#0b2447]/10 text-[#0b2447] border border-[#0b2447]/20" : "bg-blue-100 text-blue-800"
                )}>
                  {formData.itemType || 'Product'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {isService ? 'Configure service scope, rates, deliverables, and SOW attachments' : 'Configure technical specs, quantity, commercial pricing, and drawings'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Streamlined Category Switcher Pill */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, itemType: 'Product', unit: formData.unit === 'Set' ? 'Nos' : formData.unit })}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all",
                  !isService
                    ? "bg-white text-[#0b2447] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Package className="h-3.5 w-3.5" />
                <span>Product</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, itemType: 'Service', unit: formData.unit === 'Nos' ? 'Set' : formData.unit })}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all",
                  isService
                    ? "bg-white text-[#0b2447] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Service</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
              title="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2-Column Horizontal Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 custom-scrollbar overscroll-contain">
          {/* Left Column (7 of 12 cols): Line Specs & Pricing */}
          <div className="lg:col-span-7 space-y-4">
            {/* Row 1: Name & HSN */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <Field label={isService ? "Service / Works Title" : "Item / Product Name"} required>
                  <input
                    value={formData.name}
                    onChange={e => {
                      setFormData({ ...formData, name: e.target.value });
                      if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: '' }));
                    }}
                    className={cn(inputClass, validationErrors.name && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15")}
                    placeholder={isService ? "e.g. Annual IT Support & Infrastructure Maintenance" : "e.g. Dell Latitude 7440 Core i7 Laptop"}
                    maxLength={150}
                  />
                  {validationErrors.name && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {validationErrors.name}
                    </p>
                  )}
                </Field>
              </div>

              <div className="sm:col-span-4">
                <Field label={isService ? "SAC Code" : "HSN Code"}>
                  <input
                    value={formData.hsn_sac_code || ''}
                    onChange={e => {
                      setFormData({ ...formData, hsn_sac_code: e.target.value.replace(/\D/g, '') });
                      if (validationErrors.hsn_sac_code) setValidationErrors(prev => ({ ...prev, hsn_sac_code: '' }));
                    }}
                    className={cn(inputClass, validationErrors.hsn_sac_code && "border-rose-500")}
                    placeholder={isService ? "e.g. 998713" : "e.g. 847130"}
                    maxLength={10}
                  />
                  {validationErrors.hsn_sac_code && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1">{validationErrors.hsn_sac_code}</p>
                  )}
                </Field>
              </div>
            </div>

            {/* Row 2: Specifications / SOW */}
            <Field label={isService ? "Scope of Work & Deliverables Details" : "Detailed Technical Specifications"} required>
              <textarea
                value={formData.specification}
                onChange={e => {
                  setFormData({ ...formData, specification: e.target.value });
                  if (validationErrors.specification) setValidationErrors(prev => ({ ...prev, specification: '' }));
                }}
                rows={3}
                className={cn(textareaClass, validationErrors.specification && "border-rose-500")}
                placeholder={
                  isService
                    ? "Specify SLA parameters, deliverables, response window, and personnel requirements..."
                    : "Specify technical parameters (e.g. 32GB RAM, 1TB NVMe, Intel i7 13th Gen, 3 Years Onsite Warranty)..."
                }
                maxLength={500}
              />
              <div className="flex justify-between items-center mt-1">
                {validationErrors.specification ? (
                  <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {validationErrors.specification}
                  </p>
                ) : <div />}
                <span className="text-[10px] text-slate-400 font-mono font-medium ml-auto">
                  {formData.specification.length}/500
                </span>
              </div>
            </Field>

            {/* Row 3: Brand & Flexibility */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <Field label="Preferred Brand / Make (Optional)">
                  <input
                    value={formData.brand_preference || ''}
                    onChange={e => setFormData({ ...formData, brand_preference: e.target.value })}
                    className={inputClass}
                    placeholder={isService ? "e.g. OEM / Certified Partner" : "e.g. Dell, HP, Lenovo"}
                    maxLength={100}
                  />
                </Field>
              </div>

              <div className="sm:col-span-6">
                <Field label="Brand Policy">
                  <div className="grid grid-cols-2 gap-1.5 h-9 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, brand_flexible: 'Yes' })}
                      className={cn(
                        "flex items-center justify-center gap-1 rounded-md text-[11px] font-bold transition-all",
                        formData.brand_flexible !== 'No'
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Equivalent OK</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, brand_flexible: 'No' })}
                      className={cn(
                        "flex items-center justify-center gap-1 rounded-md text-[11px] font-bold transition-all",
                        formData.brand_flexible === 'No'
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      <span>Strict Lock</span>
                    </button>
                  </div>
                </Field>
              </div>
            </div>

            {/* Row 3.5: Category Classification */}
            {categoriesList && categoriesList.length > 0 && (
              <Field label="Category / Classification (Optional)">
                <select
                  id="line-item-category-select"
                  aria-label="Item Category Classification"
                  value={formData.category || defaultCategory || ''}
                  onChange={e => {
                    const selName = e.target.value;
                    const matched = categoriesList.find(c => c.name === selName);
                    setFormData({
                      ...formData,
                      category: selName,
                      categoryId: matched ? matched.id : null,
                    });
                  }}
                  className={cn(inputClass, "cursor-pointer font-medium")}
                >
                  <option value="">{defaultCategory ? `Default (${defaultCategory})` : '-- Select Category --'}</option>
                  {categoriesList.map(cat => (
                    <option key={cat.id || cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {/* Row 4: Commercials (Qty, UOM, Rate, GST) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Quantity" required>
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => {
                        const current = parseInt(String(formData.quantity), 10) || 1;
                        if (current > 1) {
                          setFormData({ ...formData, quantity: current - 1 });
                          if (validationErrors.quantity) setValidationErrors(prev => ({ ...prev, quantity: '' }));
                        }
                      }}
                      className="absolute left-1 h-7 w-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition-colors select-none"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Item quantity"
                      value={formData.quantity ?? ''}
                      onChange={e => {
                        let val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length > 1 && val.startsWith('0')) {
                          val = val.replace(/^0+/, '');
                        }
                        setFormData({ ...formData, quantity: val });
                        if (validationErrors.quantity) setValidationErrors(prev => ({ ...prev, quantity: '' }));
                      }}
                      onBlur={() => {
                        const current = parseInt(String(formData.quantity), 10);
                        if (!current || current < 1) {
                          setFormData({ ...formData, quantity: 1 });
                        } else {
                          setFormData({ ...formData, quantity: current });
                        }
                      }}
                      className={cn(inputClass, "text-center px-7 font-bold", validationErrors.quantity && "border-rose-500")}
                      placeholder="1"
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => {
                        const current = parseInt(String(formData.quantity), 10) || 0;
                        setFormData({ ...formData, quantity: current + 1 });
                        if (validationErrors.quantity) setValidationErrors(prev => ({ ...prev, quantity: '' }));
                      }}
                      className="absolute right-1 h-7 w-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition-colors select-none"
                    >
                      +
                    </button>
                  </div>
                  {validationErrors.quantity && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1">{validationErrors.quantity}</p>
                  )}
                </Field>

                <Field label="UOM" required>
                  <select
                    value={formData.unit}
                    onChange={e => {
                      setFormData({ ...formData, unit: e.target.value });
                      if (validationErrors.unit) setValidationErrors(prev => ({ ...prev, unit: '' }));
                    }}
                    className={cn(inputClass, "font-semibold", validationErrors.unit && "border-rose-500")}
                  >
                    {QUANTITY_UNITS.map((u: any) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                  {validationErrors.unit && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1">{validationErrors.unit}</p>
                  )}
                </Field>

                <Field label={isService ? "Est. Service Fee / Benchmark Budget (₹)" : "Est. Unit Rate (₹)"}>
                  <div className="relative flex items-center">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-xs sm:text-sm font-bold text-slate-400 select-none">
                        ₹
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={isService ? "Estimated Service Fee in Rupees" : "Estimated Unit Rate in Rupees"}
                      value={formData.unitPrice ?? ''}
                      onChange={e => {
                        let val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) {
                          val = parts[0] + '.' + parts.slice(1).join('');
                        }
                        if (parts.length === 2 && parts[1].length > 2) {
                          val = parts[0] + '.' + parts[1].slice(0, 2);
                        }
                        if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                          val = val.replace(/^0+/, '') || '0';
                        }
                        setFormData({ ...formData, unitPrice: val });
                      }}
                      onBlur={() => {
                        if (formData.unitPrice !== '') {
                          let val = String(formData.unitPrice);
                          if (val.endsWith('.')) {
                            val = val.slice(0, -1);
                            setFormData({ ...formData, unitPrice: val });
                          }
                        }
                      }}
                      className={cn(inputClass, "pl-8 sm:pl-8 font-bold")}
                      placeholder={isService ? "e.g. 500000 (leave 0 for open bid)" : "0"}
                    />
                  </div>
                  {isService && (
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      Department benchmark or ceiling budget (excl. GST). Leave blank or 0 if bidders should propose their price freely.
                    </p>
                  )}
                </Field>

                <Field label="GST Rate">
                  <select
                    value={formData.gst}
                    onChange={e => setFormData({ ...formData, gst: parseFloat(e.target.value) || 0 })}
                    className={cn(inputClass, "font-semibold")}
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18% (Standard)</option>
                    <option value={28}>28%</option>
                  </select>
                </Field>
              </div>

              {/* Clean Live Commercial Strip */}
              <div className="mt-3 flex flex-wrap items-center justify-between rounded-xl bg-slate-50 border border-slate-200/90 px-4 py-2.5 text-xs">
                <div className="flex items-center gap-4 text-slate-600">
                  <span className="text-[11px] font-semibold">
                    {isService ? 'Base Service Fee:' : 'Subtotal:'} <strong className="text-slate-900 font-extrabold">₹{baseSubtotal.toLocaleString('en-IN')}</strong>
                  </span>
                  {gstPct > 0 && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      GST ({gstPct}%): <strong className="text-slate-800 font-extrabold">+₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    {isService ? 'Contract Total (Gross):' : 'Line Total:'}
                  </span>
                  <span className="text-sm font-black text-[#0b2447]">
                    ₹{totalLineValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5 of 12 cols): Documents & Attachments */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#0b2447]" />
                Specs & Drawings
              </h4>
              <span className="text-[10px] font-bold text-slate-400">
                {(formData.attachments || []).length} attached
              </span>
            </div>

            <EnterpriseDocumentDropzone
              onUploadFile={handleUploadFile}
              isUploading={isUploading}
              attachments={formData.attachments || []}
              onRemoveAttachment={handleRemoveAttachment}
              token={token}
              defaultCategory="Technical Specification"
              onPreviewAttachment={onPreviewDocument ? (att => onPreviewDocument(att, att.fileName)) : undefined}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-bold text-slate-600 text-left w-full sm:w-auto">
            <span className="text-slate-400 font-semibold">Line Total: </span>
            <span className="text-base font-black text-[#0b2447]">
              ₹{totalLineValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAndAddClick}
              className="h-9 px-4 text-xs font-bold border-[#0b2447]/30 text-[#0b2447] hover:bg-[#0b2447]/5"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Save & Add Another
            </Button>
            <Button
              type="button"
              onClick={handleSaveClick}
              className="h-9 px-6 text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f] shadow-md transition-all"
            >
              {formData.name ? 'Update Line Item' : 'Save Line Item'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Accessible Cart Category Alignment Review Modal */
function CartCategoryAlignmentModal({
  conflict,
  onClose,
  onImportMatchingOnly,
  onImportAll,
}: {
  conflict: {
    isOpen: boolean;
    tenderCategory: string;
    matchingItems: ItemRow[];
    mismatchedItems: ItemRow[];
    allItems: ItemRow[];
  } | null;
  onClose: () => void;
  onImportMatchingOnly: () => void;
  onImportAll: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conflict?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conflict, onClose]);

  if (!conflict?.isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-[999999] p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-category-alignment-title"
      aria-describedby="cart-category-alignment-desc"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-amber-50/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-bold shadow-2xs">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="cart-category-alignment-title" className="text-base font-black text-slate-900 tracking-tight">
                Cart Category Alignment
              </h3>
              <p id="cart-category-alignment-desc" className="text-[11px] text-slate-600 font-medium">
                Review item classifications before importing into your procurement schedule
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex items-start gap-3">
            <Info className="h-4 w-4 text-[#0b2447] shrink-0 mt-0.5" />
            <div className="space-y-1 text-slate-700 leading-relaxed">
              <p>
                Your procurement tender is categorized as <strong className="text-slate-900 bg-slate-200/80 px-1.5 py-0.5 rounded font-bold">{conflict.tenderCategory}</strong>.
              </p>
              <p className="text-slate-600 text-[11.5px]">
                {conflict.mismatchedItems.length} item{conflict.mismatchedItems.length === 1 ? '' : 's'} in your cart belong to different category classifications. Please choose how you want to proceed.
              </p>
            </div>
          </div>

          {/* Items breakdown list */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cart Items Classification Breakdown</span>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto custom-scrollbar">
              {conflict.allItems.map(it => {
                const isMatch = !it.category || it.category.trim().toLowerCase() === conflict.tenderCategory.trim().toLowerCase();
                return (
                  <div key={it.id} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/50">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">{it.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Qty: <strong className="text-slate-700">{it.quantity} {it.unit}</strong>
                        {it.hsn_sac_code && (
                          <span className="ml-2 font-mono text-[10.5px] bg-slate-100 px-1 rounded text-slate-600">
                            {it.itemType === 'Service' ? 'SAC ' : 'HSN '}{it.hsn_sac_code}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold",
                        isMatch
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      )}>
                        {it.category || 'Unclassified'}
                      </span>
                      {isMatch ? (
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                          <Check className="h-3 w-3" /> Matches
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                          <AlertCircle className="h-3 w-3" /> Differs
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {conflict.matchingItems.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={onImportMatchingOnly}
                className="text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100"
              >
                Import Matching Only ({conflict.matchingItems.length})
              </Button>
            )}
            <Button
              type="button"
              onClick={onImportAll}
              className="text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f]"
            >
              Import All Items ({conflict.allItems.length})
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ItemsDetailsForm({
  draft,
  updateDraft,
  showItemDrawer,
  setShowItemDrawer,
  selectedItemForEdit,
  setSelectedItemForEdit
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
  showItemDrawer: boolean;
  setShowItemDrawer: (open: boolean) => void;
  selectedItemForEdit: ItemRow | null;
  setSelectedItemForEdit: (item: ItemRow | null) => void;
}) {
  const category = draft.basics.procurementCategory || 'GOODS';
  const pricingFormat = draft.basics.pricingFormat || 'SINGLE_ITEM';
  const isService = category === 'SERVICES' || draft.type === 'RFP';
  const isWorks = category === 'WORKS';
  const isGoods = category === 'GOODS';
  const isBoqOrSor = pricingFormat === 'BOQ' || pricingFormat === 'SOR';
  const isRateContract = isRateContractMethod(draft.type);
  const { token } = useAuth();
  const { data: activeCart, isLoading: isCartLoading } = useActiveCart({ enabled: true });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [quickDocItem, setQuickDocItem] = useState<ItemRow | null>(null);
  const [quickDocBoqRowIdx, setQuickDocBoqRowIdx] = useState<number | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);
  const [cartCategoryConflict, setCartCategoryConflict] = useState<{
    isOpen: boolean;
    tenderCategory: string;
    matchingItems: ItemRow[];
    mismatchedItems: ItemRow[];
    allItems: ItemRow[];
  } | null>(null);

  // Dynamic master metadata from database / backend
  const [categoriesList, setCategoriesList] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [uomsList, setUomsList] = useState<Array<{ value: string; label: string }>>([]);
  const [taxSlabsList, setTaxSlabsList] = useState<Array<{ value: number; label: string }>>([]);

  useEffect(() => {
    let active = true;
    setLoadingCategories(true);

    api.get('/api/categories')
      .then(res => readJsonResponse(res))
      .then(body => unwrapApiData<any>(body))
      .then(cats => {
        if (active && Array.isArray(cats)) {
          setCategoriesList(
            cats
              .map((c: any) => ({ id: Number(c.id || 0), name: String(c.name || '').trim() }))
              .filter(c => Boolean(c.name))
          );
        }
      })
      .catch(err => {
        console.warn('Failed to load categories in ItemsDetailsForm:', err);
      })
      .finally(() => {
        if (active) setLoadingCategories(false);
      });

    api.get('/api/uoms')
      .then(res => readJsonResponse(res))
      .then(body => unwrapApiData<any>(body))
      .then(uoms => {
        if (active && Array.isArray(uoms)) {
          setUomsList(uoms);
        }
      })
      .catch(err => {
        console.warn('Failed to load UOMs from database:', err);
      });

    api.get('/api/tax-slabs')
      .then(res => readJsonResponse(res))
      .then(body => unwrapApiData<any>(body))
      .then(slabs => {
        if (active && Array.isArray(slabs)) {
          setTaxSlabsList(slabs);
        }
      })
      .catch(err => {
        console.warn('Failed to load tax slabs:', err);
      });

    return () => {
      active = false;
    };
  }, []);

  const handlePreviewDoc = async (doc: any, label = 'Document') => {
    try {
      const fileAssetId = doc?.fileAssetId || doc?.id || (typeof doc === 'number' ? doc : undefined);
      const fileName = doc?.fileName || doc?.originalName || doc?.name || label;
      const fileUrl = doc?.fileUrl || doc?.url || (fileAssetId ? `/api/files/${fileAssetId}/view` : undefined);

      if (fileAssetId || fileUrl) {
        try {
          const prev = await getFileAssetPreview(
            {
              id: fileAssetId,
              fileAssetId,
              url: fileUrl,
              fileName,
              mimeType: doc?.mimeType,
            },
            fileName
          );
          if (prev) {
            setPreviewDocument(prev);
            return;
          }
        } catch (e) {
          console.warn('Modal preview fallback to openFileAsset:', e);
        }

        await openFileAsset(
          {
            id: fileAssetId,
            fileAssetId,
            originalName: fileName,
            url: fileUrl,
          },
          fileName
        );
      } else {
        toast.error('Document file asset ID not found');
      }
    } catch (err: any) {
      console.error('Preview error:', err);
      toast.error(err?.message || 'Unable to preview document');
    }
  };

  const handlePreviewItemDoc = (item: ItemRow) => {
    const attachmentsList = item.attachments || [];
    const primaryDoc = attachmentsList[0] || (item.fileAssetId ? { fileAssetId: item.fileAssetId, fileName: item.specificationFileName || `${item.name || 'Item'} Specification`, name: item.name } : null);
    if (!primaryDoc) {
      setQuickDocItem(item);
      return;
    }
    handlePreviewDoc(primaryDoc, primaryDoc.fileName || item.name || 'Specification');
  };

  // Line Item Handlers
  const handleAddNewItem = (itemType: 'Product' | 'Service' = 'Product') => {
    setSelectedItemForEdit({
      id: makeId(),
      itemType,
      name: '',
      specification: '',
      quantity: 1,
      unit: itemType === 'Service' ? 'Set' : 'Nos',
      unitPrice: 0,
      gst: 18,
      deliveryDate: nextFortnight,
      brandPolicy: 'Equivalent allowed',
      technicalSpecification: '',
      specificationFileName: '',
      hsn_sac_code: '',
      brand_preference: '',
      brand_flexible: 'Yes',
      fileAssetId: null,
      attachments: [],
    });
    setShowItemDrawer(true);
  };

  const handleSaveItem = (item: ItemRow) => {
    updateDraft(current => {
      const idx = current.items.findIndex(i => i.id === item.id);
      const nextItems = [...current.items];
      if (idx >= 0) {
        nextItems[idx] = item;
      } else {
        nextItems.push(item);
      }
      const totals = computeProcurementTotals(nextItems);
      const nextEst = totals.grossValue > 0 ? Math.round(totals.grossValue) : current.basics.estimatedValue;
      return {
        ...current,
        basics: { ...current.basics, estimatedValue: nextEst },
        items: nextItems
      };
    });
    toast.success('Line item saved successfully');
    setShowItemDrawer(false);
    setSelectedItemForEdit(null);
  };

  const handleSaveAndAddAnother = (item: ItemRow) => {
    updateDraft(current => {
      const idx = current.items.findIndex(i => i.id === item.id);
      const nextItems = [...current.items];
      if (idx >= 0) {
        nextItems[idx] = item;
      } else {
        nextItems.push(item);
      }
      const totals = computeProcurementTotals(nextItems);
      const nextEst = totals.grossValue > 0 ? Math.round(totals.grossValue) : current.basics.estimatedValue;
      return {
        ...current,
        basics: { ...current.basics, estimatedValue: nextEst },
        items: nextItems
      };
    });
    // Immediately open blank next item of same type
    const nextType = item.itemType || 'Product';
    setSelectedItemForEdit({
      id: makeId(),
      itemType: nextType,
      name: '',
      specification: '',
      quantity: 1,
      unit: nextType === 'Service' ? 'Set' : 'Nos',
      unitPrice: 0,
      gst: 18,
      deliveryDate: nextFortnight,
      brandPolicy: 'Equivalent allowed',
      technicalSpecification: '',
      specificationFileName: '',
      hsn_sac_code: '',
      brand_preference: '',
      brand_flexible: 'Yes',
      fileAssetId: null,
      attachments: [],
    });
    toast.success('Item saved! Ready to add next line item.');
  };

  const handleDuplicateItem = (itemToDuplicate: ItemRow) => {
    const duplicated: ItemRow = {
      ...itemToDuplicate,
      id: makeId(),
      name: `${itemToDuplicate.name} (Copy)`,
      attachments: (itemToDuplicate.attachments || []).map(a => ({ ...a, id: makeId() })),
    };
    updateDraft(current => {
      const idx = current.items.findIndex(i => i.id === itemToDuplicate.id);
      const nextItems = [...current.items];
      if (idx >= 0) {
        nextItems.splice(idx + 1, 0, duplicated);
      } else {
        nextItems.push(duplicated);
      }
      const totals = computeProcurementTotals(nextItems);
      return {
        ...current,
        basics: { ...current.basics, estimatedValue: Math.round(totals.grossValue) },
        items: nextItems
      };
    });
    toast.success(`Duplicated line item: "${itemToDuplicate.name}"`);
  };

  const handleRemoveItem = (id: string) => {
    updateDraft(current => {
      const nextItems = current.items.filter(item => item.id !== id);
      const totals = computeProcurementTotals(nextItems);
      return {
        ...current,
        basics: { ...current.basics, estimatedValue: Math.round(totals.grossValue) },
        items: nextItems
      };
    });
    toast.info('Item removed');
  };

  const handleSaveItemQuickAttachments = (itemId: string, updatedAttachments: ItemAttachment[]) => {
    updateDraft(current => {
      const first = updatedAttachments[0];
      const nextItems = current.items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            attachments: updatedAttachments,
            fileAssetId: first?.fileAssetId || null,
            specificationFileName: first?.fileName || '',
          };
        }
        return item;
      });
      return { ...current, items: nextItems };
    });
  };

  const handleDownloadItemTemplate = async () => {
    const isService = draft.basics.procurementCategory === 'SERVICES';
    const isWorks = draft.basics.procurementCategory === 'WORKS';
    const isSor = draft.basics.pricingFormat === 'SOR';
    const isBoq = draft.basics.pricingFormat === 'BOQ';

    let templateHeaders: string[];
    let sampleRows: any[][];
    let templateName: string;

    if (isSor) {
      templateHeaders = ['Item Code', 'Item Description / Scope', 'UOM', 'Baseline SOR Rate (INR)', 'Estimated Annual Qty', 'GST %', 'HSN/SAC Code', 'Allowable Variation Cap %'];
      sampleRows = [
        ['SOR-CIV-001', 'Excavation in all types of soil including disposal within 50m', 'Cu.m', 285, 500, 18, '9954', 5],
        ['SOR-ELE-004', 'Laying and termination of 4-core 16 sq.mm armoured copper cable', 'Meter', 145, 1200, 18, '9954', 5]
      ];
      templateName = 'procurement_sor_rate_schedule_template';
    } else if (isWorks || isBoq) {
      templateHeaders = ['Trade / Item Type', 'Item Name', 'Detailed Technical Scope / BOQ Description', 'Quantity', 'Unit', 'Estimated Unit Rate', 'GST %', 'HSN/SAC Code', 'Deliverable Milestone', 'Delivery Due Date'];
      sampleRows = [
        [isWorks ? 'Civil Execution' : 'Product', 'Reinforced Cement Concrete M25 Grade', 'Design mix RCC with approved aggregate and OPC 53 cement', 150, 'Cu.m', 4800, 18, '3824', 'Foundation Milestone', nextFortnight],
        [isWorks ? 'Structural Steel' : 'Product', 'Mild Steel Fabrication & Erection', 'Supply, fabrication and erection of structural steel framing', 25, 'MT', 65000, 18, '7208', 'Superstructure Milestone', nextFortnight]
      ];
      templateName = isWorks ? 'procurement_works_boq_template' : 'procurement_boq_schedule_template';
    } else if (isService) {
      templateHeaders = ['Service Type', 'Service Title', 'Detailed Scope of Work & Deliverables', 'Staff / Units', 'UOM', 'Monthly Rate / Fee', 'GST %', 'SAC Code', 'SLA Response Time', 'Required By Date'];
      sampleRows = [
        ['Facility Management', 'Comprehensive Annual Maintenance Contract (CAMC)', 'Quarterly preventive maintenance with round-the-clock emergency support', 1, 'Set', 35000, 18, '9987', '4 Hours', nextFortnight],
        ['Security Services', 'Trained Security Guards Deployment (3 Shifts)', 'Round-the-clock security surveillance by certified guards', 6, 'Person-Month', 22000, 18, '9985', 'Immediate', nextFortnight]
      ];
      templateName = 'procurement_services_template';
    } else {
      templateHeaders = itemTemplateHeaders;
      sampleRows = [
        ['Product', 'M30 Concrete Paver Block', 'ISI marked paver block, 60mm thickness, heavy duty traffic rated', 1000, 'Nos', 45, 18, '6810', 'UltraTech / Equivalent', 'Yes', nextFortnight],
        ['Product', 'Galvanized Iron Pipes 50mm', 'Class B heavy gauge hot-dipped galvanized steel pipes conforming to IS 1239', 50, 'Length', 1250, 18, '7306', 'Tata / Jindal', 'Yes', nextFortnight]
      ];
      templateName = 'procurement_goods_template';
    }

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'JSGSMILE Enterprise Procurement Portal';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Schedule Items', { views: [{ showGridLines: true }] });

      sheet.addRow(templateHeaders);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF12335F' }
      };
      headerRow.height = 24;

      sampleRows.forEach(row => sheet.addRow(row));

      sheet.columns = templateHeaders.map((_, i) => ({ width: i === 1 || i === 2 ? 35 : 16 }));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${templateName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded Excel template: ${templateName}.xlsx`);
    } catch {
      downloadCsv(`${templateName}.csv`, [
        templateHeaders,
        ...sampleRows
      ]);
      toast.success(`Downloaded CSV template: ${templateName}.csv`);
    }
  };

  const handleImportItemTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith('.csv') || lowerName.endsWith('.txt');
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

    if (!isCsv && !isExcel) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    try {
      const rows = await readSpreadsheetRows(file);
      if (rows.length < 2) {
        toast.error('Template has no item rows to import.');
        return;
      }

      const [headers, ...dataRows] = rows;
      const importedItems = dataRows
        .map((row, index) => importedCsvRowToItem(headers, row, index))
        .filter((item): item is ItemRow => Boolean(item));

      if (importedItems.length === 0) {
        toast.error('No valid item rows found. Item Name is required.');
        return;
      }

      updateDraft(current => {
        const nextItems = [...current.items, ...importedItems];
        const totals = computeProcurementTotals(nextItems);
        return {
          ...current,
          basics: {
            ...current.basics,
            estimatedValue: Math.round(totals.grossValue),
          },
          items: nextItems,
        };
      });
      toast.success(`Imported ${importedItems.length} item/service row${importedItems.length === 1 ? '' : 's'}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to import template');
    }
  };

  const applyImportedCartItems = (itemsToImport: ItemRow[], updatedCategory?: string) => {
    updateDraft(current => {
      const manualItems = current.items.filter(item => !String(item.id).startsWith('cart:'));
      const nextItems = [...manualItems, ...itemsToImport];
      const totals = computeProcurementTotals(nextItems);
      const nextEst = totals.grossValue > 0 ? Math.round(totals.grossValue) : current.basics.estimatedValue;
      return {
        ...current,
        basics: {
          ...current.basics,
          estimatedValue: nextEst,
          ...(updatedCategory ? { category: updatedCategory } : {}),
        },
        items: nextItems,
      };
    });
    toast.success(`Imported ${itemsToImport.length} ${isService ? 'service' : 'product'} item${itemsToImport.length === 1 ? '' : 's'} from Cart`);
  };

  const handleImportCartItems = () => {
    const rawCartItems = activeCart?.items || [];
    if (rawCartItems.length === 0) {
      toast.error('Cart is empty. Add catalogue items from Marketplace first.');
      return;
    }

    const cartItems = rawCartItems.filter(item => {
      const itemIsService = Boolean(item.serviceId || item.service || (item as any).itemType === 'Service');
      return isService ? itemIsService : !itemIsService;
    });

    if (cartItems.length === 0) {
      if (isService) {
        toast.error('No service items found in active cart. Please add services from the marketplace.');
      } else {
        toast.error('No product items found in active cart. Please add products from the marketplace.');
      }
      return;
    }

    const importedItems = cartItems.map(cartItemToProcurementItem);
    const tenderCategory = (draft.basics.category || '').trim();

    // Case 1: Tender category is empty -> auto-populate from primary category of cart items
    if (!tenderCategory) {
      const primaryCategory = importedItems.find(it => it.category)?.category || '';
      applyImportedCartItems(importedItems, primaryCategory || undefined);
      if (primaryCategory) {
        toast.info(`Procurement category automatically set to "${primaryCategory}" from imported items.`, {
          duration: 4500,
        });
      }
      return;
    }

    // Case 2: Tender category is set -> check for category alignment
    const norm = (s: string) => s.trim().toLowerCase();
    const matching = importedItems.filter(it => !it.category || norm(it.category) === norm(tenderCategory));
    const mismatched = importedItems.filter(it => it.category && norm(it.category) !== norm(tenderCategory));

    if (mismatched.length === 0) {
      applyImportedCartItems(importedItems);
    } else {
      setCartCategoryConflict({
        isOpen: true,
        tenderCategory,
        matchingItems: matching,
        mismatchedItems: mismatched,
        allItems: importedItems,
      });
    }
  };

  // Service details handlers
  const updateService = (key: keyof Draft['serviceDetails'], val: string) => {
    updateDraft(current => ({
      ...current,
      serviceDetails: { ...current.serviceDetails, [key]: val }
    }));
  };

  useEffect(() => {
    if (isService && !draft.serviceDetails.serviceTitle?.trim() && draft.basics.title?.trim()) {
      updateService('serviceTitle', draft.basics.title.trim());
    }
  }, [isService, draft.basics.title, draft.serviceDetails.serviceTitle]);

  const [uploadingSow, setUploadingSow] = useState(false);

  const handleSOWUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSow(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'procurement_draft');
      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const resData = await unwrap<any>(response);
      const asset = resData.file || resData;
      const fileId = Number(resData.fileId || asset.id || 0);

      updateDraft(c => ({
        ...c,
        serviceDetails: {
          ...c.serviceDetails,
          sowFileAssetId: fileId,
          sowFileName: asset.originalName || file.name,
          sowFileUrl: asset.url || `/api/files/${fileId}/view`,
        }
      }));
      toast.success(`Scope of Work (SOW) document "${file.name}" uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload SOW document');
    } finally {
      setUploadingSow(false);
      e.target.value = '';
    }
  };

  const handleRemoveSOW = () => {
    updateDraft(c => ({
      ...c,
      serviceDetails: {
        ...c.serviceDetails,
        sowFileAssetId: null,
        sowFileName: '',
        sowFileUrl: '',
      }
    }));
    toast.info('SOW document removed');
  };

  const handleBOQUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'procurement_draft');
      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const resData = await unwrap<any>(response);
      const asset = resData.file || resData;
      const fileId = Number(resData.fileId || asset.id || 0);

      // Parse spreadsheet rows if it's an Excel or CSV file
      let parsedBoqRows: BOQRow[] = [];
      try {
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
          const rows = await readSpreadsheetRows(file);
          if (rows.length >= 2) {
            const [headers, ...dataRows] = rows;
            const normH = headers.map(normalizeImportHeader);
            const findCol = (...aliases: string[]) => normH.findIndex(h => aliases.includes(h));
            const descIdx = findCol('itemdescription', 'description', 'descriptionscopeofwork', 'descriptionscope', 'scopeofwork', 'itemname', 'name', 'particulars', 'details');
            const catIdx = findCol('category', 'itemcategory');
            const qtyIdx = findCol('quantity', 'qty', 'units');
            const uomIdx = findCol('uom', 'unit', 'unitofmeasure');
            const rateIdx = findCol('estimatedrateinr', 'estimatedrate', 'rate', 'estimatedunitprice', 'unitprice', 'price');
            const taxIdx = findCol('tax', 'taxpercent', 'taxpercentage', 'gst', 'gstpercent');
            const hsnIdx = findCol('hsnsaccode', 'hsncode', 'saccode', 'hsnsac', 'hsn', 'sac');
            const remIdx = findCol('remarks', 'remark', 'specification', 'specifications', 'scopeofwork', 'scope', 'notes');

            dataRows.forEach((r, idx) => {
              const desc = descIdx >= 0 ? String(r[descIdx] || '').trim() : '';
              if (desc) {
                const qty = Math.max(1, Number(qtyIdx >= 0 ? r[qtyIdx] : 1) || 1);
                const rate = Math.max(0, Number(rateIdx >= 0 ? r[rateIdx] : 0) || 0);
                const tax = Number(taxIdx >= 0 ? r[taxIdx] : 18) || 18;
                const hsn = hsnIdx >= 0 && r[hsnIdx] ? String(r[hsnIdx]).trim() : '';
                parsedBoqRows.push({
                  srNo: idx + 1,
                  description: desc,
                  category: catIdx >= 0 && r[catIdx] ? String(r[catIdx]).trim() : 'General',
                  quantity: qty,
                  uom: uomIdx >= 0 && r[uomIdx] ? String(r[uomIdx]).trim().slice(0, 120) : 'Nos',
                  estimatedRate: rate,
                  taxPercent: tax,
                  hsnSacCode: hsn,
                  attachments: [],
                  fileAssetId: null,
                  fileName: '',
                  fileSize: null,
                  total: qty * rate * (1 + tax / 100),
                  remarks: remIdx >= 0 && r[remIdx] ? String(r[remIdx]).trim() : '',
                });
              }
            });
          }
        }
      } catch (parseErr) {
        console.warn('Could not parse BOQ spreadsheet rows:', parseErr);
      }

      updateDraft(c => {
        const nextTable = parsedBoqRows.length > 0 ? parsedBoqRows : c.boqTable;
        const totalSum = nextTable.reduce((acc, row) => acc + (Number(row.total) || (Number(row.quantity || 0) * Number(row.estimatedRate || 0))), 0);
        return {
          ...c,
          boqFileAssetId: fileId,
          boqFileName: asset.originalName || file.name,
          boqTable: nextTable,
          basics: {
            ...c.basics,
            estimatedValue: parsedBoqRows.length > 0 ? totalSum : c.basics.estimatedValue
          }
        };
      });
      toast.success(parsedBoqRows.length > 0
        ? `BOQ file uploaded & ${parsedBoqRows.length} item row${parsedBoqRows.length === 1 ? '' : 's'} imported`
        : 'BOQ file uploaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload BOQ');
    } finally {
      setUploadingFile(false);
    }
  };

  // BOQ Handlers
  const handleAddBOQRow = () => {
    updateDraft(c => {
      const nextTable = [...c.boqTable, {
        srNo: c.boqTable.length + 1,
        description: '',
        category: 'General',
        quantity: 1,
        uom: 'Nos',
        estimatedRate: 0,
        taxPercent: 18,
        hsnSacCode: '',
        attachments: [],
        fileAssetId: null,
        fileName: '',
        fileSize: null,
        total: 0,
        remarks: ''
      }];
      const sum = nextTable.reduce((acc, r) => acc + (Number(r.quantity || 0) * Number(r.estimatedRate || 0) * (1 + Number(r.taxPercent ?? 18) / 100)), 0);
      return { ...c, boqTable: nextTable, basics: { ...c.basics, estimatedValue: Math.round(sum) } };
    });
  };

  const handleBOQDuplicateRow = (idx: number) => {
    updateDraft(c => {
      const target = c.boqTable[idx];
      const nextTable = [...c.boqTable];
      nextTable.splice(idx + 1, 0, {
        ...target,
        srNo: nextTable.length + 1
      });
      const reindexed = nextTable.map((row, i) => ({ ...row, srNo: i + 1 }));
      const sum = reindexed.reduce((acc, r) => acc + (Number(r.quantity || 0) * Number(r.estimatedRate || 0) * (1 + Number(r.taxPercent ?? 18) / 100)), 0);
      return { ...c, boqTable: reindexed, basics: { ...c.basics, estimatedValue: Math.round(sum) } };
    });
  };

  const handleRemoveBOQRow = (idx: number) => {
    updateDraft(c => {
      const nextTable = c.boqTable.filter((_, i) => i !== idx).map((row, i) => ({ ...row, srNo: i + 1 }));
      const sum = nextTable.reduce((acc, r) => acc + (Number(r.quantity || 0) * Number(r.estimatedRate || 0) * (1 + Number(r.taxPercent ?? 18) / 100)), 0);
      return { ...c, boqTable: nextTable, basics: { ...c.basics, estimatedValue: Math.round(sum) } };
    });
  };

  const handleBOQCellChange = (idx: number, key: keyof BOQRow, val: any) => {
    updateDraft(c => {
      const nextTable = [...c.boqTable];
      const row = { ...nextTable[idx], [key]: val } as BOQRow;
      if (key === 'quantity' || key === 'estimatedRate' || key === 'taxPercent') {
        const qty = Number(key === 'quantity' ? val : row.quantity || 0);
        const rate = Number(key === 'estimatedRate' ? val : row.estimatedRate || 0);
        const tax = Number(key === 'taxPercent' ? val : row.taxPercent ?? 18);
        row.total = qty * rate * (1 + tax / 100);
      }
      nextTable[idx] = row;
      const sum = nextTable.reduce((acc, r) => acc + (Number(r.quantity || 0) * Number(r.estimatedRate || 0) * (1 + Number(r.taxPercent ?? 18) / 100)), 0);
      return { ...c, boqTable: nextTable, basics: { ...c.basics, estimatedValue: Math.round(sum) } };
    });
  };

  const handleUploadBoqRowFile = async (rowIdx: number, file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be 25MB or less');
      return;
    }
    const toastId = toast.loading(`Uploading "${file.name}"...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'procurement_draft');
      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const resData = await unwrap<any>(response);
      const asset = resData.file || resData;
      const fileId = Number(resData.fileId || asset.id || 0);
      const newAtt = {
        id: makeId(),
        name: 'Technical Specification',
        fileAssetId: fileId,
        fileName: asset.originalName || file.name,
        fileSize: asset.size || file.size,
        mimeType: asset.mimeType || file.type,
        uploadedAt: new Date().toISOString(),
        url: asset.url || `/api/files/${fileId}`,
      };

      updateDraft(c => {
        const nextTable = [...c.boqTable];
        const row = nextTable[rowIdx];
        if (!row) return c;
        const currentAtts = Array.isArray(row.attachments) ? row.attachments : [];
        const nextAtts = [...currentAtts, newAtt];
        nextTable[rowIdx] = {
          ...row,
          fileAssetId: fileId,
          fileName: newAtt.fileName,
          fileSize: newAtt.fileSize,
          attachments: nextAtts,
        };
        return { ...c, boqTable: nextTable };
      });
      toast.success(`Attached "${file.name}" successfully`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to upload document', { id: toastId });
    }
  };

  const handleRemoveBoqRowFile = (rowIdx: number, attachmentId?: string) => {
    updateDraft(c => {
      const nextTable = [...c.boqTable];
      const row = nextTable[rowIdx];
      if (!row) return c;
      const currentAtts = Array.isArray(row.attachments) ? row.attachments : [];
      const nextAtts = attachmentId ? currentAtts.filter(a => a.id !== attachmentId) : [];
      const first = nextAtts[0];
      nextTable[rowIdx] = {
        ...row,
        fileAssetId: first ? first.fileAssetId : null,
        fileName: first ? first.fileName : '',
        fileSize: first ? first.fileSize : null,
        attachments: nextAtts,
      };
      return { ...c, boqTable: nextTable };
    });
    toast.info('Document removed');
  };

  const procurementItemColumns: ColumnDef<any>[] = useMemo(() => {
    const isServiceMode = isService;

    const baseColumns: ColumnDef<any>[] = [
      {
        key: 'type',
        header: 'Type',
        width: isServiceMode ? 'w-[7%] min-w-[70px]' : 'w-[6%] min-w-[65px]',
        cell: (item: any) => (
          <span className={cn(
            "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider whitespace-nowrap shadow-3xs",
            item.itemType === 'Service'
              ? "border border-blue-200 bg-blue-50 text-blue-800"
              : "border border-slate-200 bg-slate-100 text-slate-800"
          )}>
            {item.itemType || 'Product'}
          </span>
        )
      },
      {
        key: 'name',
        header: isServiceMode ? 'Service Title' : 'Item / Product Name',
        width: isServiceMode ? 'w-[17%] min-w-[160px]' : 'w-[16%] min-w-[150px]',
        cell: (item: any) => (
          <div className="font-bold text-slate-900 text-xs leading-snug break-words max-w-full" title={item.name}>
            <div className="line-clamp-2">{item.name || <span className="text-rose-500 italic font-normal">{isServiceMode ? 'Unnamed Service' : 'Unnamed Item'}</span>}</div>
            {item.category && (
              <div className="mt-1">
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-600 border border-slate-200">
                  <Tag className="h-2.5 w-2.5 text-slate-400" />
                  {item.category}
                </span>
              </div>
            )}
          </div>
        )
      },
      {
        key: 'specifications',
        header: isServiceMode ? 'Scope & Deliverables' : 'Specifications / Scope',
        width: isServiceMode ? 'w-[18%] min-w-[170px]' : 'w-[16%] min-w-[150px]',
        cellClassName: 'text-slate-600 font-medium',
        cell: (item: any) => {
          const descText = item.specification || item.technicalSpecification || (item as any).description || (item as any).scopeOfWork || (typeof (item as any).specifications === 'object' ? ((item as any).specifications?.specification || (item as any).specifications?.scopeOfWork || (item as any).specifications?.description) : '') || '';
          return (
            <span className="line-clamp-2 text-xs leading-relaxed text-slate-600 break-words" title={descText || undefined}>
              {descText ? descText : <span className="text-slate-400 italic">No description</span>}
            </span>
          );
        }
      },
      {
        key: 'quantity',
        header: isServiceMode ? 'Billing Qty' : 'Qty & UOM',
        width: isServiceMode ? 'w-[8%] min-w-[80px]' : 'w-[8%] min-w-[80px]',
        align: 'center',
        cell: (item: any) => (
          <div className="whitespace-nowrap text-center">
            <span className="font-extrabold text-slate-900 text-xs">{item.quantity}</span>{' '}
            <span className="text-[10px] font-bold text-slate-500 uppercase">{item.unit || (isServiceMode ? 'SET' : 'NOS')}</span>
          </div>
        )
      },
      {
        key: 'rate',
        header: isServiceMode ? 'Est. Service Fee' : 'Est. Unit Rate',
        width: isServiceMode ? 'w-[13%] min-w-[120px]' : 'w-[12%] min-w-[115px]',
        align: 'right',
        cellClassName: 'font-extrabold text-slate-900',
        cell: (item: any) => {
          const rate = Number(item.unitPrice || 0);
          const gst = Number(item.gst ?? 18);
          return rate > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSelectedItemForEdit(item);
                setShowItemDrawer(true);
              }}
              className="text-right whitespace-nowrap group cursor-pointer inline-block"
              title="Click to edit fee"
            >
              <div className="font-extrabold text-slate-900 text-xs group-hover:text-[#0b2447] transition-colors">
                ₹{rate.toLocaleString('en-IN')}
              </div>
              <div className="text-[9.5px] font-bold text-slate-500">+{gst}% GST</div>
            </button>
          ) : (
            <div className="text-right whitespace-nowrap">
              <button
                type="button"
                onClick={() => {
                  setSelectedItemForEdit(item);
                  setShowItemDrawer(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-black text-[#0b2447] bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-3xs transition-all cursor-pointer whitespace-nowrap"
                title="Click to set estimated benchmark fee for this service"
              >
                <Plus className="h-3 w-3" />
                <span>Set Fee</span>
              </button>
            </div>
          );
        }
      },
      {
        key: 'total',
        header: isServiceMode ? 'Total (Incl. GST)' : 'Line Total (Incl. GST)',
        width: isServiceMode ? 'w-[13%] min-w-[120px]' : 'w-[13%] min-w-[120px]',
        align: 'right',
        cellClassName: 'font-extrabold text-slate-900',
        cell: (item: any) => {
          const qty = Number(item.quantity || 0);
          const rate = Number(item.unitPrice || 0);
          const gst = Number(item.gst ?? 18);
          const base = qty * rate;
          const total = base * (1 + gst / 100);
          return total > 0 ? (
            <div className="text-right whitespace-nowrap">
              <div className="font-black text-[#0b2447] text-xs">₹{Math.round(total).toLocaleString('en-IN')}</div>
              <div className="text-[9.5px] font-semibold text-slate-400">Base: ₹{base.toLocaleString('en-IN')}</div>
            </div>
          ) : (
            <div className="text-right whitespace-nowrap">
              <span className="text-slate-400 text-[11px] italic font-medium">Bidders to Quote</span>
            </div>
          );
        }
      },
      {
        key: 'hsn',
        header: isServiceMode ? 'SAC Code' : 'HSN Code',
        width: isServiceMode ? 'w-[7%] min-w-[75px]' : 'w-[7%] min-w-[75px]',
        align: 'center',
        cellClassName: 'font-mono text-[11px] font-semibold text-slate-600 truncate text-center',
        cell: (item: any) => {
          const code = item.hsn_sac_code || '';
          return code ? (
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold tracking-tight inline-block",
              item.itemType === 'Service'
                ? "bg-blue-50 text-blue-800 border border-blue-200"
                : "bg-slate-100 text-slate-700 border border-slate-200"
            )}>
              {item.itemType === 'Service' && !String(code).startsWith('SAC') ? `SAC ${code}` : code}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          );
        }
      },
    ];

    // Only include Brand & Policy column when buying Products
    if (!isServiceMode) {
      baseColumns.push({
        key: 'brand',
        header: 'Brand & Policy',
        width: 'w-[9%] min-w-[95px]',
        cell: (item: any) => (
          <div className="min-w-0">
            <div className="text-slate-800 text-[11px] font-bold truncate max-w-full" title={item.brand_preference}>
              {item.brand_preference || 'Any Brand'}
            </div>
            <div className="mt-0.5 whitespace-nowrap">
              {item.brand_flexible === 'No' ? (
                <span className="inline-flex items-center text-[9px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                  Lock
                </span>
              ) : (
                <span className="inline-flex items-center text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                  Flexible
                </span>
              )}
            </div>
          </div>
        )
      });
    }

    baseColumns.push(
      {
        key: 'documents',
        header: isServiceMode ? 'SOW & Docs' : 'Docs & Specs',
        width: isServiceMode ? 'w-[9%] min-w-[95px]' : 'w-[9%] min-w-[95px]',
        cell: (item: any) => {
          const attachmentsList = item.attachments || [];
          const hasDocs = attachmentsList.length > 0 || Boolean(item.specificationFileName);
          const docCount = attachmentsList.length || (item.specificationFileName ? 1 : 0);

          return hasDocs ? (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <button
                type="button"
                onClick={() => setQuickDocItem(item)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/90 hover:bg-emerald-100 hover:border-emerald-300 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 transition-all cursor-pointer shadow-3xs whitespace-nowrap shrink-0"
                title="Click to view all uploaded documents"
                aria-label={`View ${docCount} documents for ${item.name || 'item'}`}
              >
                <Paperclip className="h-3 w-3 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>
                  {docCount} file{docCount === 1 ? '' : 's'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setQuickDocItem(item)}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                title="Add more documents"
                aria-label={`Add more documents for ${item.name || 'item'}`}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setQuickDocItem(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white hover:border-[#0b2447] hover:bg-slate-50 px-2.5 py-1 text-[10.5px] font-semibold text-slate-700 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-3xs"
              title="Attach specification or drawing"
              aria-label={`Attach specification or drawing for ${item.name || 'item'}`}
            >
              <Paperclip className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
              <span>Attach</span>
            </button>
          );
        }
      },
      {
        key: 'actions',
        header: 'Actions',
        width: isServiceMode ? 'w-[10%] min-w-[110px]' : 'w-[10%] min-w-[110px]',
        align: 'right',
        cell: (item: any) => (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedItemForEdit(item);
                setShowItemDrawer(true);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10.5px] font-bold text-[#0b2447] bg-[#0b2447]/5 hover:bg-[#0b2447]/10 border border-[#0b2447]/15 transition-colors cursor-pointer shrink-0"
              title="Edit specifications and pricing"
              aria-label={`Edit ${item.name || 'line item'}`}
            >
              <Pencil className="h-3 w-3 text-[#0b2447]" aria-hidden="true" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => handleDuplicateItem(item)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Duplicate line item"
              aria-label={`Duplicate ${item.name || 'line item'}`}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => handleRemoveItem(item.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
              title="Delete line item"
              aria-label={`Delete ${item.name || 'line item'}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )
      }
    );

    return baseColumns;
  }, [isService, handleDuplicateItem, handleRemoveItem]);

  // 1. BOQ Table Mode (for BOQ Sourced, SOR, or Works Contracts)
  if (isBoqOrSor || isWorks) {
    return (
      <div className="space-y-4 w-full min-w-0 max-w-full">
        {/* Scope of Work (SOW) Dossier Section for RFP, Works, or BOQ */}
        <div className="rounded-xl border border-purple-200 bg-white/90 p-3 sm:p-4 space-y-2.5 shadow-3xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="h-4 w-4 text-purple-700 shrink-0" aria-hidden="true" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Scope of Work (SOW) / Project Dossier Document
                </span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                  {draft.type === 'RFP' ? 'Mandatory for RFP' : 'Project Dossier'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Upload terms of reference, specifications dossier, or technical drawings (PDF, Word, Excel) to accompany this BOQ schedule.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                type="file"
                id="boq-sow-document-upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleSOWUpload}
                className="sr-only"
                disabled={uploadingSow}
                aria-label="Upload Scope of Work Document"
              />
              <label
                htmlFor="boq-sow-document-upload"
                className={cn(
                  "cursor-pointer inline-flex items-center justify-center h-8.5 px-3.5 rounded-lg border border-purple-300 bg-white hover:bg-purple-50 text-xs font-bold text-purple-900 transition-all shadow-3xs shrink-0 whitespace-nowrap focus-within:ring-2 focus-within:ring-purple-400",
                  uploadingSow && "opacity-50 pointer-events-none"
                )}
              >
                {uploadingSow ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5 text-purple-600" aria-hidden="true" />
                    <span>Uploading SOW...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1.5 text-purple-600" aria-hidden="true" />
                    <span>{draft.serviceDetails.sowFileName ? 'Replace SOW File' : 'Upload SOW Document'}</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {draft.serviceDetails.sowFileName && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl animate-fadeIn">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span className="truncate">Attached SOW: <strong>{draft.serviceDetails.sowFileName}</strong></span>
              <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold shrink-0">Scope Satisfied</span>
              {draft.serviceDetails.sowFileAssetId && (
                <button
                  type="button"
                  onClick={() => handlePreviewDoc({ fileAssetId: draft.serviceDetails.sowFileAssetId, fileName: draft.serviceDetails.sowFileName }, 'Scope of Work')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#12335f] hover:underline ml-2 shrink-0 cursor-pointer"
                  title="Preview uploaded SOW file"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview
                </button>
              )}
              <button
                type="button"
                onClick={handleRemoveSOW}
                className="text-rose-500 hover:text-rose-700 font-bold ml-auto shrink-0 cursor-pointer"
                aria-label="Remove SOW Document"
              >
                Remove
              </button>
            </div>
          )}

          <div className="pt-1">
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Scope of Work Summary / Technical Specifications (Optional if SOW document attached)
            </label>
            <textarea
              value={draft.serviceDetails.scopeOfWork}
              onChange={e => updateService('scopeOfWork', e.target.value)}
              rows={2}
              className={textareaClass}
              placeholder="Enter summary of work scope, project objectives, and technical expectations..."
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2.5 gap-2.5">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              {isWorks ? 'Works Schedule / Bill of Quantities (BOQ)' : 'Structured Bill of Quantities (BOQ)'}
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {isWorks ? 'Itemized schedule of construction, fabrication, or execution trades' : 'Invite quotes using an itemized spreadsheet schedule'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                toast.info('Downloading BOQ Excel Template...');
                window.open(`${BASE_URL}/api/buyer-showcase/boq/template`, '_blank');
              }}
              className="h-8.5 text-xs font-bold text-slate-700 shrink-0 whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-1 text-slate-500" aria-hidden="true" /> Template
            </Button>
            
            <div className="relative shrink-0">
              <input
                type="file"
                id="boq-upload"
                accept=".xls,.xlsx,.csv"
                onChange={handleBOQUpload}
                className="sr-only"
                disabled={uploadingFile}
                aria-label="Upload BOQ File"
              />
              <label
                htmlFor="boq-upload"
                className={cn(
                  "cursor-pointer inline-flex items-center justify-center h-8.5 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all shadow-3xs shrink-0 whitespace-nowrap focus-within:ring-2 focus-within:ring-[#12335f]/20",
                  uploadingFile && "opacity-50 pointer-events-none"
                )}
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1 text-slate-500" aria-hidden="true" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1 text-slate-500" aria-hidden="true" />
                    <span>Upload BOQ File</span>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        {draft.boqFileName && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl max-w-md animate-fadeIn">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="truncate">Uploaded BOQ: <strong>{draft.boqFileName}</strong></span>
            <button
              type="button"
              onClick={() => updateDraft(c => ({ ...c, boqFileName: '', boqFileAssetId: null }))}
              className="text-rose-500 hover:text-rose-700 font-bold ml-auto shrink-0"
            >
              Remove
            </button>
          </div>
        )}

        {draft.type === 'RATE_CONTRACT' && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-3 sm:p-3.5 text-xs text-indigo-950 font-medium shadow-3xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-black uppercase tracking-wide text-indigo-900 text-xs">
                Schedule of Rates (SOR) Contract
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                Rate Agreement
              </span>
            </div>
            <p className="text-[11px] text-indigo-900/90">
              Unit rates configured below establish the legally binding price ceiling for all future call-off purchase orders during the contract validity period. Quantities represent indicative annual consumption.
            </p>
          </div>
        )}

        <BOQTable
          rows={draft.boqTable}
          onChange={handleBOQCellChange}
          onAddRow={handleAddBOQRow}
          onDuplicateRow={handleBOQDuplicateRow}
          onDeleteRow={handleRemoveBOQRow}
          estimatedTotal={draft.basics.estimatedValue}
          categories={categoriesList}
          loadingCategories={loadingCategories}
          uomOptions={uomsList}
          taxRateOptions={taxSlabsList}
          onAttachDocument={(idx) => setQuickDocBoqRowIdx(idx)}
          onUploadRowDocument={handleUploadBoqRowFile}
          onRemoveRowDocument={handleRemoveBoqRowFile}
          onPreviewDocument={(att) => handlePreviewDoc(att, att.fileName || att.name)}
          onSyncEstimatedTotal={(newTotal) => {
            updateDraft(c => ({
              ...c,
              basics: { ...c.basics, estimatedValue: newTotal }
            }));
            toast.success('Tender estimated budget synced with BOQ Schedule Total!');
          }}
        />

        {/* Quick Document Manager Modal for BOQ Rows */}
        {quickDocBoqRowIdx !== null && draft.boqTable[quickDocBoqRowIdx] && (
          <QuickDocumentModal
            item={{
              id: `boq-row-${quickDocBoqRowIdx}`,
              name: draft.boqTable[quickDocBoqRowIdx].description || `BOQ Item #${draft.boqTable[quickDocBoqRowIdx].srNo}`,
              itemType: draft.boqTable[quickDocBoqRowIdx].category || 'BOQ Item',
              attachments: draft.boqTable[quickDocBoqRowIdx].attachments || [],
              fileAssetId: draft.boqTable[quickDocBoqRowIdx].fileAssetId,
              specificationFileName: draft.boqTable[quickDocBoqRowIdx].fileName,
            } as any}
            onClose={() => setQuickDocBoqRowIdx(null)}
            onSaveAttachments={updatedAtts => {
              const first = updatedAtts[0];
              updateDraft(c => {
                const nextTable = [...c.boqTable];
                const row = nextTable[quickDocBoqRowIdx];
                if (!row) return c;
                nextTable[quickDocBoqRowIdx] = {
                  ...row,
                  attachments: updatedAtts,
                  fileAssetId: first ? first.fileAssetId : null,
                  fileName: first ? first.fileName : '',
                  fileSize: first ? first.fileSize : null,
                };
                return { ...c, boqTable: nextTable };
              });
            }}
            token={token}
            onPreviewAttachment={att => handlePreviewDoc(att, att.fileName)}
          />
        )}

        {/* In-App Direct Document Preview Modal */}
        <DocumentPreviewModal
          previewDocument={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      </div>
    );
  }

  // Service Details Panel (when Service is selected)
  const hasSowDoc = Boolean(draft.serviceDetails.sowFileAssetId || draft.serviceDetails.sowFileName);

  const serviceDetailsPanel = isService ? (
    <div className="space-y-4 rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/40 w-full min-w-0 max-w-full shadow-3xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b2447]/10 text-[#0b2447] shadow-3xs">
            <Wrench className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                {isRateContract ? 'Service Scope of Work (SOW) & SLA Parameters' : 'Master Service Contract Terms & SOW'}
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0b2447]/10 text-[#0b2447] border border-[#0b2447]/20">
                {isRateContract ? 'Rate Contract / Schedule of Rates' : 'Enterprise Sourcing Standard'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium">
              {isRateContract
                ? 'Define service scope, deliverables, operational SLA response targets, and technical boundaries for call-off releases'
                : 'Define overall SLA, deliverables scope, duration, and penalty terms'}
            </p>
          </div>
        </div>
      </div>

      {/* Rate Contract vs Lump-Sum SOW Pricing & Confidential Budget Banner */}
      {isRateContract ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 sm:p-3.5 space-y-1.5 shadow-3xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-blue-700 shrink-0" aria-hidden="true" />
              <span className="text-xs font-black text-blue-950 uppercase tracking-wide">
                Pricing Model: Schedule of Unit Rates (SOR) / Blanket Call-Off
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
              Blanket Agreement
            </span>
          </div>
          <p className="text-[11px] text-blue-900/90 font-medium">
            Participating bidders will quote unit rates or line-item fees. Contract validity period and periodic call-off release rules are configured under <strong>Step 6 (Timeline & Rules)</strong>.
          </p>
          <div className="pt-1 flex items-center gap-2 flex-wrap text-[10.5px]">
            <span className="font-bold text-slate-700">Internal Benchmark Ceiling: ₹{Number(draft.basics.estimatedValue || 0).toLocaleString('en-IN')}</span>
            {!draft.basics.discloseEstimatedCost ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                ✓ Blind Bidding Active (Budget hidden from bidders for genuine market price discovery)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
                ⚠ Disclosed Budget (Bidders can view internal ceiling)
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 sm:p-3.5 space-y-1.5 shadow-3xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <IndianRupee className="h-4 w-4 text-blue-700 shrink-0" aria-hidden="true" />
              <span className="text-xs font-black text-blue-950 uppercase tracking-wide">
                Pricing Model: Lump-Sum Total Contract Value
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
              Single Commercial Quote
            </span>
          </div>
          <p className="text-[11px] text-blue-900/90 font-medium">
            Participating bidders will quote a single <strong>Lump-Sum Base Fee + GST %</strong> covering the entire Scope of Work (SOW). No milestone or itemized breakdown required.
          </p>
          <div className="pt-1 flex items-center gap-2 flex-wrap text-[10.5px]">
            <span className="font-bold text-slate-700">Internal Benchmark: ₹{Number(draft.basics.estimatedValue || 0).toLocaleString('en-IN')}</span>
            {!draft.basics.discloseEstimatedCost ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                ✓ Blind Bidding Active (Budget hidden from bidders for genuine market price discovery)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
                ⚠ Disclosed Budget (Bidders can view internal ceiling)
              </span>
            )}
          </div>
        </div>
      )}

      {/* SOW Document Upload Bar (SAP Ariba / GeM fast-track pattern) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2.5 shadow-3xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="h-4 w-4 text-[#0b2447] shrink-0" aria-hidden="true" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Scope of Work (SOW) / RFP Dossier Document
              </span>
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                Fast-Track SOW
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Have a pre-drafted RFP dossier or SOW specification? Upload your document (PDF, Word, Excel) to satisfy scope requirements without retyping.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="file"
              id="sow-document-upload"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleSOWUpload}
              className="sr-only"
              disabled={uploadingSow}
              aria-label="Upload Scope of Work Document"
            />
            <label
              htmlFor="sow-document-upload"
              className={cn(
                "cursor-pointer inline-flex items-center justify-center h-8.5 px-3.5 rounded-lg border border-slate-300 bg-white hover:border-[#0b2447] hover:bg-slate-50 text-xs font-bold text-slate-800 transition-all shadow-3xs shrink-0 whitespace-nowrap focus-within:ring-2 focus-within:ring-[#0b2447]/20",
                uploadingSow && "opacity-50 pointer-events-none"
              )}
            >
              {uploadingSow ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5 text-slate-600" aria-hidden="true" />
                  <span>Uploading SOW...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1.5 text-slate-600" aria-hidden="true" />
                  <span>{draft.serviceDetails.sowFileName ? 'Replace SOW File' : 'Upload SOW Document'}</span>
                </>
              )}
            </label>
          </div>
        </div>

        {draft.serviceDetails.sowFileName && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="truncate">Attached SOW: <strong>{draft.serviceDetails.sowFileName}</strong></span>
            <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold shrink-0">Scope Satisfied</span>
            {draft.serviceDetails.sowFileAssetId && (
              <button
                type="button"
                onClick={() => handlePreviewDoc({ fileAssetId: draft.serviceDetails.sowFileAssetId, fileName: draft.serviceDetails.sowFileName }, 'Scope of Work')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0b2447] hover:underline ml-2 shrink-0 cursor-pointer"
                title="Preview uploaded SOW file"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview
              </button>
            )}
            <button
              type="button"
              onClick={handleRemoveSOW}
              className="text-rose-500 hover:text-rose-700 font-bold ml-auto shrink-0 cursor-pointer"
              aria-label="Remove SOW Document"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        <Field label="Service Contract Title" required className="sm:col-span-2">
          <div className="space-y-1">
            <input
              value={draft.serviceDetails.serviceTitle || draft.basics.title || ''}
              onChange={e => updateService('serviceTitle', e.target.value)}
              className={inputClass}
              placeholder="e.g. Master Service Agreement for Facility Management, Annual Maintenance Contract..."
            />
            <p className="text-[10px] text-slate-400 font-medium">Defaults to procurement title. Customize if needed.</p>
          </div>
        </Field>

        <Field
          label={hasSowDoc ? "Scope of Work (SOW) Executive Summary" : "Scope of Work (SOW)"}
          required={!hasSowDoc}
          className="sm:col-span-2"
        >
          <div className="space-y-1">
            <textarea
              value={draft.serviceDetails.scopeOfWork}
              onChange={e => updateService('scopeOfWork', e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder={hasSowDoc ? "Optional brief executive summary (full scope is governed by your attached SOW document)..." : "Detailed description of the service scope, technical responsibilities, and coverage..."}
            />
            <p className="text-[10px] text-slate-500 font-medium">
              {hasSowDoc
                ? "Full SOW document is attached above. You may leave this blank or provide an executive summary."
                : "Describe technical responsibilities and operational boundaries (min 10 characters, or upload SOW document above)."}
            </p>
          </div>
        </Field>

        <Field label="Key Deliverables & Milestones" required={!hasSowDoc}>
          <div className="space-y-1.5">
            <textarea
              value={draft.serviceDetails.deliverables}
              onChange={e => updateService('deliverables', e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder={hasSowDoc ? "e.g. Monthly uptime reports, SLA review (or see attached SOW)..." : "e.g. Monthly uptime reports, quarterly preventive maintenance, SLA log..."}
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
              {[
                'Phase-wise milestones & sign-off',
                'Monthly SLA & uptime reports',
                'Final acceptance & warranty support'
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const cur = draft.serviceDetails.deliverables.trim();
                    updateService('deliverables', cur ? `${cur}\n• ${preset}` : `• ${preset}`);
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Exclusions / Boundaries">
          <div className="space-y-1.5">
            <textarea
              value={draft.serviceDetails.exclusions}
              onChange={e => updateService('exclusions', e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder="Consumables or equipment outside service contract scope..."
            />
            <p className="text-[10px] text-slate-400 font-medium">Specify activities and materials strictly excluded from vendor scope.</p>
          </div>
        </Field>

        <Field label="SLA Response & Resolution Time">
          <div className="space-y-1.5">
            <input
              value={draft.serviceDetails.slaResponseTime}
              onChange={e => updateService('slaResponseTime', e.target.value)}
              className={inputClass}
              placeholder="e.g. 2 hrs response, 8 hrs resolution"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
              {[
                '2 hrs Response / 8 hrs Resolution',
                '4 hrs Response / 24 hrs Resolution',
                'Next Business Day (NBD)'
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateService('slaResponseTime', preset)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </Field>

        {isRateContract ? (
          <div className="rounded-xl border border-blue-200/90 bg-blue-50/60 p-3.5 space-y-2 shadow-3xs flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-700 shrink-0" aria-hidden="true" />
              <span className="text-xs font-black text-blue-950 uppercase tracking-wide">
                Contract Duration &amp; Validity
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Governed in Step 6
              </span>
            </div>
            <p className="text-[11px] text-blue-900/90 font-medium leading-relaxed">
              Rate contract agreement validity start &amp; expiry dates are configured under <strong>Step 6 (Timeline &amp; Rules)</strong>.
            </p>
            {draft.rateContractConfig.rateValidityPeriod ? (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-950 bg-white/80 border border-blue-200 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                <span>Synchronized Duration: <strong>{draft.rateContractConfig.rateValidityPeriod}</strong></span>
              </div>
            ) : (
              <p className="text-[10.5px] text-slate-500 font-semibold italic">
                Will be automatically calculated upon setting agreement dates.
              </p>
            )}
          </div>
        ) : (
          <Field label="Contract Duration" required>
            <div className="space-y-1.5">
              <input
                value={draft.serviceDetails.duration}
                onChange={e => updateService('duration', e.target.value)}
                className={inputClass}
                placeholder="e.g. 1 Year (12 Months), 6 Months"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
                {['6 Months', '1 Year (12 Months)', '2 Years (24 Months)', '3 Years (36 Months)'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateService('duration', preset)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </Field>
        )}

        <Field label="On-site Manpower / Team Size (Optional)">
          <div className="space-y-1">
            <input
              type="number"
              min={0}
              value={draft.serviceDetails.manpowerRequired}
              onChange={e => updateService('manpowerRequired', e.target.value)}
              className={inputClass}
              placeholder="e.g. 0 (leave 0 if deliverable-based)"
            />
            <p className="text-[10px] text-slate-500 font-medium">
              Only for dedicated on-site personnel or staffing. Outcome-based and AMC services can leave this as 0.
            </p>
          </div>
        </Field>

        {isRateContract ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2 shadow-3xs flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#0b2447] shrink-0" aria-hidden="true" />
              <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Liquidated Damages &amp; Penalties
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0b2447]/10 text-[#0b2447] border border-[#0b2447]/20">
                Governed in Step 7
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              Standard liquidated damages and SLA penalty terms for periodic release call-off orders are configured under <strong>Step 7 (Commercial Terms)</strong>.
            </p>
            {draft.terms.penaltyClause ? (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[280px]">Configured: <strong>{draft.terms.penaltyClause}</strong></span>
              </div>
            ) : (
              <p className="text-[10.5px] text-slate-500 font-semibold italic">
                Centralized penalty clause active.
              </p>
            )}
          </div>
        ) : (
          <Field label="Late Delivery / Downtime Penalty Terms">
            <div className="space-y-1.5">
              <input
                value={draft.serviceDetails.penaltyClause}
                onChange={e => {
                  const val = e.target.value;
                  updateService('penaltyClause', val);
                  updateDraft(c => ({
                    ...c,
                    serviceDetails: { ...c.serviceDetails, penaltyClause: val },
                    terms: { ...c.terms, penaltyClause: c.terms.penaltyClause || val },
                  }));
                }}
                className={inputClass}
                placeholder="e.g. 0.5% per week of delay up to max 10%"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
                {[
                  '0.5% per week delay (max 10%)',
                  '1% per day SLA downtime penalty',
                  'Standard LD per GCC / PO'
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      updateService('penaltyClause', preset);
                      updateDraft(c => ({
                        ...c,
                        serviceDetails: { ...c.serviceDetails, penaltyClause: preset },
                        terms: { ...c.terms, penaltyClause: c.terms.penaltyClause || preset },
                      }));
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </Field>
        )}
      </div>
    </div>
  ) : null;

  // 2. Item / Service Schedule Mode
  return (
    <div className="space-y-5 w-full min-w-0 max-w-full">
      {serviceDetailsPanel}
      <div className="border-b border-slate-100 pb-3.5 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                {isRateContract ? 'Schedule of Rates (SOR) & Item Specifications' : 'Procurement Schedule & Specifications'}
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">
                {draft.items.length} line{draft.items.length === 1 ? '' : 's'}
              </span>
              {isRateContract && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0b2447]/10 text-[#0b2447] border border-[#0b2447]/20">
                  Rate Agreement Baseline
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {isRateContract
                ? 'Establish unit rates and indicative consumption volumes. Rates are locked for all future call-off purchase orders.'
                : 'Add product/service items, configure pricing and GST, and attach technical specifications & drawings.'}
            </p>
          </div>
        </div>

        {isService && draft.items.length === 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/90 border border-slate-200 rounded-xl text-xs text-slate-900 animate-fadeIn">
            <div className="space-y-0.5">
              <span className="font-extrabold uppercase text-[#0b2447] tracking-wide block">
                {isRateContract ? 'Initialize Master Service Rate Item (SOR)' : 'Initialize Single Lump-Sum SOW Contract Item'}
              </span>
              <p className="text-[11px] text-slate-600 font-medium">
                {isRateContract
                  ? 'Auto-generate a master service rate line item with indicative annual volume synchronized with your scope of work.'
                  : 'Auto-generate the single Lump-Sum line item (1 Job / Set) synchronized with your contract title and internal benchmark.'}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const title = draft.serviceDetails.serviceTitle || draft.basics.title || 'Routine Maintenance & Service Scope';
                const estVal = Number(draft.basics.estimatedValue || 0);
                const gst = 18;
                const baseVal = estVal > 0 ? Math.round((estVal / (1 + gst / 100)) * 100) / 100 : 0;
                const existingIdx = draft.items.findIndex(i => i.itemType === 'Service' && (i.id === 'sow-master-line' || i.name === title));
                const targetId = existingIdx >= 0 ? draft.items[existingIdx].id : 'sow-master-line';

                handleSaveItem({
                  id: targetId,
                  itemType: 'Service',
                  name: title,
                  specification: draft.serviceDetails.scopeOfWork || 'As per attached Scope of Work (SOW) specification document and SLA terms.',
                  quantity: 1,
                  unit: isRateContract ? 'Job' : 'Job',
                  unitPrice: baseVal,
                  gst: gst,
                  deliveryDate: nextFortnight,
                  brandPolicy: 'Equivalent allowed',
                  technicalSpecification: draft.serviceDetails.scopeOfWork || '',
                  specificationFileName: draft.serviceDetails.sowFileName || '',
                  hsn_sac_code: '',
                  brand_preference: '',
                  brand_flexible: 'Yes',
                  fileAssetId: draft.serviceDetails.sowFileAssetId || null,
                  attachments: [],
                });

                if (estVal <= 0) {
                  toast.info(isRateContract ? 'Rate item initialized with benchmark ₹0. Bidders will quote unit rates in bid.' : 'SOW Line initialized with benchmark ₹0. Bidders will quote pricing in bid.');
                } else {
                  toast.success(isRateContract ? 'Initialized Master Service Rate Item (SOR) synchronized with tender budget.' : 'Initialized 1 Lump-Sum SOW line synchronized with tender budget.');
                }
              }}
              className="bg-[#0b2447] hover:bg-[#12335f] text-white font-black text-xs shrink-0 cursor-pointer shadow-3xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              {isRateContract ? 'Initialize Rate Item (SOR)' : 'Initialize SOW Item (1 Set)'}
            </Button>
          </div>
        )}

        {/* Action Toolbar: Strictly gated by Procurement Category */}
        {(() => {
          const serviceCartCount = (activeCart?.items || []).filter(i => Boolean(i.service || i.serviceId || (i as any).itemType === 'Service')).length;
          const productCartCount = (activeCart?.items || []).filter(i => !i.service && !i.serviceId && (i as any).itemType !== 'Service').length;

          return (
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5 flex-nowrap">
              <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                {!isService && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddNewItem('Product')}
                    className="h-8.5 px-3.5 text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f] shadow-3xs shrink-0 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Add Product
                  </Button>
                )}

                {isService && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddNewItem('Service')}
                    className="h-8.5 px-3.5 text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f] shadow-3xs shrink-0 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> {isRateContract ? 'Add SOR Service Line' : 'Add Service Line'}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
                {!isService ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleImportCartItems}
                      disabled={isCartLoading}
                      className="h-8.5 px-2.5 sm:px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shrink-0 whitespace-nowrap"
                      title="Import catalogue items from your active cart"
                    >
                      <ShoppingCart className="h-3.5 w-3.5 mr-1 text-[#0b2447]" aria-hidden="true" />
                      {isCartLoading ? 'Reading Cart...' : productCartCount ? `Import Cart (${productCartCount})` : 'Import Cart'}
                    </Button>

                    <div className="relative shrink-0">
                      <input
                        type="file"
                        id="item-template-import"
                        accept=".xlsx,.xls,.csv,.txt"
                        onChange={handleImportItemTemplate}
                        className="sr-only"
                        aria-label="Import items from Excel or CSV spreadsheet"
                      />
                      <label
                        htmlFor="item-template-import"
                        className="cursor-pointer inline-flex h-8.5 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 text-xs font-bold text-slate-700 shadow-3xs transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[#0b2447]/20 shrink-0 whitespace-nowrap"
                        title="Import items from Excel (.xlsx) or CSV spreadsheet"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600" aria-hidden="true" /> Import Excel / CSV
                      </label>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadItemTemplate}
                      className="h-8.5 px-2.5 sm:px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shrink-0 whitespace-nowrap"
                      title="Download Excel template (.xlsx) for bulk items"
                    >
                      <Download className="h-3.5 w-3.5 mr-1 text-slate-500" aria-hidden="true" /> Template
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleImportCartItems}
                      disabled={isCartLoading}
                      className="h-8.5 px-2.5 sm:px-3 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50 shrink-0 whitespace-nowrap"
                      title="Import service items from your active cart"
                    >
                      <ShoppingCart className="h-3.5 w-3.5 mr-1 text-[#0b2447]" aria-hidden="true" />
                      {isCartLoading ? 'Reading Cart...' : serviceCartCount ? `Import Services (${serviceCartCount})` : 'Import Services from Cart'}
                    </Button>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0b2447] bg-[#0b2447]/10 border border-[#0b2447]/20 px-3 py-1.5 rounded-lg shadow-3xs">
                      <Wrench className="h-3.5 w-3.5 text-[#0b2447] shrink-0" />
                      <span>{isRateContract ? 'Schedule of Rates Mode' : 'Service & SOW Mode'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Helpful Hint Cards - Contextually Gated */}
      <div className="grid gap-3 sm:grid-cols-3">
        {isService ? (
          isRateContract ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800 flex items-start gap-2.5 shadow-3xs">
                <FileText className="h-4 w-4 text-[#0b2447] shrink-0 mt-0.5" />
                <span><strong>Schedule of Rates (SOR):</strong> Define service rate items. Quoted unit rates form the legally locked price ceiling for all future release orders.</span>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs font-semibold text-blue-950 flex items-start gap-2.5 shadow-3xs">
                <Repeat className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                <span><strong>Indicative Quantities &amp; Call-Offs:</strong> Quantities represent estimated annual volume for bid evaluation. Actual billing occurs per release order.</span>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-950 flex items-start gap-2.5 shadow-3xs">
                <Scale className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><strong>Decoupled Terms:</strong> Agreement validity duration is managed in <strong>Step 6</strong>, while SLA downtime and liquidated damages are in <strong>Step 7</strong>.</span>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800 flex items-start gap-2.5 shadow-3xs">
                <FileText className="h-4 w-4 text-[#0b2447] shrink-0 mt-0.5" />
                <span><strong>Scope of Work (SOW):</strong> Upload your SOW dossier or type specifications above to govern deliverables and operational boundaries.</span>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs font-semibold text-blue-950 flex items-start gap-2.5 shadow-3xs">
                <IndianRupee className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                <span><strong>Lump-Sum Commercials:</strong> Add your service line with agreed billing unit (1 Job / Set / Year) and GST rate.</span>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-950 flex items-start gap-2.5 shadow-3xs">
                <Clock className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><strong>SLA &amp; Penalties:</strong> Operational response targets are defined above, with liquidated damages governed in Step 7.</span>
              </div>
            </>
          )
        ) : (
          <>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs font-semibold text-[#12335f] flex items-start gap-2.5">
              <Info className="h-4 w-4 text-[#12335f] shrink-0 mt-0.5" />
              <span>Click <strong>Add Product</strong> to configure technical specs, unit rate, and GST percentage.</span>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs font-semibold text-emerald-900 flex items-start gap-2.5">
              <Paperclip className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>Attach CAD drawings, datasheets, or spec PDFs directly from the table or inside the item modal.</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs font-semibold text-slate-700 flex items-start gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
              <span>Bulk import items from CSV templates or pull pre-selected catalogue items from your cart.</span>
            </div>
          </>
        )}
      </div>

      {/* Modern Schedule Table */}
      <DataTable
        data={draft.items}
        columns={procurementItemColumns}
        keyExtractor={(item: any, idx) => item.id || idx}
        showSrNo={false}
        minWidth={isService ? 'min-w-[1100px]' : 'min-w-[1240px]'}
        scrollWrapperClassName="overflow-x-auto"
        rowClassName="align-middle hover:bg-slate-50/70 transition-colors group"
        emptyTitle={isService ? "No service contract lines added yet" : "No product items added yet"}
        emptyDescription={
          isService
            ? (isRateContract
                ? "Click 'Add SOR Service Line' or use the 1-click Initialize button above to configure your Schedule of Rates baseline."
                : "Click 'Add Service Line' or use the 1-click Initialize button above to configure your lump-sum contract item.")
            : "Add line items individually, upload an Excel/CSV schedule, or import from your marketplace cart."
        }
        footer={
          <div className="border-t border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar flex-nowrap">
            <div className="flex items-center gap-2 shrink-0 flex-nowrap">
              {!isService && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAddNewItem('Product')}
                  className="h-8 px-3 text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f] shrink-0 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Add Product Line
                </Button>
              )}
              {isService && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAddNewItem('Service')}
                  className="h-8 px-3 text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f] shrink-0 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> {isRateContract ? 'Add SOR Service Line' : 'Add Service Line'}
                </Button>
              )}
            </div>
            <span className="text-[11px] font-semibold text-slate-500 shrink-0 whitespace-nowrap">
              {draft.items.length} {isService ? (isRateContract ? 'SOR line' : 'service line') : 'line item'}{draft.items.length === 1 ? '' : 's'} scheduled
            </span>
          </div>
        }
      />

      {/* Summary Metrics Bar with Full Financial Breakdown */}
      {(() => {
        const totals = computeProcurementTotals(draft.items);
        const totalQty = getTotalProcurementQty(draft);
        const qtyOk = totalQty > 0;
        const isSynced = Math.round(totals.grossValue) === draft.basics.estimatedValue;

        return (
          <div className="space-y-3">
            <div className="grid gap-2.5 sm:gap-3 grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-bold text-slate-700 shadow-3xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Items & Qty</span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-sm font-black text-slate-900">{draft.items.length} Lines</span>
                  <span className="text-xs font-bold text-slate-500">{totalQty.toLocaleString('en-IN')} Units</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-bold text-slate-700 shadow-3xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {isService ? 'Base Service Fee' : 'Base Value (Excl. GST)'}
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-sm font-black text-slate-800">
                    {totals.baseValue > 0
                      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totals.baseValue)
                      : <span className="text-slate-400 font-bold text-xs">To be Quoted</span>}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">Pre-tax</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-bold text-slate-700 shadow-3xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Applicable GST (Taxes)</span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-sm font-black text-[#0b2447]">
                    {totals.gstAmount > 0
                      ? `+${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totals.gstAmount)}`
                      : '+18% GST'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">Taxes</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-white p-3.5 text-xs font-bold shadow-3xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0b2447]">
                  {isService ? 'Contract Ceiling (Gross)' : 'Total Est. Value (Gross)'}
                </span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-base font-black text-[#0b2447]">
                    {totals.grossValue > 0
                      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totals.grossValue)
                      : <span className="text-blue-900/80 font-black text-xs">Disclosed in Bid</span>}
                  </span>
                  <span className="text-[9.5px] font-black text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded uppercase">Incl. GST</span>
                </div>
              </div>
            </div>

            {/* Reconciliation Banner between Step 2 estimate & Schedule */}
            {draft.items.length > 0 && (
              totals.grossValue === 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Info className="h-4 w-4 text-[#0b2447] shrink-0" />
                    <span>
                      {isService ? (
                        <>
                          <strong>Price Discovery / Bidding Mode:</strong> Estimated service fee is ₹0 (Undisclosed). Qualified bidders will quote their commercial fee during bidding.
                        </>
                      ) : (
                        <>
                          <strong>Competitive Price Discovery:</strong> Line item rate is ₹0. Bidders will quote unit rates during bidding.
                        </>
                      )}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (draft.items[0]) {
                        setSelectedItemForEdit(draft.items[0]);
                        setShowItemDrawer(true);
                      }
                    }}
                    className="h-7.5 px-3 text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f] shrink-0 whitespace-nowrap shadow-3xs cursor-pointer"
                  >
                    <IndianRupee className="h-3.5 w-3.5 mr-1" /> Set Estimated Benchmark Fee
                  </Button>
                </div>
              ) : !isSynced ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      {isService ? (
                        <>
                          Tender initial budget is <strong>₹{draft.basics.estimatedValue.toLocaleString('en-IN')}</strong>, but Service Schedule total (incl. GST) is <strong>₹{Math.round(totals.grossValue).toLocaleString('en-IN')}</strong>.
                        </>
                      ) : (
                        <>
                          Step 2 initial budget is <strong>₹{draft.basics.estimatedValue.toLocaleString('en-IN')}</strong>, but itemized schedule total (incl. GST) is <strong>₹{Math.round(totals.grossValue).toLocaleString('en-IN')}</strong>.
                        </>
                      )}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      updateDraft(c => ({
                        ...c,
                        basics: { ...c.basics, estimatedValue: Math.round(totals.grossValue) }
                      }));
                      toast.success(isService ? 'Tender estimated budget synced with Service Schedule Total!' : 'Tender estimated budget synced with Schedule Total!');
                    }}
                    className="h-7.5 px-3 text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f] shrink-0 whitespace-nowrap shadow-3xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> {isService ? 'Sync Tender Budget with Service Schedule' : 'Sync Tender Budget with BOQ'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] font-semibold text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {isService
                        ? 'Service schedule total is fully aligned with your tender budget ceiling.'
                        : 'Tender estimated budget is fully synchronized with schedule line items (Base + GST).'}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-black uppercase text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                    Synchronized
                  </span>
                </div>
              )
            )}

            {!qtyOk && (
              <p className="text-[11px] font-bold text-rose-600">
                Add at least one line with a quantity greater than 0. Submission is blocked until total quantity is above 0.
              </p>
            )}
          </div>
        );
      })()}

      {/* Add / Edit Full Modal Dialog */}
      <ItemDrawerOrModal
        isOpen={showItemDrawer}
        item={selectedItemForEdit}
        onClose={() => {
          setShowItemDrawer(false);
          setSelectedItemForEdit(null);
        }}
        onSave={handleSaveItem}
        onSaveAndAddAnother={handleSaveAndAddAnother}
        token={token}
        onPreviewDocument={handlePreviewDoc}
        categoriesList={categoriesList}
        defaultCategory={draft.basics.category}
      />

      {/* Cart Category Alignment Review Modal */}
      <CartCategoryAlignmentModal
        conflict={cartCategoryConflict}
        onClose={() => setCartCategoryConflict(null)}
        onImportMatchingOnly={() => {
          if (!cartCategoryConflict) return;
          applyImportedCartItems(cartCategoryConflict.matchingItems);
          setCartCategoryConflict(null);
        }}
        onImportAll={() => {
          if (!cartCategoryConflict) return;
          applyImportedCartItems(cartCategoryConflict.allItems);
          setCartCategoryConflict(null);
        }}
      />

      {/* Quick Document Manager Modal */}
      {quickDocItem && (
        <QuickDocumentModal
          item={quickDocItem}
          onClose={() => setQuickDocItem(null)}
          onSaveAttachments={updatedAtts => {
            handleSaveItemQuickAttachments(quickDocItem.id, updatedAtts);
          }}
          token={token}
          onPreviewAttachment={att => handlePreviewDoc(att, att.fileName)}
        />
      )}

      {/* Quick Document Manager Modal for BOQ Rows */}
      {quickDocBoqRowIdx !== null && draft.boqTable[quickDocBoqRowIdx] && (
        <QuickDocumentModal
          item={{
            id: `boq-row-${quickDocBoqRowIdx}`,
            name: draft.boqTable[quickDocBoqRowIdx].description || `BOQ Item #${draft.boqTable[quickDocBoqRowIdx].srNo}`,
            itemType: draft.boqTable[quickDocBoqRowIdx].category || 'BOQ Item',
            attachments: draft.boqTable[quickDocBoqRowIdx].attachments || [],
            fileAssetId: draft.boqTable[quickDocBoqRowIdx].fileAssetId,
            specificationFileName: draft.boqTable[quickDocBoqRowIdx].fileName,
          } as any}
          onClose={() => setQuickDocBoqRowIdx(null)}
          onSaveAttachments={updatedAtts => {
            const first = updatedAtts[0];
            updateDraft(c => {
              const nextTable = [...c.boqTable];
              const row = nextTable[quickDocBoqRowIdx];
              if (!row) return c;
              nextTable[quickDocBoqRowIdx] = {
                ...row,
                attachments: updatedAtts,
                fileAssetId: first ? first.fileAssetId : null,
                fileName: first ? first.fileName : '',
                fileSize: first ? first.fileSize : null,
              };
              return { ...c, boqTable: nextTable };
            });
          }}
          token={token}
          onPreviewAttachment={att => handlePreviewDoc(att, att.fileName)}
        />
      )}

      {/* In-App Direct Document Preview Modal */}
      <DocumentPreviewModal
        previewDocument={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 Form components: Supplier Selection
// ─────────────────────────────────────────────────────────────────────────────
function VendorsStepForm({
  draft,
  updateDraft
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
}) {
  const [sellers, setSellers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [msmeOnly, setMsmeOnly] = useState(false);

  const effectiveCategory = draft.basics.category || draft.rateContractConfig?.contractCategory || draft.auctionConfig?.auctionCategory || '';

  const fetchSellersList = () => {
    setLoading(true);
    const params: Record<string, string | number | boolean> = { pageSize: 50 };
    if (search) params.q = search;
    if (draft.vendors.selection === 'Category' && effectiveCategory) {
      params.category = effectiveCategory;
    }
    if (msmeOnly) {
      params.msmeOnly = true;
    }
    marketplaceApi.getSellers(params as any)
      .then(res => {
        // Map API response to Supplier interface
        const items = (res?.sellers || []).map((s: any) => ({
          id: s.id || s.sellerUserId,
          organizationName: s.organizationName || s.name || 'Vendor',
          msmeCategory: s.organizationType || s.msmeCategory || (s.isUdyamVerified ? 'MSME' : 'General'),
          officeCity: s.city || s.officeCity || s.district || 'N/A',
          rating: s.rating || '4.0',
          pastOrdersCount: s.pastOrdersCount || 0,
          onTimeDeliveryRate: s.onTimeDeliveryRate || 95,
          gstVerified: Boolean(s.gstin || s.verificationStatus === 'VERIFIED'),
          categories: s.categories || [],
          isUdyamVerified: Boolean(s.isUdyamVerified || s.udyamNumber)
        }));
        setSellers(items);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchSellersList();
    });
  }, [search, msmeOnly, draft.vendors.selection, effectiveCategory]);

  const toggleInviteSeller = (id: number, name: string) => {
    updateDraft(current => {
      const invited = current.vendors.invitedSellers || [];
      const exists = invited.includes(id);
      let nextInvites = [...invited];
      if (exists) {
        nextInvites = nextInvites.filter(x => x !== id);
      } else {
        nextInvites.push(id);
      }
      return {
        ...current,
        vendors: {
          ...current.vendors,
          invitedSellers: nextInvites,
          inviteCount: nextInvites.length,
          selectedSellerId: nextInvites[0] || null,
          selectedSellerName: nextInvites[0] ? name : '',
        }
      };
    });
  };

  useEffect(() => {
    const isLimited = draft.type === 'LIMITED_TENDER' || (draft.type === 'RFQ' && draft.rfqType === 'LIMITED');
    if (isLimited && draft.vendors.selection !== 'Selected') {
      queueMicrotask(() => {
        updateDraft(c => ({ ...c, vendors: { ...c.vendors, selection: 'Selected' } }));
      });
    }
  }, [draft.type, draft.rfqType, draft.vendors.selection]);

  const handleSelectionModeChange = (mode: 'Open' | 'Selected' | 'Category' | 'Past') => {
    updateDraft(c => ({
      ...c,
      vendors: { ...c.vendors, selection: mode }
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier Sourcing Strategy" required>
          {draft.type === 'LIMITED_TENDER' || (draft.type === 'RFQ' && draft.rfqType === 'LIMITED') ? (
            <div className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center text-sm font-semibold text-slate-700 select-none">
              Invite selected verified suppliers pool (Locked for Limited methods)
            </div>
          ) : (
            <select
              value={draft.vendors.selection}
              onChange={e => handleSelectionModeChange(e.target.value as any)}
              className={inputClass}
            >
              <option value="Open">Open Advertised / Public Sourcing</option>
              <option value="Selected">Invite selected verified suppliers pool</option>
              <option value="Category">Invite category-matched registered vendors</option>
              {/* <option value="Past">Invite prior order vendors</option> */}
            </select>
          )}
        </Field>

        <Field label="Minimum Sourcing bids required">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            id="minimum-sourcing-bids-input"
            aria-label="Minimum Sourcing bids required"
            aria-describedby="min-bids-instructions min-bids-guidance"
            value={draft.schedule.minimumBidders ?? ''}
            onChange={e => {
              let val = e.target.value.replace(/[^0-9]/g, '');
              if (val.length > 1 && val.startsWith('0')) {
                val = val.replace(/^0+/, '');
              }
              updateDraft(c => ({
                ...c,
                schedule: {
                  ...c.schedule,
                  minimumBidders: val === '' ? '' : parseInt(val, 10),
                }
              }));
            }}
            onBlur={() => {
              const current = parseInt(String(draft.schedule.minimumBidders), 10);
              if (isNaN(current) || current < 1) {
                updateDraft(c => ({ ...c, schedule: { ...c.schedule, minimumBidders: 3 } }));
              }
            }}
            className={inputClass}
            placeholder="3"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-[10px] font-bold text-slate-500 mr-0.5">Recommended Presets:</span>
            {[
              { label: '1 Bid (Proprietary / Monopoly)', val: 1 },
              { label: '2 Bids (Expedited / Urgent)', val: 2 },
              { label: '3 Bids (GFR 173 Standard)', val: 3 },
              { label: '5 Bids (High Competition)', val: 5 },
            ].map(p => (
              <button
                key={p.val}
                type="button"
                onClick={() => updateDraft(c => ({ ...c, schedule: { ...c.schedule, minimumBidders: p.val } }))}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-md border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0b2447]",
                  Number(draft.schedule.minimumBidders) === p.val
                    ? "border-[#0b2447] bg-[#0b2447] text-white shadow-xs"
                    : "border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                )}
                aria-pressed={Number(draft.schedule.minimumBidders) === p.val}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div id="min-bids-instructions" className="mt-2 text-xs rounded-lg p-2.5 bg-slate-100/80 border border-slate-200 text-slate-700 space-y-1">
            <p className="font-semibold text-slate-800">
              How Minimum Sourcing Bids Work:
            </p>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Specifies the minimum number of technically qualified supplier quotations required before financial bids can be unsealed automatically.
            </p>
            <div id="min-bids-guidance" className="pt-1 text-[11px] font-medium">
              {Number(draft.schedule.minimumBidders) === 1 ? (
                <div className="flex items-start gap-1.5 text-amber-800 bg-amber-50/80 border border-amber-200 rounded p-1.5">
                  <span className="font-bold">⚠️ Single-Bid Policy:</span>
                  <span>Minimum set to 1. If only 1 quotation is submitted, the system halts with a Single-Bidder Advisory requiring explicit buyer administrative price confirmation before financial opening.</span>
                </div>
              ) : Number(draft.schedule.minimumBidders) >= 5 ? (
                <div className="flex items-start gap-1.5 text-blue-900 bg-blue-50/80 border border-blue-200 rounded p-1.5">
                  <span className="font-bold">ℹ️ High Competition:</span>
                  <span>Targeting {draft.schedule.minimumBidders} bids. If fewer than {draft.schedule.minimumBidders} qualified bids are received at deadline, the system will raise an Insufficient Bids Warning, prompting a deadline extension or buyer justification.</span>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5">
                  <span className="font-bold">✓ Standard Competitive Rule:</span>
                  <span>Requires at least {draft.schedule.minimumBidders || 3} qualified bids. If fewer bids arrive at opening, the system prompts for administrative confirmation or a deadline extension.</span>
                </div>
              )}
            </div>
          </div>
        </Field>
      </div>

      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">MSME & Preference Parameters</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.vendors.msmePreference}
              onChange={e => updateDraft(c => ({ ...c, vendors: { ...c.vendors, msmePreference: e.target.checked } }))}
              className="h-4 w-4 rounded accent-[#12335f]"
            />
            <span>MSME pricing preference?</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.vendors.localVendorPreference}
              onChange={e => updateDraft(c => ({ ...c, vendors: { ...c.vendors, localVendorPreference: e.target.checked } }))}
              className="h-4 w-4 rounded accent-[#12335f]"
            />
            <span>Local supplier preference?</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.vendors.excludeBlacklisted}
              onChange={e => updateDraft(c => ({ ...c, vendors: { ...c.vendors, excludeBlacklisted: e.target.checked } }))}
              className="h-4 w-4 rounded accent-[#12335f]"
            />
            <span>Auto-exclude blacklisted?</span>
          </label>
        </div>
      </div>

      {isReverseAuctionMethod(draft.type) && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5 shadow-2xs border ${
          draft.vendors.selection === 'Open'
            ? 'bg-blue-50/50 border-blue-200 text-blue-800'
            : draft.vendors.invitedSellers.length < (draft.auctionConfig.minimumQualifiedBidders || 2)
              ? 'bg-amber-50/50 border-amber-200 text-amber-800'
              : 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
        }`}>
          <span className="text-sm shrink-0 font-normal">
            {draft.vendors.selection === 'Open'
              ? 'ℹ️'
              : draft.vendors.invitedSellers.length < (draft.auctionConfig.minimumQualifiedBidders || 2)
                ? '⚠️'
                : '✅'}
          </span>
          <div>
            <span className={`font-black uppercase text-[9px] tracking-wider block ${
              draft.vendors.selection === 'Open'
                ? 'text-blue-900'
                : draft.vendors.invitedSellers.length < (draft.auctionConfig.minimumQualifiedBidders || 2)
                  ? 'text-amber-900'
                  : 'text-emerald-900'
            }`}>
              {draft.vendors.selection === 'Open'
                ? 'Public Sourcing Active'
                : draft.vendors.invitedSellers.length < (draft.auctionConfig.minimumQualifiedBidders || 2)
                  ? 'Minimum Invited Suppliers Required'
                  : 'Supplier Requirement Satisfied'}
            </span>
            <p className={`mt-0.5 leading-relaxed font-medium ${
              draft.vendors.selection === 'Open'
                ? 'text-blue-700'
                : draft.vendors.invitedSellers.length < (draft.auctionConfig.minimumQualifiedBidders || 2)
                  ? 'text-amber-700'
                  : 'text-emerald-700'
            }`}>
              {draft.vendors.selection === 'Open'
                ? 'Anyone can bid. Specific suppliers will be qualified during/after the bidding stage.'
                : draft.vendors.invitedSellers.length < (draft.auctionConfig.minimumQualifiedBidders || 2)
                  ? `Reverse auction requires at least ${draft.auctionConfig.minimumQualifiedBidders || 2} qualified suppliers. Please invite at least ${Math.max(0, (draft.auctionConfig.minimumQualifiedBidders || 2) - draft.vendors.invitedSellers.length)} more below.`
                  : `You have invited ${draft.vendors.invitedSellers.length} suppliers. The minimum requirement of ${draft.auctionConfig.minimumQualifiedBidders || 2} is met.`}
            </p>
          </div>
        </div>
      )}

      {isRateContractMethod(draft.type) && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5 shadow-2xs border ${
          draft.vendors.selection === 'Open'
            ? 'bg-blue-50/50 border-blue-200 text-blue-800'
            : draft.vendors.invitedSellers.length === 0
              ? 'bg-amber-50/50 border-amber-200 text-amber-800'
              : 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
        }`}>
          <span className="text-sm shrink-0 font-normal">
            {draft.vendors.selection === 'Open'
              ? 'ℹ️'
              : draft.vendors.invitedSellers.length === 0
                ? '⚠️'
                : '✅'}
          </span>
          <div>
            <span className={`font-black uppercase text-[9px] tracking-wider block ${
              draft.vendors.selection === 'Open'
                ? 'text-blue-900'
                : draft.vendors.invitedSellers.length === 0
                  ? 'text-amber-900'
                  : 'text-emerald-900'
            }`}>
              {draft.vendors.selection === 'Open'
                ? 'Open Advertised Rate Contract Active'
                : draft.vendors.invitedSellers.length === 0
                  ? 'Selected Suppliers Required'
                  : 'Suppliers Allocated'}
            </span>
            <p className={`mt-0.5 leading-relaxed font-medium ${
              draft.vendors.selection === 'Open'
                ? 'text-blue-700'
                : draft.vendors.invitedSellers.length === 0
                  ? 'text-amber-700'
                  : 'text-emerald-700'
            }`}>
              {draft.vendors.selection === 'Open'
                ? 'Open to all verified registered suppliers on the platform. Empanelled suppliers will be established through open bidding.'
                : draft.vendors.invitedSellers.length === 0
                  ? 'You have chosen a targeted supplier pool. Please invite at least 1 verified supplier below to establish this Rate Contract.'
                  : `You have allocated ${draft.vendors.invitedSellers.length} supplier(s) for this Rate Contract.`}
            </p>
          </div>
        </div>
      )}

      {draft.vendors.selection !== 'Open' && (
        <SupplierSelector
          suppliers={sellers}
          invitedIds={draft.vendors.invitedSellers}
          onToggleInvite={toggleInviteSeller}
          isLoading={loading}
          searchQuery={search}
          onSearchChange={setSearch}
          msmeOnly={msmeOnly}
          onMsmeOnlyChange={setMsmeOnly}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 Form components: Timeline rules & deadlines
// ─────────────────────────────────────────────────────────────────────────────
function ScheduleStepForm({
  draft,
  updateDraft,
  showErrors = false
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
  showErrors?: boolean;
}) {
  const isTwoPacket = draft.schedule.packetType === 'Two';
  const isAuction = isReverseAuctionMethod(draft.type) || Boolean(draft.basics.isReverseAuctionNeeded);
  const isRateContract = isRateContractMethod(draft.type);

  const updateSchedule = (key: keyof Draft['schedule'], val: any) => {
    updateDraft(c => {
      const nextSchedule = { ...c.schedule, [key]: val };
      let nextApproval = c.approval;
      if (key === 'packetType') {
        if (val === 'Single') {
          if (!c.basics.isTechnicalEvaluationNeeded) {
            nextSchedule.technicalOpeningDate = '';
          }
          nextSchedule.financialOpeningDate = '';
          nextApproval = {
            ...c.approval,
            workflow: 'Single Stage (Commercial Only)'
          };
        } else if (val === 'Two') {
          nextApproval = {
            ...c.approval,
            workflow: 'Two-Stage (Technical + Financial)'
          };
          const subMs = nextSchedule.submissionDate ? new Date(nextSchedule.submissionDate).getTime() : NaN;
          if (!isNaN(subMs)) {
            if (!nextSchedule.technicalOpeningDate || new Date(nextSchedule.technicalOpeningDate).getTime() <= subMs) {
              nextSchedule.technicalOpeningDate = toDateTimeLocal(new Date(subMs + 15 * 60000));
            }
            const techMs = new Date(nextSchedule.technicalOpeningDate).getTime();
            if (!nextSchedule.financialOpeningDate || new Date(nextSchedule.financialOpeningDate).getTime() <= techMs) {
              nextSchedule.financialOpeningDate = toDateTimeLocal(new Date(techMs + 15 * 60000));
            }
          }
        }
      }
      if (key === 'validityDays' || key === 'submissionDate') {
        const days = key === 'validityDays' ? Number(val) : Number(c.schedule.validityDays || 90);
        const subDate = key === 'submissionDate' ? String(val) : String(c.schedule.submissionDate);
        if (subDate && days > 0) {
          try {
            const d = new Date(subDate);
            if (!isNaN(d.getTime())) {
              nextSchedule.bidValidityDate = new Date(d.getTime() + days * 86400000).toISOString().slice(0, 10);
            }
          } catch {}
        }
      }
      if (key === 'submissionDate' && val) {
        const subMs = new Date(val).getTime();
        if (!isNaN(subMs)) {
          if (nextSchedule.technicalOpeningDate) {
            const techMs = new Date(nextSchedule.technicalOpeningDate).getTime();
            if (techMs <= subMs) {
              nextSchedule.technicalOpeningDate = toDateTimeLocal(new Date(subMs + 15 * 60000));
            }
          }
          if (nextSchedule.financialOpeningDate && nextSchedule.technicalOpeningDate) {
            const finMs = new Date(nextSchedule.financialOpeningDate).getTime();
            const techMs = new Date(nextSchedule.technicalOpeningDate).getTime();
            if (finMs <= techMs) {
              nextSchedule.financialOpeningDate = toDateTimeLocal(new Date(techMs + 15 * 60000));
            }
          }
        }
      }
      if (key === 'technicalOpeningDate' && val) {
        const techMs = new Date(val).getTime();
        if (!isNaN(techMs) && nextSchedule.financialOpeningDate) {
          const finMs = new Date(nextSchedule.financialOpeningDate).getTime();
          if (finMs <= techMs) {
            nextSchedule.financialOpeningDate = toDateTimeLocal(new Date(techMs + 15 * 60000));
          }
        }
      }
      return { ...c, schedule: nextSchedule, approval: nextApproval };
    });
  };
  const getMinutesBetween = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (isNaN(startTime) || isNaN(endTime)) return 0;
    return Math.max(0, Math.floor((endTime - startTime) / 60000));
  };

  const getEndDateTime = (start: string, durationMinutes: number): string => {
    if (!start) return '';
    const startTime = new Date(start).getTime();
    if (isNaN(startTime)) return '';
    const endTime = new Date(startTime + durationMinutes * 60000);
    const year = endTime.getFullYear();
    const month = String(endTime.getMonth() + 1).padStart(2, '0');
    const date = String(endTime.getDate()).padStart(2, '0');
    const hours = String(endTime.getHours()).padStart(2, '0');
    const minutes = String(endTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${date}T${hours}:${minutes}`;
  };

  const updateAuction = <K extends keyof AuctionConfig>(key: K, val: AuctionConfig[K]) => {
    updateDraft(c => {
      const nextConfig = { ...c.auctionConfig, [key]: val };
      if (key === 'startDateTime') {
        const start = val as string;
        if (nextConfig.endDateTime) {
          nextConfig.durationMinutes = getMinutesBetween(start, nextConfig.endDateTime);
        } else if (nextConfig.durationMinutes > 0) {
          nextConfig.endDateTime = getEndDateTime(start, nextConfig.durationMinutes);
        }
      } else if (key === 'endDateTime') {
        const end = val as string;
        if (nextConfig.startDateTime) {
          nextConfig.durationMinutes = getMinutesBetween(nextConfig.startDateTime, end);
        }
      } else if (key === 'durationMinutes') {
        const dur = Number(val || 0);
        if (nextConfig.startDateTime && dur > 0) {
          nextConfig.endDateTime = getEndDateTime(nextConfig.startDateTime, dur);
        }
      }
      return { ...c, auctionConfig: nextConfig };
    });
  };
  const updateTrigger = <K extends keyof AuctionConfig['triggerConfiguration']>(
    key: K,
    val: AuctionConfig['triggerConfiguration'][K]
  ) => {
    updateDraft(c => ({
      ...c,
      auctionConfig: {
        ...c.auctionConfig,
        triggerConfiguration: { ...c.auctionConfig.triggerConfiguration, [key]: val },
      },
    }));
  };
  const updateMonitor = <K extends keyof AuctionConfig['buyerMonitorSettings']>(
    key: K,
    val: AuctionConfig['buyerMonitorSettings'][K]
  ) => {
    updateDraft(c => ({
      ...c,
      auctionConfig: {
        ...c.auctionConfig,
        buyerMonitorSettings: { ...c.auctionConfig.buyerMonitorSettings, [key]: val },
      },
    }));
  };
  const updateRateContract = <K extends keyof RateContractConfig>(key: K, val: RateContractConfig[K]) => {
    updateDraft(c => {
      const nextConfig = { ...c.rateContractConfig, [key]: val };
      let derivedDuration = '';

      if (key === 'periodStartDate' || key === 'periodEndDate') {
        const start = key === 'periodStartDate' ? String(val) : c.rateContractConfig.periodStartDate;
        const end = key === 'periodEndDate' ? String(val) : c.rateContractConfig.periodEndDate;
        derivedDuration = calculateDurationBetweenDates(start, end);
        if (derivedDuration) {
          nextConfig.rateValidityPeriod = derivedDuration;
        }
      } else if (key === 'rateValidityPeriod') {
        derivedDuration = String(val || '');
      }

      return {
        ...c,
        rateContractConfig: nextConfig,
        serviceDetails: {
          ...c.serviceDetails,
          duration: derivedDuration || c.serviceDetails.duration || nextConfig.rateValidityPeriod
        }
      };
    });
  };

  const handleApplyDurationPreset = (months: number) => {
    const start = draft.rateContractConfig.periodStartDate || today;
    const end = addMonthsToDate(start, months);
    const durationStr = calculateDurationBetweenDates(start, end) || `${months} Months`;
    updateDraft(c => ({
      ...c,
      rateContractConfig: {
        ...c.rateContractConfig,
        periodStartDate: start,
        periodEndDate: end,
        rateValidityPeriod: durationStr,
      },
      serviceDetails: {
        ...c.serviceDetails,
        duration: durationStr,
      }
    }));
    toast.success(`Applied ${durationStr} validity window.`);
  };
  const missing = (value: unknown) => showErrors && !String(value ?? '').trim();
  const fieldError = (condition: boolean, message: string) => condition ? message : undefined;
  const controlClass = (error?: string) => cn(inputClass, error && 'border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-rose-500/20');

  const [uploadingAuctionDoc, setUploadingAuctionDoc] = useState(false);

  const handleAuctionTermsFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds maximum limit of 10MB.');
      return;
    }
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      toast.error('Unsupported file format. Please upload PDF, DOC, DOCX, XLS, XLSX, JPG, or PNG.');
      return;
    }

    setUploadingAuctionDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'procurement_draft');

      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const resData = await unwrap<any>(response);
      const asset = resData.file || resData.fileAsset || resData;
      const fileId = Number(resData.fileId || asset.id || asset.fileAssetId || 0);

      updateDraft(c => ({
        ...c,
        auctionConfig: {
          ...c.auctionConfig,
          termsDocumentFileId: fileId || null,
          termsDocumentName: asset.originalName || asset.fileName || file.name
        }
      }));
      toast.success('Auction terms document uploaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploadingAuctionDoc(false);
    }
  };

  const handleRemoveAuctionTermsFile = () => {
    updateDraft(c => ({
      ...c,
      auctionConfig: {
        ...c.auctionConfig,
        termsDocumentFileId: null,
        termsDocumentName: ''
      }
    }));
    toast.success('Auction terms document removed');
  };

  const [uploadingRateContractDoc, setUploadingRateContractDoc] = useState(false);
  const [isDragOverRateContractDoc, setIsDragOverRateContractDoc] = useState(false);
  const rateContractFileInputRef = useRef<HTMLInputElement>(null);
  const rateContractReplaceInputRef = useRef<HTMLInputElement>(null);

  const handleRateContractDocUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds maximum limit of 10MB.');
      return;
    }
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      toast.error('Unsupported file format. Please upload PDF, DOC, DOCX, XLS, XLSX, JPG, or PNG.');
      return;
    }

    setUploadingRateContractDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'rate_contract_document');

      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const resData = await unwrap<any>(response);
      const asset = resData.file || resData.fileAsset || resData;
      const fileId = Number(resData.fileId || asset.id || asset.fileAssetId || 0);

      updateRateContract('contractDocument', {
        fileAssetId: fileId || null,
        fileName: asset.originalName || asset.fileName || file.name,
        fileSize: asset.size || file.size,
        uploadedAt: asset.createdAt || new Date().toISOString(),
      });
      toast.success('Rate contract document uploaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploadingRateContractDoc(false);
      if (rateContractFileInputRef.current) {
        rateContractFileInputRef.current.value = '';
      }
      if (rateContractReplaceInputRef.current) {
        rateContractReplaceInputRef.current.value = '';
      }
    }
  };

  const handleRemoveRateContractDoc = () => {
    updateRateContract('contractDocument', {
      fileAssetId: null,
      fileName: '',
      fileSize: null,
      uploadedAt: null,
    });
    if (rateContractFileInputRef.current) {
      rateContractFileInputRef.current.value = '';
    }
    if (rateContractReplaceInputRef.current) {
      rateContractReplaceInputRef.current.value = '';
    }
    toast.success('Rate contract document removed');
  };

  // Warnings collection
  const warnings: string[] = [];
  if (draft.schedule.submissionDate && draft.schedule.submissionStartDate) {
    if (new Date(draft.schedule.submissionDate) <= new Date(draft.schedule.submissionStartDate)) {
      warnings.push('Submission closing date must be schedule after submission start date.');
    }
  }
  if ((draft.basics.isTechnicalEvaluationNeeded || isTwoPacket) && draft.schedule.technicalOpeningDate && draft.schedule.submissionDate) {
    if (new Date(draft.schedule.technicalOpeningDate) <= new Date(draft.schedule.submissionDate)) {
      const techDateOnly = draft.schedule.technicalOpeningDate.split('T')[0];
      const subDateOnly = draft.schedule.submissionDate.split('T')[0];
      if (techDateOnly < subDateOnly) {
        warnings.push(`Technical opening date (${techDateOnly}) is earlier than submission deadline (${subDateOnly}).`);
      } else {
        warnings.push('Technical opening time must be after submission deadline.');
      }
    }
  }
  if (isTwoPacket && draft.schedule.financialOpeningDate && draft.schedule.technicalOpeningDate) {
    if (new Date(draft.schedule.financialOpeningDate) <= new Date(draft.schedule.technicalOpeningDate)) {
      const finDateOnly = draft.schedule.financialOpeningDate.split('T')[0];
      const techDateOnly = draft.schedule.technicalOpeningDate.split('T')[0];
      if (finDateOnly < techDateOnly) {
        warnings.push(`Financial opening date (${finDateOnly}) is earlier than technical opening date (${techDateOnly}).`);
      } else {
        warnings.push('Financial opening time must be after technical envelope opening.');
      }
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {showErrors && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          Mandatory missing fields are highlighted below. Fill them before moving to the next section.
        </div>
      )}
      {warnings.length > 0 && (
        <div className="border border-rose-250 bg-rose-50 text-rose-800 p-4 rounded-xl text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-rose-955">
            <Info className="h-4.5 w-4.5" /> Sourcing Validation Warning
          </div>
          <ul className="list-disc list-inside font-semibold space-y-0.5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}


      {isRateContract && (
        <div className="border border-slate-200/90 rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-slate-50/70 via-white to-white shadow-xs space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b2447] to-[#123668] text-white shadow-xs font-bold text-sm">
                <Repeat className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Outline Agreement Parameters
                  </h3>
                  <span className="rounded-full bg-blue-50 border border-blue-200/70 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    Blanket Purchase Agreement
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Configure contract validity duration and periodic call-off release rules. Line items and rates are managed in Step 3.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {draft.rateContractConfig.rateContractNumber ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/70 px-3 py-1 text-xs font-mono font-bold text-slate-700">
                  <Lock className="h-3 w-3 text-slate-400" />
                  {draft.rateContractConfig.rateContractNumber}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-[11px] font-medium text-blue-800">
                  <Clock className="h-3 w-3 text-blue-600" />
                  Master Agreement No. Allocated Upon Award
                </span>
              )}
            </div>
          </div>

          {/* Section 1: Validity & Allocation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
              <FileText className="h-3.5 w-3.5 text-[#0b2447]" />
              <span>Agreement Validity &amp; Supplier Allocation</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <DateTimePicker
                  label="Agreement Effective Start Date"
                  labelClassName="block text-xs font-semibold text-slate-700"
                  required
                  mode="date"
                  value={draft.rateContractConfig.periodStartDate}
                  onChange={val => updateRateContract('periodStartDate', val)}
                  placeholder="Select agreement start date"
                />
              </div>
              <div className="space-y-1">
                <DateTimePicker
                  label="Agreement Expiry Date"
                  labelClassName="block text-xs font-semibold text-slate-700"
                  required
                  mode="date"
                  value={draft.rateContractConfig.periodEndDate}
                  onChange={val => updateRateContract('periodEndDate', val)}
                  min={draft.rateContractConfig.periodStartDate}
                  placeholder="Select agreement expiry date"
                />
              </div>
              <Field label="Rate Validity Duration" required>
                <div className="space-y-1">
                  <div className="relative">
                    <input
                      value={draft.rateContractConfig.rateValidityPeriod}
                      onChange={e => updateRateContract('rateValidityPeriod', e.target.value)}
                      className={cn(inputClass, "pr-24")}
                      placeholder="e.g. Fixed for 1 Year / Full contract period"
                    />
                    {draft.rateContractConfig.rateValidityPeriod && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ⚡ Synced
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Auto-derived from start &amp; expiry dates. Editable if needed.</p>
                </div>
              </Field>

              {/* Quick Validity Presets */}
              <div className="sm:col-span-2 lg:col-span-3 -mt-1 pt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500 mr-0.5">Quick Validity Presets:</span>
                {[
                  { label: '+ 6 Months', months: 6 },
                  { label: '+ 1 Year (12 Mo)', months: 12 },
                  { label: '+ 2 Years (24 Mo)', months: 24 },
                  { label: '+ 3 Years (36 Mo)', months: 36 },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyDurationPreset(p.months)}
                    className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200 bg-white hover:bg-blue-50 text-blue-900 shadow-3xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <Field label="Supplier Selection Strategy" className="sm:col-span-2 lg:col-span-3">
                <div className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 flex items-center justify-between text-xs font-semibold text-slate-800 select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-900 shrink-0">Single Supplier (L1 Award)</span>
                    <span className="text-[11px] text-slate-500 font-normal truncate hidden sm:inline">
                      &mdash; Standard single vendor framework agreement awarded to lowest conforming L1 bidder.
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded shrink-0">
                    Default
                  </span>
                </div>
              </Field>
            </div>
          </div>

          {/* Section 2: Release & Call-Off Controls */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
              <Truck className="h-3.5 w-3.5 text-[#0b2447]" />
              <span>Call-Off Order &amp; Release Controls</span>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  id="rc-calloff-allowed"
                  type="checkbox"
                  checked={draft.rateContractConfig.callOffOrderAllowed}
                  onChange={e => updateRateContract('callOffOrderAllowed', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-[#0b2447]"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900">Enable Periodic Call-off Purchase Orders</span>
                  <span className="block text-[11px] text-slate-500 font-medium">
                    Allow buyer departments to trigger staggered release purchase orders against locked contract rates over the validity duration.
                  </span>
                </div>
              </label>

              {draft.rateContractConfig.callOffOrderAllowed && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Minimum Order Quantity Per Call-off">
                      <input
                        id="rc-min-order-qty"
                        type="number"
                        min={0}
                        value={draft.rateContractConfig.minimumOrderQuantity || ''}
                        onChange={e => updateRateContract('minimumOrderQuantity', Number(e.target.value || 0))}
                        className={inputClass}
                        placeholder="0 = No minimum"
                      />
                    </Field>
                    <Field label="Maximum Order Quantity Per Call-off">
                      <input
                        id="rc-max-order-qty"
                        type="number"
                        min={0}
                        value={draft.rateContractConfig.maximumOrderQuantityPerCallOff || ''}
                        onChange={e => updateRateContract('maximumOrderQuantityPerCallOff', Number(e.target.value || 0))}
                        className={inputClass}
                        placeholder="0 = No ceiling"
                      />
                    </Field>
                    <Field label="Call-off Delivery Turnaround (Days)">
                      <input
                        id="rc-delivery-sla-days"
                        type="number"
                        min={1}
                        value={draft.rateContractConfig.deliverySlaDays || ''}
                        onChange={e => updateRateContract('deliverySlaDays', e.target.value ? Number(e.target.value) : null)}
                        className={inputClass}
                        placeholder="e.g. 15 (Days from PO issuance)"
                      />
                    </Field>
                    <Field label="Call-off Delivery SLA & Instructions">
                      <input
                        id="rc-delivery-sla"
                        value={draft.rateContractConfig.deliverySla || ''}
                        onChange={e => updateRateContract('deliverySla', e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Delivery at consignee site within agreed SLA"
                      />
                    </Field>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50/70 p-2.5 text-[11px] text-blue-900 border border-blue-100/80">
                    <span className="font-bold text-blue-800 shrink-0">Release Rule:</span>
                    <span>
                      The system enforces: <strong>Minimum Call-off Qty &le; Call-off PO Qty &le; Maximum Call-off Qty</strong>. Release orders draw down cumulative quantities from the Step 3 Item Master.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Subsection 4: Rate Contract Master Document */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Contract Agreement &amp; Reference Document Upload
            </label>
            {draft.rateContractConfig.contractDocument?.fileName ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0b2447] border border-blue-100">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md" title={draft.rateContractConfig.contractDocument.fileName}>
                        {draft.rateContractConfig.contractDocument.fileName}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Uploaded
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] font-semibold text-slate-500">
                      <span>Rate Contract Reference Document</span>
                      {draft.rateContractConfig.contractDocument.fileSize ? (
                        <>
                          <span>•</span>
                          <span>{formatFileSize(draft.rateContractConfig.contractDocument.fileSize)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {draft.rateContractConfig.contractDocument.fileAssetId && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/files/${draft.rateContractConfig.contractDocument.fileAssetId}/view`, '_blank')}
                        className="h-8 px-2.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
                        View
                      </Button>
                      <a
                        href={`/api/files/${draft.rateContractConfig.contractDocument.fileAssetId}/view`}
                        download={draft.rateContractConfig.contractDocument.fileName}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                        >
                          <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                          Download
                        </Button>
                      </a>
                    </>
                  )}
                  <input
                    ref={rateContractReplaceInputRef}
                    id="rate-contract-doc-replace-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleRateContractDocUpload(file);
                    }}
                    disabled={uploadingRateContractDoc}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => rateContractReplaceInputRef.current?.click()}
                    disabled={uploadingRateContractDoc}
                    className="h-8 px-2.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                  >
                    {uploadingRateContractDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveRateContractDoc}
                    className="h-8 px-2.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 rounded-lg"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={rateContractFileInputRef}
                  id="rate-contract-doc-file-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleRateContractDocUpload(file);
                  }}
                  disabled={uploadingRateContractDoc}
                />
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload contract agreement and reference document"
                  onClick={() => rateContractFileInputRef.current?.click()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      rateContractFileInputRef.current?.click();
                    }
                  }}
                  onDragOver={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOverRateContractDoc(true);
                  }}
                  onDragLeave={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOverRateContractDoc(false);
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOverRateContractDoc(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleRateContractDocUpload(file);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-200 select-none group focus:outline-none focus:ring-2 focus:ring-[#0b2447] focus:ring-offset-2",
                    isDragOverRateContractDoc
                      ? "border-[#0b2447] bg-blue-50/80 ring-2 ring-[#0b2447]/20 scale-[0.99]"
                      : "border-slate-300 bg-slate-50/60 hover:border-[#0b2447] hover:bg-blue-50/20",
                    uploadingRateContractDoc && "opacity-60 pointer-events-none"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-110",
                    uploadingRateContractDoc
                      ? "bg-blue-100 text-[#0b2447]"
                      : "bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 group-hover:text-[#0b2447] group-hover:ring-[#0b2447]/30"
                  )}>
                    {uploadingRateContractDoc ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#0b2447]" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {uploadingRateContractDoc ? (
                        <span className="text-[#0b2447]">Uploading contract document...</span>
                      ) : (
                        <>
                          <span className="text-[#0b2447] underline underline-offset-2 font-bold hover:text-blue-900">Browse</span> or drag & drop contract document
                        </>
                      )}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10MB)
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Packet envelope configuration" required>
          <select
            value={draft.schedule.packetType}
            onChange={e => updateSchedule('packetType', e.target.value as any)}
            className={inputClass}
          >
            <option value="Single">Single Packet Envelope (Commercial Only)</option>
            <option value="Two">Two Packet Envelope (Technical + Commercial Separated)</option>
          </select>
          <p className="text-[10px] text-slate-500 font-semibold mt-1">
            Single packet evaluates technical/commercial together. Two packet evaluates technical first, then opens commercial quotes for qualified bidders.
          </p>
        </Field>

        <Field label="Submission Start Date" required error={fieldError(showErrors && !draft.schedule.submissionStartDate, 'Submission start date is required.')}>
          <DateTimePicker
            id="submission-start-datetime"
            min={todayDateTime}
            value={draft.schedule.submissionStartDate || ''}
            onChange={val => updateSchedule('submissionStartDate', val)}
            error={fieldError(showErrors && !draft.schedule.submissionStartDate, 'Submission start date is required.')}
            placeholder="Select submission start date & time"
          />
        </Field>

        <Field label="Submission End Date (Deadline)" required error={fieldError(Boolean(showErrors && (!draft.schedule.submissionDate || new Date(draft.schedule.submissionDate).getTime() <= Date.now() || Boolean(draft.schedule.submissionStartDate && new Date(draft.schedule.submissionDate) <= new Date(draft.schedule.submissionStartDate)))), !draft.schedule.submissionDate ? 'Submission deadline is required.' : new Date(draft.schedule.submissionDate).getTime() <= Date.now() ? 'Submission deadline must be in the future.' : 'Submission deadline must be after start date.')}>
          <DateTimePicker
            id="submission-end-datetime"
            min={draft.schedule.submissionStartDate || todayDateTime}
            value={draft.schedule.submissionDate || ''}
            onChange={val => updateSchedule('submissionDate', val)}
            error={fieldError(Boolean(showErrors && (!draft.schedule.submissionDate || new Date(draft.schedule.submissionDate).getTime() <= Date.now() || Boolean(draft.schedule.submissionStartDate && new Date(draft.schedule.submissionDate) <= new Date(draft.schedule.submissionStartDate)))), !draft.schedule.submissionDate ? 'Submission deadline is required.' : new Date(draft.schedule.submissionDate).getTime() <= Date.now() ? 'Submission deadline must be in the future.' : 'Submission deadline must be after start date.')}
            placeholder="Select submission deadline date & time"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
            {[
              { label: '+7 Days (Urgent)', days: 7 },
              { label: '+14 Days (Standard)', days: 14 },
              { label: '+21 Days (GFR Open)', days: 21 },
              { label: '+30 Days (Global)', days: 30 },
            ].map(p => {
              const baseTime = draft.schedule.submissionStartDate
                ? new Date(draft.schedule.submissionStartDate).getTime()
                : Date.now();
              const target = new Date(baseTime + p.days * 86400000);
              const year = target.getFullYear();
              const month = String(target.getMonth() + 1).padStart(2, '0');
              const day = String(target.getDate()).padStart(2, '0');
              const isoVal = `${year}-${month}-${day}T17:00`;
              return (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => updateSchedule('submissionDate', isoVal)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Bid Validity Period (Days)">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="Bid Validity Period in Days"
            value={draft.schedule.validityDays ?? ''}
            onChange={e => {
              let val = e.target.value.replace(/[^0-9]/g, '');
              if (val.length > 1 && val.startsWith('0')) {
                val = val.replace(/^0+/, '');
              }
              updateSchedule('validityDays', val === '' ? '' : parseInt(val, 10));
            }}
            onBlur={() => {
              const current = parseInt(String(draft.schedule.validityDays), 10);
              if (!current || current < 1) {
                updateSchedule('validityDays', 90);
              }
            }}
            className={inputClass}
            placeholder="90"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
            {[
              { label: '30 Days (Fast-Track)', days: 30 },
              { label: '60 Days (Short Cycle)', days: 60 },
              { label: '90 Days (GFR Standard)', days: 90 },
              { label: '120 Days (Multi-stage)', days: 120 },
              { label: '180 Days (Turnkey/Major)', days: 180 },
            ].map(p => (
              <button
                key={p.days}
                type="button"
                onClick={() => updateSchedule('validityDays', p.days)}
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                  Number(draft.schedule.validityDays) === p.days
                    ? "border-[#0b2447] bg-[#0b2447] text-white"
                    : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        {(draft.basics.isTechnicalEvaluationNeeded || isTwoPacket) && (() => {
          const isTechInvalid = Boolean(
            !draft.schedule.technicalOpeningDate ||
            (draft.schedule.submissionDate && new Date(draft.schedule.technicalOpeningDate).getTime() <= new Date(draft.schedule.submissionDate).getTime())
          );
          const getTechError = () => {
            if (!draft.schedule.technicalOpeningDate) return 'Technical opening date & time is required.';
            const techMs = new Date(draft.schedule.technicalOpeningDate).getTime();
            const subMs = new Date(draft.schedule.submissionDate).getTime();
            if (isNaN(techMs) || isNaN(subMs)) return 'Please select a valid technical opening date & time.';
            if (techMs <= subMs) {
              const techDateOnly = draft.schedule.technicalOpeningDate.split('T')[0];
              const subDateOnly = draft.schedule.submissionDate.split('T')[0];
              if (techDateOnly < subDateOnly) {
                return `Technical opening (${techDateOnly}) is earlier than submission deadline (${subDateOnly}). Please choose a date on or after the deadline.`;
              }
              return 'Technical opening time must be after submission deadline.';
            }
            return '';
          };
          return (
            <Field label="Technical Opening Date" required error={fieldError(showErrors && isTechInvalid, getTechError())}>
              <DateTimePicker
                id="technical-opening-datetime"
                min={draft.schedule.submissionDate}
                value={draft.schedule.technicalOpeningDate || ''}
                onChange={val => updateSchedule('technicalOpeningDate', val)}
                error={fieldError(showErrors && isTechInvalid, getTechError())}
                placeholder="Select technical opening date & time"
              />
              <div className="flex flex-wrap items-center justify-between gap-1.5 mt-1">
                <p className="text-[10px] text-slate-500 font-semibold">
                  Technical envelope unlocking date. Must be after submission closing.
                </p>
                {draft.schedule.submissionDate && isTechInvalid && (
                  <button
                    type="button"
                    onClick={() => {
                      const subMs = new Date(draft.schedule.submissionDate).getTime();
                      if (!isNaN(subMs)) {
                        updateSchedule('technicalOpeningDate', toDateTimeLocal(new Date(subMs + 15 * 60000)));
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition border border-blue-200 cursor-pointer"
                  >
                    ⚡ Auto-align: Set to 15m after deadline
                  </button>
                )}
              </div>
            </Field>
          );
        })()}

        {isTwoPacket && (() => {
          const isFinInvalid = Boolean(
            !draft.schedule.financialOpeningDate ||
            (draft.schedule.technicalOpeningDate && new Date(draft.schedule.financialOpeningDate).getTime() <= new Date(draft.schedule.technicalOpeningDate).getTime())
          );
          const getFinError = () => {
            if (!draft.schedule.financialOpeningDate) return 'Financial opening date & time is required for Two Packet flow.';
            const finMs = new Date(draft.schedule.financialOpeningDate).getTime();
            const techMs = new Date(draft.schedule.technicalOpeningDate).getTime();
            if (isNaN(finMs) || isNaN(techMs)) return 'Please select a valid financial opening date & time.';
            if (finMs <= techMs) {
              const finDateOnly = draft.schedule.financialOpeningDate.split('T')[0];
              const techDateOnly = draft.schedule.technicalOpeningDate.split('T')[0];
              if (finDateOnly < techDateOnly) {
                return `Financial opening (${finDateOnly}) is earlier than technical opening (${techDateOnly}).`;
              }
              return 'Financial opening time must be after technical opening.';
            }
            return '';
          };
          return (
            <Field label="Financial Opening Date" required error={fieldError(showErrors && isFinInvalid, getFinError())}>
              <DateTimePicker
                id="financial-opening-datetime"
                min={draft.schedule.technicalOpeningDate || draft.schedule.submissionDate}
                value={draft.schedule.financialOpeningDate || ''}
                onChange={val => updateSchedule('financialOpeningDate', val)}
                error={fieldError(showErrors && isFinInvalid, getFinError())}
                placeholder="Select financial opening date & time"
              />
              <div className="flex flex-wrap items-center justify-between gap-1.5 mt-1">
                <p className="text-[10px] text-slate-500 font-semibold">
                  Financial envelope unlocking date for technically qualified bidders. Must be after technical opening.
                </p>
                {draft.schedule.technicalOpeningDate && isFinInvalid && (
                  <button
                    type="button"
                    onClick={() => {
                      const techMs = new Date(draft.schedule.technicalOpeningDate).getTime();
                      if (!isNaN(techMs)) {
                        updateSchedule('financialOpeningDate', toDateTimeLocal(new Date(techMs + 15 * 60000)));
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition border border-blue-200 cursor-pointer"
                  >
                    ⚡ Auto-align: Set to 15m after technical opening
                  </button>
                )}
              </div>
            </Field>
          );
        })()}
      </div>

      {/* ── Live Reverse Auction (e-RA) Configuration ── */}
      {!isRateContract && (
        <div className="border border-slate-200/90 rounded-2xl p-5 sm:p-6 bg-gradient-to-b from-slate-50/70 via-white to-white shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b2447] to-[#123668] text-white shadow-xs">
                <TrendingDown className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Live Reverse Auction (e-RA) Sourcing Engine
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                    Dynamic Price Discovery
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isReverseAuctionMethod(draft.type)
                    ? 'Configure real-time downward bidding rules, decrement steps, anti-sniping clocks, and participant console parameters.'
                    : 'Conduct an interactive downward bidding auction among technically qualified sellers after Stage 1 sealed bids are evaluated.'}
                </p>
              </div>
            </div>
            {!isReverseAuctionMethod(draft.type) && (
              <label className="relative inline-flex items-center cursor-pointer shrink-0 select-none" htmlFor="enable-reverse-auction-stage">
                <input
                  type="checkbox"
                  id="enable-reverse-auction-stage"
                  checked={Boolean(draft.basics.isReverseAuctionNeeded)}
                  onChange={e => {
                    const enabled = e.target.checked;
                    updateDraft(c => ({
                      ...c,
                      basics: { ...c.basics, isReverseAuctionNeeded: enabled },
                      auctionConfig: {
                        ...c.auctionConfig,
                        procurementMethod: 'BID_WITH_REVERSE_AUCTION',
                        auctionTitle: c.auctionConfig.auctionTitle || c.basics.title || 'Live Reverse Auction',
                        auctionCategory: c.auctionConfig.auctionCategory || c.basics.category,
                        startingBidPrice: c.auctionConfig.startingBidPrice || c.basics.estimatedValue || 0,
                        minimumBidDecrement: c.auctionConfig.minimumBidDecrement > 0 ? c.auctionConfig.minimumBidDecrement : Math.max(500, Math.round((c.basics.estimatedValue || 100000) * 0.01)),
                        autoExtensionEnabled: true,
                        extensionTriggerMinutes: 5,
                        extensionDurationMinutes: 5,
                        maximumExtensions: 3,
                        rankVisibility: 'SHOW_RANK_ONLY',
                      }
                    }));
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0b2447]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0b2447]" />
                <span className="ml-2.5 text-xs font-bold text-slate-800">
                  {draft.basics.isReverseAuctionNeeded ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            )}
          </div>

          {isAuction && (
            <div className="space-y-6 pt-1">
              {/* Standalone REVERSE_AUCTION: Timing & Window */}
              {isReverseAuctionMethod(draft.type) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-[#0b2447]" />
                    <span>Auction Window &amp; Countdown Clock</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Auction Start DateTime" required error={fieldError(showErrors && !draft.auctionConfig.startDateTime, 'Auction start datetime is required.')}>
                      <DateTimePicker
                        id="auction-start-datetime"
                        value={draft.auctionConfig.startDateTime}
                        onChange={val => updateAuction('startDateTime', val)}
                        error={fieldError(showErrors && !draft.auctionConfig.startDateTime, 'Auction start datetime is required.')}
                        placeholder="Select auction start date & time"
                      />
                    </Field>
                    <Field label="Auction End DateTime" required error={fieldError(showErrors && (!draft.auctionConfig.endDateTime || new Date(draft.auctionConfig.endDateTime) <= new Date(draft.auctionConfig.startDateTime)), 'Auction end must be after start datetime.')}>
                      <DateTimePicker
                        id="auction-end-datetime"
                        value={draft.auctionConfig.endDateTime}
                        onChange={val => updateAuction('endDateTime', val)}
                        error={fieldError(showErrors && (!draft.auctionConfig.endDateTime || new Date(draft.auctionConfig.endDateTime) <= new Date(draft.auctionConfig.startDateTime)), 'Auction end must be after start datetime.')}
                        placeholder="Select auction end date & time"
                      />
                    </Field>
                    <Field label="Auction Duration (Minutes)" required error={fieldError(showErrors && draft.auctionConfig.durationMinutes <= 0, 'Auction duration must be greater than 0.')}>
                      <input
                        type="number"
                        min={1}
                        value={draft.auctionConfig.durationMinutes || ''}
                        onChange={e => updateAuction('durationMinutes', Number(e.target.value || 0))}
                        className={controlClass(fieldError(showErrors && draft.auctionConfig.durationMinutes <= 0, 'Auction duration must be greater than 0.'))}
                        placeholder="e.g. 60"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Subsection: Qualification & Sourcing Rules */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Users className="h-3.5 w-3.5 text-[#0b2447]" />
                  <span>Seller Qualification &amp; Room Entry Criteria</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Auction Trigger Eligibility" required>
                    <select
                      id="auction-trigger-eligibility"
                      value={draft.auctionConfig.triggerConfiguration?.auctionAmongTopNBidders ? 'TOP_N_BIDDERS' : 'ALL_QUALIFIED'}
                      onChange={e => {
                        const isTopN = e.target.value === 'TOP_N_BIDDERS';
                        updateTrigger('auctionAmongTopNBidders', isTopN ? 3 : null);
                        updateTrigger('auctionAmongAllTechnicallyQualified', !isTopN);
                      }}
                      className={inputClass}
                    >
                      <option value="ALL_QUALIFIED">All Technically Qualified Bidders (Standard)</option>
                      <option value="TOP_N_BIDDERS">Top Qualified Initial Bidders Only (e.g. Top 3 or Top 5)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      Determines which shortlisted vendors qualify into the live reverse auction room.
                    </p>
                  </Field>

                  {draft.auctionConfig.triggerConfiguration?.auctionAmongTopNBidders ? (
                    <Field label="Number of Top Bidders (N)" required>
                      <input
                        type="number"
                        id="auction-top-n-bidders"
                        min={2}
                        max={10}
                        value={draft.auctionConfig.triggerConfiguration.auctionAmongTopNBidders || 3}
                        onChange={e => updateTrigger('auctionAmongTopNBidders', Math.max(2, Number(e.target.value || 3)))}
                        className={inputClass}
                      />
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                        Only the top N lowest sealed price bidders will enter the live auction console.
                      </p>
                    </Field>
                  ) : (
                    <Field label="Minimum Qualified Bidders" required>
                      <input
                        type="number"
                        id="auction-min-qualified-bidders"
                        min={2}
                        value={draft.auctionConfig.minimumQualifiedBidders || ''}
                        onChange={e => {
                          const value = Number(e.target.value || 0);
                          updateAuction('minimumQualifiedBidders', value);
                          updateSchedule('minimumBidders', value);
                        }}
                        className={inputClass}
                        placeholder="Minimum 2 qualified bidders"
                      />
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                        Ensures dynamic market competition before live auction commencement.
                      </p>
                    </Field>
                  )}
                </div>
              </div>

              {/* Subsection: Pricing Ceiling, Floor & Decrement */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Scale className="h-3.5 w-3.5 text-[#0b2447]" />
                  <span>Pricing Ceiling, Floor &amp; Decrement Steps</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Starting Opening Price (₹ Ceiling)">
                    <select
                      id="auction-starting-price-mode"
                      value={draft.auctionConfig.startingBidPrice === -1 ? 'L1_LOWEST' : 'MANUAL'}
                      onChange={e => {
                        if (e.target.value === 'L1_LOWEST') {
                          updateAuction('startingBidPrice', -1);
                        } else {
                          updateAuction('startingBidPrice', draft.basics.estimatedValue || 0);
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="MANUAL">Manual Entry (Custom Opening Amount)</option>
                      <option value="L1_LOWEST">Lowest Initial Bid of Participants (L1)</option>
                    </select>
                    {draft.auctionConfig.startingBidPrice !== -1 && (
                      <input
                        type="number"
                        id="auction-starting-bid-price"
                        min={0}
                        value={draft.auctionConfig.startingBidPrice || ''}
                        onChange={e => updateAuction('startingBidPrice', Number(e.target.value || 0))}
                        className={cn(inputClass, 'mt-2')}
                        placeholder={`Default: ₹${(draft.basics.estimatedValue || 0).toLocaleString('en-IN')}`}
                      />
                    )}
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      {draft.auctionConfig.startingBidPrice === -1
                        ? 'The opening price will automatically lock to the lowest qualified sealed bid (L1) at auction launch.'
                        : 'Opening ceiling price for the downward reverse auction.'}
                    </p>
                  </Field>

                  <Field label="Internal Reserve Price (Optional ₹)">
                    <input
                      type="number"
                      id="auction-reserve-price"
                      min={0}
                      value={draft.auctionConfig.reservePrice ?? ''}
                      onChange={e => updateAuction('reservePrice', e.target.value ? Number(e.target.value) : null)}
                      className={inputClass}
                      placeholder="Leave blank if no confidential reserve threshold"
                    />
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      Confidential threshold. Bids must meet or beat this price for award recommendation. Strictly hidden from sellers.
                    </p>
                  </Field>

                  <Field label="Minimum Bid Decrement (₹)" required className="sm:col-span-2">
                    <input
                      type="number"
                      id="auction-min-bid-decrement"
                      min={1}
                      value={draft.auctionConfig.minimumBidDecrement || ''}
                      onChange={e => updateAuction('minimumBidDecrement', Number(e.target.value || 0))}
                      className={inputClass}
                      placeholder="e.g. 5000"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] font-bold text-slate-500">Quick Step:</span>
                      {[
                        { label: '0.5%', val: Math.max(500, Math.round((draft.basics.estimatedValue || 100000) * 0.005)) },
                        { label: '1%', val: Math.max(1000, Math.round((draft.basics.estimatedValue || 100000) * 0.01)) },
                        { label: '₹5,000', val: 5000 },
                        { label: '₹10,000', val: 10000 },
                        { label: '₹25,000', val: 25000 },
                      ].map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => updateAuction('minimumBidDecrement', preset.val)}
                          className={cn(
                            "text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all shadow-2xs",
                            draft.auctionConfig.minimumBidDecrement === preset.val
                              ? "border-[#0b2447] bg-[#0b2447] text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </div>

              {/* Subsection: Participant Console Display & Privacy */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Eye className="h-3.5 w-3.5 text-[#0b2447]" />
                  <span>Participant Console Display &amp; Privacy</span>
                </div>
                <Field label="Supplier Rank & Competitor Visibility" required>
                  <select
                    id="auction-rank-visibility"
                    value={draft.auctionConfig.rankVisibility}
                    onChange={e => updateAuction('rankVisibility', e.target.value as AuctionConfig['rankVisibility'])}
                    className={inputClass}
                  >
                    <option value="SHOW_RANK_ONLY">Show Rank Only (Mask competitor names & prices — Recommended)</option>
                    <option value="SHOW_LOWEST_PRICE">Show Lowest Bid (L1) & Rank</option>
                    <option value="HIDDEN">Hidden (Blind Bidding)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">
                    Protects bidder privacy and prevents collusion or price-fixing cartels during live bidding.
                  </p>
                </Field>
              </div>

              {/* Subsection: Anti-sniping auto-extension */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none" htmlFor="auction-auto-extension">
                  <input
                    type="checkbox"
                    id="auction-auto-extension"
                    checked={Boolean(draft.auctionConfig.autoExtensionEnabled)}
                    onChange={e => updateAuction('autoExtensionEnabled', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0b2447]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900">Anti-Sniping Dynamic Auto-Extension</span>
                    <span className="block text-[11px] text-slate-500 font-medium mt-0.5">
                      Prevents unfair last-second bid sniping by automatically extending the auction countdown when a competitive decrement arrives near close.
                    </span>
                  </div>
                </label>

                {draft.auctionConfig.autoExtensionEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <label htmlFor="auction-ext-trigger" className="text-[10px] font-bold text-slate-600 block mb-1">
                        Trigger Window
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          id="auction-ext-trigger"
                          min={1}
                          max={30}
                          value={draft.auctionConfig.extensionTriggerMinutes || 5}
                          onChange={e => updateAuction('extensionTriggerMinutes', Number(e.target.value || 5))}
                          className={cn(inputClass, 'h-9 text-xs text-center font-bold')}
                        />
                        <span className="text-xs text-slate-500 font-bold">min</span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="auction-ext-duration" className="text-[10px] font-bold text-slate-600 block mb-1">
                        Extension Duration
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          id="auction-ext-duration"
                          min={1}
                          max={60}
                          value={draft.auctionConfig.extensionDurationMinutes || 5}
                          onChange={e => updateAuction('extensionDurationMinutes', Number(e.target.value || 5))}
                          className={cn(inputClass, 'h-9 text-xs text-center font-bold')}
                        />
                        <span className="text-xs text-slate-500 font-bold">min</span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="auction-ext-max" className="text-[10px] font-bold text-slate-600 block mb-1">
                        Max Extensions Allowed
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          id="auction-ext-max"
                          min={1}
                          max={20}
                          value={draft.auctionConfig.maximumExtensions || 3}
                          onChange={e => updateAuction('maximumExtensions', Number(e.target.value || 3))}
                          className={cn(inputClass, 'h-9 text-xs text-center font-bold')}
                        />
                        <span className="text-xs text-slate-500 font-bold">times</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Auction Terms Document */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Auction Terms &amp; Rules Document (Optional)
                </label>
                {draft.auctionConfig.termsDocumentName && draft.auctionConfig.termsDocumentName !== 'NOT REQUIRED' ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0b2447] border border-blue-100">
                        <FileText className="h-4.5 w-4.5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {draft.auctionConfig.termsDocumentName}
                        </p>
                        <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                          Attached Auction Document
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {draft.auctionConfig.termsDocumentFileId && (
                        <a
                          href={`/api/files/${draft.auctionConfig.termsDocumentFileId}/view`}
                          download={draft.auctionConfig.termsDocumentName}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                          >
                            <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                            Download
                          </Button>
                        </a>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleAuctionTermsFileUpload(file);
                          }}
                          disabled={uploadingAuctionDoc}
                        />
                        <span className="inline-flex h-8 items-center px-2.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200">
                          {uploadingAuctionDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" aria-hidden="true" /> : null}
                          Replace
                        </span>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveAuctionTermsFile}
                        className="h-8 px-2.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <label
                      onDragOver={e => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleAuctionTermsFileUpload(file);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-250 bg-slate-50/60 p-5 text-center cursor-pointer transition-all duration-200 hover:border-[#0b2447] hover:bg-blue-50/20 group",
                        uploadingAuctionDoc && "opacity-50 pointer-events-none"
                      )}
                    >
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleAuctionTermsFileUpload(file);
                        }}
                        disabled={uploadingAuctionDoc}
                      />
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 group-hover:scale-110 group-hover:text-[#0b2447] group-hover:ring-[#0b2447]/30 transition-all duration-200">
                        {uploadingAuctionDoc ? (
                          <Loader2 className="h-5 w-5 animate-spin text-[#0b2447]" aria-hidden="true" />
                        ) : (
                          <Upload className="h-5 w-5" aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {uploadingAuctionDoc ? 'Uploading auction terms document...' : 'Click to browse or drag & drop auction terms document'}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                          Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10MB)
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Buyer Monitor Privileges */}
              <div className="grid gap-3 sm:grid-cols-3 border-t border-slate-100 pt-4">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none" htmlFor="auction-show-live-rank">
                  <input type="checkbox" id="auction-show-live-rank" checked={draft.auctionConfig.buyerMonitorSettings.showLiveRank} onChange={e => updateMonitor('showLiveRank', e.target.checked)} className="h-4 w-4 rounded accent-[#0b2447]" />
                  <span className="text-slate-700 font-bold">Show Live Bid Rank</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none" htmlFor="auction-alert-reserve-breach">
                  <input type="checkbox" id="auction-alert-reserve-breach" checked={draft.auctionConfig.buyerMonitorSettings.alertOnReserveBreach} onChange={e => updateMonitor('alertOnReserveBreach', e.target.checked)} className="h-4 w-4 rounded accent-[#0b2447]" />
                  <span className="text-slate-700 font-bold">Alert On Reserve Breach</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none" htmlFor="auction-allow-manual-ext">
                  <input type="checkbox" id="auction-allow-manual-ext" checked={draft.auctionConfig.buyerMonitorSettings.allowManualExtension} onChange={e => updateMonitor('allowManualExtension', e.target.checked)} className="h-4 w-4 rounded accent-[#0b2447]" />
                  <span className="text-slate-700 font-bold">Allow Manual Extension</span>
                </label>
              </div>

              {/* How it works info banner */}
              {!isReverseAuctionMethod(draft.type) && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-950 font-medium">
                  <Info className="h-4.5 w-4.5 shrink-0 text-blue-700" aria-hidden="true" />
                  <span>
                    <strong>Two-Stage Workflow:</strong> The reverse auction will be launched as Stage 2 after evaluating initial technical/commercial bids. The parameters configured here (decrement step, rank visibility, anti-sniping) serve as defaults and can be fine-tuned prior to room activation.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Clarification & Visibility Rules</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.schedule.clarificationAllowed}
                onChange={e => updateSchedule('clarificationAllowed', e.target.checked)}
                className="h-4 w-4 rounded accent-[#12335f]"
              />
              <span>Allow bidder clarifications?</span>
            </label>
            {draft.schedule.clarificationAllowed && (
              <p className="text-[11px] text-slate-500 font-medium pl-6">
                Clarifications window opens at quotation submission start date/time and remains open until submission deadline.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 Form components: Commercial Terms
// ─────────────────────────────────────────────────────────────────────────────
function CommercialTermsForm({
  draft,
  updateDraft,
  showErrors = false
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
  showErrors?: boolean;
}) {
  const isRateContract = isRateContractMethod(draft.type);
  const isService = draft.basics.procurementCategory === 'SERVICES' || draft.type === 'RFP';
  const effectivePenaltyClause = draft.terms.penaltyClause || draft.rateContractConfig.penaltyClause || draft.serviceDetails.penaltyClause || '';

  const updateTerms = (key: keyof Draft['terms'], val: any) => {
    updateDraft(c => {
      const updatedTerms = { ...c.terms, [key]: val };
      if (key === 'penaltyClause') {
        return {
          ...c,
          terms: updatedTerms,
          rateContractConfig: { ...c.rateContractConfig, penaltyClause: val },
          serviceDetails: { ...c.serviceDetails, penaltyClause: val }
        };
      }
      if (key === 'securityDeposit') {
        return {
          ...c,
          terms: updatedTerms,
          rateContractConfig: {
            ...c.rateContractConfig,
            securityDepositAmount: Number(val) || 0,
            securityDepositRequired: Boolean(Number(val) > 0)
          }
        };
      }
      return { ...c, terms: updatedTerms };
    });
  };

  useEffect(() => {
    if (!draft.terms.penaltyClause && effectivePenaltyClause) {
      updateDraft(c => ({
        ...c,
        terms: { ...c.terms, penaltyClause: effectivePenaltyClause }
      }));
    }
  }, [draft.terms.penaltyClause, effectivePenaltyClause, updateDraft]);

  const missing = (value: unknown) => showErrors && !String(value ?? '').trim();
  const fieldError = (condition: boolean, message: string) => condition ? message : undefined;
  const controlClass = (error?: string) => cn(inputClass, error && 'border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-rose-500/20');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pricing & Commercial terms card */}
        <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Payment & Delivery Terms</h3>
          </div>

          <Field label="Payment terms" required error={fieldError(showErrors && !draft.terms.paymentTerms, 'Payment terms is required.')}>
            <select
              value={draft.terms.paymentTerms === 'ADVANCE_PAYMENT' ? 'ADVANCE_PAYMENT' : 'ON_DELIVERY'}
              onChange={e => {
                const val = e.target.value;
                updateDraft(c => ({
                  ...c,
                  terms: {
                    ...c.terms,
                    paymentTerms: val,
                    advanceAllowed: val === 'ADVANCE_PAYMENT',
                  }
                }));
              }}
              className={controlClass(fieldError(showErrors && !draft.terms.paymentTerms, 'Payment terms is required.'))}
            >
              {PAYMENT_TERMS.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <Field label="Delivery Terms" required error={fieldError(showErrors && !draft.terms.deliveryTerms, 'Delivery terms are required.')}>
            <select
              value={draft.terms.deliveryTerms}
              onChange={e => updateTerms('deliveryTerms', e.target.value)}
              className={controlClass(fieldError(showErrors && !draft.terms.deliveryTerms, 'Delivery terms are required.'))}
            >
              {DELIVERY_TYPES.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <Field label="Warranty Terms & Support Obligation">
            <div className="space-y-1.5">
              <input
                value={draft.terms.warrantyTerms || ''}
                onChange={e => updateTerms('warrantyTerms', e.target.value)}
                className={inputClass}
                placeholder="e.g. 1 Year Comprehensive Onsite Warranty"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
                {[
                  '1 Year Comprehensive Onsite Warranty',
                  '2 Years Comprehensive OEM Warranty',
                  '3 Years Standard Warranty & Support',
                  '5 Years Extended Enterprise Warranty',
                  'Not Applicable (Consumable / Pure Service)'
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateTerms('warrantyTerms', preset)}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                      draft.terms.warrantyTerms === preset
                        ? "border-[#0b2447] bg-[#0b2447] text-white"
                        : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 flex flex-col justify-between">
              <label className="flex items-start gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.terms.freightIncluded}
                  onChange={e => updateTerms('freightIncluded', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#12335f]"
                />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-slate-900 font-bold">
                      <Truck className="h-3.5 w-3.5 text-[#12335f] shrink-0" />
                      Freight Included
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider rounded",
                      draft.terms.freightIncluded ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    )}>
                      {draft.terms.freightIncluded ? 'Door Delivery' : 'Extra'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 leading-tight">
                    {draft.terms.freightIncluded
                      ? 'Bid price must include all shipping, transit insurance & door delivery to buyer location.'
                      : 'Freight charges are excluded and can be billed separately as per actuals.'}
                  </p>
                </div>
              </label>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 flex flex-col justify-between">
              <label className="flex items-start gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.terms.gstIncluded}
                  onChange={e => updateTerms('gstIncluded', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#12335f]"
                />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-900 font-bold">GST Included in Budget</span>
                    <span className={cn(
                      "px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider rounded",
                      draft.terms.gstIncluded ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    )}>
                      {draft.terms.gstIncluded ? 'Gross' : 'Net + Tax'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 leading-tight">
                    {draft.terms.gstIncluded
                      ? 'Procurement estimated value includes all applicable GST.'
                      : 'GST is evaluated and billed on top of the quoted base price.'}
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Compliance & Penalty Terms card */}
        <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-white flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-[#12335f]" aria-hidden="true" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  {isService || isRateContract
                    ? 'Liquidated Damages (LD) & Performance Penalty Clause'
                    : 'Contract Penalty Clause'}
                </h3>
              </div>
              {isRateContract && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Unified Blanket Terms
                </span>
              )}
            </div>

            <Field
              label={
                isService || isRateContract
                  ? "Liquidated Damages (LD) / Downtime Penalty Terms (min 5 char)"
                  : "Late Delivery (LD) Penalty Clause (min 5 char)"
              }
              required
              error={fieldError(showErrors && !effectivePenaltyClause, 'Penalty clause is required.')}
            >
              <div className="space-y-1.5">
                <input
                  value={effectivePenaltyClause}
                  onChange={e => updateTerms('penaltyClause', e.target.value)}
                  className={controlClass(fieldError(showErrors && !effectivePenaltyClause, 'Penalty clause is required.'))}
                  placeholder="e.g. 0.5% per week of delay up to a maximum of 10%"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
                  {[
                    '0.5% per week delay (max 10%)',
                    '1% per day SLA downtime penalty',
                    'Standard LD per GCC / PO',
                    '0.1% per day of delay up to 10% maximum'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateTerms('penaltyClause', preset)}
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0b2447]",
                        effectivePenaltyClause === preset
                          ? "border-[#0b2447] bg-[#0b2447] text-white"
                          : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {isRateContract
                ? 'Centralized liquidated damages clause applicable across all staggered release call-off orders and service SLA milestones under this agreement.'
                : 'Specify the standard liquidated damages or penalty clause applicable in case of delays in delivery or completion.'}
            </p>

            <Field label="Performance Security / Security Deposit (PBG ₹ Amount)">
              <div className="space-y-1.5">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs pointer-events-none">₹</span>
                  <input
                    type="number"
                    min={0}
                    value={draft.terms.securityDeposit || ''}
                    onChange={e => updateTerms('securityDeposit', Number(e.target.value || 0))}
                    className={cn(inputClass, 'pl-7')}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 mr-0.5">Presets:</span>
                  {[
                    { label: '0% (Exempt / MSE Waiver)', pct: 0 },
                    { label: '3% (GFR Rule 171 Standard)', pct: 3 },
                    { label: '5% (Standard Goods & Works)', pct: 5 },
                    { label: '10% (Major / Turnkey)', pct: 10 },
                  ].map(p => {
                    const est = Number(draft.basics.estimatedValue || 0);
                    const calcAmount = est > 0 ? Math.round((est * p.pct) / 100) : 0;
                    const isActive = est > 0
                      ? draft.terms.securityDeposit === calcAmount
                      : (p.pct === 0 && (!draft.terms.securityDeposit || draft.terms.securityDeposit === 0));
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          const amt = est > 0 ? Math.round((est * p.pct) / 100) : 0;
                          updateTerms('securityDeposit', amt);
                        }}
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                          isActive
                            ? "border-[#0b2447] bg-[#0b2447] text-white"
                            : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                        )}
                      >
                        {p.label} {est > 0 && p.pct > 0 ? `(₹${calcAmount.toLocaleString('en-IN')})` : ''}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-slate-500 font-medium leading-tight">
                  Performance Security protects buyer against contractual default. Automatically calculated based on estimated value (GFR Rule 171 recommends 3% to 5%).
                </p>
              </div>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7 Form components: Required Documents Checklist
// ─────────────────────────────────────────────────────────────────────────────
function DocumentsStepForm({
  draft,
  updateDraft
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
}) {
  const handleToggleDocRequired = (id: string) => {
    updateDraft(c => ({
      ...c,
      requiredDocs: c.requiredDocs.map(d => d.id === id ? { ...d, required: !d.required } : d)
    }));
  };

  const handleRemoveDoc = (id: string) => {
    updateDraft(c => ({
      ...c,
      requiredDocs: c.requiredDocs.filter(d => d.id !== id)
    }));
  };

  const handleAddCustomDoc = (name: string, required: boolean, instructions?: string) => {
    updateDraft(c => ({
      ...c,
      requiredDocs: [
        ...c.requiredDocs,
        { id: makeId(), name, required, fileType: 'pdf', maxSize: 5, instructions: instructions?.trim() || 'Additional custom document.' }
      ]
    }));
    toast.success('Custom document added to checklist');
  };

  const handleUpdateDocInstructions = (id: string, instructions: string) => {
    updateDraft(c => ({
      ...c,
      requiredDocs: c.requiredDocs.map(d => d.id === id ? { ...d, instructions } : d)
    }));
  };

  const handleUploadFile = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'procurement_draft');
      const response = await api.fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const resData = await unwrap<any>(response);
      const asset = resData.file || resData;
      const fileId = Number(resData.fileId || asset.id || 0);

      updateDraft(c => ({
        ...c,
        requiredDocs: c.requiredDocs.map(d => d.id === id ? { ...d, fileAssetId: fileId, fileName: asset.originalName || file.name } : d)
      }));
      toast.success('File uploaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    }
  };

  const handleRemoveFile = (id: string) => {
    updateDraft(c => ({
      ...c,
      requiredDocs: c.requiredDocs.map(d => d.id === id ? { ...d, fileAssetId: null, fileName: undefined } : d)
    }));
    toast.success('File removed successfully');
  };

  return (
    <DocumentRequirementBuilder
      documents={draft.requiredDocs}
      onToggleRequired={handleToggleDocRequired}
      onRemove={handleRemoveDoc}
      onAddCustomDoc={handleAddCustomDoc}
      onUpdateInstructions={handleUpdateDocInstructions}
      onUploadFile={handleUploadFile}
      onRemoveFile={handleRemoveFile}
      isEmergencyPriority={draft.basics.priority === 'Emergency'}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 8 Form components: Evaluation criteria weightages
// ─────────────────────────────────────────────────────────────────────────────
function EvaluationBasisForm({
  draft,
  updateDraft
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
}) {
  // Hardcode evaluation method to L1 on mount if not already set
  if (draft.evaluation.method !== 'L1 total value') {
    updateDraft(c => ({ ...c, evaluation: { ...c.evaluation, method: 'L1 total value' } }));
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Evaluation Method Basis <span className="text-red-500">*</span>
          </label>
          <div className="h-9 flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
            L1 Total Value Basis (Lowest Landed Cost)
          </div>
          <p className="text-[10px] text-slate-500 font-semibold mt-1">
            All procurement events are evaluated on L1 Lowest Landed Cost basis. The quotation with the lowest total delivered cost is designated as L1 for contract award.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 9 Form components: Preview summary panels
// ─────────────────────────────────────────────────────────────────────────────
function PreviewPublishForm({
  draft,
  updateDraft,
  readiness,
  complianceAccepted,
  onComplianceAcceptedChange,
}: {
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
  readiness: Array<{ label: string; ok: boolean; severity: 'error' | 'warning' | 'info' }>;
  complianceAccepted: boolean;
  onComplianceAcceptedChange: (accepted: boolean) => void;
}) {
  const errors = readiness.filter(r => r.severity === 'error');
  const warnings = readiness.filter(r => r.severity === 'warning');
  const infos = readiness.filter(r => r.severity === 'info');

  return (
    <div className="space-y-4 sm:space-y-6">
      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2 pl-0.5">Final Sourcing Summary</h3>

      {/* Sourcing summary panel from Loop 3 */}
      <ProcurementSummaryPanel
        title={draft.basics.title}
        method={draft.type}
        estimatedValue={draft.basics.estimatedValue}
        priority={draft.basics.priority}
        requiredBy={draft.basics.requiredByDate}
        location={draft.basics.deliveryLocation}
        itemsCount={(draft.basics.pricingFormat === 'BOQ' || draft.basics.pricingFormat === 'SOR' || draft.basics.procurementCategory === 'WORKS') ? draft.boqTable.length : draft.items.length}
        suppliersCount={draft.vendors.invitedSellers.length}
        docsCount={draft.requiredDocs.length}
      />

      {draft.serviceDetails.sowFileName && (
        <div className="flex items-center gap-2.5 rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-xs font-semibold text-purple-950">
          <FileText className="h-4 w-4 text-purple-700 shrink-0" aria-hidden="true" />
          <span>Attached Scope of Work (SOW) Document: <strong>{draft.serviceDetails.sowFileName}</strong></span>
          <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
            SOW Attached
          </span>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">Readiness & Validation Summary</h4>
        
        {/* Required Fields Section */}
        <div className="space-y-2">
          <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Required Sourcing Inputs</h5>
          <div className="grid gap-2 sm:grid-cols-2">
            {errors.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs font-semibold leading-normal">
                <span className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white text-[9px] font-black",
                  r.ok ? "bg-emerald-500" : "bg-rose-500"
                )}>
                  {r.ok ? '✓' : '✗'}
                </span>
                <span className={r.ok ? 'text-slate-700 font-medium' : 'text-rose-600 font-bold'}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warnings Section */}
        {warnings.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Compliance Warnings & Advisories</h5>
            <div className="grid gap-2 sm:grid-cols-2">
              {warnings.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs font-semibold leading-normal">
                  <span className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white text-[9px] font-black",
                    r.ok ? "bg-emerald-500" : "bg-amber-500"
                  )}>
                    {r.ok ? '✓' : '!'}
                  </span>
                  <span className={r.ok ? 'text-slate-700 font-medium' : 'text-amber-600 font-bold'}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Overrides Section */}
        {infos.length > 0 && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Sourcing Customizations</h5>
            <div className="grid gap-2 sm:grid-cols-2">
              {infos.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs font-semibold leading-normal">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white text-[9px] font-black">
                    i
                  </span>
                  <span className="text-slate-700 font-semibold">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


      <Field label="Approval notes / Submission Remarks">
        <textarea
          value={draft.approval.notes}
          onChange={e => updateDraft(c => ({ ...c, approval: { ...c.approval, notes: e.target.value } }))}
          className={textareaClass}
          rows={3}
          placeholder="Enter remarks for the approval authority..."
        />
      </Field>

      <div className="pt-2">
        <div
          className={cn(
            'rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 transition-all duration-150',
            complianceAccepted
              ? 'border-blue-600 bg-blue-50/50 shadow-2xs ring-1 ring-blue-600/20'
              : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
          )}
        >
          <label
            htmlFor="create-procurement-policy-consent"
            className="flex items-start gap-2.5 sm:gap-3 cursor-pointer select-none"
          >
            <div className="relative flex items-center justify-center shrink-0 mt-0.5">
              <input
                type="checkbox"
                id="create-procurement-policy-consent"
                checked={complianceAccepted}
                onChange={(e) => onComplianceAcceptedChange(e.target.checked)}
                aria-required="true"
                className="peer sr-only"
              />
              <div
                className={cn(
                  'flex h-4.5 w-4.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                  complianceAccepted
                    ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                    : 'border-slate-300 bg-white hover:border-slate-400 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-1'
                )}
                aria-hidden="true"
              >
                <Check
                  className={cn(
                    'h-3 w-3 stroke-[3] transition-transform duration-150',
                    complianceAccepted ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                  )}
                />
              </div>
            </div>

            <div className="flex-1 min-w-0 text-xs sm:text-sm text-slate-800 leading-snug">
              <span className="font-bold">
                I certify compliance with procurement rules &amp; accept the{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const pdfUrl = '/docs/Order_Placement_Procurement_Policy.pdf';
                    const link = document.createElement('a');
                    link.href = pdfUrl;
                    link.download = 'Order_Placement_Procurement_Policy.pdf';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="inline-flex items-center gap-1 font-bold text-[#12335f] underline underline-offset-2 decoration-blue-500/60 hover:text-blue-700 hover:decoration-blue-700 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-0.5"
                  title="Click to download Order Placement & Procurement Facilitation Policy (PDF)"
                >
                  <span>Order Placement &amp; Procurement Facilitation Policy (T&amp;C)</span>
                  <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-[#12335f]" aria-hidden="true" />
                </button>
                <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>
              </span>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-relaxed font-normal">
                By checking this box, you formally confirm administrative and financial sanction, affirm that this requirement is not split to circumvent competitive bidding thresholds, and agree to be bound by the statutory procurement terms of JSG SMILE.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE FORM FIELD
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, required, className, children, error }: { label: string; required?: boolean; className?: string; children: ReactNode; error?: string }) {
  return (
    <label className={cn('block space-y-0.5 sm:space-y-1', className)}>
      <span className={cn('text-[9px] sm:text-[10px] font-bold sm:font-black uppercase tracking-wide sm:tracking-wider', error ? 'text-rose-700' : 'text-slate-500')}>
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
      {error && <span className="block text-[10px] font-bold text-rose-600">{error}</span>}
    </label>
  );
}

const inputClass = 'h-[40px] sm:h-11 w-full min-w-0 max-w-full rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-2.5 sm:px-3 py-0 text-xs sm:text-sm font-semibold text-slate-900 shadow-3xs outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15';
const textareaClass = 'min-h-[80px] sm:min-h-[100px] w-full min-w-0 max-w-full rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-900 shadow-3xs outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15';

const shouldRetryDraftSaveAsNew = (err: unknown) => {
  const error = err as { status?: number; code?: string; body?: { code?: string }; message?: string };
  const code = String(error?.code || error?.body?.code || '');
  if (code === 'PROCUREMENT_DRAFT_NOT_FOUND' || code === 'PROCUREMENT_DRAFT_LOCKED') return true;

  const message = String(error?.message || '').toLowerCase();
  return (
    (error?.status === 404 && message.includes('procurement draft')) ||
    (error?.status === 409 && (message.includes('draft') || message.includes('submitted') || message.includes('locked')))
  );
};

const withoutServerDraftId = (payload: ReturnType<typeof buildProcurementApiPayload>) => {
  const { id: _draftId, payload: wizardPayload, ...rest } = payload as Record<string, any>;
  if (!wizardPayload || typeof wizardPayload !== 'object' || Array.isArray(wizardPayload)) {
    return { ...rest, payload: wizardPayload };
  }

  const { id: _wizardDraftId, ...wizardPayloadWithoutId } = wizardPayload;
  return { ...rest, payload: wizardPayloadWithoutId };
};

// Compatibility payload mapping helper
const buildProcurementApiPayload = (draft: Draft, draftStep = 0) => {
  const dbMethod = mapToDatabaseMethod(draft.type);
  const title = draft.basics.title || `${draft.type} draft`;
  const estimatedValue = draft.basics.estimatedValue || 0;

  // Handle BOQ item list vs Standard item list
  const isBoqBased = draft.basics.pricingFormat === 'BOQ' || draft.basics.pricingFormat === 'SOR' || draft.basics.procurementCategory === 'WORKS';
  // ISSUE-04 fix: auto-synthesize master SOW service line when category is SERVICES and no items exist
  const isEmptyServiceSow = !isBoqBased && draft.basics.procurementCategory === 'SERVICES' && draft.items.length === 0;
  const mappedItems = isBoqBased
    ? draft.boqTable.map(item => ({
        itemName: item.description,
        description: item.remarks || item.description || '',
        quantity: item.quantity,
        unitOfMeasure: (item.uom || 'Nos').trim().slice(0, 20),
        estimatedUnitPrice: item.estimatedRate,
        specifications: {
          itemType: 'Product',
          description: item.remarks || item.description || '',
          specification: item.remarks || item.description || '',
          scopeOfWork: item.remarks || item.description || '',
          category: item.category || 'General',
          hsn_sac_code: item.hsnSacCode || '',
          hsnCode: item.hsnSacCode || '',
          taxPercent: item.taxPercent !== undefined && item.taxPercent !== null ? Number(item.taxPercent) : 0,
          gst: item.taxPercent !== undefined && item.taxPercent !== null ? Number(item.taxPercent) : 0,
          fileAssetId: item.fileAssetId || item.attachments?.[0]?.fileAssetId || null,
          specificationFileName: item.fileName || item.attachments?.[0]?.fileName || '',
          attachments: item.attachments || [],
        }
      }))
    : isEmptyServiceSow
      ? [{
          itemType: 'Service' as const,
          itemName: draft.serviceDetails.serviceTitle || draft.basics.title || 'Master Service Scope',
          description: draft.serviceDetails.scopeOfWork || 'As per attached Scope of Work (SOW) and SLA terms',
          quantity: 1,
          unitOfMeasure: 'Job',
          estimatedUnitPrice: Number(draft.basics.estimatedValue || 0),
          specifications: {
            itemType: 'Service',
            specification: draft.serviceDetails.scopeOfWork || 'As per attached SOW',
            scopeOfWork: draft.serviceDetails.scopeOfWork || '',
            technicalSpecification: draft.serviceDetails.scopeOfWork || '',
            description: draft.serviceDetails.scopeOfWork || '',
            hsn_sac_code: '',
            category: draft.basics.category || '',
            gst: 18,
            fileAssetId: draft.serviceDetails.sowFileAssetId || null,
            specificationFileName: draft.serviceDetails.sowFileName || '',
            attachments: [],
          }
        }]
      : draft.items.map(item => {
        const descText = item.specification || item.technicalSpecification || (item as any).description || (item as any).scopeOfWork || '';
        return {
          itemType: item.itemType || 'Product',
          itemName: item.name,
          description: descText,
          quantity: item.quantity,
          unitOfMeasure: (item.unit || 'Nos').trim().slice(0, 20),
          estimatedUnitPrice: Number(item.unitPrice || 0),
          specifications: {
            itemType: item.itemType || 'Product',
            specification: descText,
            scopeOfWork: descText,
            technicalSpecification: item.technicalSpecification || descText,
            description: descText,
            hsn_sac_code: item.hsn_sac_code || '',
            category: item.category || draft.basics.category || '',
            categoryId: item.categoryId ?? null,
            brand_preference: item.brand_preference || '',
            brand_flexible: item.brand_flexible || 'Yes',
            gst: Number(item.gst || 0),
            fileAssetId: item.fileAssetId || null,
            specificationFileName: item.specificationFileName || '',
            attachments: item.attachments || [],
          }
        };
      });

  // Build default consignee matching total quantity.
  // IMPORTANT: derive the total from `mappedItems` (the exact lines sent to the backend as
  // `payload.items`) so the consignee total always equals the validator's item total across
  // Product / BOQ / Service modes. Previously this summed the raw `draft.items`, which is
  // empty in BOQ/Service modes → consignee total 0 ≠ item total → "Total consignee quantity
  // must equal total procurement quantity" on every BOQ submit.
  const totalQty = mappedItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0);

  const deliveryLocation = draft.basics.deliveryLocation || draft.internal.orgName || 'Primary Delivery Location';
  const consigneeDetails = [
    {
      name: draft.internal.contactPerson || 'Default Consignee',
      location: deliveryLocation,
      quantity: totalQty
    }
  ];

  // Map compliance required documents checklist to document formats expected by backend file validators
  const cleanDocName = (rawName?: string, fallback = 'attached_doc.pdf') => {
    const raw = String(rawName || '').trim();
    if (!raw) return fallback;
    return raw.startsWith('data:') ? fallback : raw.slice(0, 1000);
  };
  const mappedDocuments = draft.requiredDocs.map(doc => ({
    name: doc.name,
    fileName: cleanDocName(doc.fileName || (doc.name.toLowerCase().includes('boq') && draft.boqFileName 
      ? draft.boqFileName 
      : (doc.name.toLowerCase().includes('specification') && draft.items?.[0]?.specificationFileName 
        ? draft.items[0].specificationFileName 
        : undefined)), 'attached_doc.pdf'),
    fileAssetId: doc.fileAssetId || (doc.name.toLowerCase().includes('boq') ? draft.boqFileAssetId : null),
    required: doc.required,
    instructions: doc.instructions
  }));

  // Map rules and timelines matching backend validator nested structures
  const isTwoPacket = draft.schedule.packetType === 'Two';
  const isTechnicalNeeded = draft.basics.isTechnicalEvaluationNeeded || isTwoPacket;

  const tender: any = {
    bidStartDate: draft.schedule.submissionStartDate || new Date().toISOString(),
    bidClosingDate: draft.schedule.submissionDate || draft.basics.requiredByDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    performanceSecurityAmount: draft.terms.securityDeposit || 0,
    scopeOfWork: draft.serviceDetails.scopeOfWork || (draft.serviceDetails.sowFileName ? `Refer to attached SOW document: ${draft.serviceDetails.sowFileName}` : '') || (draft.boqFileName ? `Refer to attached BOQ schedule: ${draft.boqFileName}` : '') || draft.basics.justification || draft.internal.justification || draft.approval.notes || '',
    deliveryLocation,
    deliveryAddress: deliveryLocation,
  };

  if (isTechnicalNeeded) {
    tender.technicalEvaluationDate = draft.schedule.technicalOpeningDate || undefined;
  }
  if (isTwoPacket) {
    tender.financialEvaluationDate = draft.schedule.financialOpeningDate || undefined;
  }

  const basics = {
    title,
    justification: draft.limitedTenderJustification || draft.basics.justification || draft.internal.justification || draft.approval.notes || '',
    description: (draft.type === 'RFP' && (draft.serviceDetails.scopeOfWork || draft.serviceDetails.sowFileName))
      ? (draft.serviceDetails.scopeOfWork || `Refer to attached SOW document: ${draft.serviceDetails.sowFileName}`)
      : `Sourcing Method: ${draft.type}\nValue: INR ${estimatedValue.toLocaleString('en-IN')}\nUrgency: ${draft.basics.priority}`,
    procurementCategory: draft.basics.procurementCategory,
    pricingFormat: draft.basics.pricingFormat,
    estimatedValue,
    discloseEstimatedCost: Boolean(draft.basics.discloseEstimatedCost),
    deliveryLocation,
    category: draft.basics.category,
    requiredByDate: draft.basics.requiredByDate,
    priority: draft.basics.priority,
    urgency: draft.basics.priority,
  };

  const hasReverseAuction = isReverseAuctionMethod(draft.type) || Boolean(draft.basics.isReverseAuctionNeeded);
  const isStandaloneRA = isReverseAuctionMethod(draft.type);
  const auctionConfigPayload = hasReverseAuction ? {
    ...draft.auctionConfig,
    // For hybrid follow-on methods, omit start/end dates — they will be set
    // when the buyer launches Stage 2 from the Proposals tab after evaluation
    ...(isStandaloneRA ? {} : { startDateTime: undefined, endDateTime: undefined }),
    procurementMethod: isStandaloneRA ? 'REVERSE_AUCTION' : 'BID_WITH_REVERSE_AUCTION',
    auctionTitle: draft.auctionConfig.auctionTitle || title,
    auctionDescription: draft.auctionConfig.auctionDescription || draft.basics.justification || basics.description,
    auctionCategory: draft.auctionConfig.auctionCategory || draft.basics.category,
    buyerOrganization: draft.auctionConfig.buyerOrganization || draft.internal.orgName,
    department: draft.auctionConfig.department || draft.internal.department || draft.basics.department,
    purchaseOrganization: draft.auctionConfig.purchaseOrganization || draft.auctionConfig.buyerOrganization || draft.internal.orgName,
    estimatedValue,
    auctionDurationMinutes: Number(draft.auctionConfig.durationMinutes || 60),
    startingBidPrice: draft.auctionConfig.startingBidPrice === -1
      ? Number(estimatedValue > 0 ? estimatedValue : 1)
      : Number(draft.auctionConfig.startingBidPrice || estimatedValue || 1),
    reservePrice: (draft.auctionConfig.reservePrice && Number(draft.auctionConfig.reservePrice) > 0)
      ? Number(draft.auctionConfig.reservePrice)
      : null,
    minimumBidDecrement: Number(draft.auctionConfig.minimumBidDecrement || Math.max(100, Math.round(estimatedValue * 0.01)) || 1000),
    termsDocumentName: cleanDocName(draft.auctionConfig.termsDocumentName, ''),
    termsDocumentFileId: draft.auctionConfig.termsDocumentFileId || null,
    auctionTermsDocument: draft.auctionConfig.termsDocumentName && draft.auctionConfig.termsDocumentName !== 'NOT REQUIRED' ? {
      fileAssetId: draft.auctionConfig.termsDocumentFileId || null,
      fileName: cleanDocName(draft.auctionConfig.termsDocumentName, '')
    } : undefined,
    qualifiedVendors: (draft.vendors.invitedSellers || [])
      .map(s => {
        let id = 0;
        if (typeof s === 'number') id = s;
        else if (typeof s === 'string' && /^\d+$/.test(s)) id = Number(s);
        else if (s && typeof s === 'object') id = Number((s as any).sellerOrgId || (s as any).id || (s as any).sellerId || 0);
        return id > 0 ? { sellerOrgId: id } : null;
      })
      .filter((v): v is { sellerOrgId: number } => v !== null),
    triggerConfiguration: {
      preBidStageRequired: !isReverseAuctionMethod(draft.type),
      auctionAfterTechnicalQualification: true,
      auctionAmongAllTechnicallyQualified: draft.auctionConfig.triggerConfiguration?.auctionAmongAllTechnicallyQualified ?? true,
      auctionAmongTopNBidders: draft.auctionConfig.triggerConfiguration?.auctionAmongTopNBidders ?? null,
    }
  } : null;

  const rateContractConfigPayload = isRateContractMethod(draft.type) ? {
    ...draft.rateContractConfig,
    contractTitle: draft.rateContractConfig.contractTitle || title,
    contractDescription: draft.rateContractConfig.contractDescription || draft.basics.justification || basics.description,
    contractCategory: draft.rateContractConfig.contractCategory || draft.basics.category,
    deliverySla: draft.rateContractConfig.deliverySla || draft.terms.deliveryTerms || '',
    deliverySlaDays: draft.rateContractConfig.deliverySlaDays ? Number(draft.rateContractConfig.deliverySlaDays) : null,
    rateValidityPeriod: draft.rateContractConfig.rateValidityPeriod || draft.serviceDetails.duration || '',
    penaltyClause: draft.rateContractConfig.penaltyClause || draft.terms.penaltyClause || draft.serviceDetails.penaltyClause || '',
    penaltyRatePerWeek: draft.rateContractConfig.penaltyRatePerWeek != null ? Number(draft.rateContractConfig.penaltyRatePerWeek) : null,
    penaltyGraceDays: draft.rateContractConfig.penaltyGraceDays != null ? Number(draft.rateContractConfig.penaltyGraceDays) : null,
    maxPenaltyCapPercentage: draft.rateContractConfig.maxPenaltyCapPercentage != null ? Number(draft.rateContractConfig.maxPenaltyCapPercentage) : null,
    contractDocument: draft.rateContractConfig.contractDocument?.fileName ? {
      fileAssetId: draft.rateContractConfig.contractDocument.fileAssetId || null,
      fileName: cleanDocName(draft.rateContractConfig.contractDocument.fileName, ''),
      fileSize: draft.rateContractConfig.contractDocument.fileSize || null,
      uploadedAt: draft.rateContractConfig.contractDocument.uploadedAt || null,
    } : null,
    selectedSuppliers: draft.rateContractConfig.selectedSuppliers.length
      ? draft.rateContractConfig.selectedSuppliers
      : draft.vendors.invitedSellers.map(supplierId => ({ supplierId })),
    itemRateSchedule: (draft.rateContractConfig.itemRateSchedule?.length
      ? draft.rateContractConfig.itemRateSchedule
      : draft.items.map(item => ({
          id: item.id || makeId(),
          itemName: item.name,
          specification: item.specification || item.technicalSpecification || '',
          uom: (item.unit || 'Nos').trim().slice(0, 20),
          estimatedAnnualQuantity: Number(item.quantity || 1),
          baseRate: Number(item.unitPrice || 0),
          gst: Number(item.gst || 0),
          discount: 0,
          slabPricingEnabled: false,
          slabPricing: []
        }))
    ).map(item => ({
      ...item,
      uom: (item.uom || 'Nos').trim().slice(0, 20),
      slabPricing: item.slabPricingEnabled ? item.slabPricing : []
    })),
  } : null;

  const chosenEvaluationMethod = 'L1 total value';
  tender.evaluationMethod = chosenEvaluationMethod;

  const rules = {
    startPrice: auctionConfigPayload?.startingBidPrice ?? draft.basics.estimatedValue ?? 0,
    minimumDecrement: auctionConfigPayload?.minimumBidDecrement ?? 0,
    reservePrice: auctionConfigPayload?.reservePrice ?? null,
    auctionConfig: auctionConfigPayload,
    evaluationMethod: chosenEvaluationMethod,
    allowReverseAuction: hasReverseAuction,
    urgency: draft.basics.priority,
    priority: draft.basics.priority,
  };

  // Run suggestion engine to capture recommendation result
  const recommendation = suggestProcurementMethod({
    estimatedValue: draft.basics.estimatedValue,
    procurementCategory: draft.basics.procurementCategory,
    pricingFormat: draft.basics.pricingFormat,
    isCatalogueAvailable: draft.basics.isCatalogueAvailable,
    isOnlyOneVendor: draft.basics.isOnlyOneVendor,
    isReverseAuctionNeeded: draft.basics.isReverseAuctionNeeded,
    isTechnicalEvaluationNeeded: draft.basics.isTechnicalEvaluationNeeded,
    urgency: draft.basics.priority,
    lineItemsCount: isBoqBased ? draft.boqTable.length : draft.items.length,
    isSpecClear: draft.basics.isSpecClear,
    isRepeatedSupply: draft.basics.isRepeatedSupply,
    marketResearchOnly: draft.basics.marketResearchOnly,
  });

  const isClarificationAllowed = Boolean(draft.schedule.clarificationAllowed);
  const cleanBidValidityDate = (draft.schedule.submissionDate && draft.schedule.validityDays)
    ? (() => {
        try {
          const d = new Date(draft.schedule.submissionDate);
          if (!isNaN(d.getTime())) {
            return new Date(d.getTime() + Number(draft.schedule.validityDays) * 86400000).toISOString().slice(0, 10);
          }
        } catch {}
        return draft.schedule.bidValidityDate;
      })()
    : draft.schedule.bidValidityDate;

  const cleanSchedule = {
    ...draft.schedule,
    validityDays: Number(draft.schedule.validityDays) || 90,
    minimumBidders: Number(draft.schedule.minimumBidders) || 3,
    clarificationAllowed: isClarificationAllowed,
    technicalOpeningDate: isTechnicalNeeded ? (draft.schedule.technicalOpeningDate || null) : null,
    financialOpeningDate: isTwoPacket ? (draft.schedule.financialOpeningDate || null) : null,
    bidValidityDate: cleanBidValidityDate,
  };

  const isQcbsChosen = chosenEvaluationMethod.toLowerCase().includes('qcbs') || chosenEvaluationMethod.toLowerCase().includes('weighted');

  const autoWorkflow = isTwoPacket ? 'Two-Stage (Technical + Financial)' : 'Single Stage (Commercial Only)';

  const payloadJson = {
    ...draft,
    approval: {
      ...draft.approval,
      workflow: autoWorkflow,
    },
    boqTable: isBoqBased ? draft.boqTable : [],
    boqFileName: isBoqBased ? draft.boqFileName : '',
    boqFileAssetId: isBoqBased ? draft.boqFileAssetId : null,
    schedule: cleanSchedule,
    allowReverseAuction: hasReverseAuction,
    serviceDetails: draft.basics.procurementCategory === 'SERVICES'
      ? {
          ...draft.serviceDetails,
          serviceTitle: (draft.serviceDetails?.serviceTitle || draft.basics?.title || '').trim(),
        }
      : null,
    evaluationMethod: chosenEvaluationMethod,
    evaluation: {
      ...draft.evaluation,
      method: chosenEvaluationMethod,
      evaluationMethod: chosenEvaluationMethod,
      techWeight: isQcbsChosen ? draft.evaluation.techWeight : null,
      commWeight: isQcbsChosen ? draft.evaluation.commWeight : null,
      qcbsRatio: isQcbsChosen ? (draft.evaluation as any).qcbsRatio : null,
      minQualifyingMarks: isQcbsChosen ? draft.evaluation.minQualifyingMarks : null,
    },
    limitedTenderJustification: draft.limitedTenderJustification || draft.basics.justification || draft.internal.justification || '',
    rfqType: draft.rfqType,
    items: isBoqBased ? mappedItems : draft.items,
    fullProcurementMethod: draft.type,
    categoryType: draft.basics.procurementCategory,
    procurementCategory: draft.basics.procurementCategory,
    pricingFormat: draft.basics.pricingFormat,
    recommendation,
    consigneeDetails,
    documents: mappedDocuments,
    tender,
    rules,
    urgency: draft.basics.priority,
    priority: draft.basics.priority,
    basics: {
      ...basics,
      priority: draft.basics.priority,
      urgency: draft.basics.priority,
      isReverseAuctionNeeded: hasReverseAuction,
    },
    vendors: {
      ...draft.vendors,
      invitedSellers: draft.vendors.invitedSellers || [],
      inviteCount: Array.isArray(draft.vendors.invitedSellers) && draft.vendors.invitedSellers.length > 0
        ? draft.vendors.invitedSellers.length
        : (Number(draft.vendors.inviteCount) || 0)
    },
    auctionConfig: hasReverseAuction ? auctionConfigPayload : null,
    rateContractConfig: rateContractConfigPayload,
    rateContract: rateContractConfigPayload
  };

  return {
    id: draft.id,
    methodSlug: draft.type,
    procurementMethod: dbMethod,
    canonicalMethod: draft.type,
    categoryType: draft.basics.procurementCategory,
    procurementCategory: draft.basics.procurementCategory,
    pricingFormat: draft.basics.pricingFormat,
    sealedSubmission: draft.sealedSubmissionFlag,
    title,
    description: basics.description,
    estimatedValue,
    discloseEstimatedCost: Boolean(draft.basics.discloseEstimatedCost),
    requiredBy: draft.basics.requiredByDate || undefined,
    draftStep,
    workflowStatus: 'DRAFT',
    approvalStatus: autoWorkflow,
    evaluationMethod: chosenEvaluationMethod,
    urgency: draft.basics.priority,
    priority: draft.basics.priority,
    payload: payloadJson,
    items: mappedItems
  };
};
