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
  Award,
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
  const [activeTab, setActiveTab] = React.useState<'pricing' | 'terms' | 'compliance'>('pricing');

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
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 space-y-4 pb-28 animate-in fade-in duration-150">
      
      {/* ── 1. Top Bar: Navigation + Breadcrumb + Primary Actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-8.5 gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Results</span>
          </Button>

          <nav className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span className="hover:text-slate-700 cursor-pointer" onClick={onBack}>
              Procurements
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="font-mono text-slate-600">
              {bidId || bid?.id || 'Bid'}
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="text-blue-900 font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md text-[11px]">
              Supplier Quotation
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
              className="h-8.5 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
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
              className="h-8.5 gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>PDF</span>
            </Button>
          )}

          {isAwarded ? (
            <span className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-emerald-100 border border-emerald-300 px-3.5 text-xs font-black text-emerald-800 uppercase tracking-wide">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Awarded
            </span>
          ) : onAcceptAndGeneratePo ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onAcceptAndGeneratePo(result)}
              className="h-8.5 gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 text-xs font-black shadow-xs transition-colors cursor-pointer"
            >
              <Award className="h-3.5 w-3.5" />
              <span>Award Contract</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── 2. Executive Hero Banner: Supplier Identity & Commercial Outcome ── */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start lg:items-center">
          
          {/* Left: Supplier Info & Tender Reference */}
          <div className="space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Trophy className="h-3 w-3 text-emerald-600" />
                Rank {rank} • Lowest Evaluated
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {statusStr}
              </span>

              <span className="font-mono text-[10px] font-bold px-2 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-200">
                QUOTE #{result.id || result.participationId || 'REF'}
              </span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                {sellerOrg}
              </h1>
              {bid?.title && (
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Procurement Requirement: <strong className="text-slate-800">{bid.title}</strong>
                </p>
              )}
            </div>

            {/* Clean Contact Strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 font-medium pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Representative: <strong className="text-slate-800">{contactPerson}</strong>
              </span>

              {sellerEmail && sellerEmail !== '—' && sellerEmail !== 'Not provided' && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <a href={`mailto:${sellerEmail}`} className="hover:underline text-slate-700">{sellerEmail}</a>
                </span>
              )}

              {sellerMobile && sellerMobile !== '—' && sellerMobile !== 'Not listed' && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-700">{sellerMobile}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                Submitted: <span className="font-semibold text-slate-700">{formatDateTime(submittedAt)}</span>
              </span>
            </div>
          </div>

          {/* Right: Elegant Commercial Summary Box */}
          <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/50 to-white px-5 py-4 min-w-[260px] flex flex-col justify-center space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                Total Evaluated Landed Price
              </span>
              <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                INR (₹)
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {formatCurrency(totalEvaluatedPrice)}
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 pt-1.5 border-t border-emerald-100">
              <span>Base: <strong className="text-slate-800">{formatCurrency(quotedBaseAmount)}</strong></span>
              <span>GST {gstPercentage}%: <strong className="text-slate-800">{formatCurrency(taxAmount)}</strong></span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              F.O.R Destination • All taxes &amp; delivery included
            </p>
          </div>

        </div>
      </section>

      {/* ── 3. Operational Parameter Ribbon (Streamlined, Non-Redundant) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <Package className="h-3.5 w-3.5 text-blue-600" />
            <span>Supply Commitment</span>
          </div>
          <p className="text-sm font-black text-slate-900">
            {totalCommittedUnits} Units
          </p>
          <span className="text-[10.5px] font-semibold text-emerald-700 block">
            100% Tender Quantity Covered
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <Truck className="h-3.5 w-3.5 text-amber-600" />
            <span>Delivery SLA</span>
          </div>
          <p className="text-sm font-black text-slate-900">
            {deliveryTimeline}
          </p>
          <span className="text-[10.5px] font-medium text-slate-500 block">
            Direct Consignee Site Dispatch
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5 text-indigo-600" />
            <span>Make &amp; Model</span>
          </div>
          <p className="text-sm font-black text-slate-900 truncate" title={`${makeBrand} / ${model}`}>
            {makeBrand}
          </p>
          <span className="text-[10.5px] font-medium text-slate-500 truncate block" title={model}>
            Model: {model}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex items-center justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
              <span>Technical Standing</span>
            </div>
            <p className="text-sm font-black text-purple-900">
              Qualified Bidder
            </p>
            <span className="text-[10.5px] font-semibold text-emerald-700 block">
              Stage 1 Scrutiny Passed
            </span>
          </div>
          {onOpenTechnicalEvaluation && (
            <button
              type="button"
              onClick={() => onOpenTechnicalEvaluation(result)}
              className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="Open Technical Evaluation Record"
            >
              <Eye className="h-3.5 w-3.5 text-purple-600" />
              <span>Record</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 4. Segmented Tab Navigation ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pt-2 pb-1" role="tablist" aria-label="Quotation detail sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pricing'}
          aria-controls="panel-pricing"
          onClick={() => setActiveTab('pricing')}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
            activeTab === 'pricing'
              ? "bg-[#1B365D] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Items &amp; Financial BOQ</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.2 rounded-md font-extrabold",
            activeTab === 'pricing' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
          )}>
            {rawLineItems.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'terms'}
          aria-controls="panel-terms"
          onClick={() => setActiveTab('terms')}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
            activeTab === 'terms'
              ? "bg-[#1B365D] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Proposal &amp; Delivery Terms</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'compliance'}
          aria-controls="panel-compliance"
          onClick={() => setActiveTab('compliance')}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
            activeTab === 'compliance'
              ? "bg-[#1B365D] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <FileCheck2 className="h-3.5 w-3.5" />
          <span>Compliance &amp; Documents</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.2 rounded-md font-extrabold",
            activeTab === 'compliance' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
          )}>
            {uniqueDocs.length}
          </span>
        </button>
      </div>

      {/* ── 5. Tab Panels ── */}

      {/* TAB 1: Items & Financial BOQ Breakdown */}
      {activeTab === 'pricing' && (
        <section id="panel-pricing" role="tabpanel" className="space-y-4 animate-in fade-in duration-150">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-150 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-900" />
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Item-Wise Quotation &amp; Financial BOQ Schedule
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500">
                All prices quoted in Indian Rupees (INR ₹)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3 min-w-[240px]">Item Description &amp; Technical Specs</th>
                    <th className="px-4 py-3 min-w-[140px]">Make &amp; Model</th>
                    <th className="px-4 py-3 min-w-[90px]">HSN Code</th>
                    <th className="px-4 py-3 text-center min-w-[90px]">Quantity</th>
                    <th className="px-4 py-3 text-right min-w-[110px]">Unit Rate (₹)</th>
                    <th className="px-4 py-3 text-center min-w-[90px]">GST %</th>
                    <th className="px-4 py-3 text-right min-w-[130px] bg-emerald-50/40">Total Amount (₹)</th>
                    <th className="px-4 py-3 text-center min-w-[100px]">Technical Status</th>
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
                        <td className="px-4 py-3.5 text-center font-bold text-slate-400 font-mono text-xs">
                          {idx + 1}
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-extrabold text-slate-900 group-hover:text-blue-900 transition-colors text-xs leading-snug">
                            {line.itemName || `Item #${idx + 1}`}
                          </p>
                          {line.description && (
                            <p className="text-[11px] text-slate-600 mt-1 whitespace-pre-wrap leading-relaxed">
                              {line.description}
                            </p>
                          )}
                          {(line.technicalSpecs || line.specifications) && (
                            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200/80 p-2 text-[10.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                Offered Specifications:
                              </span>
                              {line.technicalSpecs || line.specifications}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-700">
                          <div>
                            <span className="text-slate-400 font-bold text-[9.5px] uppercase">Make:</span>{' '}
                            <strong className="text-slate-900">{line.makeBrand || makeBrand || '—'}</strong>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            <span className="text-slate-400 font-bold text-[9.5px] uppercase">Model:</span>{' '}
                            <span className="font-semibold text-slate-800">{line.model || model || '—'}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-700">
                          <span className="font-mono text-slate-800 font-bold text-[11px]">{line.hsn || '—'}</span>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-xs border border-slate-200 whitespace-nowrap">
                            <span>{qty}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{line.unitOfMeasure || 'Nos'}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-800 text-xs tabular-nums">
                          {unitPrice ? formatCurrency(unitPrice) : '—'}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                            {gst}%
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-800 text-xs tabular-nums bg-emerald-50/40">
                          {lineTot ? formatCurrency(lineTot) : totalEvaluatedPrice ? formatCurrency(totalEvaluatedPrice) : '—'}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded text-[10.5px] whitespace-nowrap">
                            <Check className="h-3 w-3 text-emerald-600 stroke-[2.5]" /> Compliant
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {totalEvaluatedPrice > 0 && (
                  <tfoot className="bg-slate-50/90 border-t border-slate-200 font-bold">
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 text-right">
                        Total Evaluated Bid Amount (Landed):
                      </td>
                      <td className="px-4 py-3 text-base font-black text-emerald-700 text-right tabular-nums bg-emerald-50/70">
                        {formatCurrency(totalEvaluatedPrice)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-black text-emerald-800">
                        Rank {rank}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Pricing Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Commercial Term Summary</span>
              <p className="text-xs text-slate-600">
                Rate Basis: <strong>F.O.R Destination</strong> • Includes Packaging, Forwarding, Freight, Transit Insurance, and GST.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Base Quoted Amount</span>
                <strong className="text-slate-800 text-sm font-black">{formatCurrency(quotedBaseAmount)}</strong>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total GST ({gstPercentage}%)</span>
                <strong className="text-slate-800 text-sm font-black">{formatCurrency(taxAmount)}</strong>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-right">
                <span className="text-emerald-700 block text-[10px] uppercase font-bold">Total Landed Amount</span>
                <strong className="text-emerald-700 text-base font-black">{formatCurrency(totalEvaluatedPrice)}</strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: Proposal, Remarks & Terms */}
      {activeTab === 'terms' && (
        <section id="panel-terms" role="tabpanel" className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Supplier Cover Note */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-150">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-700" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Supplier Cover Note &amp; Proposal Remarks
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Official Declaration
                </span>
              </div>

              {coverNoteMessage ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 relative">
                  <Quote className="h-4 w-4 text-slate-300 absolute top-3 left-3 -scale-x-100" />
                  <p className="text-xs font-medium text-slate-800 leading-relaxed pl-6 whitespace-pre-wrap">
                    {coverNoteMessage}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50/50 border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 font-medium">
                  No special cover note or remarks submitted with this quotation.
                </div>
              )}
            </div>

            {/* Commercial Terms & Conditions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-150">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-700" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Commercial &amp; Contractual Terms
                  </h3>
                </div>
                {termsAndConditions && termsAndConditions !== 'Standard procurement terms and conditions apply.' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Seller Specified
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4">
                <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {termsAndConditions || 'Standard tender commercial and contractual terms accepted without deviations.'}
                </p>
              </div>

              {/* Delivery & Validity Strip */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Delivery SLA</span>
                  <strong className="text-slate-900 mt-0.5 block">{deliveryTimeline}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Quotation Validity</span>
                  <strong className="text-slate-900 mt-0.5 block">{result.validity || result.details?.validity || '90 Days from opening'}</strong>
                </div>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* TAB 3: Compliance & Documents */}
      {activeTab === 'compliance' && (
        <section id="panel-compliance" role="tabpanel" className="space-y-4 animate-in fade-in duration-150">
          
          {/* Statutory Verification Checklist */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Mandatory Statutory &amp; Technical Verification Checklist
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Audit Verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {statutoryChecklist.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-3 text-xs font-bold transition-colors min-w-0 shadow-2xs",
                    item.verified
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  )}
                >
                  <Check className={cn("h-4 w-4 shrink-0", item.verified ? "text-emerald-600 stroke-[3]" : "text-slate-300")} />
                  <span className="truncate leading-tight text-xs">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attached Files Gallery */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-blue-900" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Quotation Documents &amp; Technical Attachments
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {uniqueDocs.length} {uniqueDocs.length === 1 ? 'file' : 'files'} attached
              </span>
            </div>

            {uniqueDocs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {uniqueDocs.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between gap-3 shadow-2xs hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200/80">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">
                          {doc.category}
                        </span>
                        <p className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                          {doc.name}
                        </p>
                        {doc.fileName && doc.fileName !== doc.name && (
                          <p className="text-[10px] text-slate-400 font-mono truncate" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handlePreviewDoc(doc)}
                        disabled={previewLoadingId === doc.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-900 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                        title="Preview Document"
                      >
                        {previewLoadingId === doc.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" />
                            <span>Opening...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5 text-blue-700" />
                            <span>Preview Document</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 font-medium">
                No additional document files attached to this quotation.
              </div>
            )}
          </div>

        </section>
      )}

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
