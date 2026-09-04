'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  FileText,
  Clock,
  Gavel,
  Trophy,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  IndianRupee,
  AlertTriangle,
  AlertCircle,
  XCircle,
  FileEdit,
  TrendingUp,
  Target,
  Award,
  Scale,
  Receipt,
  ClipboardList,
  ChevronDown,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { toast } from 'sonner';
import { api } from '../../../lib/api';
import { sellerRoutes } from '@/lib/routes';
import { useAuth } from '../../../hooks/useAuth';
import { procurementBidApi } from '../api';
import { formatDate } from '../../shared/format';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { EmptyState, LoadingState } from '../../shared/FeatureStates';

type BidTypeFilter = 'all' | 'submitted' | 'draft' | 'awarded';

const getKpiFilterLabel = (kpi: string) => {
  switch (kpi) {
    case 'active_pipeline': return 'Active Pipeline';
    case 'submitted': return 'Submitted Bids';
    case 'technical_financial': return 'Under Tech/Fin Eval';
    case 'technical': return 'Technical Eval';
    case 'financial': return 'Financial Eval';
    case 'awarded': return 'Awarded Contracts';
    case 'draft': return 'Draft Bids';
    case 'dueSoon': return 'Closing in ≤ 7 Days';
    case 'ready': return 'Docs / Quote Staged';
    case 'early': return 'Early Setup Stage';
    case 'pendingInvoice': return 'Pending Invoicing';
    case 'invoiced': return 'Billing Initiated';
    default: return kpi;
  }
};

const getDateFilterLabel = (date: string) => {
  if (date === '7') return '≤ 7 Days';
  if (date === '15') return '≤ 15 Days';
  if (date === '30') return '≤ 30 Days';
  if (date === 'closed') return 'Closed / Expired';
  return date;
};

const getValueFilterLabel = (val: string) => {
  if (val === '5l') return '< ₹5 Lakhs';
  if (val === '25l') return '₹5L – ₹25 Lakhs';
  if (val === '1cr') return '₹25L – ₹1 Crore';
  if (val === 'above1cr') return '> ₹1 Crore';
  return val;
};

const formatCurrency = (value: number | string | null | undefined) => {
  const num = Number(value || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

// Formats messy or raw IDs into clean, official procurement reference codes
const formatBidDisplayId = (item: any): string => {
  const raw = String(item?.bid?.bidNumber || item?.bid?.bidNo || item?.bid?.id || item?.bidId || item?.requirementId || '').trim();
  if (!raw) return 'BID-000';
  
  // If already formatted with standard prefix
  if (/^(RFQ|RFP|TND|BID|REQ|LT|RA|RC)-/i.test(raw)) {
    return raw.toUpperCase();
  }
  
  // If requirement formatted like req-39 or req_39
  const reqMatch = raw.match(/^req[-_]?(\d+)$/i);
  if (reqMatch) {
    const num = reqMatch[1].padStart(3, '0');
    const typeStr = String(item?.bid?.procurementType || item?.bid?.bidType || item?.bid?.category || '').toUpperCase();
    if (typeStr.includes('RFP') || typeStr.includes('PROPOSAL')) return `RFP-${num}`;
    return `RFQ-${num}`;
  }
  
  // If numeric ID like 25, 17, 16
  const numMatch = raw.match(/^(\d+)$/);
  if (numMatch) {
    const num = numMatch[1].padStart(3, '0');
    const typeStr = String(item?.bid?.procurementType || item?.bid?.bidType || item?.bid?.category || '').toUpperCase();
    if (typeStr.includes('RFP') || typeStr.includes('PROPOSAL')) return `RFP-${num}`;
    if (typeStr.includes('RFQ') || typeStr.includes('QUOTATION')) return `RFQ-${num}`;
    if (typeStr.includes('LIMITED')) return `LT-${num}`;
    if (typeStr.includes('AUCTION') || typeStr.includes('REVERSE')) return `RA-${num}`;
    if (typeStr.includes('RATE')) return `RC-${num}`;
    if (typeStr.includes('OPEN') || typeStr.includes('TENDER')) return `TND-${num}`;
    return `BID-${num}`;
  }

  if (raw.length > 10) {
    return `BID-${raw.slice(-6).toUpperCase()}`;
  }

  return raw.toUpperCase().replace(/^#+/, '');
};

const getParticipationType = (item: any): string => {
  if (item?.isMarketplaceResponse) {
    const isRfp = String(item.bid?.category || item.bid?.title || '').toLowerCase().includes('proposal') || String(item.bid?.category || '').toLowerCase().includes('rfp');
    return isRfp ? 'RFP' : 'RFQ';
  }
  const raw = String(item?.bid?.procurementType || item?.bid?.bidType || item?.bid?.category || '').toLowerCase();
  if (raw.includes('limited')) return 'Limited Tender';
  if (raw.includes('reverse') || raw.includes('auction')) return 'Reverse Auction';
  if (raw.includes('rate') || raw.includes('contract')) return 'Rate Contract';
  if (raw.includes('rfp') || raw.includes('proposal')) return 'RFP';
  if (raw.includes('rfq') || raw.includes('quotation')) return 'RFQ';
  if (raw.includes('open') || raw.includes('tender')) return 'Open Tender';
  return 'Open Tender';
};

// Seller participations progress through a 6-state submission machine
// (DRAFT -> TECHNICAL_DOCUMENTS_UPLOADED -> FINANCIAL_QUOTE_UPLOADED -> SUBMITTED,
// plus WITHDRAWN / REJECTED). The old code bucketed only the exact DRAFT and
// SUBMITTED strings, so in-progress rows disappeared from every tab. These
// helpers classify every state into exactly one visible bucket.
const statusOf = (p: any) => String(p?.status ?? p?.submissionStatus ?? 'DRAFT').toUpperCase();
const finalStatusOf = (p: any) => String(p?.finalStatus ?? '').toUpperCase();

// A seller is "awarded" only once an award is admin-approved (or the participation
// is flagged AWARDED). A merely RECOMMENDED award is not yet a win, so it must not
// surface on the Awarded page or in its KPI count.
const isAwarded = (p: any) =>
  finalStatusOf(p) === 'AWARDED' ||
  (Array.isArray(p?.awards) && p.awards.some((a: any) =>
    String(a?.awardStatus || '').toUpperCase() === 'ADMIN_APPROVED' || !!a?.awardedAt
  ));

// Draft = still being prepared by the seller and not yet awarded/withdrawn/rejected.
const isDraft = (p: any) => {
  if (isAwarded(p)) return false;
  const s = statusOf(p);
  return s === 'DRAFT' || s === 'TECHNICAL_DOCUMENTS_UPLOADED' || s === 'FINANCIAL_QUOTE_UPLOADED';
};

// Submitted = the seller finalised their bid. Awarded rows also originate from a
// submission, so keep them visible under Submitted too (they additionally show
// on the Awarded page). Withdrawn/rejected are excluded.
const isSubmitted = (p: any) => {
  if (isAwarded(p)) return true;
  const s = statusOf(p);
  return s === 'SUBMITTED' || s === 'ACCEPTED';
};

// Fast in-memory cache for seller participations
let cachedSellerParticipations: any[] | null = null;
let lastSellerFetchTime = 0;
const CACHE_TTL_MS = 60000;

export default function SellerBidsPage({ subRouteType = 'all' }: { subRouteType?: BidTypeFilter }) {
  const { user } = useAuth();
  const router = useRouter();

  // Data state: initialize from in-memory cache if available for instant display
  const [participations, setParticipations] = useState<any[]>(() => cachedSellerParticipations || []);
  const [loading, setLoading] = useState<boolean>(() => !cachedSellerParticipations);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [convertingInvoiceId, setConvertingInvoiceId] = useState<string | null>(null);

  // Filters
  const [kpiFilter, setKpiFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [valueFilter, setValueFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useResponsiveViewMode('seller-bids:view-mode');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const resetAllFilters = useCallback(() => {
    setSearchTerm('');
    setSortBy('newest');
    setKpiFilter('all');
    setTypeFilter('');
    setStatusFilter('');
    setStageFilter('');
    setBuyerFilter('');
    setDateFilter('');
    setValueFilter('');
    setPage(1);
  }, []);

  const activeDetailedFilterCount = useMemo(() => {
    return (
      (typeFilter ? 1 : 0) +
      (statusFilter ? 1 : 0) +
      (stageFilter ? 1 : 0) +
      (buyerFilter ? 1 : 0) +
      (dateFilter ? 1 : 0) +
      (valueFilter ? 1 : 0)
    );
  }, [typeFilter, statusFilter, stageFilter, buyerFilter, dateFilter, valueFilter]);

  const hasAnyActiveFilters = useMemo(() => {
    return (
      activeDetailedFilterCount > 0 ||
      Boolean(debouncedSearch) ||
      kpiFilter !== 'all' ||
      sortBy !== 'newest'
    );
  }, [activeDetailedFilterCount, debouncedSearch, kpiFilter, sortBy]);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      const now = Date.now();
      if (isRefresh) {
        setRefreshing(true);
      } else if (!cachedSellerParticipations) {
        setLoading(true);
      }
      setError('');
      
      // If we have cached data and it's fresh, use it immediately
      if (!isRefresh && cachedSellerParticipations && (now - lastSellerFetchTime < CACHE_TTL_MS)) {
        setParticipations(cachedSellerParticipations);
        setLoading(false);
        return;
      }

      const [bidsData, mrData] = await Promise.allSettled([
        procurementBidApi.getSellerBids(),
        procurementBidApi.getSellerMarketplaceResponses()
      ]);
      
      const bids = bidsData.status === 'fulfilled' ? bidsData.value : [];
      const normalizedBids = (Array.isArray(bids) ? bids : []).map((b: any) => ({
        ...b,
        status: b.status ?? b.submissionStatus ?? 'DRAFT'
      }));
      const rawMarketplace = mrData.status === 'fulfilled' ? mrData.value : [];
      const marketplaceResponses = Array.isArray(rawMarketplace)
        ? rawMarketplace
        : (rawMarketplace && typeof rawMarketplace === 'object' && 'responses' in rawMarketplace && Array.isArray((rawMarketplace as any).responses))
          ? (rawMarketplace as any).responses
          : [];
      
      const normalizedMarketplace = marketplaceResponses.map((res: any) => ({
        id: `mr-${res.id}`,
        bidId: `req-${res.requirementId}`,
        status: String(res.status || 'SUBMITTED').toUpperCase(),
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
        quotedAmount: res.offeredPrice,
        isMarketplaceResponse: true,
        requirementId: res.requirementId,
        bid: {
          id: `req-${res.requirementId}`,
          title: res.requirement?.title || res.requirement?.description || 'Quotation Response',
          itemName: res.requirement?.title || 'Quotation Response',
          buyerName: res.requirement?.buyerOrganization?.organizationName || 'Verified Buyer',
          category: res.requirement?.category?.name || 'RFQ Response',
          endDate: res.requirement?.lastDate,
          estimatedValue: res.requirement?.budgetMax || res.requirement?.budgetMin,
          status: res.requirement?.status || 'OPEN',
          lifecycleStage: 'EVALUATION'
        }
      }));
      
      const merged = [...normalizedBids, ...normalizedMarketplace];
      cachedSellerParticipations = merged;
      lastSellerFetchTime = Date.now();
      setParticipations(merged);
    } catch (err: any) {
      console.error('[Seller Bids]', err);
      setError(err?.message || 'Unable to load your bids.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Page Header Text based on Route
  const headerContent = useMemo(() => {
    switch (subRouteType) {
      case 'submitted':
        return {
          title: 'My Submitted Bids',
          desc: 'Monitor status, clarifications, and evaluation stages of all bids you have submitted.'
        };
      case 'draft':
        return {
          title: 'Draft Bids',
          desc: 'Resume and complete your unfinished bid participations before the closing dates.'
        };
      case 'awarded':
        return {
          title: 'Awarded Contracts',
          desc: 'Review procurement opportunities and tenders awarded to your organization.'
        };
      default:
        return {
          title: 'All Bid Participations',
          desc: 'Overview of all your drafted, submitted, and awarded bid activities.'
        };
    }
  }, [subRouteType]);

  // Calculate Metrics/KPIs dynamically based on sub-route
  const kpiData = useMemo(() => {
    const all = participations;
    const submitted = all.filter(isSubmitted);
    const drafts = all.filter(isDraft);
    const awarded = all.filter(isAwarded);

    const activeSubmitted = submitted.filter(p => !isAwarded(p));
    const activeQuotedValue = activeSubmitted.reduce((sum, p) => sum + (Number(p.quotedAmount) || Number(p.bid?.estimatedValue) || 0), 0);
    const totalPipelineValue = all.reduce((sum, p) => sum + (Number(p.quotedAmount) || Number(p.bid?.estimatedValue) || 0), 0);

    const underTech = submitted.filter(p => p.bid?.lifecycleStage === 'TECHNICAL_EVALUATION' || p.bid?.status === 'TECHNICAL_EVALUATION').length;
    const underFin = submitted.filter(p => p.bid?.lifecycleStage === 'FINANCIAL_EVALUATION' || p.bid?.status === 'FINANCIAL_EVALUATION').length;
    const totalAwardedValue = awarded.reduce((sum, p) => sum + (Number(p.quotedAmount) || Number(p.bid?.estimatedValue) || 0), 0);
    const draftsTotalValue = drafts.reduce((sum, p) => sum + (Number(p.bid?.estimatedValue) || 0), 0);

    const draftsDueSoon = drafts.filter(p => {
      if (!p.bid?.endDate) return false;
      const diff = (new Date(p.bid.endDate).getTime() - Date.now()) / 86400000;
      return diff >= 0 && diff <= 7;
    }).length;

    const draftsReady = drafts.filter(p => {
      const s = statusOf(p);
      return s === 'TECHNICAL_DOCUMENTS_UPLOADED' || s === 'FINANCIAL_QUOTE_UPLOADED';
    }).length;

    const earlyDrafts = drafts.filter(p => {
      const s = statusOf(p);
      return s !== 'TECHNICAL_DOCUMENTS_UPLOADED' && s !== 'FINANCIAL_QUOTE_UPLOADED';
    }).length;

    const pendingInvoiceCount = awarded.filter(p => !p.invoiceId && !p.hasInvoice).length;
    const invoicedCount = awarded.filter(p => Boolean(p.invoiceId || p.hasInvoice)).length;

    // Win rate calculations based on decided bids
    const decidedBids = all.filter(p =>
      isAwarded(p) ||
      ['REJECTED', 'DISQUALIFIED', 'LOST', 'WITHDRAWN', 'CLOSED'].includes(statusOf(p)) ||
      p.bid?.status === 'AWARDED' ||
      p.bid?.status === 'CLOSED'
    );
    const decidedCount = decidedBids.length;
    const winRate = decidedCount > 0
      ? `${((awarded.length / decidedCount) * 100).toFixed(1)}%`
      : (awarded.length > 0 ? '100%' : '0.0%');

    return {
      totalAll: all.length,
      totalSubmitted: submitted.length,
      activeSubmittedCount: activeSubmitted.length,
      activeQuotedValue,
      totalPipelineValue,
      totalDrafts: drafts.length,
      totalAwarded: awarded.length,
      underTech,
      underFin,
      totalAwardedValue,
      draftsTotalValue,
      draftsDueSoon,
      draftsReady,
      earlyDrafts,
      pendingInvoiceCount,
      invoicedCount,
      winRate,
      decidedCount
    };
  }, [participations]);

  // Extract dynamic list of unique buyer organizations
  const buyerOptions = useMemo(() => {
    const set = new Set<string>();
    participations.forEach(p => {
      const bName = p.bid?.buyerName;
      if (bName && bName !== 'Private Buyer') set.add(bName);
    });
    return Array.from(set).sort();
  }, [participations]);

  // Filter and Sort participations
  const filteredItems = useMemo(() => {
    let list = participations;

    // Filter by route category
    if (subRouteType === 'submitted') {
      list = list.filter(isSubmitted);
    } else if (subRouteType === 'draft') {
      list = list.filter(isDraft);
    } else if (subRouteType === 'awarded') {
      list = list.filter(isAwarded);
    }

    // Apply KPI filter
    if (kpiFilter !== 'all') {
      if (kpiFilter === 'submitted') {
        list = list.filter(isSubmitted);
      } else if (kpiFilter === 'active_pipeline') {
        list = list.filter(p => isSubmitted(p) && !isAwarded(p));
      } else if (kpiFilter === 'technical_financial') {
        list = list.filter(p =>
          p.bid?.lifecycleStage === 'TECHNICAL_EVALUATION' ||
          p.bid?.lifecycleStage === 'FINANCIAL_EVALUATION' ||
          p.bid?.status === 'TECHNICAL_EVALUATION' ||
          p.bid?.status === 'FINANCIAL_EVALUATION'
        );
      } else if (kpiFilter === 'technical') {
        list = list.filter(p => p.bid?.lifecycleStage === 'TECHNICAL_EVALUATION' || p.bid?.status === 'TECHNICAL_EVALUATION');
      } else if (kpiFilter === 'financial') {
        list = list.filter(p => p.bid?.lifecycleStage === 'FINANCIAL_EVALUATION' || p.bid?.status === 'FINANCIAL_EVALUATION');
      } else if (kpiFilter === 'awarded') {
        list = list.filter(isAwarded);
      } else if (kpiFilter === 'draft') {
        list = list.filter(isDraft);
      } else if (kpiFilter === 'dueSoon') {
        list = list.filter(p => {
          if (!p.bid?.endDate) return false;
          const diff = (new Date(p.bid.endDate).getTime() - Date.now()) / 86400000;
          return diff >= 0 && diff <= 7;
        });
      } else if (kpiFilter === 'ready') {
        list = list.filter(p => {
          const s = statusOf(p);
          return s === 'TECHNICAL_DOCUMENTS_UPLOADED' || s === 'FINANCIAL_QUOTE_UPLOADED';
        });
      } else if (kpiFilter === 'early') {
        list = list.filter(p => {
          const s = statusOf(p);
          return isDraft(p) && s !== 'TECHNICAL_DOCUMENTS_UPLOADED' && s !== 'FINANCIAL_QUOTE_UPLOADED';
        });
      } else if (kpiFilter === 'pendingInvoice') {
        list = list.filter(p => isAwarded(p) && !p.invoiceId && !p.hasInvoice);
      } else if (kpiFilter === 'invoiced') {
        list = list.filter(p => isAwarded(p) && Boolean(p.invoiceId || p.hasInvoice));
      }
    }

    // Filter by Opportunity / Sourcing Type
    if (typeFilter) {
      list = list.filter(item => getParticipationType(item) === typeFilter);
    }

    // Filter by Submission Status
    if (statusFilter) {
      list = list.filter(item => {
        const s = String(item.status || '').toUpperCase();
        if (statusFilter === 'AWARDED') return isAwarded(item) || s === 'ACCEPTED' || s === 'AWARDED';
        if (statusFilter === 'SUBMITTED') return isSubmitted(item);
        if (statusFilter === 'DRAFT') return isDraft(item);
        return s === statusFilter;
      });
    }

    // Filter by Bid Lifecycle Stage
    if (stageFilter) {
      list = list.filter(item => {
        const s = String(item.bid?.status || '').toUpperCase();
        const ls = String(item.bid?.lifecycleStage || '').toUpperCase();
        if (stageFilter === 'OPEN') return s === 'OPEN' || s === 'PUBLISHED';
        if (stageFilter === 'TECHNICAL_EVALUATION') return s === 'TECHNICAL_EVALUATION' || ls === 'TECHNICAL_EVALUATION';
        if (stageFilter === 'FINANCIAL_EVALUATION') return s === 'FINANCIAL_EVALUATION' || ls === 'FINANCIAL_EVALUATION';
        if (stageFilter === 'AWARDED') return s === 'AWARDED' || isAwarded(item);
        if (stageFilter === 'PO_GENERATED') return s === 'PO_GENERATED';
        if (stageFilter === 'CLOSED') return s === 'CLOSED';
        return s === stageFilter || ls === stageFilter;
      });
    }

    // Filter by Buyer Organization
    if (buyerFilter) {
      list = list.filter(item => (item.bid?.buyerName || 'Private Buyer') === buyerFilter);
    }

    // Filter by Closing Date
    if (dateFilter) {
      const now = Date.now();
      list = list.filter(item => {
        if (!item.bid?.endDate) return false;
        const diff = (new Date(item.bid.endDate).getTime() - now) / 86400000;
        if (dateFilter === '7') return diff >= 0 && diff <= 7;
        if (dateFilter === '15') return diff >= 0 && diff <= 15;
        if (dateFilter === '30') return diff >= 0 && diff <= 30;
        if (dateFilter === 'closed') return diff < 0;
        return true;
      });
    }

    // Filter by Value Range
    if (valueFilter) {
      list = list.filter(item => {
        const val = Number(item.quotedAmount) || Number(item.bid?.estimatedValue) || 0;
        if (valueFilter === '5l') return val < 500000;
        if (valueFilter === '25l') return val >= 500000 && val < 2500000;
        if (valueFilter === '1cr') return val >= 2500000 && val < 10000000;
        if (valueFilter === 'above1cr') return val >= 10000000;
        return true;
      });
    }

    // Filter by search query
    const text = debouncedSearch.toLowerCase().trim();
    if (text) {
      list = list.filter(p => {
        const bid = p.bid || {};
        const displayId = formatBidDisplayId(p).toLowerCase();
        const rawId = String(bid.id || p.bidId || p.requirementId || '').toLowerCase();
        const title = String(bid.title || bid.itemName || '').toLowerCase();
        const buyer = String(bid.buyerName || '').toLowerCase();
        const cat = String(bid.category || '').toLowerCase();
        const st = String(p.status || '').toLowerCase();
        const bst = String(bid.status || '').toLowerCase();
        const ptype = getParticipationType(p).toLowerCase();

        return (
          displayId.includes(text) ||
          rawId.includes(text) ||
          title.includes(text) ||
          buyer.includes(text) ||
          cat.includes(text) ||
          st.includes(text) ||
          bst.includes(text) ||
          ptype.includes(text)
        );
      });
    }

    // Sort
    list = [...list].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      const valA = Number(a.quotedAmount) || Number(a.bid?.estimatedValue) || 0;
      const valB = Number(b.quotedAmount) || Number(b.bid?.estimatedValue) || 0;

      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'closing_soon') {
        const closeA = a.bid?.endDate ? new Date(a.bid.endDate).getTime() : Infinity;
        const closeB = b.bid?.endDate ? new Date(b.bid.endDate).getTime() : Infinity;
        return closeA - closeB;
      }
      if (sortBy === 'value_high') return valB - valA;
      if (sortBy === 'value_low') return valA - valB;
      if (sortBy === 'title_asc') return (a.bid?.title || '').localeCompare(b.bid?.title || '');
      if (sortBy === 'title_desc') return (b.bid?.title || '').localeCompare(a.bid?.title || '');
      if (sortBy === 'id_asc') return Number(a.bid?.id || a.bidId || 0) - Number(b.bid?.id || b.bidId || 0);
      if (sortBy === 'id_desc') return Number(b.bid?.id || b.bidId || 0) - Number(a.bid?.id || a.bidId || 0);
      if (sortBy === 'buyer_asc') return String(a.bid?.buyerName || '').localeCompare(String(b.bid?.buyerName || ''));
      if (sortBy === 'buyer_desc') return String(b.bid?.buyerName || '').localeCompare(String(a.bid?.buyerName || ''));
      if (sortBy === 'budget_high') return Number(b.bid?.estimatedValue || 0) - Number(a.bid?.estimatedValue || 0);
      if (sortBy === 'budget_low') return Number(a.bid?.estimatedValue || 0) - Number(b.bid?.estimatedValue || 0);
      if (sortBy === 'closing_asc') return new Date(a.bid?.endDate || 0).getTime() - new Date(b.bid?.endDate || 0).getTime();
      if (sortBy === 'closing_desc') return new Date(b.bid?.endDate || 0).getTime() - new Date(a.bid?.endDate || 0).getTime();
      if (sortBy === 'part_asc') return String(a.status || '').localeCompare(String(b.status || ''));
      if (sortBy === 'part_desc') return String(b.status || '').localeCompare(String(a.status || ''));
      if (sortBy === 'stage_asc') return String(a.bid?.status || '').localeCompare(String(b.bid?.status || ''));
      if (sortBy === 'stage_desc') return String(b.bid?.status || '').localeCompare(String(a.bid?.status || ''));
      return 0;
    });

    return list;
  }, [participations, subRouteType, kpiFilter, typeFilter, statusFilter, stageFilter, buyerFilter, dateFilter, valueFilter, debouncedSearch, sortBy]);

  const { page, pageSize, pageItems: pagedItems, total, setPage, setPageSize } = usePagination(filteredItems, 10);

  const toggleSort = (key: string) => {
    if (key === 'value') setSortBy(sortBy === 'value_low' ? 'value_high' : 'value_low');
    else if (key === 'title') setSortBy(sortBy === 'title_asc' ? 'title_desc' : 'title_asc');
    else if (key === 'id') setSortBy(sortBy === 'id_asc' ? 'id_desc' : 'id_asc');
    else if (key === 'buyer') setSortBy(sortBy === 'buyer_asc' ? 'buyer_desc' : 'buyer_asc');
    else if (key === 'budget') setSortBy(sortBy === 'budget_low' ? 'budget_high' : 'budget_low');
    else if (key === 'closing') setSortBy(sortBy === 'closing_asc' ? 'closing_desc' : 'closing_asc');
    else if (key === 'part') setSortBy(sortBy === 'part_asc' ? 'part_desc' : 'part_asc');
    else if (key === 'stage') setSortBy(sortBy === 'stage_asc' ? 'stage_desc' : 'stage_asc');
    else if (key === 'updated') setSortBy(sortBy === 'updated_asc' ? 'updated_desc' : 'updated_asc');
  };

  const SortHeader = ({ label, columnKey, className = '' }: { label: string; columnKey: string; className?: string }) => {
    let isActive = false;
    let isAsc = true;
    if (columnKey === 'value') { isActive = sortBy === 'value_low' || sortBy === 'value_high'; isAsc = sortBy === 'value_low'; }
    else if (columnKey === 'title') { isActive = sortBy === 'title_asc' || sortBy === 'title_desc'; isAsc = sortBy === 'title_asc'; }
    else if (columnKey === 'id') { isActive = sortBy === 'id_asc' || sortBy === 'id_desc'; isAsc = sortBy === 'id_asc'; }
    else if (columnKey === 'buyer') { isActive = sortBy === 'buyer_asc' || sortBy === 'buyer_desc'; isAsc = sortBy === 'buyer_asc'; }
    else if (columnKey === 'budget') { isActive = sortBy === 'budget_low' || sortBy === 'budget_high'; isAsc = sortBy === 'budget_low'; }
    else if (columnKey === 'closing') { isActive = sortBy === 'closing_asc' || sortBy === 'closing_desc'; isAsc = sortBy === 'closing_asc'; }
    else if (columnKey === 'part') { isActive = sortBy === 'part_asc' || sortBy === 'part_desc'; isAsc = sortBy === 'part_asc'; }
    else if (columnKey === 'stage') { isActive = sortBy === 'stage_asc' || sortBy === 'stage_desc'; isAsc = sortBy === 'stage_asc'; }
    else if (columnKey === 'updated') { isActive = sortBy === 'updated_asc' || sortBy === 'updated_desc'; isAsc = sortBy === 'updated_asc'; }
    return (
      <button type="button" onClick={() => toggleSort(columnKey)} className={cn("inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#12335f] transition-colors", isActive && "text-[#12335f]", className)}>
        {label}
        {isActive ? (isAsc ? <ArrowUp className="h-3 w-3 text-[#12335f]" /> : <ArrowDown className="h-3 w-3 text-[#12335f]" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    );
  };

  const participationStatusColor = (status: string) => {
    const s = String(status).toUpperCase();
    if (s === 'SUBMITTED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (s === 'ACCEPTED' || s === 'AWARDED') return 'border-emerald-300 bg-emerald-100/80 text-emerald-800';
    if (s === 'DRAFT') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (s === 'REJECTED' || s === 'DISQUALIFIED' || s === 'LOST') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (s === 'WITHDRAWN') return 'border-red-200 bg-red-50 text-red-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  };

  const bidStatusColor = (status: string) => {
    const s = String(status).toUpperCase();
    if (s === 'OPEN' || s === 'LIVE' || s === 'PUBLISHED') return 'bg-blue-100 text-blue-800';
    if (s === 'TECHNICAL_EVALUATION' || s === 'FINANCIAL_EVALUATION' || s === 'EVALUATION') return 'bg-purple-100 text-purple-800';
    if (s === 'AWARDED') return 'bg-emerald-100 text-emerald-800';
    if (s === 'PO_GENERATED' || s === 'PO GENERATED') return 'bg-indigo-100 text-indigo-800';
    if (s === 'CLOSED' || s === 'EXPIRED') return 'bg-slate-100 text-slate-700';
    return 'bg-slate-100 text-slate-700';
  };

  const getActualRfqId = (item: any): string => {
    const candidate = item.bid?.requirementNumber || item.bid?.refId || item.bid?.bidNumber || item.bid?.bidNo || item.requirementNumber || item.refId;
    if (candidate && String(candidate).trim()) {
      return String(candidate).trim();
    }
    if (item.requirementId != null && item.requirementId !== '') {
      const rawReq = String(item.requirementId).trim();
      if (/^(REQ|RFQ|RFP|BID|LT|RA|RC)-/i.test(rawReq)) return rawReq.toUpperCase();
      if (/^req[-_]?(\d+)$/i.test(rawReq)) return `REQ-${rawReq.replace(/^req[-_]?/i, '')}`;
      return `REQ-${rawReq}`;
    }
    const raw = String(item?.bid?.id || item?.bidId || item?.id || '').trim();
    if (/^(REQ|RFQ|RFP|BID|LT|RA|RC)-/i.test(raw)) {
      return raw.toUpperCase();
    }
    if (/^req[-_]?(\d+)$/i.test(raw)) {
      return `REQ-${raw.replace(/^req[-_]?/i, '')}`;
    }
    if (/^\d+$/.test(raw)) {
      return `REQ-${raw}`;
    }
    return formatBidDisplayId(item);
  };

  const handleAction = (item: any) => {
    const rfqId = getActualRfqId(item);
    router.push(`/seller/procurement/rfq/${encodeURIComponent(rfqId)}/respond`);
  };

  const handleConvertToInvoice = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const bidId = item.bid?.id || item.bidId;
    if (!bidId) return;
    
    setConvertingInvoiceId(item.id);
    try {
      const result = await api.post(`/api/seller/procurement-bids/${bidId}/convert-to-invoice`, {});
      toast.success('Invoice generated successfully!');
      
      const createdInvoiceId = (result as any)?.data?.id || (result as any)?.id;
      
      if (createdInvoiceId) {
        router.push(`/seller/invoices/${createdInvoiceId}`);
      } else {
        router.push('/seller/invoices');
      }
    } catch (err: any) {
      console.error('[Convert Invoice Error]', err);
      toast.error(err?.message || 'Failed to convert to invoice.');
    } finally {
      setConvertingInvoiceId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Transparent Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{headerContent.title}</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">{headerContent.desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadData(true)} className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm">
            <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", refreshing && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* Dynamic KPI Metrics based on tab */}
      {subRouteType === 'submitted' && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Active Quoted Pipeline"
            value={formatCurrency(kpiData.activeQuotedValue)}
            subtext={`${kpiData.activeSubmittedCount} bids currently under review`}
            icon={IndianRupee}
            active={kpiFilter === 'active_pipeline'}
            tone="blue"
            onClick={() => { setKpiFilter(kpiFilter === 'active_pipeline' ? 'all' : 'active_pipeline'); setPage(1); }}
          />
          <KpiCard
            label="Bid Win Rate"
            value={kpiData.winRate}
            subtext={`${kpiData.totalAwarded} won of ${kpiData.decidedCount || kpiData.totalSubmitted} evaluated`}
            icon={Trophy}
            active={kpiFilter === 'awarded'}
            tone="green"
            onClick={() => { setKpiFilter(kpiFilter === 'awarded' ? 'all' : 'awarded'); setPage(1); }}
          />
          <KpiCard
            label="Under Evaluation"
            value={kpiData.underTech + kpiData.underFin}
            subtext={`${kpiData.underTech} Technical • ${kpiData.underFin} Financial`}
            icon={Scale}
            active={kpiFilter === 'technical_financial'}
            tone="purple"
            onClick={() => { setKpiFilter(kpiFilter === 'technical_financial' ? 'all' : 'technical_financial'); setPage(1); }}
          />
          <KpiCard
            label="Submitted Bids"
            value={kpiData.totalSubmitted}
            subtext="Responses delivered to buyers"
            icon={FileText}
            active={kpiFilter === 'submitted'}
            tone="indigo"
            onClick={() => { setKpiFilter(kpiFilter === 'submitted' ? 'all' : 'submitted'); setPage(1); }}
          />
        </div>
      )}

      {subRouteType === 'draft' && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Draft Pipeline Exposure"
            value={formatCurrency(kpiData.draftsTotalValue)}
            subtext={`Across ${kpiData.totalDrafts} in-progress opportunities`}
            icon={IndianRupee}
            active={kpiFilter === 'draft'}
            tone="blue"
            onClick={() => { setKpiFilter(kpiFilter === 'draft' ? 'all' : 'draft'); setPage(1); }}
          />
          <KpiCard
            label="Closing in ≤7 Days"
            value={kpiData.draftsDueSoon}
            subtext="Imminent submission deadline"
            icon={Clock}
            active={kpiFilter === 'dueSoon'}
            tone="red"
            onClick={() => { setKpiFilter(kpiFilter === 'dueSoon' ? 'all' : 'dueSoon'); setPage(1); }}
          />
          <KpiCard
            label="Docs / Quote Staged"
            value={kpiData.draftsReady}
            subtext="Tech & commercial docs uploaded"
            icon={CheckCircle2}
            active={kpiFilter === 'ready'}
            tone="green"
            onClick={() => { setKpiFilter(kpiFilter === 'ready' ? 'all' : 'ready'); setPage(1); }}
          />
          <KpiCard
            label="Early Setup Stage"
            value={kpiData.earlyDrafts}
            subtext="Forms awaiting initial uploads"
            icon={FileEdit}
            active={kpiFilter === 'early'}
            tone="amber"
            onClick={() => { setKpiFilter(kpiFilter === 'early' ? 'all' : 'early'); setPage(1); }}
          />
        </div>
      )}

      {subRouteType === 'awarded' && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Won Order Book"
            value={formatCurrency(kpiData.totalAwardedValue)}
            subtext="Cumulative volume won"
            icon={IndianRupee}
            active={kpiFilter === 'all'}
            tone="green"
            onClick={() => { setKpiFilter('all'); setPage(1); }}
          />
          <KpiCard
            label="Awarded Contracts"
            value={kpiData.totalAwarded}
            subtext="Finalized binding agreements"
            icon={Trophy}
            active={kpiFilter === 'awarded'}
            tone="indigo"
            onClick={() => { setKpiFilter(kpiFilter === 'awarded' ? 'all' : 'awarded'); setPage(1); }}
          />
          <KpiCard
            label="Pending Invoicing"
            value={kpiData.pendingInvoiceCount}
            subtext="Ready for invoice generation"
            icon={Receipt}
            active={kpiFilter === 'pendingInvoice'}
            tone="amber"
            onClick={() => { setKpiFilter(kpiFilter === 'pendingInvoice' ? 'all' : 'pendingInvoice'); setPage(1); }}
          />
          <KpiCard
            label="Billing Initiated"
            value={kpiData.invoicedCount}
            subtext="Invoices submitted for payment"
            icon={CheckCircle2}
            active={kpiFilter === 'invoiced'}
            tone="blue"
            onClick={() => { setKpiFilter(kpiFilter === 'invoiced' ? 'all' : 'invoiced'); setPage(1); }}
          />
        </div>
      )}

      {(subRouteType === 'all' || !['submitted', 'draft', 'awarded'].includes(subRouteType)) && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Quoted Exposure"
            value={formatCurrency(kpiData.totalPipelineValue)}
            subtext="Active + secured contract pipeline"
            icon={IndianRupee}
            active={kpiFilter === 'all'}
            tone="blue"
            onClick={() => { setKpiFilter('all'); setPage(1); }}
          />
          <KpiCard
            label="Bid Win Rate"
            value={kpiData.winRate}
            subtext={`${kpiData.totalAwarded} won of ${kpiData.decidedCount || kpiData.totalAll} evaluated`}
            icon={Trophy}
            active={kpiFilter === 'awarded'}
            tone="green"
            onClick={() => { setKpiFilter(kpiFilter === 'awarded' ? 'all' : 'awarded'); setPage(1); }}
          />
          <KpiCard
            label="In Active Evaluation"
            value={kpiData.underTech + kpiData.underFin}
            subtext={`${kpiData.underTech} Technical • ${kpiData.underFin} Financial`}
            icon={Scale}
            active={kpiFilter === 'technical_financial'}
            tone="purple"
            onClick={() => { setKpiFilter(kpiFilter === 'technical_financial' ? 'all' : 'technical_financial'); setPage(1); }}
          />
          <KpiCard
            label="Urgent Drafts (≤7d)"
            value={kpiData.draftsDueSoon}
            subtext={`${kpiData.totalDrafts} total in-progress forms`}
            icon={Clock}
            active={kpiFilter === 'dueSoon'}
            tone="amber"
            onClick={() => { setKpiFilter(kpiFilter === 'dueSoon' ? 'all' : 'dueSoon'); setPage(1); }}
          />
        </div>
      )}

      {/* ── Bid Category Navigation Pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mt-1 scrollbar-none" role="tablist" aria-label="Bid Categories">
        {[
          { label: 'All Bids', key: 'all', href: '/seller/bids', count: kpiData.totalAll, icon: ClipboardList },
          { label: 'Submitted Bids', key: 'submitted', href: '/seller/bids/submitted', count: kpiData.totalSubmitted, icon: CheckCircle2 },
          { label: 'Draft Bids', key: 'draft', href: '/seller/bids/draft', count: kpiData.totalDrafts, icon: FileEdit },
          { label: 'Awarded Contracts', key: 'awarded', href: '/seller/bids/awarded', count: kpiData.totalAwarded, icon: Trophy },
        ].map(tab => {
          const isActive = subRouteType === tab.key;
          const Icon = tab.icon;

          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                router.push(tab.href);
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer",
                isActive
                  ? "bg-[#12335f] text-white border-[#12335f] shadow-sm shadow-[#12335f]/20 ring-2 ring-[#12335f]/15"
                  : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-[#c8a45c]" : "text-slate-400")} />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-[18px] text-center transition-colors",
                  isActive
                    ? "bg-white/20 text-white"
                    : tab.count > 0 ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-400"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 sm:gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <Button variant="outline" onClick={() => loadData()} className="ml-auto h-8 text-[10px] font-black uppercase">Retry</Button>
        </div>
      )}

      {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-sm space-y-3">
        {/* Tier 1: Search Input & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Spacious Search Bar */}
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="bid-search-input"
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search by ID (e.g. RFQ-039, BID-025), title, buyer, category..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs"
              aria-label="Search bids by ID, title, buyer or category"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Clear search input"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Actions & Filters Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sort Select */}
            <div className="min-w-[140px]">
              <select
                id="bid-sort-select"
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setPage(1); }}
                aria-label="Sort bid participations"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-2xs cursor-pointer"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="closing_soon">Closing: Soonest</option>
                <option value="value_high">Quote: High to Low</option>
                <option value="value_low">Quote: Low to High</option>
                <option value="title_asc">Title: A to Z</option>
              </select>
            </div>

            {/* Advanced Filters Button */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              aria-controls="advanced-filters-panel"
              aria-label="Toggle filter options"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-all shadow-2xs cursor-pointer",
                showFilters || activeDetailedFilterCount > 0
                  ? "border-[#12335f] bg-[#12335f]/5 text-[#12335f] hover:bg-[#12335f]/10"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              <Filter className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" />
              <span>Filters</span>
              {activeDetailedFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#12335f] text-white text-[10px] font-black">
                  {activeDetailedFilterCount}
                </span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 text-slate-500", showFilters && "rotate-180")} aria-hidden="true" />
            </button>

            {/* View Mode Toggle */}
            <div className="border-l border-slate-200 pl-2">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
        </div>

        {/* Tier 2: Collapsible Secondary Filter Tray */}
        {showFilters && (
          <div
            id="advanced-filters-panel"
            role="region"
            aria-label="Filter Options"
            className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:p-4 transition-all duration-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">Filter By Specific Criteria</span>
              </div>
              {activeDetailedFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('');
                    setStatusFilter('');
                    setStageFilter('');
                    setBuyerFilter('');
                    setDateFilter('');
                    setValueFilter('');
                    setPage(1);
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Reset Filter Options
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {/* Sourcing Type */}
              <div>
                <label htmlFor="filter-sourcing-type" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Sourcing Type
                </label>
                <select
                  id="filter-sourcing-type"
                  value={typeFilter}
                  onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs cursor-pointer truncate"
                >
                  <option value="">All Types</option>
                  <option value="RFQ">RFQ (Quotations)</option>
                  <option value="Open Tender">Open Tenders</option>
                  <option value="RFP">RFP (Proposals)</option>
                  <option value="Limited Tender">Limited Tenders</option>
                  <option value="Reverse Auction">Reverse Auctions</option>
                  <option value="Rate Contract">Rate Contracts</option>
                </select>
              </div>

              {/* Submission Status */}
              <div>
                <label htmlFor="filter-submission-status" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Submission Status
                </label>
                <select
                  id="filter-submission-status"
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs cursor-pointer truncate"
                >
                  <option value="">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="DRAFT">Draft</option>
                  <option value="AWARDED">Awarded / Accepted</option>
                  <option value="REJECTED">Rejected / Lost</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                </select>
              </div>

              {/* Bid Stage */}
              <div>
                <label htmlFor="filter-bid-stage" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Bid Stage
                </label>
                <select
                  id="filter-bid-stage"
                  value={stageFilter}
                  onChange={e => { setStageFilter(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs cursor-pointer truncate"
                >
                  <option value="">All Bid Stages</option>
                  <option value="OPEN">Open / Live</option>
                  <option value="TECHNICAL_EVALUATION">Technical Eval</option>
                  <option value="FINANCIAL_EVALUATION">Financial Eval</option>
                  <option value="AWARDED">Awarded</option>
                  <option value="PO_GENERATED">PO Generated</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* Buyer Organization */}
              <div>
                <label htmlFor="filter-buyer" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Buyer
                </label>
                <select
                  id="filter-buyer"
                  value={buyerFilter}
                  onChange={e => { setBuyerFilter(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs cursor-pointer truncate"
                >
                  <option value="">All Buyers</option>
                  {buyerOptions.map(buyer => (
                    <option key={buyer} value={buyer}>{buyer}</option>
                  ))}
                </select>
              </div>

              {/* Closing Deadline */}
              <div>
                <label htmlFor="filter-closing-date" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Closing Deadline
                </label>
                <select
                  id="filter-closing-date"
                  value={dateFilter}
                  onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs cursor-pointer truncate"
                >
                  <option value="">All Deadlines</option>
                  <option value="7">≤ 7 Days</option>
                  <option value="15">≤ 15 Days</option>
                  <option value="30">≤ 30 Days</option>
                  <option value="closed">Closed / Expired</option>
                </select>
              </div>

              {/* Budget Range */}
              <div>
                <label htmlFor="filter-budget" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Budget
                </label>
                <select
                  id="filter-budget"
                  value={valueFilter}
                  onChange={e => { setValueFilter(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 shadow-2xs cursor-pointer truncate"
                >
                  <option value="">All Budgets</option>
                  <option value="5l">&lt; ₹5 Lakhs</option>
                  <option value="25l">₹5L – ₹25 Lakhs</option>
                  <option value="1cr">₹25L – ₹1 Crore</option>
                  <option value="above1cr">&gt; ₹1 Crore</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tier 3: Active Filters & Results Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          {/* Result Count Indicator */}
          <div className="text-[11px] font-bold text-slate-500" aria-live="polite">
            Showing <span className="font-extrabold text-slate-800">{filteredItems.length}</span> of <span className="font-extrabold text-slate-800">{participations.length}</span> bid participations
          </div>

          {/* Active Filter Chips */}
          {hasAnyActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {searchTerm && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#12335f]/10 border border-[#12335f]/20 px-2 py-0.5 text-[11px] font-bold text-[#12335f]">
                  Search: "{searchTerm}"
                  <button type="button" onClick={() => { setSearchTerm(''); setPage(1); }} className="hover:text-rose-600 cursor-pointer ml-0.5" aria-label="Remove search filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {typeFilter && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                  Type: {typeFilter}
                  <button type="button" onClick={() => { setTypeFilter(''); setPage(1); }} className="hover:text-rose-600 cursor-pointer ml-0.5" aria-label="Remove sourcing type filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {statusFilter && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  Status: {statusFilter}
                  <button type="button" onClick={() => { setStatusFilter(''); setPage(1); }} className="hover:text-rose-600 cursor-pointer ml-0.5" aria-label="Remove status filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {stageFilter && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                  Stage: {stageFilter.replace(/_/g, ' ')}
                  <button type="button" onClick={() => { setStageFilter(''); setPage(1); }} className="hover:text-rose-600 cursor-pointer ml-0.5" aria-label="Remove stage filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {buyerFilter && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  Buyer: {buyerFilter}
                  <button type="button" onClick={() => { setBuyerFilter(''); setPage(1); }} className="hover:text-rose-600 cursor-pointer ml-0.5" aria-label="Remove buyer filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {dateFilter && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                  Deadline: {getDateFilterLabel(dateFilter)}
                  <button type="button" onClick={() => { setDateFilter(''); setPage(1); }} className="hover:text-rose-600 cursor-pointer ml-0.5" aria-label="Remove deadline filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {valueFilter && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  Budget: {getValueFilterLabel(valueFilter)}
                  <button type="button" onClick={() => { setValueFilter(''); setPage(1); }} className="hover:text-rose-600 cursor-pointer ml-0.5" aria-label="Remove budget filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {kpiFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[11px] font-bold text-cyan-800">
                  KPI: {getKpiFilterLabel(kpiFilter)}
                  <button type="button" onClick={() => { setKpiFilter('all'); setPage(1); }} className="hover:text-rose-600 cursor-pointer ml-0.5" aria-label="Remove KPI filter">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] font-extrabold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content representation */}
      {filteredItems.length === 0 ? (
        <EmptyState
          title={`No ${headerContent.title} Found`}
          description={searchTerm || typeFilter || statusFilter || stageFilter || buyerFilter || dateFilter || valueFilter
            ? 'No entries match your filter criteria.'
            : `You don't have any entries under ${headerContent.title.toLowerCase()} right now.`}
        />
      ) : (
        <div className="space-y-4">
          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pagedItems.map((item, index) => {
                const bid = item.bid || {};
                const rowIndex = (page - 1) * pageSize + index + 1;
                const displayId = formatBidDisplayId(item);
                const pType = getParticipationType(item);

                return (
                  <div key={item.id} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#12335f]/40 hover:shadow-md flex flex-col justify-between">
                    <div className="w-full space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[9px] font-black text-slate-500">
                              {String(rowIndex).padStart(2, '0')}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-black tracking-wide bg-slate-100 text-slate-800 border border-slate-200/80">
                              {displayId}
                            </span>
                            <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#12335f]/10 text-[#12335f]">
                              {pType}
                            </span>
                          </div>
                          <h3 className="mt-2 text-sm font-black text-slate-900 group-hover:text-[#12335f] transition-colors line-clamp-2 leading-snug">{bid.title || 'Untitled Bid Sourcing'}</h3>
                        </div>
                        <span className={cn('inline-flex rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide whitespace-nowrap', participationStatusColor(item.status))}>
                          {item.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-3">
                        <InfoTile label="Buyer Organization" value={bid.buyerName || 'Private Buyer'} />
                        <InfoTile label="Your Quote" value={item.quotedAmount ? formatCurrency(item.quotedAmount) : 'Pending'} />
                        <InfoTile label="Category" value={bid.category || 'General'} />
                        <InfoTile label="Est. Budget" value={formatCurrency(bid.estimatedValue)} />
                        <InfoTile label="Submitted On" value={formatDate(item.createdAt)} />
                        <InfoTile label="Closing Date" value={formatDate(bid.endDate)} />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 items-center justify-between">
                        <span className={cn('inline-block rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wide', bidStatusColor(bid.status || 'OPEN'))}>
                          Bid: {String(bid.status || 'OPEN').replace(/_/g, ' ')}
                        </span>

                        <div className="flex gap-2">
                          {isAwarded(item) && (
                            <Button 
                              onClick={(e) => handleConvertToInvoice(e, item)} 
                              disabled={convertingInvoiceId === item.id}
                              className="h-8 bg-emerald-600 text-[10px] font-black uppercase text-white hover:bg-emerald-700 rounded-lg px-4 flex items-center gap-1.5 shadow-sm"
                            >
                              {convertingInvoiceId === item.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                              Convert to Invoice
                            </Button>
                          )}
                          <Button onClick={() => handleAction(item)} className="h-8 bg-[#12335f] text-[10px] font-black uppercase text-white hover:bg-[#0b2445] rounded-lg px-4">
                            {isDraft(item) ? 'Resume Draft' : 'View Details'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 hover:bg-transparent">
                      <th className="p-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-16">Sr. No</th>
                      <th className="p-3 w-28"><SortHeader label="Bid ID" columnKey="id" /></th>
                      <th className="p-3"><SortHeader label="Title & Details" columnKey="title" /></th>
                      <th className="p-3"><SortHeader label="Buyer" columnKey="buyer" /></th>
                      <th className="p-3"><SortHeader label="Your Quote" columnKey="value" /></th>
                      <th className="p-3 w-32"><SortHeader label="Est. Budget" columnKey="budget" /></th>
                      <th className="p-3 w-32"><SortHeader label="Closing Date" columnKey="closing" /></th>
                      <th className="p-3 w-32"><SortHeader label="Participation" columnKey="part" /></th>
                      <th className="p-3 w-32"><SortHeader label="Bid Stage" columnKey="stage" /></th>
                      <th className="p-3 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {pagedItems.map((item, index) => {
                      const bid = item.bid || {};
                      const rowIndex = (page - 1) * pageSize + index + 1;
                      const displayId = formatBidDisplayId(item);
                      const pType = getParticipationType(item);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition cursor-pointer" onClick={() => handleAction(item)}>
                          <td className="p-3 font-mono text-xs text-slate-500">
                            {String(rowIndex).padStart(2, '0')}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-black tracking-wide bg-slate-100 text-slate-800 border border-slate-200/80">
                              {displayId}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 line-clamp-1 max-w-[220px]">{bid.title || 'Untitled Bid'}</p>
                              <span className="inline-block rounded px-1.5 py-0.2 text-[9px] font-bold uppercase bg-[#12335f]/10 text-[#12335f] shrink-0">
                                {pType}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">{bid.category}</p>
                          </td>
                          <td className="p-3 text-slate-700">{bid.buyerName || 'Private Buyer'}</td>
                          <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{item.quotedAmount ? formatCurrency(item.quotedAmount) : 'Pending'}</td>
                          <td className="p-3 font-bold text-slate-700 whitespace-nowrap">{formatCurrency(bid.estimatedValue)}</td>
                          <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(bid.endDate)}</td>
                          <td className="p-3">
                            <span className={cn('inline-flex rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide whitespace-nowrap', participationStatusColor(item.status))}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={cn('inline-block rounded px-2 py-0.5 text-[9px] font-black uppercase whitespace-nowrap', bidStatusColor(bid.status || 'OPEN'))}>
                              {String(bid.status || 'OPEN').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              {isAwarded(item) && (
                                <Button 
                                  onClick={(e) => handleConvertToInvoice(e, item)}
                                  disabled={convertingInvoiceId === item.id}
                                  className="h-8 bg-emerald-600 text-[10px] font-black uppercase text-white hover:bg-emerald-700 rounded-lg px-3 flex items-center gap-1.5 shadow-sm"
                                  title="Convert to Invoice"
                                >
                                  {convertingInvoiceId === item.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <FileText className="h-3 w-3" />
                                  )}
                                  Invoice
                                </Button>
                              )}
                              <Button onClick={() => handleAction(item)} className="h-8 bg-[#12335f] text-[10px] font-black uppercase text-white hover:bg-[#0b2445] rounded-lg px-3">
                                {isDraft(item) ? 'Resume' : 'View'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ PAGINATION ═══ */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="bids"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-slate-800">{value || '-'}</p>
    </div>
  );
}
