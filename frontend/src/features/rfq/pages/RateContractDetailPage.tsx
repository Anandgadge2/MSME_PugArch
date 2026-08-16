'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { formatRefId } from '../../../utils/refIdUtils';
import {
  Download,
  Calendar,
  MapPin,
  Building2,
  Check,
  Loader2,
  Eye,
  FileText,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Layers,
  ClipboardList,
  IndianRupee,
  Info,
  Package,
  ClipboardCheck,
  Clock,
  CheckCircle,
  Users,
  Tag,
  CheckCircle2,
  ShieldAlert,
  FileCheck,
  Truck,
  Phone,
  Mail,
  FileSpreadsheet,
  Lock,
  Scale,
  FileBox,
  ChevronDown,
  ChevronUp,
  Shield,
  ExternalLink,
  AlertCircle,
  RotateCcw,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import ClarificationPanel from '../components/ClarificationPanel';
import { procurementBidApi } from '../../procurementBid/api';
import { openFileAsset } from '../../../lib/files';
import { PdfEngine } from '../../../lib/pdfEngine';
import { ProcurementDetailUnifiedView } from '../components/ProcurementDetailUnifiedView';

/* ─── Helper Utilities ─────────────────────────────────── */

function formatDateString(dateVal?: string | Date | null, includeTime: boolean = false) {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    if (!includeTime) return `${day} ${month} ${year}`;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes} IST`;
  } catch {
    return String(dateVal);
  }
}

function formatCurrency(val?: number | string | null) {
  if (val === undefined || val === null || val === '') return null;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  if (typeof val === 'boolean') return true;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val as object).length > 0;
  return true;
}

function formatDisplayValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.map(v => formatDisplayValue(v)).join(', ');
  if (typeof val === 'object') return Object.entries(val as object).map(([k, v]) => `${k}: ${formatDisplayValue(v)}`).join(' | ');
  const str = String(val);
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/* ─── Reusable Sub-Components ───────────────────────────── */

const SectionHeading = ({ title }: { title: string }) => (
  <h3 className="text-xs font-black text-[#0b2447] tracking-wider uppercase mb-3 flex items-center gap-2">
    <span className="w-1.5 h-4 bg-[#0b2447] rounded-full inline-block" />
    {title}
  </h3>
);

/** Only renders a row if value is present */
const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
  if (!hasValue(value)) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value}</span>
    </div>
  );
};

/** Card that auto-hides when it has zero visible InfoRow children */
function AutoHideCard({ title, children }: { title: string; children: React.ReactNode }) {
  // We render and rely on InfoRow's null-return to naturally collapse empty cards.
  // To avoid showing a card with only a heading, we wrap to inspect rendered output.
  const childrenArray = React.Children.toArray(children);
  if (childrenArray.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
      <SectionHeading title={title} />
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */

export default function RateContractDetailPage({ initialData }: { initialData?: any } = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin' || user?.role === 'master_admin';
  const [expandedDocs, setExpandedDocs] = useState(false);

  const explicitReqId = searchParams?.get('requirementId') || '';
  const explicitRequestId = searchParams?.get('requestId') || searchParams?.get('bidId') || searchParams?.get('rfqId') || '';
  const rawIdParam = searchParams?.get('id') || '';

  let requirementId = explicitReqId;
  let requestId = explicitRequestId;

  if (!requirementId && !requestId && rawIdParam) {
    if (rawIdParam.startsWith('req-')) {
      requirementId = rawIdParam.replace('req-', '');
    } else if (rawIdParam.startsWith('bid-') || rawIdParam.startsWith('qr-') || rawIdParam.startsWith('rc-')) {
      requestId = rawIdParam.replace(/^(bid|qr|rc)-/, '');
    } else {
      requirementId = rawIdParam;
    }
  }

  // Fetch ProcurementBid / Rate Contract data via the unified detail endpoint
  const { data: bidData, isLoading: bidLoading, error: bidError } = useQuery({
    queryKey: ['procurement-bid-rc-detail', requestId],
    queryFn: () => procurementBidApi.detail(requestId),
    enabled: !!requestId,
    initialData: initialData?.sourceModel === 'BID' || initialData?.bidNumber ? initialData : undefined,
    staleTime: 60_000,
    retry: 1,
  });

  // Fetch BuyerRequirement data when navigated via requirementId
  const { data: reqData, isLoading: reqLoading, error: reqError } = useQuery({
    queryKey: ['marketplace-requirement-rc-detail', requirementId],
    queryFn: async () => {
      const data = await getApi<any>(`/api/marketplace/requirements/${requirementId}`);
      return data;
    },
    enabled: !!requirementId,
    initialData: initialData?.title || initialData?.requirement ? initialData : undefined,
    staleTime: 60_000,
    retry: 1,
  });

  const bidSourceId = bidData?.sourceId || null;
  const { data: bidReqData } = useQuery({
    queryKey: ['marketplace-requirement-rc-ownresponse', bidSourceId],
    queryFn: async () => {
      const data = await getApi<any>(`/api/marketplace/requirements/${bidSourceId}`);
      return data;
    },
    enabled: !!requestId && !!bidSourceId && user?.role === 'seller',
    staleTime: 60_000,
  });

  const hasData = Boolean(bidData || reqData || initialData);
  const isLoading = !hasData && (bidLoading || reqLoading);
  const error = !hasData && (bidError || reqError) ? (bidError || reqError) : null;

  const reqObj = reqData?.requirement || reqData;

  const ownParticipation: any = user?.role === 'seller'
    ? (bidData?.participations || []).find((p: any) =>
        Number(p.sellerId) === Number(user?.id) ||
        (user?.organizationId && p.seller?.organizationId === user.organizationId)
      )
    : null;

  const ownResponse = reqData?.ownResponse || bidReqData?.ownResponse || (ownParticipation ? {
    status: ownParticipation.status || 'SUBMITTED',
    createdAt: ownParticipation.createdAt,
    updatedAt: ownParticipation.updatedAt || ownParticipation.createdAt,
    offeredPrice: ownParticipation.offeredPrice || ownParticipation.responseData?.offeredPrice,
    offeredQuantity: ownParticipation.offeredQuantity || ownParticipation.responseData?.offeredQuantity,
    deliveryTimeline: ownParticipation.deliveryTimeline || ownParticipation.responseData?.deliveryTimeline,
    terms: ownParticipation.terms || ownParticipation.responseData?.terms,
    message: ownParticipation.message || ownParticipation.responseData?.message,
    responseData: ownParticipation.responseData,
  } : null);

  // ── Normalize rcData from either bidData or reqData ──
  const preferReq = Boolean(explicitReqId && reqObj);
  const bid: any = bidData;   // Runtime has more fields than the TS type; cast for extraction

  const rcData: any = preferReq ? {
    id: reqObj.id,
    subject: reqObj.title || reqObj.description || bid?.title,
    buyer: {
      name: reqObj.buyerOrganization?.organizationName || reqObj.buyer?.name || reqObj.buyerEmail || bid?.buyer?.name || null,
      email: reqObj.buyerEmail || reqObj.buyer?.email || null,
      mobile: reqObj.buyerMobile || reqObj.buyer?.mobile || null,
      buyerProfile: reqObj.buyerOrganization || reqObj.buyer?.buyerProfile,
    },
    estimatedValue: reqObj.estimatedValue || reqObj.budgetMax || reqObj.budgetMin || bid?.estimatedValue,
    deadlineDate: reqObj.lastDate || bid?.endDate,
    createdAt: reqObj.createdAt,
    updatedAt: reqObj.updatedAt,
    status: reqObj.status || bid?.status,
    items: reqObj.items || reqObj.payload?.items || bid?.items,
    location: reqObj.location || (reqObj.buyerOrganization
      ? [reqObj.buyerOrganization.address || reqObj.buyerOrganization.organizationName, reqObj.buyerOrganization.city, reqObj.buyerOrganization.district, reqObj.buyerOrganization.state].filter(Boolean).join(', ')
      : bid?.deliveryLocation),
    requirementNumber: reqObj.requirementNumber || bid?.bidNumber,
    paymentTerms: reqObj.paymentTerms || reqObj.payload?.paymentTerms || reqObj.payload?.terms?.paymentTerms || bid?.technicalPacket?.terms?.paymentTerms,
    deliveryTerms: reqObj.deliveryTerms || reqObj.payload?.deliveryTerms || reqObj.payload?.terms?.deliveryTerms || bid?.technicalPacket?.terms?.deliveryTerms,
    payload: reqObj.payload || bid?.technicalPacket,
    description: reqObj.description || bid?.description,
    documents: reqObj.documents || bid?.documents,
    procurementMethod: 'RATE_CONTRACT',
    categoryName: reqObj.category?.name || reqObj.category || bid?.category,
    quantity: reqObj.quantity || bid?.quantity,
    unit: reqObj.unit || bid?.unit,
    buyerOrganization: reqObj.buyerOrganization || bid?.buyerOrganization,
    isEmdRequired: reqObj.isEmdRequired ?? reqObj.payload?.isEmdRequired ?? bid?.isEmdRequired,
    emdAmount: reqObj.emdAmount ?? reqObj.payload?.emdAmount ?? bid?.emdAmount,
  } : bid ? {
    id: bid.id || bid.sourceId,
    subject: bid.title,
    buyer: bid.buyer || { name: bid.buyerName },
    estimatedValue: bid.estimatedValue,
    deadlineDate: bid.endDate,
    createdAt: bid.startDate || bid.createdAt,
    status: bid.status,
    location: bid.deliveryLocation,
    requirementNumber: bid.bidNumber || bid.referenceNumber || bid.id,
    paymentTerms: bid.technicalPacket?.terms?.paymentTerms || bid.technicalPacket?.rateContractConfig?.paymentTerms || '',
    deliveryTerms: bid.technicalPacket?.terms?.deliveryTerms || bid.technicalPacket?.rateContractConfig?.deliverySla || '',
    payload: bid.technicalPacket,          // ← backend now returns full technicalPacket
    description: bid.description,
    documents: bid.documents?.length ? bid.documents : (bid.bidDocuments || []),
    items: bid.items || bid.technicalPacket?.items || [],
    procurementMethod: 'RATE_CONTRACT',
    categoryName: bid.category,
    quantity: bid.quantity,
    unit: bid.unit,
    buyerOrganization: bid.buyerOrganization || { organizationName: bid.buyerOrganizationName },
    visibility: bid.visibility,
    allowReverseAuction: bid.allowReverseAuction,
    isEmdRequired: bid.isEmdRequired,
    emdAmount: bid.emdAmount,
    evaluationMethod: bid.evaluationMethod,
    // Preserve top-level date fields
    startDate: bid.startDate,
    endDate: bid.endDate,
    technicalOpeningDate: bid.technicalOpeningDate,
    financialOpeningDate: bid.financialOpeningDate,
  } : reqObj ? {
    id: reqObj.id,
    subject: reqObj.title || reqObj.description,
    buyer: {
      name: reqObj.buyerOrganization?.organizationName || reqObj.buyer?.name || reqObj.buyerEmail || null,
      email: reqObj.buyerEmail || reqObj.buyer?.email || null,
      mobile: reqObj.buyerMobile || reqObj.buyer?.mobile || null,
      buyerProfile: reqObj.buyerOrganization || reqObj.buyer?.buyerProfile,
    },
    estimatedValue: reqObj.estimatedValue || reqObj.budgetMax || reqObj.budgetMin,
    deadlineDate: reqObj.lastDate,
    createdAt: reqObj.createdAt,
    updatedAt: reqObj.updatedAt,
    status: reqObj.status,
    items: reqObj.items,
    location: reqObj.location || (reqObj.buyerOrganization
      ? [reqObj.buyerOrganization.address || reqObj.buyerOrganization.organizationName, reqObj.buyerOrganization.city, reqObj.buyerOrganization.district, reqObj.buyerOrganization.state].filter(Boolean).join(', ')
      : null),
    requirementNumber: reqObj.requirementNumber,
    paymentTerms: reqObj.paymentTerms || reqObj.payload?.paymentTerms || reqObj.payload?.terms?.paymentTerms,
    deliveryTerms: reqObj.deliveryTerms || reqObj.payload?.deliveryTerms || reqObj.payload?.terms?.deliveryTerms,
    payload: reqObj.payload,
    description: reqObj.description,
    documents: reqObj.documents,
    procurementMethod: 'RATE_CONTRACT',
    categoryName: reqObj.category?.name || reqObj.category,
    quantity: reqObj.quantity,
    unit: reqObj.unit,
    buyerOrganization: reqObj.buyerOrganization,
  } : null;

  const isClosedStatus = ['AWARDED', 'CLOSED', 'CANCELLED'].includes(rcData?.status);
  const isDeadlinePassedStatus = !!rcData?.deadlineDate && new Date(rcData.deadlineDate).getTime() < Date.now();
  const canEditRateQuotation = !isClosedStatus && !isDeadlinePassedStatus && ['PUBLISHED', 'OPEN', 'AMENDED', 'REVISION_REQUESTED', 'PENDING'].includes(rcData?.status || 'PUBLISHED');
  const isRateQuotationSubmitted = Boolean(ownResponse && ownResponse.status !== 'DRAFT');

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#12335f]" />
        <p className="text-sm font-bold text-slate-500">Loading Rate Contract details...</p>
      </div>
    );
  }

  if (error || !rcData) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Rate Contract Not Found</h2>
        <p className="text-sm font-medium text-slate-500 max-w-md">
          The requested Rate Contract opportunity could not be loaded or is no longer available.
        </p>
        <Button onClick={() => router.back()} variant="outline" className="mt-2 rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  /* ── Payload Extraction (full wizard draft shape from enriched technicalPacket) ── */
  const payload = rcData.payload || {};
  const basics = payload.basics || {};
  const internal = payload.internal || {};
  const schedule = payload.schedule || {};
  const terms = payload.terms || {};
  const vendors = payload.vendors || {};
  const evaluation = payload.evaluation || {};
  const serviceDetails = payload.serviceDetails || {};
  const consigneeDetails = Array.isArray(payload.consigneeDetails) ? payload.consigneeDetails : [];
  const rateContractConfig = payload.rateContractConfig || payload.rateContract || {};

  /* ── Core Display Fields ── */
  const subject = rcData.subject || rateContractConfig.contractTitle || 'Rate Contract Opportunity';
  const contractNumber = formatRefId('REQ', rcData.id, rcData.requirementNumber);

  /* ── Buyer Info ── */
  const orgName = rcData.buyerOrganization?.organizationName
    || rcData.buyer?.buyerProfile?.organizationName
    || internal.orgName
    || rcData.buyer?.name
    || rcData.buyerOrganizationName
    || null;
  const contactName = rcData.buyerOrganization?.contactPerson
    || rcData.contactPerson
    || internal.contactPerson
    || rcData.buyer?.name
    || null;
  const buyerEmail = rcData.buyerEmail || rcData.buyer?.email || internal.email || null;
  const buyerMobile = rcData.buyerMobile || rcData.buyer?.mobile || internal.mobile || null;
  const locationText = rcData.location
    || rateContractConfig.deliverySla
    || basics.deliveryLocation
    || internal.deliveryAddress
    || (consigneeDetails[0]?.address ? [consigneeDetails[0].name, consigneeDetails[0].address].filter(Boolean).join(': ') : null)
    || null;

  /* ── Rate Contract Specific Fields ── */
  const rateValidityPeriod = rateContractConfig.rateValidityPeriod || terms.rateValidityPeriod || null;
  const priceVariationClause = rateContractConfig.priceVariationClause || null;
  const callOffOrderAllowed = rateContractConfig.callOffOrderAllowed;
  const minimumOrderQty = rateContractConfig.minimumOrderQuantity || 0;
  const maxOrderQty = rateContractConfig.maximumOrderQuantityPerCallOff || 0;
  const deliverySla = rateContractConfig.deliverySla || terms.deliveryTerms || rcData.deliveryTerms || null;
  const penaltyClause = rateContractConfig.penaltyClause || terms.penaltyClause || null;
  const supplierStrategy = rateContractConfig.supplierSelectionStrategy
    ? formatDisplayValue(rateContractConfig.supplierSelectionStrategy)
    : null;

  /* ── Contract Period ── */
  const periodStart = rateContractConfig.periodStartDate || rcData.startDate || null;
  const periodEnd = rateContractConfig.periodEndDate || rcData.endDate || rcData.deadlineDate || null;

  /* ── Payment / Financial ── */
  const paymentTermsText = rcData.paymentTerms || terms.paymentTerms || rateContractConfig.paymentTerms || null;
  const securityDepositRequired = rateContractConfig.securityDepositRequired;
  const securityDepositAmount = rateContractConfig.securityDepositAmount;
  const pbgRequired = rateContractConfig.pbgRequired;
  const pbgAmount = rateContractConfig.pbgAmount;
  const emdRequired = rcData.isEmdRequired || terms.emdRequired;
  const emdAmount = rcData.emdAmount || terms.emdAmount;

  /* ── Description / Scope ── */
  const displayScope = rcData.description || basics.description || rateContractConfig.contractDescription || null;

  /* ── Uploaded Procurement Documents (from backend contractDocs) ── */
  const uploadedDocuments: Array<{
    id: string | number;
    fileName: string;
    documentType: string;
    fileAssetId: number | null;
    fileUrl: string | null;
  }> = [];

  // From rcData.documents (the contractDocs array from backend)
  const rawDocs = Array.isArray(rcData.documents) && rcData.documents.length > 0
    ? rcData.documents
    : Array.isArray(payload.documents) && payload.documents.length > 0
      ? payload.documents
      : [];

  for (const d of rawDocs) {
    if (!d) continue;
    const fname = d.fileName || d.originalName || d.name || null;
    const furl = d.fileUrl || d.url || (d.fileAssetId ? `/api/files/${d.fileAssetId}/view` : null);
    if (d.fileAssetId || (furl && furl !== '/api/files/null/view')) {
      uploadedDocuments.push({
        id: d.id || d.fileAssetId || uploadedDocuments.length,
        fileName: fname || 'Rate Contract Document',
        documentType: d.documentType || d.type || 'DOCUMENT',
        fileAssetId: d.fileAssetId ? Number(d.fileAssetId) : null,
        fileUrl: furl,
      });
    }
  }

  // Also check rateContractConfig.contractDocument
  const contractDoc = rateContractConfig.contractDocument;
  if (contractDoc && contractDoc.fileAssetId) {
    const alreadyAdded = uploadedDocuments.some(d => d.fileAssetId === Number(contractDoc.fileAssetId));
    if (!alreadyAdded) {
      uploadedDocuments.push({
        id: contractDoc.fileAssetId,
        fileName: contractDoc.fileName || 'Rate Contract Document',
        documentType: 'RATE_CONTRACT_DOCUMENT',
        fileAssetId: Number(contractDoc.fileAssetId),
        fileUrl: `/api/files/${contractDoc.fileAssetId}/view`,
      });
    }
  }

  /* ── Required Seller Documents (checklist, not uploaded files) ── */
  const reqDocsList: Array<{ name: string; instructions?: string; fileType?: string; maxSize?: string; required: boolean }> = [];
  const rawReqDocs = payload.requiredDocs || payload.requiredDocuments || payload.documentsRequired || payload.rules?.requiredDocuments || [];
  for (const d of (Array.isArray(rawReqDocs) ? rawReqDocs : [rawReqDocs])) {
    if (!d) continue;
    if (typeof d === 'string') {
      reqDocsList.push({ name: d, required: true });
    } else if (d && typeof d === 'object') {
      const name = d.name || d.documentName || d.fileName || d.title || d.label || '';
      if (name) reqDocsList.push({ ...d, name, required: d.required !== false });
    }
  }

  const defaultRcReqDocs = [
    { name: 'GST Certificate', instructions: 'Upload verified GST registration document.', fileType: 'PDF', maxSize: '5', required: true },
    { name: 'PAN Card', instructions: 'Upload official PAN card.', fileType: 'PDF', maxSize: '2', required: true },
    { name: 'Bank Details', instructions: 'Cancelled cheque or passbook.', fileType: 'PDF', maxSize: '2', required: true },
    { name: 'Technical Compliance Sheet', instructions: 'Compliance report against specified standards.', fileType: 'PDF, DOCX', maxSize: '10', required: true },
    { name: 'Detailed Price Breakup', instructions: 'Itemized cost schedule.', fileType: 'PDF, XLSX', maxSize: '5', required: true },
  ];

  /* ── Exhaustive Item Extraction ── */
  const extractItems = () => {
    const p = rcData?.payload || reqObj?.payload || {};
    const rateContractConfig = p.rateContractConfig || p.rateContract || {};

    // Priority order of item source candidates - itemRateSchedule is first for Rate Contracts
    const candidates = [
      rateContractConfig.itemRateSchedule,
      rcData?.items,
      reqObj?.items,
      (bidData as any)?.items,
      p.items,
      p.boq,
      p.itemsList,
      p.basics?.items,
      p.wizardData?.items,
    ];

    for (const cand of candidates) {
      if (Array.isArray(cand) && cand.length > 0) {
        return cand.map((item: any, i: number) => {
          const specs = (item.specifications && typeof item.specifications === 'object')
            ? item.specifications
            : {};

          const qty = Number(item.estimatedAnnualQuantity || item.quantity || item.qty || 1);
          const baseRate = item.baseRate !== undefined && item.baseRate !== null ? Number(item.baseRate) : (item.estimatedUnitPrice || item.unitPrice || item.price || null);
          const gst = item.gst !== undefined && item.gst !== null ? Number(item.gst) : (item.taxRate || item.gstPercent || specs.gstPercent || specs.gst || null);
          const discount = item.discount !== undefined && item.discount !== null ? Number(item.discount) : 0;
          
          const discountedRate = baseRate !== null ? baseRate * (1 - discount / 100) : null;
          const netUnitPrice = discountedRate !== null ? (gst !== null ? discountedRate * (1 + gst / 100) : discountedRate) : null;
          const totalAmount = item.totalAmount || item.totalPrice
            || (netUnitPrice !== null ? qty * netUnitPrice : (baseRate !== null ? qty * baseRate : null));

          return {
            id: item.id || i + 1,
            itemName: item.itemName || item.name || item.title || item.productName || subject,
            description: item.specification || item.description || item.itemDescription || (typeof item.specifications === 'string' ? item.specifications : null) || null,
            quantity: qty,
            unitOfMeasure: item.uom || item.unitOfMeasure || item.unit || 'Nos',
            baseRate,
            gst,
            discount,
            netUnitPrice,
            estimatedUnitPrice: baseRate,
            totalAmount,
            slabPricingEnabled: Boolean(item.slabPricingEnabled || (Array.isArray(item.slabPricing) && item.slabPricing.length > 0)),
            slabPricing: Array.isArray(item.slabPricing) ? item.slabPricing : [],
            brand: item.brand || item.makeBrand || item.brandName || specs.brand || specs.brandName || null,
            make: item.make || item.makeBrand || specs.make || specs.makeBrand || null,
            model: item.model || specs.model || null,
            alternateBrandAllowed: item.alternateBrandAllowed ?? specs.alternateBrandAllowed ?? null,
            hsn: item.hsn || item.hsnCode || item.hsn_sac_code || specs.hsn || specs.hsnCode || null,
            sac: item.sac || item.sacCode || specs.sac || specs.sacCode || null,
            technicalSpecification: item.technicalSpecification || item.specification || item.technicalSpecs || null,
            fileUrl: item.fileUrl || item.attachmentUrl || null,
            fileName: item.fileName || item.originalName || (item.fileUrl ? item.fileUrl.split('/').pop() : null) || null,
            fileAssetId: item.fileAssetId ? Number(item.fileAssetId) : null,
            deliverySchedule: item.deliverySchedule || item.deliveryPeriod || item.deliveryRequirement || null,
            warranty: item.warranty || item.warrantyRequirement || null,
          };
        });
      }
    }

    // Fallback: construct a single item from requirement-level data
    if (hasValue(subject)) {
      return [{
        id: 1,
        itemName: subject,
        description: displayScope || null,
        quantity: Number(rcData?.quantity || 1),
        unitOfMeasure: rcData?.unit || 'Nos',
        estimatedUnitPrice: rcData?.estimatedValue || null,
        totalAmount: rcData?.estimatedValue || null,
        brand: null,
        make: null,
        model: null,
        alternateBrandAllowed: null,
        hsn: null,
        sac: null,
        gst: null,
        technicalSpecification: null,
        fileUrl: null,
        fileName: null,
        fileAssetId: null,
        deliverySchedule: null,
        warranty: null,
      }];
    }
    return [];
  };

  const itemsList = extractItems();

  /* ── Timeline Events (all available dates) ── */
  const allTimelineEvents = [
    { label: 'PUBLISHING DATE', value: formatDateString(schedule.publishDate || rcData.createdAt) },
    { label: 'BID SUBMISSION START', value: formatDateString(schedule.submissionStartDate || rcData.startDate) },
    { label: 'CLARIFICATION START', value: formatDateString(schedule.clarificationAllowed ? (schedule.publishDate || rcData.createdAt) : null) },
    { label: 'CLARIFICATION END', value: formatDateString(schedule.clarificationDeadline) },
    { label: 'PRE-BID MEETING', value: formatDateString(schedule.preBidDate) },
    { label: 'BID SUBMISSION END', value: formatDateString(schedule.submissionDate || rcData.deadlineDate || rcData.endDate, true), red: true },
    { label: 'TECHNICAL OPENING', value: formatDateString(schedule.technicalOpeningDate || rcData.technicalOpeningDate) },
    { label: 'FINANCIAL OPENING', value: formatDateString(schedule.financialOpeningDate || rcData.financialOpeningDate) },
    { label: 'CONTRACT START DATE', value: formatDateString(periodStart) },
    { label: 'CONTRACT END DATE', value: formatDateString(periodEnd) },
  ].filter(e => e.value !== null);

  /* ── Contract Stepper ── */
  const publishedDate = formatDateString(schedule.publishDate || rcData.createdAt) || '—';
  const closesAt = formatDateString(schedule.submissionDate || rcData.deadlineDate || rcData.endDate, true) || '—';

  const timelineSteps = [
    { label: 'Rate Contract Published', date: publishedDate, active: true },
    { label: 'Clarification Window', date: schedule.clarificationDeadline ? `Up to ${formatDateString(schedule.clarificationDeadline)}` : 'Active', active: false },
    { label: 'Rate Quote Submission', date: `Up to ${closesAt}`, active: false },
    { label: 'Evaluation & Empanelment', date: 'Pending', active: false },
    { label: 'Contract Awarded', date: 'Pending', active: false },
  ];

  /* ── Action Handlers ── */

  const handleSubmitQuotation = () => {
    if (!user) {
      toast.error('Please login to participate and submit your rate contract quotation.');
      router.push(`/login?redirect=${encodeURIComponent(pathname + (requestId ? `?requestId=${requestId}` : (requirementId ? `?requirementId=${requirementId}` : '')))}`);
      return;
    }
    const targetId = rcData.id || requirementId || requestId;
    router.push(`/seller/rate-contract/submit-quotation?requirementId=${targetId}`);
  };

  const handleViewDoc = (doc: typeof uploadedDocuments[0]) => {
    if (doc.fileAssetId || doc.fileUrl) {
      openFileAsset(
        { id: doc.fileAssetId, fileAssetId: doc.fileAssetId, url: doc.fileUrl, originalName: doc.fileName },
        doc.fileName
      ).catch(() => {
        if (doc.fileUrl) window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
        else toast.error('Unable to open document.');
      });
    } else {
      toast.error('Document URL not available.');
    }
  };

  const handleDownloadDoc = (doc: typeof uploadedDocuments[0]) => {
    const url = doc.fileAssetId
      ? `/api/files/${doc.fileAssetId}/download`
      : doc.fileUrl;
    if (!url) { toast.error('Download URL not available.'); return; }
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ── Consignee derived helpers ── */
  const primaryConsignee = consigneeDetails[0] || null;
  const consigneeName = primaryConsignee?.name || contactName || null;
  const consigneeAddress = primaryConsignee?.address || primaryConsignee?.location || locationText || null;
  const totalConsigneeQty = consigneeDetails.reduce((s: number, c: any) => s + Number(c.quantity || 0), 0)
    || Number(rcData.quantity || 0) || null;

  /* ─────────────────────────────── RENDER (UNIFIED REFERENCE UI) ─────────────────────────────── */
  return (
    <ProcurementDetailUnifiedView
      procurementType="RATE_CONTRACT"
      procurementLabel="Rate Contract"
      id={rcData.id || requirementId || requestId || 'RC'}
      displayId={contractNumber || String(rcData.id)}
      subject={subject}
      status={rcData.status || 'OPEN'}
      buyerName={contactName}
      orgName={orgName}
      buyer={{ name: contactName, email: buyerEmail, mobile: buyerMobile, buyerProfile: rcData.buyerOrganization || rcData.buyer?.buyerProfile }}
      estimatedValue={rcData.estimatedValue}
      deadlineDate={periodEnd || rcData.deadlineDate}
      createdAt={periodStart || rcData.createdAt}
      publishedDate={periodStart ? (formatDateString(periodStart) || undefined) : undefined}
      closingDate={periodEnd ? (formatDateString(periodEnd, true) || undefined) : undefined}
      clarificationDate={schedule.clarificationDeadline ? (formatDateString(schedule.clarificationDeadline, true) || undefined) : undefined}
      technicalDate={schedule.technicalOpeningDate ? (formatDateString(schedule.technicalOpeningDate, true) || undefined) : undefined}
      category={rcData.categoryName}
      procurementMethod="Rate Contract"
      buyingType={basics.buyingType || 'Product'}
      deliveryLocation={locationText}
      paymentTerms={rcData.paymentTerms}
      deliveryTerms={rcData.deliveryTerms || deliverySla}
      description={rcData.description}
      payload={payload}
      documents={uploadedDocuments.map((d, index) => ({
        id: d.fileAssetId ? String(d.fileAssetId) : `rc-doc-${index}`,
        name: d.fileName,
        meta: d.documentType,
        fileAssetId: d.fileAssetId || undefined,
        url: d.fileUrl || undefined,
        required: true,
      }))}
      requiredDocuments={reqDocsList.length ? reqDocsList : defaultRcReqDocs}
      items={itemsList}
      evaluationMethod={rcData.evaluationMethod || 'Rate Contract L1'}
      participations={bid?.participations || []}
      participantsCount={bid?.participations?.length || 0}
      hasSubmittedProposal={isRateQuotationSubmitted}
      ownParticipation={ownParticipation}
      ownResponse={ownResponse}
      emdAmount={rcData.emdAmount}
      isEmdRequired={rcData.isEmdRequired}
      backRoute={isBuyerOrAdmin ? "/buyer/my-procurements" : "/seller/opportunities/rate-contracts"}
      backRouteLabel={isBuyerOrAdmin ? "My Procurements" : "Rate Contract Opportunities"}
      submitButtonLabel={isBuyerOrAdmin ? 'View Evaluation & Results' : (isRateQuotationSubmitted ? 'View Rate Proposal' : 'Submit Rate Quote')}
      onSubmitClick={isBuyerOrAdmin ? () => router.push(`/bids/${rcData?.id || requestId}/results`) : handleSubmitQuotation}
      clarificationKind={requirementId || bidData?.sourceModel === 'REQUIREMENT' ? 'requirement' : 'quote-request'}
      clarificationEntityId={rcData?.id || requirementId || bidData?.sourceId || requestId}
    />
  );
}
