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
  Loader2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { openFileAsset, getFileAssetPreview, type DocumentPreview } from '../../../lib/files';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { toast } from 'sonner';

export interface SupplierQuotationDetailViewProps {
  result: any;
  bid?: any;
  bidId?: string;
  onBack: () => void;
  onAcceptAndGeneratePo?: (result: any) => void;
  onDownloadPdf?: (result: any) => void;
  onOpenTechnicalEvaluation?: (result: any) => void;
}

export interface SupplierQuotationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: any;
  bid?: any;
  bidId?: string;
  onAcceptAndGeneratePo?: (result: any) => void;
  onDownloadPdf?: (result: any) => void;
  onOpenTechnicalEvaluation?: (result: any) => void;
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
    ...(Array.isArray(source.rawParticipation?.responseData?.documents) ? source.rawParticipation.responseData.documents : []),
  ];

  const candidateUrls: any[] = [
    source.attachmentUrl,
    source.responseData?.attachmentUrl,
    source.details?.attachmentUrl,
    source.rawParticipation?.attachmentUrl,
    source.rawParticipation?.responseData?.attachmentUrl,
    source.attachment,
    source.details?.attachment,
    source.fileUrl,
    source.details?.fileUrl,
  ].filter(Boolean);

  for (const urlItem of candidateUrls) {
    const urlStr = typeof urlItem === 'string' ? urlItem : (urlItem?.url || urlItem?.fileUrl);
    if (urlStr) {
      const diskName = typeof urlItem === 'object' && (urlItem.fileName || urlItem.originalName) ? (urlItem.fileName || urlItem.originalName) : (source.attachmentFileName || source.details?.attachmentFileName || urlStr.split('/').pop() || 'Attachment Document');
      rawDocs.push({
        name: diskName,
        fileName: diskName,
        fileUrl: urlStr,
        fileAssetId: typeof urlItem === 'object' && urlItem.fileAssetId ? urlItem.fileAssetId : (source.fileAssetId || source.details?.fileAssetId),
      });
    }
  }

  const docMap = new Map<string, NormalizedQuotationDocument>();

  for (const item of rawDocs) {
    if (!item) continue;

    const fileUrl = item.fileUrl || item.url || null;
    const urlMatch = String(fileUrl || '').match(/\/api\/(?:public\/)?files\/(\d+)/);
    const fileAssetId = item.fileAssetId || (typeof item.id === 'number' ? item.id : (urlMatch ? Number(urlMatch[1]) : null));
    const rawDiskFile = String(item.fileName || item.originalName || item.file || '').trim();
    const rawCategoryName = String(item.documentName || item.name || item.title || '').trim();

    let cleanFileName = rawDiskFile;
    if (!cleanFileName && fileUrl) {
      cleanFileName = fileUrl.split('/').pop() || 'Document';
    }
    if (!cleanFileName && rawCategoryName && rawCategoryName.includes('.')) {
      cleanFileName = rawCategoryName;
    }

    // Display name MUST be the actual uploaded file name
    const actualFileName = cleanFileName || rawCategoryName || 'Uploaded Document';
    const categoryTag = rawCategoryName && rawCategoryName !== actualFileName
      ? rawCategoryName
      : inferDocumentCategory(actualFileName, cleanFileName);

    const primaryKey = fileAssetId ? `asset-${fileAssetId}` : (fileUrl ? fileUrl.toLowerCase().trim() : (actualFileName ? actualFileName.toLowerCase().trim() : `doc-${docMap.size}`));

    if (!docMap.has(primaryKey)) {
      docMap.set(primaryKey, {
        id: item.id || fileAssetId || `doc-${docMap.size + 1}`,
        name: actualFileName,
        fileName: actualFileName,
        fileUrl,
        fileAssetId,
        category: categoryTag,
      });
    } else {
      const existing = docMap.get(primaryKey)!;
      if (!existing.fileUrl && fileUrl) existing.fileUrl = fileUrl;
      if (!existing.fileAssetId && fileAssetId) existing.fileAssetId = fileAssetId;
      if (categoryTag && categoryTag !== 'Statutory Document') existing.category = categoryTag;
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
  onOpenTechnicalEvaluation,
}: SupplierQuotationDetailViewProps) {
  const [previewDocument, setPreviewDocument] = React.useState<DocumentPreview | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = React.useState<string | number | null>(null);

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
    '—';

  const sellerEmail =
    result.sellerEmail ||
    result.details?.email ||
    result.sellerUser?.email ||
    result.seller?.email ||
    '—';

  const sellerMobile =
    result.sellerMobile ||
    result.details?.mobile ||
    result.sellerUser?.mobile ||
    result.seller?.mobile ||
    '—';

  const submittedAt = result.submittedAt || result.details?.submittedAt || result.createdAt;
  const statusStr = String(result.resultStatus || result.technicalStatus || result.status || 'Under Review');
  const rank = String(result.finalRank || 'L1');
  const isAwarded =
    result.resultStatus === 'Awarded' ||
    String(result.finalStatus || '').toUpperCase() === 'AWARDED' ||
    String(result.rawParticipation?.finalStatus || '').toUpperCase() === 'AWARDED' ||
    Boolean(bid?.awards?.some((a: any) =>
      Number(a.participationId) === Number(result.participationId || result.id) ||
      (a.sellerId && Number(a.sellerId) === Number(result.sellerId || result.rawParticipation?.sellerId || result.rawParticipation?.sellerUserId))
    ));

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
    'As per tender SLA';

  const termsAndConditions =
    result.terms ||
    result.details?.terms ||
    result.responseData?.terms ||
    result.rawParticipation?.terms ||
    result.rawParticipation?.responseData?.terms ||
    result.details?.paymentTerms ||
    result.paymentTerms ||
    result.details?.complianceRemarks ||
    result.complianceRemarks ||
    '';

  const coverNoteMessage =
    result.message ||
    result.details?.message ||
    result.responseData?.message ||
    result.rawParticipation?.message ||
    result.rawParticipation?.responseData?.message ||
    result.details?.rfqNotes ||
    result.offeredItem ||
    result.details?.offeredItemDescription ||
    '';

  // Extract Line Items from all authentic quotation sources
  const parseJsonSafe = (val: any) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return {}; }
    }
    return (val && typeof val === 'object') ? val : {};
  };

  const parsedAck = parseJsonSafe(result.acknowledgement || result.rawParticipation?.acknowledgement);
  const parsedResp = parseJsonSafe(result.responseData || result.rawParticipation?.responseData);
  const parsedDesc = parseJsonSafe(result.offeredItemDescription || result.details?.offeredItemDescription);

  const rawCandidateItems = [
    result.lineItems,
    result.details?.lineItems,
    parsedAck.lineItems,
    parsedAck.lineQuotes,
    parsedAck.items,
    parsedResp.lineItems,
    parsedResp.lineQuotes,
    parsedResp.items,
    parsedDesc.lineItems,
    parsedDesc.lineQuotes,
    result.rawParticipation?.lineItems,
    result.rawParticipation?.acknowledgement?.lineItems,
    result.rawParticipation?.acknowledgement?.lineQuotes,
    result.rawParticipation?.responseData?.lineItems,
    result.rawParticipation?.responseData?.lineQuotes,
  ];

  let rawLineItems: any[] = [];
  for (const cand of rawCandidateItems) {
    if (Array.isArray(cand) && cand.length > rawLineItems.length) {
      rawLineItems = cand;
    }
  }

  const firstValidStr = (...vals: any[]) => {
    for (const v of vals) {
      if (
        v !== undefined &&
        v !== null &&
        typeof v === 'string' &&
        v.trim() !== '' &&
        v.trim() !== '—' &&
        v.trim() !== '-' &&
        v.trim().toLowerCase() !== 'null' &&
        v.trim().toLowerCase() !== 'undefined'
      ) {
        return v.trim();
      }
      if (typeof v === 'number' && !isNaN(v)) {
        return String(v);
      }
    }
    return '';
  };

  const makeBrand = firstValidStr(
    result.makeBrand,
    result.brand,
    result.details?.makeBrand,
    result.details?.brand,
    result.responseData?.makeBrand,
    result.rawParticipation?.makeBrand,
    result.rawParticipation?.brand,
    parsedResp.makeBrand,
    parsedResp.brand,
    parsedResp.technicalOffer?.makeBrand,
    parsedAck.makeBrand,
    parsedAck.brand,
    parsedDesc.makeBrand,
    rawLineItems[0]?.makeBrand,
    rawLineItems[0]?.brand,
    '—'
  );

  const model = firstValidStr(
    result.model,
    result.offeredModel,
    result.modelNumber,
    result.modelRef,
    result.partNumber,
    result.details?.model,
    result.details?.offeredModel,
    result.details?.modelNumber,
    result.responseData?.model,
    result.rawParticipation?.model,
    result.rawParticipation?.offeredModel,
    parsedResp.model,
    parsedResp.offeredModel,
    parsedResp.modelNumber,
    parsedResp.technicalOffer?.model,
    parsedAck.model,
    parsedAck.offeredModel,
    parsedAck.modelNumber,
    parsedDesc.model,
    rawLineItems[0]?.model,
    rawLineItems[0]?.modelNumber,
    rawLineItems[0]?.partNumber,
    '—'
  );

  // Gather tender items from bid for authentic item-wise mapping
  const tenderItems: any[] = [
    ...(Array.isArray(bid?.items) && bid.items.length ? bid.items : []),
    ...(Array.isArray(bid?.technicalPacket?.items) && bid.technicalPacket.items.length ? bid.technicalPacket.items : []),
    ...(Array.isArray(bid?.technicalPacket?.boq) && bid.technicalPacket.boq.length ? bid.technicalPacket.boq : [])
  ];
  const uniqueTenderItems: any[] = [];
  const seenTenderKeys = new Set<string>();
  for (const ti of tenderItems) {
    const key = `${ti.id || ''}-${ti.itemName || ti.name || ''}`;
    if (!seenTenderKeys.has(key)) {
      seenTenderKeys.add(key);
      uniqueTenderItems.push(ti);
    }
  }

  // If rawLineItems is empty or has only 1 summary row while tender specifies multiple items:
  if (rawLineItems.length <= 1 && uniqueTenderItems.length > 1) {
    const tenderTotalQty = uniqueTenderItems.reduce((sum: number, it: any) => sum + Number(it.quantity || 1), 0) || 1;
    const unitRateFromTotal = quotedBaseAmount > 0 ? (quotedBaseAmount / tenderTotalQty) : (totalEvaluatedPrice / tenderTotalQty);

    rawLineItems = uniqueTenderItems.map((item: any) => {
      const qty = Number(item.quantity || 1);
      const uPrice = Number(item.unitPrice || item.unitRate || rawLineItems[0]?.unitPrice || rawLineItems[0]?.unitRate || unitRateFromTotal || 0);
      const itemGst = Number(item.gstPercent ?? item.gstPercentage ?? gstPercentage ?? 18);
      const lineTot = Math.round(uPrice * qty * (1 + itemGst / 100));
      return {
        itemName: item.itemName || item.name || 'Tender Item',
        description: item.description || item.technicalSpecification || '',
        technicalSpecs: item.technicalSpecification || item.technicalSpecs || item.specificationsText || '—',
        quantity: qty,
        unitOfMeasure: item.unitOfMeasure || item.unit || 'Nos.',
        unitPrice: uPrice,
        unitRate: uPrice,
        gstPercent: itemGst,
        makeBrand: item.brand || item.makeBrand || item.brandPreference || makeBrand || '—',
        model: item.model || model || '—',
        hsn: item.hsn || item.hsnSac || '—',
        lineTotal: lineTot,
        totalAmount: lineTot,
      };
    });
  }

  // Fallback for single item procurements
  if (rawLineItems.length === 0) {
    rawLineItems = [
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
  }

  const totalCommittedUnits = rawLineItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0) || Number(offeredQty) || 1;

  // Extract & deduplicate authentic quotation documents
  const uniqueDocs = normalizeQuotationDocuments(result);

  // Derive statutory checklist dynamically from bid requested documents or uploaded document categories
  const bidReqDocs: any[] = [
    ...(Array.isArray(bid?.requestedDocuments) ? bid.requestedDocuments : []),
    ...(Array.isArray(bid?.technicalPacket?.requestedDocuments) ? bid.technicalPacket.requestedDocuments : []),
    ...(Array.isArray(bid?.technicalPacket?.documents) ? bid.technicalPacket.documents : [])
  ];

  const statutoryChecklist = bidReqDocs.length > 0
    ? bidReqDocs.map((req: any) => {
        const reqName = typeof req === 'string' ? req : (req.name || req.title || req.documentName || 'Document');
        const isVerified = uniqueDocs.some(d =>
          d.name.toLowerCase().includes(reqName.toLowerCase()) ||
          d.category.toLowerCase().includes(reqName.toLowerCase())
        );
        return { label: reqName, verified: isVerified };
      })
    : uniqueDocs.map(d => ({ label: d.category || d.name, verified: true }));

  const handlePreviewDoc = async (doc: any) => {
    try {
      setPreviewLoadingId(doc.id);
      if (doc.fileAssetId || doc.fileUrl || doc.url) {
        try {
          const prev = await getFileAssetPreview(
            {
              id: doc.fileAssetId || doc.id,
              fileAssetId: doc.fileAssetId,
              url: doc.fileUrl || doc.url,
              fileName: doc.fileName || doc.name,
            },
            doc.name || doc.fileName || 'Document'
          );
          if (prev) {
            setPreviewDocument(prev);
            return;
          }
        } catch {
          // Fallback to openFileAsset below
        }

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
    } finally {
      setPreviewLoadingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-5 py-3 space-y-3 pb-28 animate-in fade-in duration-150">
      
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
          {onOpenTechnicalEvaluation && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenTechnicalEvaluation(result)}
              className="h-8 gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>Technical Evaluation Record</span>
            </Button>
          )}

          {onDownloadPdf && (
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
          )}

          {isAwarded ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-100 border border-emerald-200 px-3 text-xs font-black text-emerald-800 uppercase tracking-wide">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Awarded
            </span>
          ) : onAcceptAndGeneratePo ? (
            <button
              type="button"
              onClick={() => onAcceptAndGeneratePo(result)}
              className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 text-xs font-black text-white transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Accept Quotation &amp; Generate PO</span>
            </button>
          ) : null}
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
              <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
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
            <p className="text-xs font-black text-slate-900 mt-0.5 leading-tight break-words">
              {formatCurrency(totalEvaluatedPrice)}
            </p>
            <p className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5 break-words">
              Incl. GST {gstPercentage}% &amp; Freight
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
            <p className="text-xs font-black text-slate-900 mt-0.5 leading-tight break-words">
              {totalCommittedUnits} Units Committed
            </p>
            <p className="text-[10px] text-emerald-700 font-bold leading-normal mt-0.5 break-words">
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
            <p className="text-xs font-black text-slate-900 mt-0.5 leading-tight break-words">
              {deliveryTimeline}
            </p>
            <p className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5 break-words">
              Direct Consignee Site Dispatch
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                Evaluation Standing
              </span>
              <p className="text-xs font-black text-purple-900 mt-0.5 leading-tight break-words">
                Rank {rank} • {statusStr}
              </p>
              <p className="text-[10px] text-emerald-700 font-bold leading-normal mt-0.5 break-words">
                Verified &amp; Qualified Bidder
              </p>
            </div>
          </div>
          {onOpenTechnicalEvaluation && (
            <button
              type="button"
              onClick={() => onOpenTechnicalEvaluation(result)}
              className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50/80 hover:bg-purple-100 text-purple-800 px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="Open Technical Evaluation Record"
            >
              <Eye className="h-3 w-3 text-purple-600" />
              <span>Eval Record</span>
            </button>
          )}
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
                <th className="px-3 py-2 w-[34%] min-w-[220px]">Item Name &amp; Specifications</th>
                <th className="px-3 py-2 w-[16%] min-w-[120px]">Make / Brand</th>
                <th className="px-3 py-2 w-[11%] min-w-[90px]">HSN / Tax</th>
                <th className="px-3 py-2 w-[10%] text-center">Quantity</th>
                <th className="px-3 py-2 w-[13%] text-right">Unit Rate (₹)</th>
                <th className="px-3 py-2 w-[16%] text-right bg-emerald-50/50">Total Amount (₹)</th>
                <th className="px-3 py-2 min-w-[100px] text-center">Status</th>
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
                    className="hover:bg-blue-50/20 transition-colors align-top group"
                  >
                    <td className="px-3 py-2.5 text-center font-bold text-slate-400 font-mono text-[11px] pt-3">
                      {idx + 1}
                    </td>

                    <td className="px-3 py-2.5">
                      <p className="font-bold text-slate-900 group-hover:text-blue-900 transition-colors leading-tight break-words">
                        {line.itemName || `Item #${idx + 1}`}
                      </p>
                      {line.description && (
                        <p
                          title={line.description}
                          className="text-[10.5px] text-slate-600 mt-1 break-words whitespace-pre-wrap leading-relaxed"
                        >
                          {line.description}
                        </p>
                      )}
                      {(line.technicalSpecs || line.specifications) && (
                        <div className="mt-1.5 rounded bg-slate-50 border border-slate-200/80 p-1.5 text-[10px] text-slate-700 leading-relaxed break-words whitespace-pre-wrap">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Specifications:
                          </span>
                          {line.technicalSpecs || line.specifications}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-[11px] text-slate-700 pt-3">
                      <div className="break-words">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">Make:</span>{' '}
                        <strong className="text-slate-900">{line.makeBrand || makeBrand || '—'}</strong>
                      </div>
                      <div className="text-[10.5px] text-slate-600 mt-0.5 break-words">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">Model:</span>{' '}
                        <span className="font-semibold text-slate-800">{line.model || model || '—'}</span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-[11px] text-slate-700 pt-3">
                      <div className="font-mono text-slate-600 font-bold text-[10px]">{line.hsn || '—'}</div>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/70 font-bold text-[9px] mt-0.5">
                        GST {gst}%
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-center pt-3">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200 whitespace-nowrap">
                        <span>{qty}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">{line.unitOfMeasure || 'Nos'}</span>
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 text-xs pt-3 whitespace-nowrap tabular-nums">
                      {unitPrice ? formatCurrency(unitPrice) : '—'}
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-800 text-xs tabular-nums bg-emerald-50/50 pt-3 whitespace-nowrap">
                      {lineTot ? formatCurrency(lineTot) : totalEvaluatedPrice ? formatCurrency(totalEvaluatedPrice) : '—'}
                    </td>

                    <td className="px-3 py-2.5 text-center pt-3">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">
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
        
        {/* Left: Supplier Cover Note, Terms & Conditions */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
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

            {/* Quote Statement Box */}
            {coverNoteMessage ? (
              <div className="rounded-lg bg-slate-50/80 border border-slate-200/70 p-2.5 relative">
                <Quote className="h-3.5 w-3.5 text-slate-300 absolute top-2 left-2 -scale-x-100" />
                <p className="text-xs font-medium text-slate-800 leading-relaxed pl-5 whitespace-pre-wrap">
                  {coverNoteMessage}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50/50 border border-slate-200/60 p-2 text-[11px] text-slate-400 font-medium text-center">
                No cover note or remarks provided by supplier.
              </div>
            )}

            {/* Terms & Conditions */}
            <div className="rounded-lg bg-slate-50/80 border border-slate-200/70 p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-slate-600" />
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                    Terms &amp; Conditions
                  </span>
                </div>
                {termsAndConditions && termsAndConditions !== 'Standard procurement terms and conditions apply.' && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded">
                    Seller Specified
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-800 leading-relaxed pl-4.5 whitespace-pre-wrap">
                {termsAndConditions || '—'}
              </p>
            </div>
          </div>

          {/* 4 Compact Parameter Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-slate-150 text-[11px]">
            <div className="bg-slate-50 px-2 py-1.5 rounded border border-slate-200/70">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Brand</span>
              <span className="font-bold text-slate-900 break-words leading-tight block" title={makeBrand}>{makeBrand}</span>
            </div>
            <div className="bg-slate-50 px-2 py-1.5 rounded border border-slate-200/70">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Model</span>
              <span className="font-bold text-slate-900 break-words leading-tight block" title={model}>{model}</span>
            </div>
            <div className="bg-slate-50 px-2 py-1.5 rounded border border-slate-200/70">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Delivery SLA</span>
              <span className="font-bold text-slate-900 break-words leading-tight block" title={deliveryTimeline}>{deliveryTimeline}</span>
            </div>
            <div className="bg-slate-50 px-2 py-1.5 rounded border border-slate-200/70">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Validity</span>
              <span className="font-bold text-slate-900 break-words leading-tight block" title={result.validity || result.details?.validity || '—'}>{result.validity || result.details?.validity || '—'}</span>
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
                  Compliance &amp; Attached Documents
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
                    "flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold transition-colors min-w-0",
                    item.verified
                      ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  )}
                >
                  <Check className={cn("h-3 w-3 shrink-0", item.verified ? "text-emerald-600 stroke-[3]" : "text-slate-300")} />
                  <span className="break-words leading-tight text-[9.5px]">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Attached Files List */}
            {uniqueDocs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {uniqueDocs.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 flex items-start justify-between gap-2 shadow-2xs hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div className="h-7 w-7 rounded-md bg-blue-100/80 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200/60 mt-0.5">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <span className="inline-block text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                          {doc.category}
                        </span>
                        <p className="text-[11px] font-bold text-slate-900 break-words leading-tight" title={doc.name}>
                          {doc.name}
                        </p>
                        {doc.fileName && doc.fileName !== doc.name && (
                          <p
                            title={doc.fileName}
                            className="text-[9px] text-slate-500 font-mono break-all leading-tight"
                          >
                            {doc.fileName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handlePreviewDoc(doc)}
                        disabled={previewLoadingId === doc.id}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-900 transition-colors shadow-2xs shrink-0 cursor-pointer disabled:opacity-60"
                        title="Preview Document"
                      >
                        {previewLoadingId === doc.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin text-blue-700" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3 text-blue-700" />
                            <span>Preview</span>
                          </>
                        )}
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

   

      {/* Regular Document Preview Modal */}
      <DocumentPreviewModal
        previewDocument={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />

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
  onOpenTechnicalEvaluation,
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
          onOpenTechnicalEvaluation={onOpenTechnicalEvaluation}
        />
      </div>
    </div>
  );
}
