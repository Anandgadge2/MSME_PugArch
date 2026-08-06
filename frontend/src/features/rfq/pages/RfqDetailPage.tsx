'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import {
  Download, Calendar, MapPin, Building2, ChevronRight, Loader2,
  Eye, FileText, ShieldCheck, ArrowRight, Paperclip, ClipboardList,
  IndianRupee, AlertTriangle, Info, Package, Clock, CheckCircle,
  Phone, Mail, UserCheck, Tag, Truck, BarChart3, ClipboardCheck, Send, Users, X,
  ChevronDown, CheckCircle2, ShieldAlert, Layers, Lock, Share2, Sparkles, ArrowLeft,
  Check, FileSpreadsheet, Scale, AlertCircle, HelpCircle
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
   ENTERPRISE UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Enterprise Key-Value Row */
const KV = ({
  label, value, accent = false, mono = false, icon: Icon
}: {
  label: string; value?: string | null; accent?: boolean; mono?: boolean; icon?: any;
}) => {
  if (!value || value === '—') return null;
  return (
    <div className="flex items-center justify-between py-2.5 px-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors rounded-lg">
      <span className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
        {label}
      </span>
      <span className={cn(
        'text-xs font-extrabold text-right leading-relaxed',
        accent ? 'text-blue-700' : 'text-slate-900',
        mono && 'font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200',
      )}>
        {value}
      </span>
    </div>
  );
};

/** Enterprise Card Container */
const Card = ({
  icon: Icon, title, badge, iconBg = 'bg-blue-50', iconColor = 'text-blue-600', children, className, id
}: {
  icon: any; title: string; badge?: React.ReactNode;
  iconBg?: string; iconColor?: string; children: React.ReactNode; className?: string; id?: string;
}) => (
  <div id={id} className={cn('rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md transition-shadow duration-200 overflow-hidden', className)}>
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl shadow-xs border border-blue-100/50', iconBg, iconColor)}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">{title}</h3>
      </div>
      {badge}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

/** Enterprise Stat Tile for Top Overview Strip */
const StatTile = ({
  icon: Icon, label, value, valueClass, subtext
}: {
  icon: any; label: string; value: string; valueClass?: string; subtext?: string;
}) => (
  <div className="flex items-center gap-3.5 px-5 py-4 min-w-[170px] flex-1 border-r border-slate-100 last:border-0">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
      <Icon className="h-4.5 w-4.5" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">{label}</p>
      <p className={cn('text-sm font-black leading-snug truncate mt-0.5', valueClass ?? 'text-slate-900')}>
        {value}
      </p>
      {subtext && <p className="text-[10px] font-semibold text-slate-400 truncate">{subtext}</p>}
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

  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>('commercial');

  const rawIdParam    = searchParams?.get('id') ?? searchParams?.get('requirementId') ?? searchParams?.get('requestId') ?? '';
  const requestId     = searchParams?.get('requestId') || searchParams?.get('bidId') || searchParams?.get('rfqId') || rawIdParam;
  const requirementId = searchParams?.get('requirementId') || rawIdParam;

  /* ── Queries ── */
  const { data: bidData, isLoading: bidLoading } = useQuery({
    queryKey: ['rfq-detail-bid', requestId],
    queryFn:  () => procurementBidApi.detail(requestId),
    enabled:  !!requestId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['rfq-detail-req', requirementId],
    queryFn:  async () => getApi<any>(`/api/marketplace/requirements/${requirementId}`),
    enabled:  !!requirementId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const [isEmdModalOpen, setIsEmdModalOpen] = useState(false);
  const [selectedBuyerResponse, setSelectedBuyerResponse] = useState<any>(null);

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
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const rawBid: any = bidData;
  const reqObj: any = (reqData as any)?.requirement ?? reqData;

  const ownParticipation: any = user?.role === 'seller'
    ? (() => {
        const participations = [
          ...(Array.isArray(rawBid?.participations) ? rawBid.participations : []),
          ...(Array.isArray(rawBid?.results) ? rawBid.results : []),
          ...(Array.isArray(rawBid?.quoteResponses) ? rawBid.quoteResponses : []),
        ];
        return participations.find((p: any) => {
          const sId = p.sellerId || p.seller?.id || p.sellerUserId;
          const sOrg = p.organizationId || p.sellerOrganizationId || p.seller?.organizationId || p.seller?.organization?.id;
          return (
            (sId && String(sId) === String(user?.id)) ||
            (user?.organizationId && sOrg && String(sOrg) === String(user.organizationId))
          );
        });
      })()
    : null;

  const localSubmittedResponse = React.useMemo(() => {
    if (typeof window === 'undefined' || !user || user.role !== 'seller') return null;
    const keys = [targetReqId, requirementId, requestId, (rawBid as any)?.id, (rawBid as any)?.bidNumber].filter(Boolean);
    for (const k of keys) {
      try {
        const item = localStorage.getItem(`rfq_submitted_${k}`);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed && parsed.status && String(parsed.status).toUpperCase() !== 'DRAFT') {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  }, [targetReqId, requirementId, requestId, (rawBid as any)?.id, (rawBid as any)?.bidNumber, user]);

  const rawOwnResp = (reqData as any)?.ownResponse ?? (ownResponseQueryData as any)?.ownResponse;
  const ownResponse =
    rawOwnResp ??
    (ownParticipation ? {
      id: ownParticipation.id,
      status: ownParticipation.status ?? ownParticipation.submissionStatus ?? 'SUBMITTED',
      submissionStatus: ownParticipation.submissionStatus ?? ownParticipation.status ?? 'SUBMITTED',
      createdAt: ownParticipation.submittedAt ?? ownParticipation.createdAt,
      submittedAt: ownParticipation.submittedAt ?? ownParticipation.createdAt,
      offeredPrice: ownParticipation.offeredPrice ?? ownParticipation.quotedAmount ?? ownParticipation.totalAmount,
      offeredQuantity: ownParticipation.offeredQuantity,
      deliveryTimeline: ownParticipation.deliveryTimeline,
      message: ownParticipation.message ?? ownParticipation.coverNote,
      terms: ownParticipation.terms,
      responseData: ownParticipation.responseData,
    } : null) ??
    localSubmittedResponse;

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

  /* ── Buyer Seller Responses Query ── */
  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin' || user?.role === 'master_admin';
  const numericTargetReqId = Number(targetReqId);

  const { data: buyerResponsesData, isLoading: buyerResponsesLoading } = useQuery({
    queryKey: ['rfq-buyer-responses', targetReqId, requestId],
    queryFn: async () => {
      if (numericTargetReqId && !isNaN(numericTargetReqId) && numericTargetReqId > 0) {
        try {
          const res = await getApi<any>(`/api/buyer/requirements/${numericTargetReqId}/responses?pageSize=50`);
          return Array.isArray(res?.responses) ? res.responses : [];
        } catch {
          return [];
        }
      }
      return [];
    },
    enabled: (isBuyerOrAdmin || !!user) && (!!targetReqId || !!requestId),
    staleTime: 5_000,
  });

  const sellerResponses = React.useMemo(() => {
    const rawList = [
      ...(Array.isArray(buyerResponsesData) ? buyerResponsesData : []),
      ...(Array.isArray(reqData?.responses) ? reqData.responses : []),
      ...(Array.isArray(rawBid?.participations) ? rawBid.participations : []),
      ...(Array.isArray(rawBid?.quoteResponses) ? rawBid.quoteResponses : []),
      ...(Array.isArray(rawBid?.results) ? rawBid.results : []),
    ];

    const seen = new Set<string>();
    const list: any[] = [];

    for (const r of rawList) {
      if (!r) continue;
      const statusStr = String(r.status || r.submissionStatus || '').toUpperCase();
      if (statusStr === 'DRAFT') continue;

      const sId = r.sellerUserId || r.sellerId || r.seller?.id || r.sellerUser?.id;
      const sOrg = r.sellerOrganizationId || r.seller?.organizationId || r.sellerUser?.organizationId;
      const key = r.id ? `id-${r.id}` : `s-${sId}-${sOrg}`;

      if (seen.has(key)) continue;
      seen.add(key);

      const respData = typeof r.responseData === 'string' ? (() => { try { return JSON.parse(r.responseData); } catch { return {}; } })() : (r.responseData || {});
      const offeredPrice = r.offeredPrice ?? r.quotedAmount ?? r.totalAmount ?? respData.offeredPrice ?? respData.quotedAmount ?? respData.totalAmount;
      const sellerName = r.sellerUser?.name || r.seller?.name || r.sellerName || 'Seller Partner';
      const sellerOrgName = r.sellerOrganization?.organizationName || r.seller?.organizationName || r.seller?.organization?.organizationName || r.sellerOrgName || 'Verified Supplier';

      list.push({
        id: r.id || key,
        sellerName,
        sellerOrgName,
        sellerEmail: r.sellerUser?.email || r.seller?.email || r.sellerEmail,
        sellerPhone: r.sellerUser?.mobile || r.seller?.mobile || r.sellerPhone,
        status: statusStr || 'SUBMITTED',
        offeredPrice: offeredPrice != null ? Number(offeredPrice) : null,
        offeredQuantity: r.offeredQuantity ?? respData.offeredQuantity,
        deliveryTimeline: r.deliveryTimeline || respData.deliveryTimeline,
        message: r.message || r.coverNote || respData.message || respData.coverNote,
        terms: r.terms || respData.terms,
        attachmentUrl: r.attachmentUrl || respData.attachmentUrl,
        documents: Array.isArray(r.documents) ? r.documents : (Array.isArray(respData.documents) ? respData.documents : []),
        lineItems: Array.isArray(r.lineItems) ? r.lineItems : (Array.isArray(respData.lineItems) ? respData.lineItems : (Array.isArray(respData.lineQuotes) ? respData.lineQuotes : [])),
        submittedAt: r.submittedAt || r.createdAt || r.updatedAt,
      });
    }

    return list;
  }, [buyerResponsesData, reqData?.responses, rawBid?.participations, rawBid?.quoteResponses, rawBid?.results]);

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
  const isClosed   = ['AWARDED', 'CLOSED', 'CANCELLED'].includes(String(status).toUpperCase());
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

    push(it.fileName || it.originalName || it.specificationFileName || it.attachmentName, it.fileAssetId, it.fileUrl || it.attachmentUrl);
    push(it.technicalDocumentName || it.specFileName, it.technicalFileAssetId, it.technicalDocumentUrl || it.specFileUrl);
    push(sp.fileName || sp.originalName || sp.specificationFileName || sp.name, sp.fileAssetId || sp.id, sp.fileUrl || sp.url || sp.attachmentUrl);

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
    router.push(`/seller/rfq/submit-quotation?${param}=${encodeURIComponent(String(id))}`);
  };

  /* ── Status Badge Styling Helper ── */
  const getStatusBadgeStyle = (st: string) => {
    const s = String(st || '').toUpperCase();
    if (['OPEN', 'PUBLISHED', 'ACTIVE'].includes(s)) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' };
    }
    if (['AWARDED', 'CLOSED'].includes(s)) {
      return { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
    }
    if (['CANCELLED', 'UNDER_EVALUATION', 'TECHNICAL_EVALUATION'].includes(s)) {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
    return { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' };
  };

  const statusStyle = getStatusBadgeStyle(status);

  /* ── Timeline active calculation ── */
  const getTimelineStages = () => {
    const statusUpper = String(status).toUpperCase();
    let currentIdx = 1; // Default 'Open'
    if (submitted) currentIdx = 2;
    if (statusUpper === 'UNDER_EVALUATION' || statusUpper === 'TECHNICAL_EVALUATION') currentIdx = 3;
    if (statusUpper === 'AWARDED' || statusUpper === 'CLOSED') currentIdx = 4;

    return [
      { step: 1, label: 'Published', date: fmtDate(published), done: true, current: false },
      { step: 2, label: 'Open for Quotation', date: fmtDate(published), done: currentIdx >= 1, current: currentIdx === 1 },
      { step: 3, label: 'Quotation Submitted', date: submitted ? fmtDate(ownResponse?.submittedAt || ownResponse?.createdAt, true) : fmtDate(deadline, true), done: currentIdx >= 2, current: currentIdx === 2 },
      { step: 4, label: 'Evaluation & Review', date: fmtDate(techOpen, true) || 'Post Closing', done: currentIdx >= 3, current: currentIdx === 3 },
      { step: 5, label: 'Award / Order', date: 'Final Stage', done: currentIdx >= 4, current: currentIdx === 4 },
    ];
  };

  const timelineStages = getTimelineStages();

  /* ══════════════════════════════════════════════════════════════════════════
     LOADING SKELETON
     ══════════════════════════════════════════════════════════════════════════ */
  if (isLoading) return (
    <div className="min-h-screen bg-slate-50/70 p-6 space-y-6 animate-pulse">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {/* Header Skeleton */}
        <div className="h-32 bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-5 w-48 bg-slate-200 rounded-lg" />
            <div className="h-8 w-24 bg-slate-200 rounded-xl" />
          </div>
          <div className="h-8 w-2/3 bg-slate-200 rounded-lg" />
        </div>
        {/* Stats Strip Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2" />
          ))}
        </div>
        {/* 2-Column Body Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            <div className="h-64 bg-white rounded-2xl border border-slate-200/80 p-6" />
            <div className="h-48 bg-white rounded-2xl border border-slate-200/80 p-6" />
          </div>
          <div className="space-y-6">
            <div className="h-80 bg-white rounded-2xl border border-slate-200/80 p-6" />
            <div className="h-48 bg-white rounded-2xl border border-slate-200/80 p-6" />
          </div>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     ERROR / NOT FOUND STATE
     ══════════════════════════════════════════════════════════════════════════ */
  if (!rawBid && !reqObj) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/70 p-6">
      <div className="text-center space-y-4 max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
        <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Procurement Requirement Not Found</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          The requested RFQ opportunity could not be loaded or may no longer be available.
        </p>
        <Button onClick={() => router.push('/seller/opportunities')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 h-10 rounded-xl">
          Return to Opportunities
        </Button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER MAIN PAGE
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 font-sans pb-24">

      {/* ════════════════════════════════════════════════════════
          1. ENTERPRISE STICKY HEADER BAND
          ════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">

          {/* Breadcrumb & Navigation Row */}
          <div className="flex items-center justify-between py-2.5 border-b border-slate-100/80">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
                title="Go Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <nav className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => router.push('/seller/opportunities')}>Sourcing</span>
                <ChevronRight className="h-3 w-3 text-slate-300" />
                <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => router.push('/seller/opportunities/rfqs')}>RFQs</span>
                <ChevronRight className="h-3 w-3 text-slate-300" />
                <span className="text-slate-800 font-extrabold font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{ref}</span>
              </nav>
            </div>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                className="h-8 rounded-xl border-slate-200 text-slate-700 text-xs font-bold gap-1.5 hover:bg-slate-50 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" /> PDF Document
              </Button>
              {user?.role === 'seller' && (
                submitted ? (
                  <Button
                    size="sm"
                    onClick={handleSubmitQuotation}
                    className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 px-3.5 shadow-2xs"
                  >
                    <Eye className="h-3.5 w-3.5" /> View Submitted Quote
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubmitQuotation}
                    disabled={isPassed || isClosed}
                    className="h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 px-3.5 shadow-2xs"
                  >
                    Submit Quotation <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Title & Metadata Header Row */}
          <div className="py-3.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Method badge */}
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white uppercase tracking-wider shadow-2xs">
                <Tag className="h-3 w-3" />{method}
              </span>

              {/* Status Badge */}
              <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider', statusStyle.bg)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
                {status}
              </span>

              {/* Deadline Urgency Pill */}
              {!timer.isPassed && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  <Clock className="h-3 w-3 text-amber-600" />{timer.label}
                </span>
              )}
              {timer.isPassed && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                  <AlertCircle className="h-3 w-3 text-rose-600" /> Deadline Passed
                </span>
              )}

              {/* Submission Indicator */}
              {submitted && user?.role === 'seller' && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Quotation Submitted
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <strong className="text-slate-800">{buyerOrg}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {location !== '—' ? location.split(',').slice(-2).join(', ').trim() : 'Location not specified'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Published: {fmtDate(published)}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          2. ENTERPRISE METRIC STRIP (6 Stats)
          ════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          <div className="flex items-stretch overflow-x-auto divide-x divide-slate-100">
            <StatTile icon={IndianRupee} label="Estimated Budget"  value={fmt(value)}               valueClass="text-emerald-700" subtext="Fixed Budget" />
            <StatTile icon={Clock}       label="Closing Date"      value={fmtDate(deadline, true)}  valueClass={timer.isPassed ? 'text-rose-600' : 'text-slate-900'} subtext={timer.label} />
            <StatTile icon={Tag}         label="Category"          value={category}                  valueClass="text-blue-700" subtext={buyType} />
            <StatTile icon={BarChart3}   label="Evaluation Method" value={evalMethod}                valueClass="text-violet-700" subtext={packetType} />
            <StatTile icon={Package}     label="Line Items"        value={`${items.length} item${items.length !== 1 ? 's' : ''}`} subtext="BOQ Schedule" />
            <StatTile icon={Paperclip}   label="Buyer Documents"   value={docs.length ? `${docs.length} file${docs.length !== 1 ? 's' : ''}` : 'None'} subtext="Attached Specs" />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          3. ENTERPRISE HORIZONTAL TIMELINE
          ════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 pt-5">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-500" /> Procurement Lifecycle Stage
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {timelineStages.map((st) => (
              <div
                key={st.step}
                className={cn(
                  'relative rounded-xl border p-3 flex flex-col justify-between transition-all',
                  st.current ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-400/30' :
                  st.done ? 'border-emerald-200 bg-emerald-50/40' :
                  'border-slate-100 bg-slate-50/50 opacity-70'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black',
                    st.current ? 'bg-blue-600 text-white' :
                    st.done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  )}>
                    {st.done && !st.current ? <Check className="h-3.5 w-3.5" /> : st.step}
                  </span>
                  {st.current && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black uppercase text-white tracking-wider animate-pulse">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-2.5">
                  <p className={cn('text-xs font-black leading-tight', st.current ? 'text-blue-950' : st.done ? 'text-emerald-950' : 'text-slate-600')}>
                    {st.label}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">{st.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          4. GUEST NOTICE BANNER
          ════════════════════════════════════════════════════════ */}
      {!user && (
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50/80 px-5 py-4 shadow-xs">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-extrabold text-slate-900">Registered Seller Account Required</p>
                <p className="text-xs text-slate-600 mt-0.5">Log in to view complete bidding documents, submit rate quotations, and track evaluation status.</p>
              </div>
            </div>
            <a
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              className="shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-2xs"
            >
              Login to Participate
            </a>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          5. MAIN BODY (2 Columns Layout)
          ════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ──────────────────────────────────────────────────
              LEFT MAIN CONTENT COLUMN (70%)
              ────────────────────────────────────────────────── */}
          <div className="space-y-6 min-w-0">

            {/* ── A. Procurement Summary Cards Grid ── */}
            <Card icon={Tag} title="Procurement Summary & Specifications">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Identity & Sourcing Card */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                    <Tag className="h-3 w-3 text-slate-400" /> Sourcing Parameters
                  </p>
                  <KV label="Reference No." value={ref} mono icon={Layers} />
                  <KV label="Requirement Title" value={title} icon={FileText} />
                  <KV label="Category" value={category} icon={Tag} />
                  <KV label="Buying Type" value={buyType} icon={Package} />
                  <KV label="Sourcing Method" value={method} accent icon={Sparkles} />
                </div>

                {/* Commercial Terms Card */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                    <IndianRupee className="h-3 w-3 text-slate-400" /> Commercial Parameters
                  </p>
                  <KV label="Estimated Budget" value={fmt(value)} accent icon={IndianRupee} />
                  <KV label="EMD Amount" value={emdInfo?.isEmdRequired ? `Required — ${fmt(emdInfo.emdAmount)}` : 'Nil / Exempt'} icon={ShieldCheck} />
                  <KV label="Payment Terms" value={payTerms} icon={Truck} />
                  <KV label="Delivery SLA" value={delTerms} icon={Clock} />
                  <KV label="Warranty" value={warranty} icon={ShieldCheck} />
                  <KV label="Penalty Clause" value={penalty} icon={AlertCircle} />
                </div>

              </div>
            </Card>

            {/* ── B. Scope of Work & Description ── */}
            <Card icon={FileText} title="Scope of Work & Buyer Requirements">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 mb-2">{title}</h4>
                  {desc ? (
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 text-xs font-medium text-slate-700 leading-relaxed space-y-2">
                      <p className="whitespace-pre-wrap">
                        {isDescExpanded || desc.length <= 280 ? desc : `${desc.slice(0, 280)}…`}
                      </p>
                      {desc.length > 280 && (
                        <button
                          type="button"
                          onClick={() => setIsDescExpanded(!isDescExpanded)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 underline mt-1"
                        >
                          {isDescExpanded ? 'Read Less' : 'Read Full Description'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No additional scope description specified by buyer.</p>
                  )}
                </div>

                {strategy && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Buyer Justification / Strategy Note
                    </p>
                    <p className="text-xs text-amber-900 font-medium leading-relaxed">{strategy}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* ── C. Technical & Compliance Requirements Checklist Cards ── */}
            <Card icon={ShieldCheck} title="Technical & Compliance Requirements">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { title: 'GST Registration', desc: 'Valid GSTIN compliance', active: true },
                  { title: 'ISO / Quality Standard', desc: 'ISO 9001 certified or equivalent', active: true },
                  { title: 'OEM Authorization', desc: 'Manufacturer auth letter required', active: Boolean(items.some(i => i.brand)) },
                  { title: 'Warranty Support', desc: warranty, active: true },
                  { title: 'EMD Compliance', desc: emdInfo?.isEmdRequired ? `EMD ${fmt(emdInfo.emdAmount)}` : 'Exempted', active: true },
                  { title: 'Delivery SLA Commitment', desc: delTerms, active: true },
                ].map((req, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{req.title}</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-snug">{req.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── D. Line Items & BOQ Schedule Table ── */}
            <Card
              icon={ClipboardList}
              title="Line Items & Bill of Quantities (BOQ)"
              badge={
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-black text-blue-700">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </span>
              }
            >
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-black tracking-wider">
                      <th className="px-3.5 py-3 text-center w-10">Sr</th>
                      <th className="px-4 py-3">Item Name & Description</th>
                      <th className="px-3 py-3 text-right">Quantity</th>
                      <th className="px-3 py-3">Unit</th>
                      <th className="px-3 py-3 text-right">Est. Unit Price</th>
                      <th className="px-3 py-3 text-right">GST %</th>
                      <th className="px-3 py-3">Required Brand</th>
                      <th className="px-3.5 py-3">Spec Files</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors align-top even:bg-slate-50/40">
                        <td className="px-3.5 py-4 text-center text-slate-400 font-mono font-bold text-[11px]">{idx + 1}</td>

                        <td className="px-4 py-4 max-w-[260px]">
                          <p className="font-extrabold text-slate-900 text-xs leading-snug">{item.name}</p>
                          {item.desc && (
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-3">{item.desc}</p>
                          )}
                        </td>

                        <td className="px-3 py-4 text-right font-black text-slate-900 whitespace-nowrap">
                          {item.qty.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-4 text-slate-600 font-semibold text-[11px]">{item.unit}</td>
                        <td className="px-3 py-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          {item.price ? fmt(item.price) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-4 text-right text-slate-700 font-bold">{item.gst}%</td>
                        <td className="px-3 py-4 text-slate-700 font-semibold">
                          {item.brand ? (
                            <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">{item.brand}</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Any / flexible</span>
                          )}
                        </td>

                        <td className="px-3.5 py-4 min-w-[150px]">
                          {item.itemFiles.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {item.itemFiles.map((f, fi) => (
                                <button
                                  key={fi}
                                  type="button"
                                  onClick={() => openFileAsset(f.fid ?? f.url ?? f)}
                                  title={f.name}
                                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors text-left max-w-[200px]"
                                >
                                  <Paperclip className="h-3 w-3 shrink-0 text-blue-500" />
                                  <span className="truncate leading-tight">{f.name}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── E. Attachments & Buyer Documents Card ── */}
            <Card
              icon={Paperclip}
              title="Buyer Documents & Attached Specifications"
              badge={
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600">
                  {docs.length} File{docs.length !== 1 ? 's' : ''}
                </span>
              }
            >
              {docs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {docs.map((doc, i) => (
                    <div
                      key={doc.id ?? i}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 hover:border-blue-300 hover:bg-blue-50/20 transition-all shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{doc.type}</span>
                            {doc.required && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-700 uppercase tracking-wide">
                                Required
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {doc.fid || doc.url ? (
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openFileAsset(doc.fid ?? doc.url)}
                            className="h-8 px-3 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-2">Checklist</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-slate-100">
                  <Paperclip className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No external documents attached by buyer</p>
                </div>
              )}
            </Card>

            {/* ── F. Terms & Conditions Accordion ── */}
            <Card icon={Scale} title="Terms & Conditions Accordion">
              <div className="space-y-2">
                {[
                  { id: 'commercial', title: 'Commercial & Payment Terms', content: payTerms },
                  { id: 'delivery', title: 'Delivery Terms & Site Location', content: delTerms },
                  { id: 'warranty', title: 'Warranty & After-Sales Support', content: warranty },
                  { id: 'penalty', title: 'Penalty & Liquidation Clauses', content: penalty },
                  { id: 'evaluation', title: 'Evaluation & Award Criteria', content: `Evaluation Basis: ${evalMethod}. Bids evaluated based on technical compliance and price competitiveness.` },
                ].map((sec) => {
                  const isOpen = expandedAccordion === sec.id;
                  return (
                    <div key={sec.id} className="rounded-xl border border-slate-200/80 bg-white overflow-hidden transition-all">
                      <button
                        type="button"
                        onClick={() => setExpandedAccordion(isOpen ? null : sec.id)}
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-xs font-bold text-slate-900 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          {sec.title}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-slate-100 bg-slate-50/60 p-4 text-xs font-medium text-slate-700 leading-relaxed">
                          {sec.content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ── G. Seller Responses & Quotations (Buyer / Admin View) ── */}
            {(isBuyerOrAdmin || sellerResponses.length > 0) && (
              <Card
                icon={ClipboardCheck}
                title="Seller Responses & Quotations"
                badge={
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
                    {sellerResponses.length} {sellerResponses.length === 1 ? 'Response' : 'Responses'}
                  </span>
                }
              >
                {buyerResponsesLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-xs font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Loading seller responses...
                  </div>
                ) : sellerResponses.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200/80">
                    <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No seller responses submitted yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Quotations submitted by sellers for this RFQ will appear here immediately.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Seller / Supplier</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Quoted Price</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Delivery SLA</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Submitted On</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sellerResponses.map((resp) => (
                          <tr key={resp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5">
                              <p className="font-extrabold text-slate-900 text-[12px]">{resp.sellerOrgName}</p>
                              <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                <span>{resp.sellerName}</span>
                                {resp.sellerEmail && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="truncate max-w-[150px]">{resp.sellerEmail}</span>
                                  </>
                                )}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 font-black text-emerald-700 text-[13px]">
                              {resp.offeredPrice != null ? fmt(resp.offeredPrice) : '—'}
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-slate-700 text-[11px]">
                              {resp.deliveryTimeline || '—'}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-[11px] font-medium whitespace-nowrap">
                              {fmtDate(resp.submittedAt, true)}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                <CheckCircle className="h-3 w-3" /> {resp.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedBuyerResponse(resp)}
                                className="h-7 px-3 text-[11px] font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg"
                              >
                                <Eye className="h-3 w-3 mr-1" /> View Quote
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* ── H. Clarifications Q&A Panel ── */}
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
              RIGHT STICKY SIDEBAR (30%)
              ────────────────────────────────────────────────── */}
          <div className="space-y-5 xl:sticky xl:top-24">

            {/* ── Card 1: Submission Action & Countdown Card ── */}
            <div className={cn(
              'rounded-2xl border-2 overflow-hidden shadow-sm transition-all',
              submitted ? 'border-emerald-300' : timer.isPassed ? 'border-rose-300' : 'border-blue-400',
            )}>
              <div className={cn(
                'flex items-center justify-between px-5 py-3.5 text-white',
                submitted ? 'bg-emerald-600' : timer.isPassed ? 'bg-rose-600' : 'bg-blue-600',
              )}>
                <p className="text-[11px] font-black uppercase tracking-wider">
                  {submitted ? 'Quotation Submitted' : 'Action Required'}
                </p>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  {submitted ? 'Locked' : isPassed ? 'Closed' : 'Open'}
                </span>
              </div>

              <div className="bg-white p-5 space-y-4">
                {submitted ? (
                  <>
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-emerald-950">Quotation Submitted & Active</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">Submitted on {fmtDate(ownResponse?.submittedAt || ownResponse?.createdAt, true)}</p>
                      </div>
                    </div>

                    <Button
                      onClick={handleSubmitQuotation}
                      className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-xs"
                    >
                      <Eye className="h-4 w-4" /> View Submitted Quotation
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Countdown Display Box */}
                    <div className="rounded-xl bg-slate-900 p-4 text-white space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Submission Closing In</p>
                      <p className={cn('text-xl font-black leading-tight', timer.isPassed ? 'text-rose-400' : 'text-white')}>
                        {timer.label}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">{fmtDate(deadline, true)}</p>
                    </div>

                    {/* Value Summary */}
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs text-slate-500 font-bold">Estimated Budget</span>
                      <span className="text-sm font-black text-emerald-700">{fmt(value)}</span>
                    </div>

                    {/* Primary Submit Button */}
                    {user?.role === 'seller' ? (
                      <Button
                        onClick={handleSubmitQuotation}
                        disabled={isPassed || isClosed}
                        className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs gap-2 shadow-md shadow-blue-100"
                      >
                        Submit Quotation <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmitQuotation}
                        className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2"
                      >
                        Login to Submit Quotation <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}

                    {(isPassed || isClosed) && (
                      <p className="text-center text-[11px] text-rose-500 font-semibold">
                        This RFQ is no longer accepting new quotations.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Card 2: EMD Requirement Card ── */}
            <EmdCard emdInfo={emdInfo} loading={emdLoading} onPayClick={() => setIsEmdModalOpen(true)} procurementType={buyType} />

            {/* ── Card 3: Buyer Information Card ── */}
            <Card icon={Building2} title="Buyer Organization" iconBg="bg-violet-50" iconColor="text-violet-600">
              <div className="space-y-3">
                <div>
                  <p className="font-black text-slate-900 text-xs">{buyerOrg}</p>
                  <span className="inline-flex items-center gap-1 mt-1 rounded-md bg-violet-50 border border-violet-100 px-2 py-0.5 text-[10px] font-extrabold text-violet-700">
                    <ShieldCheck className="h-3 w-3 text-violet-500" /> {buyerType}
                  </span>
                </div>

                <div className="space-y-2 pt-2.5 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <UserCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span><strong className="text-slate-800">Contact:</strong> {contact}</span>
                  </div>
                  {email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{email}</span>
                    </div>
                  )}
                  {mobile && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{mobile}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{location}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Card 4: Key Procurement Specs ── */}
            <Card icon={Truck} title="Commercial Specs">
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

      {/* ════════════════════════════════════════════════════════
          6. STICKY BOTTOM ACTION BAR (Mobile & Tablet)
          ════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:px-6 xl:hidden shadow-lg">
        <div className="mx-auto flex items-center justify-between gap-3 max-w-[1440px]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase text-slate-400 truncate">Est. Budget: <span className="text-emerald-700 font-extrabold">{fmt(value)}</span></p>
            <p className="text-xs font-black text-slate-900 truncate">{title}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold">
              <Download className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            {user?.role === 'seller' && (
              submitted ? (
                <Button size="sm" onClick={handleSubmitQuotation} className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                  View Quote
                </Button>
              ) : (
                <Button size="sm" onClick={handleSubmitQuotation} disabled={isPassed || isClosed} className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                  Submit Quote
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Buyer Response Details Modal ── */}
      {selectedBuyerResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <button
              onClick={() => setSelectedBuyerResponse(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{selectedBuyerResponse.sellerOrgName}</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Submitted on {fmtDate(selectedBuyerResponse.submittedAt, true)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Quoted Total Price</p>
                  <p className="text-lg font-black text-emerald-800 mt-1">{selectedBuyerResponse.offeredPrice != null ? fmt(selectedBuyerResponse.offeredPrice) : '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery SLA</p>
                  <p className="text-sm font-extrabold text-slate-800 mt-1">{selectedBuyerResponse.deliveryTimeline || '—'}</p>
                </div>
              </div>

              {selectedBuyerResponse.lineItems && selectedBuyerResponse.lineItems.length > 0 && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Item-Wise Quotes</p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Item</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Unit Price</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">GST %</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Brand</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedBuyerResponse.lineItems.map((li: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-bold text-slate-800">{li.itemName || li.name || `Item ${idx + 1}`}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">{li.unitPrice != null ? `₹${Number(li.unitPrice).toLocaleString('en-IN')}` : '—'}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{li.gstPercent != null ? `${li.gstPercent}%` : '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{li.makeBrand || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedBuyerResponse.message && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cover Note / Message</p>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{selectedBuyerResponse.message}</p>
                </div>
              )}

              {selectedBuyerResponse.terms && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Commercial Terms</p>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{selectedBuyerResponse.terms}</p>
                </div>
              )}

              {selectedBuyerResponse.documents && selectedBuyerResponse.documents.length > 0 && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Uploaded Attachments</p>
                  <div className="space-y-1.5">
                    {selectedBuyerResponse.documents.map((doc: any, i: number) => {
                      const dName = doc.fileName || doc.name || doc.documentName || `Document ${i + 1}`;
                      const dUrl = doc.fileUrl || doc.url || (doc.fileAssetId ? `/api/files/${doc.fileAssetId}/view` : null);
                      return (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-xs font-bold text-slate-800 truncate">{dName}</span>
                          {dUrl && (
                            <Button size="sm" variant="outline" onClick={() => openFileAsset(doc.fileAssetId ?? dUrl)} className="h-6 px-2 text-[10px] font-bold text-blue-600">
                              View
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setSelectedBuyerResponse(null)} className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 h-9 rounded-xl">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

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
          handleSubmitQuotation();
        }}
      />
    </div>
  );
}
