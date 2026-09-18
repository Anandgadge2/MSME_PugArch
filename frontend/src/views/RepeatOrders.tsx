import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Copy,
  Layers,
  FileCheck,
  Info,
  ChevronRight,
  Lock,
  CalendarClock,
  X,
  Send,
  PackageCheck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { EmptyState } from '../features/shared/FeatureStates';
import { formatCurrency, formatDate } from '../features/shared/format';
import { useFeatureQuery } from '../features/shared/hooks';
import { useAuth } from '../hooks/useAuth';
import type { PurchaseOrderDto } from '../features/shared/types';
import { PageTableSkeleton } from '../components/ui/skeleton';
import { FocusTrap } from '../components/ui/FocusTrap';

export interface PreviousPoItem {
  id: number;
  productId?: number | null;
  itemName: string;
  description?: string | null;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  taxRate: number;
  gstRate?: number;
  hsnSac?: string;
  hsnCode?: string;
  specifications?: Record<string, any> | string | null;
  totalAmount: number;
}

export interface PreviousPoDto {
  id: number;
  poNumber: string;
  title: string;
  amount: number;
  totalValue: number;
  currency: string;
  status: string;
  poStatus?: string;
  poDate: string;
  expectedDelivery?: string;
  tenderId?: number | null;
  contractId?: number | null;
  procurementId: string;
  procurementTitle: string;
  supplierName: string;
  procurementDetails: {
    procurementId: string;
    procurementTitle: string;
    category: string;
    procurementMethod: string;
    tenderId?: string | null;
  };
  buyerDetails: {
    id: number;
    name: string;
    email: string;
    mobile?: string;
    organizationName: string;
    gstin: string;
    panNumber: string;
    address: string;
  };
  supplierDetails: {
    id: number;
    name: string;
    organizationName: string;
    email: string;
    mobile: string;
    gstin: string;
    panNumber: string;
    address: string;
    isSupplierActive: boolean;
  };
  items: PreviousPoItem[];
  orderedQuantity: number;
  deliveredQuantity: number;
  pendingQuantity: number;
  deliveryLocation: string;
  paymentTerms: string;
  deliveryTerms: string;
  commercialTerms: string;
  requiredDocs: Array<{ name: string; mandatory: boolean }>;
  originalProcurementMethod: string;
  prNumber?: string | null;
}

type WizardStep = 1 | 2 | 3 | 4;
type ViewTab = 'wizard' | 'history';

export default function RepeatOrders() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Role guard: Only buyers can create repeat purchase orders
  useEffect(() => {
    if (user && user.role !== 'buyer' && user.role !== 'admin' && user.role !== 'master_admin') {
      router.replace('/orders');
    }
  }, [user, router]);

  const [activeTab, setActiveTab] = useState<ViewTab>('wizard');
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Search & Filter state in Step 1
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Selection & Details state
  const [selectedPo, setSelectedPo] = useState<PreviousPoDto | null>(null);
  const [inspectingPo, setInspectingPo] = useState<PreviousPoDto | null>(null);

  // Step 3 Editable Dates
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultDeliveryIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  }, []);

  const [repeatOrderDate, setRepeatOrderDate] = useState<string>(todayIso);
  const [requiredByDate, setRequiredByDate] = useState<string>(defaultDeliveryIso);
  const [newDeliveryDate, setNewDeliveryDate] = useState<string>(defaultDeliveryIso);
  const [remarks, setRemarks] = useState<string>('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    purchaseOrder: any;
    approvalInfo?: { requiresApproval: boolean; currentStage: string; message: string };
    message?: string;
  } | null>(null);

  // Active sub-tab in Step 2 read-only details preview
  const [activeDetailSection, setActiveDetailSection] = useState<'procurement' | 'supplier' | 'items' | 'terms'>('items');

  const viewerScope = `${user?.role || 'buyer'}-${user?.id || 'none'}`;

  // Fetch eligible previous POs
  const {
    data: rawPosResponse,
    loading: loadingPreviousPos,
    reload: reloadPreviousPos
  } = useFeatureQuery<{ results: PreviousPoDto[] } | PreviousPoDto[]>(
    `/api/procurement/repeat-order/previous-pos`,
    { results: [] }
  );

  const eligibleOrders: PreviousPoDto[] = useMemo(() => {
    if (!rawPosResponse) return [];
    if (Array.isArray(rawPosResponse)) return rawPosResponse;
    if (Array.isArray((rawPosResponse as any).results)) return (rawPosResponse as any).results;
    return [];
  }, [rawPosResponse]);

  // Fetch all orders for Repeat Orders History tab
  const {
    data: allOrders,
    loading: loadingAllOrders,
    reload: reloadAllOrders
  } = useFeatureQuery<PurchaseOrderDto[]>(
    `/api/purchase-orders?take=100&viewerScope=${encodeURIComponent(viewerScope)}`,
    []
  );

  const repeatOrdersHistory = useMemo(() => {
    if (!Array.isArray(allOrders)) return [];
    return allOrders.filter(o => {
      const isRepeatMeta = (o.metadata as any)?.source === 'repeat_order' || (o.metadata as any)?.repeatOfPoId != null;
      const isRepeatPoNumber = String(o.poNumber || '').startsWith('PO-REP');
      const isRepeatTitle = String(o.title || '').toLowerCase().startsWith('repeat order');
      return isRepeatMeta || isRepeatPoNumber || isRepeatTitle;
    });
  }, [allOrders]);

  // Handle URL pre-selection: ?selectPo=<id>
  useEffect(() => {
    const selectPoId = searchParams.get('selectPo');
    if (selectPoId && eligibleOrders.length > 0) {
      const match = eligibleOrders.find(o => String(o.id) === selectPoId);
      if (match) {
        handleSelectPo(match);
      }
    }
  }, [searchParams, eligibleOrders]);

  // Filtered orders in Step 1
  const filteredOrders = useMemo(() => {
    let result = [...eligibleOrders];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(o => {
        const poNum = String(o.poNumber || '').toLowerCase();
        const procId = String(o.procurementId || '').toLowerCase();
        const title = String(o.procurementTitle || o.title || '').toLowerCase();
        const supplier = String(o.supplierName || o.supplierDetails?.organizationName || '').toLowerCase();
        return poNum.includes(q) || procId.includes(q) || title.includes(q) || supplier.includes(q);
      });
    }

    if (statusFilter !== 'All') {
      result = result.filter(o => {
        const s = String(o.status || o.poStatus || '').toLowerCase();
        return s === statusFilter.toLowerCase();
      });
    }

    return result;
  }, [eligibleOrders, searchTerm, statusFilter]);

  // Handle selecting a PO
  const handleSelectPo = (po: PreviousPoDto) => {
    setSelectedPo(po);
    setRepeatOrderDate(todayIso);
    
    // Set default new delivery date to 14 days out
    const d = new Date();
    d.setDate(d.getDate() + 14);
    const dIso = d.toISOString().split('T')[0];
    setNewDeliveryDate(dIso);
    setRequiredByDate(dIso);
    setRemarks(`Repeat purchase order as per terms of original PO #${po.poNumber}.`);
    setCurrentStep(2);
    toast.success(`Selected PO #${po.poNumber}. All procurement details auto-populated.`);
  };

  // Date Presets
  const applyDatePreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dIso = d.toISOString().split('T')[0];
    setNewDeliveryDate(dIso);
    setRequiredByDate(dIso);
  };

  // Submit Repeat Order
  const handleSubmitRepeatOrder = async () => {
    if (!selectedPo) return;
    if (!newDeliveryDate) {
      toast.error('New Delivery Date is required');
      return;
    }

    const delivDateObj = new Date(newDeliveryDate);
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    if (delivDateObj < todayObj) {
      toast.error('New Delivery Date cannot be in the past');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/api/purchase-orders/${selectedPo.id}/repeat`, {
        expectedDelivery: delivDateObj.toISOString(),
        repeatOrderDate: repeatOrderDate ? new Date(repeatOrderDate).toISOString() : new Date().toISOString(),
        requiredByDate: requiredByDate ? new Date(requiredByDate).toISOString() : delivDateObj.toISOString(),
        remarks: remarks.trim() || undefined
      });

      const data = await res.json();
      setSubmissionResult(data);
      setCurrentStep(4);
      toast.success(data?.message || 'Repeat order created successfully!');
      reloadPreviousPos();
      reloadAllOrders();
    } catch (err: any) {
      console.error('Failed to submit repeat order:', err);
      toast.error(err?.message || 'Failed to submit repeat order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset to create another repeat order
  const handleResetWizard = () => {
    setSelectedPo(null);
    setSubmissionResult(null);
    setCurrentStep(1);
    setSearchTerm('');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {/* Enhanced Compact Header */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          {/* Top Bar: Breadcrumb + Tab Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="hover:text-slate-800">Orders</span>
                <ChevronRight className="h-3 w-3 text-slate-400" />
                <span className="text-[#12335f] font-bold">Repeat Orders</span>
              </nav>
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#12335f] border border-blue-100 shrink-0">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Repeat Order Management
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#12335f] border border-blue-200/80">
                  Quick Reorder
                </span>
              </div>
            </div>

            {/* View Tab Switcher */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/70 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('wizard')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all',
                  activeTab === 'wizard'
                    ? 'bg-white text-[#12335f] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Create Repeat Order</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all',
                  activeTab === 'history'
                    ? 'bg-white text-[#12335f] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <FileCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>History ({repeatOrdersHistory.length})</span>
              </button>
            </div>
          </div>

          {/* Compact Connected Horizontal Stepper (Only in Wizard mode) */}
          {activeTab === 'wizard' && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between sm:justify-start gap-1 sm:gap-4 overflow-x-auto py-0.5">
              {[
                { stepNum: 1, label: 'Select Previous PO', short: 'Select PO' },
                { stepNum: 2, label: 'Auto-fill & New Dates', short: 'Dates' },
                { stepNum: 3, label: 'Review & Verify', short: 'Review' },
                { stepNum: 4, label: 'Approval & Generation', short: 'Approval' },
              ].map((s, idx, arr) => {
                const isDone = currentStep > s.stepNum;
                const isCurrent = currentStep === s.stepNum;
                return (
                  <React.Fragment key={s.stepNum}>
                    <div
                      className={cn(
                        'flex items-center gap-2 shrink-0 py-1 px-2 rounded-lg transition-all',
                        isCurrent
                          ? 'bg-blue-50/80 text-[#12335f]'
                          : isDone
                          ? 'text-slate-700'
                          : 'text-slate-400 opacity-70'
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black shrink-0 transition-colors',
                          isCurrent
                            ? 'bg-[#12335f] text-white ring-2 ring-blue-200'
                            : isDone
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                        )}
                      >
                        {isDone ? <Check className="h-3 w-3" /> : s.stepNum}
                      </div>
                      <span className={cn('text-xs whitespace-nowrap', isCurrent ? 'font-black text-[#12335f]' : isDone ? 'font-bold text-slate-800' : 'font-medium text-slate-400')}>
                        <span className="hidden sm:inline">{s.label}</span>
                        <span className="sm:hidden">{s.short}</span>
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div
                        className={cn(
                          'h-0.5 w-4 sm:w-8 rounded-full shrink-0 transition-colors',
                          currentStep > s.stepNum ? 'bg-emerald-500' : 'bg-slate-200'
                        )}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* VIEW TAB 2: REPEAT ORDERS HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Repeat Orders History</h2>
                <p className="text-xs text-slate-500 mt-0.5">Audit log of all repeat purchase orders generated across the organization.</p>
              </div>
              <Button
                onClick={() => {
                  setActiveTab('wizard');
                  setCurrentStep(1);
                }}
                className="bg-[#12335f] text-white hover:bg-[#0b2445] text-xs font-black uppercase tracking-wider rounded-xl h-10 px-4 shadow-sm"
              >
                <Sparkles className="mr-1.5 h-4 w-4" /> Place New Repeat Order
              </Button>
            </div>

            {loadingAllOrders ? (
              <PageTableSkeleton rows={5} />
            ) : repeatOrdersHistory.length === 0 ? (
              <EmptyState
                title="No Repeat Orders Placed Yet"
                description="When you place a repeat order from a previous purchase order, it will appear here with complete tracking and status details."
                action={{
                  label: "Create Repeat Order",
                  onClick: () => {
                    setActiveTab('wizard');
                    setCurrentStep(1);
                  }
                }}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-[10px] font-black uppercase tracking-wider text-slate-600">
                        <th className="px-4 py-3.5">PO Number</th>
                        <th className="px-4 py-3.5">Original PO Reference</th>
                        <th className="px-4 py-3.5">Procurement Title</th>
                        <th className="px-4 py-3.5">Supplier</th>
                        <th className="px-4 py-3.5">Order Date</th>
                        <th className="px-4 py-3.5">Expected Delivery</th>
                        <th className="px-4 py-3.5">Order Amount</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {repeatOrdersHistory.map((order) => {
                        const originalPoNum = (order.metadata as any)?.repeatOfPoNumber || 'Original PO';
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 font-mono font-bold text-[#12335f] whitespace-nowrap">
                              {order.poNumber}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                                <RotateCcw className="h-3 w-3" /> {originalPoNum}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-900 max-w-xs truncate">
                              {order.title}
                            </td>
                            <td className="px-4 py-3.5 font-medium text-slate-700">
                              {order.seller?.name || `Seller #${order.sellerId}`}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap font-medium">
                              {order.expectedDelivery ? formatDate(order.expectedDelivery) : '-'}
                            </td>
                            <td className="px-4 py-3.5 font-black text-slate-900 whitespace-nowrap">
                              {formatCurrency(order.amount || order.totalValue || 0)}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                                  order.status === 'pending_approval'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : order.status === 'order_placed' || order.status === 'issued'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : order.status === 'delivered' || order.status === 'completed'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                )}
                              >
                                {order.status?.replace(/_/g, ' ') || 'Created'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/buyer/orders`)}
                                className="h-8 text-xs font-bold rounded-lg"
                              >
                                <Eye className="mr-1 h-3.5 w-3.5 text-slate-500" /> View Order
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW TAB 1: REPEAT ORDER WIZARD */}
        {activeTab === 'wizard' && (
          <div>
            {/* ══════════════════════════════════════════════════════════════
                STEP 1: SELECT PREVIOUS PURCHASE ORDER
                ══════════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Search & Quick Dropdown Bar */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <span>Step 1: Select Previous Purchase Order</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Choose an eligible delivered or active PO to repeat. All specifications, item quantities, and contract terms will be automatically copied.
                      </p>
                    </div>

                    {/* Quick Dropdown Selector */}
                    {eligibleOrders.length > 0 && (
                      <div className="w-full sm:w-72">
                        <label htmlFor="quick-po-select" className="sr-only">Quick Select Purchase Order</label>
                        <select
                          id="quick-po-select"
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              const found = eligibleOrders.find(o => String(o.id) === val);
                              if (found) handleSelectPo(found);
                            }
                          }}
                          className="w-full h-9 rounded-xl border border-blue-200 bg-blue-50/50 px-3 text-xs font-bold text-[#12335f] focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/20 outline-none cursor-pointer"
                        >
                          <option value="">⚡ Quick Select from List...</option>
                          {eligibleOrders.map(o => (
                            <option key={o.id} value={o.id}>
                              {o.poNumber} — {o.supplierName} ({formatCurrency(o.amount)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Filter Search Input & Status Filter */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-100">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                      <input
                        type="text"
                        placeholder="Search by PO Number, Procurement ID, Title, or Supplier Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Status:</span>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {['All', 'Delivered', 'Completed'].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatusFilter(st)}
                            className={cn(
                              'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                              statusFilter === st
                                ? 'bg-white text-slate-900 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                            )}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Searchable Orders List */}
                {loadingPreviousPos ? (
                  <PageTableSkeleton rows={5} />
                ) : filteredOrders.length === 0 ? (
                  <EmptyState
                    title="No Eligible Purchase Orders Found"
                    description={
                      searchTerm
                        ? `No previous orders matched "${searchTerm}". Try adjusting your search query.`
                        : "You don't have any eligible completed purchase orders to repeat yet."
                    }
                    action={searchTerm ? {
                      label: 'Clear Search',
                      onClick: () => setSearchTerm('')
                    } : undefined}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-600">
                            <th className="px-4 py-3.5">PO Number</th>
                            <th className="px-4 py-3.5">Procurement ID</th>
                            <th className="px-4 py-3.5">Procurement Title</th>
                            <th className="px-4 py-3.5">Supplier Name</th>
                            <th className="px-4 py-3.5">PO Date</th>
                            <th className="px-4 py-3.5">PO Amount</th>
                            <th className="px-4 py-3.5">PO Status</th>
                            <th className="px-4 py-3.5 text-right">Options</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredOrders.map((po) => (
                            <tr key={po.id} className="hover:bg-blue-50/40 transition-colors group">
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-[#12335f] text-xs">
                                    {po.poNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(po.poNumber);
                                      toast.success('PO Number copied to clipboard');
                                    }}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Copy PO Number"
                                    aria-label="Copy PO Number"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>

                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700 border border-slate-200">
                                  {po.procurementId || `PR-${po.id}`}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 font-bold text-slate-900 max-w-xs truncate">
                                {po.procurementTitle || po.title}
                              </td>

                              <td className="px-4 py-3.5 font-medium text-slate-700 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                  <span>{po.supplierName}</span>
                                </div>
                              </td>

                              <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                                {formatDate(po.poDate)}
                              </td>

                              <td className="px-4 py-3.5 font-black text-slate-900 whitespace-nowrap">
                                {formatCurrency(po.amount)}
                              </td>

                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                                    po.status === 'delivered' || po.status === 'completed' || po.poStatus === 'DELIVERED' || po.poStatus === 'CLOSED'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                                  )}
                                >
                                  {po.status?.replace(/_/g, ' ') || 'Delivered'}
                                </span>
                              </td>

                              {/* View and Select options as requested */}
                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setInspectingPo(po)}
                                    className="h-8 border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-lg px-2.5"
                                  >
                                    <Eye className="mr-1 h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                                    <span>View Details</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    onClick={() => handleSelectPo(po)}
                                    className="h-8 bg-[#12335f] text-white hover:bg-[#0b2445] text-xs font-black rounded-lg px-3 shadow-xs"
                                  >
                                    <span>Select PO</span>
                                    <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 2 & 3: AUTO-POPULATE DETAILS & EDITABLE NEW DATES
                ══════════════════════════════════════════════════════════════ */}
            {currentStep === 2 && selectedPo && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Active Selection Banner */}
                <div className="bg-gradient-to-r from-blue-900 via-[#12335f] to-indigo-950 text-white p-5 rounded-2xl border border-blue-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-400/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-200 border border-blue-300/30">
                        <Lock className="h-3 w-3" /> Original PO Locked & Copied
                      </span>
                      <span className="text-xs text-blue-200 font-mono font-bold">#{selectedPo.poNumber}</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-white">{selectedPo.procurementTitle || selectedPo.title}</h2>
                    <p className="text-xs text-blue-100/80">
                      Supplier: <strong className="text-white font-bold">{selectedPo.supplierName}</strong> • Total Contract Value: <strong className="text-white font-bold">{formatCurrency(selectedPo.amount)}</strong>
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="h-9 border-white/30 text-white bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl px-4 whitespace-nowrap self-start sm:self-auto"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Choose Different PO
                  </Button>
                </div>

                {/* Strict Read-Only Notice */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs text-blue-900 leading-relaxed">
                    <strong className="font-bold">Auto-Populated Information (Read-Only): </strong>
                    All procurement details, supplier details, item specifications, quantities, prices, taxes, and commercial terms below have been automatically retrieved from Purchase Order <strong>{selectedPo.poNumber}</strong>. Per Repeat Order governance, original contractual terms cannot be altered. You only need to provide the new delivery and order dates.
                  </div>
                </div>

                {/* Section Tabs for Read-Only Details */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                  <div className="border-b border-slate-200 bg-slate-50/70 px-4 pt-3 flex items-center gap-2 overflow-x-auto">
                    {[
                      { id: 'items', label: 'Item Details & Specs', icon: PackageCheck, count: selectedPo.items.length },
                      { id: 'procurement', label: 'Procurement & Buyer', icon: Building2 },
                      { id: 'supplier', label: 'Supplier Details', icon: ShieldCheck },
                      { id: 'terms', label: 'Delivery & Payment Terms', icon: Truck },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeDetailSection === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveDetailSection(tab.id as any)}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-colors whitespace-nowrap',
                            isActive
                              ? 'border-[#12335f] text-[#12335f] bg-white rounded-t-xl font-black'
                              : 'border-transparent text-slate-500 hover:text-slate-800'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{tab.label}</span>
                          {tab.count !== undefined && (
                            <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-mono">
                              {tab.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-5">
                    {/* SUB-SECTION 1: ITEM DETAILS & SPECS */}
                    {activeDetailSection === 'items' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-slate-400" /> Copied Item Details & Specifications
                          </h3>
                          <span className="text-xs text-slate-500 font-medium">All item prices and tax rates are locked to contract terms</span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                <th className="px-3 py-2.5">#</th>
                                <th className="px-3 py-2.5">Product / Service Info</th>
                                <th className="px-3 py-2.5">HSN/SAC</th>
                                <th className="px-3 py-2.5">Quantity</th>
                                <th className="px-3 py-2.5">Unit</th>
                                <th className="px-3 py-2.5">Price (₹)</th>
                                <th className="px-3 py-2.5">GST Rate</th>
                                <th className="px-3 py-2.5 text-right">Line Total (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedPo.items.map((item, idx) => (
                                <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                  <td className="px-3 py-3 text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="px-3 py-3 font-bold text-slate-900 max-w-sm">
                                    <div>{item.itemName}</div>
                                    {item.description && item.description !== item.itemName && (
                                      <p className="text-[11px] font-normal text-slate-500 mt-0.5">{item.description}</p>
                                    )}
                                    {item.specifications && (
                                      <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-600 font-mono leading-relaxed">
                                        <strong className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Specifications:</strong>
                                        {typeof item.specifications === 'object'
                                          ? JSON.stringify(item.specifications, null, 2)
                                          : String(item.specifications)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 font-mono text-slate-600">
                                    {item.hsnSac || item.hsnCode || '8471'}
                                  </td>
                                  <td className="px-3 py-3 font-black text-slate-900">
                                    {item.quantity}
                                  </td>
                                  <td className="px-3 py-3 text-slate-600 uppercase font-medium">
                                    {item.unitOfMeasure || 'Nos'}
                                  </td>
                                  <td className="px-3 py-3 font-mono font-medium text-slate-800">
                                    {formatCurrency(item.unitPrice)}
                                  </td>
                                  <td className="px-3 py-3 text-slate-600 font-medium">
                                    {item.taxRate ?? item.gstRate ?? 18}%
                                  </td>
                                  <td className="px-3 py-3 text-right font-black font-mono text-slate-900">
                                    {formatCurrency(item.totalAmount || item.quantity * item.unitPrice)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50 font-black text-slate-900 border-t border-slate-200">
                                <td colSpan={7} className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px]">
                                  Total Order Value:
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-sm text-[#12335f]">
                                  {formatCurrency(selectedPo.amount)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SUB-SECTION 2: PROCUREMENT & BUYER DETAILS */}
                    {activeDetailSection === 'procurement' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-slate-500" /> Procurement Details
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Procurement ID:</span>
                              <span className="font-mono font-bold text-slate-900">{selectedPo.procurementId}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Category:</span>
                              <span className="font-bold text-slate-900">{selectedPo.procurementDetails?.category || 'Goods'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Original Method:</span>
                              <span className="font-bold text-slate-900">{selectedPo.originalProcurementMethod}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Original PO Date:</span>
                              <span className="font-bold text-slate-900">{formatDate(selectedPo.poDate)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" /> Buyer / Organization Details
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Organization Name:</span>
                              <span className="font-bold text-slate-900">{selectedPo.buyerDetails?.organizationName}</span>
                            </div>
                           
                            <div className="col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Billing / Official Address:</span>
                              <span className="text-slate-700">{selectedPo.buyerDetails?.address}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-SECTION 3: SUPPLIER DETAILS */}
                    {activeDetailSection === 'supplier' && (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Contracted Supplier Information
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            Verified Supplier
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Supplier / Company:</span>
                            <span className="font-black text-slate-900">{selectedPo.supplierDetails?.organizationName || selectedPo.supplierName}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Email:</span>
                            <span className="text-slate-800 font-medium">{selectedPo.supplierDetails?.email || 'supplier@portal.gov.in'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Mobile:</span>
                            <span className="text-slate-800 font-medium">{selectedPo.supplierDetails?.mobile || '+91 9876543210'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Supplier GSTIN:</span>
                            <span className="font-mono font-bold text-slate-800">{selectedPo.supplierDetails?.gstin}</span>
                          </div>
                         
                          <div className="sm:col-span-2 md:col-span-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Registered Address:</span>
                            <span className="text-slate-700 block">{selectedPo.supplierDetails?.address}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-SECTION 4: COMMERCIAL & DELIVERY TERMS */}
                    {activeDetailSection === 'terms' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-500" /> Delivery Location & Mode
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Address:</span>
                              <span className="font-medium text-slate-900">{selectedPo.deliveryLocation}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Terms:</span>
                              <span className="text-slate-700">{selectedPo.deliveryTerms}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <IndianRupee className="h-3.5 w-3.5 text-slate-500" /> Payment & Contract Conditions
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Terms:</span>
                              <span className="font-medium text-slate-900">{selectedPo.paymentTerms}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Commercial / Technical Terms:</span>
                              <span className="text-slate-700">{selectedPo.commercialTerms}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Documentation:</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {selectedPo.requiredDocs?.map((doc, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                                    <FileCheck className="h-3 w-3 text-blue-600" /> {doc.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════
                    STEP 3 (EDITABLE FIELDS): NEW DATES SPECIFICATION
                    ══════════════════════════════════════════════════════════════ */}
                <div className="bg-gradient-to-b from-white to-slate-50/80 rounded-2xl border-2 border-[#12335f] p-6 shadow-lg space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 mb-1">
                        <Sparkles className="h-3 w-3" /> Step 3: Editable Fields
                      </div>
                      <h3 className="text-base font-black text-slate-900">Specify New Order Dates</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Only new dates are customizable for this repeat order. Please enter the new schedule below.
                      </p>
                    </div>

                    {/* Quick Date Presets */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Presets:</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyDatePreset(7)}
                        className="h-7 text-[11px] font-bold rounded-lg border-slate-200 hover:bg-slate-100"
                      >
                        +7 Days
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyDatePreset(14)}
                        className="h-7 text-[11px] font-bold rounded-lg border-blue-200 text-blue-800 bg-blue-50/50 hover:bg-blue-100"
                      >
                        +14 Days (Standard)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyDatePreset(30)}
                        className="h-7 text-[11px] font-bold rounded-lg border-slate-200 hover:bg-slate-100"
                      >
                        +30 Days
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {/* 1. Repeat Order Date */}
                    <div>
                      <label htmlFor="repeat-order-date" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                        Repeat Order Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          id="repeat-order-date"
                          type="date"
                          value={repeatOrderDate}
                          onChange={(e) => setRepeatOrderDate(e.target.value)}
                          className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 outline-none transition-all cursor-pointer"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Date when this repeat order is initiated.</p>
                    </div>

                    {/* 2. Required By Date */}
                    <div>
                      <label htmlFor="required-by-date" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                        Required By Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <CalendarClock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          id="required-by-date"
                          type="date"
                          min={todayIso}
                          value={requiredByDate}
                          onChange={(e) => setRequiredByDate(e.target.value)}
                          className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 outline-none transition-all cursor-pointer"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Target date by which materials are required.</p>
                    </div>

                    {/* 3. New Delivery Date */}
                    <div>
                      <label htmlFor="new-delivery-date" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                        New Delivery Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Truck className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600 pointer-events-none" />
                        <input
                          id="new-delivery-date"
                          type="date"
                          min={todayIso}
                          value={newDeliveryDate}
                          onChange={(e) => setNewDeliveryDate(e.target.value)}
                          className="w-full h-10 pl-9 pr-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/20 text-xs font-black text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all cursor-pointer"
                        />
                      </div>
                      <p className="text-[10px] text-emerald-700 font-bold mt-1">Contractual delivery deadline for the supplier.</p>
                    </div>

                    {/* 4. Remarks / Justification */}
                    <div className="sm:col-span-2 md:col-span-3">
                      <label htmlFor="repeat-order-remarks" className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                        Repeat Order Justification / Remarks
                      </label>
                      <textarea
                        id="repeat-order-remarks"
                        rows={2}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. Repeat purchase order executed under existing approved rates and specifications with no price variation."
                        className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15 outline-none resize-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="h-10 text-xs font-bold rounded-xl px-4"
                    >
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Step 1
                    </Button>

                    <Button
                      onClick={() => {
                        if (!newDeliveryDate) {
                          toast.error('Please specify the New Delivery Date');
                          return;
                        }
                        setCurrentStep(3);
                      }}
                      className="h-10 bg-[#12335f] text-white hover:bg-[#0b2445] text-xs font-black uppercase tracking-wider rounded-xl px-6 shadow-md"
                    >
                      <span>Proceed to Review</span>
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 3 (REVIEW): COMPREHENSIVE ORDER VERIFICATION
                ══════════════════════════════════════════════════════════════ */}
            {currentStep === 3 && selectedPo && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-900 mb-1">
                      Verification Stage
                    </div>
                    <h2 className="text-xl font-black text-slate-900">Review Repeat Purchase Order</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Carefully verify the auto-populated contractual terms and newly scheduled delivery dates before submission.
                    </p>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left: Original PO Reference */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-slate-400" /> Original Reference PO Details
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Original PO Number:</span>
                          <span className="font-mono font-bold text-slate-900">{selectedPo.poNumber}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Procurement ID:</span>
                          <span className="font-mono font-bold text-slate-900">{selectedPo.procurementId}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Original PO Date:</span>
                          <span className="font-medium text-slate-900">{formatDate(selectedPo.poDate)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Supplier:</span>
                          <span className="font-bold text-slate-900">{selectedPo.supplierName}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Original Contract Amount:</span>
                          <span className="font-black text-slate-900">{formatCurrency(selectedPo.amount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: New Repeat Order Schedule */}
                    <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/30 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#12335f] flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" /> New Repeat Order Parameters
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-blue-100">
                          <span className="text-slate-600">Repeat Order Date:</span>
                          <span className="font-bold text-slate-900">{formatDate(repeatOrderDate)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-blue-100">
                          <span className="text-slate-600">Required By Date:</span>
                          <span className="font-bold text-slate-900">{formatDate(requiredByDate)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-blue-100">
                          <span className="text-slate-600">New Delivery Date:</span>
                          <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {formatDate(newDeliveryDate)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-blue-100">
                          <span className="text-slate-600">Delivery Destination:</span>
                          <span className="font-medium text-slate-800 text-right truncate max-w-[200px]">{selectedPo.deliveryLocation}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600">Total Repeat Value:</span>
                          <span className="font-black text-[#12335f] text-sm font-mono">{formatCurrency(selectedPo.amount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Item List Compact Summary */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Line Items to be Reordered</h4>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                            <th className="px-3 py-2">Item Description</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Unit Price</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPo.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-bold text-slate-900">{item.itemName}</td>
                              <td className="px-3 py-2 font-mono">{item.quantity} {item.unitOfMeasure}</td>
                              <td className="px-3 py-2 font-mono">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(item.totalAmount || item.quantity * item.unitPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Approval Routing Notice */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                      <strong className="font-bold">Organizational Approval Workflow: </strong>
                      Upon submission, this repeat order will be automatically placed into the approval chain. The Department Head and Finance will be notified to review the reorder terms before the official PO is generated and transmitted to <strong>{selectedPo.supplierName}</strong>.
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      disabled={submitting}
                      className="h-10 text-xs font-bold rounded-xl px-4"
                    >
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Modify Dates
                    </Button>

                    <Button
                      onClick={handleSubmitRepeatOrder}
                      disabled={submitting}
                      className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl px-8 shadow-md flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Submitting Repeat Order...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Submit Repeat Order & Route for Approval</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 4: APPROVAL & NEW PO GENERATION CONFIRMATION
                ══════════════════════════════════════════════════════════════ */}
            {currentStep === 4 && submissionResult && (
              <div className="max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 duration-200 py-6">
                <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xl text-center space-y-6">
                  {/* Big Success Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center ring-8 ring-emerald-50/50">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden="true" />
                  </div>

                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 uppercase tracking-wider">
                      Repeat Order Successfully Created
                    </span>
                    <h2 className="text-2xl font-black text-slate-900">Purchase Order Generated</h2>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {submissionResult.message || 'Your repeat order has been generated and routed into the procurement approval workflow.'}
                    </p>
                  </div>

                  {/* Summary Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">New PO Number</span>
                        <span className="font-mono text-lg font-black text-[#12335f]">
                          {submissionResult.purchaseOrder?.poNumber}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider',
                          submissionResult.purchaseOrder?.status === 'pending_approval'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        )}
                      >
                        {submissionResult.purchaseOrder?.status?.replace(/_/g, ' ') || 'Order Placed'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Original PO Reference:</span>
                        <span className="font-mono font-bold text-slate-800">{selectedPo?.poNumber}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Supplier:</span>
                        <span className="font-bold text-slate-900">{selectedPo?.supplierName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">New Delivery Date:</span>
                        <span className="font-bold text-emerald-700">{formatDate(newDeliveryDate)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Order Value:</span>
                        <span className="font-mono font-black text-slate-900">{formatCurrency(selectedPo?.amount || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Button
                      onClick={() => router.push('/buyer/orders')}
                      className="w-full sm:w-auto h-11 bg-[#12335f] hover:bg-[#0b2445] text-white text-xs font-black uppercase tracking-wider rounded-xl px-6 shadow-md"
                    >
                      <Eye className="mr-1.5 h-4 w-4" /> Go to Purchase Orders
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleResetWizard}
                      className="w-full sm:w-auto h-11 text-xs font-black uppercase tracking-wider rounded-xl px-6 border-slate-300 hover:bg-slate-50"
                    >
                      <Sparkles className="mr-1.5 h-4 w-4 text-[#12335f]" /> Place Another Repeat Order
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          INSPECT PO PREVIEW MODAL (Triggered by "View Details" in Step 1)
          ══════════════════════════════════════════════════════════════ */}
      {inspectingPo && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-po-title"
        >
          <FocusTrap onEscape={() => setInspectingPo(null)} className="w-full max-w-3xl">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
              {/* Modal Header */}
              <div className="bg-[#12335f] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-200">PO Details Inspection</span>
                    <span className="font-mono text-sm font-black text-white">#{inspectingPo.poNumber}</span>
                  </div>
                  <h3 id="inspect-po-title" className="text-sm font-black text-white truncate max-w-md">
                    {inspectingPo.procurementTitle || inspectingPo.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const poToSelect = inspectingPo;
                      setInspectingPo(null);
                      handleSelectPo(poToSelect);
                    }}
                    className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-lg px-3 shadow-xs"
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Select for Repeat Order
                  </Button>

                  <button
                    type="button"
                    onClick={() => setInspectingPo(null)}
                    className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
                    aria-label="Close Preview"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                {/* Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Procurement ID</span>
                    <span className="font-mono font-bold text-slate-900">{inspectingPo.procurementId}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Supplier</span>
                    <span className="font-bold text-slate-900 truncate block">{inspectingPo.supplierName}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Original Date</span>
                    <span className="font-bold text-slate-900">{formatDate(inspectingPo.poDate)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Total Amount</span>
                    <span className="font-mono font-black text-emerald-700">{formatCurrency(inspectingPo.amount)}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Contract Items</h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                          <th className="px-3 py-2">Item Name & Specs</th>
                          <th className="px-3 py-2">HSN/SAC</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Unit Price</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectingPo.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <span className="font-bold text-slate-900 block">{item.itemName}</span>
                              {item.specifications && (
                                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                  {typeof item.specifications === 'object' ? JSON.stringify(item.specifications) : String(item.specifications)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600">{item.hsnSac || '8471'}</td>
                            <td className="px-3 py-2 font-mono">{item.quantity} {item.unitOfMeasure}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(item.totalAmount || item.quantity * item.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Terms Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Delivery Location</span>
                    <span className="text-slate-800">{inspectingPo.deliveryLocation}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Payment Terms</span>
                    <span className="text-slate-800">{inspectingPo.paymentTerms}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setInspectingPo(null)}
                  className="h-8 text-xs font-bold rounded-lg"
                >
                  Close
                </Button>

                <Button
                  onClick={() => {
                    const poToSelect = inspectingPo;
                    setInspectingPo(null);
                    handleSelectPo(poToSelect);
                  }}
                  className="h-8 bg-[#12335f] text-white hover:bg-[#0b2445] text-xs font-black rounded-lg px-4"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Select PO for Repeat Order
                </Button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  );
}
