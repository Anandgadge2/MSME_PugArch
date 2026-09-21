'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { 
  ArrowLeft, ShieldAlert, Award, Star, Info,
  CheckCircle2, AlertTriangle, FileText, BadgePercent, IndianRupee,
  Activity, Users, ChevronRight, HelpCircle, Eye, Download, X,
  Flame, BarChart3, Zap, Trophy, Scale, Layers, Filter, RotateCcw,
  Phone, Mail, Building, FileSpreadsheet, Printer, ExternalLink,
  ShieldCheck, Check, Clock
} from 'lucide-react';
import { PageShell, StatusBadge, ProcurementHero, ProcurementLoadingState, ProcurementErrorState } from '../components';
import { money } from '../data';
import { toast } from 'sonner';
import { procurementBidApi } from '../api';
import { getApi } from '../../shared/apiClient';
import { normalizeQuotationDocuments } from '../components/SupplierQuotationDetailModal';
import { openFileAsset } from '../../../lib/files';

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

  useEffect(() => {
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

  // Fetch bid details with participations, fresh participants, and requirement responses concurrently
  const { data: bid, isLoading, error, refetch } = useQuery({
    queryKey: ['procurement-bid-comparison', bidId],
    queryFn: async () => {
      const [bidRes, partRes, fallbackReqRes] = await Promise.allSettled([
        procurementBidApi.getBidResults(bidId),
        getApi(`/api/buyer/procurement-bids/${encodeURIComponent(bidId)}/participants`, true),
        getApi(`/api/buyer/requirements/${encodeURIComponent(bidId)}/responses`, true),
      ]);

      let data: any = bidRes.status === 'fulfilled' ? bidRes.value : null;
      if (!data) {
        data = await procurementBidApi.detail(bidId, true);
      }

      const participantsFromApi = partRes.status === 'fulfilled' && Array.isArray(partRes.value) ? partRes.value : [];
      const reqResponses = fallbackReqRes.status === 'fulfilled' && (Array.isArray(fallbackReqRes.value) ? fallbackReqRes.value : (fallbackReqRes.value as any)?.responses || []);

      const currentParts = Array.isArray(data?.participations) ? data.participations : (Array.isArray(data?.results) ? data.results : []);
      const enrichedParts = [...currentParts];

      for (const p of [...participantsFromApi, ...reqResponses]) {
        if (!p) continue;
        const sId = p.sellerUserId || p.sellerId || p.seller?.id;
        const existing = enrichedParts.find((ep: any) => 
          (ep.id && p.id && String(ep.id) === String(p.id)) ||
          (sId && (String(ep.sellerId) === String(sId) || String(ep.sellerUserId) === String(sId)))
        );
        if (existing) {
          if (!existing.sellerMobile && (p.sellerMobile || p.mobile || p.phone || p.seller?.mobile || p.sellerUser?.mobile)) {
            existing.sellerMobile = p.sellerMobile || p.mobile || p.phone || p.seller?.mobile || p.sellerUser?.mobile;
          }
          if ((!existing.documents || existing.documents.length === 0) && Array.isArray(p.documents) && p.documents.length > 0) {
            existing.documents = p.documents;
          }
          if (!existing.attachmentUrl && p.attachmentUrl) {
            existing.attachmentUrl = p.attachmentUrl;
          }
          if (!existing.makeBrand && p.makeBrand) existing.makeBrand = p.makeBrand;
          if (!existing.model && p.model) existing.model = p.model;
        } else {
          enrichedParts.push(p);
        }
      }

      data.participations = enrichedParts;
      return data;
    },
    enabled: !!bidId && !!token,
    staleTime: 5_000,
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
      toast.success('Contract award offer issued successfully! Awaiting seller acceptance before Purchase Order can be generated.');
      setAwardModal(prev => ({ ...prev, show: false }));
      queryClient.invalidateQueries({ queryKey: ['procurement-bid', bidId] });
      queryClient.invalidateQueries({ queryKey: ['procurement-bid-comparison', bidId] });
      queryClient.invalidateQueries({ queryKey: ['buyer-unified-participations'] });
      router.push(`/bids/${bidId}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to issue award offer');
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

  const parseTechnicalOffer = useCallback((input: any) => {
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
      makeBrand: firstVal(p.makeBrand, details.makeBrand, respData.makeBrand, ackData.makeBrand, descObj.makeBrand, techOffer.makeBrand, firstItem.makeBrand, firstItem.brand),
      model: firstVal(p.model, details.model, respData.model, ackData.model, descObj.model, techOffer.model, firstItem.model, firstItem.modelNumber),
      offeredItemDescription: firstVal(descObj.offeredItemDescription, p.offeredItemDescription, respData.offeredItemDescription, ackData.offeredItemDescription, p.message, respData.message, firstItem.description),
      complianceRemarks: firstVal(p.complianceRemarks, details.complianceRemarks, respData.complianceRemarks, ackData.complianceRemarks, techOffer.complianceRemarks, firstItem.complianceRemarks, firstItem.remarks),
      deliveryTimeline: firstVal(p.deliveryTimeline, details.deliveryTimeline, respData.deliveryTimeline, ackData.deliveryTimeline, techOffer.deliveryTimeline, firstItem.deliveryTimeline, firstItem.deliveryRequirement, firstItem.deliverySchedule),
      warrantyDetails: firstVal(p.warrantyDetails, details.warrantyDetails, respData.warrantyDetails, ackData.warrantyDetails, techOffer.warrantyDetails, firstItem.warrantyDetails, firstItem.warranty),
      serviceSupport: firstVal(p.serviceSupport, details.serviceSupport, respData.serviceSupport, ackData.serviceSupport, techOffer.serviceSupport),
      deviation: firstVal(p.deviation, details.deviation, respData.deviation, ackData.deviation, techOffer.deviation, firstItem.deviation),
      rfqNotes: firstVal(p.rfqNotes, details.rfqNotes, respData.rfqNotes, ackData.rfqNotes, details.notes, respData.notes, ackData.notes),
      paymentTerms: firstVal(p.paymentTerms, details.paymentTerms, respData.paymentTerms, ackData.paymentTerms, p.terms, respData.terms, ackData.terms),
    };
  }, []);

  const getSellerPhone = useCallback((p: any) => {
    const respData = typeof p.responseData === 'string' ? (() => { try { return JSON.parse(p.responseData); } catch { return {}; } })() : (p.responseData || {});
    const ackData = typeof p.acknowledgement === 'string' ? (() => { try { return JSON.parse(p.acknowledgement); } catch { return {}; } })() : (p.acknowledgement || {});
    const descObj = typeof p.offeredItemDescription === 'string' ? (() => { try { return JSON.parse(p.offeredItemDescription); } catch { return {}; } })() : (p.offeredItemDescription && typeof p.offeredItemDescription === 'object' ? p.offeredItemDescription : {});

    const phoneCandidates = [
      p.sellerMobile,
      p.seller?.mobile,
      p.seller?.phone,
      p.sellerUser?.mobile,
      p.sellerUser?.phone,
      p.phone,
      p.mobile,
      p.seller?.sellerProfile?.mobile,
      p.seller?.sellerProfile?.phone,
      p.seller?.organization?.mobile,
      p.seller?.organization?.phone,
      respData.sellerMobile,
      respData.mobile,
      respData.phone,
      ackData.sellerMobile,
      ackData.mobile,
      ackData.phone,
      descObj.mobile,
      descObj.phone
    ];

    const val = phoneCandidates.find(v => typeof v === 'string' && v.trim().length > 0 && v !== '—' && v !== '-' && v !== 'null' && v !== 'undefined');
    return val ? val.trim() : null;
  }, []);

  const handleOpenAwardModal = (p: any) => {
    const tech = parseTechnicalOffer(p);
    setAwardModal({
      show: true,
      participationId: p.id,
      sellerName: p.seller?.organization?.organizationName || p.seller?.name || p.sellerName || `Seller #${p.sellerId}`,
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
        return String(a.seller?.organization?.organizationName || a.seller?.name || '').localeCompare(String(b.seller?.organization?.organizationName || b.seller?.name || ''));
      }
      return (a.totalAmount || a.quotedAmount || 0) - (b.totalAmount || b.quotedAmount || 0);
    });

    return items;
  }, [bid, filterStatus, sortBy, selectedIds, parseTechnicalOffer]);

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

  const handlePreviewDoc = (d: any) => {
    const assetId = d.fileAssetId || (typeof d.id === 'number' ? d.id : null);
    const title = d.name || d.fileName || 'Quotation Document';
    if (assetId) {
      openFileAsset({
        id: assetId,
        fileAssetId: assetId,
        originalName: title,
        url: d.fileUrl || `/api/files/${assetId}/view`
      }, title).catch(() => {
        window.open(d.fileUrl || `/api/files/${assetId}/view`, '_blank', 'noopener');
      });
      return;
    }
    if (d.fileUrl || d.url) {
      window.open(d.fileUrl || d.url, '_blank', 'noopener');
      return;
    }
    toast.error('Document preview is not available.');
  };

  const handleExportCsv = () => {
    if (!filteredAndSortedParticipations.length) return;
    const headers = ['Field', ...filteredAndSortedParticipations.map((p, i) => `${i === 0 ? '[L1] ' : `[L${i + 1}] `}${p.seller?.organization?.organizationName || p.seller?.name || `Vendor ${i + 1}`}`)];
    
    const rows: string[][] = [
      headers,
      ['Rank', ...filteredAndSortedParticipations.map((_, i) => `L${i + 1}`)],
      ['Total Quoted (INR)', ...filteredAndSortedParticipations.map(p => String(p.totalAmount || p.quotedAmount || 0))],
      ['Base Price (INR)', ...filteredAndSortedParticipations.map(p => String(p.quotedAmount || 0))],
      ['GST %', ...filteredAndSortedParticipations.map(p => `${p.gstPercentage || 0}%`)],
      ['Contact Person', ...filteredAndSortedParticipations.map(p => p.seller?.name || p.sellerName || '—')],
      ['Email', ...filteredAndSortedParticipations.map(p => p.seller?.email || '—')],
      ['Mobile Number', ...filteredAndSortedParticipations.map(p => getSellerPhone(p) || '—')],
      ['Delivery Timeline', ...filteredAndSortedParticipations.map(p => parseTechnicalOffer(p).deliveryTimeline || '—')],
      ['Payment Terms', ...filteredAndSortedParticipations.map(p => parseTechnicalOffer(p).paymentTerms || '—')],
      ['Technical Status', ...filteredAndSortedParticipations.map(p => p.technicalStatus || 'PENDING')],
      ['Make / Brand', ...filteredAndSortedParticipations.map(p => parseTechnicalOffer(p).makeBrand || '—')],
      ['Model', ...filteredAndSortedParticipations.map(p => parseTechnicalOffer(p).model || '—')],
      ['Documents Count', ...filteredAndSortedParticipations.map(p => String(normalizeQuotationDocuments(p).length))]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Quotation_Comparison_${bidId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Comparison exported to CSV!');
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="container mx-auto p-6 max-w-7xl">
          <ProcurementLoadingState message="Analyzing and comparing bid submissions..." />
        </div>
      </PageShell>
    );
  }

  if (error || !bid) {
    return (
      <PageShell>
        <div className="container mx-auto p-6 max-w-7xl">
          <ProcurementErrorState message="Could not fetch bid comparison details." onRetry={refetch} />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="container mx-auto space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl">
        
        {/* Top Breadcrumb & Quick Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push(`/bids/${bidId}/results`);
                }
              }}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500" />
              <span>Back to Results</span>
            </button>

            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 ml-2">
              <span
                className="hover:text-slate-800 cursor-pointer"
                onClick={() => router.push('/bids')}
              >
                Procurements
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span
                className="font-mono text-slate-700 hover:text-slate-900 cursor-pointer font-bold"
                onClick={() => router.push(`/bids/${bidId}/results`)}
              >
                {bidId}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="text-emerald-900 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px]">
                Quotation Comparison
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-700 transition cursor-pointer"
              title="Download Side-by-Side Comparison as CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              title="Print / Save as PDF"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={() => router.push(`/bids/${bidId}/results`)}
              className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              title="Close Comparison"
              aria-label="Close Comparison"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Comparison Container Shell */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-6">
          
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-xs">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Commercial Quotation & L1 Ranking Comparison
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase tracking-wide">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" /> L1 EVALUATED
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Comparing <span className="font-bold text-slate-800">{filteredAndSortedParticipations.length}</span> seller quotation{filteredAndSortedParticipations.length === 1 ? '' : 's'} for <span className="font-mono text-slate-700 font-bold">{bidId}</span>. L1 is determined by compliant lowest total quoted price.
                </p>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds([])}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-250 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Show All Quotations</span>
                </button>
              </div>
            )}
          </div>

          {/* Top 4 Summary Metric Cards Grid */}
          {comparisonMetrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: L1 LOWEST BIDDER */}
              <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-4.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                    <Trophy className="h-3.5 w-3.5 text-emerald-600" /> L1 LOWEST BIDDER
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-xs font-black text-slate-900 truncate uppercase" title={comparisonMetrics.l1OrgName}>
                  {comparisonMetrics.l1OrgName}
                </p>
                <p className="text-lg font-black text-emerald-700 tracking-tight">
                  {money(comparisonMetrics.l1Price)}
                </p>
                <p className="text-[10.5px] font-semibold text-slate-500">
                  Lowest evaluated financial quotation
                </p>
              </div>

              {/* Card 2: L1 COMMERCIAL SAVINGS */}
              <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-4.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                    <Flame className="h-3.5 w-3.5 text-amber-600" /> L1 COMMERCIAL SAVINGS
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    vs L2
                  </span>
                </div>
                <p className="text-lg font-black text-amber-800 tracking-tight">
                  {comparisonMetrics.l1Savings > 0 ? money(comparisonMetrics.l1Savings) : '₹0'}
                </p>
                <p className="text-[11px] font-bold text-emerald-700">
                  {comparisonMetrics.savingsPercent}% lower than L2
                </p>
                <p className="text-[10.5px] font-semibold text-slate-500">
                  Direct commercial cost reduction
                </p>
              </div>

              {/* Card 3: QUOTED PRICE SPREAD */}
              <div className="rounded-2xl border border-purple-200/80 bg-gradient-to-br from-purple-50/50 to-white p-4.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-purple-800 text-[10px] font-black uppercase tracking-wider">
                    <BarChart3 className="h-3.5 w-3.5 text-purple-600" /> QUOTED PRICE SPREAD
                  </span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                    {comparisonMetrics.totalCount} Quotes
                  </span>
                </div>
                <p className="text-sm font-black text-slate-900 tracking-tight mt-1">
                  {money(comparisonMetrics.l1Price)} – {money(comparisonMetrics.maxPrice)}
                </p>
                <p className="text-[11px] font-bold text-purple-700">
                  Spread: {money(comparisonMetrics.maxPrice - comparisonMetrics.l1Price)}
                </p>
                <p className="text-[10.5px] font-semibold text-slate-500">
                  Range across all participating vendors
                </p>
              </div>

              {/* Card 4: COMMERCIAL EVALUATION */}
              <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/50 to-white p-4.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-blue-800 text-[10px] font-black uppercase tracking-wider">
                    <Zap className="h-3.5 w-3.5 text-blue-600" /> COMMERCIAL EVALUATION
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    Ranking Mode
                  </span>
                </div>
                <p className="text-xs font-black text-slate-900 uppercase">
                  L1 Evaluated & Ranked
                </p>
                <p className="text-[11px] font-bold text-blue-700">
                  Lowest Total Quoted Amount
                </p>
                <p className="text-[10.5px] font-semibold text-slate-500">
                  Complies with procurement guidelines
                </p>
              </div>

            </div>
          )}

          {/* Comparison Matrix Table */}
          <div className="w-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table data-ux-wrapped="true" className="w-full min-w-[900px] border-collapse text-left text-xs">
                
                {/* Header Columns per Supplier */}
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90">
                    <th className="p-4 w-[260px] font-black text-slate-800 uppercase tracking-wider bg-slate-100/90 border-r border-slate-200 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center gap-1.5">
                        <Scale className="h-4 w-4 text-slate-600" />
                        <span>Field / Parameter</span>
                      </div>
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
                          className={`p-4 border-r border-slate-200 align-top min-w-[280px] ${isL1 ? 'bg-emerald-50/50 border-t-4 border-t-emerald-600' : 'bg-slate-50/30'}`}
                        >
                          <div className="space-y-3">
                            {/* Rank Badge */}
                            <div>
                              {isL1 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[10.5px] font-black text-white shadow-2xs uppercase tracking-wider">
                                  🥇 L1 (LOWEST BIDDER)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-[10.5px] font-black text-blue-700 shadow-2xs">
                                  🥈 L{index + 1} (+{money(diff)} • +{diffPct}%)
                                </span>
                              )}
                            </div>

                            {/* Organization & Contact Details */}
                            <div>
                              <p className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-snug">
                                {orgName}
                              </p>
                              <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                                <span className="text-slate-400">👤</span> {contactPerson}
                              </p>
                            </div>

                            {/* Award Action Button */}
                            <div>
                              {(() => {
                                const existingAward = (bid?.awards || []).find((a: any) => a.participationId === p.id || a.sellerId === p.sellerId);
                                const isOffered = p.finalStatus === 'AWARD_OFFERED' || existingAward?.awardStatus === 'OFFERED';
                                const isAccepted = p.finalStatus === 'AWARD_ACCEPTED' || existingAward?.awardStatus === 'ACCEPTED';
                                const isPoIssued = p.finalStatus === 'PO_ISSUED' || p.finalStatus === 'ORDERED';

                                if (isPoIssued) {
                                  return (
                                    <span className="inline-flex h-8.5 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-250 shadow-2xs">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
                                      PO Issued
                                    </span>
                                  );
                                }

                                if (isAccepted) {
                                  return (
                                    <span className="inline-flex h-8.5 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      Award Accepted
                                    </span>
                                  );
                                }

                                if (isOffered) {
                                  return (
                                    <span className="inline-flex h-8.5 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                                      Award Offered (Pending Seller)
                                    </span>
                                  );
                                }

                                return (
                                  <button
                                    onClick={() => handleOpenAwardModal(p)}
                                    className={`inline-flex h-8.5 items-center gap-1.5 rounded-xl px-4 text-xs font-black text-white shadow-xs transition hover:opacity-95 cursor-pointer ${
                                      isL1 
                                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                                    }`}
                                    title={isL1 ? "Issue contract award offer to L1 lowest bidder" : "Issue award offer with L1 override justification"}
                                  >
                                    <Award className="h-4 w-4" /> 
                                    <span>{isL1 ? 'Issue Award Offer' : 'Offer Award (Override)'}</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Table Body Rows */}
                <tbody className="divide-y divide-slate-150">
                  
                  {/* SECTION 1: COMMERCIAL OVERVIEW & L1 RANKING */}
                  <tr className="bg-slate-100/70 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    <td colSpan={filteredAndSortedParticipations.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100/90 font-black">
                      <span className="flex items-center gap-1.5 text-[#12335f]">
                        <span className="h-3.5 w-1 bg-[#12335f] rounded-full" />
                        1. Commercial Overview & Financial Ranking
                      </span>
                    </td>
                  </tr>

                  {/* 1. Commercial Rank */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Commercial Rank
                      {checkDiffers(filteredAndSortedParticipations.map((_, idx) => `L${idx + 1}`)) && (
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[8.5px] font-black text-amber-800 uppercase tracking-wider border border-amber-200">
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

                  {/* 2. Quoted Total Amount */}
                  <tr className="hover:bg-emerald-50/20 bg-emerald-50/10 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-black text-slate-900 bg-slate-50/70 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Quoted Total Amount
                      {checkDiffers(filteredAndSortedParticipations.map(p => p.totalAmount || p.quotedAmount || 0)) && (
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[8.5px] font-black text-amber-800 uppercase tracking-wider border border-amber-200">
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
                          <div className="font-black text-base text-slate-900">{money(price)}</div>
                          {index === 0 ? (
                            <span className="inline-block rounded-md bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[9.5px] font-black text-emerald-800 uppercase tracking-wide mt-1">
                              LOWEST QUOTE (L1)
                            </span>
                          ) : (
                            <span className="inline-block rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9.5px] font-bold text-slate-600 mt-1">
                              +{money(diff)} (+{diffPct}%)
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 3. Base Price */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Base Price (excl. Tax)
                    </td>
                    {filteredAndSortedParticipations.map(p => (
                      <td key={p.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-800">
                        {money(p.quotedAmount || p.totalAmount || 0)}
                      </td>
                    ))}
                  </tr>

                  {/* 4. GST & Taxes */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      GST & Taxes
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const total = p.totalAmount || 0;
                      const base = p.quotedAmount || 0;
                      const taxDiff = total > base ? total - base : 0;
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                          {p.gstPercentage ? `${p.gstPercentage}%` : 'Standard'} {taxDiff > 0 ? `(${money(taxDiff)})` : '(Included)'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 5. Delivery Timeline */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Delivery Timeline
                      {checkDiffers(filteredAndSortedParticipations.map(p => parseTechnicalOffer(p).deliveryTimeline)) && (
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[8.5px] font-black text-amber-800 uppercase tracking-wider border border-amber-200">
                          DIFFERS
                        </span>
                      )}
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const tech = parseTechnicalOffer(p);
                      const t = tech.deliveryTimeline;
                      const formattedTime = t && /^\d+$/.test(String(t).trim()) ? `${t} days` : (t || 'Not specified');
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-black text-slate-800">
                          {formattedTime}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 6. Payment Terms */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Payment Terms
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const tech = parseTechnicalOffer(p);
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-medium text-slate-700">
                          {tech.paymentTerms || 'As per tender requirements'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* SECTION 2: SUPPLIER INFORMATION & DIRECT CONTACT */}
                  <tr className="bg-slate-100/70 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    <td colSpan={filteredAndSortedParticipations.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100/90 font-black">
                      <span className="flex items-center gap-1.5 text-[#12335f]">
                        <span className="h-3.5 w-1 bg-[#12335f] rounded-full" />
                        2. Supplier Profile & Contact Information
                      </span>
                    </td>
                  </tr>

                  {/* 7. Organization Name */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Organization Name
                    </td>
                    {filteredAndSortedParticipations.map(p => (
                      <td key={p.id} className="p-3.5 border-r border-slate-200 font-black text-slate-900 uppercase">
                        {p.seller?.organization?.organizationName || p.seller?.name || p.sellerName || 'Supplier'}
                      </td>
                    ))}
                  </tr>

                  {/* 8. Contact Person */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Contact Person
                    </td>
                    {filteredAndSortedParticipations.map(p => (
                      <td key={p.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-800">
                        {p.seller?.name || p.sellerName || 'Representative'}
                      </td>
                    ))}
                  </tr>

                  {/* 9. Email Address */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Email Address
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const email = p.seller?.email || p.sellerEmail || p.email;
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-medium text-slate-700">
                          {email ? (
                            <a href={`mailto:${email}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              <span>{email}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">Not provided</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 10. Mobile / Phone Number */}
                  <tr className="hover:bg-slate-50/60 transition-colors bg-blue-50/15">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Mobile Number</span>
                      </div>
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const phone = getSellerPhone(p);
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-800">
                          {phone ? (
                            <a 
                              href={`tel:${phone.replace(/[^0-9+]/g, '')}`} 
                              className="inline-flex items-center gap-1.5 font-bold text-slate-900 hover:text-emerald-700 bg-slate-100/80 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-slate-200 transition"
                            >
                              <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>{phone}</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                              <Info className="h-3 w-3" /> Not listed
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* SECTION 3: TECHNICAL SPECIFICATIONS & COMPLIANCE */}
                  <tr className="bg-slate-100/70 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    <td colSpan={filteredAndSortedParticipations.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100/90 font-black">
                      <span className="flex items-center gap-1.5 text-[#12335f]">
                        <span className="h-3.5 w-1 bg-[#12335f] rounded-full" />
                        3. Technical Specifications & Compliance
                      </span>
                    </td>
                  </tr>

                  {/* 11. Technical Status */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Technical Status
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const ts = String(p.technicalStatus || '').toUpperCase();
                      const isQual = ts === 'QUALIFIED';
                      const isDisq = ts === 'DISQUALIFIED' || ts === 'NOT_QUALIFIED' || p.isDisqualified;

                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200">
                          {isQual ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 shadow-2xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Qualified
                            </span>
                          ) : isDisq ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-800 shadow-2xs">
                              <X className="h-3.5 w-3.5 text-rose-600" /> Disqualified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-800 shadow-2xs">
                              <Clock className="h-3.5 w-3.5 text-amber-600" /> Pending Review
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 12. Make / Brand */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Make / Brand
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const tech = parseTechnicalOffer(p);
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-800">
                          {tech.makeBrand || 'Standard'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 13. Model */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Model / Reference
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const tech = parseTechnicalOffer(p);
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-800">
                          {tech.model || 'Standard'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 14. Item / Scope Description */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Offered Scope / Remarks
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const tech = parseTechnicalOffer(p);
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-medium text-slate-600 text-[11.5px] leading-relaxed">
                          {tech.offeredItemDescription || tech.complianceRemarks || 'Compliant with specified requirement terms'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* SECTION 4: COMPLIANCE & UPLOADED DOCUMENTS */}
                  <tr className="bg-slate-100/70 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    <td colSpan={filteredAndSortedParticipations.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100/90 font-black">
                      <span className="flex items-center gap-1.5 text-[#12335f]">
                        <span className="h-3.5 w-1 bg-[#12335f] rounded-full" />
                        4. Uploaded Quotation Documents & Compliance Proofs
                      </span>
                    </td>
                  </tr>

                  {/* 15. Uploaded Documents Row */}
                  <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span>Uploaded Documents</span>
                        </div>
                        <span className="text-[10px] font-normal text-slate-400 block">
                          Technical & Commercial attachments
                        </span>
                      </div>
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const docs = normalizeQuotationDocuments(p);
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 align-top">
                          {docs.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {docs.map((d, dIdx) => (
                                <button
                                  key={dIdx}
                                  type="button"
                                  onClick={() => handlePreviewDoc(d)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-250 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-800 transition shadow-2xs text-left group cursor-pointer"
                                  title={`Click to view/download ${d.name}`}
                                >
                                  <FileText className="h-4 w-4 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                                  <span className="truncate max-w-[200px]">{d.name}</span>
                                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-blue-600 ml-auto shrink-0 transition-colors" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/70 border border-slate-200/80 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                              <Info className="h-3.5 w-3.5 text-slate-400" />
                              <span>No documents attached</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 16. Submission Date */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Submission Timestamp
                    </td>
                    {filteredAndSortedParticipations.map(p => {
                      const dateVal = p.submittedAt || p.createdAt;
                      const formatted = dateVal ? new Date(dateVal).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '—';
                      return (
                        <td key={p.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-600">
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* Sticky Bottom Helper Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
            <p className="text-slate-500 font-semibold text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                Under procurement rules, selection of non-L1 bidders requires written justification for audit records.
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(`/bids/${bidId}/results`)}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0b2447] px-4 text-xs font-black text-white hover:bg-[#12335f] transition shadow-xs cursor-pointer"
              >
                Back to Bid Results
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Award Decision Confirmation Modal */}
      {awardModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-150 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setAwardModal(prev => ({ ...prev, show: false }))}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-full h-8 w-8 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                Contract Award Offer Workflow
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1 flex items-center gap-1.5">
                <Award className="h-5 w-5 text-emerald-600" /> Confirm & Issue Award Offer
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Officially issue the contract award offer to the selected supplier. The supplier will be notified to accept or decline before the Purchase Order is generated.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-150 bg-slate-50/80 p-4 space-y-2.5 text-xs">
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
              <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black">L1 Non-Selection Override Notice</p>
                  <p className="mt-0.5 text-amber-800/90 font-semibold leading-relaxed">
                    You have selected a supplier other than the L1 Lowest Bidder. You are required by procurement policy to provide a detailed, audit-compliant justification reason below.
                  </p>
                </div>
              </div>
            )}

            {/* Remarks Input */}
            <div className="space-y-1.5">
              <label htmlFor="award-remarks" className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                Award Justification / Notes {awardModal.rank !== 1 && <span className="text-rose-600 font-black">*</span>}
              </label>
              <textarea
                id="award-remarks"
                value={awardModal.remarks}
                onChange={e => setAwardModal(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder={awardModal.rank === 1 ? "Optional notes or terms for the seller..." : "Mandatory justification reason for selecting non-L1 supplier..."}
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
                I declare that this award offer complies with procurement policies and is authorized for issuance to the supplier.
              </span>
            </label>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAwardModal(prev => ({ ...prev, show: false }))}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAward}
                disabled={awardMutation.isPending || !awardModal.confirmed || (awardModal.rank !== 1 && !awardModal.remarks.trim())}
                className="inline-flex h-10 items-center gap-1.5 justify-center rounded-xl bg-emerald-600 px-5 text-xs font-black text-white hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                <Award className="h-4 w-4" /> {awardMutation.isPending ? 'Issuing Award Offer...' : 'Confirm & Issue Award Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
