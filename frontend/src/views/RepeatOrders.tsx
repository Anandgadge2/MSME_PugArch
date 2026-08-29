import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  TrendingUp,
  MoreVertical
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { ResponsiveFilterBar } from '../components/ui/ResponsiveFilterBar';
import { Card, CardContent } from '../components/ui/card';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { EmptyState, InlineError } from '../features/shared/FeatureStates';
import { formatCurrency, formatDate, maskEmail } from '../features/shared/format';
import { useFeatureQuery, usePagination, useResponsiveViewMode } from '../features/shared/hooks';
import { KpiCard } from '../features/shared/KpiCard';
import { Pagination } from '../features/shared/Pagination';
import { EntityIdLink } from '../features/shared/EntityIdLink';
import { postApi } from '../features/shared/apiClient';
import { ViewModeToggle } from '../features/shared/ViewModeToggle';
import { PageToolbar } from '../features/shared/PageToolbar';
import { useAuth } from '../hooks/useAuth';
import type { PurchaseOrderDto } from '../features/shared/types';
import { PageTableSkeleton } from '../components/ui/skeleton';

type StatusTab = 'Delivered' | 'All';

export default function RepeatOrders() {
  const { user } = useAuth();
  const router = useRouter();

  // Filters & UI state
  const [activeTab, setActiveTab] = useState<StatusTab>('All');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'highest_value' | 'vendors' | 'avg_value'>('all');
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('All Suppliers');
  const [procurementFilter, setProcurementFilter] = useState('All Procurements');
  const [amountFilter, setAmountFilter] = useState('All Amounts');
  const [qtyFilter, setQtyFilter] = useState('All Quantities');
  const [deliveredDateFilter, setDeliveredDateFilter] = useState('All Dates');
  const [customDate, setCustomDate] = useState({ start: '', end: '' });
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  
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
  const [openKebabId, setOpenKebabId] = useState<number | null>(null);

  useEffect(() => {
    if (!openKebabId) return;
    const handleClickOutside = () => setOpenKebabId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openKebabId]);

  const viewerScope = `${user?.role || 'buyer'}-${user?.id || 'none'}`;

  // Fetch all orders for complete frontend filtering
  const { data: rawAllOrders, reload, loading: loadingAll, refreshing } = useFeatureQuery<PurchaseOrderDto[]>(
    `/api/purchase-orders?take=500&viewerScope=${encodeURIComponent(viewerScope)}`,
    []
  );

  const allOrdersList = useMemo(() => {
    return Array.isArray(rawAllOrders) ? rawAllOrders : [];
  }, [rawAllOrders]);

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

  // Dynamic filter dropdown options
  const uniqueSuppliers = useMemo(() => {
    const set = new Set(deliveredOrders.map(o => o.seller?.name || `Seller #${o.sellerId || '-'}`).filter(Boolean));
    return Array.from(set).sort();
  }, [deliveredOrders]);

  const uniqueProcurements = useMemo(() => {
    const set = new Set(deliveredOrders.map(o => {
      const item = o.items?.[0] || { itemName: o.title };
      return o.title || (o as any).tender?.title || item.itemName || 'Procurement Order';
    }).filter(Boolean));
    return Array.from(set).sort();
  }, [deliveredOrders]);

  // Combined Filtering & Sorting
  const processedOrders = useMemo(() => {
    let result = [...deliveredOrders];
    
    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(o => {
        const po = String(o.poNumber || '').toLowerCase();
        const item = o.items?.[0] || { itemName: o.title };
        const procurementName = String(o.title || (o as any).tender?.title || item.itemName || 'Procurement Order').toLowerCase();
        const supplier = String(o.seller?.name || '').toLowerCase();
        const itemDesc = String((item as any).itemDescription || item.itemName || '').toLowerCase();
        return po.includes(q) || procurementName.includes(q) || supplier.includes(q) || itemDesc.includes(q);
      });
    }

    // Supplier Filter
    if (supplierFilter !== 'All Suppliers') {
      result = result.filter(o => {
        const name = o.seller?.name || `Seller #${o.sellerId || '-'}`;
        return name === supplierFilter;
      });
    }

    // Procurement Filter
    if (procurementFilter !== 'All Procurements') {
      result = result.filter(o => {
        const item = o.items?.[0] || { itemName: o.title };
        const procurementName = o.title || (o as any).tender?.title || item.itemName || 'Procurement Order';
        return procurementName === procurementFilter;
      });
    }

    // Amount Filter
    if (amountFilter !== 'All Amounts') {
      result = result.filter(o => {
        const val = Number(o.amount || o.totalValue || 0);
        if (amountFilter === 'Below ₹10,000') return val < 10000;
        if (amountFilter === '₹10,000 – ₹50,000') return val >= 10000 && val <= 50000;
        if (amountFilter === '₹50,000 – ₹1,00,000') return val > 50000 && val <= 100000;
        if (amountFilter === 'Above ₹1,00,000') return val > 100000;
        return true;
      });
    }

    // Quantity Filter
    if (qtyFilter !== 'All Quantities') {
      result = result.filter(o => {
        const item = o.items?.[0] || { quantity: 1 };
        const qty = Number(item.quantity || 0);
        if (qtyFilter === '1–10') return qty >= 1 && qty <= 10;
        if (qtyFilter === '11–50') return qty >= 11 && qty <= 50;
        if (qtyFilter === '51–100') return qty >= 51 && qty <= 100;
        if (qtyFilter === '100+') return qty > 100;
        return true;
      });
    }

    // Delivered On Filter
    if (deliveredDateFilter !== 'All Dates') {
      const now = new Date();
      result = result.filter(o => {
        const dt = new Date(o.updatedAt || o.createdAt || 0);
        if (isNaN(dt.getTime())) return false;
        
        if (deliveredDateFilter === 'Today') {
          return dt.toDateString() === now.toDateString();
        }
        if (deliveredDateFilter === 'Last 7 Days') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          return dt >= sevenDaysAgo && dt <= now;
        }
        if (deliveredDateFilter === 'Last 30 Days') {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          return dt >= thirtyDaysAgo && dt <= now;
        }
        if (deliveredDateFilter === 'Custom Date Range') {
          if (!customDate.start && !customDate.end) return true;
          const start = customDate.start ? new Date(customDate.start) : new Date(0);
          start.setHours(0,0,0,0);
          const end = customDate.end ? new Date(customDate.end) : new Date(8640000000000000);
          end.setHours(23,59,59,999);
          return dt >= start && dt <= end;
        }
        return true;
      });
    }

    // KPI Filters overriding normal sorts (Optional support, but maintaining feature parity)
    if (activeKpiFilter === 'highest_value') {
      return result.sort((a, b) => Number(b.amount || b.totalValue || 0) - Number(a.amount || a.totalValue || 0));
    }
    if (activeKpiFilter === 'avg_value') {
      return result.sort((a, b) => Number(a.amount || a.totalValue || 0) - Number(b.amount || b.totalValue || 0));
    }
    if (activeKpiFilter === 'vendors') {
      return result.sort((a, b) => {
        const partyA = String(a.seller?.name || '').toLowerCase();
        const partyB = String(b.seller?.name || '').toLowerCase();
        return partyA.localeCompare(partyB);
      });
    }

    // Sorting
    result.sort((a, b) => {
      const getVal = (o: PurchaseOrderDto) => Number(o.amount || o.totalValue || 0);
      const getQty = (o: PurchaseOrderDto) => Number(o.items?.[0]?.quantity || 1);
      const getDate = (o: PurchaseOrderDto) => new Date(o.updatedAt || o.createdAt || 0).getTime();
      const getTitle = (o: PurchaseOrderDto) => String(o.items?.[0]?.itemName || o.title || '').toLowerCase();
      const getSupplier = (o: PurchaseOrderDto) => String(o.seller?.name || '').toLowerCase();

      switch (sortBy) {
        case 'value_high':
          return getVal(b) - getVal(a);
        case 'value_low':
          return getVal(a) - getVal(b);
        case 'qty_high':
        case 'qty_desc':
          return getQty(b) - getQty(a);
        case 'qty_low':
        case 'qty_asc':
          return getQty(a) - getQty(b);
        case 'po_asc':
          return String(a.poNumber || '').localeCompare(String(b.poNumber || ''));
        case 'po_desc':
          return String(b.poNumber || '').localeCompare(String(a.poNumber || ''));
        case 'title_asc':
          return getTitle(a).localeCompare(getTitle(b));
        case 'title_desc':
          return getTitle(b).localeCompare(getTitle(a));
        case 'party_asc':
          return getSupplier(a).localeCompare(getSupplier(b));
        case 'party_desc':
          return getSupplier(b).localeCompare(getSupplier(a));
        case 'oldest':
        case 'updated_asc':
          return getDate(a) - getDate(b);
        case 'updated_desc':
        case 'newest':
        default:
          return getDate(b) - getDate(a);
      }
    });

    return result;
  }, [deliveredOrders, searchTerm, supplierFilter, procurementFilter, amountFilter, qtyFilter, deliveredDateFilter, customDate, sortBy, activeKpiFilter]);

  const { page, pageSize, total, pageItems: visibleOrders, setPage, setPageSize } = usePagination(processedOrders, 10);

  // KPI metrics computed from deliveredOrders

  const deliveredCount = deliveredOrders.length;
  const totalDeliveredValue = useMemo(
    () => deliveredOrders.reduce((s, o) => s + Number(o.amount || o.totalValue || 0), 0),
    [deliveredOrders]
  );
  const uniqueSuppliersCount = uniqueSuppliers.length;
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
    await Promise.all([reload()]);
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

  if (loadingAll && (!deliveredOrders || deliveredOrders.length === 0)) {
    return <PageTableSkeleton kpiCount={4} />;
  }

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
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={cn("h-10 rounded-lg text-xs font-black uppercase transition-colors shadow-sm", showFilters ? "bg-[#12335f] text-white border-[#12335f] hover:bg-[#0e2a4f]" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200")}>
            <Filter className={cn("mr-2 h-4 w-4", showFilters ? "text-white" : "text-[#12335f]")} />
            {showFilters ? 'Hide Filters' : 'Filters'}
          </Button>
          <Button variant="outline" onClick={refreshAll} className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm text-slate-700">
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
          loading={loadingAll && allOrdersList.length === 0}
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
          loading={loadingAll && allOrdersList.length === 0}
          active={activeKpiFilter === 'highest_value' || sortBy === 'value_high'}
          onClick={() => {
            setActiveKpiFilter('highest_value');
            setSortBy('value_high');
          }}
        />
        <KpiCard
          label="Active Vendors"
          value={uniqueSuppliersCount}
          subtext="Verified suppliers in repeat catalog"
          icon={Building2}
          color="blue"
          loading={loadingAll && allOrdersList.length === 0}
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
          loading={loadingAll && allOrdersList.length === 0}
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
          activeFilterCount={
            (searchTerm ? 1 : 0) + 
            (supplierFilter !== 'All Suppliers' ? 1 : 0) + 
            (procurementFilter !== 'All Procurements' ? 1 : 0) + 
            (amountFilter !== 'All Amounts' ? 1 : 0) + 
            (qtyFilter !== 'All Quantities' ? 1 : 0) + 
            (deliveredDateFilter !== 'All Dates' ? 1 : 0) + 
            (sortBy !== 'newest' ? 1 : 0)
          }
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search PO number, procurement, supplier..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
            </div>
          }
          filters={
            <>
              {/* Supplier */}
              <div className="w-full sm:w-[140px]">
                <select
                  value={supplierFilter}
                  onChange={e => setSupplierFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Suppliers">Supplier: All</option>
                  {uniqueSuppliers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Procurement */}
              <div className="w-full sm:w-[150px]">
                <select
                  value={procurementFilter}
                  onChange={e => setProcurementFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Procurements">Procurement: All</option>
                  {uniqueProcurements.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="w-full sm:w-[130px]">
                <select
                  value={amountFilter}
                  onChange={e => setAmountFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Amounts">Amount: All</option>
                  <option value="Below ₹10,000">Below ₹10,000</option>
                  <option value="₹10,000 – ₹50,000">₹10,000 – ₹50,000</option>
                  <option value="₹50,000 – ₹1,00,000">₹50,000 – ₹1,00,000</option>
                  <option value="Above ₹1,00,000">Above ₹1,00,000</option>
                </select>
              </div>

              {/* Quantity */}
              <div className="w-full sm:w-[110px]">
                <select
                  value={qtyFilter}
                  onChange={e => setQtyFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Quantities">Qty: All</option>
                  <option value="1–10">1–10</option>
                  <option value="11–50">11–50</option>
                  <option value="51–100">51–100</option>
                  <option value="100+">100+</option>
                </select>
              </div>

              {/* Delivered On Date */}
              <div className="w-full sm:w-[140px]">
                <select
                  value={deliveredDateFilter}
                  onChange={e => setDeliveredDateFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Dates">Delivered: All</option>
                  <option value="Today">Today</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Custom Date Range">Custom Date Range</option>
                </select>
              </div>
              
              {deliveredDateFilter === 'Custom Date Range' && (
                <div 
                  className="grid items-center gap-1 w-full sm:w-auto h-10"
                  style={{ gridTemplateColumns: 'minmax(0, 1fr) 20px minmax(0, 1fr)' }}
                >
                  <input 
                    type="date" 
                    value={customDate.start} 
                    onChange={e => setCustomDate({ ...customDate, start: e.target.value })} 
                    className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-700 outline-none" 
                    title="Start Date" 
                  />
                  <span className="text-slate-400 font-bold text-center">-</span>
                  <input 
                    type="date" 
                    value={customDate.end} 
                    onChange={e => setCustomDate({ ...customDate, end: e.target.value })} 
                    className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-700 outline-none" 
                    title="End Date" 
                  />
                </div>
              )}

              {/* Sorting */}
              <div className="w-full sm:w-[130px]">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="value_high">Highest Amount</option>
                  <option value="value_low">Lowest Amount</option>
                  <option value="qty_high">Highest Quantity</option>
                  <option value="qty_low">Lowest Quantity</option>
                </select>
              </div>
              {(searchTerm || supplierFilter !== 'All Suppliers' || procurementFilter !== 'All Procurements' || amountFilter !== 'All Amounts' || qtyFilter !== 'All Quantities' || deliveredDateFilter !== 'All Dates' || sortBy !== 'newest') && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSearchTerm('');
                    setSupplierFilter('All Suppliers');
                    setProcurementFilter('All Procurements');
                    setAmountFilter('All Amounts');
                    setQtyFilter('All Quantities');
                    setDeliveredDateFilter('All Dates');
                    setCustomDate({ start: '', end: '' });
                    setSortBy('newest');
                    setActiveKpiFilter('all');
                  }}
                  className="h-10 px-3 text-xs font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl shrink-0"
                >
                  Clear Filters
                </Button>
              )}
            </>
          }
          viewToggle={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      </div>


      {/* Content */}
      {processedOrders.length === 0 ? (
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
            {visibleOrders.map((order, index) => {
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
                        <h3 title={procurementName} className="mt-2 line-clamp-2 text-sm font-black leading-snug text-slate-900 group-hover:text-[#12335f] transition-colors">{procurementName}</h3>
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
                {visibleOrders.map((order, index) => {
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
                      <td className="p-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <ActionMenu 
                          order={order}
                          onView={setViewingOrder}
                          onRepeat={handleOpenRepeatModal}
                          openKebabId={openKebabId}
                          setOpenKebabId={setOpenKebabId}
                        />
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

function ActionMenu({ order, onView, onRepeat, openKebabId, setOpenKebabId }: any) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isOpen = openKebabId === order.id;

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      setRect(buttonRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (isOpen && buttonRef.current) {
        setRect(buttonRef.current.getBoundingClientRect());
      }
    };
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const shouldOpenUp = spaceBelow < 120;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpenKebabId(isOpen ? null : order.id);
        }}
        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs focus:outline-none"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && rect && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999]"
          style={{
            top: shouldOpenUp ? undefined : rect.bottom + 4,
            bottom: shouldOpenUp ? window.innerHeight - rect.top + 4 : undefined,
            right: window.innerWidth - rect.right,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 flex flex-col gap-0.5 text-left animate-in fade-in duration-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenKebabId(null);
                onView(order);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              <span>View Details</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenKebabId(null);
                onRepeat(order);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-black rounded-lg text-[#12335f] hover:bg-blue-50 transition-colors text-left"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#12335f]" />
              <span>Repeat Order</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
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
