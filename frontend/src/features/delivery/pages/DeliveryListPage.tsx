/**
 * DeliveryListPage - master list of deliveries scoped to the current user's
 * role. Powered by React Query so navigating between pages and back is
 * instant from cache. Supports list/grid view, server-side search, and proper
 * skeleton loaders.
 */

import { useEffect, useMemo, useState } from 'react';
import {
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
import { useResponsiveViewMode } from '../../shared/hooks';
import { cn } from '../../../lib/utils';
import { DeliveryStatusBadge } from '../components/DeliveryStatusBadge';
import { DELIVERY_STATUS_LABELS } from '../status';
import { useDeliveryList, useDeliveryReport } from '../hooks';
import type { DeliveryDetailDto, DeliveryStatus } from '../types';
import { DeliveryDetailPage } from './DeliveryDetailPage';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import GrnListPage from '../../grn/pages/GrnListPage';

const STATUS_OPTIONS = Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[];

interface Props {
  scope?: 'all' | 'seller' | 'buyer' | 'consignee' | 'logistics' | 'finance' | 'admin';
  title?: string;
  subtitle?: string;
}

export function DeliveryListPage({ scope = 'all', title, subtitle }: Props) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useResponsiveViewMode();
  const [activeTab, setActiveTab] = useState<'tracking' | 'confirmation'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'confirmation' || tab === 'grn') return 'confirmation';
    }
    return 'tracking';
  });

  // Debounced search to avoid hammering the API on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Reset to page 1 when filters narrow.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch, pageSize]);

  const listQuery = useDeliveryList({
    page,
    pageSize,
    status: statusFilter || undefined,
    q: debouncedSearch || undefined,
    role: scope === 'all' ? undefined : scope
  });
  const reportQuery = useDeliveryReport(user?.role === 'admin');

  const records = (listQuery.data?.records || []) as DeliveryDetailDto[];
  const total = listQuery.data?.total || 0;

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
    const inMovement = records.filter(r =>
      ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AT_HUB', 'PICKED_UP'].includes(r.status)
    ).length;
    const completed = records.filter(r =>
      ['DELIVERED', 'ACCEPTED', 'CLOSED', 'PAYMENT_RELEASED'].includes(r.status)
    ).length;
    const risk = records.filter(r =>
      ['DELAYED', 'DELIVERY_FAILED', 'DISPUTE_RAISED', 'RETURNED', 'CANCELLED'].includes(r.status)
    ).length;
    return { inMovement, completed, risk };
  }, [records, reportQuery.data]);

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
          <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f] bg-[#12335f]/10 px-2.5 py-1 rounded-full">
            {scope === 'admin' ? 'Admin Delivery Console' : 'Buyer Logistics & Fulfillment'}
          </span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">
            {title || (scope === 'buyer' || scope === 'all' ? 'Delivery Management & Tracking' : 'Delivery Tracking')}
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            {subtitle || 'Track live consignments, confirm receipt of goods, inspect line items, and manage GRNs.'}
          </p>
        </div>
        {activeTab === 'tracking' && (
          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
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
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <KpiCard label="In Movement" value={counters.inMovement} hint="Active consignments" icon={Truck} loading={isInitialLoading} color="blue" />
            <KpiCard label="Completed" value={counters.completed} hint="Delivered / accepted / closed" icon={PackageCheck} loading={isInitialLoading} color="green" />
            <KpiCard label="Attention" value={counters.risk} hint="Delays, disputes, returns" icon={AlertTriangle} loading={isInitialLoading} color="red" />
            <KpiCard label="Total" value={total} hint="All visible records" icon={Filter} loading={isInitialLoading} color="indigo" />
          </div>

          {listQuery.error && (
            <InlineError
              message={listQuery.error instanceof Error ? listQuery.error.message : 'Failed to load deliveries'}
              onRetry={() => listQuery.refetch()}
            />
          )}

          {/* Responsive Filter Bar */}
          <ResponsiveFilterBar
            activeFilterCount={statusFilter !== '' ? 1 : 0}
            searchInput={
              <div className="relative min-w-0 w-full sm:flex-1 max-w-md">
                <Search className="pointer-events-none absolute inset-y-0 left-3 h-full w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search PO, vendor, tracking number..."
                  className="pl-10 bg-white"
                />
              </div>
            }
            filters={
              <>
                <Select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as DeliveryStatus | '')}
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20 w-full sm:w-auto"
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{DELIVERY_STATUS_LABELS[status]}</option>
                  ))}
                </Select>

                {(search || statusFilter) && (
                  <Button
                    variant="outline"
                    className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </>
            }
          />

          {isInitialLoading ? (
            viewMode === 'list' ? <TableSkeleton rows={6} cols={8} /> : <ListSkeleton rows={4} />
          ) : records.length === 0 ? (
            <EmptyState
              title="No deliveries found"
              description={debouncedSearch || statusFilter
                ? 'No delivery records match the current search or status filters.'
                : 'No delivery records are visible for this role yet. Accepted purchase orders are auto-linked to delivery tracking when the delivery module is available.'}
            />
          ) : viewMode === 'grid' ? (
            <GridView
              records={records}
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
              records={records}
              startIndex={startIndex}
              page={page}
              pageSize={pageSize}
              total={total}
              onSelect={setSelectedId}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isFetching={isBackgroundFetching}
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
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wide transition',
          viewMode === 'list' ? 'bg-white text-[#12335f] shadow-sm' : 'text-slate-500 hover:text-[#12335f]'
        )}
      >
        <List className="h-3.5 w-3.5" /> List
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        title="Grid view"
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wide transition',
          viewMode === 'grid' ? 'bg-white text-[#12335f] shadow-sm' : 'text-slate-500 hover:text-[#12335f]'
        )}
      >
        <Grid3x3 className="h-3.5 w-3.5" /> Grid
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
}

function ListView({ records, startIndex, page, pageSize, total, onSelect, onPageChange, onPageSizeChange, isFetching }: ViewProps) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity', isFetching && 'opacity-90')}>
      <div className="overflow-x-auto">
        <Table className="min-w-[960px] border-collapse text-left text-xs">
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50/75 hover:bg-transparent">
              <TableHead className="w-16 text-[10px] font-black uppercase tracking-wider text-slate-500 p-3">Sr. No.</TableHead>
              <TableHead className="p-3">Tracking</TableHead>
              <TableHead className="p-3">Order</TableHead>
              <TableHead className="p-3">Parties</TableHead>
              <TableHead className="p-3">Carrier</TableHead>
              <TableHead className="p-3">Expected</TableHead>
              <TableHead className="text-right p-3">Value</TableHead>
              <TableHead className="p-3">Status</TableHead>
              <TableHead className="text-right p-3">Action</TableHead>
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
