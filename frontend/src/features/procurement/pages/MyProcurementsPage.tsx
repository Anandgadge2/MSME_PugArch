'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  Gavel,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Share2,
  ShoppingCart,
  TrendingUp,
  X,
  XCircle,
  ClipboardCheck,
  ClipboardList,
  AlertTriangle,
  CalendarDays,
  IndianRupee,
  Tag,
  Hash,
  Info,
  Layers,
  Building2,
  ExternalLink,
  Paperclip,
  Download,
  ShieldCheck,
  Globe,
  Users,
  Truck,

  Sliders,
  Wallet,
  FileCheck2,
  ScrollText,
  Activity,
  GitPullRequest,
 
  Sparkles,
 
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../lib/utils';
import { getApi } from '../../shared/apiClient';
import { openFileAsset } from '../../../lib/files';
import { formatDate } from '../../shared/format';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import { useQuery } from '@tanstack/react-query';
import { sellerRoutes, buyerRoutes } from '@/lib/routes';

function ProcurementsTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/20 p-2 shadow-sm">
      <div className="space-y-2.5 p-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white p-4 shadow-2xs">
            <Skeleton className="h-6 w-8 rounded-md shrink-0" />
            <Skeleton className="h-6 w-24 rounded-full shrink-0" />
            <Skeleton className="h-4 w-24 shrink-0" />
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-6 w-20 rounded-full shrink-0" />
            <Skeleton className="h-8 w-20 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProcurementsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { getBuyerRegisterAdapter } from '../adapters';
import { PageToolbar } from '../../shared/PageToolbar';

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */

interface NormalizedProcurement {
  id: number;
  type: string;
  typeLabel: string;
  linkedAuctionId?: number | null;
  title: string;
  referenceNumber: string;
  status: string;
  statusLabel: string;
  statusGroup: string;
  method: string;
  methodLabel: string;
  estimatedValue: number;
  category: string;
  createdAt: string;
  updatedAt: string;
  actionUrl: string;
  description?: string;
  deliveryLocation?: string;
  startDate?: string;
  endDate?: string;
  quantity?: string;
  unit?: string;
  organizationName?: string;
  participantsCount?: number;
  documents?: Array<{ fileAssetId: number | null; fileName: string; documentType?: string; required?: boolean; instructions?: string }>;
  items?: Array<{
    itemName: string;
    quantity: string;
    unitOfMeasure: string;
    description?: string;
    estimatedUnitPrice?: number;
    specifications?: {
      itemType?: string;
      hsn_sac_code?: string;
      brand_preference?: string;
      brand_flexible?: string;
      gst?: number;
      discount?: number;
      fileAssetId?: number | null;
      specificationFileName?: string;
      attachments?: Array<{ fileAssetId: number; fileName: string }>;
    };
  }>;
  paymentTerms?: string;
  eligibilityCriteria?: string[];
  termsAndConditions?: string[];
  budgetDetails?: {
    budgetHead?: string;
    financialYear?: string;
    fundSource?: string;
    sanctionAmount?: number;
    sanctionOrderNumber?: string;
    sanctionDate?: string;
    approvingAuthority?: string;
    payingAuthorityDesignation?: string;
    paymentMode?: string;
    priceReasonabilityRemarks?: string;
    marketComparisonPrice?: number;
    lastPurchasePrice?: number;
    costCenter?: string;
    justification?: string;
    remarks?: string;
  };
  detailSections?: Array<{
    title: string;
    fields: Array<{ label: string; value: string }>;
  }>;
  approvalTrail?: Array<{
    stage?: string;
    label?: string;
    decision?: string;
    remarks?: string;
    decidedAt?: string;
    approverName?: string;
    approverEmail?: string;
  }>;
  tracking?: Array<{
    label: string;
    status: string;
    date?: string;
  }>;
}

interface KpiData {
  totalProcurements: number;
  drafts: number;
  pendingApproval: number;
  active: number;
  completed: number;
  cancelled: number;
  totalValue: number;
}

const resolveProcurementActionUrl = (p: NormalizedProcurement) => {
  const statusLower = String(p.status || '').toLowerCase();
  const statusGroup = String(p.statusGroup || '').toLowerCase();
  const typeLower = String(p.type || '').toLowerCase();
  const rawActionUrl = String(p.actionUrl || '');

  if (statusLower === 'converted_to_order' || statusLower === 'completed') return '/buyer/orders';
  if (typeLower === 'direct_purchase' && (statusLower === 'approved' || statusLower === 'completed')) return '/buyer/orders';
  if (statusGroup === 'pending_approval') return '/buyer/procurement/approvals';
  if (statusGroup === 'draft' || statusLower.includes('draft')) return '/buyer/procurement/drafts';
  if (/\/buyer\/procurement\/checkout\?/i.test(rawActionUrl)) return '/buyer/my-procurements';
  if (rawActionUrl.startsWith('/bids/')) return '/buyer/my-procurements';
  return rawActionUrl || '/buyer/my-procurements';
};

const procurementActionLabel = (p: NormalizedProcurement) => {
  const statusLower = String(p.status || '').toLowerCase();
  const statusGroup = String(p.statusGroup || '').toLowerCase();
  const typeLower = String(p.type || '').toLowerCase();

  if (typeLower === 'reverse_auction') {
    if (['published', 'open', 'active', 'sourcing', 'live'].includes(statusLower)) return 'Join Live Auction';
    if (['closed', 'completed', 'awarded', 'fulfilled', 'finalized'].includes(statusLower)) return 'View Auction Results';
    return 'View Auction Details';
  }

  if (statusLower === 'converted_to_order' || statusLower === 'completed') return 'View Purchase Order';
  if (typeLower === 'direct_purchase' && (statusLower === 'approved' || statusLower === 'completed')) return 'View Purchase Order';
  if (statusGroup === 'pending_approval') return 'View Approvals';
  if (typeLower === 'bid_draft') return 'Resume Bid Wizard';
  if (statusGroup === 'draft' || statusLower.includes('draft')) return 'View Drafts';
  return 'Go to Procurement';
};

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */
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

const STATUS_FILTERS = [
  { key: '', label: 'All Statuses' },
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const VALUE_FILTERS = [
  { key: '', label: 'All Values' },
  { key: 'under-10k', label: 'Under ₹10,000' },
  { key: '10k-1l', label: '₹10,000 - ₹1 Lakh' },
  { key: '1l-10l', label: '₹1 Lakh - ₹10 Lakhs' },
  { key: '10l-50l', label: '₹10 Lakhs - ₹50 Lakhs' },
  { key: 'above-50l', label: 'Above ₹50 Lakhs' },
];

const DATE_FILTERS = [
  { key: '', label: 'All Time' },
  { key: '24h', label: 'Last 24 Hours' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
];

const getConsolidatedType = (p: NormalizedProcurement): string => {
  const status = String(p.status || '').toLowerCase();
  const statusGroup = String(p.statusGroup || '').toLowerCase();
  const type = String(p.type || '').toLowerCase();
  const method = String(p.method || '').toLowerCase();
  const title = String(p.title || '').toLowerCase();
  const typeLabel = String(p.typeLabel || '').toLowerCase();
  const methodLabel = String(p.methodLabel || '').toLowerCase();

  // 1. Draft
  if (status === 'draft' || statusGroup === 'draft' || type === 'bid_draft' || title.includes('draft')) {
    return 'Draft';
  }
  // 2. RFQ
  if (method === 'rfq' || type.includes('rfq')) {
    return 'RFQ';
  }
  // 3. RFP
  if (method === 'rfp' || method === 'rfi' || type.includes('rfp') || type.includes('rfi')) {
    return 'RFP';
  }
  // 4. Reverse Auction
  if (method === 'reverse-auction' || method === 'reverse_auction' || type === 'reverse_auction') {
    return 'Reverse Auction';
  }
  // 5. Cart Checkout
  if (type === 'procurement_request' || type.includes('checkout') || type.includes('cart') || method.includes('direct') || type.includes('direct')) {
    return 'Cart Checkout';
  }
  // 6. Limited Tender (Checked BEFORE OpenTender)
  if (method.includes('limited') || type.includes('limited') || typeLabel.includes('limited') || methodLabel.includes('limited')) {
    return 'Limited Tender';
  }
  // 7. OpenTender
  if (method === 'open-tender' || method === 'open_tender' || method === 'tender' || type.includes('open') || typeLabel.includes('open') || methodLabel.includes('open')) {
    return 'OpenTender';
  }
  // 8. Rate Contract
  if (method === 'rate-contract' || method === 'rate_contract' || type === 'rate_contract') {
    return 'Rate Contract';
  }
  // 9. Repeat order
  if (method === 'repeat-order' || method === 'repeat_order' || method === 'repeat-purchase') {
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

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-55/20 text-slate-700',
  pending_approval: 'border-amber-200 bg-amber-55/20 text-amber-800',
  active: 'border-sky-200 bg-sky-55/20 text-sky-850 text-sky-800',
  completed: 'border-emerald-200 bg-emerald-55/20 text-emerald-800',
  cancelled: 'border-red-200 bg-red-55/20 text-red-700',
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

type SortKey = 'title' | 'type' | 'status' | 'estimatedValue' | 'updatedAt' | 'referenceNumber' | 'category';
type SortDir = SortDirection;

const formatCurrency = (v: number) =>
  v ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
    });
  } catch {
    return value;
  }
};



/* ═══════════════════════════════════════════════
   SORT HEADER CELL
   ═══════════════════════════════════════════════ */

function ThSort({
  children,
  sortKey,
  currentSort,
  sortDir,
  onSort,
  className,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  currentSort: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSort === sortKey;
  return (
    <th
      className={cn(
        'cursor-pointer select-none px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-700',
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown
          className={cn('h-3 w-3 transition-colors', isActive ? 'text-[#12335f]' : 'text-slate-300')}
        />
        {isActive && (
          <span className="text-[8px] text-[#12335f]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );
}

const initialKpis: KpiData = {
  totalProcurements: 0,
  drafts: 0,
  pendingApproval: 0,
  active: 0,
  completed: 0,
  cancelled: 0,
  totalValue: 0,
};

const CACHE_KEY = 'buyer_my_procurements_cached_data_v1';

const getCachedProcurementsData = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.kpis) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return undefined;
};

const setCachedProcurementsData = (data: any) => {
  if (typeof window === 'undefined' || !data) return;
  try {
    const str = JSON.stringify(data);
    sessionStorage.setItem(CACHE_KEY, str);
    localStorage.setItem(CACHE_KEY, str);
  } catch {
    // ignore
  }
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

export default function MyProcurementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams?.get('type') || '';

  // Filters
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [valueFilter, setValueFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKpi, setActiveKpi] = useState<string | null>(null);

  // Sort & View
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useResponsiveViewMode('my-procurements:view-mode');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProcurement, setSelectedProcurement] = useState<NormalizedProcurement | null>(null);

  const openDetail = (p: NormalizedProcurement, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const typeLower = String(p.type || '').toLowerCase();
    const methodLower = String(p.method || '').toLowerCase();

    const isReverseAuction =
      typeLower === 'reverse_auction' ||
      methodLower === 'reverse_auction' ||
      methodLower === 'reverse-auction' ||
      methodLower === 'bid-with-reverse-auction' ||
      methodLower === 'bid_with_reverse_auction';

    let route: string | null = null;
    if (isReverseAuction) {
      // A reverse auction is stored as a Requirement; the biddable entity is the
      // linked Auction. Use its id (falling back to the auction row's own id).
      const auctionId = p.linkedAuctionId || (typeLower === 'reverse_auction' ? p.id : null);
      route = auctionId ? sellerRoutes.detail('REVERSE_AUCTION', auctionId) : null;
    } else if (typeLower === 'bid_tender') {
      const consolidated = getConsolidatedType(p);
      if (consolidated === 'OpenTender' || consolidated === 'Limited Tender') {
        route = `/tenders?tender=${p.id}`;
      } else if (consolidated === 'RFQ' || methodLower === 'rfq') {
        route = `/bids/${p.id}?type=RFQ`;
      } else if (consolidated === 'RFP' || methodLower === 'rfp') {
        route = `/bids/${p.id}?type=RFP`;
      } else {
        route = `/bids/${p.id}`;
      }
    } else if (typeLower === 'requirement') {
      if (methodLower === 'rfp') {
        route = `/buyer/rfp/detail?requirementId=${p.id}`;
      } else {
        route = `/buyer/rfq/detail?requirementId=${p.id}`;
      }
    }

    if (route) {
      router.push(route);
    } else {
      setSelectedProcurement(p);
      setDetailOpen(true);
    }
  };
  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedProcurement(null);
  };

  /* ── Data Loading with React Query & Client SWR Caching ── */
  const { data: queryData, isLoading: loading, refetch: loadData } = useQuery({
    queryKey: ['buyerMyProcurements'],
    queryFn: async () => {
      const result = await getApi<any>('/api/buyer/my-procurements');
      const payload = result || { kpis: null, procurements: [] };
      if (payload?.kpis) {
        setCachedProcurementsData(payload);
      }
      return payload;
    },
    initialData: getCachedProcurementsData,
    staleTime: 10 * 1000,
    refetchOnMount: true,
  });

  const kpis = queryData?.kpis || initialKpis;
  const procurements = queryData?.procurements || [];
  const isKpisLoading = loading && !queryData?.kpis;

  /* ── KPI Click Handler ── */
  const handleKpiClick = (group: string | null) => {
    if (activeKpi === group) {
      setActiveKpi(null);
      setStatusFilter('');
    } else {
      setActiveKpi(group);
      setStatusFilter(group || '');
    }
  };

  /* ── Sort Handler ── */
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  /* ── Rendered Data ── */
  const displayData = useMemo(() => {
    // Drafts live only on the dedicated Drafts page — never in the My Procurements list.
    let data = procurements.filter(p => String(p.statusGroup || '').toLowerCase() !== 'draft');

    // Deduplicate by type and id so every unique buyer procurement is preserved
    const seen = new Set<string>();
    data = data.filter(p => {
      const key = `${p.type}-${p.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Client-side Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.referenceNumber?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.typeLabel?.toLowerCase().includes(q) ||
        p.methodLabel?.toLowerCase().includes(q)
      );
    }

    // Consolidated Type Filter
    if (typeFilter) {
      data = data.filter(p => getConsolidatedType(p) === typeFilter);
    }

    // Status Filter (linked to KPI card group/statusFilter)
    if (statusFilter) {
      data = data.filter(p => String(p.statusGroup || '').toLowerCase() === statusFilter.toLowerCase());
    }

    // Method Filter
    if (methodFilter) {
      data = data.filter(p => String(p.method || '').toLowerCase() === methodFilter.toLowerCase());
    }

    // Value filter
    if (valueFilter) {
      data = data.filter(p => {
        const val = p.estimatedValue || 0;
        if (valueFilter === 'under-10k') return val < 10000;
        if (valueFilter === '10k-1l') return val >= 10000 && val < 100000;
        if (valueFilter === '1l-10l') return val >= 100000 && val < 1000000;
        if (valueFilter === '10l-50l') return val >= 1000000 && val < 5000000;
        if (valueFilter === 'above-50l') return val >= 5000000;
        return true;
      });
    }

    // Date filter
    if (dateFilter) {
      const now = new Date();
      data = data.filter(p => {
        if (!p.updatedAt) return false;
        const updated = new Date(p.updatedAt);
        const diffMs = now.getTime() - updated.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        if (dateFilter === '24h') return diffHours <= 24;
        if (dateFilter === '7d') return diffDays <= 7;
        if (dateFilter === '30d') return diffDays <= 30;
        return true;
      });
    }

    // Client-side sort (API already sorts, but for instant re-sorting)
    data.sort((a: any, b: any) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      let va = a[sortKey] ?? '';
      let vb = b[sortKey] ?? '';
      if (sortKey === 'type') {
        va = getConsolidatedType(a);
        vb = getConsolidatedType(b);
      } else if (sortKey === 'status') {
        va = a.statusLabel || a.statusGroup || a.status || '';
        vb = b.statusLabel || b.statusGroup || b.status || '';
      } else if (sortKey === 'estimatedValue') {
        va = Number(a.estimatedValue || 0);
        vb = Number(b.estimatedValue || 0);
      } else if (sortKey === 'updatedAt') {
        const da = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dbVal = new Date(b.updatedAt || b.createdAt || 0).getTime();
        va = isNaN(da) ? 0 : da;
        vb = isNaN(dbVal) ? 0 : dbVal;
      }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return data;
  }, [procurements, searchQuery, typeFilter, statusFilter, methodFilter, valueFilter, dateFilter, sortKey, sortDir]);

  const { page, pageSize, pageItems: pagedProcurements, total, setPage, setPageSize } = usePagination<NormalizedProcurement>(displayData, 10);
  const hasActiveFilters = !!(typeFilter || statusFilter || valueFilter || dateFilter || searchQuery);

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */

  if (detailOpen && selectedProcurement) {
    return (
      <ProcurementDetailView
        procurement={selectedProcurement}
        onBack={closeDetail}
        onGoTo={() => {
          closeDetail();
          router.push(resolveProcurementActionUrl(selectedProcurement));
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pt-2 px-4 sm:px-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-[#12335f]/10 text-[#12335f] font-bold">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              My Procurements
            </h1>
          </div>
          <p className="text-xs font-semibold text-slate-500">
            Unified view of all procurement activities — bids, tenders, rate contracts, direct purchases, and BOQ requirements. Click KPI cards to filter by status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => loadData()}
            disabled={loading}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-700 hover:bg-slate-50 transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={cn('mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button
            type="button"
            onClick={() => router.push('/buyer/procurement')}
            className="h-9 sm:h-10 px-3 sm:px-5 rounded-xl bg-[#12335f] text-xs font-black uppercase tracking-wider text-white hover:bg-[#12335f]/90 shadow-sm transition-all active:scale-95 border-none cursor-pointer"
          >
            <ShoppingCart className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> New Procurement
          </Button>
        </div>
      </div>

      {/* ── KPI Cards Grid ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 px-4 sm:px-0">
        <KpiCard
          icon={BarChart3}
          label="Total"
          value={kpis.totalProcurements}
          loading={isKpisLoading}
          active={activeKpi === null && !statusFilter}
          onClick={() => handleKpiClick(null)}
          tone="blue"
          subtext="All procurement files"
        />
        <KpiCard
          icon={Clock}
          label="Pending"
          value={kpis.pendingApproval}
          loading={isKpisLoading}
          active={activeKpi === 'pending_approval'}
          onClick={() => handleKpiClick('pending_approval')}
          tone="amber"
          subtext="Awaiting review"
        />
        <KpiCard
          icon={TrendingUp}
          label="Active"
          value={kpis.active}
          loading={isKpisLoading}
          active={activeKpi === 'active'}
          onClick={() => handleKpiClick('active')}
          tone="cyan"
          subtext="Live in progress"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Completed"
          value={kpis.completed}
          loading={isKpisLoading}
          active={activeKpi === 'completed'}
          onClick={() => handleKpiClick('completed')}
          tone="green"
          subtext="Delivered & settled"
        />
        <KpiCard
          icon={XCircle}
          label="Cancelled"
          value={kpis.cancelled}
          loading={isKpisLoading}
          active={activeKpi === 'cancelled'}
          onClick={() => handleKpiClick('cancelled')}
          tone="red"
          subtext="Voided or abandoned"
        />
        <KpiCard
          icon={Package}
          label="Est. Value"
          value={formatCurrency(kpis.totalValue)}
          loading={isKpisLoading}
          tone="purple"
          subtext="Aggregate budget"
        />
      </div>

      {/* ── Floating Filters Bar ── */}
      <PageToolbar
        singleRowDesktop={true}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by title, ref no, category..."
        filters={[
          {
            kind: 'select',
            value: typeFilter,
            onChange: setTypeFilter,
            options: TYPE_FILTERS.map(f => ({ value: f.key, label: f.label })),
            placeholder: 'All Types'
          },
          {
            kind: 'select',
            value: statusFilter,
            onChange: val => { setStatusFilter(val); setActiveKpi(val || null); },
            options: STATUS_FILTERS.map(f => ({ value: f.key, label: f.label })),
            placeholder: 'All Statuses'
          },
          {
            kind: 'select',
            value: valueFilter,
            onChange: setValueFilter,
            options: VALUE_FILTERS.map(f => ({ value: f.key, label: f.label })),
            placeholder: 'All Values'
          },
          {
            kind: 'select',
            value: dateFilter,
            onChange: setDateFilter,
            options: DATE_FILTERS.map(f => ({ value: f.key, label: f.label })),
            placeholder: 'All Time'
          }
        ]}
        actions={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
        onReset={hasActiveFilters ? () => {
          setTypeFilter('');
          setStatusFilter('');
          setValueFilter('');
          setDateFilter('');
          setSearchQuery('');
          setActiveKpi(null);
        } : undefined}
      />

      {/* ── Content ── */}
      {loading ? (
        viewMode === 'list' ? <ProcurementsTableSkeleton /> : <ProcurementsGridSkeleton />
      ) : displayData.length > 0 ? (
        <div className="space-y-4">
          {/* ═══ LIST VIEW ═══ */}
          {viewMode === 'list' && (
            <>
              <div className="overflow-x-auto w-full max-w-full rounded-2xl border border-slate-200/80 bg-slate-50/20 p-2 shadow-sm">
                <table className="w-full min-w-[950px] border-separate border-spacing-y-2 text-left">
                  <thead>
                    <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 text-center w-16 select-none">Sr. No.</th>
                      <th className="px-4 py-3 w-32"><SortableHeader label="Type" field="type" activeField={sortKey} direction={sortDir} onSort={handleSort} /></th>
                      <th className="px-4 py-3 w-96"><SortableHeader label="Title & Reference" field="title" activeField={sortKey} direction={sortDir} onSort={handleSort} /></th>
                      <th className="px-4 py-3 w-36"><SortableHeader label="Status" field="status" activeField={sortKey} direction={sortDir} onSort={handleSort} /></th>
                      <th className="px-4 py-3 w-36"><SortableHeader label="Est. Value" field="estimatedValue" activeField={sortKey} direction={sortDir} onSort={handleSort} /></th>
                      <th className="px-4 py-3 w-44"><SortableHeader label="Category & Location" field="category" activeField={sortKey} direction={sortDir} onSort={handleSort} /></th>
                      <th className="px-4 py-3 w-32"><SortableHeader label="Updated" field="updatedAt" activeField={sortKey} direction={sortDir} onSort={handleSort} /></th>
                      <th className="px-4 py-3 text-right w-32 select-none font-black">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProcurements.map((p: any, idx) => {
                      const typeVal = getConsolidatedType(p);
                      const TypeIcon = getTypeIcon(typeVal);
                      return (
                        <tr
                          key={`${p.type}-${p.id}`}
                          className="group bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:shadow-md hover:-translate-y-0.5 hover:bg-slate-50/70 transition-all duration-300 ease-out align-middle cursor-pointer"
                          onClick={() => openDetail(p)}
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
                              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {p.referenceNumber}
                              </span>
                            </div>
                            <p title={p.title} className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                              {p.title}
                            </p>
                            {p.description && (
                              <p title={p.description} className="text-[10px] font-semibold text-slate-400 line-clamp-1">
                                {p.description}
                              </p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            <span className={cn(
                              'inline-flex whitespace-nowrap rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border',
                              p.statusGroup === 'draft' ? 'border-slate-200 bg-slate-50 text-slate-600' :
                                p.statusGroup === 'pending_approval' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                  p.statusGroup === 'active' ? 'border-sky-200 bg-sky-50 text-sky-700' :
                                    p.statusGroup === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                      'border-red-200 bg-red-50 text-red-700'
                            )}>
                              {p.statusLabel}
                            </span>
                          </td>

                          {/* Est Value */}
                          <td className="px-4 py-4">
                            <span className="text-xs font-extrabold text-slate-900 block">
                              {formatCurrency(p.estimatedValue)}
                            </span>
                          </td>

                          {/* Category & Location */}
                          <td className="px-4 py-4 space-y-1">
                            <span title={p.category || '—'} className="text-xs font-bold text-slate-600 line-clamp-1">{p.category || '—'}</span>
                            {p.deliveryLocation && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400">
                                <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                {p.deliveryLocation}
                              </span>
                            )}
                          </td>

                          {/* Updated */}
                          <td className="px-4 py-4 text-xs font-bold text-slate-500">
                            {formatDateTime(p.updatedAt)}
                          </td>

                          {/* Action */}
                          <td className="rounded-r-xl px-4 py-4 text-right">
                            <Button
                              type="button"
                              size="sm"
                              onClick={e => openDetail(p, e)}
                              className="inline-flex h-8 min-w-[90px] items-center justify-center rounded-lg bg-blue-600 px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700 hover:shadow-md active:scale-95 transition-all duration-200 border-none cursor-pointer"
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>


            </>
          )}

          {/* ═══ GRID VIEW ═══ */}
          {viewMode === 'grid' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pagedProcurements.map(p => {
                const typeVal = getConsolidatedType(p);
                return (
                  <div
                    key={`${p.type}-${p.id}`}
                    onClick={() => openDetail(p)}
                    className={cn(
                      "group flex flex-col justify-between rounded-2xl border bg-slate-50/60 p-4 shadow-xs hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-1 border-[#12335f]/10 hover:border-[#12335f]/30 h-full cursor-pointer"
                    )}
                  >
                    <div className="flex flex-col flex-1">
                      {/* Top row: Badges & Reference */}
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <span className={cn(
                          "inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border whitespace-nowrap transition-transform group-hover:scale-105 shrink-0 bg-white",
                          TYPE_BADGE_STYLES[typeVal] || 'border-slate-200 text-slate-700'
                        )}>
                          {typeVal}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-slate-400 tabular-nums text-right break-all">
                          {p.referenceNumber}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 title={p.title} className="text-sm font-black text-slate-900 leading-snug line-clamp-2 group-hover:text-[#12335f] transition-colors mb-2">
                        {p.title}
                      </h3>

                      {/* Source Ref & Category */}
                      <div className="text-[11px] text-slate-500 font-bold space-y-1 mb-4">
                        {p.category && <p title={p.category} className="line-clamp-1">Category: {p.category}</p>}
                        {p.description && <p title={p.description} className="text-[10px] font-semibold text-slate-400 line-clamp-1">{p.description}</p>}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/70 mt-auto flex flex-col gap-4">
                      {/* Status & Commercials */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1.5">Status</p>
                          <span className={cn(
                            'inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border',
                            p.statusGroup === 'draft' ? 'border-slate-200 bg-white text-slate-600' :
                              p.statusGroup === 'pending_approval' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                p.statusGroup === 'active' ? 'border-sky-200 bg-sky-50 text-sky-700' :
                                  p.statusGroup === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                    'border-red-200 bg-red-50 text-red-700'
                          )}>
                            {p.statusLabel}
                          </span>
                        </div>

                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1.5">Est. Value</p>
                          <span className="text-sm font-extrabold text-slate-900 block tabular-nums">
                            {formatCurrency(p.estimatedValue)}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={e => openDetail(p, e)}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#12335f] px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-[#0b2445] hover:shadow-md active:scale-95 transition-all duration-200 border-none cursor-pointer"
                      >
                        View Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ PAGINATION ═══ */}
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
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
      ) : (
        /* ── Empty State ── */
        <section className="border border-dashed border-slate-200 rounded-3xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#12335f]/5 text-[#12335f]">
            <ClipboardList className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-lg font-black text-slate-900">
            {hasActiveFilters ? 'No procurements match your filters' : 'No procurements yet'}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">
            {hasActiveFilters
              ? 'Try adjusting your filters or clearing them to see all procurements.'
              : 'Start a procurement process from the Buying Dashboard. Your bids, tenders, direct purchases, and requirements will appear here.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTypeFilter('');
                  setStatusFilter('');
                  setSearchQuery('');
                  setActiveKpi(null);
                }}
                className="h-10 rounded-xl text-xs font-black uppercase"
              >
                Clear Filters
              </Button>
            )}
            <Button
              type="button"
              onClick={() => router.push('/buyer/procurement')}
              className="h-10 rounded-xl bg-[#12335f] px-6 text-xs font-black uppercase text-white hover:bg-[#0b2445] shadow-sm transition-colors"
            >
              Go to Buying Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}


    </div>
  );
}

function ProcurementCard({ p, openDetail }: { p: any; openDetail: (p: any, e?: React.MouseEvent) => void }) {
  const typeVal = getConsolidatedType(p);
  return (
    <div
      onClick={(e) => openDetail(p, e)}
      className={cn(
        "group rounded-2xl border bg-white p-5 shadow-2xs hover:shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 border-slate-200/80 hover:border-blue-300 flex flex-col justify-between min-h-[220px] cursor-pointer"
      )}
    >
      <div className="space-y-3">
        {/* Top row: Badges */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border whitespace-nowrap transition-transform group-hover:scale-105",
            TYPE_BADGE_STYLES[typeVal] || 'border-slate-200 bg-slate-50 text-slate-700'
          )}>
            {typeVal}
          </span>
          <span className="text-[10px] font-mono font-semibold text-slate-400 tabular-nums">
            {p.referenceNumber}
          </span>
        </div>

        {/* Title */}
        <h3 title={p.title} className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
          {p.title}
        </h3>

        {/* Source Ref & Category */}
        <div className="text-[11px] text-slate-500 font-bold space-y-1">
          {p.category && <p title={p.category} className="line-clamp-1">Category: {p.category}</p>}
          {p.description && <p title={p.description} className="text-[10px] font-semibold text-slate-400 line-clamp-1">{p.description}</p>}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 mt-4 space-y-3">
        {/* Timeline & Commercials */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Status</p>
            <div className="mt-1">
              <span className={cn(
                'inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border',
                p.statusGroup === 'draft' ? 'border-slate-200 bg-slate-50 text-slate-600' :
                  p.statusGroup === 'pending_approval' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                    p.statusGroup === 'active' ? 'border-sky-200 bg-sky-50 text-sky-700' :
                      p.statusGroup === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                        'border-red-200 bg-red-50 text-red-700'
              )}>
                {p.statusLabel}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Est. Value</p>
            <div className="mt-1">
              <span className="text-xs font-extrabold text-slate-900 block">
                {formatCurrency(p.estimatedValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={e => openDetail(p, e)}
            className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-blue-600 px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700 hover:shadow-md active:scale-95 transition-all duration-200 border-none cursor-pointer"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers for details formatting ── */
const parseDescription = (desc?: string) => {
  if (!desc) return { method: '', value: '', urgency: '', text: '' };

  const cleanedDesc = desc.replace(/\r/g, '');

  const methodMatch = cleanedDesc.match(/Sourcing Method:\s*(.*?)(?=(?:Value:|Urgency:|$))/i);
  const valueMatch = cleanedDesc.match(/Value:\s*(.*?)(?=(?:Urgency:|$))/i);
  const urgencyMatch = cleanedDesc.match(/Urgency:\s*(.*?)(?=$)/i);

  let cleanText = cleanedDesc;
  if (methodMatch || valueMatch || urgencyMatch) {
    cleanText = cleanedDesc
      .replace(/Sourcing Method:[^\n]*/gi, '')
      .replace(/Value:[^\n]*/gi, '')
      .replace(/Urgency:[^\n]*/gi, '')
      .replace(/\n+/g, '\n')
      .trim();
  }

  return {
    method: methodMatch ? methodMatch[1].trim() : '',
    value: valueMatch ? valueMatch[1].trim() : '',
    urgency: urgencyMatch ? urgencyMatch[1].trim() : '',
    text: cleanText
  };
};

const formatDisplayValue = (val: string, label?: string) => {
  if (!val) return '—';
  if (val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) || val.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return formatDate(val);
  }
  if (val.match(/^[A-Z][A-Z0-9_]*$/)) {
    return val
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  if (val.includes('Sourcing Method:')) {
    const parsed = parseDescription(val);
    return `Sourcing Method: ${parsed.method || '—'}\nValue: ${parsed.value || '—'}\nUrgency: ${parsed.urgency || '—'}`;
  }
  return val;
};

/* ═══════════════════════════════════════════════
   PROCUREMENT DETAIL VIEW (Full Page – TenderDetailPage-style)
   ═══════════════════════════════════════════════ */



export function ProcurementDetailView({
  procurement: p,
  onBack,
  onGoTo,
}: {
  procurement: any;
  onBack: () => void;
  onGoTo?: () => void;
}) {
  /* ── 1. Timeline Calculations (Guaranteed Order) ── */
  const rawSteps =
    p.tracking && p.tracking.length > 0
      ? p.tracking.map((t: any) => ({
          label: t.label,
          date: t.date ? formatDateTime(t.date) : 'Pending',
          isActive: ['completed', 'approved', 'in_progress'].includes(
            String(t.status || '').toLowerCase()
          ),
        }))
      : [
          { label: 'Created', date: formatDateTime(p.createdAt), isActive: true },
          {
            label: 'Submitted',
            date: p.statusGroup !== 'draft' ? formatDateTime(p.updatedAt || p.createdAt) : 'Pending',
            isActive: p.statusGroup !== 'draft',
          },
          {
            label: 'Approval / Review',
            date:
              p.statusGroup === 'pending_approval'
                ? 'In Progress'
                : ['active', 'completed'].includes(p.statusGroup)
                ? formatDateTime(p.updatedAt)
                : 'Pending',
            isActive: ['pending_approval', 'active', 'completed'].includes(p.statusGroup),
          },
          {
            label: 'Approved / Ordered',
            date: p.statusGroup === 'completed' ? formatDateTime(p.updatedAt) : 'Pending',
            isActive: p.statusGroup === 'completed',
          },
        ];

  const lastActiveIndex = rawSteps.map((s) => s.isActive).lastIndexOf(true);

  const timelineSteps = rawSteps.map((step, idx) => {
    let state: 'completed' | 'current' | 'pending' = 'pending';
    if (idx < lastActiveIndex) {
      state = 'completed';
    } else if (idx === lastActiveIndex) {
      state = idx === rawSteps.length - 1 && step.isActive ? 'completed' : 'current';
    }
    return { ...step, state };
  });

  const progressPercent =
    timelineSteps.length > 1
      ? (Math.max(0, lastActiveIndex) / (timelineSteps.length - 1)) * 100
      : 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-200">
      
      {/* ── Breadcrumb Navigation ── */}
      <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 px-1">
        <button
          onClick={onBack}
          className="hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer font-medium"
        >
          My Procurements
        </button>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span title={p.referenceNumber || p.title} className="text-slate-600 truncate max-w-[200px] sm:max-w-none font-medium">
          {p.referenceNumber || p.title}
        </span>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="text-blue-950 font-bold bg-blue-50 text-blue-900 px-2 py-0.5 rounded-md border border-blue-100">
          Details
        </span>
      </nav>

      {/* ── Executive Header Banner ── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d213f] via-[#12335f] to-[#1e4976] p-5 md:p-6 text-white shadow-md border border-blue-950/40">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 h-36 w-36 rounded-full bg-emerald-400/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase border backdrop-blur-md',
                  TYPE_BADGE_STYLES[p.type] || 'border-blue-300/30 bg-blue-500/20 text-blue-100'
                )}
              >
                {p.typeLabel || 'PROCUREMENT'}
              </span>

              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border backdrop-blur-md',
                  STATUS_BADGE_STYLES[p.statusGroup] || 'border-emerald-300/40 bg-emerald-500/20 text-emerald-200'
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {p.statusLabel || p.status || 'Active'}
              </span>

              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 text-blue-100 border border-white/10">
                {p.referenceNumber || 'REF-PENDING'}
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white drop-shadow-xs">
              {p.title}
            </h1>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-blue-100/80 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-300" />
                Created {formatDateTime(p.createdAt)}
              </span>
              {p.organizationName && (
                <>
                  <span>•</span>
                  <span>Org: <strong className="text-white">{p.organizationName}</strong></span>
                </>
              )}
              {p.estimatedValue && (
                <>
                  <span>•</span>
                  <span className="text-emerald-300 font-bold">
                    Est. Value: {formatCurrency(p.estimatedValue)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <Button
              type="button"
              onClick={onBack}
              className="h-9 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-sm transition-all shadow-xs active:scale-95"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to List
            </Button>
          </div>
        </div>
      </section>

      {/* ── Compact Stepper Timeline ── */}
      <section className="rounded-xl border border-slate-200/80 bg-white py-3.5 px-4 md:px-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between relative gap-5 md:gap-0">
          
          {/* Horizontal Progress Bar */}
          <div className="hidden md:block absolute top-[16px] left-[36px] right-[36px] h-[3px] bg-slate-100 rounded-full z-0">
            <div
              className="h-full bg-gradient-to-r from-blue-700 to-blue-900 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Vertical Progress Bar (Mobile) */}
          <div className="block md:hidden absolute top-[16px] bottom-[16px] left-[15px] w-[3px] bg-slate-100 rounded-full z-0">
            <div
              className="w-full bg-blue-900 rounded-full transition-all duration-700 ease-out"
              style={{ height: `${progressPercent}%` }}
            />
          </div>

          {timelineSteps.map((step, idx) => (
            <div
              key={idx}
              className="flex flex-row md:flex-col items-center gap-3 md:gap-1.5 relative z-10 md:w-32 text-left md:text-center group"
            >
              <div className="relative">
                {step.state === 'current' && (
                  <div className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-25 duration-1000" />
                )}

                <div
                  className={cn(
                    'relative flex h-8 w-8 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 shadow-xs z-10',
                    step.state === 'completed'
                      ? 'bg-blue-950 border-blue-950 text-white'
                      : step.state === 'current'
                      ? 'bg-blue-700 border-blue-700 text-white ring-4 ring-blue-100'
                      : 'bg-white border-slate-200 text-slate-300'
                  )}
                >
                  {step.state === 'completed' ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : step.state === 'current' ? (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                <p
                  className={cn(
                    'text-xs font-bold tracking-tight leading-none',
                    step.state === 'current'
                      ? 'text-blue-950 font-extrabold'
                      : step.state === 'completed'
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  )}
                >
                  {step.label}
                </p>
                <p
                  className={cn(
                    'text-[10px] font-medium leading-tight',
                    step.state === 'pending' ? 'text-slate-400' : 'text-slate-500'
                  )}
                >
                  {step.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOQ & Item Specifications Table ── */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-900 text-white shadow-xs">
              <Package className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                ITEM / BOQ SPECIFICATIONS
              </h2>
              <p className="text-[10px] text-slate-500 font-medium leading-none">
                Detailed bill of quantities and compliance specs
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold bg-white text-blue-950 border border-blue-200/80 px-2.5 py-0.5 rounded-md shadow-2xs">
            {(p.items || []).length || 1} {(p.items || []).length === 1 ? 'Item' : 'Items'} Listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                <th className="px-3 py-2.5 min-w-[200px]">Item Name & Description</th>
                <th className="px-3 py-2.5 min-w-[150px]">Technical Specifications</th>
                <th className="px-3 py-2.5 min-w-[130px]">Brand / Make</th>
                <th className="px-3 py-2.5 min-w-[110px]">HSN / Tax</th>
                <th className="px-3 py-2.5 w-20 text-center">Quantity</th>
                <th className="px-3 py-2.5 w-28 text-right">Unit Price</th>
                <th className="px-3 py-2.5 w-28 text-right bg-emerald-50/40">Total Amount</th>
                <th className="px-3 py-2.5 min-w-[130px] text-center">Warranty & SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {p.items && p.items.length > 0 ? (
                p.items.map((item: any, idx: number) => {
                  const spec = item.specifications || {};
                  const unitPrice = item.estimatedUnitPrice || item.price || item.unitPrice || 0;
                  const qty = Number(item.quantity || 1);
                  const totalPrice = unitPrice ? unitPrice * qty : 0;
                  const hsn = spec.hsn_sac_code || spec.hsn || '—';
                  const gst =
                    spec.gst !== undefined
                      ? `${spec.gst}%`
                      : spec.gstPercent
                      ? `${spec.gstPercent}%`
                      : '18%';

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-blue-50/20 transition-colors align-top group"
                    >
                      <td className="px-3 py-3 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 space-y-1">
                        <p className="font-bold text-slate-900 group-hover:text-blue-900 transition-colors">
                          {item.itemName}
                        </p>
                        {item.description && (
                          <p title={item.description} className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-slate-600">
                        <span className="bg-slate-100/80 px-2 py-0.5 rounded text-slate-700 border border-slate-200/60 inline-block">
                          {spec.technicalSpecs || item.technicalSpecs || 'Refer to BOQ'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[11px] space-y-1 text-slate-700">
                        <div>
                          <span className="text-slate-400">Make:</span>{' '}
                          <span className="font-bold text-slate-800">
                            {spec.brand_preference || item.brand || 'Any Standard'}
                          </span>
                        </div>
                        <div className="text-[10px]">
                          <span className="text-slate-400">Alt Allowed:</span>{' '}
                          <span
                            className={cn(
                              'font-bold px-1.5 py-0.2 rounded text-[10px]',
                              spec.brand_flexible?.toLowerCase() === 'no'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-emerald-50 text-emerald-700'
                            )}
                          >
                            {spec.brand_flexible?.toLowerCase() === 'no' ? 'No' : 'Yes'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[11px] space-y-0.5 text-slate-700">
                        <div className="font-mono text-slate-600">{hsn}</div>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-bold text-[10px]">
                          GST {gst}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="font-black text-slate-900">{qty}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {item.unitOfMeasure || 'Nos'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800 tabular-nums">
                        {unitPrice ? formatCurrency(unitPrice) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-800 tabular-nums bg-emerald-50/40">
                        {totalPrice
                          ? formatCurrency(totalPrice)
                          : p.estimatedValue
                          ? formatCurrency(p.estimatedValue)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-[11px] space-y-1 text-slate-600">
                        <div className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-[10px]">
                          {spec.warranty || '12M Warranty'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {spec.deliverySchedule || 'Standard SLA'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="hover:bg-slate-50/80">
                  <td className="px-3 py-3 text-center font-bold text-slate-400">1</td>
                  <td className="px-3 py-3">
                    <p className="font-bold text-slate-900">{p.title || 'Procurement Item'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {p.description || 'Standard procurement items'}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-slate-600">Refer to attached BOQ</td>
                  <td className="px-3 py-3 text-[11px] text-slate-700">Any Standard Make</td>
                  <td className="px-3 py-3 text-[11px] text-slate-700">GST 18%</td>
                  <td className="px-3 py-3 text-center font-bold">{p.quantity || 1} Nos</td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {p.estimatedValue ? formatCurrency(p.estimatedValue) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-black text-emerald-800 bg-emerald-50/40">
                    {p.estimatedValue ? formatCurrency(p.estimatedValue) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-[11px] text-slate-600">12 Months</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Rich Multi-Tonal Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Delivery & Consignee (Blue Tone) */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/40 to-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-blue-100/80">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800 shrink-0">
              <Truck className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider">
              Delivery & Consignee
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="bg-white/80 p-2 rounded-lg border border-blue-100/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Delivery Location
              </span>
              <p className="font-semibold text-slate-800 leading-snug mt-0.5">
                {p.deliveryLocation || 'Mahabad: Jalgaon, Maharashtra - 425001'}
              </p>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
              <span className="text-slate-500 font-medium">Delivery Period</span>
              <span className="font-bold text-slate-900 bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-100">
                {p.endDate ? formatDateTime(p.endDate) : '7 Working Days'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 text-[11px]">
              <span className="text-slate-500 font-medium">Consignee</span>
              <span title={p.organizationName || 'VANSIKA DAWANI'} className="font-bold text-slate-800 truncate max-w-[140px]">
                {p.organizationName || 'VANSIKA DAWANI'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Supplier Eligibility (Teal/Emerald Tone) */}
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-emerald-100/80">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
              Eligibility & Rules
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">MSME Pref.</span>
                <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 text-xs mt-0.5">
                  <Check className="h-3 w-3" /> Applicable
                </span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Vendor Selection</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">Open Bidding</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
              <span className="text-slate-500 font-medium">Exclude Blacklisted</span>
              <span className="font-bold text-emerald-700">Yes</span>
            </div>
            <div className="flex justify-between items-center py-1 text-[11px]">
              <span className="text-slate-500 font-medium">Exp. Required</span>
              <span className="font-bold text-slate-800">0 Years (Open to all)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Evaluation Criteria (Purple Tone) */}
        <div className="rounded-xl border border-purple-100 bg-gradient-to-b from-purple-50/40 to-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-purple-100/80">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-800 shrink-0">
              <Sliders className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider">
              Evaluation Basis
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="bg-white/80 p-2 rounded-lg border border-purple-100/60 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Method</span>
              <span className="font-bold text-purple-950 text-xs">
                {(() => {
                  const raw = (p as any).evaluationMethod || (p as any).payload?.evaluation?.method || (p as any).payload?.evaluationMethod || (p as any).payload?.rules?.evaluationMethod;
                  if (!raw) return 'L1 Total Value';
                  const lower = String(raw).toLowerCase();
                  if (lower.includes('qcbs') || lower.includes('quality and cost') || lower.includes('weighted technical')) return 'Quality and Cost Based Selection (QCBS)';
                  if (lower.includes('item-wise') || lower.includes('item wise')) return 'Item-wise L1';
                  if (lower.includes('package-wise') || lower.includes('package wise')) return 'Package-wise L1';
                  if (lower.includes('technical qualification')) return 'Technical Qualification then L1';
                  if (lower.includes('reverse auction')) return 'Reverse Auction Final Bid Rank';
                  if (lower.includes('lowest landed cost')) return 'Lowest Landed Cost';
                  if (lower === 'l1' || lower === 'l1 basis') return 'L1 Basis';
                  return String(raw);
                })()}
              </span>
            </div>
            {String((p as any).evaluationMethod || (p as any).payload?.evaluation?.method || '').toLowerCase().includes('qcbs') ? (
              <>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
                  <span className="text-slate-500 font-medium">Technical Weight</span>
                  <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                    {(p as any).payload?.evaluation?.techWeight ?? 70}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 text-[11px]">
                  <span className="text-slate-500 font-medium">Commercial Weight</span>
                  <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                    {(p as any).payload?.evaluation?.commWeight ?? 30}%
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center py-1 text-[11px]">
                <span className="text-slate-500 font-medium">Selection Rule</span>
                <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                  Lowest Landed Cost (L1)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Financial Summary (Amber Tone) */}
        <div className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-amber-200/60">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 shrink-0">
              <Wallet className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
              Financial Terms
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="bg-amber-100/40 p-2 rounded-lg border border-amber-200/70 flex justify-between items-center">
              <span className="text-[10px] font-bold text-amber-900 uppercase">Est. Budget</span>
              <span className="font-black text-emerald-800 text-sm">
                {p.estimatedValue ? formatCurrency(p.estimatedValue) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
              <span className="text-slate-500 font-medium">EMD Amount</span>
              <span className="font-bold text-slate-800">Exempted</span>
            </div>
            <div className="flex justify-between items-center py-1 text-[11px]">
              <span className="text-slate-500 font-medium">Freight Charges</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                Included in Price
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Lower 2-Column Grid: Compliance & Terms ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Required Documents */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <FileCheck2 className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Mandatory Seller Documents
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">8 Required</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              'GST Certificate',
              'PAN Card',
              'Bank Details',
              'Compliance Sheet',
              'Price Breakup',
              'Experience Cert',
              'Turnover Cert',
              'No-Deviation',
            ].map((docName, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-700 hover:bg-blue-50/50 hover:border-blue-200 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span title={docName} className="truncate">{docName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <ScrollText className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Contract Terms & Permissions
              </h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              Standard SLA
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Withdrawal</span>
              <span className="text-xs font-extrabold text-emerald-700">Allowed</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Bid Revision</span>
              <span className="text-xs font-extrabold text-emerald-700">Allowed</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Seller Queries</span>
              <span className="text-xs font-extrabold text-emerald-700">Allowed</span>
            </div>
          </div>

          {p.termsAndConditions && p.termsAndConditions.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
                {p.termsAndConditions.map((term: string, idx: number) => (
                  <li key={idx} className="leading-tight">{term}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>

      {/* ── Dynamic Additional Specification Cards (If Present) ── */}
      {p.detailSections && p.detailSections.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-800" />
              Additional Procurement Parameters
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
              {p.detailSections.length} Sections
            </span>
          </div>

          <div className="columns-1 md:columns-2 gap-4 space-y-4 [&>div]:break-inside-avoid-column">
            {p.detailSections.map((section: any, idx: number) => {
              const getSectionIcon = (title: string) => {
                const t = title.toLowerCase();
                if (t.includes('intent') || t.includes('scope')) return ClipboardList;
                if (t.includes('buyer') || t.includes('user') || t.includes('contact') || t.includes('org')) return Info;
                if (t.includes('item') || t.includes('qty')) return Package;
                if (t.includes('date') || t.includes('time') || t.includes('schedule')) return CalendarDays;
                if (t.includes('price') || t.includes('budget') || t.includes('cost') || t.includes('value')) return IndianRupee;
                return Layers;
              };

              const SectionIcon = getSectionIcon(section.title);

              const longTextFields = section.fields.filter((f: any) => {
                const val = String(f.value || '');
                return (
                  val.length > 80 ||
                  f.label.toLowerCase().includes('description') ||
                  f.label.toLowerCase().includes('scope') ||
                  f.label.toLowerCase().includes('notes')
                );
              });

              const propertyFields = section.fields.filter((f: any) => !longTextFields.includes(f));

              return (
                <div
                  key={`${section.title}-${idx}`}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3 inline-block w-full"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-900 font-bold shrink-0">
                        <SectionIcon className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        {section.title}
                      </h3>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {section.fields.length} params
                    </span>
                  </div>

                  {propertyFields.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {propertyFields.map((field: any, fieldIdx: number) => (
                        <div
                          key={fieldIdx}
                          className="bg-slate-50/60 p-2 rounded-lg border border-slate-100 space-y-0.5"
                        >
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            {field.label}
                          </span>
                          <p title={formatDisplayValue(field.value, field.label)} className="text-xs font-bold text-slate-800 truncate">
                            {formatDisplayValue(field.value, field.label)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {longTextFields.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {longTextFields.map((field: any, fieldIdx: number) => (
                        <div
                          key={fieldIdx}
                          className="p-2.5 rounded-lg bg-blue-50/30 border border-blue-100/60 space-y-1"
                        >
                          <span className="text-[10px] font-bold uppercase text-blue-900 tracking-wider block">
                            {field.label}
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {formatDisplayValue(field.value, field.label)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
