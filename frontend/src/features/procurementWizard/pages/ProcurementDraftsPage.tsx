'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Building2,
  ClipboardCheck,
  ArrowRight,
  ArrowUpDown,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Search,
  Filter,
  XCircle,
  Database,
  Monitor,
  Gavel,
  ShoppingCart,
  ClipboardList,
  Eye,
  X,
  Tag,
  IndianRupee,
  CalendarDays,
  MapPin,
  Info,
  Layers,
  Package,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../lib/utils';
import { procurementWizardApi, fetchProcurementDrafts, deleteProcurementDraft } from '../api';
import { bidWizardApi } from '../../bidCreationWizardV2/api';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { useResponsiveViewMode, usePagination } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { formatDate } from '../../shared/format';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';



/* ─── Method Config Map ─── */
const METHOD_CONFIGS_MAP: Record<string, { title: string; accent: string; icon: React.ElementType }> = {
  'direct-purchase': { title: 'Cart Checkout', accent: 'border-emerald-200 bg-emerald-50/80 text-emerald-700', icon: ShoppingCart },
  'l1-comparison': { title: 'RFQ', accent: 'border-blue-200 bg-blue-50/80 text-blue-700', icon: FileText },
  'rfq': { title: 'RFQ', accent: 'border-blue-200 bg-blue-50/80 text-blue-700', icon: FileText },
  'rfi': { title: 'RFI', accent: 'border-cyan-200 bg-cyan-50/80 text-cyan-700', icon: ClipboardList },
  'tender': { title: 'OpenTender', accent: 'border-amber-200 bg-amber-50/80 text-amber-700', icon: Gavel },
  'open-tender': { title: 'OpenTender', accent: 'border-amber-200 bg-amber-50/80 text-amber-700', icon: Gavel },
  'reverse-auction': { title: 'Reverse Auction', accent: 'border-violet-200 bg-violet-50/80 text-violet-700', icon: TrendingUp },
  'boq': { title: 'OpenTender', accent: 'border-amber-200 bg-amber-50/80 text-amber-700', icon: Gavel },
  'custom-product': { title: 'RFQ', accent: 'border-blue-200 bg-blue-50/80 text-blue-700', icon: Package },
  'custom-service': { title: 'RFQ', accent: 'border-blue-200 bg-blue-50/80 text-blue-700', icon: Layers },
  'pac': { title: 'Limited Tender', accent: 'border-orange-200 bg-orange-50/80 text-orange-700', icon: ShieldCheck },
  'rate-contract': { title: 'Rate Contract', accent: 'border-teal-200 bg-teal-50/80 text-teal-700', icon: Tag },
  'limited': { title: 'Limited Tender', accent: 'border-orange-200 bg-orange-50/80 text-orange-700', icon: ShieldCheck },
  'limited-tender': { title: 'Limited Tender', accent: 'border-orange-200 bg-orange-50/80 text-orange-700', icon: ShieldCheck },
  'limited_tender': { title: 'Limited Tender', accent: 'border-orange-200 bg-orange-50/80 text-orange-700', icon: ShieldCheck },
  'repeat-order': { title: 'Repeat order', accent: 'border-purple-200 bg-purple-50/80 text-purple-700', icon: RefreshCw },
  'draft': { title: 'Draft', accent: 'border-slate-200 bg-slate-50/80 text-slate-700', icon: FileText },
};

/* ─── Types ─── */
interface DisplayDraft {
  id?: number;
  uniqueKey: string;
  title: string;
  procurementMethod?: string;
  canonicalMethod?: string;
  methodSlug: string;
  estimatedValue: number;
  updatedAt?: string;
  productOrService: string;
  categoryName: string;
  quantity: string;
  unit: string;
  deliveryLocation: string;
  requiredDeliveryDate: string;
  specifications: string;
  specificationDocumentName: string;
  isLocal: boolean;
  /** True once the draft was submitted/published — kept in the list as history. */
  isPublished?: boolean;
  raw: any;
}

type SortKey = 'title' | 'methodSlug' | 'estimatedValue' | 'updatedAt' | 'categoryName';
type SortDir = 'asc' | 'desc';

/* ─── Helpers ─── */
const formatDateTime = (value?: string) => {
  if (!value) return 'Not saved yet';
  try {
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', hour12: true });
  } catch {
    return value;
  }
};

const formatCurrency = (v: number) => v ? `₹${v.toLocaleString('en-IN')}` : '-';

const cleanTitle = (rawTitle: string): string => {
  if (!rawTitle) return '';
  return rawTitle.replace(/\s+#\d+$/, '');
};

const mapLocalDraftToDisplay = (local: any): DisplayDraft | null => {
  if (!local) return null;
  const item = local.items?.[0];
  const doc = local.documents?.[0];
  const hasContent = Boolean(
    local.basics?.title?.trim() ||
    local.items?.some((i: any) => i.name?.trim()) ||
    local.basics?.category?.trim() ||
    local.basics?.justification?.trim() ||
    local.basics?.estimatedValue
  );
  if (!hasContent) return null;
  return {
    id: local.id ? Number(local.id) : undefined,
    uniqueKey: local.id ? `local-${local.id}` : 'local',
    title: cleanTitle(local.basics?.title || 'Untitled Local Draft'),
    procurementMethod: undefined,
    canonicalMethod: local.type?.toUpperCase?.().replace(/-/g, '_'),
    methodSlug: local.type || 'rfq',
    estimatedValue: Number(local.basics?.estimatedValue || 0),
    updatedAt: local.updatedAt || new Date().toISOString(),
    productOrService: item?.name || '',
    categoryName: local.basics?.category || '',
    quantity: item?.quantity?.toString() || '',
    unit: item?.unit || '',
    deliveryLocation: local.tender?.deliveryLocation || local.basics?.deliveryLocation || '',
    requiredDeliveryDate: local.schedule?.deliveryDate || '',
    specifications: item?.specification || local.basics?.justification || '',
    specificationDocumentName: doc?.fileName || '',
    isLocal: true,
    raw: local,
  };
};

const mapServerDraftToDisplay = (server: any): DisplayDraft => {
  const payload = server.payload || {};
  const firstItem = server.items?.[0];
  const payloadItem = payload.items?.[0];
  const payloadDoc = payload.documents?.[0];
  return {
    id: server.id,
    uniqueKey: server.payload?.isV2 ? `v2-${server.id}` : `v1-${server.id}`,
    title: cleanTitle(server.title || payload.basics?.title || 'Untitled Draft'),
    procurementMethod: server.procurementMethod,
    canonicalMethod: server.canonicalMethod || payload.fullProcurementMethod || payload.type,
    methodSlug: server.methodSlug || payload.type || 'rfq',
    estimatedValue: Number(server.estimatedValue || payload.basics?.estimatedValue || 0),
    updatedAt: server.updatedAt,
    productOrService: firstItem?.itemName || payloadItem?.name || '',
    categoryName: server.category?.name || payload.basics?.category || '',
    quantity: firstItem?.quantity?.toString() || payloadItem?.quantity?.toString() || '',
    unit: firstItem?.unitOfMeasure || payloadItem?.unit || '',
    deliveryLocation: payload.tender?.deliveryLocation || payload.basics?.deliveryLocation || '',
    requiredDeliveryDate: server.requiredBy || payload.schedule?.deliveryDate || '',
    specifications: firstItem?.description || payloadItem?.specification || payload.basics?.justification || server.description || '',
    specificationDocumentName: payloadDoc?.fileName || '',
    isLocal: false,
    isPublished: Boolean(server.isPublished),
    raw: server,
  };
};

function DraftsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] bg-white/95 shadow-sm ring-1 ring-slate-200/70 p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
          <Skeleton className="h-4 w-8 shrink-0" />
          <Skeleton className="h-6 w-28 rounded-md shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-20 shrink-0" />
          <Skeleton className="h-4 w-24 shrink-0" />
          <Skeleton className="h-8 w-36 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
}

function DraftsGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-4/5 rounded-md" />
            <Skeleton className="h-3.5 w-1/2 rounded-md" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <Skeleton className="h-8 w-1/2 rounded-xl" />
            <Skeleton className="h-8 w-1/2 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════ */

export default function ProcurementDraftsPage() {
  const router = useRouter();
  const [localDraft, setLocalDraft] = useState<any | null>(() => procurementWizardApi.loadLocalDraft());
  const [serverDrafts, setServerDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDraftKey, setSelectedDraftKey] = useState<string | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  const openDetail = (d: DisplayDraft, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDraftKey(d.uniqueKey);
    setDetailOpen(true);
  };
  const closeDetail = () => {
    setDetailOpen(false);
  };
  const [viewMode, setViewMode] = useResponsiveViewMode('procurement-drafts:view-mode');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [activeKpi, setActiveKpi] = useState<string | null>(null);

  /* ── Data Loading ── */
  const loadAllDrafts = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const result = await fetchProcurementDrafts();
      const records = result?.drafts || result?.records || result?.data?.drafts || [];
      setServerDrafts(Array.isArray(records) ? records : []);
      setLocalDraft(procurementWizardApi.loadLocalDraft());
    } catch {
      toast.error('Failed to load drafts list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchProcurementDrafts()
      .then(result => {
        if (!active) return;
        const records = result?.drafts || result?.records || result?.data?.drafts || [];
        setServerDrafts(Array.isArray(records) ? records : []);
        setLocalDraft(procurementWizardApi.loadLocalDraft());
      })
      .catch(() => {
        if (active) toast.error('Failed to load drafts list');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /* ── Mapped & Sorted Drafts ── */
  const mappedLocal = useMemo(() => mapLocalDraftToDisplay(localDraft), [localDraft]);
  const mappedServers = useMemo(() => serverDrafts.map(mapServerDraftToDisplay), [serverDrafts]);

  const allDrafts = useMemo(() => {
    const list: DisplayDraft[] = [];
    const serverList = [...mappedServers];

    if (mappedLocal) {
      let finalLocal = mappedLocal;
      // Find a matching server draft
      const matchIdx = serverList.findIndex((s) => {
        // 1. Match by ID if both are available
        if (mappedLocal.id !== undefined && s.id !== undefined && mappedLocal.id === s.id) {
          return true;
        }
        // 2. Match by content similarity as a fallback
        const cleanLocalTitle = (mappedLocal.title || '').trim().toLowerCase();
        const cleanServerTitle = (s.title || '').trim().toLowerCase();
        return (
          cleanLocalTitle === cleanServerTitle &&
          mappedLocal.categoryName === s.categoryName &&
          mappedLocal.methodSlug === s.methodSlug &&
          mappedLocal.estimatedValue === s.estimatedValue
        );
      });

      if (matchIdx !== -1) {
        // Merge: Use the local draft (most up-to-date client edits) but bind the server's ID/metadata
        const matchedServer = serverList[matchIdx];
        finalLocal = {
          ...mappedLocal,
          id: matchedServer.id,
          uniqueKey: `local-${matchedServer.id}`,
        };
        // Remove the duplicate server draft from display
        serverList.splice(matchIdx, 1);
      }

      list.push(finalLocal);
    }

    list.push(...serverList);
    return list;
  }, [mappedLocal, mappedServers]);

  const kpiData = useMemo(() => {
    let local = 0;
    let server = 0;
    let directPurchase = 0;
    let l1Rfq = 0;
    let tenderBid = 0;
    let totalValue = 0;

    for (const d of allDrafts) {
      if (d.isLocal) local++;
      else server++;

      const slug = d.methodSlug?.toLowerCase() || '';
      if (slug === 'direct-purchase') {
        directPurchase++;
      } else if (slug === 'rfq' || slug === 'l1-comparison') {
        l1Rfq++;
      } else if (['tender', 'pac', 'boq', 'reverse-auction', 'custom-product', 'custom-service'].includes(slug)) {
        tenderBid++;
      }

      totalValue += d.estimatedValue || 0;
    }

    return {
      total: allDrafts.length,
      local,
      server,
      directPurchase,
      l1Rfq,
      tenderBid,
      totalValue,
    };
  }, [allDrafts]);

  const filteredDrafts = useMemo(() => {
    let list = [...allDrafts];

    if (activeKpi) {
      if (activeKpi === 'local') {
        list = list.filter(d => d.isLocal);
      } else if (activeKpi === 'server') {
        list = list.filter(d => !d.isLocal);
      } else if (activeKpi === 'direct-purchase') {
        list = list.filter(d => d.methodSlug === 'direct-purchase');
      } else if (activeKpi === 'l1-rfq') {
        list = list.filter(d => d.methodSlug === 'rfq' || d.methodSlug === 'l1-comparison');
      } else if (activeKpi === 'tender-bid') {
        list = list.filter(d => ['tender', 'pac', 'boq', 'reverse-auction', 'custom-product', 'custom-service'].includes(d.methodSlug));
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.productOrService || '').toLowerCase().includes(q) ||
        (d.categoryName || '').toLowerCase().includes(q)
      );
    }

    if (methodFilter) {
      if (methodFilter === 'tender-bid') {
        list = list.filter(d => ['tender', 'pac', 'boq', 'reverse-auction', 'custom-product', 'custom-service'].includes(d.methodSlug));
      } else if (methodFilter === 'l1-rfq') {
        list = list.filter(d => d.methodSlug === 'rfq' || d.methodSlug === 'l1-comparison');
      } else {
        list = list.filter(d => d.methodSlug === methodFilter);
      }
    }

    if (sourceFilter) {
      if (sourceFilter === 'local') {
        list = list.filter(d => d.isLocal);
      } else if (sourceFilter === 'server') {
        list = list.filter(d => !d.isLocal);
      }
    }

    return list;
  }, [allDrafts, activeKpi, searchQuery, methodFilter, sourceFilter]);

  const sortedDrafts = useMemo(() => {
    const sorted = [...filteredDrafts];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title': cmp = (a.title || '').localeCompare(b.title || ''); break;
        case 'methodSlug': cmp = (a.methodSlug || '').localeCompare(b.methodSlug || ''); break;
        case 'estimatedValue': cmp = (a.estimatedValue || 0) - (b.estimatedValue || 0); break;
        case 'updatedAt': cmp = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime(); break;
        case 'categoryName': cmp = (a.categoryName || '').localeCompare(b.categoryName || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredDrafts, sortKey, sortDir]);

  const { page, pageSize, pageItems: pagedDrafts, total, setPage, setPageSize } = usePagination(sortedDrafts, 10);

  /* ── Selection ── */
  const selectedDraftKeyValid = sortedDrafts.some(d => selectedDraftKey === d.uniqueKey);
  const activeSelectedDraftKey = selectedDraftKeyValid
    ? selectedDraftKey
    : (sortedDrafts[0]?.uniqueKey ?? undefined);

  if (selectedDraftKey !== activeSelectedDraftKey) {
    setSelectedDraftKey(activeSelectedDraftKey);
  }

  const selectedDraft = useMemo(
    () => allDrafts.find(d => activeSelectedDraftKey === d.uniqueKey),
    [allDrafts, activeSelectedDraftKey]
  );

  /* ── Actions ── */
  const discardLocal = () => {
    procurementWizardApi.clearLocalDraft();
    setLocalDraft(null);
    setSelectedDraftKey(undefined);
    toast.success('Local procurement draft discarded');
  };

  const discardServer = async (d: DisplayDraft) => {
    if (!d.id || deletingIds.includes(d.id)) return;
    setDeletingIds(prev => [...prev, d.id!]);
    try {
      if (d.raw?.payload?.isV2) {
        await bidWizardApi.deleteDraft(d.id!);
      } else {
        await deleteProcurementDraft(d.id!);
      }
      toast.success('Procurement draft deleted successfully');
      setSelectedDraftKey(undefined);
      await loadAllDrafts();
    } catch (err) {
      toast.error('Failed to delete draft: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeletingIds(prev => prev.filter(id => id !== d.id));
    }
  };

  const handleContinue = (d: DisplayDraft) => {
    if (d.isLocal) router.push('/buyer/procurement/create');
    else if (d.raw?.payload?.isV2) router.push(`/buyer/create-bid?draft=${d.id}`);
    else router.push(`/buyer/procurement/create?id=${d.id}`);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  /* ── Render Helpers ── */
  const methodBadge = (slug: string) => {
    const m = METHOD_CONFIGS_MAP[slug] || { title: slug, accent: 'border-slate-200 bg-slate-50 text-slate-700', icon: FileText };
    const Icon = m.icon;
    return (
      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide shadow-2xs', m.accent)}>
        <Icon className="h-3 w-3 shrink-0" />
        {m.title}
      </span>
    );
  };

  const sourceBadge = (isLocal: boolean, isPublished?: boolean, draftId?: number) => {
    if (isPublished) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-2xs">
          <Check className="h-3 w-3" /> Published
        </span>
      );
    }
    if (isLocal) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 shadow-2xs">
          <Monitor className="h-3 w-3" /> Local Cache
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 shadow-2xs">
        <Database className="h-3 w-3" /> {draftId ? `#D-${draftId}` : 'Server Draft'}
      </span>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════ */
  if (detailOpen && selectedDraft) {
    return (
      <DraftDetailView
        draft={selectedDraft}
        onBack={closeDetail}
        onContinue={() => handleContinue(selectedDraft)}
        onDiscard={() => {
          closeDetail();
          selectedDraft.isLocal ? discardLocal() : discardServer(selectedDraft);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Transparent Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f] bg-[#12335f]/10 px-2.5 py-1 rounded-full">Procurement</span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">Procurement Drafts</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Drafts from the guided Create Procurement module are saved both in this browser and on the server.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ViewModeToggle className="col-span-2 sm:col-span-1 flex justify-end" value={viewMode} onChange={setViewMode} />
          <Button type="button" variant="outline" onClick={() => loadAllDrafts()} disabled={loading} className="h-10 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border-slate-200 shadow-2xs cursor-pointer">
            <RefreshCw className={cn('mr-2 h-4 w-4 text-[#12335f]', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button
            type="button"
            onClick={() => router.push('/buyer/procurement')}
            className="h-10 bg-[#12335f] hover:bg-[#0b2445] text-xs font-bold text-white rounded-xl shadow-sm cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Procurement
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Drafts"
          value={kpiData.total}
          icon={ClipboardList}
          active={activeKpi === null}
          onClick={() => setActiveKpi(null)}
          color="blue"
        />
        <KpiCard
          label="Cart Checkouts"
          value={kpiData.directPurchase}
          icon={ShoppingCart}
          active={activeKpi === 'direct-purchase'}
          onClick={() => setActiveKpi('direct-purchase')}
          color="green"
        />
        <KpiCard
          label="RFQs"
          value={kpiData.l1Rfq}
          icon={FileText}
          active={activeKpi === 'l1-rfq'}
          onClick={() => setActiveKpi('l1-rfq')}
          color="indigo"
        />
        <KpiCard
          label="OpenTenders"
          value={kpiData.tenderBid}
          icon={Gavel}
          active={activeKpi === 'tender-bid'}
          onClick={() => setActiveKpi('tender-bid')}
          color="purple"
        />
        <KpiCard
          label="Est. Value"
          value={formatCurrency(kpiData.totalValue)}
          icon={IndianRupee}
          active={false}
          color="slate"
        />
      </div>

      {/* Inline Filters Bar */}
      <div className="border-y border-slate-200 bg-slate-50/50 py-3 px-1">
        <ResponsiveFilterBar
          activeFilterCount={(methodFilter ? 1 : 0) + (sourceFilter ? 1 : 0) + (activeKpi ? 1 : 0)}
          searchInput={
            <div className="relative min-w-0 w-full sm:flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search drafts by title, category, item..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
              />
            </div>
          }
          filters={
            <>
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="h-10 min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20 min-w-0 w-full sm:w-auto"
              >
                <option value="">All Types</option>
                <option value="direct-purchase">Cart Checkout</option>
                <option value="rfq">RFQ</option>
                <option value="tender">OpenTender</option>
                <option value="reverse-auction">Reverse Auction</option>
                <option value="rate-contract">Rate Contract</option>
                <option value="limited-tender">Limited Tender</option>
                <option value="repeat-order">Repeat order</option>
              </select>

              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="h-10 min-w-[140px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20 min-w-0 w-full sm:w-auto"
              >
                <option value="">All Sources</option>
                <option value="local">Local Drafts</option>
                <option value="server">Server Drafts</option>
              </select>

              {(searchQuery || methodFilter || sourceFilter || activeKpi) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setMethodFilter('');
                    setSourceFilter('');
                    setActiveKpi(null);
                  }}
                  className="h-10 border-red-200 text-xs font-black uppercase text-red-600 hover:bg-red-50"
                >
                  Clear
                </Button>
              )}
            </>
          }
        />

        {/* Active chips */}
        {(searchQuery || methodFilter || sourceFilter || activeKpi) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Active:</span>
            {activeKpi && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#12335f]/20 bg-[#12335f]/5 px-2.5 py-0.5 text-[10px] font-bold text-[#12335f]">
                KPI: {activeKpi.replace('-', ' ')}
                <button onClick={() => setActiveKpi(null)} className="ml-0.5 hover:text-red-600 font-bold">×</button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#12335f]/20 bg-[#12335f]/5 px-2.5 py-0.5 text-[10px] font-bold text-[#12335f]">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="ml-0.5 hover:text-red-600 font-bold">×</button>
              </span>
            )}
            {methodFilter && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#12335f]/20 bg-[#12335f]/5 px-2.5 py-0.5 text-[10px] font-bold text-[#12335f]">
                Method: {methodFilter === 'l1-rfq' ? 'L1 / RFQ' : methodFilter === 'tender-bid' ? 'Tender / Bid' : methodFilter}
                <button onClick={() => setMethodFilter('')} className="ml-0.5 hover:text-red-600 font-bold">×</button>
              </span>
            )}
            {sourceFilter && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#12335f]/20 bg-[#12335f]/5 px-2.5 py-0.5 text-[10px] font-bold text-[#12335f]">
                Source: {sourceFilter}
                <button onClick={() => setSourceFilter('')} className="ml-0.5 hover:text-red-600 font-bold">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        viewMode === 'list' ? <DraftsTableSkeleton /> : <DraftsGridSkeleton />
      ) : sortedDrafts.length > 0 ? (
        <div className="space-y-4">
          {/* ═══ LIST VIEW (Table) ═══ */}
          {viewMode === 'list' && (
            <section className="overflow-hidden rounded-[24px] bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70">
              <div className="overflow-x-auto bg-slate-50/70 p-2">
                <div className="overflow-x-auto w-full rounded-xl border border-slate-200 bg-white mb-6 shadow-sm">
                  <table data-ux-wrapped="true" className="w-full min-w-[950px] border-separate border-spacing-y-2 text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 w-[60px] text-center">Sr. No</th>
                      <ThCell sortKey="title" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Title</ThCell>
                      <ThCell sortKey="methodSlug" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Method</ThCell>
                      <ThCell sortKey="categoryName" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Category</ThCell>
                      <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Item / Service</th>
                      <ThCell sortKey="estimatedValue" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Est. Value</ThCell>
                      <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Qty</th>
                      <ThCell sortKey="updatedAt" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Last Updated</ThCell>
                      <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-wide text-slate-500 w-[220px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDrafts.map((d, idx) => {
                      const key = d.uniqueKey;
                      const isDeleting = !d.isLocal && deletingIds.includes(d.id!);
                      return (
                        <tr
                          key={key}
                          className="group cursor-pointer bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:shadow-md hover:-translate-y-0.5 hover:bg-slate-50/70 transition-all duration-300 ease-out"
                          onClick={() => openDetail(d)}
                        >
                          <td className="rounded-l-2xl px-4 py-3.5 text-center text-xs font-black text-slate-400">
                            {String((page - 1) * pageSize + idx + 1).padStart(2, '0')}
                          </td>
                          <td className="w-[240px] min-w-[200px] whitespace-normal break-words px-4 py-3.5 font-bold text-slate-900">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="group-hover:text-blue-600 transition-colors">{d.title}</span>
                              {sourceBadge(d.isLocal, d.isPublished, d.id)}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">{methodBadge(d.methodSlug)}</td>
                          <td className="px-4 py-3.5 text-slate-600 text-xs font-medium">{d.categoryName || '—'}</td>
                          <td className="max-w-[140px] truncate px-4 py-3.5 text-slate-600 text-xs font-medium">{d.productOrService || '—'}</td>
                          <td className="px-4 py-3.5 font-extrabold text-slate-900 tabular-nums text-xs">{formatCurrency(d.estimatedValue)}</td>
                          <td className="px-4 py-3.5 text-slate-600 tabular-nums text-xs font-medium">{[d.quantity, d.unit].filter(Boolean).join(' ') || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-slate-500">{formatDateTime(d.updatedAt)}</td>
                          <td className="rounded-r-2xl px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              {/* View Details */}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => openDetail(d, e)}
                                className="h-8 rounded-lg border-slate-200 bg-slate-50/80 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                                title="View Details"
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                                <span>View</span>
                              </Button>

                              {/* Discard / Delete */}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isDeleting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  d.isLocal ? discardLocal() : discardServer(d);
                                }}
                                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors shadow-2xs cursor-pointer flex items-center justify-center"
                                title={d.isLocal ? "Discard Local Draft" : "Delete Draft"}
                              >
                                {isDeleting ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>

                              {/* Continue Draft */}
                              {!d.isPublished && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleContinue(d);
                                  }}
                                  className="h-8 rounded-lg bg-[#12335f] px-3 text-xs font-bold text-white hover:bg-[#0b2445] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <span>Continue</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
</div>
              </div>
            </section>
          )}

          {/* ═══ GRID VIEW (Multi-Column Card Grid) ═══ */}
          {viewMode === 'grid' && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pagedDrafts.map((d) => {
                const isDeleting = !d.isLocal && deletingIds.includes(d.id!);
                return (
                  <div
                    key={d.uniqueKey}
                    onClick={() => openDetail(d)}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-[#12335f]/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out cursor-pointer"
                  >
                    <div className="space-y-3.5">
                      {/* Top row: Badges & Quick Discard */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {methodBadge(d.methodSlug)}
                          {sourceBadge(d.isLocal, d.isPublished, d.id)}
                        </div>

                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={(e) => {
                            e.stopPropagation();
                            d.isLocal ? discardLocal() : discardServer(d);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          title={d.isLocal ? "Discard Local Draft" : "Delete Draft"}
                        >
                          {isDeleting ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Title & Category */}
                      <div>
                        <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-2 group-hover:text-[#12335f] transition-colors">
                          {d.title || 'Untitled Draft'}
                        </h3>
                        {d.categoryName && (
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-500 line-clamp-1">
                            <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{d.categoryName}</span>
                          </p>
                        )}
                      </div>

                      {/* Product / Service or Spec preview */}
                      {(d.productOrService || d.specifications) && (
                        <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-2.5 text-xs text-slate-600 space-y-1">
                          {d.productOrService && (
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <Package className="h-3.5 w-3.5 text-[#12335f] shrink-0" />
                              <span className="truncate">{d.productOrService}</span>
                            </div>
                          )}
                          {d.specifications && (
                            <p className="text-[11px] text-slate-500 font-medium line-clamp-1 italic">
                              {d.specifications}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Commercial & Detail Grid */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50/50 p-3 border border-slate-100">
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Est. Value</p>
                          <p className="mt-0.5 text-sm font-black text-slate-900 tabular-nums">
                            {formatCurrency(d.estimatedValue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Quantity</p>
                          <p className="mt-0.5 text-xs font-extrabold text-slate-700 truncate">
                            {[d.quantity, d.unit].filter(Boolean).join(' ') || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Location</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-600 truncate">
                            {d.deliveryLocation || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Saved On</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500 truncate">
                            {formatDate(d.updatedAt || new Date().toISOString())}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => openDetail(d, e)}
                        className="h-8.5 rounded-xl border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer flex-1 flex items-center justify-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-500" />
                        <span>Details</span>
                      </Button>

                      {!d.isPublished ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContinue(d);
                          }}
                          className="h-8.5 rounded-xl bg-[#12335f] px-3.5 text-xs font-bold text-white hover:bg-[#0b2445] shadow-xs active:scale-95 transition-all cursor-pointer flex-1 flex items-center justify-center gap-1.5"
                        >
                          <span>Continue</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                            Published
                          </span>
                        </div>
                      )}
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
              label="drafts"
            />
          </div>
        </div>
      ) : (
        /* Empty State */
        <section className="rounded-[24px] border border-dashed border-slate-300 bg-white/95 p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#12335f] border border-blue-100">
            <FileText className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-black text-slate-950">No procurement drafts found</h2>
          <p className="mx-auto mt-2 max-w-xl text-xs font-semibold text-slate-500">
            {searchQuery || methodFilter || sourceFilter || activeKpi
              ? 'No drafts match the active search and filter criteria. Try clearing your filters.'
              : 'Start a Create Procurement process and click Save Draft. Your drafts will appear here for you to continue them at any time.'}
          </p>
          {searchQuery || methodFilter || sourceFilter || activeKpi ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setMethodFilter('');
                setSourceFilter('');
                setActiveKpi(null);
              }}
              className="mt-5 h-9 rounded-xl border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Clear All Filters
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => router.push('/buyer/procurement/create')}
              className="mt-5 h-10 rounded-xl bg-[#12335f] px-5 text-xs font-bold uppercase text-white hover:bg-[#0b2445] shadow-xs"
            >
              Create Procurement <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

/* ─── Draft Detail Dialog ─── */
function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2.5 sm:gap-3 py-2.5 border-b border-slate-100 last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800 break-words whitespace-pre-wrap">{value}</p>
      </div>
    </div>
  );
}

function DraftDetailDialog({
  draft: d,
  onClose,
  onContinue,
  onDelete,
}: {
  draft: DisplayDraft;
  onClose: () => void;
  onContinue: () => void;
  onDelete: () => void;
}) {
  // Close on Escape key
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2.5 sm:gap-3 border-b border-slate-200 bg-white px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {d.isLocal ? (
                <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                  Active local draft
                </span>
              ) : (
                <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                  Saved draft (#D-{d.id})
                </span>
              )}
              <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-700">
                {(METHOD_CONFIGS_MAP[d.methodSlug] || { title: d.methodSlug }).title}
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-950 leading-snug break-words">{d.title || 'Untitled Draft'}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          <DetailRow icon={ShoppingCart} label="Intent" value={(METHOD_CONFIGS_MAP[d.methodSlug] || { title: d.methodSlug }).title} />
          <DetailRow icon={Package} label="Item / Service" value={d.productOrService} />
          <DetailRow icon={Tag} label="Category" value={d.categoryName} />
          <DetailRow icon={IndianRupee} label="Estimated Value" value={d.estimatedValue ? formatCurrency(d.estimatedValue) : undefined} />
          <DetailRow icon={Layers} label="Quantity" value={[d.quantity, d.unit].filter(Boolean).join(' ') || undefined} />
          <DetailRow icon={MapPin} label="Delivery Location" value={d.deliveryLocation} />
          <DetailRow icon={CalendarDays} label="Required Date" value={d.requiredDeliveryDate ? formatDate(d.requiredDeliveryDate) : undefined} />
          <DetailRow icon={Info} label="Specifications snapshot" value={d.specifications} />
          {d.specificationDocumentName && (
            <DetailRow icon={FileText} label="Specification Document" value={d.specificationDocumentName} />
          )}
          <DetailRow icon={CalendarDays} label="Last Updated" value={formatDateTime(d.updatedAt)} />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => { onClose(); onDelete(); }}
            className="h-9 rounded-xl border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Discard
          </Button>
          <Button
            type="button"
            onClick={() => { onClose(); onContinue(); }}
            className="h-9 rounded-xl bg-[#12335f] text-xs font-bold text-white hover:bg-[#0b2445] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center"
          >
            Continue Draft <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}


function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-slate-800">{value || '-'}</p>
    </div>
  );
}

function ThCell({
  children,
  sortKey,
  currentSort,
  sortDir,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  currentSort: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-700"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn('h-3 w-3 transition-colors', isActive ? 'text-[#12335f]' : 'text-slate-300')} />
        {isActive && (
          <span className="text-[8px] text-[#12335f]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );
}

function InfoRow({ label, value, mono, highlight }: { label: string; value?: string | number | null; mono?: boolean; highlight?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={cn('text-xs font-black text-right', mono ? 'font-mono font-bold text-slate-700' : highlight ? 'font-extrabold text-red-600 tabular-nums' : 'text-slate-800')}>{value}</span>
    </div>
  );
}

/* ─── Draft Detail View (Full Page style) ─── */
function DraftDetailView({
  draft: d,
  onBack,
  onContinue,
  onDiscard,
}: {
  draft: DisplayDraft;
  onBack: () => void;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  // Helper function to pick relevant icons
  const getSectionIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('intent') || t.includes('scope')) return ClipboardList;
    if (t.includes('buyer') || t.includes('user') || t.includes('contact') || t.includes('org')) return Info;
    if (t.includes('item') || t.includes('qty')) return Package;
    if (t.includes('date') || t.includes('time') || t.includes('schedule')) return CalendarDays;
    if (t.includes('price') || t.includes('budget') || t.includes('cost') || t.includes('value')) return IndianRupee;
    if (t.includes('terms') || t.includes('eligibility') || t.includes('criteria') || t.includes('rule')) return ClipboardCheck;
    return Layers;
  };

  // 1. Extract Items
  const items = useMemo(() => {
    if (d.isLocal) {
      return (d.raw?.items || []).map((item: any) => ({
        itemName: item.name || '',
        quantity: String(item.quantity || ''),
        unitOfMeasure: item.unit || 'Nos',
        description: item.specification || ''
      }));
    }
    if (d.raw?.payload?.isV2 || d.raw?.formData) {
      const payload = d.raw.payload || d.raw.formData || {};
      const payloadItems = payload.items || payload.step4?.items || [];
      if (payloadItems.length > 0) {
        return payloadItems.map((item: any) => ({
          itemName: item.name || item.itemName || '',
          quantity: String(item.quantity || ''),
          unitOfMeasure: item.unit || item.unitOfMeasure || 'Nos',
          description: item.specification || item.description || ''
        }));
      }
      const step4 = payload.step4 || {};
      if (step4.productName || step4.serviceCategory) {
        return [{
          itemName: step4.productName || step4.serviceCategory || '',
          quantity: String(step4.quantity || ''),
          unitOfMeasure: step4.unitOfMeasurement || 'Nos',
          description: step4.productDescription || step4.scopeOfWork || ''
        }];
      }
    }
    if (Array.isArray(d.raw?.items)) {
      return d.raw.items.map((item: any) => ({
        itemName: item.itemName || '',
        quantity: String(item.quantity || ''),
        unitOfMeasure: item.unitOfMeasure || 'Nos',
        description: item.description || ''
      }));
    }
    // Fallback using DisplayDraft properties
    if (d.productOrService) {
      return [{
        itemName: d.productOrService,
        quantity: d.quantity,
        unitOfMeasure: d.unit || 'Nos',
        description: d.specifications
      }];
    }
    return [];
  }, [d]);

  // 2. Extract Org Name
  const orgName = useMemo(() => {
    return d.raw?.internal?.orgName || d.raw?.basics?.organizationName || d.raw?.organizationName || 'My Organization';
  }, [d]);

  // 3. Extract Documents
  const documents = useMemo(() => {
    const docs = d.raw?.documents || d.raw?.payload?.documents || [];
    const mapped = (Array.isArray(docs) ? docs : []).map((doc: any) => ({
      fileAssetId: doc.fileAssetId || doc.id,
      fileName: doc.fileName || doc.originalName || 'Document',
      documentType: doc.documentType || 'Draft Document'
    }));
    if (mapped.length === 0 && d.specificationDocumentName) {
      mapped.push({
        fileAssetId: d.raw?.boqFileAssetId || d.raw?.items?.[0]?.fileAssetId || null,
        fileName: d.specificationDocumentName,
        documentType: 'Specification Document'
      });
    }
    return mapped;
  }, [d]);

  // 4. Extract Detail Sections (Accordions)
  const detailSections = useMemo(() => {
    const sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }> = [];
    
    // Procurement Intent Section
    sections.push({
      title: 'PROCUREMENT INTENT',
      fields: [
        { label: 'TITLE', value: d.title || 'Untitled Draft' },
        { label: 'CATEGORY', value: d.categoryName || '—' },
        { label: 'BUYER TYPE', value: d.raw?.basics?.buyerType || 'PRIVATE_BUYER' },
        { label: 'DESCRIPTION', value: `Sourcing Method: ${(METHOD_CONFIGS_MAP[d.methodSlug] || { title: d.methodSlug }).title}\nValue: ${formatCurrency(d.estimatedValue)}\nUrgency: ${d.raw?.basics?.priority || 'Normal'}` }
      ]
    });

    // Internal Details Section
    if (d.raw?.internal) {
      sections.push({
        title: 'INTERNAL DETAILS',
        fields: [
          { label: 'ORGANIZATION NAME', value: d.raw.internal.orgName || '—' },
          { label: 'DEPARTMENT', value: d.raw.internal.department || '—' },
          { label: 'COST CENTER', value: d.raw.internal.costCenter || '—' },
          { label: 'BUDGET HEAD', value: d.raw.internal.budgetHead || '—' },
          { label: 'CONTACT PERSON', value: d.raw.internal.contactPerson || '—' },
          { label: 'EMAIL', value: d.raw.internal.email || '—' },
          { label: 'MOBILE', value: d.raw.internal.mobile || '—' }
        ].filter(f => f.value !== '—')
      });
    }

    return sections;
  }, [d]);

  const [activeSection, setActiveSection] = useState<number | null>(0);

  const timelineSteps = [
    { label: 'Created', date: formatDateTime(d.updatedAt), active: true },
    { label: 'Submitted', date: 'Pending', active: false },
    { label: 'Approval Review', date: 'Pending', active: false },
    { label: 'Approved / Ordered', date: 'Pending', active: false },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 pb-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
        <span className="hover:text-slate-800 cursor-pointer" onClick={onBack}>Procurement Drafts</span>
        <ChevronRight className="h-3 w-3" />
        <span className="hover:text-slate-800 cursor-pointer">{d.title}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[#12335f]">Details</span>
      </nav>

      {/* Page Header */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border border-slate-100 rounded-3xl bg-white p-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 font-sans">
              {d.title}
            </h1>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold tracking-wide border border-amber-200 bg-amber-50 text-amber-700">
              Draft
            </span>
            {d.isLocal ? (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold tracking-wide border border-blue-200 bg-blue-50 text-blue-700">
                Local
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold tracking-wide border border-emerald-200 bg-emerald-50 text-emerald-700">
                Server Draft
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-500">
            <span className="font-mono font-bold text-slate-600">{d.isLocal ? 'Local Browser Cache' : `Draft #D-${d.id}`}</span>
            <span className="mx-2">•</span>
            Last updated {formatDateTime(d.updatedAt)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="h-10 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-2xs transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            className="h-10 rounded-xl border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 cursor-pointer shadow-2xs transition-all active:scale-95"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Discard Draft
          </Button>
          <Button
            type="button"
            onClick={onContinue}
            className="h-10 bg-[#12335f] hover:bg-[#0b2445] text-xs font-bold text-white rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 flex items-center"
          >
            Continue Draft <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm overflow-x-auto">
        <div className="min-w-[700px] flex items-center justify-between relative px-6 py-4">
          <div className="absolute top-[38px] left-[50px] right-[50px] h-[3px] bg-slate-100 -z-0" />

          {timelineSteps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2.5 sm:gap-3 relative z-10 w-28 text-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300',
                  step.active
                    ? 'bg-[#12335f] border-[#12335f] text-white shadow-md shadow-blue-100'
                    : 'bg-white border-slate-200 text-slate-400'
                )}
              >
                {step.active ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-slate-200" />
                )}
              </div>
              <div className="space-y-1">
                <p className={cn('text-xs font-black tracking-tight', step.active ? 'text-[#12335f]' : 'text-slate-800')}>
                  {step.label}
                </p>
                <p className="text-[10px] font-semibold text-slate-500">{step.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Details Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr_0.9fr]">
        {/* COLUMN 1: Overview */}
        <section className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
              Procurement Overview
            </h2>
            <div className="mt-4 space-y-4">
              <InfoRow label="Estimated Value" value={d.estimatedValue ? formatCurrency(d.estimatedValue) : undefined} />
              <InfoRow label="Type" value="Draft" />
              <InfoRow label="Reference Number" value={d.isLocal ? 'Local Draft' : `Draft #D-${d.id}`} mono />
              <InfoRow label="Method" value={(METHOD_CONFIGS_MAP[d.methodSlug] || { title: d.methodSlug }).title} />
              <InfoRow label="Category" value={d.categoryName} />
              <InfoRow label="Delivery Location" value={d.deliveryLocation} />
              {d.quantity && <InfoRow label="Quantity" value={d.unit ? `${d.quantity} ${d.unit}` : d.quantity} />}
              <InfoRow label="Last Updated" value={formatDateTime(d.updatedAt)} />
            </div>
          </div>
        </section>

        {/* COLUMN 2: Scope & Items */}
        <div className="space-y-6 flex flex-col">
          <section className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
              Scope & Description
            </h2>
            {d.specifications ? (
              <p className="text-xs font-semibold leading-relaxed text-slate-600 whitespace-pre-wrap break-words">
                {d.specifications}
              </p>
            ) : (
              <p className="text-xs font-semibold text-slate-400 italic">No specifications provided.</p>
            )}

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-2">
              <div className="rounded-2xl bg-purple-50/40 border border-purple-100 p-4 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">Documents</span>
                <p className="mt-1.5 text-lg font-black text-purple-900 tabular-nums">{documents.length}</p>
              </div>
              <div className="rounded-2xl bg-amber-50/40 border border-amber-100 p-4 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Line Items</span>
                <p className="mt-1.5 text-lg font-black text-amber-900 tabular-nums">{items.length}</p>
              </div>
            </div>
          </section>

          {/* Items Table */}
          {items.length > 0 && (
            <section className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
                Items & Specifications
              </h2>
              <div className="mt-4 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-500">Item Name</th>
                      <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-500 w-20 text-right">Qty</th>
                      <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-500 w-20">Unit</th>
                      <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-500">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-bold text-slate-900">{item.itemName}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-900 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-500">{item.unitOfMeasure}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-500 break-words max-w-xs">{item.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* COLUMN 3: Org & Attachments */}
        <div className="space-y-6 flex flex-col">
          <section className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
              Organization
            </h2>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full sm:w-auto">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12335f]/10 text-[#12335f]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{orgName}</p>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Procuring Entity</p>
                </div>
              </div>
            </div>
          </section>

          {documents.length > 0 && (
            <section className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
                Attachments
              </h2>
              <div className="mt-4 space-y-2">
                {documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 transition-all text-xs font-bold text-[#12335f] group text-left w-full"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#12335f] group-hover:bg-[#12335f] group-hover:text-white transition-all">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-slate-700 font-bold">{doc.fileName}</p>
                        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{doc.documentType || 'General'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Accordion Sections */}
          {detailSections.length > 0 && (
            <section className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>Additional Details</span>
                <span className="text-[10px] font-black uppercase bg-[#12335f]/5 text-[#12335f] px-2.5 py-1 rounded-full border border-[#12335f]/10">
                  {detailSections.length} {detailSections.length === 1 ? 'Section' : 'Sections'}
                </span>
              </h2>
              <div className="space-y-2.5">
                {detailSections.map((section, idx) => {
                  const isOpen = activeSection === idx;
                  const SectionIcon = getSectionIcon(section.title);
                  return (
                    <div
                      key={idx}
                      className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/30 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveSection(isOpen ? null : idx)}
                        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full sm:w-auto">
                          <div className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
                            isOpen ? 'bg-[#12335f] border-[#12335f] text-white' : 'bg-white border-slate-200 text-slate-500'
                          )}>
                            <SectionIcon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-black tracking-tight text-slate-800">{section.title}</span>
                        </div>
                        <span className={cn('text-lg font-black transition-transform duration-200 text-slate-400', isOpen && 'rotate-180')}>
                          ▼
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-t border-slate-100 bg-white p-4 space-y-3">
                          {section.fields.map((f, fIdx) => (
                            <div key={fIdx} className="space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{f.label}</p>
                              <p className="text-xs font-bold text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{f.value || '—'}</p>
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
      </div>
    </div>
  );
}
