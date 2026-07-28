'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
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

export default function RateContractDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [expandedDocs, setExpandedDocs] = useState(false);

  const requestId = searchParams?.get('requestId') || searchParams?.get('id') || '';
  const requirementId = searchParams?.get('requirementId') || '';

  // Fetch ProcurementBid / Rate Contract data via the unified detail endpoint
  const { data: bidData, isLoading: bidLoading, error: bidError } = useQuery({
    queryKey: ['procurement-bid-rc-detail', requestId],
    queryFn: () => procurementBidApi.detail(requestId),
    enabled: !!requestId,
  });

  // Fetch BuyerRequirement data when navigated via requirementId
  const { data: reqData, isLoading: reqLoading, error: reqError } = useQuery({
    queryKey: ['marketplace-requirement-rc-detail', requirementId],
    queryFn: async () => {
      const data = await getApi<any>(`/api/marketplace/requirements/${requirementId}`);
      return data;
    },
    enabled: !!requirementId,
  });

  const bidSourceId = bidData?.sourceId || null;
  const { data: bidReqData } = useQuery({
    queryKey: ['marketplace-requirement-rc-ownresponse', bidSourceId],
    queryFn: async () => {
      const data = await getApi<any>(`/api/marketplace/requirements/${bidSourceId}`);
      return data;
    },
    enabled: !!requestId && !!bidSourceId && user?.role === 'seller',
    staleTime: 30_000,
  });

  const isLoading = (!!requestId && bidLoading) || (!!requirementId && reqLoading);
  const error = (!!requestId && bidError) || (!!requirementId && reqError);

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
  const bid: any = bidData;   // Runtime has more fields than the TS type; cast for extraction
  const rcData: any = bid ? {
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
  const contractNumber = rcData.requirementNumber || (rcData.id ? `REQ-0000${rcData.id}` : null);

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
    if (fname || furl) {
      uploadedDocuments.push({
        id: d.id || d.fileAssetId || uploadedDocuments.length,
        fileName: fname || 'Procurement Document',
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
  const reqDocsList: Array<{ name: string; required: boolean }> = [];
  const rawReqDocs = payload.requiredDocs || [];
  for (const d of rawReqDocs) {
    if (!d) continue;
    const name = typeof d === 'string' ? d : (d.name || d.fileName || '');
    if (name) reqDocsList.push({ name, required: d.required !== false });
  }

  /* ── Exhaustive Item Extraction ── */
  const extractItems = () => {
    const p = rcData?.payload || reqObj?.payload || {};

    // Priority order of item source candidates
    const candidates = [
      rcData?.items,
      reqObj?.items,
      (bidData as any)?.items,
      p.items,
      p.boq,
      p.itemsList,
      p.basics?.items,
      p.wizardData?.items,
      rateContractConfig.itemRateSchedule,
    ];

    for (const cand of candidates) {
      if (Array.isArray(cand) && cand.length > 0) {
        return cand.map((item: any, i: number) => {
          // Try to get nested specifications object
          const specs = (item.specifications && typeof item.specifications === 'object')
            ? item.specifications
            : {};

          return {
            id: item.id || i + 1,
            itemName: item.itemName || item.name || item.title || item.productName || subject,
            description: item.description || item.itemDescription || (typeof item.specification === 'string' ? item.specification : null) || (typeof item.specifications === 'string' ? item.specifications : null) || null,
            quantity: Number(item.quantity || item.qty || item.estimatedAnnualQuantity || 1),
            unitOfMeasure: item.unitOfMeasure || item.unit || item.uom || 'Nos',
            estimatedUnitPrice: item.estimatedUnitPrice || item.unitPrice || item.price || item.baseRate || null,
            totalAmount: item.totalAmount || item.totalPrice
              || (item.estimatedAnnualQuantity && item.baseRate ? item.estimatedAnnualQuantity * item.baseRate : null)
              || ((item.quantity || item.qty) && (item.estimatedUnitPrice || item.unitPrice) ? (item.quantity || item.qty) * (item.estimatedUnitPrice || item.unitPrice) : null)
              || null,
            brand: item.brand || item.makeBrand || item.brandName || specs.brand || specs.brandName || null,
            make: item.make || item.makeBrand || specs.make || specs.makeBrand || null,
            model: item.model || specs.model || null,
            alternateBrandAllowed: item.alternateBrandAllowed ?? specs.alternateBrandAllowed ?? null,
            hsn: item.hsn || item.hsnCode || item.hsn_sac_code || specs.hsn || specs.hsnCode || null,
            sac: item.sac || item.sacCode || specs.sac || specs.sacCode || null,
            gst: item.gstPercent ?? item.gst ?? item.taxPercent ?? specs.gstPercent ?? specs.gst ?? null,
            technicalSpecification: item.technicalSpecification || item.technicalSpecs || (typeof item.specification === 'string' ? item.specification : null) || null,
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
  const handleDownload = () => {
    toast.success('Downloading Rate Contract documents package...');
  };

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

  /* ─────────────────────────────── RENDER ─────────────────────────────── */
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6 sm:px-6 lg:px-8">

      {/* ── Guest Login Callout ── */}
      {!user && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-900 text-white shadow-sm">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">Want to submit rates for this Rate Contract?</p>
              <p className="text-xs font-medium text-slate-600 mt-0.5">Please login or register as a verified seller to submit your rates and commercial schedule.</p>
            </div>
          </div>
          <a
            href={`/login?redirect=${encodeURIComponent(pathname + (requestId ? `?requestId=${requestId}` : (requirementId ? `?requirementId=${requirementId}` : '')))}`}
            className="whitespace-nowrap rounded-xl bg-purple-800 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-purple-900 transition-all"
          >
            Login to Participate
          </a>
        </div>
      )}

      {/* ── Page Header ── */}
      <section className="relative overflow-hidden border border-slate-200/90 rounded-2xl bg-white p-6 md:p-7 shadow-xs">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between pt-1">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 leading-snug">
                {subject}
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold tracking-wider text-indigo-700 border border-indigo-200">
                  <FileText className="h-3.5 w-3.5" /> Rate Contract
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold tracking-wider text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {rcData.status || 'Active'}
                </span>
              </div>
            </div>
            <div className="text-xs font-medium text-slate-500 flex flex-wrap items-center gap-2 pt-0.5">
              {contractNumber && (
                <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">{contractNumber}</span>
              )}
              {contractNumber && <span className="text-slate-300">•</span>}
              <span className="flex items-center gap-1 text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Published on <strong className="text-slate-800 font-semibold">{publishedDate}</strong>
              </span>
              {orgName && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    by <strong className="text-slate-800 font-semibold">{orgName}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 border-t lg:border-t-0 border-slate-100 pt-4 lg:pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="h-9 rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {uploadedDocuments.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDownload}
                className="h-9 rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-all flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5 text-indigo-600" /> Download Rate Contract
              </Button>
            )}
            {user && user.role === 'seller' && (
              ownResponse && ownResponse.status !== 'DRAFT' ? (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-200" /> View / Edit Rate Quotation
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  Submit Rate Quotation <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Active Submission Banner ── */}
      {user && user.role === 'seller' && ownResponse && ownResponse.status !== 'DRAFT' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
              <ShieldCheck className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-emerald-950">Rate Quotation Submitted</p>
                <span className="rounded-full bg-emerald-200/90 px-2.5 py-0.5 text-[9px] font-black uppercase text-emerald-800 tracking-wider">
                  Active Submission
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-800 mt-0.5">
                Your rates were submitted on {formatDateString(ownResponse.createdAt, true)}. You can review or modify rates before the deadline.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleSubmitQuotation}
            className="h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 text-xs font-black uppercase text-white shrink-0"
          >
            Review Quotation
          </Button>
        </div>
      )}

      {/* ── Procurement Stepper ── */}
      <section className="border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm overflow-x-auto">
        <div className="min-w-[720px] flex items-center justify-between relative px-8 py-2">
          <div className="absolute top-[38px] left-[60px] right-[60px] h-[3px] bg-slate-100 -z-0 rounded-full" />
          <div
            className="absolute top-[38px] left-[60px] h-[3px] bg-gradient-to-r from-purple-700 to-indigo-600 -z-0 rounded-full transition-all duration-500"
            style={{ width: '20%' }}
          />
          {timelineSteps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2.5 relative z-10 w-32 text-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                  step.active
                    ? 'bg-purple-700 border-purple-700 text-white shadow-md scale-105'
                    : 'bg-white border-slate-300 text-slate-400'
                )}
              >
                {step.active ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : (
                  <span className="text-xs font-extrabold text-slate-400">{idx + 1}</span>
                )}
              </div>
              <div className="space-y-0.5">
                <p className={cn('text-xs font-black tracking-tight', step.active ? 'text-purple-900' : 'text-slate-700')}>
                  {step.label}
                </p>
                <p className="text-[11px] font-bold text-slate-400">{step.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Overview Grid ── */}
      <section className="border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Rate Contract Overview</h2>
            <p className="text-[11px] font-medium text-slate-500">Key specs, schedule & terms</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-5">
          {hasValue(rcData.estimatedValue) && (
            <div className="space-y-1.5 p-4 rounded-xl bg-purple-50/40 border border-purple-100/90">
              <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5" /> Estimated Annual Value
              </span>
              <span className="text-base font-black text-purple-900 block tabular-nums">{formatCurrency(rcData.estimatedValue)}</span>
            </div>
          )}

          {contractNumber && (
            <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Rate Contract No.
              </span>
              <span className="text-sm font-mono font-bold text-slate-900 block truncate">{contractNumber}</span>
            </div>
          )}

          <div className="space-y-1.5 p-4 rounded-xl bg-indigo-50/40 border border-indigo-100/80">
            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" /> Sourcing Method
            </span>
            <span className="text-sm font-extrabold text-indigo-950 block">Rate Contract</span>
          </div>

          {hasValue(rcData.categoryName) && (
            <div className="space-y-1.5 p-4 rounded-xl bg-amber-50/40 border border-amber-100/80">
              <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Category
              </span>
              <span className="text-sm font-bold text-amber-950 block truncate">{rcData.categoryName}</span>
            </div>
          )}

          {hasValue(locationText) && (
            <div className="space-y-1.5 p-4 rounded-xl bg-sky-50/40 border border-sky-100/80">
              <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Delivery Location
              </span>
              <span className="text-sm font-bold text-slate-900 block truncate" title={locationText!}>{locationText}</span>
            </div>
          )}

          {hasValue(periodStart) && (
            <div className="space-y-1.5 p-4 rounded-xl bg-teal-50/40 border border-teal-100/80">
              <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Contract Start
              </span>
              <span className="text-sm font-bold text-slate-900 block">{formatDateString(periodStart)}</span>
            </div>
          )}

          {hasValue(periodEnd) && (
            <div className="space-y-1.5 p-4 rounded-xl bg-rose-50/60 border border-rose-200/80">
              <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Contract End / Closing
              </span>
              <span className="text-sm font-bold text-rose-950 block">{formatDateString(periodEnd, true) || formatDateString(periodEnd)}</span>
            </div>
          )}

          {hasValue(rateValidityPeriod) && (
            <div className="space-y-1.5 p-4 rounded-xl bg-green-50/40 border border-green-100/80">
              <span className="text-[10px] font-extrabold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Rate Validity Period
              </span>
              <span className="text-sm font-bold text-slate-900 block">{rateValidityPeriod}</span>
            </div>
          )}

          {hasValue(supplierStrategy) && (
            <div className="space-y-1.5 p-4 rounded-xl bg-orange-50/40 border border-orange-100/80">
              <span className="text-[10px] font-extrabold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Supplier Selection
              </span>
              <span className="text-sm font-bold text-slate-900 block">{supplierStrategy}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Scope of Work ── */}
      {hasValue(displayScope) && (
        <section className="border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-purple-600" /> Scope of Work & Requirement Description
          </h3>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 leading-relaxed text-slate-700 text-sm font-medium whitespace-pre-wrap">
            {displayScope}
          </div>
        </section>
      )}

      {/* ── BASIC INFORMATION & BUYER INFORMATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BASIC INFORMATION */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="BASIC INFORMATION" />
          <div className="space-y-0.5">
            <InfoRow label="TENDER NUMBER" value={contractNumber} />
            <InfoRow label="CATEGORY" value={rcData.categoryName} />
            <InfoRow label="SUB CATEGORY" value={basics.subCategory} />
            <InfoRow label="BID TYPE" value={basics.whatAreYouBuying || 'Product'} />
            <InfoRow label="PROCUREMENT METHOD" value="RATE CONTRACT" />
            <InfoRow label="PACKET TYPE" value={schedule.packetType} />
            <InfoRow label="TENDER VISIBILITY" value={rcData.visibility} />
            <InfoRow label="ESTIMATED VALUE" value={formatCurrency(rcData.estimatedValue || basics.estimatedValue)} />
            <InfoRow label="EVALUATION METHOD" value={evaluation.method || rcData.evaluationMethod} />
            <InfoRow label="RATE VALIDITY PERIOD" value={rateValidityPeriod} />
            <InfoRow label="PRICE VARIATION CLAUSE" value={priceVariationClause ? formatDisplayValue(priceVariationClause) : null} />
            <InfoRow label="CALL-OFF ORDERS" value={callOffOrderAllowed !== undefined ? (callOffOrderAllowed ? 'Allowed' : 'Not Allowed') : null} />
            <InfoRow label="MIN ORDER QTY" value={minimumOrderQty > 0 ? String(minimumOrderQty) : null} />
            <InfoRow label="MAX ORDER QTY (PER CALL-OFF)" value={maxOrderQty > 0 ? String(maxOrderQty) : null} />
            <InfoRow label="CATALOGUE AVAILABLE" value={basics.isCatalogueAvailable !== undefined ? (basics.isCatalogueAvailable ? 'Yes' : 'No') : null} />
            <InfoRow label="TECH EVAL NEEDED" value={basics.isTechnicalEvaluationNeeded !== undefined ? (basics.isTechnicalEvaluationNeeded ? 'Yes' : 'No') : null} />
            <InfoRow label="REPEATED SUPPLY" value="Yes" />
            <InfoRow label="PROCUREMENT JUSTIFICATION" value={basics.justification || internal.justification} />
          </div>
        </div>

        {/* BUYER INFORMATION */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="BUYER INFORMATION" />
          <div className="space-y-0.5">
            {orgName && (
              <InfoRow label="ORGANIZATION" value={
                <div className="flex items-center gap-2">
                  <span>{orgName}</span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-600 border border-emerald-100 uppercase">
                    <ShieldCheck className="h-3 w-3 stroke-[2.5]" /> VERIFIED
                  </span>
                </div>
              } />
            )}
            <InfoRow label="DEPARTMENT" value={internal.department || rcData.departmentName} />
            <InfoRow label="CONTACT PERSON" value={contactName} />
            {buyerEmail && (
              <InfoRow label="EMAIL" value={
                <a href={`mailto:${buyerEmail}`} className="text-blue-600 hover:underline">{buyerEmail}</a>
              } />
            )}
            <InfoRow label="PHONE" value={buyerMobile} />
            <InfoRow label="BUDGET CONFIRMED" value={internal.budgetConfirmed !== undefined ? (internal.budgetConfirmed ? 'Yes' : 'No') : null} />
            <InfoRow label="INTERNAL FILE NO" value={internal.internalFileNumber} />
            <InfoRow label="INTERNAL JUSTIFICATION" value={internal.justification} />
            <InfoRow label="COMPETENT AUTHORITY" value={internal.competentAuthority} />
            <InfoRow label="APPROVAL AUTHORITY" value={internal.approvalAuthority} />
          </div>
        </div>
      </div>

      {/* ── RATE CONTRACT TIMELINE BAR ── */}
      {allTimelineEvents.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 overflow-x-auto">
          <SectionHeading title="RATE CONTRACT TIMELINE" />
          <div className="min-w-[850px] flex items-start justify-between gap-4 pt-2">
            {allTimelineEvents.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1 border-l-2 border-slate-200 pl-3 relative flex-1">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-slate-300" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{item.label}</span>
                <span className={cn('text-xs font-black', item.red ? 'text-red-600' : 'text-slate-800')}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ITEM / BOQ DETAILS TABLE ── */}
      {itemsList.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 overflow-x-auto">
          <SectionHeading title={`ITEM / BOQ DETAILS (${itemsList.length})`} />
          <table className="w-full text-left border-collapse min-w-[1200px] text-xs">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-200">
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">S.NO</th>
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px] w-[220px]">ITEM NAME / DESCRIPTION</th>
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">TECHNICAL SPECS & FILES</th>
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">BRAND/MAKE/MODEL</th>
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">HSN/SAC/GST</th>
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">QTY & UNIT</th>
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px] text-right">UNIT PRICE</th>
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px] text-right">TOTAL PRICE</th>
                <th className="p-3 font-bold text-slate-600 uppercase text-[10px] text-center">DELIVERY / WARRANTY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {itemsList.map((item: any, idx: number) => {
                const unitPrice = hasValue(item.estimatedUnitPrice) ? formatCurrency(item.estimatedUnitPrice) : null;
                const totalPrice = hasValue(item.totalAmount)
                  ? formatCurrency(item.totalAmount)
                  : (hasValue(item.estimatedUnitPrice) && item.quantity
                    ? formatCurrency(item.estimatedUnitPrice * item.quantity)
                    : null);

                const hasBrand = hasValue(item.brand);
                const hasMake = hasValue(item.make);
                const hasModel = hasValue(item.model);
                const hasAltAllowed = item.alternateBrandAllowed !== null && item.alternateBrandAllowed !== undefined;
                const hasHsn = hasValue(item.hsn);
                const hasSac = hasValue(item.sac);
                const hasGst = item.gst !== null && item.gst !== undefined;
                const gstStr = hasGst ? (String(item.gst).includes('%') ? item.gst : `${item.gst}%`) : null;
                const hasTechSpecs = hasValue(item.technicalSpecification);
                const hasFile = hasValue(item.fileUrl) && hasValue(item.fileName);
                const hasDelivery = hasValue(item.deliverySchedule);
                const hasWarranty = hasValue(item.warranty);

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-600 align-top">{idx + 1}</td>

                    {/* Item Name / Description */}
                    <td className="p-3 align-top">
                      <p className="font-black text-slate-900">{item.itemName}</p>
                      {hasValue(item.description) && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-3">{item.description}</p>
                      )}
                    </td>

                    {/* Technical Specs & Files */}
                    <td className="p-3 align-top text-xs text-slate-700 whitespace-pre-wrap max-w-[200px]">
                      {hasTechSpecs && <div className="mb-2">{item.technicalSpecification}</div>}
                      {hasFile && (
                        <div className="font-semibold text-slate-500 text-[11px] mt-1">
                          Files: <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">📎 {item.fileName}</a>
                        </div>
                      )}
                      {!hasTechSpecs && !hasFile && (
                        <span className="text-slate-300 italic text-[11px]">No specs attached</span>
                      )}
                    </td>

                    {/* Brand/Make/Model */}
                    <td className="p-3 align-top text-xs text-slate-700">
                      {hasBrand && <div><span className="font-semibold text-slate-500">Brand:</span> {item.brand}</div>}
                      {hasMake && <div><span className="font-semibold text-slate-500">Make:</span> {item.make}</div>}
                      {hasModel && <div><span className="font-semibold text-slate-500">Model:</span> {item.model}</div>}
                      {hasAltAllowed && <div className="text-emerald-600 text-[11px] font-bold mt-0.5">Alt Allowed: {item.alternateBrandAllowed ? 'Yes' : 'No'}</div>}
                      {!hasBrand && !hasMake && !hasModel && (
                        <span className="text-slate-300 italic text-[11px]">Not specified</span>
                      )}
                    </td>

                    {/* HSN/SAC/GST */}
                    <td className="p-3 align-top text-xs text-slate-700">
                      {hasHsn && <div><span className="font-semibold text-slate-500">HSN:</span> {item.hsn}</div>}
                      {hasSac && <div><span className="font-semibold text-slate-500">SAC:</span> {item.sac}</div>}
                      {hasGst && <div><span className="font-semibold text-slate-500">GST:</span> {gstStr}</div>}
                      {!hasHsn && !hasSac && !hasGst && (
                        <span className="text-slate-300 italic text-[11px]">Not specified</span>
                      )}
                    </td>

                    {/* Qty & Unit */}
                    <td className="p-3 align-top">
                      <div className="font-black text-slate-900">{item.quantity}</div>
                      <div className="text-xs font-semibold text-slate-500">{item.unitOfMeasure}</div>
                    </td>

                    {/* Unit Price */}
                    <td className="p-3 align-top text-right font-bold text-slate-800">
                      {unitPrice || <span className="text-slate-300 text-[11px]">—</span>}
                    </td>

                    {/* Total Price */}
                    <td className="p-3 align-top text-right font-black text-slate-900">
                      {totalPrice || <span className="text-slate-300 text-[11px]">—</span>}
                    </td>

                    {/* Delivery / Warranty */}
                    <td className="p-3 align-top text-xs text-center text-slate-700">
                      {hasDelivery && <div><span className="font-semibold block text-slate-500">Delivery:</span>{item.deliverySchedule}</div>}
                      {hasWarranty && <div className="mt-1"><span className="font-semibold block text-slate-500">Warranty:</span>{item.warranty}</div>}
                      {!hasDelivery && !hasWarranty && (
                        <span className="text-slate-300 italic text-[11px]">Not specified</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── UPLOADED PROCUREMENT DOCUMENTS ── */}
      {uploadedDocuments.length > 0 && (
        <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <SectionHeading title={`UPLOADED PROCUREMENT DOCUMENTS (${uploadedDocuments.length})`} />
            {uploadedDocuments.length > 3 && (
              <button
                onClick={() => setExpandedDocs(prev => !prev)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {expandedDocs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {expandedDocs ? 'Show Less' : `View All ${uploadedDocuments.length} Docs`}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(expandedDocs ? uploadedDocuments : uploadedDocuments.slice(0, 3)).map((doc, idx) => (
              <div
                key={doc.id || idx}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
                    <FileText className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{doc.fileName}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mt-0.5">
                      {(doc.documentType || 'Document').replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleViewDoc(doc)}
                    className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all"
                    title="View document"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </button>
                  <button
                    onClick={() => handleDownloadDoc(doc)}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 border border-indigo-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700 transition-all"
                    title="Download document"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!expandedDocs && uploadedDocuments.length > 3 && (
            <p className="text-xs text-slate-400 font-medium text-center mt-3">
              + {uploadedDocuments.length - 3} more documents
            </p>
          )}
        </section>
      )}

      {/* ── DELIVERY & CONSIGNEE  |  SUPPLIER CONFIGURATION & ELIGIBILITY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DELIVERY & CONSIGNEE */}
        {(hasValue(consigneeAddress) || hasValue(consigneeName) || hasValue(totalConsigneeQty) || hasValue(deliverySla)) && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
            <SectionHeading title="DELIVERY & CONSIGNEE" />
            <div className="space-y-0.5">
              <InfoRow label="DELIVERY LOCATION" value={consigneeAddress} />
              <InfoRow label="DELIVERY SLA / TERMS" value={deliverySla} />
              <InfoRow label="CONSIGNEE NAME" value={consigneeName} />
              <InfoRow label="TOTAL QUANTITY" value={totalConsigneeQty} />
              {consigneeDetails.length > 1 && (
                <InfoRow label="CONSIGNEE LOCATIONS" value={`${consigneeDetails.length} locations`} />
              )}
              {consigneeDetails.length > 1 && consigneeDetails.map((c: any, i: number) => (
                <InfoRow
                  key={i}
                  label={`CONSIGNEE ${i + 1}`}
                  value={[c.name, c.address, c.quantity ? `Qty: ${c.quantity}` : null].filter(Boolean).join(' | ')}
                />
              ))}
            </div>
          </div>
        )}

        {/* SUPPLIER CONFIGURATION & ELIGIBILITY */}
        {(hasValue(vendors.selection) || hasValue(vendors.msmePreference) || hasValue(vendors.excludeBlacklisted) || hasValue(serviceDetails.experienceRequired) || hasValue(supplierStrategy)) && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
            <SectionHeading title="SUPPLIER CONFIGURATION & ELIGIBILITY" />
            <div className="space-y-0.5">
              <InfoRow label="VENDOR SELECTION" value={vendors.selection ? formatDisplayValue(vendors.selection) : supplierStrategy} />
              <InfoRow label="SUPPLIER STRATEGY" value={supplierStrategy} />
              <InfoRow label="STARTUP/MSME PREF." value={vendors.msmePreference !== undefined ? (vendors.msmePreference ? 'Yes' : 'No') : null} />
              <InfoRow label="EXCLUDE BLACKLISTED" value={vendors.excludeBlacklisted !== undefined ? (vendors.excludeBlacklisted ? 'Yes' : 'No') : null} />
              <InfoRow
                label="EXPERIENCE REQ."
                value={hasValue(serviceDetails.experienceRequired) ? `${serviceDetails.experienceRequired} Years` : null}
              />
              {Array.isArray(rateContractConfig.selectedSuppliers) && rateContractConfig.selectedSuppliers.length > 0 && (
                <InfoRow
                  label="SELECTED SUPPLIERS"
                  value={rateContractConfig.selectedSuppliers.map((s: any) => s.supplierName || `Supplier ${s.supplierId}`).join(', ')}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── EVALUATION BASIS  |  FINANCIAL REQUIREMENTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EVALUATION BASIS */}
        {(hasValue(evaluation.method) || hasValue(evaluation.techWeight) || hasValue(evaluation.commWeight) || hasValue(evaluation.minQualifyingMarks)) && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
            <SectionHeading title="EVALUATION BASIS" />
            <div className="space-y-0.5">
              <InfoRow label="EVALUATION METHOD" value={evaluation.method} />
              <InfoRow label="TECHNICAL WEIGHT" value={evaluation.techWeight !== null && evaluation.techWeight !== undefined ? `${evaluation.techWeight}%` : null} />
              <InfoRow label="COMMERCIAL WEIGHT" value={evaluation.commWeight !== null && evaluation.commWeight !== undefined ? `${evaluation.commWeight}%` : null} />
              <InfoRow label="MIN QUAL MARKS" value={evaluation.minQualifyingMarks !== null && evaluation.minQualifyingMarks !== undefined ? String(evaluation.minQualifyingMarks) : null} />
            </div>
          </div>
        )}

        {/* FINANCIAL REQUIREMENTS */}
        {(hasValue(rcData.estimatedValue) || hasValue(emdRequired) || hasValue(paymentTermsText) || hasValue(securityDepositRequired) || hasValue(pbgRequired)) && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
            <SectionHeading title="FINANCIAL REQUIREMENTS" />
            <div className="space-y-0.5">
              <InfoRow label="ESTIMATED VALUE" value={formatCurrency(rcData.estimatedValue || basics.estimatedValue)} />
              <InfoRow
                label="EMD AMOUNT"
                value={emdRequired === false ? 'Exempted' : (hasValue(emdAmount) ? formatCurrency(emdAmount) : null)}
              />
              <InfoRow
                label="SECURITY DEPOSIT"
                value={securityDepositRequired ? (hasValue(securityDepositAmount) ? formatCurrency(securityDepositAmount) : 'Required') : (securityDepositRequired === false ? 'Not Required' : null)}
              />
              <InfoRow
                label="PBG (PERFORMANCE BOND)"
                value={pbgRequired ? (hasValue(pbgAmount) ? formatCurrency(pbgAmount) : 'Required') : (pbgRequired === false ? 'Not Required' : null)}
              />
              <InfoRow label="PAYMENT TERMS" value={paymentTermsText} />
              <InfoRow label="GST INCLUDED" value={terms.gstIncluded !== undefined ? (terms.gstIncluded ? 'Yes' : 'No') : null} />
              <InfoRow label="FREIGHT INCLUDED" value={terms.freightIncluded !== undefined ? (terms.freightIncluded ? 'Yes' : 'No') : null} />
              <InfoRow label="PENALTY CLAUSE" value={penaltyClause} />
            </div>
          </div>
        )}
      </div>

      {/* ── REQUIRED SELLER DOCUMENTS  |  TERMS & CONDITIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* REQUIRED SELLER DOCUMENTS (checklist, not uploaded files) */}
        {reqDocsList.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <SectionHeading title="REQUIRED SELLER DOCUMENTS" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reqDocsList.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-bold text-slate-800">
                  <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                  {doc.required && (
                    <span className="ml-auto text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 uppercase">Required</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TERMS & CONDITIONS */}
        {(terms.withdrawal !== null && terms.withdrawal !== undefined ||
          terms.revision !== null && terms.revision !== undefined ||
          hasValue(terms.warrantyTerms)) && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
            <SectionHeading title="TERMS & CONDITIONS" />
            <div className="space-y-0.5">
              <InfoRow label="WITHDRAWAL" value={terms.withdrawal !== undefined && terms.withdrawal !== null ? (terms.withdrawal ? 'Allowed' : 'Not Allowed') : null} />
              <InfoRow label="REVISION" value={terms.revision !== undefined && terms.revision !== null ? (terms.revision ? 'Allowed' : 'Not Allowed') : null} />
              <InfoRow label="WARRANTY TERMS" value={terms.warrantyTerms} />
              <InfoRow label="DELIVERY TERMS" value={deliverySla} />
              <InfoRow label="PAYMENT TERMS" value={paymentTermsText} />
            </div>
          </div>
        )}
      </div>

      {/* ── Clarifications & Q&A Panel ── */}
      {rcData && (
        <ClarificationPanel
          quoteRequestId={rcData.id}
          kind={rcData?.sourceModel === 'REQUIREMENT' || !!requirementId ? 'requirement' : 'quote-request'}
          role="seller"
        />
      )}
    </div>
  );
}
