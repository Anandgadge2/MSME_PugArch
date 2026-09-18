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
import { getApi, postApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { PdfEngine, moneyPdf } from '../../../lib/pdfEngine';
import ClarificationPanel from '../components/ClarificationPanel';
import { procurementBidApi } from '../../procurementBid/api';
import { ProcurementDetailUnifiedView, ProcurementDetailSkeleton } from '../components/ProcurementDetailUnifiedView';
import { CancelProcurementModal } from '../../procurement/components/CancelProcurementModal';
import { sanitizeUom, sanitizeHsn } from '../utils/quoteItemParser';

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const fmt = (val?: number | string | null): string => {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(val);
  if (isNaN(n) || n === 0) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const fmtDate = (d?: string | Date | null, includeTime?: boolean): string => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = dt.getDate().toString().padStart(2, '0');
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()];
    const yr = dt.getFullYear();
    const isDateOnlyStr = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim());
    const isMidnightUtc = dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0;
    if (isDateOnlyStr || (isMidnightUtc && !includeTime)) {
      return `${day} ${mo} ${yr}`;
    }
    const shouldIncludeTime = includeTime !== undefined ? includeTime : (!isDateOnlyStr && !isMidnightUtc);
    if (!shouldIncludeTime) return `${day} ${mo} ${yr}`;
    let hours = dt.getHours();
    const mm = dt.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    let h12 = hours % 12;
    if (h12 === 0) h12 = 12;
    const hh = h12.toString().padStart(2, '0');
    return `${day} ${mo} ${yr}, ${hh}:${mm} ${ampm}`;
  } catch { return String(d); }
};

const calcTimeLeft = (d?: string | Date | null) => {
  if (!d) return { label: '—', isPassed: false };
  let dt = new Date(d);
  if (isNaN(dt.getTime())) return { label: '—', isPassed: false };
  const isDateOnlyStr = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim());
  const isMidnightUtc = dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0;
  if (isDateOnlyStr || isMidnightUtc) {
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
    <div className="flex items-center justify-between gap-2.5 sm:gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40">
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full sm:w-auto">
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
  <div className="flex items-center gap-2.5 sm:gap-3.5 px-5 py-4 min-w-[170px] flex-1 border-r border-slate-100 last:border-0">
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

  const activeId = explicitReqId || explicitRequestId || rawIdParam || pathnameId;

  let requirementId = explicitReqId;
  let requestId = explicitRequestId;

  if (explicitReqId) {
    requirementId = explicitReqId;
    // Do NOT set requestId to explicitReqId - Requirement IDs and ProcurementBid IDs are separate tables
  } else if (explicitRequestId) {
    requestId = explicitRequestId;
  } else if (rawIdParam) {
    if (String(rawIdParam).toUpperCase().startsWith('REQ-')) {
      requirementId = rawIdParam;
    } else {
      requestId = rawIdParam;
      if (pathname.includes('/buyer') || pathname.includes('/requirement')) {
        requirementId = rawIdParam;
      }
    }
  } else if (pathnameId) {
    if (String(pathnameId).toUpperCase().startsWith('REQ-')) {
      requirementId = pathnameId;
    } else {
      requestId = pathnameId;
      if (pathname.includes('/buyer') || pathname.includes('/requirement')) {
        requirementId = pathnameId;
      }
    }
  } else if (initialData) {
    if ((initialData.sourceModel === 'REQUIREMENT' && !initialData.bidNumber) || (!initialData.bidNumber && initialData.requirementId)) {
      requirementId = String(initialData.requirementId || initialData.id || '');
    } else {
      requestId = String(initialData.bidNumber || initialData.id || '');
    }
  }

  const isMatchingInitial = Boolean(
    initialData && (
      !activeId ||
      String(initialData.id).toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.requirementNumber || '').toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.bidNumber || '').toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.displayId || '').toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.sourceId || '').toLowerCase() === String(activeId).toLowerCase()
    )
  );

  /* ── Queries ── */
  const { data: bidData, isLoading: bidLoading } = useQuery({
    queryKey: ['rfq-detail-bid', requestId],
    queryFn:  () => procurementBidApi.detail(requestId),
    enabled:  Boolean(requestId && (!explicitReqId || requestId !== explicitReqId)),
    initialData: Boolean(requestId) && isMatchingInitial && (initialData?.sourceModel === 'BID' || initialData?.sourceModel === 'PROCUREMENT_BID' || initialData?.bidNumber) ? initialData : undefined,
    staleTime: 60_000,
  });

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['rfq-detail-req', requirementId],
    queryFn:  async () => getApi<any>(`/api/marketplace/requirements/${requirementId}`),
    enabled:  Boolean(requirementId),
    initialData: Boolean(requirementId) && isMatchingInitial && (initialData?.sourceModel === 'REQUIREMENT' || initialData?.requirementNumber?.startsWith('REQ-')) ? (initialData.requirement || initialData) : undefined,
    staleTime: 60_000,
  });

  const [isEmdModalOpen, setIsEmdModalOpen] = useState(false);
  const [selectedBuyerResponse, setSelectedBuyerResponse] = useState<any>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const bidPacket: any = (bidData as any)?.technicalPacket && typeof (bidData as any).technicalPacket === 'object'
    ? (bidData as any).technicalPacket
    : {};
  const activeBidId = (bidData as any)?.id || (initialData as any)?.id;
  const linkedRequirementId = bidPacket.sourceRequirementId || bidPacket.requirementId || bidPacket.linkedRequirementId || (bidData as any)?.sourceId;
  const targetReqId = requirementId || (reqData as any)?.requirement?.id || activeBidId || requestId || linkedRequirementId;

  const { data: ownResponseQueryData } = useQuery({
    queryKey: ['rfq-own-response', targetReqId, requestId],
    queryFn:  async () => {
      try { return await getApi<any>(`/api/marketplace/requirements/${targetReqId}`); }
      catch { return null; }
    },
    enabled:   (!!targetReqId || !!requestId) && user?.role === 'seller',
    staleTime: 60_000,
  });

  const rawBid: any = bidData || (initialData?.bidNumber || initialData?.sourceModel === 'BID' ? initialData : null);
  const reqObj: any = (reqData as any)?.requirement ?? reqData;

  const rawBidMatches = Boolean(rawBid && (!activeId || String(rawBid.id) === String(activeId) || String(rawBid.bidNumber || '').toLowerCase() === String(activeId).toLowerCase()));
  const reqObjMatches = Boolean(reqObj && (!activeId || String(reqObj.id) === String(activeId) || String(reqObj.requirementNumber || '').toLowerCase() === String(activeId).toLowerCase()));
  const preferReq = Boolean(explicitReqId ? reqObjMatches : (!rawBidMatches && reqObjMatches));

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
    if (typeof window === 'undefined' || !user || user.role !== 'seller' || !user.id) return null;
    const keys = [targetReqId, requirementId, requestId, (rawBid as any)?.id, (rawBid as any)?.bidNumber].filter(Boolean);
    for (const k of keys) {
      try {
        const item = localStorage.getItem(`rfq_submitted_${user.id}_${k}`);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed && parsed.status && String(parsed.status).toUpperCase() !== 'DRAFT') {
            if (!parsed.userId || String(parsed.userId) === String(user.id)) {
              return parsed;
            }
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
      status: ownParticipation.submissionStatus ?? ownParticipation.status ?? 'DRAFT',
      submissionStatus: ownParticipation.submissionStatus ?? ownParticipation.status ?? 'DRAFT',
      createdAt: ownParticipation.createdAt,
      submittedAt: ownParticipation.submittedAt ?? null,
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

  const hasValidInitialData = Boolean(
    initialData &&
    typeof initialData === 'object' &&
    (initialData.id || initialData.bidNumber || initialData.requirementNumber || initialData.title)
  );
  const isQueryInProgress = (Boolean(requestId) && bidLoading) || (Boolean(requirementId) && reqLoading);
  const hasData = Boolean(bidData || reqData || (hasValidInitialData && (rawBid || reqObj)));
  const isLoading = (!hasData && isQueryInProgress) || (!rawBid && !reqObj && isQueryInProgress);

  /* ── Buyer Seller Responses Query ── */
  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin' || user?.role === 'master_admin';
  const effectiveTargetId = String(
    preferReq
      ? (targetReqId || explicitReqId || requirementId || (rawBid as any)?.bidNumber || requestId || '')
      : (requestId || (rawBid as any)?.bidNumber || targetReqId || explicitReqId || requirementId || (rawBid as any)?.id || '')
  );

  const { data: buyerResponsesData } = useQuery({
    queryKey: ['rfq-buyer-responses-v2', effectiveTargetId, targetReqId, (rawBid as any)?.id],
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
        if (res.data) return extractArray(res.data);
        return [];
      };

      const trailingDigits = effectiveTargetId.match(/\d+/g);
      const lastNumericPart = trailingDigits ? trailingDigits[trailingDigits.length - 1] : null;
      const rawTargetReqId = targetReqId !== undefined && targetReqId !== null ? String(targetReqId) : null;
      const absTargetReqId = rawTargetReqId && !isNaN(Number(rawTargetReqId)) && Number(rawTargetReqId) !== 0 ? String(Math.abs(Number(rawTargetReqId))) : null;
      const rawBidId = (rawBid as any)?.id !== undefined && (rawBid as any)?.id !== null ? String((rawBid as any)?.id) : null;

      const candidateTokens = Array.from(new Set([
        effectiveTargetId,
        rawBidId,
        (rawBid as any)?.bidNumber,
        rawTargetReqId,
        absTargetReqId,
        requirementId ? String(requirementId) : null,
        requestId,
        lastNumericPart
      ].filter(Boolean) as string[]));

      for (const token of candidateTokens) {
        const endpoints = [
          `/api/buyer/requirements/${encodeURIComponent(token)}/responses?pageSize=50`,
          `/api/buyer/procurement-bids/${encodeURIComponent(token)}/participants`,
          `/api/marketplace/requirements/${encodeURIComponent(token)}/responses`,
        ];

        for (const ep of endpoints) {
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
    // Sealed Bidding Strict Confidentiality: Sellers must strictly NEVER see other sellers' quotations
    if (user?.role === 'seller') {
      return ownParticipation ? [ownParticipation] : [];
    }

    const rawList = [
      ...(Array.isArray(buyerResponsesData) ? buyerResponsesData : []),
      ...(Array.isArray(reqData?.responses) ? reqData.responses : []),
      ...(Array.isArray(rawBid?.participations) ? rawBid.participations : []),
      ...(Array.isArray(rawBid?.quoteResponses) ? rawBid.quoteResponses : []),
      ...(Array.isArray(rawBid?.results) ? rawBid.results : []),
    ];

    const vendorMap = new Map<string, any>();
    const list: any[] = [];

    const getVendorKeys = (item: any) => {
      const sId = item.sellerUserId || item.sellerId || item.seller?.id || item.sellerUser?.id;
      const sOrg = item.sellerOrganizationId || item.sellerOrgId || item.seller?.organizationId || item.sellerUser?.organizationId || item.seller?.organization?.id;
      const sOrgName = (
        item.sellerOrgName ||
        item.sellerOrganization?.organizationName ||
        item.seller?.organization?.organizationName ||
        item.seller?.sellerProfile?.organizationName ||
        item.sellerProfile?.organizationName ||
        item.companyName ||
        item.sellerName ||
        ''
      ).trim().toLowerCase();

      const keys: string[] = [];
      if (sOrg && String(sOrg) !== '0' && String(sOrg) !== 'undefined') keys.push(`org-${sOrg}`);
      if (sId && String(sId) !== '0' && String(sId) !== 'undefined') keys.push(`user-${sId}`);
      if (sOrgName && !sOrgName.startsWith('supplier #') && !sOrgName.startsWith('verified supplier') && !sOrgName.startsWith('seller partner')) {
        keys.push(`name-${sOrgName}`);
      }
      return { sId, sOrg, sOrgName, keys };
    };

    for (const r of rawList) {
      if (!r) continue;
      const statusStr = String(r.status || r.submissionStatus || '').toUpperCase();
      if (statusStr === 'DRAFT') continue;

      const { sId, sOrg, sOrgName, keys } = getVendorKeys(r);

      // Check if this vendor has already been seen under any canonical key
      let existing = keys.map(k => vendorMap.get(k)).find(Boolean);

      const respData = typeof r.responseData === 'string'
        ? (() => { try { return JSON.parse(r.responseData); } catch { return {}; } })()
        : (r.responseData || {});
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

      const rawTechStatus = String(r.technicalStatus || respData.technicalStatus || '').toUpperCase();
      const isTechEvaluated = rawTechStatus === 'QUALIFIED' || rawTechStatus === 'DISQUALIFIED' || rawTechStatus === 'NOT_QUALIFIED';
      const normalizedTechStatus = rawTechStatus === 'QUALIFIED'
        ? 'QUALIFIED'
        : (rawTechStatus === 'DISQUALIFIED' || rawTechStatus === 'NOT_QUALIFIED' || statusStr === 'REJECTED' ? 'DISQUALIFIED' : 'PENDING');

      const itemOfferedQty = Number(r.offeredQuantity ?? respData.offeredQuantity ?? 0);
      const itemTimeline = r.deliveryTimeline || respData.deliveryTimeline;
      const itemDocs = Array.isArray(r.documents) ? r.documents : (Array.isArray(respData.documents) ? respData.documents : []);
      const itemLines = Array.isArray(r.lineItems) ? r.lineItems : (Array.isArray(respData.lineItems) ? respData.lineItems : (Array.isArray(respData.lineQuotes) ? respData.lineQuotes : []));

      if (existing) {
        // Merge records for the single authentic vendor entity
        // 1. Technical Evaluation Priority: If this record has evaluation decisions, apply them
        if (isTechEvaluated && existing.technicalStatus === 'PENDING') {
          existing.technicalStatus = normalizedTechStatus;
          existing.technicalRemarks = r.technicalRemarks || r.rejectionReason || respData.technicalRemarks || existing.technicalRemarks;
          existing.score = r.score ?? respData.score ?? existing.score;
          existing.isDisqualified = normalizedTechStatus === 'DISQUALIFIED' || Boolean(r.isDisqualified) || existing.isDisqualified;
        }

        // 2. Quotation details: preserve authentic offered quantity, timeline, line items, documents
        if (!existing.offeredQuantity && itemOfferedQty > 0) {
          existing.offeredQuantity = itemOfferedQty;
        }
        if ((!existing.deliveryTimeline || existing.deliveryTimeline === 'Standard') && itemTimeline && itemTimeline !== 'Standard') {
          existing.deliveryTimeline = itemTimeline;
        }
        if ((!existing.offeredPrice || existing.offeredPrice === 0) && offeredPrice != null && Number(offeredPrice) > 0) {
          existing.offeredPrice = Number(offeredPrice);
          existing.quotedAmount = Number(offeredPrice);
          existing.totalAmount = Number(offeredPrice);
        }
        if ((!existing.lineItems || existing.lineItems.length === 0) && itemLines.length > 0) {
          existing.lineItems = itemLines;
        }
        if ((!existing.documents || existing.documents.length === 0) && itemDocs.length > 0) {
          existing.documents = itemDocs;
        }
        if (r.id && !existing.participationId && String(r.participationNumber || '').startsWith('PRT-')) {
          existing.participationId = r.id;
          existing.id = r.id;
        }
        if (r.message || r.coverNote || respData.message) {
          existing.message = existing.message || r.message || r.coverNote || respData.message;
        }

        // Register any new keys pointing to this merged vendor
        for (const k of keys) {
          vendorMap.set(k, existing);
        }
      } else {
        const newRecord: any = {
          id: r.id || (keys[0] ? `v-${keys[0]}` : `item-${list.length}`),
          participationId: r.participationNumber ? r.id : undefined,
          quoteResponseId: !r.participationNumber ? r.id : undefined,
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
          offeredQuantity: itemOfferedQty > 0 ? itemOfferedQty : undefined,
          deliveryTimeline: (itemTimeline && itemTimeline !== 'Standard') ? itemTimeline : undefined,
          message: r.message || r.coverNote || respData.message || respData.coverNote,
          terms: r.terms || respData.terms,
          attachmentUrl: r.attachmentUrl || respData.attachmentUrl,
          documents: itemDocs,
          lineItems: itemLines,
          submittedAt: r.submittedAt || r.createdAt || r.updatedAt,
          responseData: respData,
          technicalStatus: normalizedTechStatus,
          technicalRemarks: r.technicalRemarks || r.rejectionReason || respData.technicalRemarks || '',
          score: r.score ?? respData.score ?? null,
          isDisqualified: normalizedTechStatus === 'DISQUALIFIED' || Boolean(r.isDisqualified),
        };

        list.push(newRecord);
        if (keys.length > 0) {
          for (const k of keys) {
            vendorMap.set(k, newRecord);
          }
        } else {
          vendorMap.set(`id-${newRecord.id}`, newRecord);
        }
      }
    }

    return list;
  }, [buyerResponsesData, reqData?.responses, rawBid?.participations, rawBid?.quoteResponses, rawBid?.results]);

  /* ══════════════════════════════════════════════════════════════════════════
     DATA RESOLUTION  — pull buyer-submitted fields in priority order
     ══════════════════════════════════════════════════════════════════════════ */
  const ref        = preferReq 
    ? (reqObj?.requirementNumber || requirementId || requestId || rawBid?.bidNumber || rawBid?.id || '—')
    : (requestId || rawBid?.bidNumber || rawBid?.id || requirementId || reqObj?.requirementNumber || '—');

  const rawTitleCandidates = preferReq ? [
    reqObj?.title,
    reqObj?.subject,
    reqObj?.name,
    reqObj?.payload?.basics?.title,
    reqObj?.payload?.basics?.contractTitle,
    rawBid?.title,
    rawBid?.subject,
    rawBid?.itemName,
    rawBid?.name,
    rawBid?.technicalPacket?.basics?.title,
    rawBid?.technicalPacket?.basics?.contractTitle,
    (Array.isArray(reqObj?.items) && reqObj.items[0]?.itemName) || null,
    (Array.isArray(rawBid?.items) && rawBid.items[0]?.itemName) || null,
  ] : [
    rawBid?.title,
    rawBid?.subject,
    rawBid?.itemName,
    rawBid?.name,
    reqObj?.title,
    reqObj?.subject,
    reqObj?.name,
    rawBid?.technicalPacket?.basics?.title,
    reqObj?.payload?.basics?.title,
    rawBid?.technicalPacket?.basics?.contractTitle,
    reqObj?.payload?.basics?.contractTitle,
    (Array.isArray(rawBid?.items) && rawBid.items[0]?.itemName) || null,
    (Array.isArray(reqObj?.items) && reqObj.items[0]?.itemName) || null,
  ];

  const validTitle = rawTitleCandidates.find(t => {
    if (!t) return false;
    const s = String(t).trim().toLowerCase();
    return !(
      s === 'procurement bid' ||
      s.startsWith('procurement bid #') ||
      s.startsWith('procurement #') ||
      s === 'untitled procurement bid' ||
      s === 'procurement requirement' ||
      s.includes('no description') ||
      s.includes('no scope') ||
      s === 'n/a' ||
      s === '—'
    );
  });
  const title      = validTitle ? String(validTitle).trim() : (ref !== '—' ? `Procurement #${ref}` : 'Procurement Opportunity');
  const desc       = stripAutoDesc(preferReq ? (reqObj?.description || reqObj?.payload?.basics?.description || rawBid?.description || rawBid?.technicalPacket?.basics?.description) : (rawBid?.description || rawBid?.technicalPacket?.basics?.description || reqObj?.description || reqObj?.payload?.basics?.description));
  const strategy   = preferReq ? (reqObj?.payload?.recommendation?.reason || reqObj?.payload?.basics?.justification || rawBid?.technicalPacket?.recommendation?.reason || rawBid?.technicalPacket?.basics?.justification || '') : (rawBid?.technicalPacket?.recommendation?.reason || rawBid?.technicalPacket?.basics?.justification || reqObj?.payload?.recommendation?.reason || reqObj?.payload?.basics?.justification || '');
  const category   = preferReq ? (reqObj?.category?.name || reqObj?.category || rawBid?.category || rawBid?.technicalPacket?.basics?.category || '—') : (rawBid?.category || reqObj?.category?.name || reqObj?.category || rawBid?.technicalPacket?.basics?.category || '—');
  const rawDescUpper = String(rawBid?.description || reqObj?.description || reqObj?.payload?.basics?.description || '').toUpperCase();
  const explicitMethod = preferReq
    ? (reqObj?.procurementMethod || reqObj?.type || rawBid?.procurementMethod || rawBid?.procurementType || rawBid?.bidType)
    : (rawBid?.procurementMethod || rawBid?.procurementType || rawBid?.bidType || reqObj?.procurementMethod || reqObj?.type);
  const method = explicitMethod || (rawDescUpper.includes('SOURCING METHOD: RFQ') ? 'RFQ' : (rawBid?.technicalPacket?.basics?.buyingType || 'RFQ'));

  const methodUpper = String(method || '').toUpperCase();
  const reqTypeUpper = String(reqObj?.procurementMethod || reqObj?.type || reqObj?.payload?.basics?.procurementMethod || rawBid?.procurementType || rawBid?.bidType || '').toUpperCase();

  const isRfqExplicit =
    methodUpper.includes('RFQ') ||
    methodUpper.includes('QUOTATION') ||
    reqTypeUpper.includes('RFQ') ||
    reqTypeUpper.includes('QUOTATION') ||
    rawDescUpper.includes('SOURCING METHOD: RFQ') ||
    rawDescUpper.includes('METHOD: RFQ') ||
    String(ref).toUpperCase().startsWith('RFQ-');

  const isLimited = !isRfqExplicit && (methodUpper.includes('LIMITED') || reqTypeUpper.includes('LIMITED'));
  const isRateContract = !isRfqExplicit && !isLimited && (methodUpper.includes('RATE_CONTRACT') || methodUpper === 'RATE CONTRACT' || reqTypeUpper.includes('RATE_CONTRACT') || reqTypeUpper === 'RATE CONTRACT' || methodUpper.startsWith('RC-') || reqTypeUpper.startsWith('RC-'));
  const isRfp = !isRfqExplicit && !isRateContract && !isLimited && (methodUpper.includes('RFP') || methodUpper.includes('REQUEST FOR PROPOSAL') || reqTypeUpper.includes('RFP') || reqTypeUpper.includes('REQUEST FOR PROPOSAL'));
  const isOpenTender = !isRfqExplicit && !isLimited && !isRateContract && !isRfp && (
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
  const deadline   = preferReq
    ? (reqObj?.payload?.schedule?.submissionDate || reqObj?.payload?.schedule?.submissionDeadline || reqObj?.lastDate || rawBid?.endDate || reqObj?.requiredBy)
    : (rawBid?.technicalPacket?.schedule?.submissionDate || rawBid?.technicalPacket?.schedule?.submissionDeadline || reqObj?.payload?.schedule?.submissionDate || reqObj?.payload?.schedule?.submissionDeadline || rawBid?.endDate || reqObj?.lastDate || reqObj?.requiredBy);
  const resolvePublishedCandidate = (...candidates: any[]) => {
    const valid = candidates.filter(Boolean);
    const withTime = valid.find(c => {
      if (typeof c === 'string') return c.includes('T') && !c.includes('T00:00:00');
      if (c instanceof Date) return c.getHours() !== 0 || c.getMinutes() !== 0;
      return false;
    });
    return withTime || valid[0];
  };
  const createdCandidate = reqObj?.createdAt || rawBid?.createdAt || null;
  const approvedCandidate = reqObj?.approvedAt || rawBid?.approvedAt || rawBid?.publishedAt || null;
  const formPublishCandidate = preferReq
    ? (reqObj?.payload?.schedule?.publishDate || rawBid?.technicalPacket?.schedule?.publishDate)
    : (rawBid?.technicalPacket?.schedule?.publishDate || reqObj?.payload?.schedule?.publishDate);

  const published = (() => {
    if (approvedCandidate) return approvedCandidate;
    const tCreated = createdCandidate ? new Date(createdCandidate).getTime() : NaN;
    if (formPublishCandidate && Number.isFinite(tCreated)) {
      const tPub = new Date(formPublishCandidate).getTime();
      if (Number.isFinite(tPub) && tPub > tCreated + 60000 && tPub > Date.now()) {
        return formPublishCandidate;
      }
    }
    return createdCandidate || formPublishCandidate || rawBid?.startDate || null;
  })();
  const explicitSubmissionStartDate = preferReq
    ? (reqObj?.submissionStartDate || reqObj?.payload?.schedule?.submissionStartDate || reqObj?.payload?.schedule?.startDate || reqObj?.payload?.tender?.bidStartDate || rawBid?.submissionStartDate || rawBid?.technicalPacket?.schedule?.submissionStartDate)
    : (rawBid?.submissionStartDate || rawBid?.technicalPacket?.schedule?.submissionStartDate || rawBid?.startDate || reqObj?.submissionStartDate || reqObj?.payload?.schedule?.submissionStartDate || reqObj?.payload?.schedule?.startDate || reqObj?.payload?.tender?.bidStartDate);
  const submissionStartDate = explicitSubmissionStartDate || published;
  const location   = preferReq ? (reqObj?.location || reqObj?.deliveryLocation || rawBid?.deliveryLocation || '—') : (rawBid?.deliveryLocation || reqObj?.location || rawBid?.technicalPacket?.basics?.deliveryLocation || '—');
  const buyerOrg   = preferReq ? (reqObj?.buyerOrganization?.organizationName || reqObj?.organization?.organizationName || reqObj?.buyerName || rawBid?.buyerOrganizationName || '—') : (rawBid?.buyerOrganizationName || rawBid?.buyerOrganization?.organizationName || rawBid?.buyer?.name || reqObj?.buyerOrganization?.organizationName || reqObj?.organization?.organizationName || '—');
  const buyerType  = preferReq ? (reqObj?.buyerType || reqObj?.buyerOrganization?.type || rawBid?.buyerType || 'Private Buyer') : (rawBid?.buyerType || rawBid?.technicalPacket?.basics?.buyerType || 'Private Buyer');
  const contact    = preferReq ? (reqObj?.buyer?.buyerProfile?.representativeName || reqObj?.buyerProfile?.representativeName || reqObj?.contactPerson || reqObj?.buyerPersonName || reqObj?.buyer?.name || reqObj?.buyerUser?.name || rawBid?.buyer?.buyerProfile?.representativeName || rawBid?.buyerPersonName || rawBid?.technicalPacket?.internal?.contactPerson || '—') : (rawBid?.buyer?.buyerProfile?.representativeName || rawBid?.buyerProfile?.representativeName || rawBid?.buyerPersonName || rawBid?.technicalPacket?.internal?.contactPerson || rawBid?.contactPerson || rawBid?.buyer?.name || reqObj?.buyer?.buyerProfile?.representativeName || reqObj?.contactPerson || reqObj?.buyer?.name || '—');
  const email      = preferReq ? (reqObj?.buyerEmail || reqObj?.buyer?.buyerProfile?.email || reqObj?.buyerProfile?.email || reqObj?.buyer?.email || reqObj?.createdBy?.email || rawBid?.buyerEmail || rawBid?.buyer?.buyerProfile?.email || rawBid?.buyer?.email || '') : (rawBid?.buyerEmail || rawBid?.buyer?.buyerProfile?.email || rawBid?.buyerProfile?.email || rawBid?.buyer?.email || rawBid?.technicalPacket?.internal?.email || reqObj?.buyerEmail || reqObj?.buyer?.buyerProfile?.email || reqObj?.createdBy?.email || '');
  const mobile     = preferReq ? (reqObj?.buyerMobile || reqObj?.buyer?.buyerProfile?.phone || reqObj?.buyer?.buyerProfile?.mobile || reqObj?.buyerProfile?.mobile || reqObj?.buyer?.mobile || reqObj?.createdBy?.mobile || rawBid?.buyerMobile || rawBid?.buyer?.buyerProfile?.phone || rawBid?.buyer?.buyerProfile?.mobile || rawBid?.buyer?.mobile || '') : (rawBid?.buyerMobile || rawBid?.buyer?.buyerProfile?.phone || rawBid?.buyer?.buyerProfile?.mobile || rawBid?.buyerProfile?.mobile || rawBid?.buyer?.mobile || rawBid?.technicalPacket?.internal?.mobile || reqObj?.buyerMobile || reqObj?.buyer?.buyerProfile?.mobile || reqObj?.createdBy?.mobile || '');
  const buyerAddress = preferReq ? (reqObj?.buyerAddress || reqObj?.buyer?.buyerProfile?.registeredAddress || reqObj?.buyer?.buyerProfile?.address || reqObj?.buyerProfile?.registeredAddress || reqObj?.buyerOrganization?.registeredAddress || rawBid?.buyerAddress || rawBid?.buyer?.buyerProfile?.registeredAddress || rawBid?.buyer?.buyerProfile?.address || '') : (rawBid?.buyerAddress || rawBid?.buyer?.buyerProfile?.registeredAddress || rawBid?.buyer?.buyerProfile?.address || rawBid?.buyerProfile?.registeredAddress || rawBid?.buyerOrganization?.registeredAddress || reqObj?.buyerAddress || reqObj?.buyer?.buyerProfile?.registeredAddress || reqObj?.buyer?.buyerProfile?.address || '');
  const payTerms   = preferReq ? (reqObj?.paymentTerms || reqObj?.payload?.terms?.paymentTerms || rawBid?.technicalPacket?.terms?.paymentTerms || '100% after delivery and acceptance') : (rawBid?.technicalPacket?.terms?.paymentTerms || reqObj?.paymentTerms || reqObj?.payload?.terms?.paymentTerms || '100% after delivery and acceptance');
  const delTerms   = preferReq ? (reqObj?.deliveryTerms || reqObj?.payload?.terms?.deliveryTerms || rawBid?.technicalPacket?.terms?.deliveryTerms || 'Door delivery to site') : (rawBid?.technicalPacket?.terms?.deliveryTerms || reqObj?.deliveryTerms || reqObj?.payload?.terms?.deliveryTerms || 'Door delivery to site');
  const warranty   = preferReq ? (reqObj?.payload?.terms?.warrantyTerms || rawBid?.technicalPacket?.terms?.warrantyTerms || '12 Months') : (rawBid?.technicalPacket?.terms?.warrantyTerms || reqObj?.payload?.terms?.warrantyTerms || '12 Months');
  const evalCandidates = [
    reqObj?.payload?.evaluation?.method,
    reqObj?.payload?.evaluation?.evaluationMethod,
    reqObj?.payload?.evaluationMethod,
    reqObj?.payload?.rules?.evaluationMethod,
    reqObj?.payload?.tender?.evaluationMethod,
    reqObj?.payload?.wizardData?.evaluation?.method,
    reqObj?.evaluationMethod,
    rawBid?.technicalPacket?.evaluation?.method,
    rawBid?.technicalPacket?.evaluation?.evaluationMethod,
    rawBid?.technicalPacket?.evaluationMethod,
    rawBid?.technicalPacket?.rules?.evaluationMethod,
    rawBid?.technicalPacket?.tender?.evaluationMethod,
    rawBid?.technicalPacket?.wizardData?.evaluation?.method,
    rawBid?.payload?.evaluation?.method,
    rawBid?.payload?.evaluationMethod,
    rawBid?.evaluationMethod,
  ];
  const specificEvalMethod = evalCandidates.find(
    c => typeof c === 'string' && c.trim().length > 0 && !['l1', 'l1 basis', 'l1 evaluation'].includes(c.trim().toLowerCase())
  );
  const evalMethod = specificEvalMethod || evalCandidates.find(
    c => typeof c === 'string' && c.trim().length > 0 && c.trim() !== 'null' && c.trim() !== 'undefined'
  ) || 'L1 Basis';
  const clarDeadline = preferReq ? (reqObj?.payload?.schedule?.clarificationDeadline || rawBid?.technicalPacket?.schedule?.clarificationDeadline) : (rawBid?.technicalPacket?.schedule?.clarificationDeadline || rawBid?.technicalPacket?.schedule?.clarificationEndDate || reqObj?.payload?.schedule?.clarificationDeadline || reqObj?.payload?.schedule?.clarificationEndDate);
  const techOpen   = preferReq
    ? (reqObj?.technicalOpeningDate || reqObj?.payload?.schedule?.technicalOpeningDate || reqObj?.payload?.tender?.technicalEvaluationDate || reqObj?.payload?.technicalOpeningDate || rawBid?.technicalOpeningDate || rawBid?.technicalPacket?.schedule?.technicalOpeningDate)
    : (rawBid?.technicalOpeningDate || rawBid?.technicalPacket?.schedule?.technicalOpeningDate || reqObj?.technicalOpeningDate || reqObj?.payload?.schedule?.technicalOpeningDate || reqObj?.payload?.tender?.technicalEvaluationDate || reqObj?.payload?.technicalOpeningDate);
  const finOpen    = preferReq
    ? (reqObj?.financialOpeningDate || reqObj?.payload?.schedule?.financialOpeningDate || reqObj?.payload?.tender?.financialEvaluationDate || reqObj?.payload?.schedule?.finalEvaluationDate || reqObj?.payload?.financialOpeningDate || rawBid?.financialOpeningDate || rawBid?.technicalPacket?.schedule?.financialOpeningDate)
    : (rawBid?.financialOpeningDate || rawBid?.technicalPacket?.schedule?.financialOpeningDate || reqObj?.financialOpeningDate || reqObj?.payload?.schedule?.financialOpeningDate || reqObj?.payload?.tender?.financialEvaluationDate || reqObj?.payload?.schedule?.finalEvaluationDate || reqObj?.payload?.financialOpeningDate);
  const packetType = preferReq
    ? (reqObj?.packetType || reqObj?.payload?.schedule?.packetType || reqObj?.payload?.rules?.packetType || reqObj?.payload?.packetType || (finOpen ? 'Two Packet' : rawBid?.packetType) || 'Single Packet')
    : (rawBid?.packetType || rawBid?.technicalPacket?.schedule?.packetType || rawBid?.technicalPacket?.rules?.packetType || reqObj?.payload?.schedule?.packetType || (finOpen ? 'Two Packet' : 'Single Packet'));
  const bidValDate = preferReq ? (reqObj?.payload?.schedule?.bidValidityDate) : (rawBid?.technicalPacket?.schedule?.bidValidityDate || reqObj?.payload?.schedule?.bidValidityDate);
  const reqByDate  = preferReq ? (reqObj?.requiredBy || reqObj?.payload?.basics?.requiredByDate || rawBid?.technicalPacket?.basics?.requiredByDate) : (rawBid?.technicalPacket?.basics?.requiredByDate || reqObj?.requiredBy || reqObj?.payload?.basics?.requiredByDate);
  const status     = preferReq ? (reqObj?.status || rawBid?.status || 'OPEN') : (rawBid?.status || reqObj?.status || 'OPEN');

  const projectDuration = preferReq
    ? (reqObj?.payload?.basics?.projectDuration || reqObj?.payload?.terms?.contractPeriod || rawBid?.technicalPacket?.basics?.projectDuration || rawBid?.technicalPacket?.terms?.contractPeriod || '—')
    : (rawBid?.technicalPacket?.basics?.projectDuration || rawBid?.technicalPacket?.terms?.contractPeriod || reqObj?.payload?.basics?.projectDuration || reqObj?.payload?.terms?.contractPeriod || '—');
  const department = preferReq
    ? (reqObj?.buyerOrganization?.department || reqObj?.payload?.internal?.department || rawBid?.technicalPacket?.internal?.department || rawBid?.buyer?.buyerProfile?.departmentName || rawBid?.buyer?.buyerProfile?.department || '—')
    : (rawBid?.technicalPacket?.internal?.department || rawBid?.buyer?.buyerProfile?.departmentName || rawBid?.buyer?.buyerProfile?.department || reqObj?.buyerOrganization?.department || reqObj?.payload?.internal?.department || '—');

  /* ── Derived flags ── */
  let deadlineDt = deadline ? new Date(deadline) : null;
  if (deadlineDt && !isNaN(deadlineDt.getTime()) && deadlineDt.getUTCHours() === 0 && deadlineDt.getUTCMinutes() === 0 && deadlineDt.getUTCSeconds() === 0) {
    deadlineDt = new Date(deadlineDt.getTime());
    deadlineDt.setHours(23, 59, 59, 999);
  }
  const isClosed   = ['AWARDED', 'CLOSED', 'CANCELLED'].includes(String(status).toUpperCase());
  const isPassed   = !!deadlineDt && deadlineDt.getTime() < Date.now();
  const submitted  = Boolean(
    (ownResponse && String(ownResponse.status || ownResponse.submissionStatus || '').toUpperCase() === 'SUBMITTED') ||
    rawBid?.hasSubmittedProposal
  );
  const statusUpper = String(status || 'OPEN').toUpperCase();
  const canCancel  = isBuyerOrAdmin && !['CANCELLED', 'AWARDED', 'COMPLETED', 'CLOSED'].includes(statusUpper);

  /* ── Line Items ── */
  const reqItemCandidates: any[][] = [
    Array.isArray(reqObj?.items) ? reqObj.items : null,
    Array.isArray(reqObj?.payload?.boqTable) ? reqObj.payload.boqTable : null,
    Array.isArray(reqObj?.payload?.items) ? reqObj.payload.items : null,
    Array.isArray(reqObj?.payload?.lineItems) ? reqObj.payload.lineItems : null,
    Array.isArray(reqObj?.payload?.wizardData?.items) ? reqObj.payload.wizardData.items : null,
    Array.isArray(reqObj?.payload?.wizardData?.boqTable) ? reqObj.payload.wizardData.boqTable : null,
    Array.isArray(reqObj?.payload?.boq) ? reqObj.payload.boq : null,
    Array.isArray(reqObj?.payload?.basics?.items) ? reqObj.payload.basics.items : null,
    Array.isArray(reqObj?.boqTable) ? reqObj.boqTable : null,
  ].filter((c): c is any[] => Array.isArray(c) && c.length > 0);

  const bidItemCandidates: any[][] = [
    Array.isArray(rawBid?.items) ? rawBid.items : null,
    Array.isArray(rawBid?.technicalPacket?.items) ? rawBid.technicalPacket.items : null,
    Array.isArray(rawBid?.technicalPacket?.boqTable) ? rawBid.technicalPacket.boqTable : null,
    Array.isArray(rawBid?.technicalPacket?.lineItems) ? rawBid.technicalPacket.lineItems : null,
    Array.isArray(rawBid?.technicalPacket?.boq) ? rawBid.technicalPacket.boq : null,
    Array.isArray(rawBid?.technicalPacket?.wizardData?.items) ? rawBid.technicalPacket.wizardData.items : null,
    Array.isArray(rawBid?.technicalPacket?.wizardData?.boqTable) ? rawBid.technicalPacket.wizardData.boqTable : null,
    Array.isArray(rawBid?.boqTable) ? rawBid.boqTable : null,
  ].filter((c): c is any[] => Array.isArray(c) && c.length > 0);

  let rawItems: any[] = [];
  if (preferReq) {
    if (reqItemCandidates.length > 0) {
      rawItems = reqItemCandidates[0];
    } else if (bidItemCandidates.length > 0) {
      rawItems = bidItemCandidates[0];
    }
  } else {
    if (bidItemCandidates.length > 0) {
      rawItems = bidItemCandidates[0];
    } else if (reqItemCandidates.length > 0) {
      rawItems = reqItemCandidates[0];
    }
  }

  /* helper: collect unique spec-files from an item raw object */
  const collectItemFiles = (it: any): { name: string; fileName: string; fid?: number; fileAssetId?: number; id?: number; url?: string; fileUrl?: string }[] => {
    const sp = (typeof it.specifications === 'object' && it.specifications) ? it.specifications : {};
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenNames = new Set<string>();
    const result: { name: string; fileName: string; fid?: number; fileAssetId?: number; id?: number; url?: string; fileUrl?: string }[] = [];

    const push = (name?: string, fid?: any, url?: string) => {
      const fileAssetId = fid ? Number(fid) : undefined;
      const cleanUrl = url ? String(url).split('?')[0].trim().toLowerCase() : '';
      let extractedId = fileAssetId ? String(fileAssetId) : undefined;
      if (!extractedId && cleanUrl) {
        const match = cleanUrl.match(/\/files\/(\d+)/i);
        if (match) extractedId = match[1];
      }

      const fName = name && name !== 'Specification File' && name !== 'Procurement Document'
        ? String(name).trim()
        : (cleanUrl ? cleanUrl.split('/').pop()?.split('?')[0] : undefined) || (extractedId ? `File #${extractedId}` : undefined);
      if (!fName && !extractedId && !cleanUrl) return;

      const lowerName = String(fName || '').toLowerCase().trim();
      const isGeneric = !lowerName || lowerName === 'document' || lowerName === 'attachment' || lowerName === 'specification file' || lowerName === 'procurement document';

      if (extractedId && seenIds.has(extractedId)) return;
      if (cleanUrl && seenUrls.has(cleanUrl)) return;
      if (!isGeneric && lowerName && seenNames.has(lowerName)) return;

      if (extractedId) seenIds.add(extractedId);
      if (cleanUrl) seenUrls.add(cleanUrl);
      if (!isGeneric && lowerName) seenNames.add(lowerName);

      const finalUrl = url || (extractedId ? `/api/files/${extractedId}/view` : undefined);
      const finalName = fName || (extractedId ? `File #${extractedId}` : 'Document');
      const numId = extractedId ? Number(extractedId) : fileAssetId;

      result.push({
        name: finalName,
        fileName: finalName,
        fid: numId,
        fileAssetId: numId,
        id: numId,
        url: finalUrl,
        fileUrl: finalUrl,
      });
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
      else { push(f.fileName || f.name || f.originalName || f.documentName || f.specificationFileName, f.fileAssetId || f.fid || f.id, f.fileUrl || f.url || f.attachmentUrl); }
    }

    return result;
  };

  const items = rawItems.map((it: any, idx: number) => {
    const sp = (typeof it.specifications === 'object' && it.specifications) ? it.specifications : {};
    const collectedFiles = collectItemFiles(it);
    const estRate = it.estimatedUnitPrice !== undefined && it.estimatedUnitPrice !== null
      ? Number(it.estimatedUnitPrice)
      : (it.unitPrice !== undefined && it.unitPrice !== null
          ? Number(it.unitPrice)
          : (sp.estimatedUnitPrice !== undefined && sp.estimatedUnitPrice !== null
              ? Number(sp.estimatedUnitPrice)
              : (sp.unitPrice !== undefined && sp.unitPrice !== null ? Number(sp.unitPrice) : undefined)));

    const brandPref = it.brand_preference || it.brandPreference || it.brand || it.brandName || sp.brand_preference || sp.brandPreference || sp.brand || '';
    const brandFlex = it.brand_flexible || it.brandFlexible || sp.brand_flexible || sp.brandFlexible || 'Yes';
    const rawHsn = it.hsn_sac_code || it.hsn || it.hsnSacCode || sp.hsn_sac_code || sp.hsn || sp.hsnCode || '';
    const hsn = sanitizeHsn(rawHsn);
    const itemType = it.itemType || sp.itemType || 'Product';
    const cleanUom = sanitizeUom(it.unitOfMeasure || it.unit || sp.unit || 'Nos');

    return {
      ...it,
      id: String(it.id ?? idx + 1),
      itemType,
      type: itemType,
      name: it.itemName || it.name || it.title || sp.itemName || `Item #${idx + 1}`,
      itemName: it.itemName || it.name || it.title || sp.itemName || `Item #${idx + 1}`,
      desc: it.description || sp.description || it.specification || '',
      description: it.description || sp.description || it.specification || '',
      specification: it.specification || it.description || sp.description || sp.specification || '',
      qty: Number(it.quantity || sp.quantity || 1),
      quantity: Number(it.quantity || sp.quantity || 1),
      unit: cleanUom,
      unitOfMeasure: cleanUom,
      price: estRate,
      estimatedUnitPrice: estRate,
      unitPrice: estRate,
      hsn_sac_code: hsn,
      hsn,
      brand: brandPref,
      brandPreference: brandPref,
      brand_preference: brandPref,
      brandPolicy: brandFlex,
      brandFlexible: brandFlex,
      brand_flexible: brandFlex,
      gst: it.gstPercent ?? it.gst ?? sp.gstPercent ?? 18,
      specifications: {
        ...sp,
        itemType,
        hsn_sac_code: hsn,
        brand_preference: brandPref,
        brand_flexible: brandFlex,
        estimatedUnitPrice: estRate,
      },
      itemFiles: collectedFiles,
      attachments: collectedFiles.length ? collectedFiles : ((Array.isArray(it.attachments) && it.attachments.length) ? it.attachments : (sp.attachments || [])),
    };
  });
  if (!items.length) {
    items.push({
      id: 'item-1', name: title, desc: desc || 'Primary procurement item',
      qty: Number(rawBid?.quantity || reqObj?.quantity || 1),
      unit: sanitizeUom(rawBid?.unit || reqObj?.unit || 'Nos'),
      unitOfMeasure: sanitizeUom(rawBid?.unit || reqObj?.unit || 'Nos'),
      price: value ? Number(value) : undefined,
      gst: 18, brand: '', itemFiles: [],
    });
  }

  /* ── Documents ── */
  const reqDocs = [
    ...(Array.isArray(reqObj?.documents) ? reqObj.documents : []),
    ...(Array.isArray(reqObj?.payload?.documents) ? reqObj.payload.documents : []),
    ...(Array.isArray(reqObj?.payload?.requiredDocs) ? reqObj.payload.requiredDocs : []),
  ];
  const bidDocs = [
    ...(Array.isArray(rawBid?.documents) ? rawBid.documents : []),
    ...(Array.isArray(rawBid?.technicalPacket?.documents) ? rawBid.technicalPacket.documents : []),
    ...(Array.isArray(rawBid?.requiredDocuments)
      ? rawBid.requiredDocuments.map((n: any) => typeof n === 'string' ? { fileName: n, documentType: 'REQUIRED' } : n)
      : []),
  ];
  const rawDocs: any[] = preferReq
    ? (reqDocs.length ? reqDocs : bidDocs)
    : (bidDocs.length ? bidDocs : reqDocs);
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
  const handleDownloadPdf = async () => {
    try {
      toast.info('Generating PDF…');
      const engine = new PdfEngine();
      const doc = await engine.generate({
        documentTitle: 'REQUEST FOR QUOTATION (RFQ)',
        documentNumber: ref,
        dateStr: fmtDate(published),
        status,
        issuerName: buyerOrg !== '—' ? buyerOrg : 'Procuring Entity',
        parties: [
          { title: 'BUYER', name: buyerOrg !== '—' ? buyerOrg : 'N/A', address: location || undefined, email: email || undefined, phone: mobile || undefined, details: [`Contact: ${contact || 'N/A'}`, `Category: ${category || 'N/A'}`] },
          { title: 'RFQ',   name: title || 'N/A',    details: [`Method: ${method || 'N/A'}`, `Deadline: ${fmtDate(deadline, true) || 'N/A'}`] },
        ],
        infoGrid: { Delivery: location || 'N/A', 'Payment Terms': payTerms || 'N/A', 'Delivery SLA': delTerms || 'N/A', 'Evaluation': evalMethod || 'N/A' },
        tableHeaders: ['#', 'Item', 'Qty', 'Unit', 'Est. Price', 'GST'],
        tableData: items.map((it, i) => [String(i + 1), it.name, String(it.qty), it.unit, it.price ? moneyPdf(it.price) : 'N/A', `${it.gst}%`]),
        financials: { grandTotal: Number(value || 0) },
        terms: [`Payment: ${payTerms || 'Standard'}`, `Delivery: ${delTerms || 'Standard'}`, `Evaluation: ${evalMethod || 'Standard'}`, `Warranty: ${warranty || 'Standard'}`],
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
    router.push(`/seller/procurement/rfq/${encodeURIComponent(String(id))}/respond`);
  };

  const isAwarded = String(status).toUpperCase() === 'AWARDED' || 
    (Array.isArray(ownParticipation?.awards) && ownParticipation.awards.some((a: any) => String(a?.awardStatus || '').toUpperCase() === 'ADMIN_APPROVED' || !!a?.awardedAt));

  const { data: invoiceStatusData, isLoading: invoiceStatusLoading } = useQuery({
    queryKey: ['rfq-invoice-status', requestId],
    queryFn: async () => {
      if (!requestId) return { exists: false };
      try {
        const res = await getApi<any>(`/api/seller/procurement-bids/${requestId}/invoice`);
        return res?.data || res || { exists: false };
      } catch (err) {
        return { exists: false };
      }
    },
    enabled: !!requestId && user?.role === 'seller' && isAwarded,
    staleTime: 0,
  });

  const [isConvertingInvoice, setIsConvertingInvoice] = useState(false);

  const handleConvertToInvoice = async () => {
    if (!requestId) return;
    setIsConvertingInvoice(true);
    try {
      const result = await postApi<any>(`/api/seller/procurement-bids/${requestId}/convert-to-invoice`, {});
      toast.success('Invoice generated successfully!');
      
      const createdInvoiceId = result?.id || result?.data?.id;
      
      if (createdInvoiceId) {
        router.push(`/seller/invoices/${createdInvoiceId}`);
      } else {
        router.push('/seller/invoices');
      }
    } catch (err: any) {
      console.error('[Convert Invoice Error]', err);
      toast.error(err?.message || 'Failed to convert to invoice.');
    } finally {
      setIsConvertingInvoice(false);
    }
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
  if (isLoading || (isQueryInProgress && !rawBid && !reqObj)) {
    return <ProcurementDetailSkeleton procurementTypeLabel={derivedProcurementLabel} />;
  }

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
        <Button onClick={() => router.push(user?.role === 'buyer' ? '/procurements' : '/seller/opportunities')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 h-10 rounded-xl">
          {user?.role === 'buyer' ? 'Return to Procurements' : 'Return to Opportunities'}
        </Button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER MAIN PAGE (UNIFIED REFERENCE UI)
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <ProcurementDetailUnifiedView
      procurementType={derivedProcurementType}
      procurementLabel={derivedProcurementLabel}
      backRouteLabel={derivedBackRouteLabel}
      id={rawBid?.id || reqObj?.id || targetReqId || requestId || 'RFQ'}
      displayId={ref}
      subject={title}
      status={status}
      buyerName={contact}
      contactPerson={contact}
      orgName={buyerOrg}
      buyerEmail={email}
      buyerMobile={mobile}
      buyerAddress={buyerAddress}
      buyer={{
        name: contact,
        email,
        mobile,
        buyerProfile: {
          ...(reqObj?.buyerOrganization || {}),
          ...(rawBid?.buyerOrganization || {}),
          ...(rawBid?.buyer?.buyerProfile || {}),
          ...(reqObj?.buyer?.buyerProfile || {}),
          ...(rawBid?.buyerProfile || {}),
          ...(reqObj?.buyerProfile || {}),
          organizationName: buyerOrg,
          representativeName: contact,
          contactPerson: contact,
          email,
          mobile,
          phone: mobile,
          registeredAddress: buyerAddress,
          address: buyerAddress,
          department,
        }
      }}
      estimatedValue={value}
      discloseEstimatedCost={Boolean(
        rawBid?.discloseEstimatedCost ??
        reqObj?.discloseEstimatedCost ??
        reqObj?.payload?.discloseEstimatedCost ??
        reqObj?.payload?.basics?.discloseEstimatedCost ??
        rawBid?.technicalPacket?.discloseEstimatedCost ??
        rawBid?.technicalPacket?.basics?.discloseEstimatedCost ??
        false
      )}
      deadlineDate={deadline}
      createdAt={reqObj?.createdAt || rawBid?.createdAt || published}
      publishedDate={published ? fmtDate(published, true) : undefined}
      submissionStartDate={explicitSubmissionStartDate ? fmtDate(explicitSubmissionStartDate, true) : undefined}
      closingDate={deadline ? fmtDate(deadline, true) : undefined}
      clarificationDate={clarDeadline ? fmtDate(clarDeadline, true) : undefined}
      technicalDate={techOpen ? fmtDate(techOpen, true) : undefined}
      financialDate={finOpen ? fmtDate(finOpen, true) : undefined}
      packetType={packetType}
      bidValidityDate={bidValDate ? fmtDate(bidValDate) : undefined}
      requiredByDate={reqByDate ? fmtDate(reqByDate, true) : undefined}
      category={category}
      projectDuration={projectDuration}
      department={department}
      procurementMethod={method}
      buyingType={buyType}
      deliveryLocation={location}
      paymentTerms={payTerms}
      deliveryTerms={delTerms}
      description={desc}
      payload={preferReq ? (reqObj?.payload || rawBid?.technicalPacket || {}) : (rawBid?.technicalPacket || reqObj?.payload || {})}
      approvalAuthority={rawBid?.approvalAuthority || (preferReq ? reqObj?.approvalAuthority : rawBid?.approvalAuthority) || rawBid?.technicalPacket?.internal?.approvalAuthority || reqObj?.payload?.internal?.approvalAuthority}
      justification={rawBid?.justification || (preferReq ? reqObj?.justification : rawBid?.justification) || rawBid?.technicalPacket?.internal?.justification || reqObj?.payload?.internal?.justification}
      internalDetails={preferReq ? (reqObj?.payload?.internal || rawBid?.technicalPacket?.internal || rawBid?.internalDetails) : (rawBid?.technicalPacket?.internal || rawBid?.internalDetails || reqObj?.payload?.internal)}
      boqTable={preferReq ? (reqObj?.payload?.boqTable || reqObj?.boqTable) : (rawBid?.technicalPacket?.boqTable || rawBid?.boqTable || reqObj?.payload?.boqTable)}
      documents={docs}
      items={items}
      rawBid={rawBid}
      lifecycleStage={rawBid?.lifecycleStage || reqObj?.lifecycleStage}
      quantity={rawBid?.quantity || reqObj?.quantity}
      unit={rawBid?.unit || reqObj?.unit}
      evaluationMethod={evalMethod}
      participations={sellerResponses}
      participantsCount={sellerResponses.length}
      hasSubmittedProposal={submitted}
      ownParticipation={ownParticipation}
      ownResponse={ownResponse}
      emdAmount={emdRes?.emdAmount}
      isEmdRequired={emdRes?.isEmdRequired}
      backRoute={isBuyerOrAdmin ? "/buyer/my-procurements" : "/seller/opportunities/rfqs"}
      submitButtonLabel={isBuyerOrAdmin ? 'View Evaluation & Results' : (submitted ? 'Quotation Submitted' : 'Submit Quotation')}
      onSubmitClick={isBuyerOrAdmin ? () => router.push(`/bids/${effectiveTargetId || requestId}/results`) : handleSubmitQuotation}
      onViewQuotationClick={submitted ? handleSubmitQuotation : undefined}
      onDownloadClick={handleDownloadPdf}
      invoiceStatus={user?.role === 'seller' && isAwarded ? { 
        exists: Boolean(invoiceStatusData?.exists), 
        invoiceId: invoiceStatusData?.invoiceId, 
        loading: invoiceStatusLoading 
      } : null}
      isConvertingInvoice={isConvertingInvoice}
      onConvertToInvoiceClick={handleConvertToInvoice}
      onCancelClick={canCancel ? () => setCancelModalOpen(true) : undefined}
      cancelButtonLabel={statusUpper === 'DRAFT' || statusUpper === 'SUBMITTED' ? 'Withdraw Request' : 'Cancel RFQ'}
      clarificationKind={requirementId || (rawBid?.sourceModel === 'REQUIREMENT') ? 'requirement' : 'quote-request'}
      clarificationEntityId={rawBid?.id || reqObj?.id || requirementId || requestId || targetReqId}
    />
    {canCancel && (
      <CancelProcurementModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        procurement={{
          id: Number(rawBid?.id || reqObj?.id || targetReqId || requestId),
          type: requirementId || rawBid?.sourceModel === 'REQUIREMENT' ? 'requirement' : 'bid_tender',
          title: title,
          referenceNumber: ref,
          typeLabel: derivedProcurementLabel || 'RFQ',
          status: statusUpper,
        }}
        onConfirm={async (params) => {
          await postApi('/api/buyer/procurements/cancel', params);
          toast.success('RFQ cancelled successfully');
          router.push('/buyer/my-procurements');
        }}
      />
    )}
    </>
  );
}
