/**
 * DeliveryListPage - master list of deliveries scoped to the current user's
 * role. Powered by React Query so navigating between pages and back is
 * instant from cache. Supports list/grid view, server-side search, and proper
 * skeleton loaders.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertTriangle,
  ClipboardCheck,
  Eye,
  Filter,
  Grid3x3,
  List,
  PackageCheck,
  RefreshCw,
  Search,
  Truck
} from 'lucide-react';
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input, Select } from '../../../components/ui/input';
import { useAuth } from '../../../hooks/useAuth';
import { EmptyState, InlineError } from '../../shared/FeatureStates';
import { TableSkeleton, ListSkeleton } from '../../../components/ui/skeleton';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { formatCurrency, formatDate } from '../../shared/format';
import { usePagination, useResponsiveViewMode } from '../../shared/hooks';
import { cn } from '../../../lib/utils';
import { DeliveryStatusBadge } from '../components/DeliveryStatusBadge';
import { DELIVERY_STATUS_LABELS } from '../status';
import { useDeliveryList, useDeliveryReport } from '../hooks';
import type { DeliveryDetailDto, DeliveryStatus } from '../types';
import { DeliveryDetailPage } from './DeliveryDetailPage';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import GrnListPage from '../../grn/pages/GrnListPage';

const STATUS_OPTIONS = Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[];

interface Props {
  scope?: 'all' | 'seller' | 'buyer' | 'consignee' | 'logistics' | 'finance' | 'admin';
  title?: string;
  subtitle?: string;
}

export function DeliveryListPage({ scope = 'all', title, subtitle }: Props) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [orderFilter, setOrderFilter] = useState('All Orders');
  const [carrierFilter, setCarrierFilter] = useState('All Carriers');
  const [amountFilter, setAmountFilter] = useState('All Values');
  const [expectedDateFilter, setExpectedDateFilter] = useState('All Dates');
  const [customDate, setCustomDate] = useState({ start: '', end: '' });
  const [activeKpiFilter, setActiveKpiFilter] = useState('all');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useResponsiveViewMode();
  const [sortKey, setSortKey] = useState<string>('updated_desc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'tracking' | 'confirmation'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'confirmation' || tab === 'grn') return 'confirmation';
    }
    return 'tracking';
  });
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'order' || key === 'parties' || key === 'carrier' || key === 'tracking' ? 'asc' : 'desc');
    }
  };

  const listQuery = useDeliveryList({
    page: 1,
    pageSize: 100,
    role: scope === 'all' ? undefined : scope
  });
  const reportQuery = useDeliveryReport(user?.role === 'admin');

  const rawRecords = (listQuery.data?.records || []) as DeliveryDetailDto[];

  const uniqueStatuses = useMemo(() => {
    const set = new Set(rawRecords.map(o => o.status).filter(Boolean));
    return Array.from(set).sort();
  }, [rawRecords]);

  const uniqueOrders = useMemo(() => {
    const set = new Set(rawRecords.map(o => o.purchaseOrder?.title || o.purchaseOrder?.poNumber || '').filter(Boolean));
    return Array.from(set).sort();
  }, [rawRecords]);

  const uniqueCarriers = useMemo(() => {
    const set = new Set(rawRecords.map(o => o.carrierName || o.logisticsPartnerName || 'Carrier Not Assigned').filter(Boolean));
    return Array.from(set).sort();
  }, [rawRecords]);

  const processedOrders = useMemo(() => {
    let result = [...rawRecords];

    if (activeKpiFilter !== 'all') {
      if (activeKpiFilter === 'inMovement') {
        result = result.filter(r => ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AT_HUB', 'PICKED_UP'].includes(r.status));
      } else if (activeKpiFilter === 'completed') {
        result = result.filter(r => ['DELIVERED', 'ACCEPTED', 'CLOSED', 'PAYMENT_RELEASED'].includes(r.status));
      } else if (activeKpiFilter === 'attention') {
        result = result.filter(r => ['DELAYED', 'DELIVERY_FAILED', 'DISPUTE_RAISED', 'RETURNED', 'CANCELLED'].includes(r.status));
      }
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(o => 
        String(o.trackingNumber || '').toLowerCase().includes(lower) ||
        String(o.purchaseOrder?.poNumber || '').toLowerCase().includes(lower) ||
        String(o.purchaseOrder?.title || '').toLowerCase().includes(lower) ||
        String(o.purchaseOrder?.seller?.name || '').toLowerCase().includes(lower) ||
        String(o.purchaseOrder?.buyer?.name || '').toLowerCase().includes(lower) ||
        String(o.carrierName || o.logisticsPartnerName || '').toLowerCase().includes(lower)
      );
    }

    if (statusFilter !== 'All Statuses') {
      result = result.filter(o => o.status === statusFilter);
    }

    if (orderFilter !== 'All Orders') {
      result = result.filter(o => (o.purchaseOrder?.title || o.purchaseOrder?.poNumber || '') === orderFilter);
    }

    if (carrierFilter !== 'All Carriers') {
      result = result.filter(o => (o.carrierName || o.logisticsPartnerName || 'Carrier Not Assigned') === carrierFilter);
    }

    if (amountFilter !== 'All Values') {
      result = result.filter(o => {
        const val = Number(o.purchaseOrder?.amount || 0);
        if (amountFilter === 'Below ₹10,000') return val < 10000;
        if (amountFilter === '₹10,000 – ₹50,000') return val >= 10000 && val <= 50000;
        if (amountFilter === '₹50,000 – ₹1,00,000') return val > 50000 && val <= 100000;
        if (amountFilter === 'Above ₹1,00,000') return val > 100000;
        return true;
      });
    }

    if (expectedDateFilter !== 'All Dates') {
      const now = new Date();
      result = result.filter(o => {
        if (!o.expectedDelivery) return expectedDateFilter === 'Custom Date Range' && (!customDate.start && !customDate.end);
        const dt = new Date(o.expectedDelivery);
        if (isNaN(dt.getTime())) return false;
        
        if (expectedDateFilter === 'Today') {
          return dt.toDateString() === now.toDateString();
        }
        if (expectedDateFilter === 'Tomorrow') {
          const tom = new Date(now);
          tom.setDate(now.getDate() + 1);
          return dt.toDateString() === tom.toDateString();
        }
        if (expectedDateFilter === 'Next 7 Days') {
          const sevenDays = new Date(now);
          sevenDays.setDate(now.getDate() + 7);
          return dt >= now && dt <= sevenDays;
        }
        if (expectedDateFilter === 'Next 30 Days') {
          const thirtyDays = new Date(now);
          thirtyDays.setDate(now.getDate() + 30);
          return dt >= now && dt <= thirtyDays;
        }
        if (expectedDateFilter === 'Overdue') {
          return dt < now && !['DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED'].includes(o.status);
        }
        if (expectedDateFilter === 'Custom Date Range') {
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

    const dir = sortDir === 'asc' ? 1 : -1;
    return result.sort((a, b) => {
      if (sortKey === 'updated_desc' || sortKey === 'updated_asc') {
        const dA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return (dA - dB) * (sortKey === 'updated_desc' ? -1 : 1);
      }
      
      switch (sortKey) {
        case 'expected_asc':
        case 'expected_desc': {
          const eA = a.expectedDelivery ? new Date(a.expectedDelivery).getTime() : 0;
          const eB = b.expectedDelivery ? new Date(b.expectedDelivery).getTime() : 0;
          return (eA - eB) * (sortKey === 'expected_asc' ? 1 : -1);
        }
        case 'value_high':
        case 'value_low': {
          const vA = Number(a.purchaseOrder?.amount || 0);
          const vB = Number(b.purchaseOrder?.amount || 0);
          return (vB - vA) * (sortKey === 'value_high' ? -1 : 1);
        }
        case 'tracking': {
          const tA = String(a.trackingNumber || `DLV-${a.id}`).toLowerCase();
          const tB = String(b.trackingNumber || `DLV-${b.id}`).toLowerCase();
          return tA.localeCompare(tB) * dir;
        }
        case 'order': {
          const oA = String(a.purchaseOrder?.title || a.purchaseOrder?.poNumber || '').toLowerCase();
          const oB = String(b.purchaseOrder?.title || b.purchaseOrder?.poNumber || '').toLowerCase();
          return oA.localeCompare(oB) * dir;
        }
        case 'parties': {
          const pA = String(a.purchaseOrder?.seller?.name || a.purchaseOrder?.buyer?.name || '').toLowerCase();
          const pB = String(b.purchaseOrder?.seller?.name || b.purchaseOrder?.buyer?.name || '').toLowerCase();
          return pA.localeCompare(pB) * dir;
        }
        case 'carrier': {
          const cA = String(a.carrierName || a.logisticsPartnerName || '').toLowerCase();
          const cB = String(b.carrierName || b.logisticsPartnerName || '').toLowerCase();
          return cA.localeCompare(cB) * dir;
        }
        case 'expected': {
          const eA = a.expectedDelivery ? new Date(a.expectedDelivery).getTime() : 0;
          const eB = b.expectedDelivery ? new Date(b.expectedDelivery).getTime() : 0;
          return (eA - eB) * dir;
        }
        case 'value': {
          const vA = Number(a.purchaseOrder?.amount || 0);
          const vB = Number(b.purchaseOrder?.amount || 0);
          return (vA - vB) * dir;
        }
        case 'status': {
          const sA = String(a.status || '').toLowerCase();
          const sB = String(b.status || '').toLowerCase();
          return sA.localeCompare(sB) * dir;
        }
        case 'id':
        default: {
          return (a.id - b.id) * dir;
        }
      }
    });
  }, [rawRecords, searchTerm, statusFilter, orderFilter, carrierFilter, amountFilter, expectedDateFilter, customDate, sortKey, sortDir, activeKpiFilter]);

  const { page, pageSize, total, pageItems: visibleRecords, setPage, setPageSize } = usePagination(processedOrders, 10);

  // Use server-side report data for KPIs when available, fall back to client-side counters
  const counters = useMemo(() => {
    if (reportQuery.data) {
      return {
        inMovement: reportQuery.data.inMovement || 0,
        completed: reportQuery.data.completed || 0,
        risk: reportQuery.data.risk || 0
      };
    }
    // Fallback: lightweight client-side counters from current page
    const inMovement = processedOrders.filter(r =>
      ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AT_HUB', 'PICKED_UP'].includes(r.status)
    ).length;
    const completed = processedOrders.filter(r =>
      ['DELIVERED', 'ACCEPTED', 'CLOSED', 'PAYMENT_RELEASED'].includes(r.status)
    ).length;
    const risk = processedOrders.filter(r =>
      ['DELAYED', 'DELIVERY_FAILED', 'DISPUTE_RAISED', 'RETURNED', 'CANCELLED'].includes(r.status)
    ).length;
    return { inMovement, completed, risk };
  }, [processedOrders, reportQuery.data]);

  const startIndex = (page - 1) * pageSize;
  const isInitialLoading = listQuery.isLoading && !listQuery.data;
  const isBackgroundFetching = listQuery.isFetching && !!listQuery.data;

  if (selectedId) {
    return <DeliveryDetailPage deliveryId={selectedId} onClose={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Transparent Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
        <div className="min-w-0">
          {/* <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f] bg-[#12335f]/10 px-2.5 py-1 rounded-full">
            {scope === 'admin' ? 'Admin Delivery Console' : 'Buyer Logistics & Fulfillment'}
          </span> */}
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">
            {title || (scope === 'buyer' || scope === 'all' ? 'Delivery Management & Tracking' : 'Delivery Tracking')}
          </h1>
          {/* <p className="text-xs font-semibold text-slate-500 mt-1">
            {subtitle || 'Track live consignments, confirm receipt of goods, inspect line items, and manage GRNs.'}
          </p> */}
        </div>
        {activeTab === 'tracking' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => listQuery.refetch()}
              className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4 text-[#12335f]', isBackgroundFetching && 'animate-spin')} /> Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Unified Tab Switcher for Buyer */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('tracking')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2',
            activeTab === 'tracking'
              ? 'border-[#12335f] text-[#12335f] bg-slate-100/70 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-bold'
          )}
        >
          <Truck className="h-4 w-4" /> Live Shipment Tracking
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('confirmation')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2',
            activeTab === 'confirmation'
              ? 'border-[#12335f] text-[#12335f] bg-slate-100/70 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-bold'
          )}
        >
          <ClipboardCheck className="h-4 w-4" /> Delivery Confirmation & GRNs
        </button>
      </div>

      {activeTab === 'confirmation' ? (
        <GrnListPage />
      ) : (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="In Movement"
              value={counters.inMovement}
              subtext="Active consignments"
              icon={Truck}
              loading={isInitialLoading}
              color="blue"
              active={['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AT_HUB', 'PICKED_UP'].includes(statusFilter)}
              onClick={() => setStatusFilter(prev => prev === 'DISPATCHED' ? '' : 'DISPATCHED')}
            />
            <KpiCard
              label="Completed"
              value={counters.completed}
              subtext="Delivered / accepted / closed"
              icon={PackageCheck}
              loading={isInitialLoading}
              color="green"
              active={['DELIVERED', 'ACCEPTED', 'CLOSED', 'PAYMENT_RELEASED'].includes(statusFilter)}
              onClick={() => setStatusFilter(prev => prev === 'DELIVERED' ? '' : 'DELIVERED')}
            />
            <KpiCard
              label="Attention"
              value={counters.risk}
              subtext="Delays, disputes, returns"
              icon={AlertTriangle}
              loading={isInitialLoading}
              color="red"
              active={['DELAYED', 'DELIVERY_FAILED', 'DISPUTE_RAISED', 'RETURNED', 'CANCELLED'].includes(statusFilter)}
              onClick={() => setStatusFilter(prev => prev === 'DELAYED' ? '' : 'DELAYED')}
            />
            <KpiCard
              label="Total"
              value={total}
              subtext="All visible records"
              icon={Filter}
              loading={isInitialLoading}
              color="indigo"
              active={!statusFilter}
              onClick={() => setStatusFilter('')}
            />
          </div>

          {listQuery.error && (
            <InlineError
              message={listQuery.error instanceof Error ? listQuery.error.message : 'Failed to load deliveries'}
              onRetry={() => listQuery.refetch()}
            />
          )}

                {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-[18px] border border-slate-200/90 bg-white p-3 shadow-sm flex flex-wrap lg:flex-nowrap items-center gap-3">
        {/* Search */}
        <div className="flex-[1_1_auto] min-w-[240px] relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search tracking, PO, order, seller, buyer..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
          />
        </div>

        {/* Status */}
        <div className="flex-[0_0_auto] w-full sm:w-[130px]">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Statuses">Status: All</option>
            {uniqueStatuses.map(s => (
              <option key={s} value={s}>{DELIVERY_STATUS_LABELS[s as DeliveryStatus] || s}</option>
            ))}
          </select>
        </div>

        {/* Order */}
        <div className="flex-[0_0_auto] w-full sm:w-[150px]">
          <select
            value={orderFilter}
            onChange={e => setOrderFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Orders">Order: All</option>
            {uniqueOrders.map(o => (
              <option key={o} value={o}>{o.length > 25 ? o.substring(0, 25) + '...' : o}</option>
            ))}
          </select>
        </div>

        {/* Carrier */}
        <div className="flex-[0_0_auto] w-full sm:w-[140px]">
          <select
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Carriers">Carrier: All</option>
            {uniqueCarriers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div className="flex-[0_0_auto] w-full sm:w-[130px]">
          <select
            value={amountFilter}
            onChange={e => setAmountFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Values">Value: All</option>
            <option value="Below ₹10,000">Below ₹10,000</option>
            <option value="₹10,000 – ₹50,000">₹10,000 – ₹50,000</option>
            <option value="₹50,000 – ₹1,00,000">₹50,000 – ₹1,00,000</option>
            <option value="Above ₹1,00,000">Above ₹1,00,000</option>
          </select>
        </div>

        {/* Expected Delivery */}
        <div className="flex-[0_0_auto] w-full sm:w-[140px] flex items-center gap-[12px]">
          <select
            value={expectedDateFilter}
            onChange={e => setExpectedDateFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="All Dates">Expected: All</option>
            <option value="Today">Today</option>
            <option value="Tomorrow">Tomorrow</option>
            <option value="Next 7 Days">Next 7 Days</option>
            <option value="Next 30 Days">Next 30 Days</option>
            <option value="Overdue">Overdue</option>
            <option value="Custom Date Range">Custom Date Range</option>
          </select>
        </div>

        {expectedDateFilter === 'Custom Date Range' && (
          <div 
            className="flex-[0_0_auto] grid items-center gap-1 w-full sm:w-auto h-10"
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

        {/* Sort */}
        <div className="flex-[0_0_auto] w-full sm:w-[130px]">
          <select
            value={sortKey}
            onChange={e => {
              setSortKey(e.target.value);
              setSortDir(e.target.value.includes('_asc') ? 'asc' : 'desc');
            }}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
          >
            <option value="updated_desc">Latest Updated</option>
            <option value="updated_asc">Oldest Updated</option>
            <option value="expected_asc">Expected - Soonest</option>
            <option value="expected_desc">Expected - Latest</option>
            <option value="value_high">Highest Value</option>
            <option value="value_low">Lowest Value</option>
          </select>
        </div>

        {/* Right Actions */}
        <div className="flex-[0_0_auto] flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          {(searchTerm || statusFilter !== 'All Statuses' || orderFilter !== 'All Orders' || carrierFilter !== 'All Carriers' || amountFilter !== 'All Values' || expectedDateFilter !== 'All Dates' || sortKey !== 'updated_desc') && (
            <Button 
              variant="ghost" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All Statuses');
                setOrderFilter('All Orders');
                setCarrierFilter('All Carriers');
                setAmountFilter('All Values');
                setExpectedDateFilter('All Dates');
                setCustomDate({ start: '', end: '' });
                setSortKey('updated_desc');
                setSortDir('desc');
                setActiveKpiFilter('all');
              }}
              className="h-9 px-2 text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 shrink-0"
            >
              Clear Filters
            </Button>
          )}
          <div className="shrink-0">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {isInitialLoading ? (
            viewMode === 'list' ? <TableSkeleton rows={6} cols={8} /> : <ListSkeleton rows={4} />
          ) : processedOrders.length === 0 ? (
            <EmptyState
              title="No deliveries found"
              description={searchTerm || statusFilter !== 'All Statuses'
                ? 'No delivery records match the current search or status filters.'
                : 'No delivery records are visible for this role yet. Accepted purchase orders are auto-linked to delivery tracking when the delivery module is available.'}
            />
          ) : viewMode === 'grid' ? (
            <GridView
              records={visibleRecords}
              startIndex={startIndex}
              page={page}
              pageSize={pageSize}
              total={total}
              onSelect={setSelectedId}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isFetching={isBackgroundFetching}
            />
          ) : (
            <ListView
              records={visibleRecords}
              startIndex={startIndex}
              page={page}
              pageSize={pageSize}
              total={total}
              onSelect={setSelectedId}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isFetching={isBackgroundFetching}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------- View toggle ---------- */

function ViewToggle({ viewMode, onChange }: { viewMode: 'list' | 'grid'; onChange: (mode: 'list' | 'grid') => void }) {
  return (
    <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => onChange('list')}
        title="List view"
        aria-label="List view"
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md transition',
          viewMode === 'list' ? 'bg-white text-[#12335f] shadow-sm' : 'text-slate-500 hover:text-[#12335f]'
        )}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        title="Grid view"
        aria-label="Grid view"
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md transition',
          viewMode === 'grid' ? 'bg-white text-[#12335f] shadow-sm' : 'text-slate-500 hover:text-[#12335f]'
        )}
      >
        <Grid3x3 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ---------- List (table) view ---------- */

interface ViewProps {
  records: DeliveryDetailDto[];
  startIndex: number;
  page: number;
  pageSize: number;
  total: number;
  onSelect: (id: number) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isFetching: boolean;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

function ListView({ records, startIndex, page, pageSize, total, onSelect, onPageChange, onPageSizeChange, isFetching, sortKey, sortDir, onSort }: ViewProps) {
  const renderSortableHead = (label: string, field: string, align: 'left' | 'right' = 'left') => {
    const isSorted = sortKey === field;
    return (
      <TableHead
        onClick={() => onSort?.(field)}
        className={cn(
          "p-3 cursor-pointer select-none transition-colors group text-[10px] font-black uppercase tracking-wider",
          align === 'right' ? 'text-right' : 'text-left',
          isSorted ? 'text-[#12335f] bg-slate-100/90 font-black' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
        )}
        title={`Sort by ${label} (${isSorted ? (sortDir === 'asc' ? 'Ascending' : 'Descending') : 'Click to sort'})`}
      >
        <div className={cn("inline-flex items-center gap-1.5", align === 'right' ? 'justify-end' : 'justify-start')}>
          <span>{label}</span>
          {isSorted ? (
            sortDir === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5 text-[#12335f]" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-[#12335f]" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </TableHead>
    );
  };

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity', isFetching && 'opacity-90')}>
      <div className="overflow-x-auto">
        <Table className="min-w-[960px] border-collapse text-left text-xs">
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50/75 hover:bg-transparent">
              {renderSortableHead('Sr. No.', 'id')}
              {renderSortableHead('Tracking', 'tracking')}
              {renderSortableHead('Order', 'order')}
              {renderSortableHead('Parties', 'parties')}
              {renderSortableHead('Carrier', 'carrier')}
              {renderSortableHead('Expected', 'expected')}
              {renderSortableHead('Value', 'value', 'right')}
              {renderSortableHead('Status', 'status')}
              <TableHead className="text-right p-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {records.map((record, index) => (
              <TableRow key={record.id} onClick={() => onSelect(record.id)} className="hover:bg-slate-50/50 transition cursor-pointer">
                <TableCell className="font-mono text-xs text-slate-500 p-3">
                  {String(startIndex + index + 1).padStart(2, '0')}
                </TableCell>
                <TableCell className="font-black text-[#12335f] p-3">
                  {record.trackingNumber || `DLV-${record.id}`}
                </TableCell>
                <TableCell className="p-3">
                  <p className="font-bold text-slate-900">
                    {record.purchaseOrder?.title || record.purchaseOrder?.poNumber || `Delivery ${record.id}`}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {record.purchaseOrder?.poNumber}
                  </p>
                </TableCell>
                <TableCell className="text-xs p-3">
                  <p className="text-slate-600">
                    <span className="font-bold">Seller:</span> {record.purchaseOrder?.seller?.name || '—'}
                  </p>
                  <p className="text-slate-500">
                    <span className="font-bold">Buyer:</span> {record.purchaseOrder?.buyer?.name || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-xs p-3">
                  <p className="font-bold text-slate-800">{record.carrierName || record.logisticsPartnerName || 'Pending'}</p>
                </TableCell>
                <TableCell className="text-xs p-3 text-slate-500">
                  {formatDate(record.expectedDelivery)}
                </TableCell>
                <TableCell className="text-right text-xs font-bold text-slate-900 p-3">
                  {formatCurrency(record.purchaseOrder?.amount)}
                </TableCell>
                <TableCell className="p-3">
                  <DeliveryStatusBadge status={record.status} />
                </TableCell>
                <TableCell className="text-right p-3" onClick={e => e.stopPropagation()}>
                  <Button
                    size="sm"
                    onClick={() => onSelect(record.id)}
                    className="h-8 bg-[#12335f] hover:bg-[#0e2a4f] text-white text-[10px] font-black uppercase px-3 rounded-lg shadow-2xs"
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> Track Progress
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        label="deliveries"
      />
    </div>
  );
}

/* ---------- Grid (cards) view ---------- */

function GridView({ records, startIndex, page, pageSize, total, onSelect, onPageChange, onPageSizeChange, isFetching }: ViewProps) {
  return (
    <div className={cn('space-y-4 transition-opacity', isFetching && 'opacity-90')}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {records.map((record, index) => (
          <button
            key={record.id}
            type="button"
            onClick={() => onSelect(record.id)}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#12335f]/40 hover:shadow-md justify-between"
          >
            <div className="w-full">
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[9px] font-black text-slate-500">
                    {String(startIndex + index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">
                      {record.trackingNumber || `DLV-${record.id}`}
                    </p>
                    <p className="mt-1 break-words text-sm font-black text-slate-900 group-hover:text-[#12335f] transition-colors">
                      {record.purchaseOrder?.title || record.purchaseOrder?.poNumber || `Delivery ${record.id}`}
                    </p>
                    <p className="mt-1 break-words text-[10px] font-semibold text-slate-500">
                      {record.purchaseOrder?.seller?.name || 'Seller'} → {record.purchaseOrder?.buyer?.name || 'Buyer'}
                    </p>
                  </div>
                </div>
                <DeliveryStatusBadge status={record.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Carrier</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-800">
                    {record.carrierName || record.logisticsPartnerName || 'Pending'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Expected</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-800">{formatDate(record.expectedDelivery)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Value</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-800">
                    {formatCurrency(record.purchaseOrder?.amount)}
                  </p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        label="deliveries"
      />
    </div>
  );
}

/* ---------- Small helpers ---------- */



function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-black text-slate-900">{value}</p>
    </div>
  );
}

export default DeliveryListPage;
