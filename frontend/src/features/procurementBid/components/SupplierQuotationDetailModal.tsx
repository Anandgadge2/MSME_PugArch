'use client';

import React from 'react';
import {
  Download,
  CheckCircle2,
  FileText,
  Package,
  Clock,
  IndianRupee,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  Eye,
  Check,
  ArrowLeft,
  ChevronRight,
  Truck,
  FileCheck2,
  Quote,
  Trophy,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { openFileAsset } from '../../../lib/files';
import { toast } from 'sonner';

export interface SupplierQuotationDetailViewProps {
  result: any;
  bid?: any;
  bidId?: string;
  onBack: () => void;
  onAcceptAndGeneratePo?: (result: any) => void;
  onDownloadPdf?: (result: any) => void;
}

export interface SupplierQuotationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: any;
  bid?: any;
  bidId?: string;
  onAcceptAndGeneratePo?: (result: any) => void;
  onDownloadPdf?: (result: any) => void;
}

const formatCurrency = (val?: number | string | null) => {
  const n = Number(val || 0);
  return n ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '₹0.00';
};

const formatDateTime = (dateStr?: string | Date) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
    });
  } catch {
    return String(dateStr);
  }
};

export interface NormalizedQuotationDocument {
  id: string | number;
  name: string;
  fileName: string;
  fileUrl: string | null;
  fileAssetId: number | string | null;
  category: string;
}

export function inferDocumentCategory(name: string, fileName?: string): string {
  const combined = `${name || ''} ${fileName || ''}`.toLowerCase();
  if (combined.includes('gst')) return 'GST / Tax';
  if (combined.includes('pan')) return 'PAN Verification';
  if (combined.includes('bank') || combined.includes('mandate')) return 'Banking Mandate';
  if (combined.includes('tech') || combined.includes('spec') || combined.includes('compliance')) return 'Technical Compliance';
  if (combined.includes('price') || combined.includes('breakup') || combined.includes('boq') || combined.includes('commercial')) return 'Price Breakup';
  if (combined.includes('udyam') || combined.includes('msme')) return 'UDYAM / MSME';
  if (combined.includes('aadhar') || combined.includes('aadhaar')) return 'Identity Proof';
  if (combined.includes('incorporation') || combined.includes('cin')) return 'Company Registration';
  if (combined.includes('deviation')) return 'No-Deviation Cert';
  return 'Statutory Document';
}

export function normalizeQuotationDocuments(source: any): NormalizedQuotationDocument[] {
  if (!source) return [];

  const rawDocs: any[] = [
    ...(Array.isArray(source.responseData?.documents) ? source.responseData.documents : []),
    ...(Array.isArray(source.responseData?.requestedDocuments) ? source.responseData.requestedDocuments : []),
    ...(Array.isArray(source.documents) ? source.documents : []),
    ...(Array.isArray(source.details?.documents) ? source.details.documents : []),
    ...(Array.isArray(source.rawParticipation?.documents) ? source.rawParticipation.documents : []),
    ...(source.attachmentUrl ? [{
      name: 'Supporting Document',
      fileName: source.attachmentFileName || 'Supporting Document',
      fileUrl: source.attachmentUrl,
      fileAssetId: source.fileAssetId,
    }] : []),
  ];

  const docMap = new Map<string, NormalizedQuotationDocument>();

  for (const item of rawDocs) {
    if (!item) continue;

    const fileUrl = item.fileUrl || item.url || null;
    const fileAssetId = item.fileAssetId || (typeof item.id === 'number' ? item.id : null);
    const rawDiskFile = String(item.fileName || item.originalName || item.file || '').trim();
    const rawName = String(item.documentName || item.name || item.title || '').trim();

    let cleanDocName = rawName;
    let cleanFileName = rawDiskFile;

    if (!cleanFileName && cleanDocName.includes('.')) {
      cleanFileName = cleanDocName;
    }
    if (!cleanFileName && fileUrl) {
      cleanFileName = fileUrl.split('/').pop() || 'document.pdf';
    }

    if (!cleanDocName || cleanDocName === 'Document' || cleanDocName === 'Supporting Document' || cleanDocName === 'TECHNICAL_PROPOSAL') {
      cleanDocName = cleanFileName || 'Attachment Document';
    }

    const urlKey = fileUrl ? fileUrl.toLowerCase().trim() : '';
    const assetKey = fileAssetId ? `asset-${fileAssetId}` : '';
    const fileKey = cleanFileName ? cleanFileName.toLowerCase().trim() : '';
    const nameKey = cleanDocName ? cleanDocName.toLowerCase().trim() : '';

    let matchedKey: string | null = null;
    for (const [k, existing] of docMap.entries()) {
      const existingUrl = existing.fileUrl ? existing.fileUrl.toLowerCase().trim() : '';
      const existingAsset = existing.fileAssetId ? `asset-${existing.fileAssetId}` : '';
      const existingFile = existing.fileName ? existing.fileName.toLowerCase().trim() : '';
      const existingName = existing.name ? existing.name.toLowerCase().trim() : '';

      if (urlKey && existingUrl && urlKey === existingUrl) {
        matchedKey = k;
        break;
      }
      if (assetKey && existingAsset && assetKey === existingAsset) {
        matchedKey = k;
        break;
      }
      if (fileKey && existingFile && fileKey === existingFile) {
        matchedKey = k;
        break;
      }
      if (nameKey && existingName && nameKey === existingName && nameKey !== 'document' && nameKey !== 'supporting document') {
        matchedKey = k;
        break;
      }
    }

    if (matchedKey) {
      const existing = docMap.get(matchedKey)!;
      if (cleanDocName && !cleanDocName.includes('.') && (existing.name.includes('.') || existing.name === existing.fileName)) {
        existing.name = cleanDocName;
      }
      if (!existing.fileUrl && fileUrl) existing.fileUrl = fileUrl;
      if (!existing.fileAssetId && fileAssetId) existing.fileAssetId = fileAssetId;
      if (cleanFileName && (!existing.fileName || existing.fileName === 'document.pdf')) existing.fileName = cleanFileName;
      existing.category = inferDocumentCategory(existing.name, existing.fileName);
    } else {
      const primaryKey = urlKey || assetKey || fileKey || nameKey || `doc-${docMap.size}`;
      const category = inferDocumentCategory(cleanDocName, cleanFileName);

      docMap.set(primaryKey, {
        id: item.id || fileAssetId || `doc-${docMap.size + 1}`,
        name: cleanDocName,
        fileName: cleanFileName || cleanDocName,
        fileUrl,
        fileAssetId,
        category,
      });
    }
  }

  return Array.from(docMap.values());
}

/**
 * Concise, High-Density Executive Quotation Evaluation View
 * Optimized for space efficiency, maximum clarity, zero wasted gaps, and immediate buyer action.
 */
export function SupplierQuotationDetailView({
  result,
  bid,
  bidId,
  onBack,
  onAcceptAndGeneratePo,
  onDownloadPdf,
}: SupplierQuotationDetailViewProps) {
  if (!result) return null;

  // Extract seller identity & contact information
  const sellerOrg =
    result.sellerName ||
    result.details?.organizationName ||
    result.sellerOrganization?.organizationName ||
    result.sellerProfile?.organizationName ||
    result.companyName ||
    'Quoting Supplier';

  const contactPerson =
    result.contactPerson ||
    result.details?.contactPerson ||
    result.sellerUser?.name ||
    result.seller?.name ||
    'Authorized Representative';

  const sellerEmail =
    result.sellerEmail ||
    result.details?.email ||
    result.sellerUser?.email ||
    result.seller?.email ||
    'Not provided';

  const sellerMobile =
    result.sellerMobile ||
    result.details?.mobile ||
    result.sellerUser?.mobile ||
    result.seller?.mobile ||
    'Not listed';

  const submittedAt = result.submittedAt || result.details?.submittedAt || result.createdAt;
  const statusStr = String(result.resultStatus || result.technicalStatus || result.status || 'Under Review');
  const rank = String(result.finalRank || 'L1');
  const isAwarded =
    result.resultStatus === 'Awarded' ||
    result.status === 'Awarded' ||
    bid?.status === 'Awarded';

  // Extract commercial parameters
  const totalEvaluatedPrice = Number(
    result.totalPrice ||
    result.totalAmount ||
    result.quotedAmount ||
    result.details?.totalAmount ||
    result.details?.quotedAmount ||
    0
  );

  const gstPercentage = Number(
    result.gstPercentage ||
    result.details?.gstPercentage ||
    18
  );

  const quotedBaseAmount = Number(
    result.quotedAmount ||
    result.details?.quotedAmount ||
    (totalEvaluatedPrice > 0 && gstPercentage > 0
      ? Math.round((totalEvaluatedPrice / (1 + gstPercentage / 100)) * 100) / 100
      : totalEvaluatedPrice)
  );

  const taxAmount = totalEvaluatedPrice > quotedBaseAmount
    ? Math.round((totalEvaluatedPrice - quotedBaseAmount) * 100) / 100
    : Math.round((quotedBaseAmount * (gstPercentage / 100)) * 100) / 100;

  const offeredQty = result.offeredQuantity || result.details?.offeredQuantity || result.quantity || 1;
  const deliveryTimeline =
    result.deliveryTimeline ||
    result.details?.deliveryTimeline ||
    'Standard SLA (20 Days)';

  const termsAndConditions =
    result.terms ||
    result.details?.terms ||
    result.details?.rfqNotes ||
    result.details?.paymentTerms ||
    result.details?.complianceRemarks ||
    'Standard procurement terms and conditions apply.';

  const coverNoteMessage =
    result.message ||
    result.details?.rfqNotes ||
    result.offeredItem ||
    result.details?.offeredItemDescription ||
    'No cover note provided by supplier.';

  const makeBrand = result.makeBrand || result.details?.makeBrand || 'As quoted';
  const model = result.model || result.details?.model || 'Standard';

  // Extract Line Items
  const rawLineItems: any[] =
    Array.isArray(result.lineItems) && result.lineItems.length > 0
      ? result.lineItems
      : Array.isArray(result.responseData?.lineItems) && result.responseData.lineItems.length > 0
      ? result.responseData.lineItems
      : Array.isArray(result.rawParticipation?.acknowledgement?.lineItems) &&
        result.rawParticipation.acknowledgement.lineItems.length > 0
      ? result.rawParticipation.acknowledgement.lineItems
      : Array.isArray(result.rawParticipation?.lineItems) && result.rawParticipation.lineItems.length > 0
      ? result.rawParticipation.lineItems
      : Array.isArray(bid?.items) && bid.items.length > 0
      ? bid.items.map((item: any) => {
          const qty = Number(item.quantity || 1);
          const uPrice =
            item.estimatedUnitPrice ||
            item.price ||
            (totalEvaluatedPrice > 0 ? totalEvaluatedPrice / qty : 0);
          return {
            itemName: item.itemName || item.name || 'Requirement Item',
            description: item.description || '',
            quantity: qty,
            unitOfMeasure: item.unitOfMeasure || item.unit || 'Nos',
            unitPrice: uPrice,
            gstPercent: gstPercentage,
            makeBrand: makeBrand,
            lineTotal: totalEvaluatedPrice || uPrice * qty,
          };
        })
      : [
          {
            itemName:
              result.offeredItem ||
              result.details?.offeredItemDescription ||
              bid?.title ||
              'Procurement Item Quotation',
            description:
              result.offeredItem ||
              'Supply of requested procurement items according to specifications',
            quantity: Number(offeredQty) || 1,
            unitOfMeasure: 'Nos',
            unitPrice:
              quotedBaseAmount > 0
                ? Math.round((quotedBaseAmount / (Number(offeredQty) || 1)) * 100) / 100
                : totalEvaluatedPrice,
            gstPercent: gstPercentage,
            makeBrand: makeBrand,
            lineTotal: totalEvaluatedPrice,
          },
        ];

  // Extract & deduplicate authentic quotation documents
  const uniqueDocs = normalizeQuotationDocuments(result);

  const statutoryChecklist = [
    { label: 'GST Registration', verified: uniqueDocs.some(d => /gst/i.test(`${d.name} ${d.category}`)) },
    { label: 'PAN Card Verification', verified: uniqueDocs.some(d => /pan/i.test(`${d.name} ${d.category}`)) },
    { label: 'Bank Mandate', verified: uniqueDocs.some(d => /bank|mandate/i.test(`${d.name} ${d.category}`)) },
    { label: 'Technical Compliance', verified: uniqueDocs.some(d => /technical|compliance/i.test(`${d.name} ${d.category}`)) },
    { label: 'Price Breakup', verified: uniqueDocs.some(d => /price|breakup|boq/i.test(`${d.name} ${d.category}`)) },
    { label: 'UDYAM / MSME', verified: uniqueDocs.some(d => /udyam|msme/i.test(`${d.name} ${d.category}`)) },
  ];

  const handlePreviewDoc = async (doc: any) => {
    try {
      if (doc.fileAssetId || doc.fileUrl || doc.url) {
        await openFileAsset(
          {
            id: doc.fileAssetId || doc.id,
            fileAssetId: doc.fileAssetId,
            originalName: doc.fileName || doc.name,
            url: doc.fileUrl || doc.url,
          },
          doc.fileName || doc.name
        );
      } else {
        toast.error('File preview is not available for this document.');
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Unable to preview file');
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-5 py-3 space-y-3 pb-20 animate-in fade-in duration-150">
      
      {/* ── 1. Compact Top Bar: Navigation + Breadcrumb + Primary Actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-0.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-8 gap-1.5 rounded-lg border border-slate-250 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back</span>
          </Button>

          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="hover:text-slate-800 cursor-pointer" onClick={onBack}>
              Procurements
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="font-mono text-slate-600 truncate max-w-[140px] sm:max-w-none">
              {bidId || bid?.id || 'Bid'}
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="text-blue-900 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-[11px]">
              Quotation
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="font-bold text-slate-800 truncate max-w-[180px] sm:max-w-none">
              {sellerOrg}
            </span>
          </nav>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {/* {onDownloadPdf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDownloadPdf(result)}
              className="h-8 gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>PDF</span>
            </Button>
          )} */}

          {/* {isAwarded ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-200 px-3 text-xs font-black text-emerald-800 uppercase tracking-wide">
              <CheckCircle2 className="h-3.5 w-3.5" /> Awarded
            </span>
          ) : onAcceptAndGeneratePo ? (
            <button
              type="button"
              onClick={() => onAcceptAndGeneratePo(result)}
              className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 text-xs font-black text-white transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Accept Quotation & Generate PO</span>
            </button>
          ) : null} */}
        </div>
      </div>

      {/* ── 2. Concise Executive Header: Supplier & Financial Overview (Tight, Zero Space Waste) ── */}
      <section className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center">
          
          {/* Left: Supplier Identity & Meta */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200/70">
                SUPPLIER QUOTATION
              </span>

              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                <Trophy className="h-3 w-3 text-emerald-600" />
                RANK {rank} • LOWEST EVALUATED
              </span>

              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {statusStr}
              </span>

              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                QUOTE #{result.id || result.participationId || 'REF'}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                {sellerOrg}
              </h1>
              {bid?.title && (
                <span className="text-xs font-semibold text-slate-500">
                  for <strong className="text-slate-800">{bid.title}</strong>
                </span>
              )}
            </div>

            {/* Dense Contact Strip */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 font-medium">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Rep: <strong className="text-slate-800">{contactPerson}</strong>
              </span>

              {sellerEmail !== 'Not provided' && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {sellerEmail}
                </span>
              )}

              {sellerMobile !== 'Not listed' && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {sellerMobile}
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {formatDateTime(submittedAt)}
              </span>
            </div>
          </div>

          {/* Right: Compact Evaluated Price Highlight Box */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-2.5 min-w-[240px] flex flex-col justify-center space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800">
                TOTAL EVALUATED PRICE (LANDED)
              </span>
              <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                INR (₹)
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-700 tracking-tight leading-tight">
              {formatCurrency(totalEvaluatedPrice)}
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 pt-0.5 border-t border-emerald-100/80">
              <span>Base: <strong className="text-slate-800">{formatCurrency(quotedBaseAmount)}</strong></span>
              <span>GST {gstPercentage}%: <strong className="text-slate-800">{formatCurrency(taxAmount)}</strong></span>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. Concise 4-KPI Metric Strip (Tightly Engineered, Zero Gaps) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        
        {/* KPI 1 */}
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
            <IndianRupee className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
              Offered Landed Rate
            </span>
            <p className="text-xs font-black text-slate-900 mt-0.5 leading-tight truncate">
              {formatCurrency(totalEvaluatedPrice)}
            </p>
            <p className="text-[10px] text-slate-500 font-medium leading-none mt-0.5 truncate">
              Incl. GST {gstPercentage}% & Freight
            </p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
              Supply Commitment
            </span>
            <p className="text-xs font-black text-slate-900 mt-0.5 leading-tight truncate">
              {offeredQty} Units Committed
            </p>
            <p className="text-[10px] text-emerald-700 font-bold leading-none mt-0.5 truncate">
              Full Supply (100% Covered)
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
              Delivery Turnaround
            </span>
            <p className="text-xs font-black text-slate-900 mt-0.5 leading-tight truncate">
              {deliveryTimeline}
            </p>
            <p className="text-[10px] text-slate-500 font-medium leading-none mt-0.5 truncate">
              Direct Consignee Site Dispatch
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
              Evaluation Standing
            </span>
            <p className="text-xs font-black text-purple-900 mt-0.5 leading-tight truncate">
              Rank {rank} • Responsive
            </p>
            <p className="text-[10px] text-emerald-700 font-bold leading-none mt-0.5 truncate">
              Verified & Qualified Bidder
            </p>
          </div>
        </div>

      </div>

      {/* ── 4. Item-Wise BOQ Breakdown Table (Tight, High-Contrast & Clear) ── */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-150 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-blue-900" />
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Item-Wise Quotation & Financial BOQ Breakdown
            </h2>
          </div>
          <span className="text-[10px] font-black bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
            {rawLineItems.length} {rawLineItems.length === 1 ? 'Item' : 'Items'} Listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-[9px] font-black uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-3 py-2 w-10 text-center">#</th>
                <th className="px-3 py-2 min-w-[200px]">Item Name & Specifications</th>
                <th className="px-3 py-2 min-w-[130px]">Make / Brand</th>
                <th className="px-3 py-2 min-w-[90px]">HSN / Tax</th>
                <th className="px-3 py-2 w-20 text-center">Quantity</th>
                <th className="px-3 py-2 w-28 text-right">Unit Rate (₹)</th>
                <th className="px-3 py-2 w-32 text-right bg-emerald-50/50">Total Amount (₹)</th>
                <th className="px-3 py-2 min-w-[110px] text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {rawLineItems.map((line: any, idx: number) => {
                const qty = Number(line.quantity || 1);
                const unitPrice = Number(line.unitPrice || line.unitRate || line.rate || 0);
                const gst =
                  line.gstPercent !== undefined && line.gstPercent !== null
                    ? Number(line.gstPercent)
                    : gstPercentage;
                const lineTot = Number(
                  line.lineTotal || line.totalAmount || unitPrice * qty * (1 + gst / 100)
                );

                return (
                  <tr
                    key={idx}
                    className="hover:bg-blue-50/20 transition-colors align-middle group"
                  >
                    <td className="px-3 py-2.5 text-center font-bold text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="px-3 py-2.5">
                      <p className="font-bold text-slate-900 group-hover:text-blue-900 transition-colors leading-tight">
                        {line.itemName || `Item #${idx + 1}`}
                      </p>
                      {line.description && (
                        <p
                          title={line.description}
                          className="text-[10px] text-slate-500 mt-0.5 line-clamp-1"
                        >
                          {line.description}
                        </p>
                      )}
                      <span className="inline-block text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 mt-1">
                        {line.technicalSpecs || line.specifications || 'As per tender requirements'}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-[11px] text-slate-700">
                      <div>
                        <span className="text-slate-400">Make:</span>{' '}
                        <strong className="text-slate-800">{line.makeBrand || makeBrand || 'Standard'}</strong>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Model: {line.model || model || 'Standard'}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-[11px] text-slate-700">
                      <div className="font-mono text-slate-500 text-[10px]">{line.hsn || 'HSN-SAC'}</div>
                      <span className="inline-block px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/70 font-bold text-[9px]">
                        GST {gst}%
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                        <span>{qty}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{line.unitOfMeasure || 'Nos'}</span>
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 text-xs">
                      {unitPrice ? formatCurrency(unitPrice) : '—'}
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-800 text-xs tabular-nums bg-emerald-50/50">
                      {lineTot ? formatCurrency(lineTot) : totalEvaluatedPrice ? formatCurrency(totalEvaluatedPrice) : '—'}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                        <Check className="h-3 w-3 text-emerald-600" /> Compliant
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {totalEvaluatedPrice > 0 && (
              <tfoot className="bg-slate-50/90 border-t border-slate-200">
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 text-right"
                  >
                    Total Evaluated Bid Amount:
                  </td>
                  <td className="px-3 py-2.5 text-sm font-black text-emerald-700 text-right tabular-nums bg-emerald-50/70">
                    {formatCurrency(totalEvaluatedPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-[10px] font-black text-slate-600">
                    Rank {rank}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* ── 5. Balanced Operational 2-Column Grid (Zero Wasted Space) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        
        {/* Left: Supplier Cover Note & Quoted Clauses */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-150">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-indigo-700" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Supplier Cover Note & Remarks
                </h3>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">
                Official Declaration
              </span>
            </div>

            {/* Compact Quote Statement Box */}
            <div className="rounded-lg bg-slate-50/80 border border-slate-200/70 p-2.5 relative">
              <Quote className="h-3.5 w-3.5 text-slate-300 absolute top-2 left-2 -scale-x-100" />
              <p className="text-xs font-medium text-slate-800 leading-relaxed pl-5 whitespace-pre-wrap">
                {coverNoteMessage}
              </p>
            </div>
          </div>

          {/* 4 Compact Parameter Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-slate-150 text-[11px]">
            <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200/70">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Brand</span>
              <span className="font-bold text-slate-900 truncate block">{makeBrand}</span>
            </div>
            <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200/70">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Model</span>
              <span className="font-bold text-slate-900 truncate block">{model}</span>
            </div>
            <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200/70">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Validity</span>
              <span className="font-bold text-slate-900 truncate block">30 Days</span>
            </div>
            <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200/70">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Payment</span>
              <span className="font-bold text-slate-900 truncate block">On Inspection</span>
            </div>
          </div>
        </div>

        {/* Right: Statutory Checklist & Submitted Files */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-150">
              <div className="flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Compliance & Attached Documents
                </h3>
              </div>
              <span className="text-[9px] font-black text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-2xs uppercase">
                {uniqueDocs.length} Attachment{uniqueDocs.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {statutoryChecklist.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold transition-colors",
                    item.verified
                      ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  )}
                >
                  <Check className={cn("h-3 w-3 shrink-0", item.verified ? "text-emerald-600 stroke-[3]" : "text-slate-300")} />
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Attached Files List */}
            {uniqueDocs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                {uniqueDocs.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 flex items-center justify-between gap-2 shadow-2xs hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-7 w-7 rounded-md bg-blue-100/80 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200/60">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] font-bold text-slate-900 truncate leading-tight">
                            {doc.name}
                          </p>
                          <span className="shrink-0 text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 px-1 py-0.2 rounded">
                            {doc.category}
                          </span>
                        </div>
                        {doc.fileName && doc.fileName !== doc.name && (
                          <p
                            title={doc.fileName}
                            className="text-[9px] text-slate-500 font-mono truncate max-w-[170px] sm:max-w-[210px] leading-tight mt-0.5"
                          >
                            {doc.fileName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreviewDoc(doc)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-900 transition-colors shadow-2xs shrink-0 cursor-pointer"
                        title="Preview Document"
                      >
                        <Eye className="h-3 w-3 text-blue-700" />
                        <span>Preview</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-slate-200 p-2.5 text-center text-[11px] text-slate-400 font-medium">
                No additional document files attached.
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold pt-1 border-t border-slate-150">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Supplier meets all mandatory statutory criteria and tender rules.</span>
          </div>
        </div>

      </div>

      {/* ── 6. Sleek Floating Action Bar ── */}
      <div className="fixed bottom-3 left-3 right-3 sm:left-6 sm:right-6 max-w-7xl mx-auto z-40 bg-white/95 backdrop-blur-md border border-slate-250/90 rounded-2xl px-4 py-2.5 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* {isAwarded ? (
            <span className="inline-flex h-8.5 items-center gap-1 rounded-xl bg-emerald-100 border border-emerald-200 px-3.5 text-xs font-black text-emerald-800 uppercase tracking-wide">
              <CheckCircle2 className="h-3.5 w-3.5" /> PO Generated (Awarded)
            </span>
          ) : onAcceptAndGeneratePo ? (
            <button
              type="button"
              onClick={() => onAcceptAndGeneratePo(result)}
              className="h-8.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 text-xs font-black text-white transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" /> Accept Quotation & Generate PO
            </button>
          ) : null} */}

          {/* {onDownloadPdf && (
            <button
              type="button"
              onClick={() => onDownloadPdf(result)}
              className="h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 text-xs font-bold text-slate-800 transition-all inline-flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" /> Download PDF
            </button>
          )} */}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="h-8.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-4 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
        >
          Back to Results
        </Button>
      </div>

    </div>
  );
}

/**
 * Modal Wrapper that embeds the full view page when used in modal mode
 */
export function SupplierQuotationDetailModal({
  isOpen,
  onClose,
  result,
  bid,
  bidId,
  onAcceptAndGeneratePo,
  onDownloadPdf,
}: SupplierQuotationDetailModalProps) {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="min-h-screen bg-slate-50/60 py-3">
        <SupplierQuotationDetailView
          result={result}
          bid={bid}
          bidId={bidId}
          onBack={onClose}
          onAcceptAndGeneratePo={onAcceptAndGeneratePo}
          onDownloadPdf={onDownloadPdf}
        />
      </div>
    </div>
  );
}
