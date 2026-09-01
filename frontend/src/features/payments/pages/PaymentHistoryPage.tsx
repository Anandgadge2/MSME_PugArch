import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  LayoutGrid,
  List,
  RefreshCw,
  Receipt,
  Search,
  ShieldCheck,
  X,
  Lock,
  ArrowRight,
  FileSpreadsheet,
  Terminal,
  ChevronUp,
  ChevronDown,
  IndianRupee,
  Download,
  Printer,
  Upload,
  FileCheck,
  RotateCcw,
  XCircle,
  AlertCircle,
  MoreVertical
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';

import { cn } from '../../../lib/utils';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDate } from '../../shared/format';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { PageTableSkeleton } from '../../../components/ui/skeleton';
import { useResponsiveViewMode, usePaginatedFeatureQuery } from '../../shared/hooks';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import { PaymentReceiptUploadModal } from '../components/PaymentReceiptUploadModal';
import { PaymentReceiptViewModal } from '../components/PaymentReceiptViewModal';

type PaymentRow = {
  id: number;
  referenceId: string;
  amount: string | number;
  currency?: string;
  status?: string;
  gateway?: string;
  method?: string;
  invoiceId?: number;
  purchaseOrderId?: number;
  createdAt?: string;
  completedAt?: string;
  payer?: { id: number; name?: string; email?: string };
  payee?: { id: number; name?: string; email?: string };
  invoice?: { id: number; invoiceNumber?: string; status?: string };
  purchaseOrder?: { id: number; poNumber?: string; title?: string };
  metadata?: any;
  ledgerEntries?: Array<{
    id: number;
    debitAccount?: string;
    creditAccount?: string;
    entryType: string;
    amount: string | number;
    createdAt?: string;
  }>;
  escrowAccount?: {
    id: number;
    status?: string;
    amount?: string | number;
    fundedAt?: string;
    releasedAt?: string;
  };
};
type PaymentSortKey = 'reference' | 'parties' | 'gateway' | 'amount' | 'tax' | 'escrow' | 'ledger' | 'status' | 'date';

export default function PaymentHistoryPage({ admin = false }: { admin?: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState('');
  const [escrowFilter, setEscrowFilter] = useState('');
  const [viewMode, setViewMode] = useResponsiveViewMode(`phase7:payment-history:${admin ? 'admin' : 'user'}:view-mode`);
  const [sortKey, setSortKey] = useState<PaymentSortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [detailTab, setDetailTab] = useState<'receipt' | 'timeline'>('receipt');
  const [selected, setSelected] = useState<PaymentRow | null>(null);

  const [uploadProofModalOpen, setUploadProofModalOpen] = useState(false);
  const [selectedProofPayment, setSelectedProofPayment] = useState<PaymentRow | null>(null);
  const [viewProofModalOpen, setViewProofModalOpen] = useState(false);
  const [viewProofPayment, setViewProofPayment] = useState<PaymentRow | null>(null);
  const [openKebabId, setOpenKebabId] = useState<number | null>(null);

  useEffect(() => {
    if (!openKebabId) return;
    const handleClickOutside = () => setOpenKebabId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openKebabId]);

  const { records: payments, warning, loading, refreshing, error, reload, page, pageSize, total, setPage, setPageSize } = usePaginatedFeatureQuery<PaymentRow>('/api/payments', {
    ...(searchTerm.trim() ? { q: searchTerm.trim() } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(gatewayFilter ? { gateway: gatewayFilter } : {})
  }, 20);

  const paymentSummary = useMemo(() => {
    const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const successful = payments.filter(payment => ['success', 'escrow_released', 'offline_proof_verified'].includes(String(payment.status || '').toLowerCase()));
    const settledValue = successful.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const escrowHeldValue = payments
      .filter(payment => String(payment.escrowAccount?.status || '').toLowerCase() === 'held')
      .reduce((sum, payment) => sum + Number(payment.escrowAccount?.amount || payment.amount || 0), 0);
    const refunded = payments.filter(payment => String(payment.status || '').toLowerCase() === 'refunded').length;
    const failed = payments.filter(payment => ['failed', 'cancelled'].includes(String(payment.status || '').toLowerCase())).length;
    const successRate = payments.length ? Math.round((successful.length / payments.length) * 100) : 0;
    return { totalAmount, successful: successful.length, settledValue, escrowHeldValue, refunded, failed, successRate };
  }, [payments]);

  const filtered = useMemo(() => {
    return payments
      .filter(payment => {
        // Status filter
        if (statusFilter) {
          const s = String(payment.status || '').toLowerCase();
          const target = statusFilter.toLowerCase();
          if (target === 'success') {
            const isSuccess = ['success', 'completed', 'escrow_released', 'offline_proof_verified'].includes(s);
            if (!isSuccess) return false;
          } else if (!s.includes(target)) {
            return false;
          }
        }

        // Gateway filter
        if (gatewayFilter) {
          const g = String(payment.gateway || '').toLowerCase();
          const m = String(payment.method || '').toLowerCase();
          const target = gatewayFilter.toLowerCase();
          if (!g.includes(target) && !m.includes(target)) return false;
        }

        // Escrow filter
        if (escrowFilter) {
          const hasEscrow = Boolean(payment.escrowAccount);
          if (escrowFilter === 'funded' && !hasEscrow) return false;
          if (escrowFilter === 'not_funded' && hasEscrow) return false;
        }

        // Search term filter
        if (searchTerm.trim()) {
          const q = searchTerm.trim().toLowerCase();
          const ref = String(payment.referenceId || '').toLowerCase();
          const inv = String(payment.invoice?.invoiceNumber || payment.invoiceId || '').toLowerCase();
          const po = String(payment.purchaseOrder?.poNumber || '').toLowerCase();
          const payer = String(payment.payer?.name || payment.payer?.email || '').toLowerCase();
          const payee = String(payment.payee?.name || payment.payee?.email || '').toLowerCase();
          const matches = ref.includes(q) || inv.includes(q) || po.includes(q) || payer.includes(q) || payee.includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const valueFor = (payment: PaymentRow) => {
          if (sortKey === 'reference') return payment.referenceId || '';
          if (sortKey === 'parties') return `${payment.payer?.name || ''} ${payment.payee?.name || ''}`;
          if (sortKey === 'gateway') return `${payment.gateway || 'manual'} ${payment.method || ''}`;
          if (sortKey === 'amount') return Number(payment.amount || 0);
          if (sortKey === 'escrow') return payment.escrowAccount?.status || 'not_funded';
          if (sortKey === 'status') return payment.status || '';
          return new Date(payment.completedAt || payment.createdAt || 0).getTime();
        };
        const av = valueFor(a);
        const bv = valueFor(b);
        const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDirection === 'asc' ? result : -result;
      });
  }, [payments, statusFilter, gatewayFilter, escrowFilter, searchTerm, sortKey, sortDirection]);
  const pagedPayments = filtered;

  const toggleSort = (field: PaymentSortKey) => {
    setSortDirection(prev => sortKey === field && prev === 'asc' ? 'desc' : 'asc');
    setSortKey(field);
    setPage(1);
  };

  const isKpisLoading = loading && filtered.length === 0;

  if (isKpisLoading) {
    return (
      <div className="space-y-6 pt-4">
        <PageTableSkeleton kpiCount={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transparent Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Payment History</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Payment status, escrow linkage, tax/TDS summary, and immutable ledger entries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setSelectedProofPayment(null); setUploadProofModalOpen(true); }}
            className="h-10 rounded-lg text-xs font-black uppercase bg-[#12335f] hover:bg-[#0b2445] text-white shadow-sm"
          >
            <Upload className="mr-2 h-4 w-4" /> Upload Payment Proof
          </Button>
          <Button variant="outline" onClick={reload} className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm">
            <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", refreshing && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {typeof window !== 'undefined' && window.location.pathname.includes('/transactions') ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Total Transactions"
            value={total || payments.length}
            subtext="Total transactions"
            icon={CreditCard}
            active={true}
            color="blue"
          />
          <KpiCard
            label="Successful"
            value={paymentSummary.successful}
            subtext="Successful transactions"
            icon={ShieldCheck}
            color="green"
          />
          <KpiCard
            label="Total Amount"
            value={formatCurrency(paymentSummary.totalAmount)}
            subtext="Total transaction amount"
            icon={IndianRupee}
            color="indigo"
          />
          <KpiCard
            label="Success Rate"
            value={`${paymentSummary.successRate}%`}
            subtext="Transaction success rate"
            icon={CheckCircle2}
            color="purple"
          />
          <KpiCard
            label="Refunded"
            value={paymentSummary.refunded}
            subtext="Refunded transactions"
            icon={RotateCcw}
            color="amber"
          />
          <KpiCard
            label="Failed"
            value={paymentSummary.failed}
            subtext="Failed transactions"
            icon={XCircle}
            color="red"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Payments"
            value={total || payments.length}
            subtext="Total payments"
            icon={CreditCard}
            active={true}
            color="blue"
          />
          <KpiCard
            label="Successful"
            value={paymentSummary.successful}
            subtext="Successful payments"
            icon={ShieldCheck}
            color="green"
          />
          <KpiCard
            label="Visible Value"
            value={formatCurrency(paymentSummary.totalAmount)}
            subtext="Payment amount"
            icon={IndianRupee}
            color="indigo"
          />
          <KpiCard
            label="Success Rate"
            value={`${paymentSummary.successRate}%`}
            subtext="Payment success rate"
            icon={CheckCircle2}
            color="purple"
          />
          <KpiCard
            label="Settled Value"
            value={formatCurrency(paymentSummary.settledValue)}
            subtext="Settled payments"
            icon={Receipt}
            color="blue"
          />
          <KpiCard
            label="Escrow Held"
            value={formatCurrency(paymentSummary.escrowHeldValue)}
            subtext="Escrow amount held"
            icon={Lock}
            color="amber"
          />
        </div>
      )}

      {error && <InlineError message={error} onRetry={reload} />}
      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          {warning}
        </div>
      )}

      {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <ResponsiveFilterBar
          activeFilterCount={(statusFilter ? 1 : 0) + (gatewayFilter ? 1 : 0) + (escrowFilter ? 1 : 0)}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                placeholder="Search reference, invoice, PO..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
            </div>
          }
          filters={
            <>
              <div className="w-full sm:w-auto sm:min-w-[140px]">
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="">All statuses</option>
                  <option value="initiated">Initiated</option>
                  <option value="gateway_order_created">Gateway order</option>
                  <option value="success">Success</option>
                  <option value="escrow_released">Escrow released</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[140px]">
                <select
                  value={gatewayFilter}
                  onChange={e => { setGatewayFilter(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="">Gateway / any</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="cashfree">Cashfree</option>
                </select>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[140px]">
                <select
                  value={escrowFilter}
                  onChange={e => { setEscrowFilter(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="">Escrow / any</option>
                  <option value="funded">Funded</option>
                  <option value="not_funded">Not funded</option>
                </select>
              </div>
            </>
          }
          endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No payments found"
          description={searchTerm || statusFilter || gatewayFilter || escrowFilter
            ? 'No transactions match the current search, status, gateway, or escrow filters.'
            : admin
              ? 'No payment transactions have been recorded yet. Payments appear after invoice checkout, offline proof verification, or escrow settlement.'
              : 'No transactions are linked to your account yet. Payments appear after invoice checkout, offline proof verification, or escrow release.'}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pagedPayments.map((payment, index) => {
            const tax = payment.metadata?.taxSummary || {};
            const rowIndex = (page - 1) * pageSize + index + 1;
            return (
              <div key={payment.id} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#12335f]/40 hover:shadow-md flex flex-col justify-between">
                <div className="w-full space-y-3">
                  <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[9px] font-black text-slate-500">
                          {String(rowIndex).padStart(2, '0')}
                        </span>
                        <EntityIdLink label={payment.referenceId} id={payment.id} size="sm" onClick={() => { setDetailTab('receipt'); setSelected(payment); }} />
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-500 font-semibold">Invoice: {payment.invoice?.invoiceNumber || payment.invoiceId || '-'}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-700">
                      {String(payment.status || 'initiated').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-3">
                    <InfoTile label="Gateway" value={`${payment.gateway || 'manual'} / ${payment.method || 'bank_transfer'}`} />
                    <InfoTile label="Amount" value={formatCurrency(payment.amount)} />
                    <InfoTile label="PO Number" value={payment.purchaseOrder?.poNumber || '-'} />
                    <InfoTile label="Tax/TDS" value={`GST ${formatCurrency(tax.totalTaxAmount || 0)} | TDS ${formatCurrency(tax.tdsAmount || 0)}`} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-wider text-slate-500 border-t border-slate-100 pt-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5">Payer: {payment.payer?.name || `Payer #${payment.payer?.id}`}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5">Payee: {payment.payee?.name || `Payee #${payment.payee?.id}`}</span>
                  </div>

                  {(() => {
                    const hasUploadedProof = Boolean(
                      payment.metadata?.offlineProofId ||
                      payment.metadata?.receiptFileUrl ||
                      ['offline_proof_uploaded', 'offline_proof_verified', 'under_review', 'payment_initiated'].includes(String(payment.status || '').toLowerCase())
                    );
                    return (
                      <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-1 rounded-lg text-[10px] font-black uppercase text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100"
                          onClick={() => { setViewProofPayment(payment); setViewProofModalOpen(true); }}
                        >
                          <FileCheck className="mr-1.5 h-3.5 w-3.5" /> Proof
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-8 flex-1 rounded-lg text-[10px] font-black uppercase shadow-none",
                            hasUploadedProof
                              ? "text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100"
                              : "text-slate-700 border-slate-200 hover:bg-slate-50"
                          )}
                          onClick={() => {
                            if (hasUploadedProof) {
                              setViewProofPayment(payment);
                              setViewProofModalOpen(true);
                            } else {
                              setSelectedProofPayment(payment);
                              setUploadProofModalOpen(true);
                            }
                          }}
                          title={hasUploadedProof ? "View Buyer Uploaded Slip" : "Upload Slip"}
                        >
                          <Upload className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Slip
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-1 rounded-lg text-[10px] font-black uppercase text-slate-700 border-slate-200 hover:bg-slate-50"
                          onClick={() => { setDetailTab('receipt'); setSelected(payment); }}
                        >
                          <Receipt className="mr-1.5 h-3.5 w-3.5" /> Receipt
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 flex-1 rounded-lg text-[10px] font-black uppercase bg-[#12335f] text-white hover:bg-[#0b2445]"
                          onClick={() => { setDetailTab('timeline'); setSelected(payment); }}
                        >
                          <Clock3 className="mr-1.5 h-3.5 w-3.5" /> Track
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col">
          <div className="overflow-x-auto w-full min-h-[260px]">
            <table data-ux-wrapped="true" className="w-full min-w-[1080px] border-collapse text-left text-xs mb-6">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 hover:bg-transparent">
                    <th className="p-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-16">Sr. No</th>
                    <th className="p-3"><SortableHeader label="Reference" field="reference" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3"><SortableHeader label="Parties" field="parties" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3"><SortableHeader label="Gateway" field="gateway" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3"><SortableHeader label="Amount" field="amount" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3"><SortableHeader label="Tax/TDS" field="tax" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3"><SortableHeader label="Escrow Vault" field="escrow" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3"><SortableHeader label="Ledger Entries" field="ledger" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3"><SortableHeader label="Status" field="status" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3"><SortableHeader label="Date" field="date" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                    <th className="p-3 text-right w-16 text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {pagedPayments.map((payment, index) => {
                    const tax = payment.metadata?.taxSummary || {};
                    const isSuccess = ['success', 'escrow_released'].includes(payment.status || '');
                    const rowNumber = (page - 1) * pageSize + index + 1;

                    return (
                      <tr key={payment.id} className={cn("hover:bg-slate-50/50 transition cursor-pointer", openKebabId === payment.id ? "relative z-50" : "relative z-0 hover:z-10")} onClick={() => { setDetailTab('receipt'); setSelected(payment); }}>
                        <td className="p-3 font-mono text-xs text-slate-500">{rowNumber}</td>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <EntityIdLink label={payment.referenceId} id={payment.id} size="sm" onClick={() => { setDetailTab('receipt'); setSelected(payment); }} />
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">
                            Invoice {payment.invoice?.invoiceNumber || payment.invoiceId || '-'}
                          </p>
                        </td>
                        <td className="p-3 text-[10px] font-bold text-slate-500">
                          From {payment.payer?.name || `#${payment.payer?.id || '-'}`}
                          <br />
                          To {payment.payee?.name || `#${payment.payee?.id || '-'}`}
                        </td>
                        <td className="p-3 text-xs font-bold uppercase text-slate-600">
                          {payment.gateway || 'manual'} / {payment.method || 'bank_transfer'}
                        </td>
                        <td className="p-3 text-xs font-black text-slate-900">{formatCurrency(payment.amount)}</td>
                        <td className="p-3 text-[10px] font-bold text-slate-500">
                          GST {formatCurrency(tax.totalTaxAmount || 0)} | TDS {formatCurrency(tax.tdsAmount || 0)}
                        </td>
                        <td className="p-3">
                          {payment.escrowAccount ? (
                            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-black uppercase ${payment.escrowAccount.status === 'held'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                              : 'bg-slate-50 text-[#12335f] border border-blue-200/50'
                              }`}>
                              <Lock className="h-2.5 w-2.5" /> #{payment.escrowAccount.id} {payment.escrowAccount.status}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 italic">Not funded</span>
                          )}
                        </td>
                        <td className="p-3 text-xs font-bold text-slate-600">
                          <span className="flex items-center gap-1 font-mono text-xs text-slate-900 bg-slate-50 px-2 py-0.5 rounded w-max border border-slate-100">
                            <FileSpreadsheet className="h-3 w-3" /> {payment.ledgerEntries?.length || 0} items
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`rounded-lg border px-2.5 py-0.5 text-[9px] font-black uppercase ${isSuccess
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : payment.status === 'failed'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-blue-200 bg-slate-50 text-[#12335f]'
                            }`}>
                            {String(payment.status || 'initiated').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-xs font-bold text-slate-500">
                          {formatDate(payment.completedAt || payment.createdAt)}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="relative inline-flex items-center justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenKebabId(openKebabId === payment.id ? null : payment.id);
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs focus:outline-none"
                              title="Actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {openKebabId === payment.id && (
                              <div className={cn(
                                "absolute right-0 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 flex flex-col gap-0.5 text-left animate-in fade-in zoom-in-95 duration-100",
                                pagedPayments.length > 2 && index >= pagedPayments.length - 2 ? "bottom-full mb-1.5 origin-bottom-right" : "top-full mt-1.5 origin-top-right"
                              )}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    setViewProofPayment(payment);
                                    setViewProofModalOpen(true);
                                  }}
                                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-blue-700 hover:bg-blue-50 transition-colors text-left"
                                >
                                  <FileCheck className="h-3.5 w-3.5 text-blue-600" />
                                  <span>View Proof</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    setSelectedProofPayment(payment);
                                    setUploadProofModalOpen(true);
                                  }}
                                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
                                >
                                  <Upload className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Upload Slip</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    setDetailTab('receipt');
                                    setSelected(payment);
                                  }}
                                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
                                >
                                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                                  <span>View Receipt</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    setDetailTab('timeline');
                                    setSelected(payment);
                                  }}
                                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
                                >
                                  <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Track Timeline</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="payments" />
        </div>
      )}

      {selected && (
        <PaymentDetail
          key={`${selected.id}-${detailTab}`}
          payment={selected}
          initialTab={detailTab}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Offline Payment Proof Modals */}
      <PaymentReceiptUploadModal
        isOpen={uploadProofModalOpen}
        onClose={() => { setUploadProofModalOpen(false); setSelectedProofPayment(null); }}
        payment={selectedProofPayment}
        onSuccess={() => { void reload(); }}
      />

      <PaymentReceiptViewModal
        isOpen={viewProofModalOpen}
        onClose={() => { setViewProofModalOpen(false); setViewProofPayment(null); }}
        paymentId={viewProofPayment?.id}
        orderId={viewProofPayment?.purchaseOrderId}
        invoiceId={viewProofPayment?.invoiceId}
        onStatusChange={() => { void reload(); }}
      />
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

const paymentTimeline = (payment: PaymentRow) => {
  const events: Array<{ title: string; timestamp?: string; detail?: string }> = [];
  if (payment.createdAt) {
    events.push({ title: 'Payment created', timestamp: payment.createdAt });
  }
  if (payment.status) {
    events.push({ title: `Status changed to ${payment.status.replace(/_/g, ' ')}`, timestamp: payment.completedAt || payment.createdAt, detail: `${payment.gateway || 'gateway'} transaction` });
  }
  if (payment.escrowAccount?.fundedAt) {
    events.push({ title: `Escrow ${payment.escrowAccount.status || 'funded'}`, timestamp: payment.escrowAccount.fundedAt, detail: `Escrow account #${payment.escrowAccount.id}` });
  }
  payment.ledgerEntries?.forEach(entry => {
    events.push({ title: `${entry.entryType} ledger entry`, timestamp: entry.createdAt, detail: `${formatCurrency(entry.amount)} ${entry.debitAccount || 'debit'} → ${entry.creditAccount || 'credit'}` });
  });
  if (payment.completedAt && payment.completedAt !== payment.createdAt) {
    events.push({ title: 'Payment completed', timestamp: payment.completedAt });
  }
  return events.filter(event => event.timestamp).sort((a, b) => new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime());
};

function PaymentDetail({ payment, initialTab, onClose }: { payment: PaymentRow; initialTab?: 'receipt' | 'timeline'; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'receipt' | 'timeline'>(initialTab || 'receipt');
  const tax = payment.metadata?.taxSummary || {};
  const status = String(payment.status || 'initiated').replace(/_/g, ' ');
  const gateway = String(payment.gateway || 'manual').replace(/_/g, ' ');
  const method = String(payment.method || 'bank transfer').replace(/_/g, ' ');
  const receiptDate = payment.completedAt || payment.createdAt;
  const timelineItems = paymentTimeline(payment);

  const handleDownloadReceipt = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    const formattedStatus = status.toUpperCase();
    const formattedDate = formatDate(receiptDate);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${payment.referenceId}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 28px; background: #ffffff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #12335f; padding-bottom: 16px; margin-bottom: 24px; }
            .portal-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #12335f; }
            .title { font-size: 26px; font-weight: 900; margin: 4px 0 0; color: #0f172a; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 500; }
            .status-badge { display: inline-block; padding: 5px 14px; background: #ecfdf5; border: 1.5px solid #6ee7b7; color: #047857; font-size: 11px; font-weight: 900; text-transform: uppercase; border-radius: 6px; letter-spacing: 0.5px; }
            .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
            .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
            .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc; }
            .label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 4px; }
            .val { font-size: 14px; font-weight: 800; color: #0f172a; word-break: break-word; }
            .amount-box { background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 18px; text-align: right; margin-bottom: 24px; }
            .amount-val { font-size: 28px; font-weight: 900; color: #12335f; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background: #f1f5f9; padding: 10px 14px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 900; color: #475569; border-bottom: 1.5px solid #cbd5e1; }
            td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #334155; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="portal-title">GOVERNMENT MSME PORTAL</div>
              <div class="title">Official Payment Receipt</div>
              <div class="subtitle">System generated receipt for payment reference <strong>${payment.referenceId}</strong></div>
            </div>
            <div style="text-align: right;">
              <div class="status-badge">${formattedStatus}</div>
              <div class="label" style="margin-top: 10px;">Date: ${formattedDate}</div>
            </div>
          </div>

          <div class="grid-3">
            <div class="box">
              <div class="label">Receipt Reference</div>
              <div class="val" style="font-family: monospace; color: #12335f;">${payment.referenceId}</div>
            </div>
            <div class="box">
              <div class="label">Invoice Number</div>
              <div class="val">${String(payment.invoice?.invoiceNumber || payment.invoiceId || '-')}</div>
            </div>
            <div class="box">
              <div class="label">Purchase Order</div>
              <div class="val">${String(payment.purchaseOrder?.poNumber || '-')}</div>
            </div>
          </div>

          <div class="grid-2">
            <div class="box">
              <div class="label">Payer / Buyer</div>
              <div class="val">${payment.payer?.name || `Payer #${payment.payer?.id || '-'}`}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${payment.payer?.email || '-'}</div>
            </div>
            <div class="box">
              <div class="label">Payee / Seller</div>
              <div class="val">${payment.payee?.name || `Payee #${payment.payee?.id || '-'}`}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${payment.payee?.email || '-'}</div>
            </div>
          </div>

          <div class="amount-box">
            <div class="label" style="color: #1d4ed8;">Total Settlement Amount</div>
            <div class="amount-val">₹${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 11px; color: #475569; font-weight: 700;">Gateway: ${gateway} | Method: ${method}</div>
          </div>

          <div style="margin-top: 24px;">
            <div class="label">Tax and Deduction Summary</div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Taxable Amount</td><td style="text-align: right;">₹${Number(tax.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>CGST</td><td style="text-align: right;">₹${Number(tax.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>SGST</td><td style="text-align: right;">₹${Number(tax.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>IGST</td><td style="text-align: right;">₹${Number(tax.igstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>TDS Deducted</td><td style="text-align: right; color: #b91c1c;">-₹${Number(tax.tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                <tr style="font-weight: 900; background: #f8fafc;">
                  <td>Net Amount Paid</td>
                  <td style="text-align: right; color: #12335f; font-size: 14px;">₹${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          ${payment.escrowAccount ? `
            <div style="margin-top: 24px;">
              <div class="label">Escrow Custody Status</div>
              <div class="box" style="background: #f0fdf4; border-color: #bbf7d0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 11px; font-weight: 900; color: #15803d; text-transform: uppercase;">Escrow Account VAULT-${payment.escrowAccount.id}</div>
                    <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px;">Custody Balance: ₹${Number(payment.escrowAccount.amount || payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style="font-size: 11px; font-weight: 900; padding: 4px 10px; background: #ffffff; border: 1px solid #86efac; border-radius: 4px; color: #15803d; text-transform: uppercase;">
                    ${payment.escrowAccount.status || 'held'}
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="footer">
            <p>This is an official computer generated payment receipt from the Government MSME Portal finance module.</p>
            <p>Valid for tax filing, financial reconciliation, audit review, and escrow settlement verification.</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-3 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Government MSME Portal</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Payment Receipt</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              System generated receipt for payment reference <span className="font-black text-slate-900">{payment.referenceId}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownloadReceipt}
              className="h-9 bg-[#12335f] text-white hover:bg-[#0b2445] text-xs font-black uppercase tracking-wider rounded-lg shadow-sm"
            >
              <Download className="mr-1.5 h-4 w-4" /> Download / Print PDF
            </Button>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase text-emerald-700">
              {status}
            </span>
            <button
              onClick={onClose}
              aria-label="Close receipt"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-5">
          <div className="mx-auto space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
              <div className="px-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Receipt Record</p>
                <p className="text-sm font-black text-slate-900">
                  {activeTab === 'receipt' ? 'Official payment receipt and settlement summary' : 'Payment status timeline'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadReceipt} className="bg-white hover:bg-slate-50 border-slate-300 font-bold text-slate-800 shadow-sm">
                  <Printer className="mr-1.5 h-3.5 w-3.5 text-[#12335f]" /> Print
                </Button>
                <Button variant={activeTab === 'receipt' ? 'primary' : 'outline'} size="sm" onClick={() => setActiveTab('receipt')}>
                  <Receipt className="mr-1 h-3.5 w-3.5" />Receipt
                </Button>
                <Button variant={activeTab === 'timeline' ? 'primary' : 'outline'} size="sm" onClick={() => setActiveTab('timeline')}>
                  <Clock3 className="mr-1 h-3.5 w-3.5" />Timeline
                </Button>
              </div>
            </div>

            {activeTab === 'receipt' ? (
              <div className="rounded-lg border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex flex-col gap-2.5 sm:gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Receipt No.</p>
                      <p className="mt-1 font-mono text-lg font-black text-[#12335f]">{payment.referenceId}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Issued by MSME Portal Finance System</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Receipt Date</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{formatDate(receiptDate)}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-slate-500">Currency: {payment.currency || 'INR'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid border-b border-slate-200 md:grid-cols-3">
                  <ReceiptField label="Invoice" value={String(payment.invoice?.invoiceNumber || payment.invoiceId || '-')} />
                  <ReceiptField label="Purchase Order" value={String(payment.purchaseOrder?.poNumber || '-')} />
                  <ReceiptField label="Gateway / Method" value={`${gateway} / ${method}`} />
                </div>

                <div className="grid gap-4 border-b border-slate-200 p-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <section className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Transaction Parties</p>
                    <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">
                      <PartyBlock label="Payer / Buyer" name={payment.payer?.name || `Payer #${payment.payer?.id || '-'}`} email={payment.payer?.email} />
                      <PartyBlock label="Payee / Seller" name={payment.payee?.name || `Payee #${payment.payee?.id || '-'}`} email={payment.payee?.email} />
                    </div>
                  </section>

                  <section className="rounded-lg border border-[#12335f]/20 bg-[#12335f]/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Amount Paid</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{formatCurrency(payment.amount)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Settlement status: {status}</p>
                  </section>
                </div>

                <div className="grid gap-4 border-b border-slate-200 p-5 lg:grid-cols-2">
                  <section className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tax and Deduction Summary</p>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <AmountRow label="Taxable Amount" value={formatCurrency(tax.taxableAmount || 0)} />
                      <AmountRow label="CGST" value={formatCurrency(tax.cgstAmount || 0)} />
                      <AmountRow label="SGST" value={formatCurrency(tax.sgstAmount || 0)} />
                      <AmountRow label="IGST" value={formatCurrency(tax.igstAmount || 0)} />
                      <AmountRow label="TDS Deducted" value={`-${formatCurrency(tax.tdsAmount || 0)}`} muted />
                      <AmountRow label="Settlement Amount" value={formatCurrency(payment.amount)} strong />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Escrow Custody</p>
                    {payment.escrowAccount ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Escrow Account</p>
                            <p className="mt-1 font-mono text-sm font-black text-slate-900">VAULT-{payment.escrowAccount.id}</p>
                          </div>
                          <span className="rounded border border-emerald-300 bg-white px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                            {payment.escrowAccount.status || 'held'}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                          <ReceiptMini label="Custody Balance" value={formatCurrency(payment.escrowAccount.amount || payment.amount)} />
                          <ReceiptMini label="Funded On" value={formatDate(payment.escrowAccount.fundedAt || payment.completedAt)} />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-black text-slate-800">Escrow not funded</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          No escrow account is linked to this payment record yet.
                        </p>
                      </div>
                    )}
                  </section>
                </div>

                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-2.5 sm:gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Double-Entry Financial Ledger</p>
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                      <ShieldCheck className="h-3 w-3" /> Verified Format
                    </span>
                  </div>
                  {(payment.ledgerEntries || []).length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                      Ledger entry is pending for this payment record.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <tr>
                            <th className="w-16 p-3">Sr. No</th>
                            <th className="p-3">Entry</th>
                            <th className="p-3">Debit Account</th>
                            <th className="p-3">Credit Account</th>
                            <th className="p-3 text-right">Amount</th>
                            <th className="p-3">Recorded On</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {payment.ledgerEntries?.map((entry, index) => (
                            <tr key={entry.id}>
                              <td className="p-3 text-xs font-black text-slate-500">{String(index + 1).padStart(2, '0')}</td>
                              <td className="p-3 font-black uppercase text-slate-800">{entry.entryType.replace(/_/g, ' ')}</td>
                              <td className="p-3 font-mono font-semibold text-slate-600">{entry.debitAccount || '-'}</td>
                              <td className="p-3 font-mono font-semibold text-slate-600">{entry.creditAccount || '-'}</td>
                              <td className="p-3 text-right font-black text-slate-950">{formatCurrency(entry.amount)}</td>
                              <td className="p-3 font-semibold text-slate-500">{formatDate(entry.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs font-semibold text-slate-500">
                  This is a computer generated receipt from the MSME Portal finance module. It is valid for internal payment tracking,
                  reconciliation, and audit review when matched with the linked invoice and purchase order.
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Transaction Timeline</p>
                <div className="mt-4 space-y-3">
                  {timelineItems.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                      No timestamped events are available for this payment.
                    </div>
                  ) : (
                    timelineItems.map((item, index) => (
                      <div key={index} className="flex gap-2.5 sm:gap-3 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#12335f] text-white">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                            <p className="text-sm font-black text-slate-900">{item.title}</p>
                            <p className="text-[10px] font-black uppercase text-slate-400">{formatDate(item.timestamp)}</p>
                          </div>
                          {item.detail && <p className="mt-1 text-xs font-semibold text-slate-500">{item.detail}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r last:md:border-r-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function PartyBlock({ label, name, email }: { label: string; name: string; email?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-900">{name}</p>
      <p className="mt-1 break-words text-xs font-semibold text-slate-500">{email || '-'}</p>
    </div>
  );
}

function AmountRow({ label, value, strong = false, muted = false }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0', strong && 'bg-[#12335f]/5')}>
      <p className="text-xs font-bold text-slate-600">{label}</p>
      <p className={cn('text-right text-xs font-black text-slate-900', strong && 'text-sm text-[#12335f]', muted && 'text-red-700')}>{value}</p>
    </div>
  );
}

function ReceiptMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{label}</p>
      <p className="mt-1 font-bold text-slate-800">{value}</p>
    </div>
  );
}
