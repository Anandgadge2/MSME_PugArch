'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  FileText,
  Clock,
  Gavel,
  Users,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  IndianRupee,
  AlertTriangle,
  XCircle,
  Tag,
  Layers,
  Building2,
  ShoppingCart,
  TrendingUp,
  Package,
  MapPin,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../hooks/useAuth';
import { api } from '../../../lib/api';
import { procurementBidApi } from '../../procurementBid/api';
import { marketplaceApi } from '../../marketplace/api';
import { formatDate } from '../../shared/format';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { EmptyState } from '../../shared/FeatureStates';

import { getApi } from '../../shared/apiClient';

const formatCurrency = (value: number | string | null | undefined) => {
  const num = Number(value || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const TYPE_FILTERS = [
  { key: '', label: 'All Types' },
  { key: 'RFQ', label: 'RFQ' },
  { key: 'RFP', label: 'RFP' },
  { key: 'Reverse Auction', label: 'Reverse Auction' },
  { key: 'Cart Checkout', label: 'Cart Checkout' },
  { key: 'OpenTender', label: 'OpenTender' },
  { key: 'Rate Contract', label: 'Rate Contract' },
  { key: 'Limited Tender', label: 'Limited Tender' },
  { key: 'Repeat order', label: 'Repeat order' },
];

const getConsolidatedType = (b: any): string => {
  const status = String(b.status || '').toLowerCase();
  const approvalStatus = String(b.approvalStatus || '').toLowerCase();
  const title = String(b.title || '').toLowerCase();
  
  // Try checking bidType, procurementType, method, type
  const pt = String(b.procurementType || '').toLowerCase();
  const bt = String(b.bidType || '').toLowerCase();
  const rawType = String(b.type || '').toLowerCase();
  const rawMethod = String(b.method || '').toLowerCase();

  // 1. Draft
  if (status === 'draft' || approvalStatus === 'draft' || title.includes('draft')) {
    return 'Draft';
  }
  // 2. RFQ
  if (pt.includes('rfq') || pt.includes('efq') || bt.includes('rfq') || bt.includes('efq') || rawType.includes('rfq') || rawType.includes('efq') || rawMethod.includes('rfq') || rawMethod.includes('efq')) {
    return 'RFQ';
  }
  // 3. RFP
  if (pt.includes('rfp') || pt.includes('rfi') || bt.includes('rfp') || bt.includes('rfi') || rawType.includes('rfp') || rawType.includes('rfi') || rawMethod.includes('rfp') || rawMethod.includes('rfi')) {
    return 'RFP';
  }
  // 4. Reverse Auction
  if (pt.includes('auction') || bt.includes('auction') || rawType.includes('auction') || rawMethod.includes('auction')) {
    return 'Reverse Auction';
  }
  // 5. Cart Checkout
  if (pt.includes('cart') || pt.includes('checkout') || bt.includes('cart') || bt.includes('checkout') || rawType.includes('cart') || rawType.includes('checkout')) {
    return 'Cart Checkout';
  }
  // 6. Limited Tender (Checked BEFORE OpenTender)
  if (pt.includes('limited') || bt.includes('limited') || rawType.includes('limited') || rawMethod.includes('limited')) {
    return 'Limited Tender';
  }
  // 7. OpenTender
  if (pt.includes('open') || pt.includes('tender') || bt.includes('open') || bt.includes('tender') || rawType.includes('open') || rawType.includes('tender')) {
    return 'OpenTender';
  }
  // 8. Rate Contract
  if (pt.includes('rate') || bt.includes('rate') || rawType.includes('rate') || rawMethod.includes('rate')) {
    return 'Rate Contract';
  }
  // 9. Repeat order
  if (pt.includes('repeat') || bt.includes('repeat') || rawType.includes('repeat') || rawMethod.includes('repeat')) {
    return 'Repeat order';
  }

  return 'RFQ';
};

const TYPE_BADGE_STYLES: Record<string, string> = {
  'RFQ': 'border-blue-200 bg-blue-50 text-blue-800',
  'RFP': 'border-indigo-200 bg-indigo-50 text-indigo-800',
  'Reverse Auction': 'border-indigo-200 bg-indigo-50 text-indigo-800',
  'Cart Checkout': 'border-violet-200 bg-violet-50 text-violet-800',
  'OpenTender': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Open Tender': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Draft': 'border-slate-200 bg-slate-50 text-slate-700',
  'Rate Contract': 'border-teal-200 bg-teal-50 text-teal-800',
  'Limited Tender': 'border-amber-200 bg-amber-50 text-amber-800',
  'LimitedTender': 'border-amber-200 bg-amber-50 text-amber-800',
  'Repeat order': 'border-pink-200 bg-pink-50 text-pink-850 text-pink-800',
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'RFQ': return Tag;
    case 'RFP': return Layers;
    case 'Reverse Auction': return TrendingUp;
    case 'Cart Checkout': return ShoppingCart;
    case 'OpenTender':
    case 'Open Tender': return Building2;
    case 'Draft': return FileText;
    case 'Rate Contract': return ShieldCheck;
    case 'Limited Tender':
    case 'LimitedTender': return Users;
    case 'Repeat order': return RefreshCw;
    default: return Package;
  }
};

const STATUS_FILTERS = [
  { key: '', label: 'All Statuses' },
  { key: 'Open', label: 'Open' },
  { key: 'Under Evaluation', label: 'Under Evaluation' },
  { key: 'Awarded', label: 'Awarded' },
  { key: 'Closed', label: 'Closed' },
];

const RESPONSE_COUNT_FILTERS = [
  { key: '', label: 'All Responses' },
  { key: 'has_responses', label: 'With Responses (> 0)' },
  { key: 'no_responses', label: 'No Responses (0)' },
  { key: 'multiple', label: '2+ Responses' },
  { key: 'high', label: '3+ Responses' },
  { key: 'five_plus', label: '5+ Responses' },
];

const VALUE_FILTERS = [
  { key: '', label: 'All Values' },
  { key: 'under_1l', label: 'Under ₹1 Lakh' },
  { key: '1l_10l', label: '₹1 Lakh - ₹10 Lakhs' },
  { key: '10l_50l', label: '₹10 Lakhs - ₹50 Lakhs' },
  { key: '50l_1cr', label: '₹50 Lakhs - ₹1 Crore' },
  { key: 'above_1cr', label: 'Above ₹1 Crore' },
];

const CLOSING_FILTERS = [
  { key: '', label: 'All Closing Dates' },
  { key: '24h', label: 'Closing in 24h' },
  { key: '3d', label: 'Closing in 3 Days' },
  { key: '7d', label: 'Closing in 7 Days' },
  { key: '30d', label: 'Closing in 30 Days' },
  { key: 'expired', label: 'Expired / Closed' },
];

type SortKey = 'index' | 'type' | 'title' | 'status' | 'estimatedValue' | 'responses' | 'closingDate' | 'startDate';
type SortDir = 'asc' | 'desc';

const CACHE_KEY = 'buyer_supplier_responses_cached_bids_v1';

const getCachedResponsesData = (): any[] | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((b: any) => {
        const status = String(b.status || '').toLowerCase();
        const approvalStatus = String(b.approvalStatus || '').toLowerCase();
        const title = String(b.title || '').toLowerCase();
        return status !== 'draft' && !status.startsWith('draft') && approvalStatus !== 'draft' && getConsolidatedType(b) !== 'Draft' && !title.startsWith('draft');
      });
    }
  } catch {
    // ignore
  }
  return undefined;
};

const setCachedResponsesData = (data: any[]) => {
  if (typeof window === 'undefined' || !data || !Array.isArray(data)) return;
  try {
    const str = JSON.stringify(data);
    sessionStorage.setItem(CACHE_KEY, str);
    localStorage.setItem(CACHE_KEY, str);
  } catch {
    // ignore
  }
};

export default function SupplierResponsesPage() {
  const { user } = useAuth();

  // Filters
  type StatusTab = 'All' | 'Open' | 'Under Evaluation' | 'Awarded' | 'Closed';
  const [activeTab, setActiveTab] = useState<StatusTab>('All');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [responseFilter, setResponseFilter] = useState('');
  const [valueFilter, setValueFilter] = useState('');
  const [closingFilter, setClosingFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('startDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useResponsiveViewMode('supplier-responses:view-mode');

  // Debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchBids = async () => {
    const [bids, myProcResult, marketplaceResult, buyerReqResult] = await Promise.all([
      procurementBidApi.getBuyerBids({}, false).catch(() => []),
      getApi<any>('/api/buyer/my-procurements', false).catch(() => null),
      getApi<any>('/api/marketplace/requirements', false).catch(() => null),
      getApi<any>('/api/buyer/requirements', false).catch(() => null),
    ]);

    const combined: any[] = [...(bids || [])];
    const existingRefNumbers = new Set<string>();
    const titleToItemMap = new Map<string, any>();

    const recordRef = (refVal?: any) => {
      if (!refVal) return;
      const str = String(refVal).trim().toUpperCase();
      if (str && str !== 'UNDEFINED' && str !== 'NULL') {
        existingRefNumbers.add(str);
      }
    };

    for (const b of combined) {
      recordRef(b.id);
      recordRef(b.bidNumber);
      recordRef(b.referenceNumber);
      recordRef(b.sourceId);
      recordRef(b.requirementId);
      recordRef(b.payload?.requirementId);
      recordRef(b.payload?.sourceId);
      recordRef(b.technicalPacket?.requirementId);

      const titleKey = String(b.title || '').trim().toLowerCase();
      if (titleKey) {
        titleToItemMap.set(titleKey, b);
      }
    }

    const myProcurements: any[] = myProcResult?.procurements || [];
    for (const p of myProcurements) {
      const rcConfigSection = (p.detailSections || []).find((s: any) => s.title === 'Rate Contract Config' || s.title === 'Rate Contract');
      const reqNumField = rcConfigSection?.fields?.find((f: any) => f.label === 'requirementNumber' || f.label === 'Requirement Number')?.value;

      const pRefs = [
        p.referenceNumber,
        p.id,
        p.bidNumber,
        p.sourceId,
        reqNumField
      ].filter(Boolean).map(x => String(x).trim().toUpperCase());

      const titleKey = String(p.title || '').trim().toLowerCase();
      const isDuplicate = pRefs.some(ref => existingRefNumbers.has(ref)) || (titleKey && titleToItemMap.has(titleKey));

      if (!isDuplicate) {
        pRefs.forEach(ref => existingRefNumbers.add(ref));
        const newItem = {
          id: p.referenceNumber || String(p.id),
          buyerId: user?.id,
          sourceModel: p.type?.toUpperCase() || 'RATE_CONTRACT',
          sourceId: p.id,
          title: p.title || `Procurement ${p.referenceNumber}`,
          itemName: p.items?.[0]?.itemName || p.title || 'Rate Contract',
          buyerName: p.organizationName || 'Buyer Organization',
          buyerType: 'Private Enterprise',
          departmentName: 'Procurement',
          bidType: p.typeLabel || p.methodLabel || 'Rate Contract',
          procurementType: p.methodLabel || p.typeLabel || 'Rate Contract',
          category: p.category || 'Rate Contract',
          location: p.deliveryLocation || 'Location not specified',
          deliveryLocation: p.deliveryLocation || 'Delivery location not specified',
          quantity: p.quantity ? `${p.quantity} ${p.unit || ''}`.trim() : 'Not specified',
          estimatedValue: Number(p.estimatedValue || 0),
          startDate: String(p.startDate || p.createdAt || new Date().toISOString()).slice(0, 10),
          endDate: String(p.endDate || p.createdAt || new Date().toISOString()).slice(0, 10),
          status: p.statusGroup === 'active' ? 'Open' : p.statusGroup === 'completed' ? 'Awarded' : p.statusGroup === 'cancelled' ? 'Closed' : (p.statusLabel || 'Open'),
          participantsCount: Number(p.participantsCount || 0),
          participations: [],
          type: p.type,
          method: p.method,
          detailSections: p.detailSections
        };
        combined.push(newItem);
        if (titleKey) titleToItemMap.set(titleKey, newItem);
      }
    }

    const allRequirements = [
      ...(Array.isArray(marketplaceResult) ? marketplaceResult : (marketplaceResult?.requirements || marketplaceResult?.items || [])),
      ...(Array.isArray(buyerReqResult) ? buyerReqResult : (buyerReqResult?.requirements || buyerReqResult?.items || [])),
    ];

    for (const req of allRequirements) {
      if (!req) continue;
      const reqIdStr = String(req.id || req.requirementNumber || '').trim().toUpperCase();
      const reqNumStr = req.requirementNumber ? String(req.requirementNumber).trim().toUpperCase() : '';
      const titleKey = String(req.title || '').trim().toLowerCase();

      const isDuplicate = (reqIdStr && existingRefNumbers.has(reqIdStr)) ||
                          (reqNumStr && existingRefNumbers.has(reqNumStr)) ||
                          (titleKey && titleToItemMap.has(titleKey));

      if (isDuplicate) {
        if (titleKey && titleToItemMap.has(titleKey)) {
          const existing = titleToItemMap.get(titleKey);
          const reqCount = Number(req.responsesCount || req.participantsCount || req.myResponsesCount || req.responses?.length || 0);
          if (reqCount > (existing.participantsCount || 0)) {
            existing.participantsCount = reqCount;
            if (req.responses && req.responses.length) existing.participations = req.responses;
          }
        }
        continue;
      }

      if (reqIdStr) existingRefNumbers.add(reqIdStr);
      if (reqNumStr) existingRefNumbers.add(reqNumStr);

      const itemsList = req.items || req.payload?.items || req.payload?.boqTable || [];
      const firstItem = itemsList[0] || {};
      const itemName = firstItem.itemName || firstItem.name || firstItem.description || req.title || 'Requirement Item';
      const quantityStr = firstItem.quantity ? `${firstItem.quantity} ${firstItem.unitOfMeasure || firstItem.unit || ''}`.trim() : (req.quantity ? `${req.quantity} ${req.unit || ''}`.trim() : 'Not specified');

      const newItem = {
        id: req.requirementNumber || String(req.id),
        requirementId: req.id,
        isMarketplaceRequirement: true,
        buyerId: user?.id,
        sourceModel: 'REQUIREMENT',
        sourceId: req.id,
        title: req.title || `Requirement ${req.requirementNumber || req.id}`,
        itemName,
        buyerName: req.buyerOrganization?.organizationName || req.buyerName || user?.organization?.organizationName || 'Buyer Organization',
        buyerType: 'Private Enterprise',
        departmentName: req.department || 'Procurement',
        bidType: req.procurementType || req.type || 'RFQ',
        procurementType: req.procurementType || req.type || 'RFQ',
        category: req.category || 'General',
        location: req.deliveryLocation || 'Location not specified',
        deliveryLocation: req.deliveryLocation || 'Delivery location not specified',
        quantity: quantityStr,
        estimatedValue: Number(req.estimatedValue || req.budgetMax || 0),
        startDate: String(req.createdAt || req.publishDate || new Date().toISOString()).slice(0, 10),
        endDate: String(req.lastDate || req.closingDate || req.deadlineDate || new Date().toISOString()).slice(0, 10),
        status: req.status === 'OPEN' || req.status === 'PUBLISHED' ? 'Open' : req.status === 'AWARDED' ? 'Awarded' : req.status === 'CANCELLED' || req.status === 'EXPIRED' ? 'Closed' : (req.status || 'Open'),
        participantsCount: Number(req.responsesCount || req.participantsCount || req.myResponsesCount || req.responses?.length || 0),
        participations: req.responses || [],
        type: req.procurementType || req.type || 'RFQ',
        method: req.procurementMethod || req.method || 'RFQ',
        payload: req.payload
      };

      combined.push(newItem);
      if (titleKey) titleToItemMap.set(titleKey, newItem);
    }

    const filtered = combined.filter((b: any) => {
      const status = String(b.status || '').toLowerCase();
      const approvalStatus = String(b.approvalStatus || '').toLowerCase();
      const workflowStatus = String(b.workflowStatus || '').toLowerCase();
      const title = String(b.title || '').toLowerCase();
      const consolidatedType = getConsolidatedType(b);

      // Strictly exclude any procurement that is marked as DRAFT
      if (
        status === 'draft' ||
        status.startsWith('draft') ||
        approvalStatus === 'draft' ||
        workflowStatus === 'draft' ||
        consolidatedType === 'Draft' ||
        title.startsWith('draft') ||
        title.endsWith(' draft') ||
        title === 'draft'
      ) {
        return false;
      }

      return true;
    });

    if (filtered.length > 0) {
      setCachedResponsesData(filtered);
    }
    return filtered;
  };

  const { data: bids = [], isLoading: loading, isError, error: queryError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['supplier-responses', user?.id],
    queryFn: fetchBids,
    staleTime: 5_000,
    enabled: !!user?.id,
  });

  const error = isError ? (queryError as any)?.message || 'Unable to load supplier responses.' : '';
  const refreshing = isFetching && !loading;

  const handleViewResponses = (bid: any) => {
    if (bid.isMarketplaceRequirement) {
      const method = String(bid.procurementType || '').toUpperCase();
      if (method === 'REVERSE_AUCTION' || method.includes('AUCTION')) {
        window.location.href = `/reverse-auctions/${bid.requirementId}`;
      } else {
        window.location.href = `/marketplace/requirements/${bid.requirementId}`;
      }
    } else {
      window.location.href = `/bids/${bid.id}`;
    }
  };

  // Categories extracted from data
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    bids.forEach(b => {
      if (b.category && typeof b.category === 'string' && b.category.trim()) {
        set.add(b.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [bids]);

  // KPI metrics
  const kpis = useMemo(() => {
    const total = bids.length;
    const open = bids.filter(b => b.status === 'Open').length;
    const underEval = bids.filter(b => b.status === 'Under Evaluation').length;
    const awarded = bids.filter(b => b.status === 'Awarded').length;
    const closed = bids.filter(b => b.status === 'Closed').length;
    const totalParticipants = bids.reduce((s, b) => s + (b.participantsCount || b.participations?.length || b.responsesCount || 0), 0);
    const totalValue = bids.reduce((s, b) => s + (b.estimatedValue || 0), 0);
    return { total, open, underEval, awarded, closed, totalParticipants, totalValue };
  }, [bids]);

  // Handle Header Sort Click
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'estimatedValue' || key === 'responses' || key === 'closingDate' ? 'desc' : 'asc');
    }
  };

  // Sync Tab and Status filter
  const handleTabClick = (tab: StatusTab) => {
    setActiveTab(tab);
    if (tab === 'All') {
      setStatusFilter('');
    } else {
      setStatusFilter(tab);
    }
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    if (!status || status === 'All') {
      setActiveTab('All');
    } else if (['Open', 'Under Evaluation', 'Awarded', 'Closed'].includes(status)) {
      setActiveTab(status as StatusTab);
    } else {
      setActiveTab('All');
    }
  };

  // Filtered & sorted bids
  const filteredBids = useMemo(() => {
    const text = debouncedSearch.toLowerCase();
    const now = new Date().getTime();

    let items = bids.filter(bid => {
      // Tab / Status filter
      if (activeTab !== 'All' && bid.status !== activeTab) return false;
      if (statusFilter && statusFilter !== 'All' && bid.status !== statusFilter) return false;

      // Type filter
      if (typeFilter && getConsolidatedType(bid) !== typeFilter) return false;

      // Category filter
      if (categoryFilter && bid.category !== categoryFilter) return false;

      // Response count filter
      const respCount = Number(bid.participantsCount || bid.participations?.length || bid.responsesCount || 0);
      if (responseFilter === 'has_responses' && respCount <= 0) return false;
      if (responseFilter === 'no_responses' && respCount > 0) return false;
      if (responseFilter === 'multiple' && respCount < 2) return false;
      if (responseFilter === 'high' && respCount < 3) return false;
      if (responseFilter === 'five_plus' && respCount < 5) return false;

      // Value filter
      const val = Number(bid.estimatedValue || 0);
      if (valueFilter === 'under_1l' && val >= 100000) return false;
      if (valueFilter === '1l_10l' && (val < 100000 || val >= 1000000)) return false;
      if (valueFilter === '10l_50l' && (val < 1000000 || val >= 5000000)) return false;
      if (valueFilter === '50l_1cr' && (val < 5000000 || val >= 10000000)) return false;
      if (valueFilter === 'above_1cr' && val < 10000000) return false;

      // Closing filter
      if (closingFilter && bid.endDate) {
        const endMs = new Date(bid.endDate).getTime();
        const diffHours = (endMs - now) / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        if (closingFilter === '24h' && (diffHours < 0 || diffHours > 24)) return false;
        if (closingFilter === '3d' && (diffDays < 0 || diffDays > 3)) return false;
        if (closingFilter === '7d' && (diffDays < 0 || diffDays > 7)) return false;
        if (closingFilter === '30d' && (diffDays < 0 || diffDays > 30)) return false;
        if (closingFilter === 'expired' && diffHours >= 0) return false;
      }

      // Search
      if (text) {
        const typeStr = getConsolidatedType(bid);
        const haystack = [
          bid.id,
          bid.bidNumber,
          bid.referenceNumber,
          bid.title,
          bid.itemName,
          bid.buyerName,
          bid.category,
          bid.location,
          typeStr,
          bid.status
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(text)) return false;
      }

      return true;
    });

    // Dynamic Multi-Column Sort
    items.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;

      switch (sortKey) {
        case 'type': {
          const typeA = getConsolidatedType(a);
          const typeB = getConsolidatedType(b);
          return typeA.localeCompare(typeB) * dir;
        }
        case 'title': {
          const titleA = String(a.title || '').toLowerCase();
          const titleB = String(b.title || '').toLowerCase();
          return titleA.localeCompare(titleB) * dir;
        }
        case 'status': {
          const statusA = String(a.status || '').toLowerCase();
          const statusB = String(b.status || '').toLowerCase();
          return statusA.localeCompare(statusB) * dir;
        }
        case 'estimatedValue': {
          const valA = Number(a.estimatedValue || 0);
          const valB = Number(b.estimatedValue || 0);
          return (valA - valB) * dir;
        }
        case 'responses': {
          const countA = Number(a.participantsCount || a.participations?.length || a.responsesCount || 0);
          const countB = Number(b.participantsCount || b.participations?.length || b.responsesCount || 0);
          return (countA - countB) * dir;
        }
        case 'closingDate': {
          const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
          const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
          return (dateA - dateB) * dir;
        }
        case 'startDate': {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return (dateA - dateB) * dir;
        }
        case 'index':
        default: {
          const dateA = a.startDate || a.createdAt ? new Date(a.startDate || a.createdAt).getTime() : 0;
          const dateB = b.startDate || b.createdAt ? new Date(b.startDate || b.createdAt).getTime() : 0;
          return (dateA - dateB) * dir;
        }
      }
    });

    return items;
  }, [bids, activeTab, statusFilter, typeFilter, categoryFilter, responseFilter, valueFilter, closingFilter, debouncedSearch, sortKey, sortDir]);

  const { page, pageSize, pageItems: pagedBids, total, setPage, setPageSize } = usePagination(filteredBids, 10);

  const hasActiveFilters = !!(typeFilter || statusFilter || responseFilter || valueFilter || closingFilter || categoryFilter || searchTerm || activeTab !== 'All');

  const handleResetFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setResponseFilter('');
    setValueFilter('');
    setClosingFilter('');
    setCategoryFilter('');
    setSearchTerm('');
    setActiveTab('All');
    setSortKey('startDate');
    setSortDir('desc');
  };

  const statusColor = (status: string) => {
    if (status === 'Open') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (status === 'Under Evaluation') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (status === 'Awarded') return 'border-green-200 bg-green-50 text-green-700';
    if (status === 'Closed') return 'border-slate-200 bg-slate-50 text-slate-600';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  };

  const stageColor = (stage: string) => {
    if (stage === 'Technical Evaluation') return 'bg-amber-100 text-amber-800';
    if (stage === 'Financial Evaluation') return 'bg-indigo-100 text-indigo-800';
    if (stage === 'Qualified') return 'bg-emerald-100 text-emerald-800';
    if (stage === 'Awarded') return 'bg-green-100 text-green-800';
    return 'bg-slate-100 text-slate-600';
  };

  // Helper for rendering interactive sortable column header
  const renderSortableHeader = (label: string, key: SortKey, align: 'left' | 'center' | 'right' = 'left', className = '') => {
    const isSorted = sortKey === key;
    return (
      <th
        className={cn(
          "px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider select-none transition-colors cursor-pointer group",
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
          isSorted ? 'text-blue-700 bg-blue-50/50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50',
          className
        )}
        onClick={() => handleSort(key)}
        title={`Sort by ${label} (${isSorted ? (sortDir === 'asc' ? 'Ascending' : 'Descending') : 'Click to sort'})`}
      >
        <div className={cn("inline-flex items-center gap-1.5", align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start')}>
          <span>{label}</span>
          {isSorted ? (
            sortDir === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 text-slate-300 opacity-60 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  };

  const isKpisLoading = loading && bids.length === 0;

  return (
    <div className="mx-auto max-w-[1560px] space-y-5 px-4 pb-12">
      {/* ── Transparent Header ── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#12335f]">Procurement Control</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Supplier Responses</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">Track bids, quotes, and proposals received from suppliers across your procurements.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { api.invalidate('/api/buyer/procurement-bids'); api.invalidate('/api/marketplace/requirements'); refetch(); }} className="h-10 rounded-lg text-xs font-black uppercase shadow-sm bg-white hover:bg-slate-50 border-slate-200">
              <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", refreshing && "animate-spin")} />Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard
          label="Total Procurements"
          value={kpis.total}
          loading={isKpisLoading}
          subtext="All published items"
          icon={FileText}
          tone="blue"
          active={activeTab === 'All' && !statusFilter}
          onClick={() => handleTabClick('All')}
        />
        <KpiCard
          label="Open"
          value={kpis.open}
          loading={isKpisLoading}
          subtext="Accepting responses"
          icon={Clock}
          tone="cyan"
          active={activeTab === 'Open'}
          onClick={() => handleTabClick('Open')}
        />
        <KpiCard
          label="Under Evaluation"
          value={kpis.underEval}
          loading={isKpisLoading}
          subtext="Review in progress"
          icon={Gavel}
          tone="amber"
          active={activeTab === 'Under Evaluation'}
          onClick={() => handleTabClick('Under Evaluation')}
        />
        <KpiCard
          label="Awarded"
          value={kpis.awarded}
          loading={isKpisLoading}
          subtext="Vendor finalized"
          icon={CheckCircle2}
          tone="green"
          active={activeTab === 'Awarded'}
          onClick={() => handleTabClick('Awarded')}
        />
        <KpiCard
          label="Total Responses"
          value={kpis.totalParticipants}
          loading={isKpisLoading}
          subtext="Bids & quotes submitted"
          icon={Users}
          tone="purple"
          active={activeTab === 'All' && responseFilter === 'has_responses'}
          onClick={() => {
            setActiveTab('All');
            setResponseFilter(prev => prev === 'has_responses' ? '' : 'has_responses');
          }}
        />
        <KpiCard
          label="Total Value"
          value={formatCurrency(kpis.totalValue)}
          loading={isKpisLoading}
          subtext="Combined estimate"
          icon={IndianRupee}
          tone="indigo"
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-55/10 p-4 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
          <span>{error}</span>
          <Button variant="outline" onClick={() => refetch()} className="ml-auto h-8 text-[10px] font-black uppercase rounded-lg border-red-200 hover:bg-red-50">Retry</Button>
        </div>
      )}

      {/* ── Advanced Filter Bar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by title, ref no, category, or location..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
            />
          </div>

          {/* Filters Collection */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Type Select */}
            <div className="w-36">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] transition-colors shadow-xs cursor-pointer"
              >
                {TYPE_FILTERS.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div className="w-36">
              <select
                value={statusFilter}
                onChange={e => handleStatusFilterChange(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] transition-colors shadow-xs cursor-pointer"
              >
                {STATUS_FILTERS.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Responses Filter */}
            <div className="w-36">
              <select
                value={responseFilter}
                onChange={e => setResponseFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] transition-colors shadow-xs cursor-pointer"
              >
                {RESPONSE_COUNT_FILTERS.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Value Select */}
            <div className="w-36">
              <select
                value={valueFilter}
                onChange={e => setValueFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] transition-colors shadow-xs cursor-pointer"
              >
                {VALUE_FILTERS.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Closing Date Select */}
            <div className="w-36">
              <select
                value={closingFilter}
                onChange={e => setClosingFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] transition-colors shadow-xs cursor-pointer"
              >
                {CLOSING_FILTERS.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Select (if multiple categories available) */}
            {availableCategories.length > 0 && (
              <div className="w-40">
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] transition-colors shadow-xs cursor-pointer truncate"
                >
                  <option value="">All Categories</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-10 px-3 rounded-xl border border-rose-200 bg-rose-50 text-xs font-extrabold text-rose-700 hover:bg-rose-100 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                Reset Filters
              </button>
            )}

            <div className="ml-auto pl-2">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && bids.length === 0 ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="h-4 w-12 animate-pulse rounded bg-slate-100" />
                <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-1.5 min-w-[200px]">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredBids.length === 0 ? (
        <EmptyState
          title="No Supplier Responses Found"
          description={hasActiveFilters
            ? 'No procurements match the current filters. Try resetting the filters.'
            : 'Your published procurements will appear here once suppliers start responding.'}
        />
      ) : (
        <div className="space-y-4">
          {/* ═══ LIST VIEW ═══ */}
          {viewMode === 'list' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
              <table className="w-full min-w-[950px] border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="bg-slate-100/70 rounded-xl overflow-hidden">
                    {renderSortableHeader('Sr. No.', 'index', 'center', 'w-16 rounded-l-xl')}
                    {renderSortableHeader('Type', 'type', 'left', 'w-32')}
                    {renderSortableHeader('Title & Reference', 'title', 'left', 'w-96')}
                    {renderSortableHeader('Status', 'status', 'left', 'w-36')}
                    {renderSortableHeader('Est. Value', 'estimatedValue', 'left', 'w-36')}
                    {renderSortableHeader('Responses', 'responses', 'left', 'w-40')}
                    {renderSortableHeader('Closing Date', 'closingDate', 'left', 'w-36')}
                    <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-500 w-28 rounded-r-xl">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBids.map((bid, idx) => {
                    const typeVal = getConsolidatedType(bid);
                    const TypeIcon = getTypeIcon(typeVal);
                    return (
                      <tr
                        key={bid.id}
                        className="group bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-slate-50/80 align-middle cursor-pointer"
                        onClick={() => handleViewResponses(bid)}
                      >
                        {/* Serial Number */}
                        <td className="rounded-l-xl px-4 py-4 text-xs font-black text-slate-400 text-center">
                          {String((page - 1) * pageSize + idx + 1).padStart(2, '0')}
                        </td>

                        {/* Type Badge */}
                        <td className="px-4 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border transition-transform group-hover:scale-105",
                            TYPE_BADGE_STYLES[typeVal] || 'border-slate-200 bg-slate-50 text-slate-700'
                          )}>
                            <TypeIcon className="h-3.5 w-3.5 shrink-0" />
                            {typeVal}
                          </span>
                        </td>

                        {/* Title & Reference */}
                        <td className="px-4 py-4 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {bid.referenceNumber && (
                              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {bid.referenceNumber}
                              </span>
                            )}
                            {bid.location && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {bid.location}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {bid.title}
                          </p>
                          {bid.category && (
                            <p className="text-[10px] font-semibold text-slate-400 line-clamp-1">
                              Category: {bid.category}
                            </p>
                          )}
                        </td>

                        {/* Status / Stage */}
                        <td className="px-4 py-4 space-y-1">
                          <span className={cn('inline-flex whitespace-nowrap rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border', statusColor(bid.status))}>
                            {bid.status}
                          </span>
                          {bid.currentStage && bid.currentStage !== 'Pending' && (
                            <span className={cn('block text-[8px] font-bold uppercase text-slate-400 mt-1', stageColor(bid.currentStage))}>
                              {bid.currentStage}
                            </span>
                          )}
                        </td>

                        {/* Est Value */}
                        <td className="px-4 py-4">
                          <span className="text-xs font-extrabold text-slate-900 block">
                            {formatCurrency(bid.estimatedValue)}
                          </span>
                        </td>

                        {/* Responses */}
                        <td className="px-4 py-4">
                          {(() => {
                            const count = bid.participantsCount || bid.participations?.length || bid.responsesCount || 0;
                            return (
                              <span className={cn(
                                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-black border transition-colors',
                                count > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'
                              )}>
                                <Users className="h-3.5 w-3.5 shrink-0" />
                                {count} {count === 1 ? 'response' : 'responses'}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Closing Date */}
                        <td className="px-4 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                          {formatDate(bid.endDate)}
                        </td>

                        {/* Actions */}
                        <td className="rounded-r-xl px-4 py-4 text-right">
                          <Button
                            onClick={(e) => { e.stopPropagation(); handleViewResponses(bid); }}
                            className="inline-flex h-8 min-w-[80px] items-center justify-center rounded-lg bg-blue-600 px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all duration-200 border-none cursor-pointer"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ GRID VIEW ═══ */}
          {viewMode === 'grid' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pagedBids.map(bid => {
                const typeVal = getConsolidatedType(bid);
                return (
                  <div
                    key={bid.id}
                    onClick={() => handleViewResponses(bid)}
                    className={cn(
                      "rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border-slate-200/80 hover:border-slate-350 flex flex-col justify-between min-h-[220px] cursor-pointer"
                    )}
                  >
                    <div className="space-y-3">
                      {/* Top row: Badges */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border whitespace-nowrap",
                          TYPE_BADGE_STYLES[typeVal] || 'border-slate-200 bg-slate-50 text-slate-700'
                        )}>
                          {typeVal}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                        {bid.title}
                      </h3>

                      {/* Category & Location */}
                      <div className="text-[11px] text-slate-500 font-bold space-y-1">
                        {bid.category && <p className="line-clamp-1">Category: {bid.category}</p>}
                        {bid.location && (
                          <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {bid.location}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 mt-4 space-y-3">
                      {/* Status & Responses */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Status</p>
                          <div className="mt-1">
                            <span className={cn('inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border', statusColor(bid.status))}>
                              {bid.status}
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Est. Value</p>
                          <div className="mt-1">
                            <span className="text-xs font-extrabold text-slate-900 block">
                              {formatCurrency(bid.estimatedValue)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Responses</p>
                          <span className="text-xs font-extrabold text-slate-800 block mt-0.5">
                            {bid.participantsCount || bid.participations?.length || bid.responsesCount || 0}
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Closing</p>
                          <span className="text-xs font-bold text-slate-600 block mt-0.5">
                            {formatDate(bid.endDate)}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleViewResponses(bid); }}
                          className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-blue-600 px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all duration-200 border-none cursor-pointer"
                        >
                          View Responses
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
              label="procurements"
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
    <div className="rounded-md border border-slate-250 bg-slate-50 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-slate-800">{value || '-'}</p>
    </div>
  );
}
