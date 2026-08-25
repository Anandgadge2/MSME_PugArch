'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  ClipboardList,
  FileText,
  CheckSquare,
  Globe,
  MessageSquare,
  Award,
  Package,
  ShoppingCart,
  BarChart3,
  Filter,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Eye,
  Calendar,
  Search,
  Building2,
  MapPin,
  ClipboardCheck,
  Layers,
  ShieldCheck,
  Clock,
  X,
  SlidersHorizontal,
  IndianRupee,
  Tag,
  Sparkles
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapApiData } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';
import {
  EmptyState,
  ProcurementStatusBadge,
  BuyerTypeBadge,
  MethodBadge,
  SectionCard
} from '../../procurementWizard/components/SourcingWizardComponents';
import { KpiCard } from '../../shared/KpiCard';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import { Pagination } from '../../shared/Pagination';
import { usePagination } from '../../shared/hooks';

interface NormalizedProcurement {
  id: number;
  type: string;
  typeLabel: string;
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
  startDate?: string;
  endDate?: string;
  quantity?: string;
  unit?: string;
  organizationName?: string;
  responsesCount?: number;
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

const formatCurrency = (val: number) => {
  if (!val) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return value;
  }
};

export default function BuyerProcurementHub() {
  const { token, user } = useAuth();
  const router = useRouter();
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]) as Record<string, string>;

  // Detect buyer type workflow
  const buyerType = useMemo<'PRIVATE_BUYER' | 'GOVERNMENT_BUYER' | null>(() => {
    if (!user) return null;
    const u = user as any;
    const orgType = u?.buyerProfile?.organizationType || u?.organization?.organizationType || u?.organizationType || '';
    if (!orgType) return null;
    const isGov = String(orgType).toUpperCase().includes('GOVT') ||
      String(orgType).toUpperCase().includes('GOVERNMENT') ||
      String(orgType).toUpperCase().includes('MINISTRY') ||
      String(orgType).toUpperCase().includes('DEPT') ||
      String(orgType).toUpperCase().includes('PSU');
    return isGov ? 'GOVERNMENT_BUYER' : 'PRIVATE_BUYER';
  }, [user]);

  // Filters state
  const [activePreset, setActivePreset] = useState<'all' | 'pending_approval' | 'published' | 'drafts' | 'awarded'>('all');
  const [buyerTypeFilter, setBuyerTypeFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [valueRangeFilter, setValueRangeFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch unified summary metrics
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['buyer-procurement-hub-summary'],
    queryFn: async () => {
      const res = await api.fetch('/api/dashboard/summary', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch summary');
      const json = await res.json();
      return unwrapApiData<any>(json);
    },
    enabled: !!token,
    staleTime: 30000
  });

  // Fetch procurements list
  const { data: listResponse, isLoading: isListLoading, refetch: refetchList } = useQuery({
    queryKey: ['buyer-procurement-hub-list', buyerTypeFilter, methodFilter, statusFilter, categoryFilter, departmentFilter, startDateFilter, endDateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (methodFilter) params.set('method', methodFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (departmentFilter) params.set('department', departmentFilter);
      if (startDateFilter) params.set('startDate', startDateFilter);
      if (endDateFilter) params.set('endDate', endDateFilter);

      const res = await api.fetch(`/api/buyer/my-procurements?${params.toString()}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch procurements');
      const json = await res.json();
      return unwrapApiData<any>(json);
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const allProcurements = useMemo<NormalizedProcurement[]>(() => {
    return listResponse?.procurements || [];
  }, [listResponse]);

  // Dynamic available categories & departments extracted from data
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    allProcurements.forEach(p => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    ['Office Supplies & Stationery', 'IT Hardware & Software', 'Raw Materials', 'Consultancy & AMC Services', 'Industrial Machinery', 'Electrical & Electronics'].forEach(c => set.add(c));
    return Array.from(set).sort();
  }, [allProcurements]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    allProcurements.forEach(p => {
      if (p.organizationName && p.organizationName.trim()) set.add(p.organizationName.trim());
    });
    return Array.from(set).sort();
  }, [allProcurements]);

  // Dynamic preset counts
  const presetCounts = useMemo(() => {
    return {
      all: allProcurements.length,
      pending_approval: allProcurements.filter(p => p.statusGroup === 'pending_approval' || p.status === 'PENDING_APPROVAL').length,
      published: allProcurements.filter(p => ['published', 'open', 'active'].includes(String(p.status).toLowerCase()) || p.statusGroup === 'active').length,
      drafts: allProcurements.filter(p => p.statusGroup === 'draft' || String(p.status).toLowerCase().includes('draft')).length,
      awarded: allProcurements.filter(p => String(p.status).toUpperCase() === 'AWARDED' || p.statusGroup === 'awarded' || String(p.status).toUpperCase() === 'COMPLETED' || p.type === 'rate_contract').length,
    };
  }, [allProcurements]);

  // Unified frontend filtering
  const filteredProcurements = useMemo(() => {
    let list = [...allProcurements];

    // Presets
    if (activePreset === 'pending_approval') {
      list = list.filter(p => p.statusGroup === 'pending_approval' || p.status === 'PENDING_APPROVAL');
    } else if (activePreset === 'published') {
      list = list.filter(p => ['published', 'open', 'active'].includes(String(p.status).toLowerCase()) || p.statusGroup === 'active');
    } else if (activePreset === 'drafts') {
      list = list.filter(p => p.statusGroup === 'draft' || String(p.status).toLowerCase().includes('draft'));
    } else if (activePreset === 'awarded') {
      list = list.filter(p => String(p.status).toUpperCase() === 'AWARDED' || p.statusGroup === 'awarded' || String(p.status).toUpperCase() === 'COMPLETED' || p.type === 'rate_contract');
    }

    // Buyer type
    if (buyerTypeFilter) {
      list = list.filter(p => {
        const isGovType = (p.typeLabel || '').toLowerCase().includes('bid') ||
                          (p.type || '').toLowerCase().includes('bid') ||
                          (p.method || '').toLowerCase().includes('tender') ||
                          (p.type || '').toLowerCase().includes('tender');
        if (buyerTypeFilter === 'GOVERNMENT') return isGovType;
        if (buyerTypeFilter === 'PRIVATE') return !isGovType;
        return true;
      });
    }

    // Method filter
    if (methodFilter) {
      const mf = methodFilter.toLowerCase().replace(/_/g, '-');
      list = list.filter(p => {
        const pMethod = (p.method || '').toLowerCase().replace(/_/g, '-');
        const pMethodLabel = (p.methodLabel || '').toLowerCase();
        return pMethod === mf || pMethodLabel.includes(mf.replace(/-/g, ' ')) || pMethodLabel.replace(/\s+/g, '_') === methodFilter.toLowerCase();
      });
    }

    // Status filter
    if (statusFilter) {
      const sf = statusFilter.toLowerCase();
      list = list.filter(p => {
        const pStatusGroup = (p.statusGroup || '').toLowerCase();
        const pStatus = (p.status || '').toLowerCase();
        if (pStatusGroup === sf || pStatus === sf) return true;
        if (sf === 'published' || sf === 'open' || sf === 'active') {
          return pStatusGroup === 'active' || pStatus === 'published' || pStatus === 'open' || pStatus === 'active';
        }
        if (sf === 'evaluation' || sf === 'in_evaluation') {
          return pStatusGroup === 'active' || pStatus.includes('eval');
        }
        if (sf === 'awarded' || sf === 'completed') {
          return pStatusGroup === 'completed' || pStatus === 'awarded' || pStatus === 'completed' || pStatus === 'converted_to_order';
        }
        return false;
      });
    }

    // Category filter
    if (categoryFilter) {
      const cat = categoryFilter.toLowerCase();
      list = list.filter(p => (p.category || '').toLowerCase().includes(cat));
    }

    // Department filter
    if (departmentFilter) {
      const dept = departmentFilter.toLowerCase();
      list = list.filter(p => (p.organizationName || '').toLowerCase().includes(dept));
    }

    // Value Range filter
    if (valueRangeFilter) {
      if (valueRangeFilter === 'UNDER_1L') {
        list = list.filter(p => (p.estimatedValue || 0) < 100000);
      } else if (valueRangeFilter === '1L_10L') {
        list = list.filter(p => (p.estimatedValue || 0) >= 100000 && (p.estimatedValue || 0) <= 1000000);
      } else if (valueRangeFilter === '10L_1CR') {
        list = list.filter(p => (p.estimatedValue || 0) > 1000000 && (p.estimatedValue || 0) <= 10000000);
      } else if (valueRangeFilter === 'ABOVE_1CR') {
        list = list.filter(p => (p.estimatedValue || 0) > 10000000);
      }
    }

    // Date From
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      start.setHours(0, 0, 0, 0);
      list = list.filter(p => {
        const itemDate = p.createdAt ? new Date(p.createdAt) : null;
        return itemDate && itemDate >= start;
      });
    }

    // Date To
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      end.setHours(23, 59, 59, 999);
      list = list.filter(p => {
        const itemDate = p.createdAt ? new Date(p.createdAt) : null;
        return itemDate && itemDate <= end;
      });
    }

    // Unified Search
    if (searchQuery) {
      const query = searchQuery.trim().toLowerCase();
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(query) ||
        (p.referenceNumber || '').toLowerCase().includes(query) ||
        (p.category || '').toLowerCase().includes(query) ||
        (p.organizationName || '').toLowerCase().includes(query) ||
        (p.methodLabel || '').toLowerCase().includes(query) ||
        (p.statusLabel || '').toLowerCase().includes(query) ||
        String(p.id).includes(query)
      );
    }

    return list;
  }, [allProcurements, activePreset, buyerTypeFilter, methodFilter, statusFilter, categoryFilter, departmentFilter, valueRangeFilter, startDateFilter, endDateFilter, searchQuery]);

  const hasActiveFilters = useMemo(() => {
    return !!(
      activePreset !== 'all' ||
      buyerTypeFilter ||
      methodFilter ||
      statusFilter ||
      departmentFilter ||
      categoryFilter ||
      valueRangeFilter ||
      startDateFilter ||
      endDateFilter ||
      searchQuery
    );
  }, [activePreset, buyerTypeFilter, methodFilter, statusFilter, departmentFilter, categoryFilter, valueRangeFilter, startDateFilter, endDateFilter, searchQuery]);

  const clearAllFilters = () => {
    setActivePreset('all');
    setBuyerTypeFilter('');
    setMethodFilter('');
    setStatusFilter('');
    setDepartmentFilter('');
    setCategoryFilter('');
    setValueRangeFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setSearchQuery('');
  };

  type HubSortKey = 'referenceNumber' | 'title' | 'method' | 'buyerType' | 'category' | 'estimatedValue' | 'status' | 'createdAt' | 'endDate' | 'responsesCount' | 'statusGroup';
  const [sortKey, setSortKey] = useState<HubSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const handleSort = (key: HubSortKey) => {
    setSortDir(prev => sortKey === key && prev === 'asc' ? 'desc' : 'asc');
    setSortKey(key);
    setPage(1);
  };

  const sortedProcurements = useMemo(() => {
    return [...filteredProcurements].sort((a, b) => {
      let va: any = '';
      let vb: any = '';
      if (sortKey === 'referenceNumber') {
        va = a.referenceNumber || `REF-${a.id}`;
        vb = b.referenceNumber || `REF-${b.id}`;
      } else if (sortKey === 'title') {
        va = a.title || '';
        vb = b.title || '';
      } else if (sortKey === 'method') {
        va = a.methodLabel || a.method || '';
        vb = b.methodLabel || b.method || '';
      } else if (sortKey === 'buyerType') {
        va = a.typeLabel || a.type || '';
        vb = b.typeLabel || b.type || '';
      } else if (sortKey === 'category') {
        va = a.category || '';
        vb = b.category || '';
      } else if (sortKey === 'estimatedValue') {
        va = Number(a.estimatedValue || 0);
        vb = Number(b.estimatedValue || 0);
      } else if (sortKey === 'status') {
        va = a.status || '';
        vb = b.status || '';
      } else if (sortKey === 'createdAt') {
        va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (sortKey === 'endDate') {
        const dateA = a.endDate || a.startDate;
        const dateB = b.endDate || b.startDate;
        va = dateA ? new Date(dateA).getTime() : 0;
        vb = dateB ? new Date(dateB).getTime() : 0;
      } else if (sortKey === 'responsesCount') {
        va = Number(a.responsesCount || 0);
        vb = Number(b.responsesCount || 0);
      } else if (sortKey === 'statusGroup') {
        va = a.statusGroup || '';
        vb = b.statusGroup || '';
      }

      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const strA = String(va || '').toLowerCase();
      const strB = String(vb || '').toLowerCase();
      const res = strA.localeCompare(strB);
      return sortDir === 'asc' ? res : -res;
    });
  }, [filteredProcurements, sortDir, sortKey]);

  const {
    page,
    pageSize,
    pageItems: pagedProcurements,
    total,
    setPage,
    setPageSize
  } = usePagination(sortedProcurements, 10);

  const handleRefresh = () => {
    refetchSummary();
    refetchList();
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const totalCount = listResponse?.kpis?.totalProcurements ?? allProcurements.length;
    const activeCount = listResponse?.kpis?.active ?? allProcurements.filter(p => String(p.statusGroup).toLowerCase() === 'active').length;

    // Dynamic Awarded Value calculation
    const awardedProcurements = allProcurements.filter(p => 
      String(p.status).toUpperCase() === 'AWARDED' || 
      String(p.statusGroup).toLowerCase() === 'completed' ||
      String(p.statusGroup).toLowerCase() === 'awarded'
    );
    const awardedCount = awardedProcurements.length;
    const awardedSum = awardedProcurements.reduce((sum, p) => sum + (Number(p.estimatedValue) || 0), 0);
    
    const formatAwardedValue = (val: number) => {
      if (!val) return 'Rs. 0';
      if (val >= 10000000) { // 1 Crore
        return `Rs. ${(val / 10000000).toFixed(1)} Cr`;
      }
      if (val >= 100000) { // 1 Lakh
        return `Rs. ${(val / 100000).toFixed(1)} L`;
      }
      return `Rs. ${val.toLocaleString('en-IN')}`;
    };

    const pendingActions = (summary?.pendingApprovalsCount || 0) + (summary?.grnsToApproveCount || 0) + (listResponse?.kpis?.pendingApproval || 0);

    return [
      { label: 'Total Procurements', value: totalCount, change: `${activeCount} live in progress`, icon: FolderOpen, tone: 'indigo' },
      { label: 'Awarded Value', value: formatAwardedValue(awardedSum), change: `${awardedCount} award${awardedCount === 1 ? '' : 's'} granted`, icon: Award, tone: 'green' },
      { label: 'Pending Actions', value: pendingActions, change: 'Approvals & reviews pending', icon: CheckSquare, tone: 'amber' },
      { label: 'Active Purchase Orders', value: summary?.myActivePOsCount || 0, change: 'Sent to sellers', icon: ShoppingCart, tone: 'sky' },
    ];
  }, [allProcurements, listResponse?.kpis, summary]);

  // Sourcing Hub Stages / Phases list
  const sourcingPhases = useMemo(() => [
    {
      title: 'Phase 1: Sourcing Initialization',
      color: 'border-indigo-100 bg-indigo-50/10 text-indigo-900',
      dot: 'bg-indigo-500',
      cards: [
        {
          title: 'Create Procurement',
          description: 'Unified guided flow for RFQ, RFP, Open Tender, Limited Tender, Reverse Auction, Rate Contract, or Repeat Order.',
          href: '/buyer/procurement/create',
          cta: 'Create Sourcing Event',
          icon: PlusCircle,
          badge: 'Start Here',
          badgeColor: 'bg-[#12335f] text-white',
        },
        {
          title: 'My Procurements',
          description: 'View active sourcing requests, items, methods, and status details.',
          href: '/buyer/my-procurements',
          cta: 'View Requests',
          icon: ClipboardList,
        },
        {
          title: 'Drafts',
          description: 'Resume or modify saved sourcing templates and incomplete wizard states.',
          href: '/buyer/procurement/drafts',
          cta: 'Manage Drafts',
          icon: FileText,
          count: summary?.cartItemCount || 0,
        }
      ]
    },
    {
      title: 'Phase 2: Bid Evaluation & Award',
      color: 'border-amber-100 bg-amber-50/10 text-amber-900',
      dot: 'bg-amber-500',
      cards: [
        {
          title: 'Pending Approvals',
          description: 'Review and approve sourcing requests, budget checks and exemption justifications.',
          href: '/buyer/procurement/approvals',
          cta: 'Open Approvals Queue',
          icon: CheckSquare,
          count: summary?.pendingApprovalsCount || 0,
          highlight: true,
        },
        {
          title: 'Published Events',
          description: 'Live competitive bids, tenders, reverse auctions actively open for bidding.',
          href: '/buyer/tenders',
          cta: 'View Live Bids',
          icon: Globe,
        },
        {
          title: 'Supplier Responses',
          description: 'Review quotes, clarifying queries, and files submitted by sellers.',
          href: '/buyer/procurement/responses',
          cta: 'Analyze Responses',
          icon: MessageSquare,
          count: summary?.myRfqsCount || 0,
        },
        {
          title: 'Evaluations & Awards',
          description: 'Evaluate technical packets, score criteria matrices, and publish award notices.',
          href: '/buyer/tenders',
          cta: 'Technical / Price Eval',
          icon: Layers,
        }
      ]
    },
    {
      title: 'Phase 3: Fulfillment & Insights',
      color: 'border-emerald-100 bg-emerald-50/10 text-emerald-900',
      dot: 'bg-emerald-500',
      cards: [
        {
          title: 'Rate Contracts',
          description: 'Manage rate agreements, track utilization by supplier, and create call-off orders.',
          href: '/buyer/rate-contracts',
          cta: 'Manage Contracts',
          icon: ShieldCheck,
          badge: 'Live',
          badgeColor: 'bg-emerald-500 text-white',
        },
        {
          title: 'Purchase Orders',
          description: 'Create and dispatch purchase orders linked to successful sourcing events.',
          href: '/orders',
          cta: 'View POs list',
          icon: ShoppingCart,
          count: summary?.myActivePOsCount || 0,
        },
        {
          title: 'Reports & Analytics',
          description: 'MIS dashboards, procurement audit trail logs, and saving reports.',
          href: '/reports',
          cta: 'View Reports',
          icon: BarChart3,
        }
      ]
    }
  ], [summary]);

  return (
    <div className="mx-auto max-w-[1560px] space-y-6 px-4 pb-10 sm:px-6 lg:px-8">
      {/* Page Title Header */}
      <div className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_20%_20%,#24457c_0,#0b132b_42%,#081327_100%)] p-7 text-white shadow-[0_18px_55px_rgba(15,23,42,0.18)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-[28px]">
        {/* Glow ambient effect */}
        <div className="absolute right-[-10%] top-[-20%] h-96 w-96 rounded-full bg-blue-600/15 blur-[100px] pointer-events-none" />
        <div className="absolute left-[30%] bottom-[-50%] h-64 w-64 rounded-full bg-[#12335f]/30 blur-[80px] pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#a5c2f4] mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
            Control Center
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white">Procurement Command Center</h1>
          
          {/* Buyer Type Badging & Custom Helper Text */}
          {buyerType === 'PRIVATE_BUYER' ? (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                Supports corporate sourcing workflows (RFQ, RFP, Open Tender, Limited Tender, Reverse Auction, Rate Contracts, Vendor comparison sheets, and internal approval flows).
              </p>
            </div>
          ) : buyerType === 'GOVERNMENT_BUYER' ? (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                Supports public procurement workflows (Open Tender, Limited Tender, Reverse Auction, compliance document auditing, and approval workflows).
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-300 font-semibold mt-2">
              Supports private and government procurement workflows.
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 sm:self-center relative z-10">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-10 rounded-full border-white/20 bg-white/10 px-4 text-white hover:bg-white/15 hover:text-white text-[10px] font-black uppercase tracking-wider shadow-2xs transition-all">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh Data
          </Button>
          <Link href="/buyer/procurement/create">
            <Button size="sm" className="h-10 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-4 text-slate-950 hover:from-amber-400 hover:to-amber-500 border-0 font-black text-[10px] uppercase tracking-wider shadow-md transition-all duration-200">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Create Procurement
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, idx) => (
          <KpiCard
            key={idx}
            label={kpi.label}
            value={kpi.value}
            subtext={kpi.change}
            icon={kpi.icon}
            tone={kpi.tone}
            loading={isSummaryLoading}
          />
        ))}
      </div>

      {/* Modern Sourcing Filters & Controls Panel */}
      <Card className="overflow-hidden rounded-[24px] border-0 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
        <CardContent className="space-y-4 p-5">
          {/* Header Row & Quick Presets */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#12335f]/10 text-[#12335f]">
                <Filter className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-[#12335f] flex items-center gap-2">
                  Filters & Controls
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 normal-case">
                    Showing {filteredProcurements.length} of {allProcurements.length}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Filter by method, status, department, value, or date range</p>
              </div>
            </div>

            {/* Quick Filter Presets Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Procurements', count: presetCounts.all },
                { id: 'pending_approval', label: 'Pending Approval', count: presetCounts.pending_approval },
                { id: 'published', label: 'Live / Published', count: presetCounts.published },
                { id: 'drafts', label: 'Drafts', count: presetCounts.drafts },
                { id: 'awarded', label: 'Awarded & Contracts', count: presetCounts.awarded },
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setActivePreset(preset.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] font-bold transition-all duration-200",
                    activePreset === preset.id
                      ? "border-[#12335f] bg-[#12335f] text-white shadow-xs"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                  )}
                >
                  <span>{preset.label}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.2 text-[9px] font-extrabold",
                    activePreset === preset.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  )}>
                    {preset.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Filter Inputs Grid */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 text-xs font-semibold text-slate-700">
            {/* Sourcing Method */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Sourcing Method</label>
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#12335f]/20 focus:border-[#12335f] transition-all"
              >
                <option value="">All Sourcing Methods</option>
                <option value="rfq">RFQ (Request for Quotation)</option>
                <option value="rfp">RFP (Request for Proposal)</option>
                <option value="open-tender">Open Tender</option>
                <option value="limited-tender">Limited Tender</option>
                <option value="reverse-auction">Reverse Auction</option>
                <option value="rate-contract">Rate Contract</option>
                <option value="repeat-order">Repeat Order</option>
                <option value="direct-purchase">Direct Purchase</option>
              </select>
            </div>

            {/* Sourcing Status */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Sourcing Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="published">Published / Open</option>
                <option value="evaluation">Technical Evaluation</option>
                <option value="awarded">Awarded</option>
                <option value="completed">Completed / Order Created</option>
                <option value="cancelled">Cancelled / Rejected</option>
              </select>
            </div>

            {/* Est. Financial Value Range */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Est. Value Range</label>
              <select
                value={valueRangeFilter}
                onChange={e => setValueRangeFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
              >
                <option value="">All Values</option>
                <option value="UNDER_1L">Under ₹1 Lakh (&lt; ₹1L)</option>
                <option value="1L_10L">₹1 Lakh – ₹10 Lakh</option>
                <option value="10L_1CR">₹10 Lakh – ₹1 Crore</option>
                <option value="ABOVE_1CR">Above ₹1 Crore (&gt; ₹1Cr)</option>
              </select>
            </div>

            {/* Buying Department */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Buying Department</label>
              {availableDepartments.length > 0 ? (
                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {availableDepartments.map((dept, idx) => (
                    <option key={idx} value={dept}>{dept}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 transition-all shadow-inner"
                  placeholder="Department name..."
                />
              )}
            </div>

            {/* Item Category */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Item Category</label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
              >
                <option value="">All Categories</option>
                {availableCategories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Date From & Date To */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Date From</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={e => setStartDateFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Date To</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={e => setEndDateFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs"
                />
              </div>
            </div>
          </div>
          
          {/* Bottom Controls Bar: Search & Active Filters */}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-8 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                placeholder="Search by Title, Ref Number, ID, Category, or Department..."
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-10 rounded-xl text-rose-600 border-rose-200 bg-rose-50/60 hover:bg-rose-100 font-extrabold text-xs uppercase tracking-wider transition-all"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sourcing Hub Lifecycle Columns */}
      <div className="grid gap-5 lg:grid-cols-3">
        {sourcingPhases.map((phase, pIdx) => (
          <div key={pIdx} className="space-y-3 rounded-[28px] bg-slate-50/70 p-3 ring-1 ring-slate-200/70">
            <div className={cn("flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black uppercase tracking-wider", phase.color)}>
              <span className={cn("h-2 w-2 rounded-full", phase.dot)} />
              {phase.title}
            </div>
            <div className="space-y-3">
              {phase.cards.map((card, cIdx) => {
                const Icon = card.icon;
                return (
                  <Card
                    key={cIdx}
                    className={cn(
                       "group relative flex flex-col justify-between overflow-hidden rounded-[22px] border-0 bg-white/95 shadow-none ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(15,23,42,0.08)]",
                       card.highlight ? "ring-1.5 ring-amber-500/40" : ""
                     )}
                  >
                    {/* Premium Top Line Accent */}
                    <div className={cn(
                       "absolute left-0 top-0 bottom-0 w-1",
                      card.highlight
                        ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300"
                        : "bg-gradient-to-r from-[#12335f]/40 to-slate-200/20"
                    )} />

                    <CardContent className="relative z-10 flex h-full min-h-[150px] flex-col justify-between p-4.5">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 border border-slate-100 text-[#12335f] transition-all duration-300 group-hover:scale-105 group-hover:bg-[#12335f] group-hover:text-white group-hover:border-transparent shadow-3xs">
                            <Icon className="h-4.5 w-4.5" />
                          </span>
                          <div className="flex items-center gap-1.5">
                            {card.badge && (
                              <span className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${card.badgeColor}`}>
                                {card.badge}
                              </span>
                            )}
                            {card.count !== undefined && card.count > 0 && (
                              <span className="h-5 min-w-[20px] px-1.5 flex items-center justify-center bg-amber-500 text-white rounded-full text-[10px] font-black">
                                {card.count}
                              </span>
                            )}
                          </div>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide group-hover:text-[#12335f] transition-colors">{card.title}</h3>
                        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-1.5">{card.description}</p>
                      </div>
                      <Link href={card.href} className="mt-4 flex items-center justify-between rounded-full bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 transition-all duration-300 group-hover:bg-[#12335f] group-hover:text-white">
                        <span>{card.cta || 'Open List'}</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Procurement Command Center Data List / Table */}
      <SectionCard
        title={`Procurement Requests (${filteredProcurements.length})`}
        description="Unified command list for auditing and resuming sourcing activities."
        icon={ClipboardList}
        className="rounded-[24px] border-0 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70"
      >
        {isListLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white p-4 shadow-2xs">
                <Skeleton className="h-4 w-28 shrink-0" />
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                <Skeleton className="h-4 w-24 shrink-0" />
                <Skeleton className="h-4 w-20 shrink-0" />
                <Skeleton className="h-8 w-20 rounded-xl shrink-0" />
              </div>
            ))}
          </div>
        ) : filteredProcurements.length === 0 ? (
          <EmptyState
            title="No Matching Procurements Found"
            description={
              hasActiveFilters
                ? "No procurement records match your selected filter criteria. Try adjusting or clearing your filters."
                : buyerType === 'PRIVATE_BUYER'
                ? "No corporate RFQ, RFP, or rate contracts available. Start a new procurement event using the guided sourcing setup."
                : "No government bids, tenders, or direct purchases found. Click below to initialize a guided compliant workflow."
            }
            actionText={hasActiveFilters ? "Reset Filters" : "Create Sourcing Event"}
            onAction={() => {
              if (hasActiveFilters) {
                clearAllFilters();
              } else {
                router.push('/buyer/procurement/create');
              }
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-[20px] bg-slate-50/70 p-2">
              <table className="w-full min-w-[1120px] border-separate border-spacing-y-2 text-left text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Procurement Number</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Title</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Method</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Buyer Type</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Category</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Estimated Value</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Status</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Created Date</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Deadline</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Responses</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500">Approval Status</th>
                  <th className="px-4 py-2 font-black uppercase text-slate-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-medium text-slate-700">
                {filteredProcurements.map(p => {
                  const isRowGov = p.typeLabel.toLowerCase().includes('bid') || p.type.toLowerCase().includes('bid') || p.method.toLowerCase().includes('tender') || p.type.toLowerCase().includes('tender');
                  const isDraft = p.statusGroup === 'draft' || p.status.toLowerCase().includes('draft');
                  const finalActionUrl = resolveProcurementActionUrl(p);

                    return (
                      <tr key={`${p.type}-${p.id}`} className="group bg-white shadow-3xs transition hover:shadow-sm">
                        <td className="max-w-[120px] truncate rounded-l-2xl px-4 py-3.5 font-bold text-slate-900">
                          {p.referenceNumber || `REF-${p.id}`}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-900 max-w-[200px]">
                          <span className="line-clamp-1 truncate block">{p.title}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <MethodBadge method={p.methodLabel || p.method} />
                        </td>
                        <td className="px-4 py-3.5">
                          <BuyerTypeBadge buyerType={isRowGov ? 'GOVERNMENT_BUYER' : 'PRIVATE_BUYER'} />
                        </td>
                        <td className="px-4 py-3.5 truncate max-w-[120px] text-slate-500">
                          {p.category || '—'}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-950 tabular-nums">
                          {formatCurrency(p.estimatedValue)}
                        </td>
                        <td className="px-4 py-3.5">
                          <ProcurementStatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {formatDateTime(p.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {formatDateTime(p.endDate || p.startDate)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-950 font-bold tabular-nums text-center">
                          {p.responsesCount ?? 0}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] uppercase font-bold border",
                            p.statusGroup === 'draft' ? "bg-slate-100 border-slate-200 text-slate-700" :
                            p.statusGroup === 'pending_approval' ? "bg-amber-100 border-amber-250 text-amber-800" :
                            "bg-emerald-100 border-emerald-200 text-emerald-800"
                          )}>
                            {p.statusGroup.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="shrink-0 rounded-r-2xl px-4 py-3.5 text-right">
                          <Link href={finalActionUrl}>
                            <Button
                              size="sm"
                              className="h-7 rounded-full bg-[#12335f] px-3 text-[10px] font-black uppercase tracking-wide text-white hover:bg-[#0f2a4f]"
                            >
                              <Eye className="h-3 w-3 mr-1" /> {isDraft ? 'Resume' : 'View'}
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
      </SectionCard>
    </div>
  );
}
