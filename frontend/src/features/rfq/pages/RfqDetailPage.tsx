'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import {
  Download, Calendar, MapPin, Building2, ChevronRight, Loader2,
  Eye, FileText, ShieldCheck, ArrowRight, Paperclip, ClipboardList,
  IndianRupee, AlertTriangle, Info, Package, Clock, CheckCircle,
  Phone, Mail, UserCheck, Tag, Truck, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmdCard, EmdInfo } from '../components/EmdCard';
import { EmdPaymentModal } from '../components/EmdPaymentModal';
import { getApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { openFileAsset } from '../../../lib/files';
import { PdfEngine } from '../../../lib/pdfEngine';
import ClarificationPanel from '../components/ClarificationPanel';
import { procurementBidApi } from '../../procurementBid/api';

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const fmt = (val?: number | string | null): string => {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(val);
  if (isNaN(n) || n === 0) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const fmtDate = (d?: string | Date | null, includeTime = false): string => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = dt.getDate().toString().padStart(2, '0');
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()];
    const yr = dt.getFullYear();
    if (!includeTime) return `${day} ${mo} ${yr}`;
    const hh = dt.getHours().toString().padStart(2, '0');
    const mm = dt.getMinutes().toString().padStart(2, '0');
    return `${day} ${mo} ${yr}, ${hh}:${mm} IST`;
  } catch { return String(d); }
};

const calcTimeLeft = (d?: string | Date | null) => {
  if (!d) return { label: '—', isPassed: false };
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return { label: 'Deadline Passed', isPassed: true };
  const days = Math.floor(ms / 86_400_000);
  const hrs  = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000)  / 60_000);
  if (days > 0)  return { label: `${days}d ${hrs}h remaining`,      isPassed: false };
  if (hrs > 0)   return { label: `${hrs}h ${mins}m remaining`,      isPassed: false };
  return            { label: `${mins} minutes remaining`,            isPassed: false };
};

const stripAutoDesc = (desc?: string): string => {
  if (!desc) return '';
  if (desc.includes('Sourcing Method:') && desc.includes('Urgency:')) return '';
  return desc.trim();
};

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */

/** A label → value row, hidden when value is empty */
const KV = ({
  label, value, accent = false, mono = false,
}: {
  label: string; value?: string | null; accent?: boolean; mono?: boolean;
}) => {
  if (!value || value === '—') return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-50 last:border-0">
      <span className="w-[140px] shrink-0 text-[11px] font-semibold text-slate-400 leading-relaxed pt-px">{label}</span>
      <span className={cn(
        'flex-1 text-[12px] font-bold leading-relaxed',
        accent ? 'text-blue-700' : 'text-slate-800',
        mono && 'font-mono text-[11px]',
      )}>
        {value}
      </span>
    </div>
  );
};

/** A card section with icon, title, and body */
const Card = ({
  icon: Icon, title, badge, iconBg = 'bg-blue-50', iconColor = 'text-blue-600', children, className,
}: {
  icon: any; title: string; badge?: React.ReactNode;
  iconBg?: string; iconColor?: string; children: React.ReactNode; className?: string;
}) => (
  <div className={cn('rounded-2xl border border-slate-200 bg-white overflow-hidden', className)}>
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', iconBg, iconColor)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-[12px] font-extrabold text-slate-800 tracking-tight uppercase">{title}</h3>
      </div>
      {badge}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

/** A horizontal stat tile used in the metric strip */
const StatTile = ({
  icon: Icon, label, value, valueClass,
}: {
  icon: any; label: string; value: string; valueClass?: string;
}) => (
  <div className="flex items-center gap-3 px-5 py-4 min-w-[160px] flex-1">
    <Icon className={cn('h-4.5 w-4.5 shrink-0 text-slate-400')} />
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">{label}</p>
      <p className={cn('text-[13px] font-extrabold leading-snug truncate mt-px', valueClass ?? 'text-slate-800')}>
        {value}
      </p>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RfqDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();

  const requestId    = searchParams?.get('requestId')    ?? '';
  const requirementId = searchParams?.get('requirementId') ?? '';

  /* ── Queries ── */
  const { data: bidData, isLoading: bidLoading } = useQuery({
    queryKey: ['rfq-detail-bid', requestId],
    queryFn:  () => procurementBidApi.detail(requestId),
    enabled:  !!requestId,
  });

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['rfq-detail-req', requirementId],
    queryFn:  async () => getApi<any>(`/api/marketplace/requirements/${requirementId}`),
    enabled:  !!requirementId,
  });

  const bidPacket: any = (bidData as any)?.technicalPacket && typeof (bidData as any).technicalPacket === 'object'
    ? (bidData as any).technicalPacket
    : {};
  const linkedRequirementId = bidPacket.sourceRequirementId || bidPacket.requirementId || bidPacket.linkedRequirementId || (bidData as any)?.sourceId;
  const targetReqId = requirementId || (reqData as any)?.requirement?.id || linkedRequirementId || requestId;

  const { data: ownResponseQueryData } = useQuery({
    queryKey: ['rfq-own-response', targetReqId, requestId],
    queryFn:  async () => {
      try { return await getApi<any>(`/api/marketplace/requirements/${targetReqId}`); }
      catch { return null; }
    },
    enabled:   (!!targetReqId || !!requestId) && user?.role === 'seller',
    staleTime: 5_000,
  });

  const [isEmdModalOpen, setIsEmdModalOpen] = useState(false);

  const rawBid: any = bidData;
  const reqObj: any = (reqData as any)?.requirement ?? reqData;

  const ownParticipation: any = user?.role === 'seller'
    ? (rawBid?.participations ?? []).find((p: any) =>
        Number(p.sellerId) === Number(user?.id) ||
        (user?.organizationId && p.seller?.organizationId === user.organizationId))
    : null;

  const ownResponse =
    (reqData as any)?.ownResponse ??
    (ownResponseQueryData as any)?.ownResponse ??
    (ownParticipation ? {
      status:    ownParticipation.status ?? ownParticipation.submissionStatus,
      createdAt: ownParticipation.createdAt,
    } : null);

  const emdTargetReqId = requirementId || rawBid?.sourceId || (typeof rawBid?.id === 'number' ? rawBid.id : null);
  const targetBidToken = requestId    || rawBid?.bidNumber  || rawBid?.id;

  const { data: emdRes, refetch: refetchEmd, isLoading: emdLoading } = useQuery({
    queryKey: ['emd-status', emdTargetReqId, targetBidToken, user?.id],
    queryFn:  async () => {
      const r = await getApi<any>(`/api/emd/status?requirementId=${emdTargetReqId ?? ''}&requestId=${targetBidToken ?? ''}`);
      return r?.data ?? r;
    },
    enabled:   user?.role === 'seller' && (!!emdTargetReqId || !!targetBidToken),
    staleTime: 0, gcTime: 0,
  });

  const isLoading = (!!requestId && bidLoading) || (!!requirementId && reqLoading);

  /* ══════════════════════════════════════════════════════════════════════════
     DATA RESOLUTION  — pull buyer-submitted fields in priority order
     ══════════════════════════════════════════════════════════════════════════ */
  const ref        = requestId || requirementId || rawBid?.bidNumber || rawBid?.id || reqObj?.requirementNumber || '—';
  const title      = rawBid?.title || reqObj?.title || reqObj?.description || 'Procurement Requirement';
  const desc       = stripAutoDesc(rawBid?.description || rawBid?.technicalPacket?.basics?.description || reqObj?.description || reqObj?.payload?.basics?.description);
  const strategy   = rawBid?.technicalPacket?.recommendation?.reason || rawBid?.technicalPacket?.basics?.justification || reqObj?.payload?.recommendation?.reason || reqObj?.payload?.basics?.justification || '';
  const category   = rawBid?.category || reqObj?.category?.name || rawBid?.technicalPacket?.basics?.category || reqObj?.payload?.basics?.category || '—';
  const method     = rawBid?.procurementType || rawBid?.bidType || rawBid?.technicalPacket?.basics?.buyingType || reqObj?.procurementMethod || 'RFQ';
  const buyType    = rawBid?.technicalPacket?.basics?.bidType || rawBid?.technicalPacket?.basics?.whatAreYouBuying || reqObj?.payload?.basics?.bidType || 'Product';
  const value      = rawBid?.estimatedValue || reqObj?.estimatedValue || reqObj?.budgetMax || rawBid?.technicalPacket?.basics?.estimatedValue;
  const deadline   = rawBid?.endDate || reqObj?.lastDate || reqObj?.requiredBy || rawBid?.technicalPacket?.schedule?.submissionDate;
  const published  = rawBid?.startDate || rawBid?.createdAt || reqObj?.createdAt;
  const location   = rawBid?.deliveryLocation || reqObj?.location || rawBid?.technicalPacket?.basics?.deliveryLocation || '—';
  const buyerOrg   = rawBid?.buyerOrganizationName || rawBid?.buyerOrganization?.organizationName || rawBid?.buyer?.name || reqObj?.buyerOrganization?.organizationName || reqObj?.organization?.organizationName || '—';
  const buyerType  = rawBid?.buyerType || rawBid?.technicalPacket?.basics?.buyerType || 'Private Buyer';
  const contact    = rawBid?.technicalPacket?.internal?.contactPerson || rawBid?.buyer?.name || reqObj?.contactPerson || reqObj?.buyer?.name || '—';
  const email      = rawBid?.technicalPacket?.internal?.email || rawBid?.buyer?.email || reqObj?.buyerEmail || reqObj?.createdBy?.email || '';
  const mobile     = rawBid?.technicalPacket?.internal?.mobile || rawBid?.buyer?.mobile || reqObj?.buyerMobile || reqObj?.createdBy?.mobile || '';
  const payTerms   = rawBid?.technicalPacket?.terms?.paymentTerms || reqObj?.paymentTerms || reqObj?.payload?.terms?.paymentTerms || '100% after delivery and acceptance';
  const delTerms   = rawBid?.technicalPacket?.terms?.deliveryTerms || reqObj?.deliveryTerms || reqObj?.payload?.terms?.deliveryTerms || 'Door delivery to site';
  const warranty   = rawBid?.technicalPacket?.terms?.warrantyTerms || reqObj?.payload?.terms?.warrantyTerms || '12 Months';
  const penalty    = rawBid?.technicalPacket?.terms?.penaltyClause || reqObj?.payload?.terms?.penaltyClause || '0.5% per week for delay';
  const evalMethod = rawBid?.evaluationMethod || rawBid?.technicalPacket?.rules?.evaluationMethod || reqObj?.payload?.rules?.evaluationMethod || 'L1 Basis';
  const packetType = rawBid?.packetType || rawBid?.technicalPacket?.rules?.packetType || reqObj?.payload?.rules?.packetType || 'Single Packet';
  const clarDeadline = rawBid?.technicalPacket?.schedule?.clarificationDeadline || reqObj?.payload?.schedule?.clarificationDeadline;
  const techOpen   = rawBid?.technicalOpeningDate || rawBid?.technicalPacket?.schedule?.technicalOpeningDate || reqObj?.technicalOpeningDate;
  const status     = rawBid?.status || reqObj?.status || 'OPEN';

  /* ── Derived flags ── */
  const isClosed   = ['AWARDED', 'CLOSED', 'CANCELLED'].includes(status);
  const isPassed   = !!deadline && new Date(deadline).getTime() < Date.now();
  const timer      = calcTimeLeft(deadline);
  const submitted  = Boolean(ownResponse && ownResponse.status !== 'DRAFT');

  /* ── Line Items ── */
  const rawItems: any[] =
    (Array.isArray(rawBid?.items)                                && rawBid.items.length                                ? rawBid.items                                : null) ||
    (Array.isArray(rawBid?.technicalPacket?.boq)                 && rawBid.technicalPacket.boq.length                 ? rawBid.technicalPacket.boq                 : null) ||
    (Array.isArray(rawBid?.technicalPacket?.items)               && rawBid.technicalPacket.items.length               ? rawBid.technicalPacket.items               : null) ||
    (Array.isArray(rawBid?.technicalPacket?.wizardData?.items)   && rawBid.technicalPacket.wizardData.items.length    ? rawBid.technicalPacket.wizardData.items    : null) ||
    (Array.isArray(reqObj?.items)                                && reqObj.items.length                                ? reqObj.items                                : null) ||
    (Array.isArray(reqObj?.payload?.items)                       && reqObj.payload.items.length                       ? reqObj.payload.items                       : null) ||
    (Array.isArray(reqObj?.payload?.boqTable)                    && reqObj.payload.boqTable.length                    ? reqObj.payload.boqTable                    : null) ||
    [];

  /* helper: collect unique spec-files from an item raw object */
  const collectItemFiles = (it: any): { name: string; fid?: number | null; url?: string }[] => {
    const sp = (typeof it.specifications === 'object' && it.specifications) ? it.specifications : {};
    const seen = new Set<string>();
    const result: { name: string; fid?: number | null; url?: string }[] = [];

    const push = (name?: string, fid?: any, url?: string) => {
      const fName = name && name !== 'Specification File' && name !== 'Procurement Document'
        ? name
        : (url ? url.split('/').pop()?.split('?')[0] : undefined) || (fid ? `File #${fid}` : undefined);
      if (!fName) return;
      const key = fName.toLowerCase().trim();
      if (seen.has(key)) return;
      seen.add(key);
      const cleanUrl = url || (fid ? `/api/files/${fid}/view` : undefined);
      result.push({ name: fName, fid: fid ? Number(fid) : undefined, url: cleanUrl });
    };

    // 1. Top-level single file fields
    push(it.fileName || it.originalName || it.specificationFileName || it.attachmentName, it.fileAssetId, it.fileUrl || it.attachmentUrl);
    push(it.technicalDocumentName || it.specFileName, it.technicalFileAssetId, it.technicalDocumentUrl || it.specFileUrl);

    // 2. Nested spec object
    push(sp.fileName || sp.originalName || sp.specificationFileName || sp.name, sp.fileAssetId || sp.id, sp.fileUrl || sp.url || sp.attachmentUrl);

    // 3. Arrays: attachments, files, documents on item and spec
    const arrays: any[] = [
      ...(Array.isArray(it.attachments)             ? it.attachments             : []),
      ...(Array.isArray(it.files)                   ? it.files                   : []),
      ...(Array.isArray(it.documents)               ? it.documents               : []),
      ...(Array.isArray(sp.attachments)             ? sp.attachments             : []),
      ...(Array.isArray(sp.files)                   ? sp.files                   : []),
      ...(Array.isArray(sp.documents)               ? sp.documents               : []),
      ...(Array.isArray(sp.uploadedSpecificationFiles) ? sp.uploadedSpecificationFiles : []),
    ];
    for (const f of arrays) {
      if (!f) continue;
      if (typeof f === 'string') { push(f.split('/').pop(), undefined, f); }
      else { push(f.fileName || f.name || f.originalName || f.documentName, f.fileAssetId || f.id, f.fileUrl || f.url || f.attachmentUrl); }
    }

    return result;
  };

  const items = rawItems.map((it: any, idx: number) => {
    const sp = (typeof it.specifications === 'object' && it.specifications) ? it.specifications : {};
    return {
      id:        String(it.id ?? idx + 1),
      name:      it.itemName || it.name || it.title || sp.itemName || `Item #${idx + 1}`,
      desc:      it.description || sp.description || it.specification || '',
      qty:       Number(it.quantity || sp.quantity || 1),
      unit:      it.unitOfMeasure || it.unit || sp.unit || 'Units',
      price:     it.estimatedUnitPrice ? Number(it.estimatedUnitPrice) : undefined,
      gst:       it.gstPercent ?? it.gst ?? sp.gstPercent ?? 18,
      brand:     it.brand || it.brandName || sp.brand || '',
      itemFiles: collectItemFiles(it),
    };
  });
  if (!items.length) {
    items.push({
      id: 'item-1', name: title, desc: desc || 'Primary procurement item',
      qty: Number(rawBid?.quantity || reqObj?.quantity || 1),
      unit: rawBid?.unit || reqObj?.unit || 'Units',
      price: value ? Number(value) : undefined,
      gst: 18, brand: '', itemFiles: [],
    });
  }

  /* ── Documents ── */
  const rawDocs: any[] = [
    ...(Array.isArray(rawBid?.documents)                     ? rawBid.documents                     : []),
    ...(Array.isArray(reqObj?.documents)                     ? reqObj.documents                     : []),
    ...(Array.isArray(rawBid?.technicalPacket?.documents)    ? rawBid.technicalPacket.documents    : []),
    ...(Array.isArray(reqObj?.payload?.documents)            ? reqObj.payload.documents            : []),
    ...(Array.isArray(reqObj?.payload?.requiredDocs)         ? reqObj.payload.requiredDocs         : []),
    ...(Array.isArray(rawBid?.requiredDocuments)
      ? rawBid.requiredDocuments.map((n: any) => typeof n === 'string' ? { fileName: n, documentType: 'REQUIRED' } : n)
      : []),
  ];
  const docs: any[] = [];
  const seenDocs = new Set<string>();
  for (const d of rawDocs) {
    if (!d) continue;
    const nm  = d.fileName || d.name || d.originalName || 'Document';
    const key = nm.toLowerCase().trim();
    if (seenDocs.has(key)) continue;
    seenDocs.add(key);
    const fid = d.fileAssetId ? Number(d.fileAssetId) : (typeof d.id === 'number' ? d.id : null);
    docs.push({ id: fid ?? `d${docs.length}`, name: nm, type: d.documentType || 'Document', fid, url: d.fileUrl || d.url, required: Boolean(d.required || d.documentType === 'REQUIRED') });
  }

  /* ── EMD ── */
  const emdInfo: EmdInfo | null = emdRes ? {
    isEmdRequired:   Boolean(emdRes.isEmdRequired ?? rawBid?.isEmdRequired ?? false),
    emdAmount:       Number(emdRes.emdAmount || rawBid?.emdAmount || 0),
    paymentMethod:   emdRes.paymentMethod  || 'Online / Net Banking / UPI',
    paymentDeadline: emdRes.paymentDeadline || deadline,
    refundPolicy:    emdRes.refundPolicy   || 'Refundable after evaluation & contract award',
    instructions:    emdRes.instructions   || 'Pay EMD via Online Gateway or Bank Transfer.',
    status:          emdRes.status         || 'PENDING',
    payment:         emdRes.payment,
  } : {
    isEmdRequired:   Boolean(rawBid?.isEmdRequired || reqObj?.isEmdRequired || false),
    emdAmount:       Number(rawBid?.emdAmount || reqObj?.emdAmount || 0),
    paymentMethod:   'Online / Net Banking / UPI',
    paymentDeadline: deadline,
    refundPolicy:    'Refundable after evaluation & contract award',
    instructions:    'Pay EMD via Online Gateway or Bank Transfer.',
    status:          'PENDING',
    payment:         null,
  };
  const isEmdPaid = !emdInfo?.isEmdRequired || ['PAID','VERIFIED'].includes(emdInfo?.status ?? '');

  /* ── Handlers ── */
  const handleDownloadPdf = () => {
    try {
      toast.info('Generating PDF…');
      const engine = new PdfEngine();
      const doc = engine.generate({
        documentTitle: 'REQUEST FOR QUOTATION (RFQ)',
        documentNumber: ref,
        dateStr: fmtDate(published),
        status,
        parties: [
          { title: 'BUYER', name: buyerOrg, address: location, email: email || undefined, phone: mobile || undefined, details: [`Contact: ${contact}`, `Category: ${category}`] },
          { title: 'RFQ',   name: title,    details: [`Method: ${method}`, `Deadline: ${fmtDate(deadline, true)}`, `EMD: ${emdInfo?.isEmdRequired ? fmt(emdInfo.emdAmount) : 'Nil'}`] },
        ],
        infoGrid: { Delivery: location, 'Payment Terms': payTerms, 'Delivery SLA': delTerms, 'Evaluation': evalMethod },
        tableHeaders: ['#', 'Item', 'Qty', 'Unit', 'Est. Price', 'GST'],
        tableData: items.map((it, i) => [String(i + 1), it.name, String(it.qty), it.unit, it.price ? fmt(it.price) : '—', `${it.gst}%`]),
        financials: { grandTotal: Number(value || 0) },
        terms: [`Payment: ${payTerms}`, `Delivery: ${delTerms}`, `Evaluation: ${evalMethod}`, `Warranty: ${warranty}`],
        footerNote: 'MSME Enterprise Procurement Portal',
      });
      doc.save(`${ref.replace(/[^a-zA-Z0-9-]/g, '_')}-RFQ.pdf`);
      toast.success('PDF downloaded.');
    } catch { toast.error('Failed to generate PDF.'); }
  };

  const handleSubmitQuotation = () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname + (requestId ? `?requestId=${requestId}` : `?requirementId=${requirementId}`))}`);
      return;
    }
    const id = requestId || rawBid?.bidNumber || requirementId || reqObj?.id || linkedRequirementId || rawBid?.id;
    if (!id) { toast.error('Procurement ID not found'); return; }
    const param = requestId || rawBid?.bidNumber ? 'requestId' : 'requirementId';
    if (!submitted && emdInfo?.isEmdRequired && !isEmdPaid) { setIsEmdModalOpen(true); return; }
    router.push(`/seller/rfq/submit-quotation?${param}=${encodeURIComponent(String(id))}`);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     LOADING / ERROR STATES
     ══════════════════════════════════════════════════════════════════════════ */
  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-sm font-semibold text-slate-500">Loading procurement details…</p>
      </div>
    </div>
  );

  if (!rawBid && !reqObj) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center space-y-4 max-w-sm px-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-extrabold text-slate-900">Procurement Not Found</h2>
        <p className="text-sm text-slate-500">This RFQ is no longer available or the link may be invalid.</p>
        <Button onClick={() => router.push('/seller/opportunities')} className="bg-blue-600 hover:bg-blue-700 text-white">
          Back to Opportunities
        </Button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">

      {/* ════════════════════════════════════════════════════════
          1. TOP HEADER BAND
          ════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-xs">
        <div className="mx-auto max-w-[1440px] px-6">

          {/* Breadcrumb row */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => router.push('/seller/opportunities')}>Marketplace</span>
              <ChevronRight className="h-3 w-3" />
              <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => router.push('/seller/opportunities/rfqs')}>RFQs</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-700 font-bold">{ref}</span>
            </nav>
            {/* Action buttons always visible */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPdf}
                className="h-8 rounded-lg border-slate-200 text-slate-600 text-[11px] font-bold gap-1.5 hover:bg-slate-50">
                <Download className="h-3 w-3" /> PDF
              </Button>
              {user?.role === 'seller' && (
                submitted ? (
                  <Button size="sm" onClick={handleSubmitQuotation}
                    className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold gap-1.5 px-3">
                    <Eye className="h-3 w-3" /> View Quotation
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleSubmitQuotation} disabled={isPassed || isClosed}
                    className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold gap-1.5 px-3">
                    Submit Quotation <ArrowRight className="h-3 w-3" />
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Title + badges row */}
          <div className="py-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Method badge */}
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-0.5 text-[11px] font-black text-white tracking-wide">
                <Tag className="h-3 w-3" />{method}
              </span>
              {/* Status badge */}
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-black tracking-wide',
                isClosed
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', isClosed ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse')} />
                {status}
              </span>
              {/* Deadline urgency */}
              {!timer.isPassed && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                  <Clock className="h-3 w-3" />{timer.label}
                </span>
              )}
              {timer.isPassed && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                  <Clock className="h-3 w-3" /> Deadline Passed
                </span>
              )}
              {submitted && user?.role === 'seller' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle className="h-3 w-3" /> Quotation Submitted
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <strong className="text-slate-700">{buyerOrg}</strong>
              </span>
              <span className="text-slate-200">|</span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {location !== '—' ? location.split(',').slice(-2).join(', ').trim() : '—'}
              </span>
              <span className="text-slate-200">|</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Published {fmtDate(published)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          2. METRIC STRIP  — 6 at-a-glance stats
          ════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-[1440px] px-6">
          <div className="flex items-stretch divide-x divide-slate-100 overflow-x-auto">
            <StatTile icon={IndianRupee} label="Estimated Value"   value={fmt(value)}        valueClass="text-emerald-700" />
            <StatTile icon={Clock}       label="Closes"            value={fmtDate(deadline, true)} valueClass={timer.isPassed ? 'text-rose-600' : 'text-slate-800'} />
            <StatTile icon={Tag}         label="Category"          value={category}           valueClass="text-blue-700" />
            <StatTile icon={BarChart3}   label="Evaluation Basis"  value={evalMethod}         valueClass="text-violet-700" />
            <StatTile icon={Package}     label="Line Items"        value={`${items.length} item${items.length !== 1 ? 's' : ''}`} />
            <StatTile icon={FileText}    label="Documents"         value={docs.length ? `${docs.length} file${docs.length !== 1 ? 's' : ''}` : 'None'} />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          3. GUEST LOGIN BANNER
          ════════════════════════════════════════════════════════ */}
      {!user && (
        <div className="mx-auto max-w-[1440px] px-6 pt-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">Seller login required to participate</p>
                <p className="text-xs text-slate-500 mt-0.5">Create a free account or login to submit your quotation for this RFQ.</p>
              </div>
            </div>
            <a href={`/login?redirect=${encodeURIComponent(pathname)}`}
              className="shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors whitespace-nowrap">
              Login to Participate
            </a>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          4. BODY  — 2-column grid
          ════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-[1440px] px-6 py-6 pb-16">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">

          {/* ──────────────────────────────────────────────────
              LEFT COLUMN — Full RFQ Detail
              ────────────────────────────────────────────────── */}
          <div className="space-y-5 min-w-0">

            {/* ── A. Procurement Overview ── */}
            <Card icon={Tag} title="Procurement Overview">
              {/* Group 1: Identity */}
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Identity</p>
                <div className="space-y-0 divide-y divide-slate-50 rounded-xl border border-slate-100 overflow-hidden bg-slate-50/40 px-4">
                  <KV label="Reference Number"      value={ref} mono />
                  <KV label="Procurement Title"     value={title} />
                  <KV label="Category"              value={category} />
                  <KV label="Buying Type"           value={buyType} />
                  <KV label="Sourcing Method"       value={method} accent />
                </div>
              </div>

              {/* Group 2: Commercial */}
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Commercial</p>
                <div className="space-y-0 divide-y divide-slate-50 rounded-xl border border-slate-100 overflow-hidden bg-slate-50/40 px-4">
                  <KV label="Estimated Budget"      value={fmt(value)} accent />
                  <KV label="EMD Requirement"       value={emdInfo?.isEmdRequired ? `Required — ${fmt(emdInfo.emdAmount)}` : 'Not Required'} />
                  <KV label="Payment Terms"         value={payTerms} />
                  <KV label="Delivery Terms"        value={delTerms} />
                  <KV label="Warranty"              value={warranty} />
                  <KV label="Penalty Clause"        value={penalty} />
                </div>
              </div>

              {/* Group 3: Evaluation & Rules */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Evaluation & Rules</p>
                <div className="space-y-0 divide-y divide-slate-50 rounded-xl border border-slate-100 overflow-hidden bg-slate-50/40 px-4">
                  <KV label="Evaluation Method"    value={evalMethod} accent />
                  <KV label="Packet Type"          value={packetType} />
                  <KV label="Buyer Organization"   value={buyerType} />
                </div>
              </div>
            </Card>

            {/* ── B. Procurement Schedule ── */}
            <Card icon={Calendar} title="Procurement Schedule">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Published',              value: fmtDate(published),        highlight: false },
                  { label: 'Clarification Deadline', value: fmtDate(clarDeadline, true), highlight: false },
                  { label: 'Submission Closing',     value: fmtDate(deadline, true),   highlight: true  },
                  { label: 'Technical Opening',      value: fmtDate(techOpen, true),   highlight: false },
                ].map(s => (
                  <div key={s.label} className={cn(
                    'rounded-xl border p-3.5 space-y-1',
                    s.highlight ? 'border-blue-200 bg-blue-50/60' : 'border-slate-100 bg-slate-50/50',
                  )}>
                    <p className={cn('text-[10px] font-bold uppercase tracking-widest', s.highlight ? 'text-blue-500' : 'text-slate-400')}>
                      {s.label}
                    </p>
                    <p className={cn('text-[12px] font-extrabold leading-snug', s.highlight ? 'text-blue-900' : 'text-slate-800', s.value === '—' && 'text-slate-300')}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── C. Scope of Work & Description ── */}
            <Card icon={FileText} title="Scope of Work & Buyer Intent">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Buyer Description</p>
                  {desc ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[13px] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{desc}</p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-slate-400 italic">No detailed description provided by buyer.</p>
                  )}
                </div>
                {strategy && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1.5">Recommendation / Strategy Note</p>
                    <p className="text-[13px] text-amber-900 font-medium leading-relaxed">{strategy}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* ── D. Delivery Location ── */}
            <Card icon={MapPin} title="Delivery & Consignee Details">
              <div className="space-y-0 divide-y divide-slate-50 rounded-xl border border-slate-100 bg-slate-50/40 px-4">
                <KV label="Delivery Destination"  value={location} />
                <KV label="Contact Person"        value={contact} />
                <KV label="Organization Type"     value={buyerType} />
              </div>
            </Card>

            {/* ── E. Line Items / BOQ ── */}
            <Card
              icon={ClipboardList}
              title="Line Items & Bill of Quantities"
              badge={
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-black text-blue-700">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              }
            >
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['#', 'Item Name & Specification', 'Qty', 'Unit', 'Est. Unit Price', 'GST', 'Brand / Make', 'Spec Files'].map(h => (
                        <th key={h} className="px-3.5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap first:pl-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="group hover:bg-slate-50/80 transition-colors align-top">
                        <td className="px-3.5 pl-4 py-4 text-slate-400 font-bold text-[11px] w-8">{idx + 1}</td>

                        {/* Name + description */}
                        <td className="px-3.5 py-4 max-w-[240px]">
                          <p className="font-bold text-slate-900 text-[12px] leading-snug">{item.name}</p>
                          {item.desc && (
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-3">{item.desc}</p>
                          )}
                        </td>

                        <td className="px-3.5 py-4 font-bold text-slate-900 whitespace-nowrap">
                          {item.qty.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3.5 py-4 text-slate-500 font-semibold text-[11px]">{item.unit}</td>
                        <td className="px-3.5 py-4 font-bold text-slate-900 whitespace-nowrap">
                          {item.price ? fmt(item.price) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3.5 py-4 text-slate-600 font-semibold">{item.gst}%</td>
                        <td className="px-3.5 py-4 text-slate-600 font-medium">
                          {item.brand || <span className="text-slate-300 text-[11px]">Any</span>}
                        </td>

                        {/* Spec Files column — all buyer-uploaded files for this item */}
                        <td className="px-3.5 py-4 min-w-[160px]">
                          {item.itemFiles.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {item.itemFiles.map((f, fi) => (
                                <button
                                  key={fi}
                                  onClick={() => openFileAsset(f.fid ?? f.url ?? f)}
                                  title={f.name}
                                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors text-left max-w-[200px] group/file"
                                >
                                  <Paperclip className="h-3 w-3 shrink-0 text-blue-400 group-hover/file:text-blue-600" />
                                  <span className="truncate leading-tight">{f.name}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-300">No file</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── F. Required Documents ── */}
            <Card
              icon={Paperclip}
              title="Buyer Documents & Required Attachments"
              badge={
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600">
                  {docs.length} file{docs.length !== 1 ? 's' : ''}
                </span>
              }
            >
              {docs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {docs.map((doc, i) => (
                    <div key={doc.id ?? i}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 hover:border-blue-200 hover:bg-blue-50/20 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 shrink-0 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-slate-900 truncate">{doc.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-semibold text-slate-400">{doc.type}</span>
                            {doc.required && (
                              <span className="rounded bg-rose-100 px-1.5 py-px text-[9px] font-black text-rose-700 uppercase tracking-wide">Required</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {doc.fid || doc.url ? (
                        <Button size="sm" variant="outline" onClick={() => openFileAsset(doc.fid ?? doc.url)}
                          className="h-7 px-3 text-[11px] font-bold text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0 ml-2 rounded-lg">
                          <Eye className="h-3 w-3 mr-1" />View
                        </Button>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400 ml-2 shrink-0">Checklist</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Paperclip className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No documents attached by buyer.</p>
                </div>
              )}
            </Card>

            {/* ── G. Clarifications Q&A ── */}
            {(rawBid || reqObj) && (
              <ClarificationPanel
                quoteRequestId={requirementId || rawBid?.sourceId || (typeof rawBid?.id === 'number' ? rawBid.id : undefined)}
                kind={rawBid?.sourceModel === 'REQUIREMENT' || !!requirementId || !!rawBid?.sourceId ? 'requirement' : 'quote-request'}
                role={user?.role === 'buyer' ? 'buyer' : 'seller'}
                deadlinePassed={isPassed}
              />
            )}
          </div>

          {/* ──────────────────────────────────────────────────
              RIGHT SIDEBAR — Actions + Supporting info
              ────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* ── 1. Quotation Action Card ── */}
            <div className={cn(
              'rounded-2xl border-2 overflow-hidden',
              submitted ? 'border-emerald-200' : timer.isPassed ? 'border-rose-200' : 'border-blue-300',
            )}>
              {/* Top: status bar */}
              <div className={cn(
                'flex items-center justify-between px-5 py-3',
                submitted ? 'bg-emerald-600' : timer.isPassed ? 'bg-rose-600' : 'bg-blue-600',
              )}>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/90">
                  {submitted ? 'Quotation' : 'Your Action Required'}
                </p>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">
                  {submitted ? 'Submitted' : isPassed ? 'Closed' : 'Open'}
                </span>
              </div>

              {/* Body */}
              <div className="bg-white p-5 space-y-4">
                {submitted ? (
                  <>
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-[12px] font-bold text-emerald-900">Quotation Submitted</p>
                        <p className="text-[11px] text-emerald-600">On {fmtDate(ownResponse?.createdAt, true)}</p>
                      </div>
                    </div>
                    <Button onClick={handleSubmitQuotation}
                      className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm gap-2">
                      <Eye className="h-4 w-4" /> View My Quotation
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Deadline block */}
                    <div className="rounded-xl bg-slate-900 p-4 text-white space-y-1.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Submission Closes</p>
                      <p className={cn('text-[22px] font-black leading-tight', timer.isPassed ? 'text-rose-400' : 'text-white')}>
                        {timer.label}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{fmtDate(deadline, true)}</p>
                    </div>

                    {/* Value row */}
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[12px] text-slate-500 font-semibold">Estimated Budget</span>
                      <span className="text-[14px] font-extrabold text-emerald-700">{fmt(value)}</span>
                    </div>

                    {/* CTA */}
                    {user?.role === 'seller' ? (
                      <Button onClick={handleSubmitQuotation} disabled={isPassed || isClosed}
                        className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm gap-2 shadow-md shadow-blue-100">
                        Submit Quotation <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button onClick={handleSubmitQuotation}
                        className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm gap-2">
                        Login to Submit Quotation <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}

                    {(isPassed || isClosed) && (
                      <p className="text-center text-[11px] text-rose-500 font-semibold">
                        This RFQ is no longer accepting submissions.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── 2. EMD Card ── */}
            <EmdCard emdInfo={emdInfo} loading={emdLoading} onPayClick={() => setIsEmdModalOpen(true)} />

            {/* ── 3. Verified Buyer Profile ── */}
            <Card icon={Building2} title="Verified Buyer" iconBg="bg-violet-50" iconColor="text-violet-600">
              <div className="space-y-3">
                <div>
                  <p className="font-extrabold text-slate-900 text-[13px]">{buyerOrg}</p>
                  <span className="inline-flex items-center gap-1 mt-1 rounded-lg bg-violet-50 border border-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                    <ShieldCheck className="h-3 w-3 text-violet-500" /> {buyerType}
                  </span>
                </div>
                <div className="space-y-2 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-[12px] text-slate-600">
                    <UserCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span><strong className="text-slate-800">Contact:</strong> {contact}</span>
                  </div>
                  {email && (
                    <div className="flex items-center gap-2 text-[12px] text-slate-600">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{email}</span>
                    </div>
                  )}
                  {mobile && (
                    <div className="flex items-center gap-2 text-[12px] text-slate-600">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{mobile}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-[12px] text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{location}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── 4. Commercial Terms ── */}
            <Card icon={Truck} title="Commercial Terms">
              <div className="space-y-0">
                <KV label="Payment Terms" value={payTerms} />
                <KV label="Delivery SLA"  value={delTerms} />
                <KV label="Warranty"      value={warranty} />
                <KV label="Penalty"       value={penalty} />
              </div>
            </Card>

          </div>
        </div>
      </div>

      {/* ── EMD Modal ── */}
      <EmdPaymentModal
        isOpen={isEmdModalOpen}
        onClose={() => setIsEmdModalOpen(false)}
        requirementId={emdTargetReqId}
        requestId={targetBidToken}
        rfqTitle={title}
        rfqNumber={ref}
        emdAmount={emdInfo?.emdAmount || 50_000}
        buyerName={buyerOrg}
        onSuccess={() => {
          setIsEmdModalOpen(false);
          toast.success('EMD payment verified!');
          refetchEmd();
        }}
      />
    </div>
  );
}
