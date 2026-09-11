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
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../lib/utils';
import { getApi, postApi } from '../../shared/apiClient';
import { openFileAsset } from '../../../lib/files';
import { formatDate, formatDateTime as formatSharedDateTime } from '../../shared/format';
import { DataTable, type ColumnDef, type SortDirection } from '../../../components/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { CancelProcurementModal, type CancelTargetProcurement } from '../components/CancelProcurementModal';
import { ProcurementDetailView } from '../components/ProcurementDetailView';
export { ProcurementDetailView };

const procurementSkeletonColumns: ColumnDef<any>[] = [
  { key: 'type', header: 'Type', width: 'w-32', cell: () => null },
  { key: 'title', header: 'Title & Reference', width: 'w-96', cell: () => null },
  { key: 'status', header: 'Status', width: 'w-36', cell: () => null },
  { key: 'estimatedValue', header: 'Est. Value', width: 'w-36', cell: () => null },
  { key: 'category', header: 'Category & Location', width: 'w-44', cell: () => null },
  { key: 'updatedAt', header: 'Updated', width: 'w-32', cell: () => null },
  { key: 'action', header: 'Action', align: 'right', width: 'w-32', cell: () => null }
];

function ProcurementsTableSkeleton() {
  return (
    <DataTable
      data={[]}
      columns={procurementSkeletonColumns}
      isLoading={true}
      skeletonRows={6}
      showSrNo={true}
      srNoHeader="Sr. No."
      minWidth="min-w-[950px]"
      keyExtractor={(_, idx) => idx}
    />
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
  auctionId?: number | null;
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
  // 6. Rate Contract (Checked BEFORE generic tenders)
  if (
    method.includes('rate') ||
    type.includes('rate') ||
    typeLabel.includes('rate') ||
    methodLabel.includes('rate') ||
    title.includes('rate contract') ||
    title.includes('rate_contract') ||
    title.includes('rate')
  ) {
    return 'Rate Contract';
  }
  // 7. Limited Tender (Checked BEFORE OpenTender)
  if (method.includes('limited') || type.includes('limited') || typeLabel.includes('limited') || methodLabel.includes('limited') || title.includes('limited')) {
    return 'Limited Tender';
  }
  // 8. OpenTender
  if (method === 'open-tender' || method === 'open_tender' || method === 'tender' || method.includes('open') || type.includes('open') || typeLabel.includes('open') || methodLabel.includes('open') || title.includes('open tender') || title.includes('opentender')) {
    return 'OpenTender';
  }
  // 9. Repeat order
  if (method === 'repeat-order' || method === 'repeat_order' || method === 'repeat-purchase' || title.includes('repeat')) {
    return 'Repeat order';
  }

  return 'RFQ';
};

export const isProcurementCancellable = (p: any): boolean => {
  if (!p) return false;
  const sGroup = String(p.statusGroup || '').toLowerCase();
  const s = String(p.status || '').toLowerCase();
  if (['cancelled', 'rejected', 'expired', 'voided', 'abandoned'].includes(sGroup) || ['cancelled', 'rejected'].includes(s)) return false;
  if (['completed', 'awarded', 'converted_to_order', 'order_placed', 'po_generated', 'delivered', 'grn_completed', 'invoice_submitted', 'payment_completed'].includes(s) || sGroup === 'completed') return false;
  return true;
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

const formatDateTime = (value?: string) => formatSharedDateTime(value);



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
      typeLower.includes('auction') ||
      methodLower === 'reverse_auction' ||
      methodLower === 'reverse-auction' ||
      methodLower.includes('auction') ||
      methodLower === 'bid-with-reverse-auction' ||
      methodLower === 'bid_with_reverse_auction' ||
      Boolean(p.linkedAuctionId || p.auctionId);

    let route: string | null = null;
    if (isReverseAuction) {
      // A reverse auction is stored as a Requirement; the biddable entity is the
      // linked Auction. Use its id (falling back to linkedAuctionId, auctionId, referenceNumber, or id).
      const auctionId = p.linkedAuctionId || p.auctionId || (typeLower === 'reverse_auction' ? p.id : null) || p.referenceNumber || p.id;
      route = auctionId ? buyerRoutes.detail('REVERSE_AUCTION', auctionId) : null;
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

  /* ── Cancellation Modal State & Handlers ── */
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [procurementToCancel, setProcurementToCancel] = useState<CancelTargetProcurement | null>(null);

  const handleOpenCancelModal = useCallback((p: NormalizedProcurement, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcurementToCancel({
      id: p.id,
      type: p.type,
      title: p.title,
      referenceNumber: p.referenceNumber,
      typeLabel: p.typeLabel,
      estimatedValue: p.estimatedValue,
      status: p.status,
      statusGroup: p.statusGroup,
    });
    setCancelModalOpen(true);
  }, []);

  const handleConfirmCancel = useCallback(async (params: { type: string; id: number; reason: string; remarks?: string }) => {
    try {
      await postApi('/api/buyer/procurements/cancel', params);
      toast.success('Procurement cancelled successfully', {
        description: `Reference: ${procurementToCancel?.referenceNumber || params.id}`
      });
      await loadData();
      if (selectedProcurement && selectedProcurement.id === params.id) {
        setSelectedProcurement(prev => prev ? {
          ...prev,
          status: 'CANCELLED',
          statusLabel: 'Cancelled',
          statusGroup: 'cancelled'
        } : null);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to cancel procurement');
      throw err;
    }
  }, [loadData, procurementToCancel, selectedProcurement]);

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

  const procurementColumns: ColumnDef<any>[] = useMemo(() => [
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      sortKey: 'type',
      width: 'w-32',
      cell: (p: any) => {
        const typeVal = getConsolidatedType(p);
        const TypeIcon = getTypeIcon(typeVal);
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border transition-transform group-hover:scale-105",
            TYPE_BADGE_STYLES[typeVal] || 'border-slate-200 bg-slate-50 text-slate-700'
          )}>
            <TypeIcon className="h-3.5 w-3.5 shrink-0" />
            {typeVal}
          </span>
        );
      }
    },
    {
      key: 'title',
      header: 'Title & Reference',
      sortable: true,
      sortKey: 'title',
      width: 'w-96',
      cell: (p: any) => (
        <div className="space-y-1">
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
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortKey: 'status',
      width: 'w-36',
      cell: (p: any) => (
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
      )
    },
    {
      key: 'estimatedValue',
      header: 'Est. Value',
      sortable: true,
      sortKey: 'estimatedValue',
      width: 'w-36',
      cell: (p: any) => (
        <span className="text-xs font-extrabold text-slate-900 block">
          {formatCurrency(p.estimatedValue)}
        </span>
      )
    },
    {
      key: 'category',
      header: 'Category & Location',
      sortable: true,
      sortKey: 'category',
      width: 'w-44',
      cell: (p: any) => (
        <div className="space-y-1">
          <span title={p.category || '—'} className="text-xs font-bold text-slate-600 line-clamp-1">{p.category || '—'}</span>
          {p.deliveryLocation && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400">
              <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
              {p.deliveryLocation}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      sortKey: 'updatedAt',
      width: 'w-32',
      cell: (p: any) => (
        <span className="text-xs font-bold text-slate-500">
          {formatDateTime(p.updatedAt)}
        </span>
      )
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      width: 'w-32',
      cell: (p: any) => (
        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
          {isProcurementCancellable(p) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={e => handleOpenCancelModal(p, e)}
              title={p.statusGroup === 'pending_approval' ? 'Withdraw Request' : 'Cancel Procurement'}
              className="h-8 px-2.5 rounded-lg border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Ban className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">
                {p.statusGroup === 'pending_approval' ? 'Withdraw' : 'Cancel'}
              </span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={e => openDetail(p, e)}
            className="inline-flex h-8 min-w-[90px] items-center justify-center rounded-lg bg-blue-600 px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700 hover:shadow-md active:scale-95 transition-all duration-200 border-none cursor-pointer"
          >
            View Details
          </Button>
        </div>
      )
    }
  ], [sortKey, sortDir]);

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */

  if (detailOpen && selectedProcurement) {
    return (
      <>
        <ProcurementDetailView
          procurement={selectedProcurement}
          onBack={closeDetail}
          onGoTo={() => {
            closeDetail();
            router.push(resolveProcurementActionUrl(selectedProcurement));
          }}
          onCancel={p => handleOpenCancelModal(p || selectedProcurement)}
        />
        <CancelProcurementModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          procurement={procurementToCancel}
          onConfirm={handleConfirmCancel}
        />
      </>
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
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 px-4 sm:px-0">
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
        {/* <KpiCard
          icon={Clock}
          label="Pending"
          value={kpis.pendingApproval}
          loading={isKpisLoading}
          active={activeKpi === 'pending_approval'}
          onClick={() => handleKpiClick('pending_approval')}
          tone="amber"
          subtext="Awaiting review"
        /> */}
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
        {/* <KpiCard
          icon={Package}
          label="Est. Value"
          value={formatCurrency(kpis.totalValue)}
          loading={isKpisLoading}
          tone="purple"
          subtext="Aggregate budget"
        /> */}
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
            <DataTable
              data={pagedProcurements}
              columns={procurementColumns}
              keyExtractor={(p: any) => `${p.type}-${p.id}`}
              showSrNo={true}
              srNoHeader="Sr. No."
              minWidth="min-w-[950px]"
              sortKey={sortKey}
              sortDirection={sortDir}
              onSort={(field) => handleSort(field as SortKey)}
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50]}
              paginationLabel="procurements"
              onRowClick={(p) => openDetail(p)}
              rowClassName="group hover:bg-slate-50/70 transition-colors align-middle cursor-pointer"
            />
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

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {isProcurementCancellable(p) && (
                          <button
                            type="button"
                            onClick={e => handleOpenCancelModal(p, e)}
                            title={p.statusGroup === 'pending_approval' ? 'Withdraw Request' : 'Cancel Procurement'}
                            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-center text-xs font-bold text-rose-600 shadow-2xs hover:bg-rose-50 hover:border-rose-200 active:scale-95 transition-all duration-200 cursor-pointer"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span>{p.statusGroup === 'pending_approval' ? 'Withdraw' : 'Cancel'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={e => openDetail(p, e)}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#12335f] px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-[#0b2445] hover:shadow-md active:scale-95 transition-all duration-200 border-none cursor-pointer"
                        >
                          View Details
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ PAGINATION (Grid View) ═══ */}
          {viewMode === 'grid' && total > 0 && (
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
          )}
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

      <CancelProcurementModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        procurement={procurementToCancel}
        onConfirm={handleConfirmCancel}
      />
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
   PROCUREMENT DETAIL VIEW (Re-exported from ../components/ProcurementDetailView)
   ═══════════════════════════════════════════════ */
