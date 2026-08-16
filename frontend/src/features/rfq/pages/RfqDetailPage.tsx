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
import { ProcurementDetailUnifiedView } from '../components/ProcurementDetailUnifiedView';

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
    const isMidnightUtc = dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0;
    const hh = isMidnightUtc ? '23' : dt.getHours().toString().padStart(2, '0');
    const mm = isMidnightUtc ? '59' : dt.getMinutes().toString().padStart(2, '0');
    return `${day} ${mo} ${yr}, ${hh}:${mm} IST`;
  } catch { return String(d); }
};

const calcTimeLeft = (d?: string | Date | null) => {
  if (!d) return { label: '—', isPassed: false };
  let dt = new Date(d);
  if (isNaN(dt.getTime())) return { label: '—', isPassed: false };
  if (dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0) {
    dt = new Date(dt.getTime());
    dt.setHours(23, 59, 59, 999);
  }
  const ms = dt.getTime() - Date.now();
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

export default function RfqDetailPage({ initialData }: { initialData?: any } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();

  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>('commercial');

  const explicitReqId = searchParams?.get('requirementId') || '';
  const explicitRequestId = searchParams?.get('requestId') || searchParams?.get('bidId') || searchParams?.get('rfqId') || '';
  const rawIdParam = searchParams?.get('id') || '';

  const pathTokens = pathname.split('/').filter(Boolean);
  const rawPathId = pathTokens.length >= 2 ? pathTokens[pathTokens.length - 1] : '';
  const pathnameId = (rawPathId && !['bids', 'tenders', 'details', 'rfq'].includes(rawPathId.toLowerCase())) ? rawPathId : '';

  let requirementId = explicitReqId;
  let requestId = explicitRequestId || (initialData?.bidNumber || initialData?.id ? String(initialData.bidNumber || initialData.id) : pathnameId);

  if (!requirementId && !requestId && (rawIdParam || pathnameId)) {
    const idToken = rawIdParam || pathnameId;
    if (idToken.startsWith('req-')) {
      requirementId = idToken.replace('req-', '');
    } else if (idToken.startsWith('bid-') || idToken.startsWith('qr-')) {
      requestId = idToken.replace(/^(bid|qr)-/, '');
    } else {
      requirementId = idToken;
      requestId = idToken;
    }
  }

  /* ── Queries ── */
  const { data: bidData, isLoading: bidLoading } = useQuery({
    queryKey: ['rfq-detail-bid', requestId],
    queryFn:  () => procurementBidApi.detail(requestId),
    enabled:  !!requestId,
    initialData: initialData?.sourceModel === 'BID' || initialData?.bidNumber ? initialData : undefined,
    staleTime: 60_000,
  });

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['rfq-detail-req', requirementId],
    queryFn:  async () => getApi<any>(`/api/marketplace/requirements/${requirementId}`),
    enabled:  !!requirementId,
    initialData: initialData?.title || initialData?.requirement ? initialData : undefined,
    staleTime: 60_000,
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
    staleTime: 60_000,
  });

  const rawBid: any = bidData || initialData;
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
  const effectiveTargetId = String(requestId || (rawBid as any)?.bidNumber || targetReqId || explicitReqId || requirementId || (rawBid as any)?.id || '');

  const { data: buyerResponsesData } = useQuery({
    queryKey: ['rfq-buyer-responses-v2', effectiveTargetId],
    queryFn: async () => {
      if (!effectiveTargetId) return [];

      const extractArray = (res: any): any[] => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.responses)) return res.responses;
        if (Array.isArray(res.participants)) return res.participants;
        if (Array.isArray(res.participations)) return res.participations;
        if (Array.isArray(res.results)) return res.results;
        if (Array.isArray(res.items)) return res.items;
        if (Array.isArray(res.data)) return extractArray(res.data);
        return [];
      };

      const endpoints = [
        `/api/buyer/requirements/${encodeURIComponent(effectiveTargetId)}/responses?pageSize=50`,
        `/api/buyer/procurement-bids/${encodeURIComponent(effectiveTargetId)}/participants`,
        `/api/marketplace/requirements/${encodeURIComponent(effectiveTargetId)}/responses`,
      ];

      for (const ep of endpoints) {
        try {
          const res = await getApi<any>(ep, true);
          const items = extractArray(res);
          if (items.length > 0) return items;
        } catch {}
      }

      const numMatch = effectiveTargetId.match(/\d+/);
      if (numMatch && numMatch[0] !== effectiveTargetId) {
        const numericStr = numMatch[0];
        for (const ep of [
          `/api/buyer/requirements/${encodeURIComponent(numericStr)}/responses?pageSize=50`,
          `/api/buyer/procurement-bids/${encodeURIComponent(numericStr)}/participants`,
        ]) {
          try {
            const res = await getApi<any>(ep, true);
            const items = extractArray(res);
            if (items.length > 0) return items;
          } catch {}
        }
      }

      return [];
    },
    enabled: Boolean(isBuyerOrAdmin && effectiveTargetId && effectiveTargetId !== 'RFQ'),
    staleTime: 10_000,
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
      const sellerName = r.sellerUser?.name || r.seller?.name || r.sellerName || r.contactPerson || 'Seller Partner';
      const sellerOrgName = r.sellerOrgName
        || r.sellerOrganization?.organizationName
        || r.seller?.organization?.organizationName
        || r.seller?.sellerProfile?.organizationName
        || r.sellerProfile?.organizationName
        || r.seller?.organizationName
        || r.companyName
        || r.sellerName
        || r.sellerUser?.name
        || r.seller?.name
        || (sId ? `Supplier #${sId}` : 'Verified Supplier');

      list.push({
        id: r.id || key,
        sellerId: sId,
        sellerUserId: sId,
        sellerOrganizationId: sOrg,
        sellerName,
        sellerOrgName,
        companyName: sellerOrgName,
        sellerOrganization: r.sellerOrganization || { organizationName: sellerOrgName },
        sellerUser: r.sellerUser || r.seller || { name: sellerName },
        seller: r.seller || { name: sellerName, organization: { organizationName: sellerOrgName } },
        sellerEmail: r.sellerUser?.email || r.seller?.email || r.sellerEmail,
        sellerPhone: r.sellerUser?.mobile || r.seller?.mobile || r.sellerPhone,
        status: statusStr || 'SUBMITTED',
        submissionStatus: statusStr || 'SUBMITTED',
        offeredPrice: offeredPrice != null ? Number(offeredPrice) : null,
        quotedAmount: offeredPrice != null ? Number(offeredPrice) : null,
        totalAmount: offeredPrice != null ? Number(offeredPrice) : null,
        offeredQuantity: r.offeredQuantity ?? respData.offeredQuantity,
        deliveryTimeline: r.deliveryTimeline || respData.deliveryTimeline,
        message: r.message || r.coverNote || respData.message || respData.coverNote,
        terms: r.terms || respData.terms,
        attachmentUrl: r.attachmentUrl || respData.attachmentUrl,
        documents: Array.isArray(r.documents) ? r.documents : (Array.isArray(respData.documents) ? respData.documents : []),
        lineItems: Array.isArray(r.lineItems) ? r.lineItems : (Array.isArray(respData.lineItems) ? respData.lineItems : (Array.isArray(respData.lineQuotes) ? respData.lineQuotes : [])),
        submittedAt: r.submittedAt || r.createdAt || r.updatedAt,
        responseData: respData,
      });
    }

    return list;
  }, [buyerResponsesData, reqData?.responses, rawBid?.participations, rawBid?.quoteResponses, rawBid?.results]);

  /* ══════════════════════════════════════════════════════════════════════════
     DATA RESOLUTION  — pull buyer-submitted fields in priority order
     ══════════════════════════════════════════════════════════════════════════ */
  const preferReq  = Boolean(explicitReqId || (reqObj && !explicitRequestId));
  const ref        = preferReq 
    ? (reqObj?.requirementNumber || requirementId || requestId || rawBid?.bidNumber || rawBid?.id || '—')
    : (requestId || rawBid?.bidNumber || rawBid?.id || requirementId || reqObj?.requirementNumber || '—');

  const rawTitleCandidates = preferReq ? [
    reqObj?.title,
    reqObj?.payload?.basics?.title,
    reqObj?.payload?.basics?.contractTitle,
    rawBid?.title,
    rawBid?.technicalPacket?.basics?.title,
    rawBid?.technicalPacket?.basics?.contractTitle,
    reqObj?.description && reqObj.description.length < 80 ? reqObj.description : null,
    rawBid?.description && rawBid.description.length < 80 ? rawBid.description : null,
  ] : [
    rawBid?.title,
    reqObj?.title,
    rawBid?.technicalPacket?.basics?.title,
    reqObj?.payload?.basics?.title,
    rawBid?.technicalPacket?.basics?.contractTitle,
    reqObj?.payload?.basics?.contractTitle,
    rawBid?.description && rawBid.description.length < 80 ? rawBid.description : null,
    reqObj?.description && reqObj.description.length < 80 ? reqObj.description : null,
  ];

  const validTitle = rawTitleCandidates.find(t => {
    if (!t) return false;
    const s = String(t).trim().toLowerCase();
    return !(s === 'procurement bid' || s.startsWith('procurement bid #') || s.startsWith('procurement #') || s === 'untitled procurement bid' || s === 'procurement requirement' || s === 'n/a' || s === '—');
  });
  const title      = validTitle ? String(validTitle).trim() : (ref !== '—' ? `Procurement #${ref}` : 'Procurement Opportunity');
  const desc       = stripAutoDesc(preferReq ? (reqObj?.description || reqObj?.payload?.basics?.description || rawBid?.description || rawBid?.technicalPacket?.basics?.description) : (rawBid?.description || rawBid?.technicalPacket?.basics?.description || reqObj?.description || reqObj?.payload?.basics?.description));
  const strategy   = preferReq ? (reqObj?.payload?.recommendation?.reason || reqObj?.payload?.basics?.justification || rawBid?.technicalPacket?.recommendation?.reason || rawBid?.technicalPacket?.basics?.justification || '') : (rawBid?.technicalPacket?.recommendation?.reason || rawBid?.technicalPacket?.basics?.justification || reqObj?.payload?.recommendation?.reason || reqObj?.payload?.basics?.justification || '');
  const category   = preferReq ? (reqObj?.category?.name || reqObj?.category || rawBid?.category || rawBid?.technicalPacket?.basics?.category || '—') : (rawBid?.category || reqObj?.category?.name || reqObj?.category || rawBid?.technicalPacket?.basics?.category || '—');
  const method     = preferReq ? (reqObj?.procurementMethod || reqObj?.type || rawBid?.procurementType || rawBid?.bidType || 'RFQ') : (rawBid?.procurementType || rawBid?.bidType || rawBid?.technicalPacket?.basics?.buyingType || reqObj?.procurementMethod || reqObj?.type || 'RFQ');

  const methodUpper = String(method || '').toUpperCase();
  const reqTypeUpper = String(reqObj?.procurementMethod || reqObj?.type || reqObj?.payload?.basics?.procurementMethod || rawBid?.procurementType || rawBid?.bidType || '').toUpperCase();

  const isLimited = methodUpper.includes('LIMITED') || reqTypeUpper.includes('LIMITED');
  const isRateContract = methodUpper.includes('RATE') || methodUpper.includes('CONTRACT') || reqTypeUpper.includes('RATE');
  const isRfp = (methodUpper.includes('RFP') || methodUpper.includes('PROPOSAL') || reqTypeUpper.includes('RFP')) && !isRateContract && !isLimited;
  const isOpenTender = !isLimited && !isRateContract && !isRfp && (
    methodUpper.includes('TENDER') ||
    methodUpper.includes('OPEN') ||
    reqTypeUpper.includes('TENDER') ||
    reqTypeUpper.includes('OPEN')
  );

  const derivedProcurementType = isLimited ? 'LIMITED_TENDER'
    : isOpenTender ? 'OPEN_TENDER'
    : isRateContract ? 'RATE_CONTRACT'
    : isRfp ? 'RFP'
    : 'RFQ';

  const derivedProcurementLabel = derivedProcurementType === 'LIMITED_TENDER' ? 'Limited Tender'
    : derivedProcurementType === 'OPEN_TENDER' ? 'Open Tender'
    : derivedProcurementType === 'RATE_CONTRACT' ? 'Rate Contract'
    : derivedProcurementType === 'RFP' ? 'Request for Proposal'
    : 'Request for Quotation';

  const derivedBackRouteLabel = derivedProcurementType === 'LIMITED_TENDER' ? 'Limited Tender Opportunities'
    : derivedProcurementType === 'OPEN_TENDER' ? 'Open Tender Opportunities'
    : derivedProcurementType === 'RATE_CONTRACT' ? 'Rate Contract Opportunities'
    : derivedProcurementType === 'RFP' ? 'RFP Opportunities'
    : 'RFQ Opportunities';
  const buyType    = preferReq ? (reqObj?.payload?.basics?.bidType || rawBid?.technicalPacket?.basics?.bidType || 'Product') : (rawBid?.technicalPacket?.basics?.bidType || rawBid?.technicalPacket?.basics?.whatAreYouBuying || reqObj?.payload?.basics?.bidType || 'Product');
  const value      = preferReq ? (reqObj?.estimatedValue || reqObj?.budgetMax || rawBid?.estimatedValue || rawBid?.technicalPacket?.basics?.estimatedValue) : (rawBid?.estimatedValue || reqObj?.estimatedValue || reqObj?.budgetMax || rawBid?.technicalPacket?.basics?.estimatedValue);
  const deadline   = preferReq ? (reqObj?.lastDate || reqObj?.requiredBy || reqObj?.payload?.schedule?.submissionDate || rawBid?.endDate) : (rawBid?.technicalPacket?.schedule?.submissionDate || rawBid?.technicalPacket?.schedule?.submissionDeadline || reqObj?.payload?.schedule?.submissionDate || reqObj?.payload?.schedule?.submissionDeadline || rawBid?.endDate || reqObj?.lastDate || reqObj?.requiredBy);
  const published  = preferReq ? (reqObj?.approvedAt || reqObj?.createdAt || rawBid?.startDate) : (rawBid?.technicalPacket?.schedule?.submissionStartDate || rawBid?.technicalPacket?.schedule?.publishDate || reqObj?.payload?.schedule?.submissionStartDate || rawBid?.startDate || rawBid?.createdAt || reqObj?.createdAt);
  const location   = preferReq ? (reqObj?.location || reqObj?.deliveryLocation || rawBid?.deliveryLocation || '—') : (rawBid?.deliveryLocation || reqObj?.location || rawBid?.technicalPacket?.basics?.deliveryLocation || '—');
  const buyerOrg   = preferReq ? (reqObj?.buyerOrganization?.organizationName || reqObj?.organization?.organizationName || reqObj?.buyerName || rawBid?.buyerOrganizationName || '—') : (rawBid?.buyerOrganizationName || rawBid?.buyerOrganization?.organizationName || rawBid?.buyer?.name || reqObj?.buyerOrganization?.organizationName || reqObj?.organization?.organizationName || '—');
  const buyerType  = preferReq ? (reqObj?.buyerType || reqObj?.buyerOrganization?.type || rawBid?.buyerType || 'Private Buyer') : (rawBid?.buyerType || rawBid?.technicalPacket?.basics?.buyerType || 'Private Buyer');
  const contact    = preferReq ? (reqObj?.contactPerson || reqObj?.buyer?.name || reqObj?.buyerUser?.name || rawBid?.technicalPacket?.internal?.contactPerson || '—') : (rawBid?.technicalPacket?.internal?.contactPerson || rawBid?.buyer?.name || reqObj?.contactPerson || reqObj?.buyer?.name || '—');
  const email      = preferReq ? (reqObj?.buyerEmail || reqObj?.createdBy?.email || rawBid?.buyer?.email || '') : (rawBid?.technicalPacket?.internal?.email || rawBid?.buyer?.email || reqObj?.buyerEmail || reqObj?.createdBy?.email || '');
  const mobile     = preferReq ? (reqObj?.buyerMobile || reqObj?.createdBy?.mobile || rawBid?.buyer?.mobile || '') : (rawBid?.technicalPacket?.internal?.mobile || rawBid?.buyer?.mobile || reqObj?.buyerMobile || reqObj?.createdBy?.mobile || '');
  const payTerms   = preferReq ? (reqObj?.paymentTerms || reqObj?.payload?.terms?.paymentTerms || rawBid?.technicalPacket?.terms?.paymentTerms || '100% after delivery and acceptance') : (rawBid?.technicalPacket?.terms?.paymentTerms || reqObj?.paymentTerms || reqObj?.payload?.terms?.paymentTerms || '100% after delivery and acceptance');
  const delTerms   = preferReq ? (reqObj?.deliveryTerms || reqObj?.payload?.terms?.deliveryTerms || rawBid?.technicalPacket?.terms?.deliveryTerms || 'Door delivery to site') : (rawBid?.technicalPacket?.terms?.deliveryTerms || reqObj?.deliveryTerms || reqObj?.payload?.terms?.deliveryTerms || 'Door delivery to site');
  const warranty   = preferReq ? (reqObj?.payload?.terms?.warrantyTerms || rawBid?.technicalPacket?.terms?.warrantyTerms || '12 Months') : (rawBid?.technicalPacket?.terms?.warrantyTerms || reqObj?.payload?.terms?.warrantyTerms || '12 Months');
  const penalty    = preferReq ? (reqObj?.payload?.terms?.penaltyClause || rawBid?.technicalPacket?.terms?.penaltyClause || '0.5% per week for delay') : (rawBid?.technicalPacket?.terms?.penaltyClause || reqObj?.payload?.terms?.penaltyClause || '0.5% per week for delay');
  const evalMethod = preferReq ? (reqObj?.payload?.rules?.evaluationMethod || rawBid?.evaluationMethod || 'L1 Basis') : (rawBid?.evaluationMethod || rawBid?.technicalPacket?.rules?.evaluationMethod || reqObj?.payload?.rules?.evaluationMethod || 'L1 Basis');
  const packetType = preferReq ? (reqObj?.payload?.rules?.packetType || rawBid?.packetType || 'Single Packet') : (rawBid?.packetType || rawBid?.technicalPacket?.rules?.packetType || reqObj?.payload?.rules?.packetType || 'Single Packet');
  const clarDeadline = preferReq ? (reqObj?.payload?.schedule?.clarificationDeadline || rawBid?.technicalPacket?.schedule?.clarificationDeadline) : (rawBid?.technicalPacket?.schedule?.clarificationDeadline || rawBid?.technicalPacket?.schedule?.clarificationEndDate || reqObj?.payload?.schedule?.clarificationDeadline || reqObj?.payload?.schedule?.clarificationEndDate);
  const techOpen   = preferReq ? (reqObj?.technicalOpeningDate || reqObj?.payload?.schedule?.technicalOpeningDate || rawBid?.technicalOpeningDate) : (rawBid?.technicalOpeningDate || rawBid?.technicalPacket?.schedule?.technicalOpeningDate || reqObj?.technicalOpeningDate || reqObj?.payload?.schedule?.technicalOpeningDate);
  const status     = preferReq ? (reqObj?.status || rawBid?.status || 'OPEN') : (rawBid?.status || reqObj?.status || 'OPEN');

  const subCategory = rawBid?.technicalPacket?.basics?.subCategory || rawBid?.technicalPacket?.basics?.subcategory || reqObj?.payload?.basics?.subCategory || reqObj?.payload?.basics?.subcategory || '—';
  const projectDuration = rawBid?.technicalPacket?.basics?.projectDuration || rawBid?.technicalPacket?.terms?.contractPeriod || reqObj?.payload?.basics?.projectDuration || reqObj?.payload?.terms?.contractPeriod || '—';
  const department = rawBid?.technicalPacket?.internal?.department || rawBid?.buyer?.buyerProfile?.departmentName || rawBid?.buyer?.buyerProfile?.department || reqObj?.buyerOrganization?.department || reqObj?.payload?.internal?.department || '—';

  /* ── Derived flags ── */
  let deadlineDt = deadline ? new Date(deadline) : null;
  if (deadlineDt && !isNaN(deadlineDt.getTime()) && deadlineDt.getUTCHours() === 0 && deadlineDt.getUTCMinutes() === 0 && deadlineDt.getUTCSeconds() === 0) {
    deadlineDt = new Date(deadlineDt.getTime());
    deadlineDt.setHours(23, 59, 59, 999);
  }
  const isClosed   = ['AWARDED', 'CLOSED', 'CANCELLED'].includes(String(status).toUpperCase());
  const isPassed   = !!deadlineDt && deadlineDt.getTime() < Date.now();
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
     RENDER MAIN PAGE (UNIFIED REFERENCE UI)
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <ProcurementDetailUnifiedView
      procurementType={derivedProcurementType}
      procurementLabel={derivedProcurementLabel}
      backRouteLabel={derivedBackRouteLabel}
      id={targetReqId || requestId || 'RFQ'}
      displayId={ref}
      subject={title}
      status={status}
      buyerName={contact}
      orgName={buyerOrg}
      buyer={{ name: contact, email, mobile, buyerProfile: reqObj?.buyerOrganization || rawBid?.buyerOrganization || rawBid?.buyer?.buyerProfile }}
      estimatedValue={value}
      deadlineDate={deadline}
      createdAt={published}
      publishedDate={published ? fmtDate(published) : undefined}
      closingDate={deadline ? fmtDate(deadline, true) : undefined}
      clarificationDate={clarDeadline ? fmtDate(clarDeadline, true) : undefined}
      technicalDate={techOpen ? fmtDate(techOpen, true) : undefined}
      category={category}
      subCategory={subCategory}
      projectDuration={projectDuration}
      department={department}
      contactPerson={contact}
      buyerEmail={email}
      buyerMobile={mobile}
      procurementMethod={method}
      buyingType={buyType}
      deliveryLocation={location}
      paymentTerms={payTerms}
      deliveryTerms={delTerms}
      description={desc}
      payload={rawBid?.technicalPacket || reqObj?.payload || {}}
      documents={docs}
      items={items}
      evaluationMethod={evalMethod}
      participations={sellerResponses}
      participantsCount={sellerResponses.length}
      hasSubmittedProposal={submitted}
      ownParticipation={ownParticipation}
      ownResponse={ownResponse}
      emdAmount={emdRes?.emdAmount}
      isEmdRequired={emdRes?.isEmdRequired}
      backRoute={isBuyerOrAdmin ? "/buyer/my-procurements" : "/seller/opportunities/rfqs"}
      submitButtonLabel={isBuyerOrAdmin ? 'View Evaluation & Results' : (submitted ? 'View Quotation' : 'Submit Quotation')}
      onSubmitClick={isBuyerOrAdmin ? () => router.push(`/bids/${effectiveTargetId || requestId}/results`) : handleSubmitQuotation}
      onDownloadClick={handleDownloadPdf}
      clarificationKind={requirementId || (rawBid?.sourceModel === 'REQUIREMENT') ? 'requirement' : 'quote-request'}
      clarificationEntityId={requirementId || rawBid?.sourceId || targetReqId || requestId}
    />
  );
}
