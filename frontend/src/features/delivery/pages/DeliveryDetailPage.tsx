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
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  Key,
  Package,
  RefreshCw,
  ShieldAlert,
  Star,
  Truck,
  Upload,
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
import { DELIVERY_STATUS_LABELS } from '../status';
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

const fieldLabel = 'text-[10px] font-black uppercase tracking-widest text-slate-500';
const sectionHeader = 'text-[11px] font-black uppercase tracking-widest text-[#0f766e]';
const inputBase = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]/25';
const textareaBase = `${inputBase} h-24 py-2`;

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
 * Collapsible section wrapper used across the delivery detail page. Renders a
 * clickable header (with optional icon + meta) that expands/collapses the body.
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
    <Card className={cn('overflow-hidden rounded-2xl border-slate-200/80 bg-white/92 shadow-sm', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2.5 sm:gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-[#0f766e]" />}
          <span className={sectionHeader}>{title}</span>
        </span>
        <span className="flex items-center gap-2">
          {meta}
          <ChevronDown
            className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
          />
        </span>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2.5 sm:gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#12335f]/5 text-[#12335f] ring-1 ring-slate-200/50 sm:flex">
              <Package className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                <span className="rounded-md bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#12335f] ring-1 ring-slate-200/60">
                  Delivery Tracking
                </span>
                <DeliveryStatusBadge status={delivery.status} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 break-words sm:text-3xl">
                {po?.title || po?.poNumber || `Delivery #${delivery.id}`}
              </h1>
              <p className="mt-1 max-w-2xl text-xs font-semibold text-slate-500">
                {po?.poNumber || `PO-${delivery.purchaseOrderId}`} · {po?.seller?.name || 'Seller'} → {po?.buyer?.name || 'Buyer'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 md:mt-0 md:self-end">
            <Button
              variant="outline"
              onClick={onClose || (() => window.history.back())}
              className="h-10 rounded-lg border-slate-200 bg-white px-4 text-xs font-black uppercase text-[#12335f] hover:bg-slate-50"
            >
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => detailQuery.refetch()}
              className="h-10 rounded-lg border-[#12335f] bg-[#12335f] px-4 text-xs font-black uppercase text-white hover:bg-[#0b1f3b]"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} /> Refresh
            </Button>
          </div>
        </div>
      </div>
      <CollapsibleSection title="Delivery Overview" icon={Package} defaultOpen>
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Status">
            <DeliveryStatusBadge status={delivery.status} />
          </Info>
          <Info label="SLA Health">
            <span className="font-bold">{delivery.slaStatus || 'ON_TIME'}</span>
          </Info>
          <Info label="Tracking #" value={delivery.trackingNumber || `DLV-${delivery.id}`} />
          <Info label="Carrier" value={delivery.carrierName || delivery.logisticsPartnerName || 'Pending'} />
          <Info label="Expected" value={formatDate(delivery.expectedDelivery || po?.expectedDelivery)} />
          <Info label="Next Update" value={nextManualStatus ? DELIVERY_STATUS_LABELS[nextManualStatus] : 'Complete'} />
          <Info label="Current Location" value={delivery.currentLocation || 'Pending'} />
          <Info label="Address" value={po?.deliveryAddress || 'Address not set'} />
          <Info label="PO Value" value={formatCurrency(po?.amount || po?.totalValue)} />
          <Info label="Settlement" value={delivery.settlement?.status || 'PENDING'} />
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

      <div className={cn('grid grid-cols-1 gap-5', isSellerTrackingView ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <SectionHeading icon={Truck} title="Tracking Timeline" meta={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Read Only</span>} />
            <DeliveryTimeline status={delivery.status} events={delivery.events} statusLogs={delivery.statusLogs} />
          </section>

          {!isSellerTrackingView && (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                <DpExtensionSection delivery={delivery} accessRole={accessRole} />
                <LiquidatedDamagesCard deliveryId={delivery.id} />
              </div>

              <DocumentsPanel docs={docs} deliveryId={delivery.id} accessRole={accessRole} />
            </>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          {accessRole === 'seller' ? (
            <ManualTrackingActions delivery={delivery} latestManual={latestManual} />
          ) : (
            <EmailOtpVerificationCard delivery={delivery} accessRole={accessRole} />
          )}
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

function Info({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className={fieldLabel}>{label}</p>
      <div className="mt-1 break-words text-xs font-black text-slate-900">{children ?? value ?? '—'}</div>
    </div>
  );
}

function ShipmentMetric({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value || '-'}</p>
    </div>
  );
}

function ManualFact({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 bg-white p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#0f766e]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-1 break-words text-xs font-black text-slate-950">{value || '-'}</p>
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
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f766e]/10 text-[#0f766e]">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-950">{title}</h2>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <SectionHeading
        icon={FileText}
        title="Documents"
        meta={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{records.length} files</span>}
      />
      <div className="space-y-3">
        {records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs font-semibold text-slate-500">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {records.map(doc => (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#0f766e] ring-1 ring-slate-200">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black uppercase tracking-wide text-slate-800">{doc.documentType.replace(/_/g, ' ')}</p>
                    <p className="truncate text-[10px] font-semibold text-slate-500">{doc.fileAsset?.originalName || `File #${doc.fileAsset?.id}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{doc.uploaderRole}</span>
                  {doc.fileAsset?.id && (
                    <a
                      href={`/api/files/${doc.fileAsset.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#0f766e] hover:bg-slate-50"
                    >
                      Open
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
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex flex-col gap-2.5 sm:gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Star className="h-4 w-4 fill-current" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                {hasRated ? 'You rated this transaction' : 'Rate this transaction'}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {hasRated
                  ? `Your rating: ${existing?.rating}/5 - feel free to update it.`
                  : `Help others by sharing your experience with ${counterpartyName || 'the counterparty'}.`}
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-amber-600 text-white hover:bg-amber-700">
            {hasRated ? 'Edit rating' : 'Rate now'}
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
        loading: 'Updating status...',
        success: `Status updated to ${DELIVERY_STATUS_LABELS[nextStatus]}`,
        error: (err: any) => err?.message || 'Status update failed'
      }
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <SectionHeading
        icon={Truck}
        title="Manual Update"
        meta={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seller Controlled</span>}
      />
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-sky-100 bg-sky-100">
          <div className="bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4 text-slate-950">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0f766e]">Current Movement</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black leading-tight">{DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}</h3>
              <DeliveryStatusBadge status={delivery.status} />
            </div>
          </div>
          <div className="grid gap-px bg-slate-200">
            <ManualFact icon={ClipboardList} label="Tracking Number" value={delivery.trackingNumber || `DLV-${delivery.id}`} />
            <ManualFact icon={Truck} label="Carrier" value={delivery.carrierName || delivery.logisticsPartnerName || 'Pending'} />
            <ManualFact icon={Calendar} label="Expected Delivery" value={formatDate(delivery.expectedDelivery || delivery.purchaseOrder?.expectedDelivery)} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
          <p className={fieldLabel}>Seller's Latest Manual Update</p>
          {latest ? (
            <div className="mt-2 space-y-1">
              <DeliveryStatusBadge status={latest.newStatus} />
              <p className="text-[10px] font-semibold text-slate-500">
                {[latest.remarks, formatDate(latest.createdAt)].filter(Boolean).join(' - ')}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs font-bold text-slate-500">No manual update yet</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 bg-white px-3 py-3">
          <p className={fieldLabel}>Next Status</p>
          <div className="mt-2">
            {nextStatus ? (
              <DeliveryStatusBadge status={nextStatus} />
            ) : (
              <DeliveryStatusBadge status={delivery.status} />
            )}
          </div>
        </div>

        <Button
          className="w-full h-10 rounded-lg bg-[#0f766e] text-xs font-black uppercase text-white hover:bg-[#0d665f] disabled:bg-slate-300 disabled:text-slate-500"
          disabled={!nextStatus || updateMut.isPending}
          onClick={updateStatus}
        >
          {updateMut.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : nextStatus ? (
            <ChevronRight className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Update Status
        </Button>
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
        loading: 'Submitting decision...',
        success: accept ? 'Delivery accepted' : 'Delivery rejected',
        error: 'Failed to submit decision'
      }
    );

  const submitReturn = () =>
    runWithToast(
      () => returnMut.mutateAsync({ type: returnType, reason: returnReason }),
      { loading: 'Initiating return...', success: 'Return initiated', error: 'Action failed' }
    );

  return (
    <CollapsibleSection title="Receipt & Acceptance" icon={CheckCircle2} defaultOpen>
      <div className="space-y-4">
        {!canAcceptStage && (
          <p className="text-xs font-semibold text-slate-500">
            Acceptance becomes available once the delivery is marked as delivered.
          </p>
        )}
        {canAcceptStage && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant={accept ? 'primary' : 'outline'} className="flex-1 h-10 rounded-lg text-xs font-black uppercase" onClick={() => setAccept(true)}>
                Accept
              </Button>
              <Button variant={!accept ? 'primary' : 'outline'} className="flex-1 h-10 rounded-lg text-xs font-black uppercase" onClick={() => setAccept(false)}>
                Reject
              </Button>
            </div>
            {!accept && (
              <>
                <textarea className={textareaBase} placeholder="Rejection reason (required)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                <textarea className={textareaBase} placeholder="Damage / wrong item notes (optional)" value={damageNotes} onChange={e => setDamageNotes(e.target.value)} />
                <Input placeholder="Missing quantity" value={missingQty} onChange={e => setMissingQty(e.target.value)} />
              </>
            )}
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
              disabled={(!accept && !rejectReason.trim()) || acceptanceMut.isPending}
              onClick={submitDecision}
            >
              Submit Decision
            </Button>
          </div>
        )}

        {canReturnStage && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className={fieldLabel}>Return / Replacement</p>
            <Select value={returnType} onChange={e => setReturnType(e.target.value as any)}>
              <option value="RETURN">Return</option>
              <option value="REPLACEMENT">Replacement</option>
              <option value="REFUND">Refund</option>
            </Select>
            <textarea className={textareaBase} placeholder="Reason" value={returnReason} onChange={e => setReturnReason(e.target.value)} />
            <Button
              variant="outline"
              className="w-full h-10 rounded-lg text-xs font-black uppercase"
              disabled={!returnReason.trim() || returnMut.isPending}
              onClick={submitReturn}
            >
              Initiate
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
    <CollapsibleSection title="Finance / Payment" icon={Wallet} defaultOpen>
      <div className="space-y-4">

        {delivery.status === 'ACCEPTED' && (
          <div className="space-y-2">
            <p className={fieldLabel}>Verify invoice</p>
            {invoices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-700">
                No invoices submitted yet. The seller must raise an invoice for this PO before payment can be released.
              </div>
            ) : (
              <>
                <Select value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {(inv.invoiceNumber || `Invoice #${inv.id}`)}
                      {inv.amount ? ` · ${formatCurrency(inv.amount)}` : ''}
                      {inv.invoiceStatus || inv.status ? ` · ${(inv.invoiceStatus || inv.status || '').toString().toUpperCase()}` : ''}
                    </option>
                  ))}
                </Select>
                {selectedInvoice && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] font-semibold text-slate-600 space-y-1">
                    <Row label="Number" value={selectedInvoice.invoiceNumber || `#${selectedInvoice.id}`} />
                    {selectedInvoice.amount !== undefined && (
                      <Row label="Amount" value={formatCurrency(selectedInvoice.amount)} />
                    )}
                    <Row
                      label="Status"
                      value={(selectedInvoice.invoiceStatus || selectedInvoice.status || 'submitted').toString().toUpperCase()}
                    />
                    {selectedInvoice.invoiceFile?.id && (
                      <a
                        href={`/api/files/${selectedInvoice.invoiceFile.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#0f766e] hover:underline"
                      >
                        <FileText className="h-3 w-3" /> Preview invoice
                      </a>
                    )}
                  </div>
                )}
                <Button
                  className="w-full h-10 rounded-lg bg-[#0f766e] text-xs font-black uppercase text-white hover:bg-[#0d665f]"
                  disabled={!invoiceId || verifyMut.isPending}
                  onClick={() =>
                    runWithToast(() => verifyMut.mutateAsync({ invoiceId: Number(invoiceId) }), {
                      loading: 'Verifying invoice...',
                      success: 'Invoice verified',
                      error: 'Verification failed'
                    })
                  }
                >
                  Mark Invoice Verified
                </Button>
              </>
            )}
          </div>
        )}

        {delivery.status === 'INVOICE_VERIFIED' && (
          <div className="space-y-2">
            <p className={fieldLabel}>Approve / Reject Payment</p>
            <Select value={decision.approve ? 'approve' : 'reject'} onChange={e => setDecision(s => ({ ...s, approve: e.target.value === 'approve' }))}>
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
            </Select>
            <Input placeholder="Deduction amount" value={decision.deductionAmount} onChange={e => setDecision(s => ({ ...s, deductionAmount: e.target.value }))} />
            <Input placeholder="Penalty amount" value={decision.penaltyAmount} onChange={e => setDecision(s => ({ ...s, penaltyAmount: e.target.value }))} />
            {!decision.approve && (
              <textarea className={textareaBase} placeholder="Rejection reason" value={decision.rejectionReason} onChange={e => setDecision(s => ({ ...s, rejectionReason: e.target.value }))} />
            )}
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
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
              Submit Decision
            </Button>
          </div>
        )}

        {delivery.status === 'PAYMENT_APPROVED' && (
          <div className="space-y-2">
            <p className={fieldLabel}>Release payment</p>
            <Input placeholder="Transaction reference" value={release.transactionReference} onChange={e => setRelease(s => ({ ...s, transactionReference: e.target.value }))} />
            <Input placeholder="Net released amount" value={release.netReleasedAmount} onChange={e => setRelease(s => ({ ...s, netReleasedAmount: e.target.value }))} />
            <textarea className={textareaBase} placeholder="Remarks" value={release.remarks} onChange={e => setRelease(s => ({ ...s, remarks: e.target.value }))} />
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
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
              Release &amp; Close (2FA)
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
          <p className={fieldLabel}>Settlement Snapshot</p>
          <p className="mt-1 text-slate-700 font-bold">Status: {delivery.settlement?.status || 'PENDING'}</p>
          {delivery.settlement?.transactionReference && (
            <p className="text-[10px] text-slate-500 font-semibold">
              Reference: {delivery.settlement.transactionReference}
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
      <span className="text-slate-500">{label}</span>
      <span className="font-black text-slate-900">{value}</span>
    </div>
  );
}

function AdminActions({ delivery }: { delivery: DeliveryDetailDto }) {
  const [override, setOverride] = useState({ status: delivery.status, reason: '', location: '' });
  const overrideMut = useAdminOverride(delivery.id);
  return (
    <CollapsibleSection
      title="Admin Override"
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
        <textarea className={textareaBase} placeholder="Reason (required)" value={override.reason} onChange={e => setOverride(s => ({ ...s, reason: e.target.value }))} />
        <Button
          variant="outline"
          className="w-full h-10 rounded-lg border-amber-200 bg-amber-50 text-xs font-black uppercase text-amber-700"
          disabled={!override.reason.trim() || overrideMut.isPending}
          onClick={() =>
            runWithToast(() => overrideMut.mutateAsync(override), {
              loading: 'Applying override...',
              success: 'Status overridden',
              error: 'Override failed'
            })
          }
        >
          Apply Override
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
    <CollapsibleSection title="Dispute" icon={AlertTriangle} defaultOpen={false}>
      <div className="space-y-3">
        {canRaise && (
          <div className="space-y-2">
            <Select
              value={['Damaged Goods', 'Wrong Item', 'Missing Quantity', 'Delayed Payment'].includes(category) ? category : 'Other'}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="Damaged Goods">Damaged Goods</option>
              <option value="Wrong Item">Wrong Item</option>
              <option value="Missing Quantity">Missing Quantity</option>
              <option value="Delayed Payment">Delayed Payment</option>
              <option value="Other">Other</option>
            </Select>
            {!['Damaged Goods', 'Wrong Item', 'Missing Quantity', 'Delayed Payment'].includes(category) && (
              <Input
                required
                value={category === 'Other' ? '' : category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Specify Custom Category"
              />
            )}
            <textarea className={textareaBase} placeholder="Describe the issue" value={reason} onChange={e => setReason(e.target.value)} />
            <Button
              variant="outline"
              className="w-full h-10 rounded-lg border-red-200 text-xs font-black uppercase text-red-700"
              disabled={!reason.trim() || raiseMut.isPending}
              onClick={() =>
                runWithToast(() => raiseMut.mutateAsync({ category, reason }), {
                  loading: 'Raising dispute...',
                  success: 'Dispute raised',
                  error: 'Failed to raise dispute'
                })
              }
            >
              Raise Dispute
            </Button>
          </div>
        )}
        {canResolve && (
          <div className="space-y-2">
            <textarea className={textareaBase} placeholder="Resolution remarks" value={resolution} onChange={e => setResolution(e.target.value)} />
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
              disabled={!resolution.trim() || resolveMut.isPending}
              onClick={() =>
                runWithToast(() => resolveMut.mutateAsync({ resolutionRemarks: resolution }), {
                  loading: 'Resolving dispute...',
                  success: 'Dispute resolved',
                  error: 'Failed to resolve'
                })
              }
            >
              Resolve Dispute
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
      notify.success('Document attached', { description: file.name });
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
        'space-y-2 rounded-lg border border-dashed p-3 transition-colors',
        isDragging ? 'border-[#0f766e] bg-[#0f766e]/5' : 'border-slate-200'
      )}
    >
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <Upload className="h-4 w-4 text-[#0f766e]" />
        <span>Drag a file here, or pick one below</span>
      </div>
      <Select value={docType} onChange={e => setDocType(e.target.value as DeliveryDocumentType)}>
        {(['DELIVERY_CHALLAN', 'PACKING_SLIP', 'COURIER_RECEIPT', 'EWAY_BILL', 'PROOF_OF_DISPATCH', 'PROOF_OF_DELIVERY', 'INSPECTION_REPORT', 'REJECTION_REPORT', 'RETURN_DOCUMENT', 'TAX_INVOICE', 'PAYMENT_PROOF', 'OTHER'] as DeliveryDocumentType[]).map(t => (
          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
        ))}
      </Select>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs" />
      {file && (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold">
          <span className="truncate">{file.name}</span>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setFile(null)} aria-label="Remove">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
      {progress !== null && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#0f766e] to-sky-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] font-bold text-slate-500">{progress}%</p>
        </div>
      )}
      <Button
        variant="outline"
        className="w-full h-10 rounded-lg text-xs font-black uppercase"
        disabled={!file || progress !== null || addDocMut.isPending}
        onClick={() => void submit()}
      >
        <ClipboardList className="mr-2 h-4 w-4" />
        {progress !== null ? 'Uploading...' : 'Attach to delivery'}
      </Button>
    </div>
  );
}

/* ================== New UI Helper Components ================== */

function SlaBadge({ slaStatus }: { slaStatus?: string | null }) {
  if (slaStatus === 'BREACHED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-700 animate-pulse">
        <ShieldAlert className="h-3.5 w-3.5" /> SLA Overdue
      </span>
    );
  }
  if (slaStatus === 'IMPENDING_BREACH') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 animate-pulse">
        <Clock className="h-3.5 w-3.5" /> Due within 48h
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" /> SLA On-Time
    </span>
  );
}

function LiquidatedDamagesCard({ deliveryId }: { deliveryId: number }) {
  const ldQuery = useLdCalculation(deliveryId);
  const ld = ldQuery.data;

  if (!ld || (ld.delayDays === 0 && !ld.isWaived)) return null;

  return (
    <CollapsibleSection title="Liquidated Damages (LD) Penalty" icon={DollarSign} defaultOpen>
      <div className="space-y-3 dt-fade-in-up">
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div>
            <p className={fieldLabel}>Delivery Delay</p>
            <p className="text-xs font-black text-slate-900">{ld.delayDays} Days Overdue</p>
          </div>
          <div>
            <p className={fieldLabel}>Applicable LD Rate</p>
            <p className="text-xs font-bold text-slate-700">0.5% / week (Cap 10%)</p>
          </div>
          <div>
            <p className={fieldLabel}>Calculated LD</p>
            <p className={cn("text-xs font-black", ld.isWaived ? "text-emerald-600 line-through" : "text-red-600")}>
              {formatCurrency(ld.calculatedLdAmount)}
            </p>
          </div>
        </div>
        {ld.isWaived && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>LD penalty is waived due to an approved Delivery Period (DP) Extension.</span>
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
    <CollapsibleSection title="Delivery Period (DP) Extensions" icon={Calendar} defaultOpen>
      <div className="space-y-4">
        {extensions.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500">No extension requests submitted.</p>
        ) : (
          <div className="space-y-2">
            {extensions.map(ext => (
              <div key={ext.id} className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 space-y-1.5 text-xs dt-fade-in-up">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900">
                    Requested: {formatDate(ext.requestedDeliveryDate)}
                  </span>
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
                    ext.status === 'APPROVED' && 'bg-emerald-100 text-emerald-700',
                    ext.status === 'REJECTED' && 'bg-red-100 text-red-700',
                    ext.status === 'PENDING' && 'bg-amber-100 text-amber-700 animate-pulse'
                  )}>
                    {ext.status}
                  </span>
                </div>
                <p className="text-slate-600 font-medium">Reason: {ext.reason}</p>
                {ext.respondedBy && (
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Decision by {ext.respondedBy.name || 'User'} {ext.waiveLd && '· LD Waived'} {ext.responseRemarks && `· ${ext.responseRemarks}`}
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
              <Button variant="outline" className="w-full h-10 rounded-lg text-xs font-black uppercase" onClick={() => setOpenRequest(true)}>
                <Calendar className="mr-2 h-4 w-4" /> Request DP Extension
              </Button>
            ) : (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dt-fade-in-up">
                <p className={fieldLabel}>New Requested Delivery Date</p>
                <Input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} />
                <textarea
                  className={textareaBase}
                  placeholder="Provide reason for extension request..."
                  value={reqReason}
                  onChange={e => setReqReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 text-xs font-bold" onClick={() => setOpenRequest(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 h-9 bg-[#0f766e] text-xs font-bold text-white hover:bg-[#0d665f]" disabled={!reqDate || !reqReason.trim() || requestMut.isPending} onClick={submitRequest}>
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
            <p className="text-xs font-black text-amber-800">Pending DP Extension Request</p>
            <p className="text-xs text-amber-700 font-semibold">
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
              <Button variant="outline" className="flex-1 h-9 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50" onClick={() => submitResponse(false)} disabled={respondMut.isPending}>
                Reject Extension
              </Button>
              <Button className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white" onClick={() => submitResponse(true)} disabled={respondMut.isPending}>
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
  const canVerifyRole = accessRole === 'buyer' || accessRole === 'consignee' || accessRole === 'admin';

  const handleSend = () => {
    runWithToast(() => sendOtpMut.mutateAsync(undefined), {
      loading: 'Sending OTP to email...',
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
    <CollapsibleSection title="Email Delivery OTP Verification" icon={Key} defaultOpen>
      <div className="space-y-3 dt-fade-in-up">
        {isVerified ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Physical Receipt Verified</p>
              <p className="text-[11px] font-semibold text-emerald-700">
                Verified via 6-digit Email OTP on {formatDate(delivery.deliveryOtpVerifiedAt)}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600">
              Confirm physical receipt of goods by generating a 6-digit OTP sent to the buyer's registered email.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 text-xs font-black uppercase" onClick={handleSend} disabled={sendOtpMut.isPending}>
                {sendOtpMut.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />} Send OTP to Email
              </Button>
            </div>
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Enter 6-digit OTP"
                value={otp}
                maxLength={6}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                className="font-mono text-center tracking-widest text-base font-bold"
              />
              <Button
                className="h-10 bg-[#0f766e] text-xs font-black uppercase text-white shrink-0 px-4 hover:bg-[#0d665f]"
                disabled={otp.length !== 6 || verifyOtpMut.isPending}
                onClick={handleVerify}
              >
                Verify
              </Button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

export default DeliveryDetailPage;
