'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { 
  ArrowLeft, ShieldAlert, Award, Star, Info,
  CheckCircle2, AlertTriangle, FileText, BadgePercent, IndianRupee,
  Activity, Users, ChevronRight, HelpCircle, Eye, Download, Printer, X,
  Flame, BarChart3, Zap, Trophy, Scale, Layers, Filter, RotateCcw
} from 'lucide-react';
import { PageShell, StatusBadge, ProcurementHero, ProcurementLoadingState, ProcurementErrorState } from '../components';
import { money } from '../data';
import { toast } from 'sonner';
import { procurementBidApi } from '../api';

export default function BidComparisonPage() {
  const params = useParams();
  let bidId = params?.bidId as string;
  
  if (!bidId && typeof window !== 'undefined') {
    const match = window.location.pathname.match(/^\/bids\/([^/]+)\/compare$/);
    if (match) bidId = match[1];
  }
  
  const router = useRouter();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const [sortBy, setSortBy] = useState<string>('lowest-price');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const idsStr = searchParams.get('ids') || searchParams.get('selected');
      if (idsStr) {
        const parsed = idsStr.split(',').map(n => Number(n.trim())).filter(n => Number.isFinite(n) && n > 0);
        if (parsed.length) setSelectedIds(parsed);
      }
    }
  }, []);

  // Award Modal state
  const [awardModal, setAwardModal] = useState<{
    show: boolean;
    participationId: number;
    sellerName: string;
    rank: number;
    amount: number;
    delivery: string;
    remarks: string;
    confirmed: boolean;
  }>({
    show: false,
    participationId: 0,
    sellerName: '',
    rank: 999,
    amount: 0,
    delivery: '',
    remarks: '',
    confirmed: false
  });

  // Fetch bid details with participations and ratings
  const { data: bid, isLoading, error, refetch } = useQuery({
    queryKey: ['procurement-bid', bidId],
    queryFn: async () => {
      const res = await procurementBidApi.detail(bidId);
      return res as any;
    },
    enabled: !!bidId && !!token,
    staleTime: 60_000,
  });

  // Award Mutation
  const awardMutation = useMutation({
    mutationFn: async ({ participationId, remarks, rank }: { participationId: number; remarks: string; rank: number }) => {
      const body: any = { participationId, remarks };
      if (rank !== 1) {
        body.adminOverrideReason = remarks || 'Override to select optimal rated supplier';
      }
      const res = await api.fetch(`/api/buyer/bids/${bidId}/recommend-award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || 'Failed to award bid');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Bid awarded successfully and Purchase Order generated!');
      setAwardModal(prev => ({ ...prev, show: false }));
      queryClient.invalidateQueries({ queryKey: ['procurement-bid', bidId] });
      router.push(`/bids/${bidId}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to award bid');
    }
  });

  const getDeliveryDays = (timeline: string) => {
    const match = String(timeline || '').match(/(\d+)/);
    return match ? Number(match[1]) : Infinity;
  };

  const getWarrantyMonths = (warranty: string) => {
    const match = String(warranty || '').match(/(\d+)/);
    if (!match) return 0;
    const val = Number(match[1]);
    if (String(warranty).toLowerCase().includes('year')) {
      return val * 12;
    }
    return val;
  };

  const parseTechnicalOffer = (input: any) => {
    const p = typeof input === 'object' && input ? input : {};
    let descObj: any = {};
    const descString = typeof input === 'string' ? input : (p.offeredItemDescription || '');
    try {
      if (descString && (String(descString).startsWith('{') || String(descString).startsWith('['))) {
        descObj = JSON.parse(descString);
      }
    } catch (e) {
      // Ignore
    }

    const details = (p.details && typeof p.details === 'object') ? p.details : {};
    const respData = (p.responseData && typeof p.responseData === 'object') ? p.responseData : {};
    const ackData = (p.acknowledgement && typeof p.acknowledgement === 'object') ? p.acknowledgement : {};
    const lineItems = Array.isArray(p.lineItems) ? p.lineItems : [];
    const firstItem = lineItems.length ? lineItems[0] : {};
    const techOffer = descObj.technicalOffer || respData.technicalOffer || ackData.technicalOffer || {};

    const firstVal = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== '');

    return {
      makeBrand: firstVal(p.makeBrand, details.makeBrand, respData.makeBrand, ackData.makeBrand, techOffer.makeBrand, firstItem.makeBrand),
      model: firstVal(p.model, details.model, respData.model, ackData.model, techOffer.model, firstItem.model),
      offeredItemDescription: firstVal(descObj.offeredItemDescription, p.offeredItemDescription, respData.offeredItemDescription, ackData.offeredItemDescription),
      complianceRemarks: firstVal(p.complianceRemarks, details.complianceRemarks, respData.complianceRemarks, ackData.complianceRemarks, techOffer.complianceRemarks, firstItem.complianceRemarks, firstItem.remarks),
      deliveryTimeline: firstVal(p.deliveryTimeline, details.deliveryTimeline, respData.deliveryTimeline, ackData.deliveryTimeline, techOffer.deliveryTimeline, firstItem.deliveryTimeline, firstItem.deliveryRequirement, firstItem.deliverySchedule),
      warrantyDetails: firstVal(p.warrantyDetails, details.warrantyDetails, respData.warrantyDetails, ackData.warrantyDetails, techOffer.warrantyDetails, firstItem.warrantyDetails),
      serviceSupport: firstVal(p.serviceSupport, details.serviceSupport, respData.serviceSupport, ackData.serviceSupport, techOffer.serviceSupport),
      deviation: firstVal(p.deviation, details.deviation, respData.deviation, ackData.deviation, techOffer.deviation, firstItem.deviation),
      rfqNotes: firstVal(p.rfqNotes, details.rfqNotes, respData.rfqNotes, ackData.rfqNotes, details.notes, respData.notes, ackData.notes),
    };
  };

  const handleOpenAwardModal = (p: any) => {
    const tech = parseTechnicalOffer(p);
    setAwardModal({
      show: true,
      participationId: p.id,
      sellerName: p.seller?.name || p.sellerName || `Seller #${p.sellerId}`,
      rank: p.rank || 999,
      amount: p.totalAmount || p.quotedAmount || 0,
      delivery: tech.deliveryTimeline || 'Not specified',
      remarks: p.rank === 1 ? 'Selected based on lowest compliant financial quotation (L1).' : '',
      confirmed: false
    });
  };

  const handleConfirmAward = () => {
    if (!awardModal.confirmed) {
      toast.error('Please check the confirmation box to proceed.');
      return;
    }
    if (awardModal.rank !== 1 && !awardModal.remarks.trim()) {
      toast.error('Award remarks/justification is mandatory when selecting a supplier other than L1.');
      return;
    }
    awardMutation.mutate({
      participationId: awardModal.participationId,
      remarks: awardModal.remarks,
      rank: awardModal.rank
    });
  };

  // Filter and Sort participations
  const filteredAndSortedParticipations = useMemo(() => {
    if (!bid || !Array.isArray(bid.participations)) return [];
    
    let items = [...bid.participations];

    // Optional user multi-selection filter
    if (selectedIds.length > 0) {
      items = items.filter(p => selectedIds.includes(p.id));
    }
    
    // Status Filtering
    if (filterStatus !== 'all') {
      items = items.filter(p => {
        const tech = String(p.technicalStatus || '').toUpperCase();
        const fin = String(p.financialStatus || '').toUpperCase();
        if (filterStatus === 'technically-qualified') return tech === 'QUALIFIED';
        if (filterStatus === 'financially-qualified') return fin === 'QUALIFIED';
        if (filterStatus === 'pending') return tech === 'PENDING' || tech === 'UNDER_REVIEW';
        if (filterStatus === 'shortlisted') return tech === 'SHORTLISTED' || p.finalStatus === 'SHORTLISTED';
        if (filterStatus === 'rejected') return tech === 'DISQUALIFIED' || p.finalStatus === 'REJECTED';
        if (filterStatus === 'clarification') return tech === 'CLARIFICATION_REQUIRED';
        return true;
      });
    }

    // Sorting (default lowest price L1 first)
    items.sort((a, b) => {
      const aTech = parseTechnicalOffer(a);
      const bTech = parseTechnicalOffer(b);

      if (sortBy === 'lowest-price') {
        return (a.totalAmount || a.quotedAmount || 0) - (b.totalAmount || b.quotedAmount || 0);
      }
      if (sortBy === 'highest-price') {
        return (b.totalAmount || b.quotedAmount || 0) - (a.totalAmount || a.quotedAmount || 0);
      }
      if (sortBy === 'earliest-submission') {
        return new Date(a.submittedAt || a.createdAt).getTime() - new Date(b.submittedAt || b.createdAt).getTime();
      }
      if (sortBy === 'fastest-delivery') {
        return getDeliveryDays(aTech.deliveryTimeline) - getDeliveryDays(bTech.deliveryTimeline);
      }
      if (sortBy === 'highest-rating') {
        return (b.averageRating?.rating || 0) - (a.averageRating?.rating || 0);
      }
      if (sortBy === 'warranty') {
        return getWarrantyMonths(bTech.warrantyDetails) - getWarrantyMonths(aTech.warrantyDetails);
      }
      if (sortBy === 'supplier-name') {
        return String(a.seller?.name || '').localeCompare(String(b.seller?.name || ''));
      }
      return (a.totalAmount || a.quotedAmount || 0) - (b.totalAmount || b.quotedAmount || 0);
    });

    return items;
  }, [bid, filterStatus, sortBy, selectedIds]);

  // Derived L1, L2, Savings and Spread metrics
  const comparisonMetrics = useMemo(() => {
    const list = filteredAndSortedParticipations;
    if (list.length === 0) return null;

    const l1 = list[0];
    const l2 = list.length > 1 ? list[1] : null;

    const l1Price = l1 ? (l1.totalAmount || l1.quotedAmount || 0) : 0;
    const l2Price = l2 ? (l2.totalAmount || l2.quotedAmount || 0) : l1Price;
    const prices = list.map(p => p.totalAmount || p.quotedAmount || 0).filter(v => v > 0);
    const maxPrice = prices.length ? Math.max(...prices) : l1Price;

    const l1Savings = l2Price > l1Price ? l2Price - l1Price : 0;
    const savingsPercent = l2Price > 0 && l1Savings > 0 ? ((l1Savings / l2Price) * 100).toFixed(1) : '0.0';

    const l1OrgName = l1?.seller?.organization?.organizationName || l1?.seller?.name || l1?.sellerName || 'L1 Bidder';

    return {
      l1,
      l2,
      l1Price,
      l2Price,
      maxPrice,
      l1Savings,
      savingsPercent,
      l1OrgName,
      totalCount: list.length
    };
  }, [filteredAndSortedParticipations]);

  const checkDiffers = (values: any[]) => {
    const normalized = values.map(v => String(v || '').trim().toLowerCase());
    const unique = new Set(normalized);
    return unique.size > 1;
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="container mx-auto p-6">
          <ProcurementLoadingState message="Analyzing and comparing bid submissions..." />
        </div>
      </PageShell>
    );
  }

  if (error || !bid) {
    return (
      <PageShell>
        <div className="container mx-auto p-6">
          <ProcurementErrorState message="Could not fetch bid comparison details." onRetry={refetch} />
        </div>
      </PageShell>
    );
  }

  const isBuyer = user?.role === 'buyer';

  return (
    <PageShell>
      <div className="container mx-auto space-y-6 p-6">
        {/* Top Breadcrumb & Navigation Bar */}
        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push(`/bids/${bidId}/results`);
              }
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-250 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Results</span>
          </button>

          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span
              className="hover:text-slate-800 cursor-pointer"
              onClick={() => router.push('/bids')}
            >
              Procurements
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span
              className="font-mono text-slate-600 hover:text-slate-900 cursor-pointer"
              onClick={() => router.push(`/bids/${bidId}/results`)}
            >
              {bidId}
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="text-blue-900 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-[11px]">
              Comparison
            </span>
          </nav>
        </div>

        {/* Main Comparison Container Shell (Matching 1st Screenshot) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-xs">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Commercial Quotation & L1 Ranking Comparison</h2>
                  <span className="inline-flex items-center rounded-full bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase tracking-wide">
                    L1 EVALUATED
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Comparing {filteredAndSortedParticipations.length} seller quotation{filteredAndSortedParticipations.length === 1 ? '' : 's'} sorted by total quoted amount (L1 lowest bidder).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear Selection
                </button>
              )}
              <button
                onClick={() => router.push(`/bids/${bidId}`)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                title="Close Comparison"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Top 4 Summary Metric Cards Grid */}
          {comparisonMetrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: L1 LOWEST BIDDER */}
              <div className="rounded-2xl border border-emerald-150 bg-emerald-50/20 p-4 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                  <Trophy className="h-3.5 w-3.5" /> L1 LOWEST BIDDER
                </div>
                <p className="text-xs font-black text-slate-900 truncate uppercase" title={comparisonMetrics.l1OrgName}>
                  {comparisonMetrics.l1OrgName}
                </p>
                <p className="text-base font-black text-emerald-700">
                  {money(comparisonMetrics.l1Price)}
                </p>
              </div>

              {/* Card 2: L1 COMMERCIAL SAVINGS */}
              <div className="rounded-2xl border border-amber-150 bg-amber-50/20 p-4 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-amber-700 text-[10px] font-black uppercase tracking-wider">
                  <Flame className="h-3.5 w-3.5" /> L1 COMMERCIAL SAVINGS
                </div>
                <p className="text-base font-black text-emerald-700">
                  {comparisonMetrics.l1Savings > 0 ? money(comparisonMetrics.l1Savings) : '₹0'}
                </p>
                <p className="text-[11px] font-bold text-emerald-600">
                  {comparisonMetrics.savingsPercent}% lower than L2
                </p>
              </div>

              {/* Card 3: QUOTED PRICE SPREAD */}
              <div className="rounded-2xl border border-purple-150 bg-purple-50/20 p-4 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-purple-700 text-[10px] font-black uppercase tracking-wider">
                  <BarChart3 className="h-3.5 w-3.5" /> QUOTED PRICE SPREAD
                </div>
                <p className="text-sm font-black text-slate-900">
                  {money(comparisonMetrics.l1Price)} – {money(comparisonMetrics.maxPrice)}
                </p>
                <p className="text-[11px] font-bold text-blue-600">
                  {comparisonMetrics.totalCount} Quotations Ranked
                </p>
              </div>

              {/* Card 4: COMMERCIAL EVALUATION */}
              <div className="rounded-2xl border border-amber-150 bg-amber-50/20 p-4 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-amber-700 text-[10px] font-black uppercase tracking-wider">
                  <Zap className="h-3.5 w-3.5" /> COMMERCIAL EVALUATION
                </div>
                <p className="text-xs font-black text-slate-900">
                  L1 Evaluated & Ranked
                </p>
                <p className="text-[11px] font-bold text-amber-700">
                  Lowest Total Quoted Amount
                </p>
              </div>

            </div>
          )}

          {/* Comparison Matrix Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <div className="overflow-x-auto w-full rounded-xl border border-slate-200 bg-white mb-6 shadow-sm">
<table data-ux-wrapped="true" className="w-full min-w-[900px] border-collapse text-left text-xs">
              
              {/* Header Columns per Supplier */}
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="p-4 w-[240px] font-black text-slate-700 uppercase tracking-wider bg-slate-100/70 border-r border-slate-200">
                    COMMERCIAL & TECHNICAL FIELD
                  </th>
                  {filteredAndSortedParticipations.map((p, index) => {
                    const isL1 = index === 0;
                    const price = p.totalAmount || p.quotedAmount || 0;
                    const diff = price - (comparisonMetrics?.l1Price || 0);
                    const diffPct = comparisonMetrics?.l1Price ? ((diff / comparisonMetrics.l1Price) * 100).toFixed(1) : '0.0';
                    const orgName = p.seller?.organization?.organizationName || p.seller?.name || p.sellerName || `Supplier ${index + 1}`;
                    const contactPerson = p.seller?.name || p.sellerName || 'Representative';

                    return (
                      <th 
                        key={p.id} 
                        className={`p-4 border-r border-slate-200 align-top ${isL1 ? 'bg-emerald-50/40 border-t-4 border-t-emerald-600' : 'bg-slate-50/30'}`}
                      >
                        <div className="space-y-2.5">
                          {/* Badge */}
                          <div>
                            {isL1 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black text-white shadow-xs uppercase tracking-wider">
                                🥇 L1 (LOWEST BIDDER)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-[10px] font-black text-blue-700 shadow-2xs">
                                🥈 L2 (+{money(diff)} (+{diffPct}%))
                              </span>
                            )}
                          </div>

                          {/* Org & Contact */}
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-snug">{orgName}</p>
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">👤 {contactPerson}</p>
                          </div>

                          {/* Accept Quotation Action Button */}
                          <div>
                            <button
                              onClick={() => handleOpenAwardModal(p)}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-4 text-xs font-black text-white shadow-xs transition hover:opacity-90 ${
                                isL1 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              Accept Quotation
                            </button>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body Rows */}
              <tbody className="divide-y divide-slate-150">
                
                {/* Section Header 1 */}
                <tr className="bg-slate-100/60 font-black text-slate-800 text-[11px] uppercase tracking-wider">
                  <td colSpan={filteredAndSortedParticipations.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100/80">
                    COMMERCIAL OVERVIEW & L1 RANKING
                  </td>
                </tr>

                {/* 1. Commercial Rank */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Commercial Rank
                    {checkDiffers(filteredAndSortedParticipations.map((_, idx) => `L${idx + 1}`)) && (
                      <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800 uppercase tracking-wider">
                        DIFFERS
                      </span>
                    )}
                  </td>
                  {filteredAndSortedParticipations.map((p, index) => (
                    <td key={p.id} className="p-3.5 border-r border-slate-200 font-black">
                      {index === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] text-white">
                          🥇 L1 (LOWEST BIDDER)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] text-blue-700 font-bold">
                          🥈 L{index + 1}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* 2. Organization Name */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Organization Name
                    {checkDiffers(filteredAndSortedParticipations.map(p => p.seller?.organization?.organizationName || p.seller?.name || p.sellerName)) && (
                      <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800 uppercase tracking-wider">
                        DIFFERS
                      </span>
                    )}
                  </td>
                  {filteredAndSortedParticipations.map(p => (
                    <td key={p.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-800 uppercase">
                      {p.seller?.organization?.organizationName || p.seller?.name || p.sellerName || 'Supplier'}
                    </td>
                  ))}
                </tr>

                {/* 3. Contact Person */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Contact Person
                    {checkDiffers(filteredAndSortedParticipations.map(p => p.seller?.name || p.sellerName)) && (
                      <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800 uppercase tracking-wider">
                        DIFFERS
                      </span>
                    )}
                  </td>
                  {filteredAndSortedParticipations.map(p => (
                    <td key={p.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-700">
                      {p.seller?.name || p.sellerName || 'Representative'}
                    </td>
                  ))}
                </tr>

                {/* 4. Email Address */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Email Address
                    {checkDiffers(filteredAndSortedParticipations.map(p => p.seller?.email)) && (
                      <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800 uppercase tracking-wider">
                        DIFFERS
                      </span>
                    )}
                  </td>
                  {filteredAndSortedParticipations.map(p => (
                    <td key={p.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-600">
                      {p.seller?.email || '—'}
                    </td>
                  ))}
                </tr>

                {/* 5. Mobile Number */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Mobile Number
                    {checkDiffers(filteredAndSortedParticipations.map(p => p.seller?.mobile)) && (
                      <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800 uppercase tracking-wider">
                        DIFFERS
                      </span>
                    )}
                  </td>
                  {filteredAndSortedParticipations.map(p => (
                    <td key={p.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-600">
                      {p.seller?.mobile || '—'}
                    </td>
                  ))}
                </tr>

                {/* 6. Quoted Total Amount */}
                <tr className="hover:bg-slate-50/40 bg-emerald-50/10">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-extrabold text-slate-900 bg-slate-50/50">
                    Quoted Total Amount
                    {checkDiffers(filteredAndSortedParticipations.map(p => p.totalAmount || p.quotedAmount || 0)) && (
                      <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800 uppercase tracking-wider">
                        DIFFERS
                      </span>
                    )}
                  </td>
                  {filteredAndSortedParticipations.map((p, index) => {
                    const price = p.totalAmount || p.quotedAmount || 0;
                    const diff = price - (comparisonMetrics?.l1Price || 0);
                    const diffPct = comparisonMetrics?.l1Price ? ((diff / comparisonMetrics.l1Price) * 100).toFixed(1) : '0.0';

                    return (
                      <td key={p.id} className="p-3.5 border-r border-slate-200">
                        <div className="font-black text-sm text-slate-900">{money(price)}</div>
                        {index === 0 ? (
                          <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-800 uppercase tracking-wide mt-1">
                            LOWEST QUOTE (L1)
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 mt-1">
                            +{money(diff)} (+{diffPct}%)
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* 7. GST & Taxes */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    GST & Taxes
                  </td>
                  {filteredAndSortedParticipations.map(p => (
                    <td key={p.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                      {p.gstPercentage || 0}% ({money((p.totalAmount || 0) - (p.quotedAmount || 0))})
                    </td>
                  ))}
                </tr>

                {/* 8. Base Price */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Base Price
                  </td>
                  {filteredAndSortedParticipations.map(p => (
                    <td key={p.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-700">
                      {money(p.quotedAmount || 0)}
                    </td>
                  ))}
                </tr>

                {/* 9. Delivery Timeline */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Delivery Timeline
                    {checkDiffers(filteredAndSortedParticipations.map(p => parseTechnicalOffer(p).deliveryTimeline)) && (
                      <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-800 uppercase tracking-wider">
                        DIFFERS
                      </span>
                    )}
                  </td>
                  {filteredAndSortedParticipations.map(p => {
                    const tech = parseTechnicalOffer(p);
                    return (
                      <td key={p.id} className="p-3.5 border-r border-slate-200 font-extrabold text-slate-800">
                        {tech.deliveryTimeline || 'Not specified'}
                      </td>
                    );
                  })}
                </tr>

                {/* 10. Warranty Period */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Warranty Period
                  </td>
                  {filteredAndSortedParticipations.map(p => {
                    const tech = parseTechnicalOffer(p);
                    return (
                      <td key={p.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-700">
                        {tech.warrantyDetails || 'None'}
                      </td>
                    );
                  })}
                </tr>

                {/* 11. Technical Compliance - Commented out as requested */}
                {/* 
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Technical Compliance
                  </td>
                  {filteredAndSortedParticipations.map(p => {
                    const tech = parseTechnicalOffer(p);
                    return (
                      <td key={p.id} className="p-3.5 border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <StatusBadge label={p.technicalStatus || 'PENDING'} />
                          <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[150px]" title={tech.complianceRemarks}>
                            {tech.complianceRemarks || 'Compliant'}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                */}

                {/* 12. Uploaded Documents */}
                <tr className="hover:bg-slate-50/40">
                  <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Uploaded Documents
                  </td>
                  {filteredAndSortedParticipations.map(p => {
                    const hasDocs = Array.isArray(p.documents) && p.documents.length > 0;
                    return (
                      <td key={p.id} className="p-3.5 border-r border-slate-200">
                        {hasDocs ? (
                          <div className="flex flex-col gap-1">
                            {p.documents.map((d: any, idx: number) => {
                              const title = d.documentName || d.fileName || 'Attachment';
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (d.fileAssetId || d.fileUrl || d.url) {
                                      window.open(d.fileUrl || d.url || `/api/files/${d.fileAssetId}/view`, '_blank', 'noopener');
                                    } else {
                                      toast.error('File asset is not available.');
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline truncate max-w-[180px] text-left"
                                  title={title}
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{title}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">No documents</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

              </tbody>
            </table>
</div>
          </div>

          {/* Sticky Bottom Helper Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 border-t border-slate-100 pt-4 text-xs">
            <p className="text-slate-500 font-semibold text-[11px]">
              Select 2 to 4 seller quotations to evaluate detailed line-item rates, commercial terms, and L1 savings.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Clear Selection
              </button>
              <button
                onClick={() => router.push(`/bids/${bidId}`)}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0b2447] px-4 text-xs font-black text-white hover:bg-[#12335f] transition shadow-xs"
              >
                Close Comparison
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Award Decision Confirmation Modal */}
      {awardModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-150 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setAwardModal(prev => ({ ...prev, show: false }))}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-full h-8 w-8 flex items-center justify-center hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-xs">
                PO Generation Workflow
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1 flex items-center gap-1.5">
                <Award className="h-5 w-5 text-emerald-600" /> Confirm Award & Generate PO
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Officially award the procurement contract to the selected seller and generate Purchase Order.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-150 bg-slate-50/70 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="font-bold text-slate-500">Selected Supplier:</span>
                <span className="font-black text-slate-900">{awardModal.sellerName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="font-bold text-slate-500">Procurement Ref:</span>
                <span className="font-extrabold text-slate-900">Bid #{bid.id} ({bid.bidNumber || 'N/A'})</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="font-bold text-slate-500">Total Award Value:</span>
                <span className="font-black text-emerald-700 text-sm">{money(awardModal.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Delivery Schedule:</span>
                <span className="font-extrabold text-slate-800">{awardModal.delivery}</span>
              </div>
            </div>

            {/* Warning if non-L1 */}
            {awardModal.rank !== 1 && (
              <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black">L1 Non-Selection Override Warning</p>
                  <p className="mt-0.5 text-amber-800/90 font-semibold leading-relaxed">
                    You have selected a supplier other than the L1 Lowest Bidder. You are required by procurement policy to provide a detailed, audit-compliant justification reason below.
                  </p>
                </div>
              </div>
            )}

            {/* Remarks Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
                Award Justification / PO Notes {awardModal.rank !== 1 && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={awardModal.remarks}
                onChange={e => setAwardModal(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder={awardModal.rank === 1 ? "PO notes or policy justifications..." : "Mandatory justification for L1 non-selection..."}
                rows={3}
                className="w-full rounded-xl border border-slate-250 p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={awardModal.confirmed}
                onChange={e => setAwardModal(prev => ({ ...prev, confirmed: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-slate-600 leading-snug">
                I officially declare that this award decision complies with local procurement rules, standard evaluation criteria, and is backed by authorized audit justification.
              </span>
            </label>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setAwardModal(prev => ({ ...prev, show: false }))}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAward}
                disabled={awardMutation.isPending || !awardModal.confirmed || (awardModal.rank !== 1 && !awardModal.remarks.trim())}
                className="inline-flex h-10 items-center gap-1.5 justify-center rounded-xl bg-emerald-600 px-5 text-xs font-black text-white hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <Award className="h-4 w-4" /> {awardMutation.isPending ? 'Generating PO...' : 'Confirm & Generate PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
