import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Download, FileText, RefreshCw, Search, ShieldCheck, Truck, XCircle, ArrowUp, ArrowDown, ArrowUpDown, Eye, X, Filter, List, LayoutGrid, Printer, MoreVertical } from 'lucide-react';
import type { DocumentConfig } from '../lib/pdfEngine';

const moneyPdf = (val: any, currency = 'INR') => {
  const num = Number(val || 0);
  if (!Number.isFinite(num) || num === 0) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { api } from '../lib/api';
import { openFileAsset } from '../lib/files';
import { cn } from '../lib/utils';
import { EmptyState, InlineError, LoadingState } from '../features/shared/FeatureStates';
import { formatCurrency, formatDate, maskEmail } from '../features/shared/format';
import { useFeatureQuery, usePagination, useResponsiveViewMode } from '../features/shared/hooks';
import { KpiCard } from '../features/shared/KpiCard';
import { Pagination } from '../features/shared/Pagination';
import { EntityIdLink } from '../features/shared/EntityIdLink';
import { postApi } from '../features/shared/apiClient';
import { ViewModeToggle } from '../features/shared/ViewModeToggle';
import { ResponsiveFilterBar } from '../components/ui/ResponsiveFilterBar';
import { PageToolbar } from '../features/shared/PageToolbar';
import { useAuth } from '../hooks/useAuth';
import type { PurchaseOrderDto } from '../features/shared/types';
import { useDeliveryByPO } from '../features/delivery/hooks';
import { PageTableSkeleton } from '../components/ui/skeleton';

const readableStatus = (value?: string) => String(value || 'generated').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
const openStatuses = ['generated', 'accepted', 'in_fulfillment', 'invoice_submitted', 'order_placed', 'issued'];
const purchaseOrderStatusParam = (tab: 'Open' | 'Delivered' | 'Cancelled' | 'All') => {
  if (tab === 'Delivered') return 'delivered';
  if (tab === 'Cancelled') return 'cancelled';
  return undefined;
};
const isOpenPurchaseOrder = (order: PurchaseOrderDto) => openStatuses.includes(String(order.status || 'generated').toLowerCase());

interface SortHeaderProps {
  label: string;
  columnKey: string;
  className?: string;
  sortBy: string;
  onToggleSort: (key: string) => void;
}

const SortHeader = ({ label, columnKey, className = '', sortBy, onToggleSort }: SortHeaderProps) => {
  let isActive = false;
  let isAsc = true;

  if (columnKey === 'po') {
    isActive = sortBy === 'po_asc' || sortBy === 'po_desc';
    isAsc = sortBy === 'po_asc';
  } else if (columnKey === 'title') {
    isActive = sortBy === 'title_asc' || sortBy === 'title_desc';
    isAsc = sortBy === 'title_asc';
  } else if (columnKey === 'party') {
    isActive = sortBy === 'party_asc' || sortBy === 'party_desc';
    isAsc = sortBy === 'party_asc';
  } else if (columnKey === 'value') {
    isActive = sortBy === 'value_low' || sortBy === 'value_high';
    isAsc = sortBy === 'value_low';
  } else if (columnKey === 'expected') {
    isActive = sortBy === 'expected_asc' || sortBy === 'expected_desc';
    isAsc = sortBy === 'expected_asc';
  } else if (columnKey === 'status') {
    isActive = sortBy === 'status' || sortBy === 'status_asc' || sortBy === 'status_desc';
    isAsc = sortBy === 'status' || sortBy === 'status_asc';
  } else if (columnKey === 'updated') {
    isActive = sortBy === 'updated_asc' || sortBy === 'updated_desc';
    isAsc = sortBy === 'updated_asc';
  }

  return (
    <button
      type="button"
      onClick={() => onToggleSort(columnKey)}
      className={cn("inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#12335f] transition-colors", isActive && "text-[#12335f]", className)}
    >
      {label}
      {isActive ? (
        isAsc ? (
          <ArrowUp className="h-3 w-3 text-[#12335f]" />
        ) : (
          <ArrowDown className="h-3 w-3 text-[#12335f]" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
};
import { createPortal } from 'react-dom';

const OrderActionsMenu = ({
  order,
  buttonId,
  onClose,
  isSeller,
  isBuyer,
  isIssued,
  isAccepted,
  isDelivered,
  isCancelled,
  setViewingOrder,
  handleAcceptOrder,
  handleRejectOrder,
  handleOpenDelivery,
  exportInvoicePdf,
  setConfirming
}: any) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<any>({ visibility: 'hidden', position: 'fixed', top: 0, left: 0, zIndex: 99999 });

  useEffect(() => {
    const btn = document.getElementById(buttonId);
    const menu = menuRef.current;
    if (!btn || !menu) return;

    const btnRect = btn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    let top = btnRect.bottom + 6;
    let left = btnRect.right - menuRect.width;

    if (top + menuRect.height > window.innerHeight) {
      top = btnRect.top - menuRect.height - 6;
    }
    if (top < 0) top = 6;
    if (left < 0) left = 6;

    setStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 99999,
      visibility: 'visible'
    });
  }, [buttonId]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      ref={menuRef}
      style={style} 
      onClick={e => e.stopPropagation()} 
      className="w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5 flex flex-col gap-0.5 text-left animate-in fade-in zoom-in-95 duration-100"
    >
      <button
        type="button"
        onClick={() => {
          onClose();
          setViewingOrder(order);
        }}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
      >
        <Eye className="h-3.5 w-3.5 text-slate-500" />
        <span>View</span>
      </button>

      {isSeller && isIssued && (
        <>
          <button
            type="button"
            onClick={() => {
              onClose();
              handleAcceptOrder(order);
            }}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors text-left"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Accept</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              handleRejectOrder(order);
            }}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-rose-700 hover:bg-rose-50 transition-colors text-left"
          >
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
            <span>Reject</span>
          </button>
        </>
      )}

      {(isAccepted || isDelivered) && (
        <button
          type="button"
          onClick={() => {
            onClose();
            handleOpenDelivery(order);
          }}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-blue-700 hover:bg-blue-50 transition-colors text-left"
        >
          <Truck className="h-3.5 w-3.5 text-blue-600" />
          <span>Delivery</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          onClose();
          exportInvoicePdf(order, 'print');
        }}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors text-left"
      >
        <Printer className="h-3.5 w-3.5 text-slate-500" />
        <span>Print</span>
      </button>

      {isBuyer && !isCancelled && !isDelivered && (
        <button
          type="button"
          onClick={() => {
            onClose();
            setConfirming({ action: 'cancel', order });
          }}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg text-rose-700 hover:bg-rose-50 transition-colors text-left"
        >
          <XCircle className="h-3.5 w-3.5 text-rose-600" />
          <span>Cancel</span>
        </button>
      )}
    </div>,
    document.body
  );
};

export default function PurchaseOrders() {
  const { user } = useAuth();
  const router = useRouter();
  const isSeller = user?.role === 'seller' || user?.role === 'shg';
  const isBuyer = user?.role === 'buyer';

  const [activeTab, setActiveTab] = useState<'Open' | 'Delivered' | 'Cancelled' | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [partyFilter, setPartyFilter] = useState('All Parties');
  const [valueFilter, setValueFilter] = useState('All Values');
  const [expectedDateFilter, setExpectedDateFilter] = useState('All Dates');
  const [expectedDateCustom, setExpectedDateCustom] = useState({ start: '', end: '' });
  const [updatedDateFilter, setUpdatedDateFilter] = useState({ start: '', end: '' });
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useResponsiveViewMode();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [confirming, setConfirming] = useState<{ action: 'acknowledge' | 'cancel'; order: PurchaseOrderDto } | null>(null);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrderDto | null>(null);
  const [openKebabId, setOpenKebabId] = useState<number | null>(null);

  useEffect(() => {
    if (!openKebabId) return;
    const handleClose = () => setOpenKebabId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKebabId(null);
    };
    
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, { capture: true, passive: true });
    window.addEventListener('resize', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, { capture: true });
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openKebabId]);

  const { data: activeDelivery } = useDeliveryByPO(viewingOrder?.id);

  const [repeatingOrder, setRepeatingOrder] = useState<PurchaseOrderDto | null>(null);
  const [repeatQuantity, setRepeatQuantity] = useState(1);
  const [repeatAddress, setRepeatAddress] = useState('');
  const [repeatDeliveryDate, setRepeatDeliveryDate] = useState('');
  const [repeatSubmitting, setRepeatSubmitting] = useState(false);

  const handleOpenRepeatModal = (order: PurchaseOrderDto) => {
    setRepeatingOrder(order);
    const firstItem = order.items?.[0];
    setRepeatQuantity(firstItem ? Number(firstItem.quantity) || 1 : 1);
    setRepeatAddress(order.deliveryAddress || '');
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    setRepeatDeliveryDate(defaultDate.toISOString().split('T')[0]);
  };

  const handleConfirmRepeatOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repeatingOrder) return;
    if (repeatQuantity <= 0) {
      toast.error('Quantity must be greater than zero');
      return;
    }
    if (!repeatAddress.trim()) {
      toast.error('Delivery Address is required');
      return;
    }
    if (!repeatDeliveryDate) {
      toast.error('Delivery Date is required');
      return;
    }

    setRepeatSubmitting(true);
    try {
      await api.post(`/api/purchase-orders/${repeatingOrder.id}/repeat`, {
        quantity: repeatQuantity,
        deliveryAddress: repeatAddress.trim(),
        expectedDelivery: new Date(repeatDeliveryDate).toISOString()
      });
      toast.success('Repeat purchase order placed successfully!');
      setRepeatingOrder(null);
      setViewingOrder(null);
      reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to place repeat purchase order');
    } finally {
      setRepeatSubmitting(false);
    }
  };
  const viewerScope = `${user?.role || 'guest'}-${user?.id || 'none'}`;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: allOrders, loading, refreshing, error, reload: reloadAllOrders, setData: setAllOrders } = useFeatureQuery<PurchaseOrderDto[]>(
    `/api/purchase-orders?take=500&viewerScope=${encodeURIComponent(viewerScope)}`,
    []
  );

  const reload = reloadAllOrders;
  const setPagedOrders = setAllOrders; // Alias for minimal changes to action handlers

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    allOrders.forEach(o => {
      if (o.status) statuses.add(readableStatus(o.status));
    });
    return Array.from(statuses).sort();
  }, [allOrders]);

  const uniqueParties = useMemo(() => {
    const parties = new Set<string>();
    allOrders.forEach(o => {
      if (o.seller?.name) parties.add(o.seller.name);
      if (o.buyer?.name) parties.add(o.buyer.name);
    });
    return Array.from(parties).sort();
  }, [allOrders]);

  const processedOrders = useMemo(() => {
    let result = [...allOrders];

    // 1. Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(o => 
        o.poNumber?.toLowerCase().includes(q) || 
        o.title?.toLowerCase().includes(q) || 
        o.seller?.name?.toLowerCase().includes(q) || 
        o.buyer?.name?.toLowerCase().includes(q)
      );
    }

    // 2. Tab Filter
    if (activeTab === 'Open') result = result.filter(isOpenPurchaseOrder);
    else if (activeTab === 'Delivered') result = result.filter(o => ['delivered', 'completed'].includes(String(o.status || '').toLowerCase()));
    else if (activeTab === 'Cancelled') result = result.filter(o => ['cancelled', 'rejected'].includes(String(o.status || '').toLowerCase()));

    // 3. Status Filter
    if (statusFilter && statusFilter !== 'All Statuses') {
      result = result.filter(o => readableStatus(o.status).toLowerCase() === statusFilter.toLowerCase());
    }

    // 4. Party Filter
    if (partyFilter && partyFilter !== 'All Parties') {
      result = result.filter(o => o.seller?.name === partyFilter || o.buyer?.name === partyFilter);
    }

    // 5. Value Filter
    if (valueFilter && valueFilter !== 'All Values') {
      result = result.filter(o => {
        const val = Number(o.amount || o.totalValue || 0);
        if (valueFilter === 'Below ₹10,000') return val < 10000;
        if (valueFilter === '₹10,000 – ₹50,000') return val >= 10000 && val <= 50000;
        if (valueFilter === '₹50,000 – ₹1,00,000') return val >= 50000 && val <= 100000;
        if (valueFilter === 'Above ₹1,00,000') return val > 100000;
        return true;
      });
    }

    // 6. Expected Date Filter
    if (expectedDateFilter && expectedDateFilter !== 'All Dates') {
      const now = new Date();
      now.setHours(0,0,0,0);
      result = result.filter(o => {
        if (!o.expectedDelivery) return false;
        const expected = new Date(o.expectedDelivery);
        expected.setHours(0,0,0,0);
        
        if (expectedDateFilter === 'Upcoming') {
          return expected >= now && !['delivered', 'completed', 'cancelled', 'rejected'].includes(String(o.status).toLowerCase());
        }
        if (expectedDateFilter === 'Overdue') {
          return expected < now && !['delivered', 'completed', 'cancelled', 'rejected'].includes(String(o.status).toLowerCase());
        }
        if (expectedDateFilter === 'Custom Date Range') {
           const start = expectedDateCustom.start ? new Date(expectedDateCustom.start) : null;
           const end = expectedDateCustom.end ? new Date(expectedDateCustom.end) : null;
           if (start) start.setHours(0,0,0,0);
           if (end) end.setHours(23,59,59,999);
           
           if (start && expected < start) return false;
           if (end && expected > end) return false;
           return true;
        }
        return true;
      });
    }

    // 7. Updated Date Filter
    if (updatedDateFilter.start || updatedDateFilter.end) {
      result = result.filter(o => {
        if (!o.updatedAt) return false;
        const updated = new Date(o.updatedAt);
        const start = updatedDateFilter.start ? new Date(updatedDateFilter.start) : null;
        const end = updatedDateFilter.end ? new Date(updatedDateFilter.end) : null;
        if (start) start.setHours(0,0,0,0);
        if (end) end.setHours(23,59,59,999);
        
        if (start && updated < start) return false;
        if (end && updated > end) return false;
        return true;
      });
    }

    // 8. Sorting
    result.sort((a, b) => {
      const valA = Number(a.amount || a.totalValue || 0);
      const valB = Number(b.amount || b.totalValue || 0);
      
      if (sortBy === 'value_high') return valB - valA;
      if (sortBy === 'value_low') return valA - valB;
      if (sortBy === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      
      if (sortBy === 'po_asc') return String(a.poNumber || '').localeCompare(String(b.poNumber || ''));
      if (sortBy === 'po_desc') return String(b.poNumber || '').localeCompare(String(a.poNumber || ''));
      if (sortBy === 'title_asc') return String(a.title || '').localeCompare(String(b.title || ''));
      if (sortBy === 'title_desc') return String(b.title || '').localeCompare(String(a.title || ''));
      if (sortBy === 'party_asc') return String(a.seller?.name || '').localeCompare(String(b.seller?.name || ''));
      if (sortBy === 'party_desc') return String(b.seller?.name || '').localeCompare(String(a.seller?.name || ''));
      if (sortBy === 'expected_asc') return new Date(a.expectedDelivery || 0).getTime() - new Date(b.expectedDelivery || 0).getTime();
      if (sortBy === 'expected_desc') return new Date(b.expectedDelivery || 0).getTime() - new Date(a.expectedDelivery || 0).getTime();
      if (sortBy === 'updated_asc') return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      if (sortBy === 'updated_desc') return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      if (sortBy === 'status_asc' || sortBy === 'status') return String(a.status || '').localeCompare(String(b.status || ''));
      if (sortBy === 'status_desc') return String(b.status || '').localeCompare(String(a.status || ''));

      return 0;
    });

    return result;
  }, [allOrders, activeTab, debouncedSearch, statusFilter, partyFilter, valueFilter, expectedDateFilter, expectedDateCustom, updatedDateFilter, sortBy]);

  const { page, pageSize, total, pageItems: visibleOrders, setPage, setPageSize } = usePagination(processedOrders, 10);

  const totalSpend = useMemo(
    () => allOrders.reduce((sum, order) => sum + Number(order.amount || order.totalValue || 0), 0),
    [allOrders]
  );
  const deliveredCount = useMemo(
    () => allOrders.filter(order => {
      const s = String(order.status || '').toLowerCase();
      return s === 'delivered' || s === 'completed';
    }).length,
    [allOrders]
  );
  const openCount = useMemo(
    () => allOrders.filter(isOpenPurchaseOrder).length,
    [allOrders]
  );
  const poHealth = useMemo(() => {
    const now = new Date();
    return allOrders.reduce(
      (acc, order) => {
        const value = Number(order.amount || order.totalValue || 0);
        const status = String(order.status || '').toLowerCase();
        if (isOpenPurchaseOrder(order)) acc.openValue += value;
        if (isSeller && status === 'accepted') acc.invoiceReady += 1;
        if (isSeller && (status === 'generated' || status === 'order_placed')) acc.awaitingSeller += 1;
        const expected = order.expectedDelivery ? new Date(order.expectedDelivery) : null;
        if (expected && expected < now && !['delivered', 'cancelled', 'completed'].includes(status)) {
          acc.deliveryRisk += 1;
        }
        return acc;
      },
      { openValue: 0, invoiceReady: 0, awaitingSeller: 0, deliveryRisk: 0 }
    );
  }, [allOrders, isSeller]);

  const refreshPurchaseOrders = async () => {
    await Promise.all([reload(), reloadAllOrders()]);
  };

  const handleConvertToInvoice = (order: PurchaseOrderDto) => {
    const amountVal = order.amount || order.totalValue || 0;
    router.push(`/seller/invoices?convertPoId=${order.id}&amount=${amountVal}`);
  };

  const formatTimestamp = (value?: string | Date | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };


  const toggleSort = (key: string) => {
    if (key === 'po') {
      setSortBy(sortBy === 'po_asc' ? 'po_desc' : 'po_asc');
    } else if (key === 'title') {
      setSortBy(sortBy === 'title_asc' ? 'title_desc' : 'title_asc');
    } else if (key === 'party') {
      setSortBy(sortBy === 'party_asc' ? 'party_desc' : 'party_asc');
    } else if (key === 'value') {
      setSortBy(sortBy === 'value_low' ? 'value_high' : 'value_low');
    } else if (key === 'expected') {
      setSortBy(sortBy === 'expected_asc' ? 'expected_desc' : 'expected_asc');
    } else if (key === 'status') {
      setSortBy(sortBy === 'status_asc' ? 'status_desc' : 'status_asc');
    } else if (key === 'updated') {
      setSortBy(sortBy === 'updated_asc' ? 'updated_desc' : 'updated_asc');
    }
  };

  const completeAction = async () => {
    if (!confirming) return;
    try {
      const endpoint = confirming.action === 'acknowledge'
        ? `/api/purchase-orders/${confirming.order.id}/acknowledge`
        : `/api/purchase-orders/${confirming.order.id}/cancel`;
      const updated = await postApi<PurchaseOrderDto>(endpoint, {});
      setPagedOrders(current => current.map(order => order.id === updated.id ? { ...order, ...updated } : order));
      if (viewingOrder && viewingOrder.id === updated.id) {
        setViewingOrder(updated);
      }
      toast.success(`PO ${readableStatus(updated.status)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update purchase order');
    } finally {
      setConfirming(null);
    }
  };

  const handleAcceptOrder = async (order: PurchaseOrderDto) => {
    try {
      const endpoint = `/api/purchase-orders/${order.id}/acknowledge`;
      const updated = await postApi<PurchaseOrderDto>(endpoint, {});
      setPagedOrders(current => current.map(o => o.id === updated.id ? { ...o, ...updated, status: 'accepted' } : o));
      if (viewingOrder && viewingOrder.id === order.id) {
        setViewingOrder({ ...viewingOrder, ...updated, status: 'accepted' });
      }
      toast.success(`Purchase Order ${order.poNumber || `PO-${order.id}`} ACCEPTED successfully!`);
      await refreshPurchaseOrders();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to accept purchase order');
    }
  };

  const handleRejectOrder = async (order: PurchaseOrderDto) => {
    if (!window.confirm(`Are you sure you want to REJECT purchase order ${order.poNumber || `PO-${order.id}`}?`)) return;
    try {
      const endpoint = `/api/purchase-orders/${order.id}/cancel`;
      const updated = await postApi<PurchaseOrderDto>(endpoint, {});
      setPagedOrders(current => current.map(o => o.id === updated.id ? { ...o, ...updated, status: 'cancelled' } : o));
      if (viewingOrder && viewingOrder.id === order.id) {
        setViewingOrder({ ...viewingOrder, ...updated, status: 'cancelled' });
      }
      toast.success(`Purchase Order ${order.poNumber || `PO-${order.id}`} REJECTED.`);
      await refreshPurchaseOrders();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to reject purchase order');
    }
  };

  const handleOpenDelivery = (order: PurchaseOrderDto) => {
    if (order.poNumber) {
      router.push(`/seller/delivery-management?search=${encodeURIComponent(order.poNumber)}`);
    } else {
      router.push('/seller/delivery-management');
    }
  };

  const renderOrderActions = (order: PurchaseOrderDto) => {
    const statusLower = String(order.status || '').toLowerCase();
    const isIssued = statusLower === 'issued' || statusLower === 'generated' || statusLower === 'order_placed';
    const isAccepted = statusLower === 'accepted' || statusLower === 'in_fulfillment';
    const isDelivered = statusLower === 'delivered' || statusLower === 'completed';
    const isCancelled = statusLower === 'cancelled' || statusLower === 'rejected';

    return (
      <div className="relative inline-flex items-center justify-end" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          id={`kebab-btn-${order.id}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpenKebabId(openKebabId === order.id ? null : order.id);
          }}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs focus:outline-none"
          title="Actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {openKebabId === order.id && (
          <OrderActionsMenu
            order={order}
            buttonId={`kebab-btn-${order.id}`}
            onClose={() => setOpenKebabId(null)}
            isSeller={isSeller}
            isBuyer={isBuyer}
            isIssued={isIssued}
            isAccepted={isAccepted}
            isDelivered={isDelivered}
            isCancelled={isCancelled}
            setViewingOrder={setViewingOrder}
            handleAcceptOrder={handleAcceptOrder}
            handleRejectOrder={handleRejectOrder}
            handleOpenDelivery={handleOpenDelivery}
            exportInvoicePdf={exportInvoicePdf}
            setConfirming={setConfirming}
          />
        )}
      </div>
    );
  };



  const exportInvoicePdf = async (baseOrder: PurchaseOrderDto, mode: 'download' | 'print') => {
    const { PdfEngine } = await import('../lib/pdfEngine');
    let order = baseOrder;
    try {
      const res = await api.get(`/api/purchase-orders/${baseOrder.id}`);
      if ((res as any).data) {
        order = { ...baseOrder, ...(res as any).data };
      }
    } catch (err) {
      console.warn('Failed to fetch full PO details for PDF, using list data');
    }

    const totalValue = Number(order.amount || order.totalValue || 0);
    
    // Fallback items if none exist
    const items = order.items?.length ? order.items : [{
      itemName: order.title,
      quantity: 1,
      unitPrice: totalValue,
      totalAmount: totalValue
    }];

    const tableData = items.map((item, index) => {
      const qty = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice || 0);
      const lineTotal = Number(item.totalAmount || qty * unitPrice || totalValue);
      return [
        String(index + 1),
        item.itemName || order.title,
        String(qty),
        unitPrice || (lineTotal / Math.max(qty, 1)),
        lineTotal
      ];
    });

    const subtotal = tableData.reduce((sum, row) => sum + Number(row[4] || 0), 0) || totalValue;

    const config: DocumentConfig = {
      documentTitle: 'Purchase Order / Supplier Invoice Copy',
      documentNumber: order.poNumber || `PO-${order.id}`,
      dateStr: formatTimestamp(new Date()),
      status: readableStatus(order.status),
      parties: [
        {
          title: 'Buyer / Requesting Organization',
          name: order.buyer?.name || 'MSME Portal Buyer',
          email: order.buyer?.email ? maskEmail(order.buyer.email) : undefined,
          address: order.deliveryAddress || 'Ship To: As per purchase order',
        },
        {
          title: 'Seller / Supplier Organization',
          name: order.seller?.name || 'MSME Portal Seller',
          email: order.seller?.email ? maskEmail(order.seller.email) : undefined,
          details: [`Seller ID: ${order.sellerId || '-'}`]
        }
      ],
      infoGrid: {
        'Payment Terms': order.paymentTerms ? readableStatus(order.paymentTerms) : 'As per portal workflow',
        'Delivery Type': order.deliveryType ? readableStatus(order.deliveryType) : 'Standard delivery',
        'Acknowledged At': order.acceptedAt ? formatTimestamp(order.acceptedAt) : 'Pending / Not recorded',
        'PO Reference': `ID ${order.id}`,
        'PO Title': order.title || 'N/A',
        'Expected Delivery': formatDate(order.expectedDelivery)
      },
      tableHeaders: ['Sr.', 'Description of Goods / Services', 'Qty', 'Rate', 'Line Total'],
      tableData: tableData.map(row => [row[0], row[1], row[2], moneyPdf(row[3]), moneyPdf(row[4])]),
      financials: {
        subtotal: subtotal,
        grandTotal: totalValue || subtotal
      },
      notes: [
        '1. This document is generated from the JSGSMILE MSME procurement workflow and must be read with linked GRN, invoice and payment records.',
        '2. Supplier must fulfil quantity, quality, delivery schedule, taxes and documentation requirements recorded against the purchase order.',
        '3. Buyer approval, payment release and settlement remain subject to portal approval matrix, delivery confirmation and invoice verification.'
      ]
    };

    const engine = new PdfEngine('p');
    const doc = engine.generate(config);
    
    const filename = `${order.poNumber || `PO-${order.id}`}-procurement-invoice.pdf`;
    if (mode === 'print') {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
      toast.success('Invoice opened for printing');
      return;
    }
    doc.save(filename);
    toast.success('Detailed invoice PDF generated');
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('All Statuses');
    setPartyFilter('All Parties');
    setValueFilter('All Values');
    setExpectedDateFilter('All Dates');
    setExpectedDateCustom({ start: '', end: '' });
    setUpdatedDateFilter({ start: '', end: '' });
  };

  const activeFiltersCount = 
    (searchTerm ? 1 : 0) + 
    (statusFilter !== 'All Statuses' ? 1 : 0) + 
    (partyFilter !== 'All Parties' ? 1 : 0) + 
    (valueFilter !== 'All Values' ? 1 : 0) + 
    (expectedDateFilter !== 'All Dates' ? 1 : 0) + 
    ((updatedDateFilter.start || updatedDateFilter.end) ? 1 : 0);

  if (loading && (!allOrders || allOrders.length === 0)) {
    return <PageTableSkeleton kpiCount={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Transparent Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-2">
        <div className="min-w-0">
          {/* <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f] bg-[#12335f]/10 px-2.5 py-1 rounded-full">Procurement Fulfilment</span> */}
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">Purchase Orders</h1>
          {/* <p className="text-xs font-semibold text-slate-500 mt-1">Live PO register from backend procurement workflows.</p> */}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshPurchaseOrders} className="h-10 rounded-lg text-xs font-black uppercase bg-white hover:bg-slate-50 border-slate-200 shadow-sm">
            <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Open POs" value={openCount} subtext="Active purchase orders" icon={FileText} onClick={() => setActiveTab('Open')} active={activeTab === 'Open'} tone="blue" />
        <KpiCard label="Delivered" value={deliveredCount} subtext="Completed deliveries" icon={CheckCircle2} onClick={() => setActiveTab('Delivered')} active={activeTab === 'Delivered'} tone="green" />
        <KpiCard label="Total Value" value={formatCurrency(totalSpend)} subtext="Cumulative purchase spend" icon={ShieldCheck} onClick={() => setActiveTab('All')} active={activeTab === 'All'} tone="indigo" />
        <KpiCard label="Open Value" value={formatCurrency(poHealth.openValue)} subtext="Pending fulfillment value" icon={ShieldCheck} onClick={() => setActiveTab('Open')} active={activeTab === 'Open'} tone="amber" />
      </div>

      {error && <InlineError message={error} onRetry={reload} />}

      {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <ResponsiveFilterBar
          activeFilterCount={activeFiltersCount}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search PO, title, party..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
            </div>
          }
          filters={
            <>
              {/* Status */}
              <div className="w-full sm:w-[130px]">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Statuses">Status: All</option>
                  {uniqueStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              
              {/* Party */}
              <div className="w-full sm:w-[130px]">
                <select
                  value={partyFilter}
                  onChange={e => setPartyFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Parties">Party: All</option>
                  {uniqueParties.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Value */}
              <div className="w-full sm:w-[130px]">
                <select
                  value={valueFilter}
                  onChange={e => setValueFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Values">Value: All</option>
                  <option value="Below ₹10,000">Below ₹10,000</option>
                  <option value="₹10,000 – ₹50,000">₹10,000 – ₹50,000</option>
                  <option value="₹50,000 – ₹1,00,000">₹50,000 – ₹1,00,000</option>
                  <option value="Above ₹1,00,000">Above ₹1,00,000</option>
                </select>
              </div>

              {/* Expected */}
              <div className="w-full sm:w-[130px]">
                <select
                  value={expectedDateFilter}
                  onChange={e => setExpectedDateFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                >
                  <option value="All Dates">Expected: All</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Custom Date Range">Custom Date Range</option>
                </select>
              </div>
              
              {expectedDateFilter === 'Custom Date Range' && (
                <div className="flex items-center flex-nowrap whitespace-nowrap gap-1 w-full sm:w-auto h-10">
                  <input type="date" value={expectedDateCustom.start} onChange={e => setExpectedDateCustom({ ...expectedDateCustom, start: e.target.value })} className="h-10 w-full sm:w-[115px] rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-700 outline-none" title="Start Date" />
                  <span className="text-slate-400 font-bold shrink-0">-</span>
                  <input type="date" value={expectedDateCustom.end} onChange={e => setExpectedDateCustom({ ...expectedDateCustom, end: e.target.value })} className="h-10 w-full sm:w-[115px] rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-700 outline-none" title="End Date" />
                </div>
              )}

              {/* Updated Date */}
              <div className="flex items-center flex-nowrap whitespace-nowrap gap-1 bg-slate-50/50 border border-slate-200 rounded-xl px-2 h-10 w-full sm:w-auto">
                <span className="text-[10px] font-black uppercase text-slate-400 px-1 shrink-0 hidden lg:inline-block">Updated</span>
                <input type="date" value={updatedDateFilter.start} onChange={e => setUpdatedDateFilter({ ...updatedDateFilter, start: e.target.value })} className="h-8 w-full sm:w-[105px] shrink-0 rounded-lg border-none bg-transparent px-1 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-slate-300" title="Updated Start" />
                <span className="text-slate-300 font-black shrink-0">-</span>
                <input type="date" value={updatedDateFilter.end} onChange={e => setUpdatedDateFilter({ ...updatedDateFilter, end: e.target.value })} className="h-8 w-full sm:w-[105px] shrink-0 rounded-lg border-none bg-transparent px-1 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-slate-300" title="Updated End" />
              </div>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" onClick={handleClearFilters} className="h-10 px-3 text-xs font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl shrink-0">
                  Clear Filters
                </Button>
              )}
            </>
          }
          viewToggle={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      </div>

      {loading && (!allOrders || allOrders.length === 0) ? (
        <PageTableSkeleton kpiCount={4} />
      ) : error ? (
        <div className="p-8 text-center text-red-500">
          <ShieldCheck className="mx-auto h-12 w-12 opacity-50 mb-4" />
          <p>Failed to load orders.</p>
        </div>
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          title="No purchase orders"
          description={searchTerm || activeTab !== 'All' ? 'No purchase orders match the current search, status tab, or sorting filters.' : 'No purchase orders have been generated from procurement awards yet.'}
        />
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleOrders.map((order, index) => {
              const rowIndex = (page - 1) * pageSize + index + 1;
              return (
                <div
                  key={order.id}
                  className="group rounded-2xl border border-slate-200/85 bg-white p-4 shadow-sm transition hover:border-[#12335f]/40 hover:shadow-md flex flex-col justify-between"
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
                        <h3 title={order.title} className="mt-2 line-clamp-2 text-sm font-black leading-snug text-slate-900 group-hover:text-[#12335f] transition-colors">{order.title}</h3>
                      </div>
                      <StatusPill status={order.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-[10px] font-semibold text-slate-500 pt-1">
                      <InfoTile label="Party" value={order.seller?.name || maskEmail(order.seller?.email) || `Seller #${order.sellerId || '-'}`} />
                      <InfoTile label="Value" value={formatCurrency(order.amount || order.totalValue)} />
                      <InfoTile label="Expected" value={formatDate(order.expectedDelivery)} />
                      <InfoTile label="Created" value={formatDate(order.createdAt)} />
                    </div>

                    {(order.paymentTerms || order.deliveryType) && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {order.paymentTerms && <span className="rounded bg-teal-50 px-2 py-0.5 text-[9px] font-black uppercase text-teal-700">{readableStatus(order.paymentTerms)}</span>}
                        {order.deliveryType && <span className="rounded bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700">{readableStatus(order.deliveryType)}</span>}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {renderOrderActions(order)}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="orders" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full min-w-[1000px] border-collapse text-left text-xs table-fixed">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[9%]" />
                <col className="w-[24%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="p-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Sr. No</th>
                  <th className="p-3"><SortHeader label="PO" columnKey="po" sortBy={sortBy} onToggleSort={toggleSort} /></th>
                  <th className="p-3"><SortHeader label="Title" columnKey="title" sortBy={sortBy} onToggleSort={toggleSort} /></th>
                  <th className="p-3"><SortHeader label="Party" columnKey="party" sortBy={sortBy} onToggleSort={toggleSort} /></th>
                  <th className="p-3"><SortHeader label="Value" columnKey="value" sortBy={sortBy} onToggleSort={toggleSort} /></th>
                  <th className="p-3"><SortHeader label="Expected" columnKey="expected" sortBy={sortBy} onToggleSort={toggleSort} /></th>
                  <th className="p-3"><SortHeader label="Updated At" columnKey="updated" sortBy={sortBy} onToggleSort={toggleSort} /></th>
                  <th className="p-3"><SortHeader label="Status" columnKey="status" sortBy={sortBy} onToggleSort={toggleSort} /></th>
                  <th className="p-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {visibleOrders.map((order, index) => {
                  const rowIndex = (page - 1) * pageSize + index + 1;
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono text-xs text-slate-500">
                        {String(rowIndex).padStart(2, '0')}
                      </td>
                      <td className="p-3 font-mono text-xs font-black text-[#12335f] whitespace-nowrap">
                        <EntityIdLink label={order.poNumber} id={order.id} size="sm" onClick={() => setViewingOrder(order)} />
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{order.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-bold text-slate-500">{formatDate(order.createdAt)}</span>
                          {order.paymentTerms && (
                            <span className="text-[9px] font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded uppercase">
                              {readableStatus(order.paymentTerms)}
                            </span>
                          )}
                          {order.deliveryType && (
                            <span className="text-[9px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                              {readableStatus(order.deliveryType)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">{order.seller?.name || maskEmail(order.seller?.email) || `Seller #${order.sellerId || '-'}`}</td>
                      <td className="p-3 font-bold text-slate-900">{formatCurrency(order.amount || order.totalValue)}</td>
                      <td className="p-3 text-slate-500">{formatDate(order.expectedDelivery)}</td>
                      <td className="p-3">
                        {order.updatedAt ? (
                          <div>
                            <p className="text-slate-700">{formatDate(order.updatedAt)}</p>
                            <p className="text-[9px] font-semibold text-slate-400 mt-0.5">
                              {new Date(order.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3"><StatusPill status={order.status} /></td>
                      <td className="p-3 text-right">
                        {renderOrderActions(order)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="orders" />
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-950 capitalize">Confirm {confirming.action}</h3>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-500">Apply this action to {confirming.order.poNumber}?</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(null)}>No</Button>
              <Button onClick={completeAction} className="bg-[#12335f] text-white">Yes, continue</Button>
            </div>
          </div>
        </div>
      )}

      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 shrink-0">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Purchase Order Details</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">{viewingOrder.poNumber}</h2>
              </div>
              <button onClick={() => setViewingOrder(null)} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6 flex-1">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-[10px] font-black uppercase text-slate-400">Order Title</p>
                <p className="text-base font-black text-slate-900 mt-0.5">{viewingOrder.title}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#12335f]">
                    {readableStatus(viewingOrder.status)}
                  </span>
                  {viewingOrder.paymentTerms && (
                    <span className="rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-teal-700">
                      Payment: {readableStatus(viewingOrder.paymentTerms)}
                    </span>
                  )}
                  {viewingOrder.deliveryType && (
                    <span className="rounded-lg border border-purple-200 bg-purple-50/50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-purple-700">
                      Delivery: {readableStatus(viewingOrder.deliveryType)}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-[#12335f] border-b border-slate-100 pb-1">Fulfillment Parties</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Buyer (Requester)</p>
                      <p className="text-xs font-bold text-slate-800">{viewingOrder.buyer?.name || 'MSME Portal Buyer'}</p>
                      {viewingOrder.buyer?.email && <p className="text-[10px] font-semibold text-slate-500">{maskEmail(viewingOrder.buyer.email)}</p>}
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Seller (Provider)</p>
                      <p className="text-xs font-bold text-slate-800">{viewingOrder.seller?.name || maskEmail(viewingOrder.seller?.email) || 'MSME Portal Seller'}</p>
                      {viewingOrder.seller?.email && <p className="text-[10px] font-semibold text-slate-500">{maskEmail(viewingOrder.seller.email)}</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-[#12335f] border-b border-slate-100 pb-1">Fulfillment Settings</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Expected Delivery Date</p>
                      <p className="text-xs font-black text-slate-800">{formatDate(viewingOrder.expectedDelivery)}</p>
                    </div>
                    {viewingOrder.deliveryAddress && (
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400">Delivery Address</p>
                        <p title={viewingOrder.deliveryAddress} className="text-xs font-bold text-slate-600 line-clamp-2">{viewingOrder.deliveryAddress}</p>
                      </div>
                    )}
                    {viewingOrder.deliveryTrackings && viewingOrder.deliveryTrackings.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400">Delivery Status / Tracking</p>
                        <div className="mt-1 flex flex-col gap-1.5">
                          {viewingOrder.deliveryTrackings.map((dt: any) => (
                            <div key={dt.id} className="flex items-center gap-2">
                              <EntityIdLink
                                label={dt.trackingNumber || `DLV-${dt.id}`}
                                id={dt.id}
                                size="sm"
                                onClick={() => {
                                  setViewingOrder(null);
                                  router.push(`/seller/delivery-management?search=${encodeURIComponent(viewingOrder.poNumber || `DLV-${dt.id}`)}`);
                                }}
                              />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">({readableStatus(dt.status || 'pending')})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {activeDelivery && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-4 w-4 text-[#12335f]" />
                      <span className="text-xs font-black text-[#12335f]">Shipment Tracking</span>
                    </div>
                    <span className="text-[9px] font-black uppercase bg-[#12335f]/10 text-[#12335f] px-2 py-0.5 rounded border border-[#12335f]/20">
                      {readableStatus(activeDelivery.status || 'pending')}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 space-y-0.5">
                    {activeDelivery.carrierName && <p>Carrier: <span className="font-bold text-slate-800">{activeDelivery.carrierName}</span></p>}
                    {activeDelivery.trackingNumber && <p>Tracking No: <span className="font-bold text-slate-800">{activeDelivery.trackingNumber}</span></p>}
                    {activeDelivery.expectedDelivery && <p>Expected Delivery: <span className="font-bold text-slate-800">{formatDate(activeDelivery.expectedDelivery)}</span></p>}
                  </div>
                  <Button 
                    size="sm"
                    className="w-full bg-[#12335f] text-white hover:bg-[#0b2445] text-[10px] font-black uppercase tracking-wider h-8 mt-1"
                    onClick={() => {
                      setViewingOrder(null);
                      router.push(`/seller/delivery-management?search=${encodeURIComponent(viewingOrder.poNumber || '')}`);
                    }}
                  >
                    Track Shipment Details
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-[#12335f] border-b border-slate-100 pb-1">Workflow Tracking & Timestamps</h4>
                <div className="relative border-l border-slate-200 pl-5 ml-2.5 space-y-4 py-1">
                  <div className="relative">
                    <span className="absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="text-xs font-black text-slate-900">Purchase Order Generated</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">{formatTimestamp(viewingOrder.createdAt)}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">PO record successfully created from procurement bidding workflow.</p>
                  </div>

                  {(() => {
                    const viewingStatusLower = String(viewingOrder.status || '').toLowerCase();
                    return viewingStatusLower !== 'generated' && viewingStatusLower !== 'order_placed' && viewingStatusLower !== 'cancelled' && (
                      <div className="relative">
                        <span className="absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <span className="text-xs font-black text-slate-900">PO Acknowledged by Seller</span>
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            {viewingOrder.acceptedAt ? formatTimestamp(viewingOrder.acceptedAt) : 'Pending timestamp'}
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Seller acknowledged and committed to fulfilling this order.</p>
                      </div>
                    );
                  })()}

                  {viewingOrder.status === 'delivered' && (
                    <div className="relative">
                      <span className="absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-black text-slate-900">Delivered & Completed</span>
                        <span className="text-[10px] font-mono font-bold text-slate-500">Completed</span>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Consignment has been safely delivered and confirmed by buyer.</p>
                    </div>
                  )}

                  {viewingOrder.status === 'cancelled' && (
                    <div className="relative">
                      <span className="absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-4 ring-red-50" />
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-black text-red-700">Order Cancelled</span>
                        <span className="text-[10px] font-mono font-bold text-red-500">Cancelled</span>
                      </div>
                      <p className="text-[10px] font-semibold text-red-500 mt-0.5">Fulfillment terminated by one of the parties.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Terms & Documents section */}
              {(() => {
                const terms = (viewingOrder.metadata as any)?.termsDocuments || {};
                const docs = (Array.isArray(terms.documents) ? terms.documents : []) as Array<{
                  documentType: string;
                  fileAssetId: number;
                  fileName: string;
                  fileSize: number;
                }>;
                
                const hasTerms = terms.deliveryTerms || terms.paymentTerms || terms.warrantyTerms || terms.inspectionTerms || terms.delayPenaltyDetails || terms.additionalTerms;
                const hasDocs = docs.length > 0;

                if (!hasTerms && !hasDocs) return null;

                return (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-[#12335f] border-b border-slate-100 pb-1">Procurement Terms & Documents</h4>
                    <div className="grid gap-4 sm:grid-cols-2 text-xs">
                      {hasTerms && (
                        <div className="space-y-2">
                          {terms.deliveryTerms && <div><p className="text-[9px] font-black uppercase text-slate-400">Delivery Terms</p><p className="font-semibold text-slate-700">{terms.deliveryTerms}</p></div>}
                          {terms.paymentTerms && <div><p className="text-[9px] font-black uppercase text-slate-400">Payment Terms</p><p className="font-semibold text-slate-700">{terms.paymentTerms}</p></div>}
                          {terms.warrantyTerms && <div><p className="text-[9px] font-black uppercase text-slate-400">Warranty Terms</p><p className="font-semibold text-slate-700">{terms.warrantyTerms}</p></div>}
                          {terms.inspectionTerms && <div><p className="text-[9px] font-black uppercase text-slate-400">Inspection Terms</p><p className="font-semibold text-slate-700">{terms.inspectionTerms}</p></div>}
                          {terms.delayPenaltyDetails && <div><p className="text-[9px] font-black uppercase text-slate-400">Delay Penalty Details</p><p className="font-semibold text-slate-700">{terms.delayPenaltyDetails}</p></div>}
                          {terms.additionalTerms && <div><p className="text-[9px] font-black uppercase text-slate-400">Additional Terms</p><p className="font-semibold text-slate-700">{terms.additionalTerms}</p></div>}
                        </div>
                      )}
                      {hasDocs && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase text-slate-400">Uploaded Procurement Documents</p>
                          <div className="space-y-1.5">
                            {docs.map((doc, dIdx) => (
                              <div key={dIdx} className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-100 px-3 py-2">
                                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{doc.documentType}</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openFileAsset({
                                        id: doc.fileAssetId,
                                        fileAssetId: doc.fileAssetId,
                                        originalName: doc.fileName,
                                      }, doc.fileName).catch(err => {
                                        toast.error(err instanceof Error ? err.message : 'Unable to open document');
                                      });
                                    }}
                                    title={doc.fileName}
                                    className="block truncate text-xs font-bold text-[#12335f] hover:underline text-left w-full"
                                  >
                                    {doc.fileName}
                                  </button>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 shrink-0">({(doc.fileSize / 1024).toFixed(0)} KB)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-[#12335f] border-b border-slate-100 pb-1">Line Items</h4>
                <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/50">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="w-16 p-2.5">Sr. No</th>
                        <th className="p-2.5">Item Name</th>
                        <th className="p-2.5 w-16 text-center">Qty</th>
                        <th className="p-2.5 text-right w-28">Unit Price</th>
                        <th className="p-2.5 text-right w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(viewingOrder.items?.length ? viewingOrder.items : [{ itemName: viewingOrder.title, quantity: 1, unitPrice: viewingOrder.amount || viewingOrder.totalValue, totalAmount: viewingOrder.amount || viewingOrder.totalValue }]).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="p-2.5 text-xs font-black text-slate-500">{String(idx + 1).padStart(2, '0')}</td>
                          <td className="p-2.5 font-bold text-slate-800">{item.itemName || viewingOrder.title}</td>
                          <td className="p-2.5 text-center font-bold text-slate-600">{Number(item.quantity || 1)}</td>
                          <td className="p-2.5 text-right font-semibold text-slate-600">{formatCurrency(item.unitPrice)}</td>
                          <td className="p-2.5 text-right font-black text-slate-900">{formatCurrency(item.totalAmount || (Number(item.quantity || 1) * Number(item.unitPrice || 0)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <div className="bg-[#12335f]/5 border border-[#12335f]/10 rounded-xl px-5 py-3 text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#12335f] block">Grand Total Value</span>
                  <span className="text-xl font-black text-[#12335f] mt-0.5 block">{formatCurrency(viewingOrder.amount || viewingOrder.totalValue)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 shrink-0">
              {(() => {
                const viewingStatusLower = String(viewingOrder.status || '').toLowerCase();
                const isIssuedModal = viewingStatusLower === 'issued' || viewingStatusLower === 'generated' || viewingStatusLower === 'order_placed';
                const isAcceptedModal = viewingStatusLower === 'accepted' || viewingStatusLower === 'in_fulfillment';
                return (
                  <>
                    {isSeller && isIssuedModal && (
                      <>
                        <Button
                          onClick={() => {
                            setViewingOrder(null);
                            handleAcceptOrder(viewingOrder);
                          }}
                          className="h-10 bg-emerald-600 text-xs font-black uppercase text-white hover:bg-emerald-700 shadow-sm"
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Accept PO
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setViewingOrder(null);
                            handleRejectOrder(viewingOrder);
                          }}
                          className="h-10 border-rose-200 text-xs font-black uppercase text-rose-600 hover:bg-rose-50"
                        >
                          <XCircle className="mr-1.5 h-4 w-4" /> Reject PO
                        </Button>
                      </>
                    )}
                    {isSeller && (isAcceptedModal || viewingStatusLower === 'delivered') && (
                      <Button
                        onClick={() => {
                          setViewingOrder(null);
                          handleOpenDelivery(viewingOrder);
                        }}
                        className="h-10 bg-[#12335f] text-xs font-black uppercase text-white hover:bg-[#0b2445] shadow-sm"
                      >
                        <Truck className="mr-1.5 h-4 w-4" /> Delivery / Manage Dispatch
                      </Button>
                    )}
                    {isBuyer && !['cancelled', 'delivered'].includes(viewingStatusLower) && (
                      <Button
                        onClick={() => setConfirming({ action: 'cancel', order: viewingOrder })}
                        className="h-10 border-rose-200 text-xs font-black uppercase text-rose-600 hover:bg-rose-50"
                      >
                        <XCircle className="mr-1.5 h-4 w-4" /> Cancel PO
                      </Button>
                    )}
                    {isBuyer && viewingStatusLower === 'delivered' && (
                      <Button
                        onClick={() => handleOpenRepeatModal(viewingOrder)}
                        className="h-10 bg-[#12335f] text-xs font-black uppercase text-white hover:bg-[#0b2445] shadow-sm"
                      >
                        <RefreshCw className="mr-1.5 h-4 w-4" /> Repeat Order
                      </Button>
                    )}
                  </>
                );
              })()}
              <Button variant="outline" onClick={() => exportInvoicePdf(viewingOrder, 'print')} className="h-10 text-xs font-black uppercase">
                <Printer className="mr-1.5 h-4 w-4" /> Print PO
              </Button>
              <Button variant="outline" onClick={() => exportInvoicePdf(viewingOrder, 'download')} className="h-10 text-xs font-black uppercase">
                <Download className="mr-1.5 h-4 w-4" /> Download PDF
              </Button>
              <Button onClick={() => setViewingOrder(null)} className="h-10 bg-slate-800 text-xs font-black uppercase text-white hover:bg-slate-900">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
      {repeatingOrder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-[#12335f]" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Repeat Purchase Order</h3>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                Replicating completed order <span className="font-bold text-slate-800">{repeatingOrder.poNumber}</span>.
              </p>
            </div>
            <form onSubmit={handleConfirmRepeatOrder} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
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
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={repeatQuantity}
                  onChange={(e) => setRepeatQuantity(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  required
                  value={repeatDeliveryDate}
                  onChange={(e) => setRepeatDeliveryDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Delivery Address</label>
                <textarea
                  required
                  rows={2}
                  value={repeatAddress}
                  onChange={(e) => setRepeatAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10"
                />
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Estimated Value</span>
                <span className="text-sm font-black text-[#12335f]">
                  {formatCurrency((Number(repeatingOrder.items?.[0]?.unitPrice) || Number(repeatingOrder.amount)) * repeatQuantity)}
                </span>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button type="button" variant="outline" onClick={() => setRepeatingOrder(null)} className="h-9 text-[10px] font-black uppercase">Cancel</Button>
                <Button type="submit" disabled={repeatSubmitting} className="h-9 bg-[#12335f] text-[10px] font-black uppercase text-white hover:bg-[#0b2445]">
                  {repeatSubmitting ? 'Placing Order...' : 'Confirm Order'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-slate-800">{value || '-'}</p>
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  const value = String(status || 'generated').toLowerCase();
  const isAccepted = value === 'accepted';
  const isCancelled = value === 'cancelled' || value === 'rejected';
  const isDelivered = value === 'delivered';
  const isIssued = value === 'issued' || value === 'generated' || value === 'order_placed';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-wide',
        isAccepted && 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-2xs',
        isDelivered && 'border-green-300 bg-green-50 text-green-800 shadow-2xs',
        isCancelled && 'border-rose-300 bg-rose-50 text-rose-800 shadow-2xs',
        isIssued && 'border-sky-300 bg-sky-50 text-sky-900 shadow-2xs',
        !isAccepted && !isDelivered && !isCancelled && !isIssued && 'border-slate-200 bg-slate-50 text-slate-700'
      )}
    >
      {isAccepted ? 'ACCEPTED' : isIssued ? 'ISSUED' : readableStatus(value).toUpperCase()}
    </span>
  );
}
