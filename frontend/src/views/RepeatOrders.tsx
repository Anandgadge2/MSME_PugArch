import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  RotateCcw,
  FileText,
  Search,
  Calendar,
  MapPin,
  Truck,
  IndianRupee,
  RefreshCw,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  XCircle,
  ShieldCheck,
  Filter,
  Building2,
  BarChart3,
  PackageCheck,
  TrendingUp
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { ResponsiveFilterBar } from '../components/ui/ResponsiveFilterBar';
import { Card, CardContent } from '../components/ui/card';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { EmptyState, LoadingState } from '../features/shared/FeatureStates';
import { formatCurrency, formatDate, maskEmail } from '../features/shared/format';
import { useFeatureQuery, usePaginatedFeatureQuery, useResponsiveViewMode } from '../features/shared/hooks';
import { KpiCard } from '../features/shared/KpiCard';
import { Pagination } from '../features/shared/Pagination';
import { ViewModeToggle } from '../features/shared/ViewModeToggle';
import { EntityIdLink } from '../features/shared/EntityIdLink';
import { useAuth } from '../hooks/useAuth';
import type { PurchaseOrderDto } from '../features/shared/types';

type StatusTab = 'Delivered' | 'All';

export default function RepeatOrders() {
  const { user } = useAuth();
  const router = useRouter();

  // Filters & UI state
  const [activeTab, setActiveTab] = useState<StatusTab>('All');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'highest_value' | 'vendors' | 'avg_value'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useResponsiveViewMode('repeat-orders:view-mode');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Repeat order modal
  const [repeatingOrder, setRepeatingOrder] = useState<PurchaseOrderDto | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrderDto | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const viewerScope = `${user?.role || 'buyer'}-${user?.id || 'none'}`;

  // Paginated query – only delivered orders for "Delivered" tab
  const {
    records: pagedOrders,
    loading,
    refreshing,
    error,
    reload,
    page,
    pageSize,
    total,
    setPage,
    setPageSize
  } = usePaginatedFeatureQuery<PurchaseOrderDto>(
    '/api/purchase-orders',
    {
      q: debouncedSearch,
      status: activeTab === 'Delivered' ? 'delivered' : undefined,
      sortBy,
      viewerScope
    },
    10
  );

  const sortedOrders = useMemo(() => {
    if (!pagedOrders || pagedOrders.length === 0) return [];
    return [...pagedOrders].sort((a, b) => {
      const getVal = (o: PurchaseOrderDto) => Number(o.amount || o.totalValue || 0);
      const getTitle = (o: PurchaseOrderDto) => String(o.items?.[0]?.itemName || o.title || '').toLowerCase();
      const getSupplier = (o: PurchaseOrderDto) => String(o.seller?.name || '').toLowerCase();
      const getDate = (o: PurchaseOrderDto) => new Date(o.updatedAt || o.createdAt || 0).getTime();

      switch (sortBy) {
        case 'value_high':
          return getVal(b) - getVal(a);
        case 'value_low':
          return getVal(a) - getVal(b);
        case 'title_asc':
          return getTitle(a).localeCompare(getTitle(b));
        case 'title_desc':
          return getTitle(b).localeCompare(getTitle(a));
        case 'party_asc':
          return getSupplier(a).localeCompare(getSupplier(b));
        case 'party_desc':
          return getSupplier(b).localeCompare(getSupplier(a));
        case 'updated_asc':
          return getDate(a) - getDate(b);
        case 'updated_desc':
          return getDate(b) - getDate(a);
        case 'newest':
        default:
          return getDate(b) - getDate(a);
      }
    });
  }, [pagedOrders, sortBy]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return sortedOrders;
    const q = searchTerm.trim().toLowerCase();
    return sortedOrders.filter(o => {
      const po = String(o.poNumber || '').toLowerCase();
      const title = String(o.title || o.items?.[0]?.itemName || '').toLowerCase();
      const supplier = String(o.seller?.name || '').toLowerCase();
      return po.includes(q) || title.includes(q) || supplier.includes(q);
    });
  }, [sortedOrders, searchTerm]);

  // All orders for KPI stats
  const { data: rawAllOrders, reload: reloadAll, loading: loadingAll } = useFeatureQuery<PurchaseOrderDto[]>(
    `/api/purchase-orders?take=500&viewerScope=${encodeURIComponent(viewerScope)}`,
    []
  );

  const allOrdersList = useMemo(() => {
    if (Array.isArray(rawAllOrders) && rawAllOrders.length > 0) return rawAllOrders;
    if (Array.isArray(pagedOrders) && pagedOrders.length > 0) return pagedOrders;
    return [];
  }, [rawAllOrders, pagedOrders]);

  // KPI metrics computed from all orders (or fallback to pagedOrders)
  const deliveredOrders = useMemo(() => {
    if (allOrdersList.length === 0) return [];
    const isRepeatable = (o: PurchaseOrderDto) => {
      const s = String(o.status || '').toLowerCase();
      return !['cancelled', 'rejected'].includes(s);
    };
    const strictDelivered = allOrdersList.filter(o => {
      const s = String(o.status || '').toLowerCase();
      return s === 'delivered' || s === 'completed' || s === 'closed';
    });
    if (strictDelivered.length > 0) return strictDelivered;
    return allOrdersList.filter(isRepeatable);
  }, [allOrdersList]);

  const deliveredCount = deliveredOrders.length;
  const totalDeliveredValue = useMemo(
    () => deliveredOrders.reduce((s, o) => s + Number(o.amount || o.totalValue || 0), 0),
    [deliveredOrders]
  );
  const uniqueSuppliers = useMemo(
    () => new Set(deliveredOrders.map(o => o.sellerId || (o.seller as any)?.id || o.seller?.name).filter(Boolean)).size,
    [deliveredOrders]
  );
  const avgOrderValue = deliveredCount > 0 ? totalDeliveredValue / deliveredCount : 0;

  // Repeat modal handlers
  const handleOpenRepeatModal = (order: PurchaseOrderDto) => {
    setRepeatingOrder(order);
    const firstItem = order.items?.[0];
    const qty = firstItem ? Number(firstItem.quantity) : 1;
    setQuantity(qty || 1);
    setDeliveryAddress(order.deliveryAddress || '');
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    setExpectedDelivery(defaultDate.toISOString().split('T')[0]);
  };

  const handleCreateRepeatOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repeatingOrder) return;
    if (quantity < 1) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (!expectedDelivery) {
      toast.error('Please select an expected delivery date');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        title: repeatingOrder.title,
        sellerId: repeatingOrder.sellerId,
        buyerId: repeatingOrder.buyerId,
        expectedDelivery: new Date(expectedDelivery).toISOString(),
        deliveryAddress: deliveryAddress || repeatingOrder.deliveryAddress || undefined,
        paymentTerms: repeatingOrder.paymentTerms || undefined,
        deliveryType: (repeatingOrder as any).deliveryType || undefined,
        incoterms: (repeatingOrder as any).incoterms || undefined,
        notes: `Repeat order created from PO #${repeatingOrder.poNumber}`,
        items: (repeatingOrder.items && repeatingOrder.items.length > 0)
          ? repeatingOrder.items.map((item: any, idx: number) => ({
            itemName: item.itemName,
            itemDescription: item.itemDescription || undefined,
            quantity: idx === 0 ? quantity : Number(item.quantity || 1),
            unit: item.unit || 'unit',
            unitPrice: Number(item.unitPrice || 0),
            totalPrice: (idx === 0 ? quantity : Number(item.quantity || 1)) * Number(item.unitPrice || 0),
            specifications: item.specifications || undefined
          }))
          : [{
            itemName: repeatingOrder.title,
            quantity: quantity,
            unit: 'unit',
            unitPrice: Number(repeatingOrder.amount || repeatingOrder.totalValue || 0),
            totalPrice: quantity * Number(repeatingOrder.amount || repeatingOrder.totalValue || 0)
          }]
      };

      const res = await api.post('/api/purchase-orders', payload);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create repeat order');
      }

      toast.success('Repeat Purchase Order created successfully!');
      setRepeatingOrder(null);
      reload();
      reloadAll();
      if (data.id) {
        router.push(`/purchase-orders`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create repeat order');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([reload(), reloadAll()]);
  };

  // Sort header helper
  const toggleSort = (key: string) => {
    if (key === 'value') setSortBy(sortBy === 'value_low' ? 'value_high' : 'value_low');
    else if (key === 'po') setSortBy(sortBy === 'po_asc' ? 'po_desc' : 'po_asc');
    else if (key === 'title') setSortBy(sortBy === 'title_asc' ? 'title_desc' : 'title_asc');
    else if (key === 'party') setSortBy(sortBy === 'party_asc' ? 'party_desc' : 'party_asc');
    else if (key === 'qty') setSortBy(sortBy === 'qty_asc' ? 'qty_desc' : 'qty_asc');
    else if (key === 'updated') setSortBy(sortBy === 'updated_asc' ? 'updated_desc' : 'updated_asc');
  };

  const SortHeader = ({ label, columnKey, className = '' }: { label: string; columnKey: string; className?: string }) => {
    let isActive = false;
    let isAsc = true;
    if (columnKey === 'value') { isActive = sortBy === 'value_low' || sortBy === 'value_high'; isAsc = sortBy === 'value_low'; }
    else if (columnKey === 'po') { isActive = sortBy === 'po_asc' || sortBy === 'po_desc'; isAsc = sortBy === 'po_asc'; }
    else if (columnKey === 'title') { isActive = sortBy === 'title_asc' || sortBy === 'title_desc'; isAsc = sortBy === 'title_asc'; }
    else if (columnKey === 'party') { isActive = sortBy === 'party_asc' || sortBy === 'party_desc'; isAsc = sortBy === 'party_asc'; }
    else if (columnKey === 'qty') { isActive = sortBy === 'qty_asc' || sortBy === 'qty_desc'; isAsc = sortBy === 'qty_asc'; }
    else if (columnKey === 'updated') { isActive = sortBy === 'updated_asc' || sortBy === 'updated_desc'; isAsc = sortBy === 'updated_asc'; }
    return (
      <button type="button" onClick={() => toggleSort(columnKey)} className={cn("inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#12335f] transition-colors", isActive && "text-[#12335f]", className)}>
        {label}
        {isActive ? (isAsc ? <ArrowUp className="h-3 w-3 text-[#12335f]" /> : <ArrowDown className="h-3 w-3 text-[#12335f]" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tricolor Header Accent */}
      <div className="brand-tricolor-strip rounded-full" />

      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f] bg-[#12335f]/10 px-2.5 py-1 rounded-full">Procurement Fulfilment</span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">Repeat Orders</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">Re-order materials and items from completed previous orders quickly.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll} className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm">
            <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Repeatable Orders"
          value={deliveredCount}
          subtext="Fulfilled orders ready for 1-click re-order"
          icon={RotateCcw}
          color="green"
          loading={loadingAll && pagedOrders.length === 0}
          active={activeKpiFilter === 'all' && sortBy === 'newest'}
          onClick={() => {
            setActiveKpiFilter('all');
            setSortBy('newest');
            setSearchTerm('');
          }}
        />
        <KpiCard
          label="Re-Order Spend Pool"
          value={formatCurrency(totalDeliveredValue)}
          subtext="Total historical spend available for repeat"
          icon={TrendingUp}
          color="indigo"
          loading={loadingAll && pagedOrders.length === 0}
          active={activeKpiFilter === 'highest_value' || sortBy === 'value_high'}
          onClick={() => {
            setActiveKpiFilter('highest_value');
            setSortBy('value_high');
          }}
        />
        <KpiCard
          label="Active Vendors"
          value={uniqueSuppliers}
          subtext="Verified suppliers in repeat catalog"
          icon={Building2}
          color="blue"
          loading={loadingAll && pagedOrders.length === 0}
          active={activeKpiFilter === 'vendors' || sortBy === 'party_asc'}
          onClick={() => {
            setActiveKpiFilter('vendors');
            setSortBy('party_asc');
          }}
        />
        <KpiCard
          label="Average Order Size"
          value={formatCurrency(avgOrderValue)}
          subtext="Average spend per repeated consignment"
          icon={BarChart3}
          color="amber"
          loading={loadingAll && pagedOrders.length === 0}
          active={activeKpiFilter === 'avg_value' || sortBy === 'value_low'}
          onClick={() => {
            setActiveKpiFilter('avg_value');
            setSortBy('value_low');
          }}
        />
      </div>

      {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <ResponsiveFilterBar
          activeFilterCount={(searchTerm ? 1 : 0) + (sortBy !== 'newest' ? 1 : 0)}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search PO number, supplier, title..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
            </div>
          }
          filters={
            <div className="w-full sm:w-auto sm:min-w-[130px]">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="value_high">Value High</option>
                <option value="value_low">Value Low</option>
                <option value="title_asc">Title A-Z</option>
                <option value="party_asc">Supplier A-Z</option>
              </select>
            </div>
          }
          endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      </div>

      {/* Content */}
      {loading && filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/85 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="h-5 w-48 rounded bg-slate-100 animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 animate-pulse">
                  <div className="h-6 w-20 rounded bg-slate-200/60" />
                  <div className="h-5 flex-1 rounded bg-slate-200/60" />
                  <div className="h-6 w-24 rounded bg-slate-200/60" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No repeat orders available"
          description={
            searchTerm
              ? 'No orders match your search criteria. Try a different query.'
              : 'You do not have any completed or delivered purchase orders yet. Orders can be repeated once they are fulfilled.'
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order, index) => {
              const rowIndex = (page - 1) * pageSize + index + 1;
              const item: any = order.items?.[0] || { itemName: order.title, quantity: 1 };
              const itemCount = order.items?.length || 1;
              const totalAmount = Number(order.amount || order.totalValue || 0);
              const procurementName = order.title || (order as any).tender?.title || item.itemName || 'Procurement Order';

              return (
                <div
                  key={order.id}
                  className="group rounded-2xl border border-slate-200/85 bg-white p-5 shadow-sm transition hover:border-[#12335f]/40 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[9px] font-black text-slate-500">
                            {String(rowIndex).padStart(2, '0')}
                          </span>
                          <EntityIdLink label={order.poNumber} id={order.id} size="sm" onClick={() => setViewingOrder(order)} />
                        </div>
                        <h3 className="mt-2 line-clamp-2 text-sm font-black leading-snug text-slate-900 group-hover:text-[#12335f] transition-colors">{procurementName}</h3>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> Repeatable
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-[10px] font-semibold text-slate-500 pt-1">
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Supplier</span>
                        <span className="font-bold text-slate-800 truncate block mt-0.5" title={order.seller?.name || maskEmail(order.seller?.email)}>
                          {order.seller?.name || maskEmail(order.seller?.email) || `Seller #${order.sellerId || '-'}`}
                        </span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Past Value</span>
                        <span className="font-bold text-[#12335f] block mt-0.5">{formatCurrency(totalAmount)}</span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Items / Qty</span>
                        <span className="font-bold text-slate-700 block mt-0.5">{itemCount} item{itemCount !== 1 ? 's' : ''} ({item.quantity || 1} {item.unit || 'unit'})</span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Delivered</span>
                        <span className="font-bold text-slate-700 block mt-0.5">{formatDate(order.updatedAt || order.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingOrder(order)}
                      className="h-8 rounded-lg text-xs font-bold border-slate-200 hover:bg-slate-50"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                      View PO
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleOpenRepeatModal(order)}
                      className="h-8 rounded-lg bg-[#12335f] text-xs font-black text-white hover:bg-[#0e274a] shadow-sm"
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Repeat Order
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="completed orders" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full min-w-[860px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="p-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-16">Sr. No</th>
                  <th className="p-3"><SortHeader label="PO Number" columnKey="title" /></th>
                  <th className="p-3"><SortHeader label="PROCUREMENT NAME" columnKey="title" /></th>
                  <th className="p-3"><SortHeader label="Supplier" columnKey="party" /></th>
                  <th className="p-3"><SortHeader label="Qty" columnKey="qty" /></th>
                  <th className="p-3"><SortHeader label="Amount" columnKey="value" /></th>
                  <th className="p-3"><SortHeader label="Delivered On" columnKey="updated" /></th>
                  <th className="p-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredOrders.map((order, index) => {
                  const rowIndex = (page - 1) * pageSize + index + 1;
                  const item = order.items?.[0] || { itemName: order.title, quantity: 1 };
                  const procurementName = order.title || (order as any).tender?.title || item.itemName || 'Procurement Order';
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono text-xs text-slate-500">
                        {String(rowIndex).padStart(2, '0')}
                      </td>
                      <td className="p-3">
                        <EntityIdLink label={order.poNumber} id={order.id} size="sm" onClick={() => setViewingOrder(order)} />
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{procurementName}</p>
                        {item.itemName && item.itemName !== procurementName && (
                          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Item: {item.itemName}</p>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{order.seller?.name || `Seller #${order.sellerId || '-'}`}</td>
                      <td className="p-3 text-slate-900">{Number(item.quantity || 0).toLocaleString()}</td>
                      <td className="p-3 font-bold text-slate-900">{formatCurrency(order.amount || order.totalValue)}</td>
                      <td className="p-3 text-slate-500">{formatDate(order.updatedAt)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" onClick={() => setViewingOrder(order)} className="h-8 text-[10px] font-black uppercase rounded-lg">
                            <Eye className="mr-1 h-3.5 w-3.5 text-[#12335f]" /> View
                          </Button>
                          <Button onClick={() => handleOpenRepeatModal(order)} className="h-8 bg-[#12335f] text-[10px] font-black uppercase text-white hover:bg-[#0b2445] rounded-lg">
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Repeat
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="completed orders" />
        </div>
      )}

      {/* View Order Details Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Order Details</p>
                <h3 className="text-sm font-black text-slate-900">{viewingOrder.poNumber}</h3>
              </div>
              <Button variant="ghost" onClick={() => setViewingOrder(null)} className="h-8 w-8 p-0 rounded-full">
                <XCircle className="h-5 w-5 text-slate-400" />
              </Button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <InfoTile label="Title" value={viewingOrder.title || '-'} />
                <InfoTile label="Status" value={String(viewingOrder.status || '-').replace(/_/g, ' ')} />
                <InfoTile label="Supplier" value={viewingOrder.seller?.name || `Seller #${viewingOrder.sellerId || '-'}`} />
                <InfoTile label="Total Value" value={formatCurrency(viewingOrder.amount || viewingOrder.totalValue)} />
                <InfoTile label="Expected Delivery" value={formatDate(viewingOrder.expectedDelivery)} />
                <InfoTile label="Updated" value={formatDate(viewingOrder.updatedAt)} />
                <InfoTile label="Delivery Address" value={viewingOrder.deliveryAddress || '-'} />
                <InfoTile label="Created" value={formatDate(viewingOrder.createdAt)} />
              </div>

              {viewingOrder.items && viewingOrder.items.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Line Items</p>
                  <div className="rounded-xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-xs min-w-[500px]">
                      <thead><tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="p-2 text-left">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Unit Price</th><th className="p-2 text-right">Total</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingOrder.items.map((it: any, idx: number) => (
                          <tr key={idx} className="font-semibold text-slate-700">
                            <td className="p-2">{it.itemName || it.description || `Item ${idx + 1}`}</td>
                            <td className="p-2 text-right">{Number(it.quantity || 0).toLocaleString()}</td>
                            <td className="p-2 text-right">{formatCurrency(it.unitPrice)}</td>
                            <td className="p-2 text-right font-bold text-slate-900">{formatCurrency(Number(it.quantity || 0) * Number(it.unitPrice || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button variant="outline" onClick={() => setViewingOrder(null)} className="h-9 text-[10px] font-black uppercase">Close</Button>
                {String(viewingOrder.status || '').toLowerCase() === 'delivered' && (
                  <Button onClick={() => { setViewingOrder(null); handleOpenRepeatModal(viewingOrder); }} className="h-9 bg-[#12335f] text-[10px] font-black uppercase text-white hover:bg-[#0b2445]">
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Repeat This Order
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repeat Order Modal */}
      {repeatingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-[#12335f]" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Repeat Purchase Order</h3>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                You are replicating completed order <span className="font-bold text-slate-800">{repeatingOrder.poNumber}</span>.
              </p>
            </div>

            <form onSubmit={handleCreateRepeatOrder} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              {/* Product Info */}
              <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200/50">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Product / Material</span>
                <p className="mt-1 text-xs font-bold text-slate-900">{repeatingOrder.items?.[0]?.itemName || repeatingOrder.title}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Unit Price</span>
                    <span className="font-bold text-slate-900">{formatCurrency(repeatingOrder.items?.[0]?.unitPrice || repeatingOrder.amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Supplier</span>
                    <span className="font-bold text-slate-900">{repeatingOrder.seller?.name || 'Seller'}</span>
                  </div>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Quantity</label>
                <input type="number" min="1" step="1" required value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10" />
              </div>

              {/* Expected Delivery Date */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Expected Delivery Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type="date" required value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10" />
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Delivery Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  <textarea required rows={2} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10" />
                </div>
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Estimated Value</span>
                <span className="text-sm font-black text-[#12335f]">
                  {formatCurrency((Number(repeatingOrder.items?.[0]?.unitPrice) || Number(repeatingOrder.amount)) * quantity)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button type="button" variant="outline" onClick={() => setRepeatingOrder(null)} className="h-9 text-[10px] font-black uppercase">Cancel</Button>
                <Button type="submit" disabled={submitting} className="h-9 bg-[#12335f] text-[10px] font-black uppercase text-white hover:bg-[#0b2445]">
                  {submitting ? 'Placing Order...' : 'Confirm Order'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────



function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-slate-800">{value || '-'}</p>
    </div>
  );
}
