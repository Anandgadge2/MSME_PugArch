/**
 * DeliveryDetailPage - role-aware single source of truth for one delivery.
 * Powered by React Query + sonner toast helpers so:
 *   - The detail view is cached and reopens instantly
 *   - Action panels show optimistic feedback via toasts (no inline banners
 *     that pile up across actions)
 *   - Document uploads show real progress + drag-drop
 *   - When the delivery is closed, the user can rate the counterparty in one click
 */

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  Key,
  Layers,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Upload,
  User,
  Wallet,
  X
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input, Select } from '../../../components/ui/input';
import { useAuth } from '../../../hooks/useAuth';
import { EmptyState, InlineError } from '../../shared/FeatureStates';
import { CardSkeleton, ListSkeleton } from '../../../components/ui/skeleton';
import { formatCurrency, formatDate } from '../../shared/format';
import { cn } from '../../../lib/utils';
import { runWithToast, notify } from '../../../lib/toast';
import { DeliveryStatusBadge } from '../components/DeliveryStatusBadge';
import { DeliveryTimeline } from '../components/DeliveryTimeline';
import { DELIVERY_STATUS_LABELS, isLiveStatus, labelFor } from '../status';
import { RatingComposer } from '../../ratings/components/RatingComposer';
import { useMyRatingForPO } from '../../ratings/hooks';
import { Transaction2FAModal } from '../../../components/common/Transaction2FAModal';
import { useTransaction2FA } from '../../../hooks/useTransaction2FA';
import {
  useAddDeliveryDocument,
  useAdminOverride,
  useBuyerAcceptance,
  useDeliveryDetail,
  useInitiateReturn,
  useLdCalculation,
  useManualDeliveryStatusUpdate,
  usePaymentDecision,
  useRaiseDispute,
  useReleaseDeliveryPayment,
  useRequestDpExtension,
  useRespondDpExtension,
  useResolveDispute,
  useSendDeliveryOtp,
  useVerifyDeliveryOtp,
  useVerifyInvoice
} from '../hooks';
import { uploadDeliveryFile } from '../upload';
import type {
  DeliveryDetailDto,
  DeliveryDocumentType,
  DeliveryStatus
} from '../types';

const ALL_STATUSES = Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[];

const fieldLabel = 'text-[10px] font-black uppercase tracking-wider text-slate-400';
const sectionHeader = 'text-xs font-black uppercase tracking-wider text-[#0f766e]';
const inputBase = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]/25 transition-all';
const textareaBase = `${inputBase} h-24 py-2.5`;

const MANUAL_TRACKING_FLOW: DeliveryStatus[] = [
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

const nextManualStatusFor = (status: DeliveryStatus): DeliveryStatus | null => {
  if (status === 'DISPATCHED') return 'IN_TRANSIT';
  const index = MANUAL_TRACKING_FLOW.indexOf(status);
  if (index < 0 || index >= MANUAL_TRACKING_FLOW.length - 1) return null;
  return MANUAL_TRACKING_FLOW[index + 1];
};

const latestManualUpdateFor = (delivery: DeliveryDetailDto) => {
  const manualStatuses = new Set<DeliveryStatus>(MANUAL_TRACKING_FLOW);
  return [...(delivery.statusLogs || [])]
    .filter(log => log.actorRole === 'seller' && manualStatuses.has(log.newStatus) && log.previousStatus !== log.newStatus)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
};

/**
 * Copy to clipboard helper with sonner toast feedback
 */
const copyToClipboard = (text: string, label: string) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  notify.success(`${label} copied to clipboard!`);
};

/**
 * Collapsible section wrapper with sleek visual design
 */
function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  meta,
  children,
  className
}: {
  title: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={cn('overflow-hidden rounded-2xl border-slate-200/80 bg-white/95 shadow-xs transition-shadow duration-300 hover:shadow-sm', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2.5 sm:gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80 focus:outline-hidden"
      >
        <span className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0f766e]/10 text-[#0f766e]">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <span className={sectionHeader}>{title}</span>
        </span>
        <span className="flex items-center gap-2">
          {meta}
          <ChevronDown
            className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
          />
        </span>
      </button>
      {open && <div className="border-t border-slate-100/90 px-4 py-4 sm:px-5 sm:py-5">{children}</div>}
    </Card>
  );
}

interface DeliveryDetailPageProps {
  deliveryId: number;
  onClose?: () => void;
}

export function DeliveryDetailPage({ deliveryId, onClose }: DeliveryDetailPageProps) {
  const { user } = useAuth();
  const detailQuery = useDeliveryDetail(deliveryId);

  const delivery = detailQuery.data;

  const accessRole = useMemo(() => {
    if (!user || !delivery) return null;
    if (user.role === 'admin') return 'admin';
    if (delivery.purchaseOrder?.sellerId === Number(user.id)) return 'seller';
    if (delivery.purchaseOrder?.buyerId === Number(user.id)) return 'buyer';
    const participant = (delivery.participants || []).find(p => p.userId === Number(user.id) && p.isActive);
    if (participant?.participantRole === 'CONSIGNEE') return 'consignee';
    if (participant?.participantRole === 'LOGISTICS_PARTNER') return 'logistics';
    if (participant?.participantRole === 'FINANCE_OFFICER') return 'finance';
    if (participant?.participantRole === 'DISPUTE_OFFICER') return 'dispute';
    return null;
  }, [user, delivery]);

  if (detailQuery.isLoading && !detailQuery.data) {
    return (
      <div className="space-y-4">
        <CardSkeleton rows={4} />
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (detailQuery.error) {
    return (
      <InlineError
        message={detailQuery.error instanceof Error ? detailQuery.error.message : 'Failed to load delivery'}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }
  if (!delivery) return <EmptyState title="Delivery not found" />;

  const po = delivery.purchaseOrder;
  const docs = delivery.documents || [];
  const isFetching = detailQuery.isFetching;
  const latestManual = latestManualUpdateFor(delivery);
  const nextManualStatus = nextManualStatusFor(delivery.status);
  const isSellerTrackingView = accessRole === 'seller';

  const sellerName = po?.seller?.name || 'Seller';
  const buyerName = po?.buyer?.name || 'Buyer';
  const poNumber = po?.poNumber || `PO-${delivery.purchaseOrderId}`;
  const trackingNo = delivery.trackingNumber || `DLV-${delivery.id}`;

  return (
    <div className="space-y-5">
      {/* ─── Premium Header Card ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white via-slate-50/50 to-teal-50/30 p-5 shadow-xs sm:p-6">
        <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-[#0f766e]/5 blur-2xl pointer-events-none" />
        
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#12335f] to-[#07172e] text-white shadow-sm ring-4 ring-[#12335f]/10">
              <Package className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              {/* Top Reference Bar */}
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <DeliveryStatusBadge status={delivery.status} size="sm" />
                <button
                  type="button"
                  onClick={() => copyToClipboard(poNumber, 'PO Number')}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700 transition-colors"
                  title="Click to copy Purchase Order number"
                >
                  <span className="text-slate-400 font-semibold">PO:</span>
                  <span>{poNumber}</span>
                  <Copy className="h-2.5 w-2.5 text-slate-400 group-hover:text-slate-700" />
                </button>
                <SlaBadge slaStatus={delivery.slaStatus} />
              </div>

              {/* Order Title */}
              <h1 className="text-xl font-black tracking-tight text-slate-950 break-words sm:text-2xl lg:text-3xl">
                {po?.title || po?.poNumber || `Delivery #${delivery.id}`}
              </h1>

              {/* Counterparty Route */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 shadow-2xs border border-slate-200/80">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Supplier:</span>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-700">
                    {sellerName.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{sellerName}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 shadow-2xs border border-slate-200/80">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#0f766e]">Consignee:</span>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-[9px] font-bold text-[#0f766e]">
                    {buyerName.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{buyerName}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 md:self-start">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(window.location.href, 'Tracking Link')}
              className="h-9.5 rounded-xl border-slate-200 bg-white px-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Share Link
            </Button>
            <Button
              variant="outline"
              onClick={onClose || (() => window.history.back())}
              className="h-9.5 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-black uppercase text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => detailQuery.refetch()}
              className="h-9.5 rounded-xl border-[#0f766e] bg-[#0f766e] px-4 text-xs font-black uppercase text-white hover:bg-[#0d665f] shadow-2xs"
            >
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Delivery Overview Command Center ─── */}
      <CollapsibleSection title="Delivery Command Center" icon={Package} defaultOpen>
        <div className="space-y-4">
          {/* Top Status & SLA Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50/60 via-emerald-50/30 to-sky-50/40 p-3.5 sm:p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0f766e] shadow-xs border border-teal-100">
                <Truck className="h-5 w-5 dt-bounce-soft" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Current Movement Status</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-base font-black text-slate-950 sm:text-lg">
                    {DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}
                  </span>
                  <DeliveryStatusBadge status={delivery.status} size="sm" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 shadow-2xs">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Estimated Delivery Date</p>
                <p className="text-xs font-black text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-[#0f766e]" />
                  {formatDate(delivery.expectedDelivery || po?.expectedDelivery)}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Rich Metric Tiles */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* Tile 1: Logistics & Carrier */}
            <div className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-teal-200 hover:shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Logistics & Carrier</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50 text-[#0f766e]">
                  <Truck className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 text-xs font-black text-slate-900 truncate">
                {delivery.carrierName || delivery.logisticsPartnerName || 'Assigned Courier'}
              </p>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-100">
                <div className="min-w-0 pr-1">
                  <span className="block text-[8px] font-bold uppercase text-slate-400">AWB Tracking No</span>
                  <span className="font-mono text-[11px] font-bold text-slate-700 truncate block">{trackingNo}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(trackingNo, 'Tracking Number')}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-[#0f766e] transition-colors"
                  aria-label="Copy Tracking Number"
                  title="Copy Tracking Number"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500 flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                Location: {delivery.currentLocation || 'In Transit'}
              </p>
            </div>

            {/* Tile 2: Destination & Address */}
            <div className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-teal-200 hover:shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Delivery Destination</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <MapPin className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 text-xs font-black text-slate-900 truncate">
                {buyerName}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold text-slate-600 line-clamp-2 leading-relaxed" title={po?.deliveryAddress || 'Address not specified'}>
                {po?.deliveryAddress || 'Address not specified'}
              </p>
            </div>

            {/* Tile 3: Financial & Settlement */}
            <div className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-teal-200 hover:shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Order Value & Escrow</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Wallet className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 text-base font-black text-slate-950">
                {formatCurrency(po?.amount || po?.totalValue)}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">Escrow State:</span>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
                  delivery.settlement?.status === 'RELEASED' ? 'bg-emerald-100 text-emerald-800' :
                  delivery.settlement?.status === 'APPROVED' ? 'bg-teal-100 text-[#0f766e]' :
                  'bg-slate-100 text-slate-600'
                )}>
                  {delivery.settlement?.status || 'FUNDS SECURED'}
                </span>
              </div>
            </div>

            {/* Tile 4: Next Milestone */}
            <div className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-teal-200 hover:shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Next Milestone</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Layers className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 text-xs font-black text-slate-900 truncate">
                {nextManualStatus ? DELIVERY_STATUS_LABELS[nextManualStatus] : 'Fully Completed'}
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span>SLA Health:</span>
                <span className="font-extrabold text-[#0f766e]">{delivery.slaStatus || 'ON_TIME'}</span>
              </div>
              {delivery.packageWeightKg && (
                <p className="mt-1 text-[9px] font-bold text-slate-400">
                  Pkg: {delivery.packageWeightKg} kg • {delivery.packageCount || 1} unit(s)
                </p>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Rating CTA - only when delivery is in a rate-able state. */}
      {accessRole === 'buyer' && delivery.purchaseOrderId && (
        <RatingCTACard
          deliveryStatus={delivery.status}
          accessRole={accessRole}
          purchaseOrderId={delivery.purchaseOrderId}
          counterpartyId={
            accessRole === 'buyer'
              ? delivery.purchaseOrder?.sellerId
              : delivery.purchaseOrder?.buyerId
          }
          counterpartyName={
            accessRole === 'buyer'
              ? delivery.purchaseOrder?.seller?.name
              : delivery.purchaseOrder?.buyer?.name
          }
        />
      )}

      {/* ─── Main Content Grid & Right Action Rail ─── */}
      <div className={cn('grid grid-cols-1 gap-5', isSellerTrackingView ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : 'xl:grid-cols-[minmax(0,1fr)_390px]')}>
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
            <SectionHeading
              icon={Truck}
              title="Live Tracking & Milestones"
              meta={
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Real-Time Updates
                </span>
              }
            />
            <DeliveryTimeline status={delivery.status} events={delivery.events} statusLogs={delivery.statusLogs} />
          </section>

          {!isSellerTrackingView && (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                <DpExtensionSection delivery={delivery} accessRole={accessRole} />
                <LiquidatedDamagesCard deliveryId={delivery.id} />
              </div>
            </>
          )}

          <DocumentsPanel docs={docs} deliveryId={delivery.id} accessRole={accessRole} />
        </div>

        {/* ─── Right Action Rail ─── */}
        <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          {accessRole === 'seller' && (
            <ManualTrackingActions delivery={delivery} latestManual={latestManual} />
          )}
          {accessRole === 'seller' && (
            <DpExtensionSection delivery={delivery} accessRole={accessRole} />
          )}
          
          {/* Handover OTP Verification — Temporarily commented out as per request */}
          {/* <EmailOtpVerificationCard delivery={delivery} accessRole={accessRole} /> */}

          {(accessRole === 'buyer' || accessRole === 'consignee') && (
            <BuyerActions delivery={delivery} />
          )}
          {(accessRole === 'finance' || accessRole === 'admin') && (
            <FinanceActions delivery={delivery} />
          )}
          {accessRole === 'admin' && <AdminActions delivery={delivery} />}
          {accessRole && accessRole !== 'seller' && (
            <DisputeActions delivery={delivery} accessRole={accessRole} />
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  meta
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0f766e]/10 text-[#0f766e] ring-1 ring-[#0f766e]/20">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">{title}</h2>
      </div>
      {meta}
    </div>
  );
}

function DocumentsPanel({
  docs,
  deliveryId,
  accessRole
}: {
  docs: DeliveryDetailDto['documents'];
  deliveryId: number;
  accessRole: string | null;
}) {
  const records = docs || [];

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
      <SectionHeading
        icon={FileText}
        title="Delivery Documents"
        meta={<span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">{records.length} files attached</span>}
      />
      <div className="space-y-3">
        {records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-xs font-semibold text-slate-500">
            No shipping or tax documents uploaded yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {records.map(doc => (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3 text-xs transition-colors hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0f766e] ring-1 ring-slate-200 shadow-2xs">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black uppercase tracking-tight text-slate-900">{doc.documentType.replace(/_/g, ' ')}</p>
                    <p className="truncate text-[10px] font-semibold text-slate-500">{doc.fileAsset?.originalName || `File #${doc.fileAsset?.id}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-slate-200/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">{doc.uploaderRole}</span>
                  {doc.fileAsset?.id && (
                    <a
                      href={`/api/files/${doc.fileAsset.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#0f766e] hover:bg-slate-50 shadow-2xs"
                    >
                      <ExternalLink className="h-3 w-3" /> View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {accessRole && accessRole !== 'dispute' && <DocumentUploadForm deliveryId={deliveryId} />}
      </div>
    </section>
  );
}

/* ================== Rating CTA ================== */

const RATEABLE_STATUSES: DeliveryStatus[] = ['ACCEPTED', 'INVOICE_VERIFIED', 'PAYMENT_APPROVED', 'PAYMENT_RELEASED', 'CLOSED'];

function RatingCTACard({
  deliveryStatus,
  accessRole,
  purchaseOrderId,
  counterpartyId,
  counterpartyName
}: {
  deliveryStatus: DeliveryStatus;
  accessRole: 'buyer' | 'seller';
  purchaseOrderId: number;
  counterpartyId?: number;
  counterpartyName?: string;
}) {
  const myRating = useMyRatingForPO(purchaseOrderId);
  const [open, setOpen] = useState(false);

  const isRateable = RATEABLE_STATUSES.includes(deliveryStatus);
  if (!isRateable) return null;
  if (!counterpartyId) return null;

  const existing = myRating.data?.rating;
  const hasRated = !!existing;

  return (
    <>
      <Card className="rounded-2xl border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-orange-50/40 shadow-xs">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-4 ring-amber-200/50 shadow-xs">
              <Star className="h-5 w-5 fill-current" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-900">
                {hasRated ? 'Transaction Review Recorded' : 'Rate Your Delivery Experience'}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700">
                {hasRated
                  ? `Your rating: ${existing?.rating}/5 ⭐ — Click to update feedback.`
                  : `Share your fulfillment feedback for ${counterpartyName || 'the counterparty'}.`}
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="h-9.5 rounded-xl bg-amber-600 text-xs font-black uppercase text-white hover:bg-amber-700 shadow-xs">
            {hasRated ? 'Edit Rating' : 'Rate Now'}
          </Button>
        </CardContent>
      </Card>
      <RatingComposer
        open={open}
        mode={accessRole === 'buyer' ? 'supplier' : 'buyer'}
        subjectId={counterpartyId}
        subjectName={counterpartyName}
        purchaseOrderId={purchaseOrderId}
        existing={existing}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/* ================== Role-specific action panels ================== */

function ManualTrackingActions({
  delivery,
  latestManual
}: {
  delivery: DeliveryDetailDto;
  latestManual?: ReturnType<typeof latestManualUpdateFor>;
}) {
  const nextStatus = nextManualStatusFor(delivery.status);
  const latest = latestManual;
  const updateMut = useManualDeliveryStatusUpdate(delivery.id);

  const updateStatus = () => {
    if (!nextStatus) return;
    runWithToast(
      () => updateMut.mutateAsync({ status: nextStatus }),
      {
        loading: `Advancing to ${DELIVERY_STATUS_LABELS[nextStatus]}...`,
        success: `Status advanced to ${DELIVERY_STATUS_LABELS[nextStatus]}!`,
        error: (err: any) => err?.message || 'Status update failed'
      }
    );
  };

  const isCompleted = delivery.status === 'DELIVERED' || delivery.status === 'CLOSED';

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
      <SectionHeading
        icon={Truck}
        title="Shipment Controls"
        meta={<span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#0f766e]">Seller Rail</span>}
      />
      <div className="space-y-4">
        {/* Current State Showcase */}
        <div className="overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#0f766e]">Current Milestone</span>
            <DeliveryStatusBadge status={delivery.status} size="sm" />
          </div>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            {DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}
          </h3>

          <div className="mt-3 space-y-2 border-t border-teal-100/70 pt-3 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Tracking AWB:</span>
              <span className="font-mono font-bold text-slate-900">{delivery.trackingNumber || `DLV-${delivery.id}`}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Carrier:</span>
              <span className="font-bold text-slate-900">{delivery.carrierName || delivery.logisticsPartnerName || 'Standard'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">ETA:</span>
              <span className="font-bold text-slate-900">{formatDate(delivery.expectedDelivery || delivery.purchaseOrder?.expectedDelivery)}</span>
            </div>
          </div>
        </div>

        {/* Latest Seller Update */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <p className={fieldLabel}>Previous Milestone Log</p>
          {latest ? (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">{DELIVERY_STATUS_LABELS[latest.newStatus]}</span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500">
                {[latest.remarks, formatDate(latest.createdAt)].filter(Boolean).join(' • ')}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs font-semibold text-slate-400">No previous manual updates recorded.</p>
          )}
        </div>

        {/* Next Action Box with prominent button */}
        <div className="space-y-2.5 rounded-xl border border-teal-200/70 bg-teal-50/30 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#0f766e]">
              {isCompleted ? 'Fulfillment Complete' : 'Next Milestone Action'}
            </span>
          </div>

          {!isCompleted && nextStatus ? (
            <div className="rounded-lg bg-white p-2.5 border border-teal-100 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500">Milestone Target:</p>
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5 mt-0.5">
                <ArrowRight className="h-3.5 w-3.5 text-[#0f766e]" />
                {DELIVERY_STATUS_LABELS[nextStatus]}
              </p>
            </div>
          ) : null}

          <Button
            className={cn(
              'w-full h-11 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-xs',
              isCompleted
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-[#0f766e] text-white hover:bg-[#0d665f] active:scale-98'
            )}
            disabled={!nextStatus || updateMut.isPending || isCompleted}
            onClick={updateStatus}
          >
            {updateMut.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : isCompleted ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-2 h-4 w-4 stroke-[3]" />
            )}
            {isCompleted
              ? 'Delivery Completed'
              : nextStatus
              ? `Advance: ${DELIVERY_STATUS_LABELS[nextStatus]}`
              : 'Status Updated'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function BuyerActions({ delivery }: { delivery: DeliveryDetailDto }) {
  const [accept, setAccept] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [damageNotes, setDamageNotes] = useState('');
  const [missingQty, setMissingQty] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnType, setReturnType] = useState<'RETURN' | 'REPLACEMENT' | 'REFUND'>('RETURN');

  const acceptanceMut = useBuyerAcceptance(delivery.id);
  const returnMut = useInitiateReturn(delivery.id);

  const canAcceptStage = ['DELIVERED', 'DELIVERY_CONFIRMATION_PENDING', 'DISPUTE_RESOLVED'].includes(delivery.status);
  const canReturnStage = ['ACCEPTED', 'REJECTED', 'DELIVERED'].includes(delivery.status);

  const submitDecision = () =>
    runWithToast(
      () =>
        acceptanceMut.mutateAsync({
          accepted: accept,
          rejectionReason: accept ? undefined : rejectReason,
          damageNotes: accept ? undefined : damageNotes,
          missingQuantity: missingQty ? Number(missingQty) : undefined
        }),
      {
        loading: 'Submitting receipt decision...',
        success: accept ? 'Shipment accepted successfully!' : 'Rejection recorded.',
        error: 'Failed to submit decision'
      }
    );

  const submitReturn = () =>
    runWithToast(
      () => returnMut.mutateAsync({ type: returnType, reason: returnReason }),
      { loading: 'Initiating return request...', success: 'Return initiated', error: 'Action failed' }
    );

  return (
    <CollapsibleSection title="Receipt & Acceptance" icon={CheckCircle2} defaultOpen>
      <div className="space-y-4">
        {!canAcceptStage && (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs font-semibold text-slate-500 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <span>Acceptance becomes available once the shipment is marked as delivered.</span>
          </div>
        )}

        {canAcceptStage && (
          <div className="space-y-3">
            <p className={fieldLabel}>Verification Decision</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAccept(true)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-black uppercase tracking-wider transition-all duration-200',
                  accept
                    ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                <CheckCircle2 className={cn('h-5 w-5', accept ? 'text-emerald-600' : 'text-slate-400')} />
                <span>Accept Delivery</span>
              </button>

              <button
                type="button"
                onClick={() => setAccept(false)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-black uppercase tracking-wider transition-all duration-200',
                  !accept
                    ? 'border-rose-500 bg-rose-50/80 text-rose-800 ring-2 ring-rose-500/20 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                <AlertTriangle className={cn('h-5 w-5', !accept ? 'text-rose-600' : 'text-slate-400')} />
                <span>Report / Reject</span>
              </button>
            </div>

            {!accept && (
              <div className="space-y-2.5 rounded-xl border border-rose-100 bg-rose-50/30 p-3 dt-fade-in-up">
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-800">Issue Details</p>
                <textarea
                  className={textareaBase}
                  placeholder="State the reason for rejection (required)..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
                <textarea
                  className={textareaBase}
                  placeholder="Damage / wrong item details (optional)..."
                  value={damageNotes}
                  onChange={e => setDamageNotes(e.target.value)}
                />
                <Input
                  placeholder="Missing quantity (if applicable)"
                  value={missingQty}
                  onChange={e => setMissingQty(e.target.value)}
                />
              </div>
            )}

            <Button
              className={cn(
                'w-full h-10.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-xs',
                accept
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              )}
              disabled={(!accept && !rejectReason.trim()) || acceptanceMut.isPending}
              onClick={submitDecision}
            >
              {acceptanceMut.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : accept ? (
                <Check className="mr-2 h-4 w-4 stroke-[3]" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              {accept ? 'Confirm & Accept Delivery' : 'Submit Rejection Report'}
            </Button>
          </div>
        )}

        {canReturnStage && (
          <div className="space-y-2.5 border-t border-slate-100 pt-3">
            <p className={fieldLabel}>Initiate Return / Replacement</p>
            <Select value={returnType} onChange={e => setReturnType(e.target.value as any)}>
              <option value="RETURN">Return Goods</option>
              <option value="REPLACEMENT">Replacement Request</option>
              <option value="REFUND">Full Refund Request</option>
            </Select>
            <textarea
              className={textareaBase}
              placeholder="State reason for return/replacement..."
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
            />
            <Button
              variant="outline"
              className="w-full h-10 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 border-slate-200 hover:bg-slate-50"
              disabled={!returnReason.trim() || returnMut.isPending}
              onClick={submitReturn}
            >
              {returnMut.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Initiate {returnType}
            </Button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function FinanceActions({ delivery }: { delivery: DeliveryDetailDto }) {
  const invoices = delivery.purchaseOrder?.invoices || [];

  const defaultInvoiceId = useMemo(() => {
    if (invoices.length === 0) return '';
    const ranked = [...invoices].sort((a, b) => {
      const score = (inv: typeof a) => {
        const status = String(inv.invoiceStatus || inv.status || '').toLowerCase();
        if (status === 'approved') return 3;
        if (status === 'submitted') return 2;
        if (status === 'under_review') return 1;
        return 0;
      };
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return String(ranked[0].id);
  }, [invoices]);

  const [invoiceId, setInvoiceId] = useState<string>(defaultInvoiceId);
  const [decision, setDecision] = useState({ approve: true, rejectionReason: '', deductionAmount: '', penaltyAmount: '' });
  const [release, setRelease] = useState({ transactionReference: '', netReleasedAmount: '', remarks: '' });

  const verifyMut = useVerifyInvoice(delivery.id);
  const decisionMut = usePaymentDecision(delivery.id);
  const releaseMut = useReleaseDeliveryPayment(delivery.id);

  const selectedInvoice = invoices.find(inv => String(inv.id) === invoiceId);
  const { require2FA, modalProps } = useTransaction2FA();

  return (
    <CollapsibleSection title="Finance & Escrow Settlement" icon={Wallet} defaultOpen>
      <div className="space-y-4">
        {delivery.status === 'ACCEPTED' && (
          <div className="space-y-3">
            <p className={fieldLabel}>Invoice Verification</p>
            {invoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 p-3 text-xs font-semibold text-amber-800">
                No invoices submitted yet. The seller must raise a tax invoice before payment release can be authorized.
              </div>
            ) : (
              <>
                <Select value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {(inv.invoiceNumber || `Invoice #${inv.id}`)}
                      {inv.amount ? ` • ${formatCurrency(inv.amount)}` : ''}
                      {inv.invoiceStatus || inv.status ? ` • ${(inv.invoiceStatus || inv.status || '').toString().toUpperCase()}` : ''}
                    </option>
                  ))}
                </Select>

                {selectedInvoice && (
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs space-y-1.5">
                    <Row label="Invoice #" value={selectedInvoice.invoiceNumber || `#${selectedInvoice.id}`} />
                    {selectedInvoice.amount !== undefined && (
                      <Row label="Total Amount" value={formatCurrency(selectedInvoice.amount)} />
                    )}
                    <Row
                      label="Current State"
                      value={(selectedInvoice.invoiceStatus || selectedInvoice.status || 'submitted').toString().toUpperCase()}
                    />
                    {selectedInvoice.invoiceFile?.id && (
                      <a
                        href={`/api/files/${selectedInvoice.invoiceFile.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#0f766e] hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> Preview PDF Document
                      </a>
                    )}
                  </div>
                )}

                <Button
                  className="w-full h-10 rounded-xl bg-[#0f766e] text-xs font-black uppercase tracking-wider text-white hover:bg-[#0d665f] shadow-xs"
                  disabled={!invoiceId || verifyMut.isPending}
                  onClick={() =>
                    runWithToast(() => verifyMut.mutateAsync({ invoiceId: Number(invoiceId) }), {
                      loading: 'Verifying invoice...',
                      success: 'Invoice verified successfully!',
                      error: 'Verification failed'
                    })
                  }
                >
                  {verifyMut.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Mark Invoice Verified
                </Button>
              </>
            )}
          </div>
        )}

        {delivery.status === 'INVOICE_VERIFIED' && (
          <div className="space-y-3">
            <p className={fieldLabel}>Payment Decision</p>
            <Select value={decision.approve ? 'approve' : 'reject'} onChange={e => setDecision(s => ({ ...s, approve: e.target.value === 'approve' }))}>
              <option value="approve">Approve Escrow Payment</option>
              <option value="reject">Reject & Hold Payment</option>
            </Select>
            <Input placeholder="Deduction amount (if any)" value={decision.deductionAmount} onChange={e => setDecision(s => ({ ...s, deductionAmount: e.target.value }))} />
            <Input placeholder="Penalty amount (if any)" value={decision.penaltyAmount} onChange={e => setDecision(s => ({ ...s, penaltyAmount: e.target.value }))} />
            {!decision.approve && (
              <textarea className={textareaBase} placeholder="Specify rejection reason..." value={decision.rejectionReason} onChange={e => setDecision(s => ({ ...s, rejectionReason: e.target.value }))} />
            )}
            <Button
              className="w-full h-10 rounded-xl bg-[#0f766e] text-xs font-black uppercase tracking-wider text-white hover:bg-[#0d665f] shadow-xs"
              disabled={(!decision.approve && !decision.rejectionReason.trim()) || decisionMut.isPending}
              onClick={() =>
                runWithToast(
                  () =>
                    decisionMut.mutateAsync({
                      approve: decision.approve,
                      rejectionReason: decision.approve ? undefined : decision.rejectionReason,
                      deductionAmount: decision.deductionAmount ? Number(decision.deductionAmount) : undefined,
                      penaltyAmount: decision.penaltyAmount ? Number(decision.penaltyAmount) : undefined
                    }),
                  {
                    loading: decision.approve ? 'Approving payment...' : 'Rejecting payment...',
                    success: decision.approve ? 'Payment approved' : 'Payment rejected',
                    error: 'Decision failed'
                  }
                )
              }
            >
              {decisionMut.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Submit Payment Decision
            </Button>
          </div>
        )}

        {delivery.status === 'PAYMENT_APPROVED' && (
          <div className="space-y-3">
            <p className={fieldLabel}>Release Escrow Payment (2FA Required)</p>
            <Input placeholder="Transaction UTR / Bank Reference" value={release.transactionReference} onChange={e => setRelease(s => ({ ...s, transactionReference: e.target.value }))} />
            <Input placeholder="Net released amount (₹)" value={release.netReleasedAmount} onChange={e => setRelease(s => ({ ...s, netReleasedAmount: e.target.value }))} />
            <textarea className={textareaBase} placeholder="Settlement remarks (optional)" value={release.remarks} onChange={e => setRelease(s => ({ ...s, remarks: e.target.value }))} />
            <Button
              className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-[#0f766e] text-xs font-black uppercase tracking-wider text-white hover:from-emerald-700 hover:to-[#0d665f] shadow-xs"
              disabled={!release.transactionReference.trim() || releaseMut.isPending}
              onClick={() => {
                require2FA({
                  actionType: 'ESCROW_PAYMENT_RELEASE',
                  actionTitle: 'Authorize Escrow Payment Release',
                  orderId: delivery.purchaseOrderId || delivery.id,
                  amount: release.netReleasedAmount ? Number(release.netReleasedAmount) : undefined,
                  onSuccess: async () => {
                    await runWithToast(
                      () =>
                        releaseMut.mutateAsync({
                          transactionReference: release.transactionReference,
                          netReleasedAmount: release.netReleasedAmount ? Number(release.netReleasedAmount) : undefined,
                          remarks: release.remarks || undefined,
                          twoFactorVerified: true
                        }),
                      { loading: 'Releasing payment...', success: 'Payment released (2FA Verified)', error: 'Release failed' }
                    );
                  }
                });
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Authorize Release & Close (2FA)
            </Button>
          </div>
        )}

        {/* Settlement Status Snapshot */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs">
          <p className={fieldLabel}>Escrow Ledger Snapshot</p>
          <p className="mt-1 text-slate-800 font-black">Settlement State: {delivery.settlement?.status || 'PENDING'}</p>
          {delivery.settlement?.transactionReference && (
            <p className="text-[11px] text-slate-600 font-mono font-bold mt-0.5">
              Ref: {delivery.settlement.transactionReference}
            </p>
          )}
        </div>
      </div>
      <Transaction2FAModal {...modalProps} />
    </CollapsibleSection>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500 font-semibold">{label}</span>
      <span className="font-black text-slate-900">{value}</span>
    </div>
  );
}

function AdminActions({ delivery }: { delivery: DeliveryDetailDto }) {
  const [override, setOverride] = useState({ status: delivery.status, reason: '', location: '' });
  const overrideMut = useAdminOverride(delivery.id);
  return (
    <CollapsibleSection
      title="Admin System Override"
      icon={ShieldAlert}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <Select value={override.status} onChange={e => setOverride(s => ({ ...s, status: e.target.value as DeliveryStatus }))}>
          {ALL_STATUSES.map(status => (
            <option key={status} value={status}>{DELIVERY_STATUS_LABELS[status]}</option>
          ))}
        </Select>
        <Input placeholder="Location (optional)" value={override.location} onChange={e => setOverride(s => ({ ...s, location: e.target.value }))} />
        <textarea className={textareaBase} placeholder="Override reason (mandatory for audit log)..." value={override.reason} onChange={e => setOverride(s => ({ ...s, reason: e.target.value }))} />
        <Button
          variant="outline"
          className="w-full h-10 rounded-xl border-amber-300 bg-amber-50 text-xs font-black uppercase tracking-wider text-amber-800 hover:bg-amber-100"
          disabled={!override.reason.trim() || overrideMut.isPending}
          onClick={() =>
            runWithToast(() => overrideMut.mutateAsync(override), {
              loading: 'Applying administrative override...',
              success: 'Status successfully overridden!',
              error: 'Override failed'
            })
          }
        >
          {overrideMut.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4 text-amber-600" />}
          Execute Admin Override
        </Button>
      </div>
    </CollapsibleSection>
  );
}

function DisputeActions({ delivery, accessRole }: { delivery: DeliveryDetailDto; accessRole: string }) {
  const [category, setCategory] = useState('Damaged Goods');
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('');

  const raiseMut = useRaiseDispute(delivery.id);
  const resolveMut = useResolveDispute(delivery.id);

  const canRaise = ['buyer', 'seller', 'consignee'].includes(accessRole) && delivery.status !== 'DISPUTE_RAISED' && delivery.status !== 'CLOSED';
  const canResolve = accessRole === 'admin' && delivery.status === 'DISPUTE_RAISED';

  if (!canRaise && !canResolve) return null;

  return (
    <CollapsibleSection title="Dispute Escalation" icon={AlertTriangle} defaultOpen={false}>
      <div className="space-y-3">
        {canRaise && (
          <div className="space-y-2.5">
            <Select
              value={['Damaged Goods', 'Wrong Item', 'Missing Quantity', 'Delayed Payment'].includes(category) ? category : 'Other'}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="Damaged Goods">Damaged Goods</option>
              <option value="Wrong Item">Wrong Item</option>
              <option value="Missing Quantity">Missing Quantity</option>
              <option value="Delayed Payment">Delayed Payment</option>
              <option value="Other">Other Reason</option>
            </Select>
            {!['Damaged Goods', 'Wrong Item', 'Missing Quantity', 'Delayed Payment'].includes(category) && (
              <Input
                required
                value={category === 'Other' ? '' : category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Specify Dispute Category"
              />
            )}
            <textarea className={textareaBase} placeholder="Describe the dispute issue in detail..." value={reason} onChange={e => setReason(e.target.value)} />
            <Button
              variant="outline"
              className="w-full h-10 rounded-xl border-rose-300 bg-rose-50 text-xs font-black uppercase tracking-wider text-rose-800 hover:bg-rose-100"
              disabled={!reason.trim() || raiseMut.isPending}
              onClick={() =>
                runWithToast(() => raiseMut.mutateAsync({ category, reason }), {
                  loading: 'Escalating dispute...',
                  success: 'Dispute submitted for review',
                  error: 'Failed to submit dispute'
                })
              }
            >
              {raiseMut.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4 text-rose-600" />}
              Escalate Dispute
            </Button>
          </div>
        )}

        {canResolve && (
          <div className="space-y-2.5">
            <textarea className={textareaBase} placeholder="Official resolution findings and decision..." value={resolution} onChange={e => setResolution(e.target.value)} />
            <Button
              className="w-full h-10 rounded-xl bg-emerald-600 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 shadow-xs"
              disabled={!resolution.trim() || resolveMut.isPending}
              onClick={() =>
                runWithToast(() => resolveMut.mutateAsync({ resolutionRemarks: resolution }), {
                  loading: 'Resolving dispute...',
                  success: 'Dispute resolved successfully',
                  error: 'Failed to resolve'
                })
              }
            >
              {resolveMut.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Mark Dispute Resolved
            </Button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

/* ================== Document upload with drag-drop + progress ================== */

function DocumentUploadForm({ deliveryId }: { deliveryId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DeliveryDocumentType>('OTHER');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const addDocMut = useAddDeliveryDocument(deliveryId);

  const submit = useCallback(async () => {
    if (!file) return;
    setProgress(0);
    const id = notify.loading(`Uploading ${file.name}...`);
    try {
      const asset = await uploadDeliveryFile(file, {
        onProgress: pct => setProgress(pct)
      });
      await addDocMut.mutateAsync({ documentType: docType, fileAssetId: asset.id, description: description || undefined });
      notify.success('Document attached successfully', { description: file.name });
      setFile(null);
      setDescription('');
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      notify.dismiss(id);
      setProgress(null);
    }
  }, [file, docType, description, addDocMut]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={cn(
        'space-y-2.5 rounded-xl border border-dashed p-3.5 transition-colors',
        isDragging ? 'border-[#0f766e] bg-[#0f766e]/5' : 'border-slate-200/80 bg-slate-50/50'
      )}
    >
      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
        <Upload className="h-4 w-4 text-[#0f766e]" />
        <span>Drag a file here or browse</span>
      </div>
      <Select value={docType} onChange={e => setDocType(e.target.value as DeliveryDocumentType)}>
        {(['DELIVERY_CHALLAN', 'PACKING_SLIP', 'COURIER_RECEIPT', 'EWAY_BILL', 'PROOF_OF_DISPATCH', 'PROOF_OF_DELIVERY', 'INSPECTION_REPORT', 'REJECTION_REPORT', 'RETURN_DOCUMENT', 'TAX_INVOICE', 'PAYMENT_PROOF', 'OTHER'] as DeliveryDocumentType[]).map(t => (
          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
        ))}
      </Select>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0f766e]/10 file:text-[#0f766e] hover:file:bg-[#0f766e]/20" />
      {file && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold">
          <span className="truncate">{file.name}</span>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setFile(null)} aria-label="Remove">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <Input placeholder="Description or reference notes (optional)" value={description} onChange={e => setDescription(e.target.value)} />
      {progress !== null && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="dt-shimmer-bar h-full bg-gradient-to-r from-[#0f766e] to-sky-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] font-bold text-slate-500">{progress}% Uploaded</p>
        </div>
      )}
      <Button
        variant="outline"
        className="w-full h-10 rounded-xl text-xs font-black uppercase tracking-wider text-[#0f766e] border-teal-200 hover:bg-teal-50"
        disabled={!file || progress !== null || addDocMut.isPending}
        onClick={() => void submit()}
      >
        <ClipboardList className="mr-2 h-4 w-4" />
        {progress !== null ? 'Uploading...' : 'Attach Document to Delivery'}
      </Button>
    </div>
  );
}

/* ================== New UI Helper Components ================== */

function SlaBadge({ slaStatus }: { slaStatus?: string | null }) {
  if (slaStatus === 'BREACHED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
        <ShieldAlert className="h-3 w-3" /> SLA Overdue
      </span>
    );
  }
  if (slaStatus === 'IMPENDING_BREACH') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-ping" />
        <Clock className="h-3 w-3" /> Due &lt;48h
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> SLA On-Time
    </span>
  );
}

function LiquidatedDamagesCard({ deliveryId }: { deliveryId: number }) {
  const ldQuery = useLdCalculation(deliveryId);
  const ld = ldQuery.data;

  if (!ld || (ld.delayDays === 0 && !ld.isWaived)) return null;

  return (
    <CollapsibleSection title="Liquidated Damages (LD)" icon={DollarSign} defaultOpen>
      <div className="space-y-3 dt-fade-in-up">
        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs">
          <div>
            <p className={fieldLabel}>Delivery Delay</p>
            <p className="text-xs font-black text-slate-900">{ld.delayDays} Days Overdue</p>
          </div>
          <div>
            <p className={fieldLabel}>Applicable Rate</p>
            <p className="text-xs font-bold text-slate-700">0.5% / week</p>
          </div>
          <div>
            <p className={fieldLabel}>Calculated LD</p>
            <p className={cn("text-xs font-black", ld.isWaived ? "text-emerald-600 line-through" : "text-rose-600")}>
              {formatCurrency(ld.calculatedLdAmount)}
            </p>
          </div>
        </div>
        {ld.isWaived && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>LD penalty is waived due to an approved DP Extension.</span>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function DpExtensionSection({ delivery, accessRole }: { delivery: DeliveryDetailDto; accessRole: string | null }) {
  const extensions = delivery.dpExtensions || [];
  const requestMut = useRequestDpExtension(delivery.id);
  const respondMut = useRespondDpExtension(delivery.id);

  const [openRequest, setOpenRequest] = useState(false);
  const [reqDate, setReqDate] = useState('');
  const [reqReason, setReqReason] = useState('');

  const [waiveLd, setWaiveLd] = useState(true);
  const [respRemarks, setRespRemarks] = useState('');

  const pendingExt = extensions.find(e => e.status === 'PENDING');

  const submitRequest = () => {
    if (!reqDate || !reqReason.trim()) return;
    runWithToast(
      () => requestMut.mutateAsync({ requestedDeliveryDate: reqDate, reason: reqReason.trim() }),
      { loading: 'Submitting extension request...', success: 'DP Extension requested', error: 'Failed to request extension' }
    ).then(() => {
      setOpenRequest(false);
      setReqReason('');
    });
  };

  const submitResponse = (approved: boolean) => {
    if (!pendingExt) return;
    runWithToast(
      () => respondMut.mutateAsync({ extId: pendingExt.id, body: { approved, waiveLd, remarks: respRemarks } }),
      { loading: 'Submitting response...', success: approved ? 'Extension approved' : 'Extension rejected', error: 'Failed to respond' }
    );
  };

  return (
    <CollapsibleSection title="DP Extension Requests" icon={Calendar} defaultOpen>
      <div className="space-y-3">
        {extensions.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500">No extension requests submitted.</p>
        ) : (
          <div className="space-y-2">
            {extensions.map(ext => (
              <div key={ext.id} className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 space-y-1.5 text-xs dt-fade-in-up">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900">
                    Target: {formatDate(ext.requestedDeliveryDate)}
                  </span>
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
                    ext.status === 'APPROVED' && 'bg-emerald-100 text-emerald-800 border border-emerald-200',
                    ext.status === 'REJECTED' && 'bg-rose-100 text-rose-800 border border-rose-200',
                    ext.status === 'PENDING' && 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                  )}>
                    {ext.status}
                  </span>
                </div>
                <p className="text-slate-600 font-medium">Reason: {ext.reason}</p>
                {ext.respondedBy && (
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Decision by {ext.respondedBy.name || 'User'} {ext.waiveLd && '• LD Waived'} {ext.responseRemarks && `• ${ext.responseRemarks}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Seller Action: Request DP Extension */}
        {accessRole === 'seller' && delivery.status !== 'CLOSED' && delivery.status !== 'CANCELLED' && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            {!openRequest ? (
              <Button variant="outline" className="w-full h-10 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 border-slate-200 hover:bg-slate-50" onClick={() => setOpenRequest(true)}>
                <Calendar className="mr-2 h-4 w-4 text-[#0f766e]" /> Request DP Extension
              </Button>
            ) : (
              <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50/30 p-3 dt-fade-in-up">
                <p className={fieldLabel}>New Requested Delivery Date</p>
                <Input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} />
                <textarea
                  className={textareaBase}
                  placeholder="Provide reason for extension request..."
                  value={reqReason}
                  onChange={e => setReqReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs font-bold" onClick={() => setOpenRequest(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 h-9 rounded-lg bg-[#0f766e] text-xs font-bold text-white hover:bg-[#0d665f]" disabled={!reqDate || !reqReason.trim() || requestMut.isPending} onClick={submitRequest}>
                    Submit Request
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Buyer / Admin Action: Respond to pending request */}
        {(accessRole === 'buyer' || accessRole === 'admin') && pendingExt && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dt-fade-in-up">
            <p className="text-xs font-black text-amber-900">Pending DP Extension Request</p>
            <p className="text-xs text-amber-800 font-semibold">
              Seller requested extension to {formatDate(pendingExt.requestedDeliveryDate)}: "{pendingExt.reason}"
            </p>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="waiveLd"
                checked={waiveLd}
                onChange={e => setWaiveLd(e.target.checked)}
                className="rounded text-[#0f766e] focus:ring-[#0f766e]"
              />
              <label htmlFor="waiveLd" className="text-xs font-bold text-slate-800">
                Waive Liquidated Damages (LD) penalty for extended period
              </label>
            </div>
            <Input placeholder="Response remarks (optional)" value={respRemarks} onChange={e => setRespRemarks(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs font-bold text-rose-700 border-rose-200 hover:bg-rose-50" onClick={() => submitResponse(false)} disabled={respondMut.isPending}>
                Reject
              </Button>
              <Button className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white" onClick={() => submitResponse(true)} disabled={respondMut.isPending}>
                Approve Extension
              </Button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function EmailOtpVerificationCard({ delivery, accessRole }: { delivery: DeliveryDetailDto; accessRole: string | null }) {
  const sendOtpMut = useSendDeliveryOtp(delivery.id);
  const verifyOtpMut = useVerifyDeliveryOtp(delivery.id);
  const [otp, setOtp] = useState('');

  const isVerified = Boolean(delivery.deliveryOtpVerifiedAt);
  const isSellerOrCourier = accessRole === 'seller' || accessRole === 'logistics' || accessRole === 'admin';
  const canVerifyRole = ['buyer', 'seller', 'consignee', 'logistics', 'admin'].includes(accessRole || '');

  const handleSend = () => {
    runWithToast(() => sendOtpMut.mutateAsync(undefined), {
      loading: 'Sending OTP to buyer...',
      success: '6-digit OTP emailed to buyer!',
      error: 'Failed to send OTP'
    });
  };

  const handleVerify = () => {
    if (!otp || otp.length !== 6) return;
    runWithToast(() => verifyOtpMut.mutateAsync({ otp }), {
      loading: 'Verifying OTP...',
      success: 'Delivery receipt verified successfully!',
      error: 'Invalid or expired OTP'
    });
  };

  if (!canVerifyRole && !isVerified) return null;

  return (
    <CollapsibleSection title="Handover OTP Verification" icon={Key} defaultOpen>
      <div className="space-y-3 dt-fade-in-up">
        {isVerified ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Physical Handover Verified</p>
              <p className="text-[11px] font-semibold text-emerald-700">
                Receipt confirmed on {formatDate(delivery.deliveryOtpVerifiedAt)}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isSellerOrCourier ? (
              <>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  Verify physical delivery handover: Click to email the 6-digit OTP to the buyer, then enter the OTP upon handover.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl text-xs font-black uppercase tracking-wider border-slate-200 hover:bg-slate-50"
                    onClick={handleSend}
                    disabled={sendOtpMut.isPending}
                  >
                    {sendOtpMut.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="mr-2 h-4 w-4 text-[#0f766e]" />
                    )}
                    Send OTP to Buyer
                  </Button>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="6-digit OTP"
                    value={otp}
                    maxLength={6}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="font-mono text-center tracking-widest text-base font-bold rounded-xl"
                  />
                  <Button
                    className="h-10 rounded-xl bg-[#0f766e] text-xs font-black uppercase tracking-wider text-white shrink-0 px-4 hover:bg-[#0d665f] shadow-xs"
                    disabled={otp.length !== 6 || verifyOtpMut.isPending}
                    onClick={handleVerify}
                  >
                    Verify Handover
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3.5 space-y-1 text-xs text-slate-700">
                  <p className="font-bold text-[#0f766e] flex items-center gap-1.5">
                    <Key className="h-4 w-4" /> Handover Instructions
                  </p>
                  <p className="text-slate-600 font-semibold leading-relaxed">
                    A 6-digit OTP is emailed when delivery is initiated. Share this OTP with the delivery agent upon receiving goods.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl text-xs font-black uppercase tracking-wider border-slate-200 hover:bg-slate-50"
                    onClick={handleSend}
                    disabled={sendOtpMut.isPending}
                  >
                    {sendOtpMut.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="mr-2 h-4 w-4 text-[#0f766e]" />
                    )}
                    Resend OTP to My Email
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

export default DeliveryDetailPage;
