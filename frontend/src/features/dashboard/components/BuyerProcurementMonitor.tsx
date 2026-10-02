'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  Clock, 
  MapPin, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Users, 
  PlusCircle,
  Gavel,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/card';
import { api, unwrapApiData } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { cleanCanonicalRefId, formatLocationSummary, formatRefId, deriveMethodPrefix } from '../../../utils/refIdUtils';
import { TypeBadge, type OpportunityType } from '../../shared/TypeBadge';

type FilterTab = 'all' | 'bidding' | 'evaluation' | 'awarded';

interface BuyerProcurementItem {
  id: string;
  bidNumber: string;
  title: string;
  type: OpportunityType;
  category: string;
  department?: string;
  location: string;
  fullLocation?: string;
  estimatedBudget: number;
  closingDate: string;
  daysLeft: number;
  bidsCount: number;
  stage: 'draft' | 'published' | 'tech_eval' | 'financial_eval' | 'awarded' | 'closed';
  stageLabel: string;
  actionHref: string;
  actionLabel: string;
  urgentAction?: boolean;
}

export function BuyerProcurementMonitor() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const urlTab = sp.get('tab') || sp.get('monitorTab');
      if (urlTab && ['all', 'bidding', 'evaluation', 'awarded'].includes(urlTab)) {
        return urlTab as FilterTab;
      }
      const saved = sessionStorage.getItem('buyer_procurement_monitor_tab');
      if (saved && ['all', 'bidding', 'evaluation', 'awarded'].includes(saved)) {
        return saved as FilterTab;
      }
    }
    return 'all';
  });

  const handleTabChange = useCallback((newTab: FilterTab) => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('buyer_procurement_monitor_tab', newTab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const urlTab = sp.get('tab') || sp.get('monitorTab');
      if (urlTab && ['all', 'bidding', 'evaluation', 'awarded'].includes(urlTab)) {
        setActiveTab(urlTab as FilterTab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const { data: procurementsData, isLoading } = useQuery({
    queryKey: ['buyer-dashboard-my-procurements'],
    queryFn: async () => {
      const res = await api.fetch('/api/buyer/my-procurements', { headers: authHeaders });
      if (!res.ok) return { all: [], kpis: {} };
      const json = await res.json();
      return json?.data || json || { all: [], kpis: {} };
    },
    enabled: !!token,
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const procurements: BuyerProcurementItem[] = useMemo(() => {
    const rawList: any[] = Array.isArray(procurementsData?.all) ? procurementsData.all : [];
    if (rawList.length === 0) return [];

    return rawList.map((bid: any, idx: number) => {
      const closing = bid.endDate || bid.bidEndDatetime || bid.closesAt || bid.requiredBy;
      let daysLeft = 0;
      if (closing) {
        const diffMs = new Date(closing).getTime() - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      const participantsCount = Array.isArray(bid.participants) 
        ? bid.participants.length 
        : (bid.participantsCount || bid.bidsCount || bid._count?.participants || 0);

      const refToken = String(bid.referenceNumber || bid.bidNumber || '').trim().toUpperCase();
      const rawMethod = String(
        bid.method ||
        bid.methodLabel ||
        bid.canonicalMethod ||
        bid.procurementMethod ||
        bid.procurementType ||
        bid.bidType ||
        bid.type ||
        ''
      ).toUpperCase();

      let typeLabel: BuyerProcurementItem['type'] = 'RFQ';
      let methodSlug = 'rfq';

      if (refToken.startsWith('RC-') || rawMethod.includes('RATE_CONTRACT') || rawMethod.includes('RATE-CONTRACT') || rawMethod.includes('RATE CONTRACT')) {
        typeLabel = 'Rate Contract';
        methodSlug = 'rate-contract';
      } else if (refToken.startsWith('RA-') || bid.type === 'reverse_auction' || rawMethod.includes('AUCTION')) {
        typeLabel = 'Reverse Auction';
        methodSlug = 'reverse-auction';
      } else if (refToken.startsWith('LTND-') || refToken.startsWith('LIM-') || rawMethod.includes('LIMITED')) {
        typeLabel = 'Limited Tender';
        methodSlug = 'limited-tender';
      } else if (refToken.startsWith('RFP-') || rawMethod.includes('RFP') || rawMethod.includes('PROPOSAL')) {
        typeLabel = 'RFP';
        methodSlug = 'rfp';
      } else if (refToken.startsWith('DP-') || refToken.startsWith('DIR-') || bid.type === 'direct_purchase' || rawMethod.includes('DIRECT')) {
        typeLabel = 'Direct Purchase';
        methodSlug = 'direct-purchase';
      } else if (refToken.startsWith('TND-') || rawMethod.includes('OPEN_TENDER') || rawMethod.includes('OPEN-TENDER') || rawMethod === 'TENDER' || rawMethod === 'OPEN TENDER') {
        typeLabel = 'Open Tender';
        methodSlug = 'open-tender';
      } else if (refToken.startsWith('RFQ-') || rawMethod.includes('RFQ') || rawMethod.includes('QUOTE')) {
        typeLabel = 'RFQ';
        methodSlug = 'rfq';
      } else {
        const ml = String(bid.methodLabel || bid.method || '').toLowerCase();
        if (ml.includes('rate contract')) {
          typeLabel = 'Rate Contract';
          methodSlug = 'rate-contract';
        } else if (ml.includes('limited')) {
          typeLabel = 'Limited Tender';
          methodSlug = 'limited-tender';
        } else if (ml.includes('rfp')) {
          typeLabel = 'RFP';
          methodSlug = 'rfp';
        } else if (ml.includes('open tender') || ml === 'tender') {
          typeLabel = 'Open Tender';
          methodSlug = 'open-tender';
        } else if (ml.includes('direct')) {
          typeLabel = 'Direct Purchase';
          methodSlug = 'direct-purchase';
        } else {
          typeLabel = 'RFQ';
          methodSlug = 'rfq';
        }
      }

      let displayBidNumber = cleanCanonicalRefId(bid.bidNumber || bid.referenceNumber || bid.requisitionNumber || String(bid.id || ''));
      if (!displayBidNumber || displayBidNumber.toLowerCase().startsWith('bid-req') || /^\d+$/.test(displayBidNumber)) {
        const pfx = deriveMethodPrefix(rawMethod, displayBidNumber, 'RFQ');
        displayBidNumber = formatRefId(pfx, bid.id || idx, displayBidNumber, rawMethod);
      }

      // Canonical bid reference identifier — strictly avoid numeric database IDs in URLs
      const canonicalBidRef = bid.bidNumber || bid.referenceNumber || bid.requisitionNumber || displayBidNumber || bid.auctionCode || String(bid.id);
      const canonicalTypeParam = typeLabel.toUpperCase().replace(/\s+/g, '_');
      let actionHref = `/bids/${encodeURIComponent(canonicalBidRef)}?type=${encodeURIComponent(canonicalTypeParam)}`;
      let stage: BuyerProcurementItem['stage'] = 'published';
      let stageLabel = 'Bidding Open';
      let urgentAction = false;
      let actionLabel = 'View Details';

      const rawStatus = String(bid.status || bid.stage || bid.statusGroup || '').toUpperCase();
      const isReverseAuctionStage = Boolean(
        rawStatus.includes('AUCTION') ||
        rawStatus === 'REVERSE_AUCTION_ACTIVE' ||
        bid.type === 'reverse_auction' ||
        typeLabel === 'Reverse Auction' ||
        bid.linkedAuctionId ||
        bid.linkedAuctionCode
      );

      const auctionTargetCode = bid.linkedAuctionCode || bid.linkedAuctionId || bid.auctionCode || canonicalBidRef;
      const linkedStatus = String(bid.linkedAuctionStatus || '').toUpperCase();
      const isTerminalAuction = ['CLOSED', 'CANCELLED', 'AWARD_RECOMMENDED', 'AWARD_OFFERED', 'AWARDED', 'FINALIZED', 'COMPLETED', 'ENDED'].includes(linkedStatus) || rawStatus.includes('CLOSED') || rawStatus.includes('AWARD') || rawStatus.includes('CANCELLED');
      const isLiveAuction = !isTerminalAuction && (rawStatus.includes('LIVE') || rawStatus === 'REVERSE_AUCTION_ACTIVE' || linkedStatus === 'LIVE');

      if (isReverseAuctionStage && !isTerminalAuction) {
        stage = 'published';
        typeLabel = 'Reverse Auction';
        stageLabel = isLiveAuction ? '🔴 Live Reverse Auction' : '⏱️ Scheduled RA';
        actionLabel = isLiveAuction ? 'Monitor Live Floor' : 'Open Live Console';
        urgentAction = true;
        actionHref = `/buyer/procurement/reverse-auction/${encodeURIComponent(String(auctionTargetCode))}/live`;
      } else if (rawStatus.includes('EVAL') || rawStatus.includes('TECHNICAL')) {
        stage = 'tech_eval';
        stageLabel = 'Technical Evaluation';
        actionLabel = participantsCount > 0 ? `Review ${participantsCount} Bids` : 'Review Bids';
        urgentAction = true;
        actionHref = `/bids/${encodeURIComponent(canonicalBidRef)}?type=${encodeURIComponent(canonicalTypeParam)}&tab=scope_docs`;
      } else if (rawStatus.includes('FINANCIAL')) {
        stage = 'financial_eval';
        stageLabel = 'Financial Opening';
        actionLabel = 'Compare Commercials';
        urgentAction = true;
        actionHref = `/bids/${encodeURIComponent(canonicalBidRef)}?type=${encodeURIComponent(canonicalTypeParam)}&tab=terms_schedule`;
      } else if (rawStatus.includes('AWARD') || rawStatus.includes('RECOMMEND')) {
        stage = 'awarded';
        stageLabel = 'Award Pending';
        actionLabel = 'Issue PO';
        urgentAction = true;
        actionHref = `/bids/${encodeURIComponent(canonicalBidRef)}?type=${encodeURIComponent(canonicalTypeParam)}`;
      } else if (rawStatus.includes('CLOSED') || rawStatus.includes('COMPLETED') || bid.purchaseOrderId || bid.orderId) {
        stage = 'closed';
        stageLabel = 'Completed';
        actionLabel = 'View Order';
        const poId = bid.purchaseOrderId || bid.orderId || bid.id;
        actionHref = `/orders?orderId=${encodeURIComponent(String(poId))}`;
      } else if (rawStatus.includes('DRAFT')) {
        stage = 'draft';
        stageLabel = 'Draft Requisition';
        actionLabel = 'Continue Draft';
        actionHref = `/buyer/procurement/create?draftId=${encodeURIComponent(String(bid.id))}`;
      } else {
        stage = 'published';
        stageLabel = participantsCount > 0 ? `${participantsCount} Bids Received` : 'Awaiting Bids';
        actionLabel = participantsCount > 0 ? `Review ${participantsCount} Bids` : 'View Details';
      }

      // Hybrid multi-stage linkage: always assign composite "+ RA" type when reverse auction stage exists
      if (isReverseAuctionStage && typeLabel !== 'Reverse Auction' && !typeLabel.endsWith('+ RA')) {
        typeLabel = `${typeLabel} + RA` as OpportunityType;
      }

      // Hybrid multi-stage linkage (e.g. RFP-2026-26500 • RA-2026-67333)
      if (isReverseAuctionStage && auctionTargetCode && !displayBidNumber.includes(String(auctionTargetCode))) {
        displayBidNumber = `${displayBidNumber} • ${cleanCanonicalRefId(String(auctionTargetCode))}`;
      }

      const rawLocation = bid.deliveryLocation || bid.location || [bid.district, bid.state].filter(Boolean).join(', ') || 'All India';
      const cleanLocation = formatLocationSummary(rawLocation, bid.district, bid.state, bid.city);

      return {
        id: `${bid.type || 'bid'}-${bid.id || idx}`,
        bidNumber: displayBidNumber,
        title: bid.title || bid.name || bid.itemName || 'Procurement Requisition',
        type: typeLabel,
        category: bid.category?.name || bid.categoryName || bid.category || 'General Procurement',
        department: bid.department || (user?.organization as any)?.organizationName || 'Procurement Dept',
        location: cleanLocation,
        fullLocation: rawLocation,
        estimatedBudget: Number(bid.estimatedBudget || bid.estimatedValue || bid.totalBudget || bid.amount || 0),
        closingDate: closing ? new Date(closing).toISOString().split('T')[0] : 'Open',
        daysLeft,
        bidsCount: participantsCount,
        stage,
        stageLabel,
        actionHref,
        actionLabel,
        urgentAction
      };
    });
  }, [procurementsData, user]);

  const filteredProcurements = useMemo(() => {
    let list = procurements;
    if (activeTab === 'bidding') list = procurements.filter(p => p.stage === 'published');
    else if (activeTab === 'evaluation') list = procurements.filter(p => p.stage === 'tech_eval' || p.stage === 'financial_eval');
    else if (activeTab === 'awarded') list = procurements.filter(p => p.stage === 'awarded' || p.stage === 'closed');
    // Strictly current / recent 5 procurements only
    return list.slice(0, 5);
  }, [procurements, activeTab]);

  const tabCounts = useMemo(() => ({
    all: procurements.length,
    bidding: procurements.filter(p => p.stage === 'published').length,
    evaluation: procurements.filter(p => p.stage === 'tech_eval' || p.stage === 'financial_eval').length,
    awarded: procurements.filter(p => p.stage === 'awarded' || p.stage === 'closed').length
  }), [procurements]);

  const activeReverseAuctions = useMemo(() => {
    return procurements.filter(p => p.stageLabel.includes('Live Reverse Auction'));
  }, [procurements]);

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden flex flex-col transition-all">
      {/* ── Card Header ── */}
      <div className="bg-slate-50/50 px-3.5 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#12335f]/10 text-[#12335f] flex items-center justify-center font-bold">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">
                Active Requisitions & Published Tenders
              </h2>
              {procurements.length > 5 && (
                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Recent 5
                </span>
              )}
            </div>
            <p className="text-[10px] font-medium text-slate-500">
              Track published RFQs, incoming vendor bids, and evaluation milestones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/buyer/procurement/create">
            <Button className="h-7 bg-[#12335f] hover:bg-[#0b2445] text-white rounded px-2.5 text-[10px] font-bold uppercase tracking-wide shadow-sm flex items-center gap-1">
              <PlusCircle className="h-3 w-3" />
              New RFQ
            </Button>
          </Link>
          <Link href="/buyer/my-procurements">
            <Button variant="ghost" className="h-7 text-[#12335f] hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wide px-2">
              View All ({procurements.length})
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Realtime Live Reverse Auction Monitor Strip ── */}
      {activeReverseAuctions.length > 0 && (
        <div className="bg-gradient-to-r from-[#12335f] via-indigo-950 to-slate-900 px-4 py-2.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-800/60 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-red-400 border border-red-500/30">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-red-300">
                  Live Reverse Auction Active ({activeReverseAuctions.length})
                </span>
              </div>
              <p className="text-xs font-bold text-white mt-0.5 line-clamp-1">
                {activeReverseAuctions[0].title} <span className="text-slate-300 font-normal">({activeReverseAuctions[0].bidNumber})</span>
              </p>
            </div>
          </div>
          <Link
            href={activeReverseAuctions[0].actionHref}
            className="inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shadow-sm transition-colors shrink-0"
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>Open Live Monitoring Console →</span>
          </Link>
        </div>
      )}

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition shrink-0 ${
            activeTab === 'all' 
              ? 'bg-[#12335f] text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Requisitions ({tabCounts.all})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('bidding')}
          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition shrink-0 ${
            activeTab === 'bidding' 
              ? 'bg-[#12335f] text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Bidding Open ({tabCounts.bidding})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('evaluation')}
          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition shrink-0 ${
            activeTab === 'evaluation' 
              ? 'bg-[#12335f] text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          In Evaluation ({tabCounts.evaluation})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('awarded')}
          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition shrink-0 ${
            activeTab === 'awarded' 
              ? 'bg-[#12335f] text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Awarded / Closed ({tabCounts.awarded})
        </button>
      </div>

      {/* ── Procurement Items List ── */}
      <div className="divide-y divide-slate-100 p-2.5 space-y-2">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#12335f]" />
            <span className="text-xs font-medium">Loading active procurements...</span>
          </div>
        ) : filteredProcurements.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-700">No requisitions found in this stage.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Publish a new requirement or tender to invite MSME suppliers.</p>
            <Link href="/buyer/procurement/create" className="mt-3 inline-block">
              <Button className="h-7 bg-[#12335f] hover:bg-[#0b2445] text-white rounded text-[10px] font-bold uppercase">
                <PlusCircle className="mr-1 h-3 w-3" />
                Create First Requisition
              </Button>
            </Link>
          </div>
        ) : (
          filteredProcurements.map((item) => {
            const isEvaluation = item.stage === 'tech_eval' || item.stage === 'financial_eval';
            const isAwarded = item.stage === 'awarded';

            return (
              <div 
                key={item.id} 
                className="group p-2.5 rounded-lg border border-slate-200/80 bg-white hover:border-[#12335f]/30 hover:shadow-xs transition flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Left: Requisition Details */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={item.type} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-mono">
                      {item.bidNumber}
                    </span>

                    {/* Stage Badge */}
                    {item.type === 'Reverse Auction' || item.stageLabel.includes('Reverse Auction') ? (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 animate-pulse">
                        <Gavel className="h-2.5 w-2.5 text-red-600" />
                        {item.stageLabel}
                      </span>
                    ) : isEvaluation ? (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {item.stageLabel}
                      </span>
                    ) : isAwarded ? (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {item.stageLabel}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Users className="h-2.5 w-2.5" />
                        {item.stageLabel}
                      </span>
                    )}

                    {item.daysLeft <= 2 && item.daysLeft > 0 && item.stage === 'published' && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">
                        {item.daysLeft}d Left
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-xs font-bold text-slate-900 leading-snug group-hover:text-[#12335f] transition line-clamp-1">
                    {item.title}
                  </h3>

                  {/* Metadata line */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      {item.department}
                    </span>
                    <span 
                      className="flex items-center gap-1 truncate max-w-[220px]"
                      title={item.fullLocation || item.location}
                    >
                      <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                      {item.location}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>{item.category}</span>
                  </div>
                </div>

                {/* Right: Budget, Responses & Action */}
                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 shrink-0">
                  <div className="text-left md:text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Est. Budget</p>
                    <p className="text-xs font-black text-slate-900">
                      {item.estimatedBudget > 0 ? `₹${item.estimatedBudget.toLocaleString('en-IN')}` : 'Open Estimate'}
                    </p>
                  </div>

                  <Link href={item.actionHref}>
                    <Button 
                      className={`h-7 px-3 text-[10px] font-bold uppercase tracking-wide rounded transition flex items-center gap-1 shadow-xs cursor-pointer ${
                        item.type === 'Reverse Auction' || item.stageLabel.includes('Reverse Auction')
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm font-black'
                          : item.urgentAction
                          ? 'bg-[#12335f] hover:bg-[#0b2445] text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-[#12335f]'
                      }`}
                    >
                      {item.type === 'Reverse Auction' || item.stageLabel.includes('Reverse Auction') ? (
                        <SlidersHorizontal className="h-3 w-3" />
                      ) : null}
                      {item.actionLabel}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default React.memo(BuyerProcurementMonitor);
