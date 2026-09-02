'use client';

import React, { useState, useMemo } from 'react';
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

type FilterTab = 'all' | 'bidding' | 'evaluation' | 'awarded';

interface BuyerProcurementItem {
  id: string;
  bidNumber: string;
  title: string;
  type: 'RFQ' | 'Open Tender' | 'Reverse Auction' | 'Direct Purchase';
  category: string;
  department?: string;
  location: string;
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
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
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

      let stage: BuyerProcurementItem['stage'] = 'published';
      let stageLabel = 'Bidding Open';
      let urgentAction = false;
      let actionLabel = 'View Details';
      let actionHref = bid.type === 'reverse_auction' 
        ? `/buyer/my-procurements?type=Reverse+Auction` 
        : `/buyer/procurement/responses`;

      const rawStatus = String(bid.status || bid.stage || bid.statusGroup || '').toUpperCase();
      if (rawStatus.includes('EVAL') || rawStatus.includes('TECHNICAL')) {
        stage = 'tech_eval';
        stageLabel = 'Technical Evaluation';
        actionLabel = participantsCount > 0 ? `Evaluate (${participantsCount} Bids)` : 'Evaluate Bids';
        urgentAction = true;
      } else if (rawStatus.includes('FINANCIAL') || rawStatus.includes('AUCTION')) {
        stage = 'financial_eval';
        stageLabel = 'Financial Opening';
        actionLabel = 'Compare Commercials';
        urgentAction = true;
      } else if (rawStatus.includes('AWARD') || rawStatus.includes('RECOMMEND')) {
        stage = 'awarded';
        stageLabel = 'Award Pending';
        actionLabel = 'Issue PO';
        urgentAction = true;
        actionHref = '/orders';
      } else if (rawStatus.includes('CLOSED') || rawStatus.includes('COMPLETED')) {
        stage = 'closed';
        stageLabel = 'Completed';
        actionLabel = 'View Order';
        actionHref = '/orders';
      } else if (rawStatus.includes('DRAFT')) {
        stage = 'draft';
        stageLabel = 'Draft Requisition';
        actionLabel = 'Continue Draft';
        actionHref = `/buyer/procurement/create?draftId=${bid.id}`;
      } else {
        stage = 'published';
        stageLabel = participantsCount > 0 ? `${participantsCount} Bids Received` : 'Awaiting Bids';
        actionLabel = participantsCount > 0 ? `Review ${participantsCount} Bids` : 'Manage Tender';
      }

      let typeLabel: BuyerProcurementItem['type'] = 'RFQ';
      if (bid.type === 'reverse_auction' || bid.procurementMethod === 'REVERSE_AUCTION') {
        typeLabel = 'Reverse Auction';
      } else if (bid.type === 'bid_tender' || bid.bidType === 'TENDER' || bid.procurementType === 'OPEN_TENDER') {
        typeLabel = 'Open Tender';
      } else if (bid.type === 'direct_purchase') {
        typeLabel = 'Direct Purchase';
      }

      return {
        id: String(bid.id || `bid-${idx}`),
        bidNumber: bid.bidNumber || bid.referenceNumber || bid.requisitionNumber || `BID-REQ-${10000 + idx}`,
        title: bid.title || bid.name || bid.itemName || 'Procurement Requisition',
        type: typeLabel,
        category: bid.category?.name || bid.categoryName || bid.category || 'General Procurement',
        department: bid.department || (user?.organization as any)?.organizationName || 'Procurement Dept',
        location: bid.deliveryLocation || bid.location || 'All India',
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
    if (activeTab === 'all') return procurements;
    if (activeTab === 'bidding') return procurements.filter(p => p.stage === 'published');
    if (activeTab === 'evaluation') return procurements.filter(p => p.stage === 'tech_eval' || p.stage === 'financial_eval');
    if (activeTab === 'awarded') return procurements.filter(p => p.stage === 'awarded' || p.stage === 'closed');
    return procurements;
  }, [procurements, activeTab]);

  const tabCounts = useMemo(() => ({
    all: procurements.length,
    bidding: procurements.filter(p => p.stage === 'published').length,
    evaluation: procurements.filter(p => p.stage === 'tech_eval' || p.stage === 'financial_eval').length,
    awarded: procurements.filter(p => p.stage === 'awarded' || p.stage === 'closed').length
  }), [procurements]);

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
              {procurements.length > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
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
              New RFQ / Tender
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

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
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
          onClick={() => setActiveTab('bidding')}
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
          onClick={() => setActiveTab('evaluation')}
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
          onClick={() => setActiveTab('awarded')}
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
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-[#12335f] border border-indigo-100">
                      {item.type}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-mono">
                      {item.bidNumber}
                    </span>

                    {/* Stage Badge */}
                    {isEvaluation && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {item.stageLabel}
                      </span>
                    )}
                    {isAwarded && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {item.stageLabel}
                      </span>
                    )}
                    {!isEvaluation && !isAwarded && (
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
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
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
                      className={`h-7 px-3 text-[10px] font-bold uppercase tracking-wide rounded transition flex items-center gap-1 shadow-xs ${
                        item.urgentAction
                          ? 'bg-[#12335f] hover:bg-[#0b2445] text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-[#12335f]'
                      }`}
                    >
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
