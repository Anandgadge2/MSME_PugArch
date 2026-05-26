/**
 * DeliveryListPage - master list of deliveries scoped to the current user's
 * role. Supports a list (table) view and a grid (cards) view, with pagination
 * and search applied server-side. Sr.No respects pagination so it stays
 * accurate across pages.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
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
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { Pagination } from '../../shared/Pagination';
import { formatCurrency, formatDate } from '../../shared/format';
import { useResponsiveViewMode } from '../../shared/hooks';
import { cn } from '../../../lib/utils';
import { DeliveryStatusBadge } from '../components/DeliveryStatusBadge';
import { DELIVERY_STATUS_LABELS } from '../status';
import { fetchDeliveryReport, listDeliveries } from '../api';
import type { DeliveryDetailDto, DeliveryReportSummary, DeliveryStatus } from '../types';
import { DeliveryDetailPage } from './DeliveryDetailPage';

const STATUS_OPTIONS = Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[];

interface Props {
  scope?: 'all' | 'seller' | 'buyer' | 'consignee' | 'logistics' | 'finance' | 'admin';
  title?: string;
  subtitle?: string;
}

export function DeliveryListPage({ scope = 'all', title, subtitle }: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<DeliveryDetailDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [summary, setSummary] = useState<DeliveryReportSummary | null>(null);
  const [viewMode, setViewMode] = useResponsiveViewMode();

  // Debounce search so we don't refire on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch, pageSize]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDeliveries({
        page,
        pageSize,
        status: statusFilter || undefined,
        q: debouncedSearch || undefined
      });
      setRecords(result.records || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, debouncedSearch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDeliveryReport().then(setSummary).catch(() => setSummary(null));
    }
  }, [user?.role]);

  // Client-side filter as a safety net so the search remains responsive even
  // before the backend acknowledges a query change.
  const filtered = useMemo(() => {
    if (!debouncedSearch) return records;
    const term = debouncedSearch.toLowerCase();
    return records.filter(record => {
      const haystack = [
        record.trackingNumber,
        record.carrierName,
        record.currentLocation,
        record.purchaseOrder?.poNumber,
        record.purchaseOrder?.title,
        record.purchaseOrder?.seller?.name,
        record.purchaseOrder?.buyer?.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [records, debouncedSearch]);

  const counters = useMemo(() => {
    const inMovement = records.filter(r =>
      ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AT_HUB', 'PICKED_UP'].includes(r.status)
    ).length;
    const completed = records.filter(r => ['DELIVERED', 'ACCEPTED', 'CLOSED', 'PAYMENT_RELEASED'].includes(r.status)).length;
    const risk = records.filter(r => ['DELAYED', 'DELIVERY_FAILED', 'DISPUTE_RAISED', 'RETURNED', 'CANCELLED'].includes(r.status)).length;
    return { inMovement, completed, risk };
  }, [records]);

  // Sr.No is computed from the page window so the numbers always stay correct
  // even on page 2+ or with custom page sizes.
  const startIndex = (page - 1) * pageSize;

  if (selectedId) {
    return <DeliveryDetailPage deliveryId={selectedId} onClose={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">
            {scope === 'admin' ? 'Admin Delivery Console' : 'Procurement Logistics'}
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">
            {title || 'Delivery Tracking'}
          </h1>
          <p className="mt-1 max-w-2xl text-xs font-semibold text-slate-500">
            {subtitle || 'PO-linked consignments routed through the procurement workflow.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <Button variant="outline" onClick={reload} className="h-10 rounded-lg text-xs font-black uppercase">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="In Movement" value={counters.inMovement} hint="Active consignments" icon={Truck} />
        <MetricCard label="Completed" value={counters.completed} hint="Delivered / accepted / closed" icon={PackageCheck} />
        <MetricCard label="Attention" value={counters.risk} hint="Delays, disputes, returns" icon={AlertTriangle} />
        <MetricCard label="Total" value={total} hint="All visible records" icon={Filter} />
      </div>

      {scope === 'admin' && summary && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            <Info label="Pending Payment" value={String(summary.paymentPendingAfterAcceptance)} />
            <Info label="Disputed" value={String(summary.disputed)} />
            <Info label="Delayed" value={String(summary.delayed)} />
            <Info label="Returned" value={String(summary.returned)} />
          </CardContent>
        </Card>
      )}

      {error && <InlineError message={error} onRetry={reload} />}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-[#12335f]">
            <Filter className="h-4 w-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">Filters</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-3 h-full w-4 text-slate-400" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search PO, vendor, tracking number..."
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value as DeliveryStatus | '')}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>{DELIVERY_STATUS_LABELS[status]}</option>
              ))}
            </Select>
            <Button
              variant="outline"
              className="h-10 rounded-lg text-xs font-black uppercase"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && records.length === 0 ? (
        <LoadingState label="Loading deliveries..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No deliveries found"
          description="Adjust the filters or wait for sellers to dispatch their orders."
        />
      ) : viewMode === 'grid' ? (
        <GridView
          records={filtered}
          startIndex={startIndex}
          page={page}
          pageSize={pageSize}
          total={total}
          onSelect={setSelectedId}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : (
        <ListView
          records={filtered}
          startIndex={startIndex}
          page={page}
          pageSize={pageSize}
          total={total}
          onSelect={setSelectedId}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
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
}

function ListView({ records, startIndex, page, pageSize, total, onSelect, onPageChange, onPageSizeChange }: ViewProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Sr. No.</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Parties</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, index) => (
                <TableRow key={record.id} onClick={() => onSelect(record.id)}>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {String(startIndex + index + 1).padStart(2, '0')}
                  </TableCell>
                  <TableCell className="font-black text-[#12335f]">
                    {record.trackingNumber || `DLV-${record.id}`}
                  </TableCell>
                  <TableCell>
                    <p className="font-black text-slate-900">
                      {record.purchaseOrder?.title || record.purchaseOrder?.poNumber || `Delivery ${record.id}`}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500">
                      {record.purchaseOrder?.poNumber}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    <p className="text-slate-700">
                      <span className="font-bold">Seller:</span> {record.purchaseOrder?.seller?.name || '—'}
                    </p>
                    <p className="text-slate-500">
                      <span className="font-bold">Buyer:</span> {record.purchaseOrder?.buyer?.name || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    <p className="font-bold">{record.carrierName || record.logisticsPartnerName || 'Pending'}</p>
                    {record.currentLocation && (
                      <p className="text-[10px] text-slate-500">{record.currentLocation}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(record.expectedDelivery)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold">
                    {formatCurrency(record.purchaseOrder?.amount)}
                  </TableCell>
                  <TableCell>
                    <DeliveryStatusBadge status={record.status} />
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
      </CardContent>
    </Card>
  );
}

/* ---------- Grid (cards) view ---------- */

function GridView({ records, startIndex, page, pageSize, total, onSelect, onPageChange, onPageSizeChange }: ViewProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {records.map((record, index) => (
          <button
            key={record.id}
            type="button"
            onClick={() => onSelect(record.id)}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#12335f]/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-[10px] font-black text-slate-500">
                  {String(startIndex + index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">
                    {record.trackingNumber || `DLV-${record.id}`}
                  </p>
                  <p className="mt-1 break-words text-sm font-black text-slate-900">
                    {record.purchaseOrder?.title || record.purchaseOrder?.poNumber || `Delivery ${record.id}`}
                  </p>
                  <p className="mt-1 break-words text-[10px] font-semibold text-slate-500">
                    {record.purchaseOrder?.seller?.name || 'Seller'} → {record.purchaseOrder?.buyer?.name || 'Buyer'}
                  </p>
                </div>
              </div>
              <DeliveryStatusBadge status={record.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
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
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Location</p>
                <p className="mt-0.5 text-xs font-bold text-slate-800">{record.currentLocation || 'Pending'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Value</p>
                <p className="mt-0.5 text-xs font-bold text-slate-800">
                  {formatCurrency(record.purchaseOrder?.amount)}
                </p>
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

function MetricCard({ label, value, hint, icon: Icon }: { label: string; value: number; hint: string; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{hint}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#12335f] text-white">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-black text-slate-900">{value}</p>
    </div>
  );
}

export default DeliveryListPage;
