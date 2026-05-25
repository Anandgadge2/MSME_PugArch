/**
 * DeliveryDetailPage - role-aware single source of truth for one delivery.
 *
 * Renders timeline, documents, dispatch metadata, buyer acceptance, and finance
 * settlement. Action panels are shown only when the current actor has the
 * matching role on this delivery (owner, participant, or admin).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  RefreshCw,
  ShieldAlert,
  Truck,
  Upload
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input, Select } from '../../../components/ui/input';
import { useAuth } from '../../../hooks/useAuth';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDate } from '../../shared/format';
import { DeliveryStatusBadge } from '../components/DeliveryStatusBadge';
import { DeliveryTimeline } from '../components/DeliveryTimeline';
import { DELIVERY_STATUS_LABELS } from '../status';
import {
  buyerAcceptance,
  fetchDeliveryReport,
  getDeliveryById,
  initiateReturn,
  listLogisticsPartners,
  logisticsStatusUpdate,
  markDeliveryPacked,
  markDispatched,
  markReadyForPickup,
  paymentDecision,
  raiseDeliveryDispute,
  releaseDeliveryPayment,
  resolveDeliveryDispute,
  sellerAcceptDelivery,
  sellerRejectDelivery,
  updateDispatchDetails,
  verifyInvoice,
  adminOverrideStatus,
  addDeliveryDocument
} from '../api';
import type {
  DeliveryDetailDto,
  DeliveryDocumentType,
  DeliveryReportSummary,
  DeliveryStatus,
  LogisticsPartnerDto
} from '../types';
import { uploadDeliveryFile } from '../upload';

const ALL_STATUSES = Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[];

const fieldLabel = 'text-[10px] font-black uppercase tracking-widest text-slate-500';
const sectionHeader = 'text-[11px] font-black uppercase tracking-widest text-[#12335f]';
const inputBase = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#12335f]/30';
const textareaBase = `${inputBase} h-24 py-2`;

type ActionRunner = () => Promise<unknown>;

interface DeliveryDetailPageProps {
  deliveryId: number;
  onClose?: () => void;
}

export function DeliveryDetailPage({ deliveryId, onClose }: DeliveryDetailPageProps) {
  const { user } = useAuth();
  const [delivery, setDelivery] = useState<DeliveryDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [partners, setPartners] = useState<LogisticsPartnerDto[]>([]);
  const [adminSummary, setAdminSummary] = useState<DeliveryReportSummary | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDeliveryById(deliveryId);
      setDelivery(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load delivery');
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    listLogisticsPartners().then(setPartners).catch(() => setPartners([]));
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDeliveryReport().then(setAdminSummary).catch(() => setAdminSummary(null));
    }
  }, [user?.role]);

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

  // Clear the success banner automatically so it never lingers across actions.
  useEffect(() => {
    if (!actionMessage) return;
    const handle = setTimeout(() => setActionMessage(null), 3500);
    return () => clearTimeout(handle);
  }, [actionMessage]);

  // Same for the inline error - it should clear when the user moves on.
  useEffect(() => {
    if (!actionError) return;
    const handle = setTimeout(() => setActionError(null), 6000);
    return () => clearTimeout(handle);
  }, [actionError]);

  const runAction = useCallback(
    async (label: string, runner: ActionRunner) => {
      setActionError(null);
      setActionMessage(null);
      try {
        await runner();
        await reload();
        setActionMessage(`${label} completed`);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : `${label} failed`);
      }
    },
    [reload]
  );

  if (loading) return <LoadingState label="Loading delivery..." />;
  if (error) return <InlineError message={error} onRetry={reload} />;
  if (!delivery) return <EmptyState title="Delivery not found" />;

  const po = delivery.purchaseOrder;
  const docs = delivery.documents || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Delivery Tracking</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 break-words">
            {po?.title || po?.poNumber || `Delivery #${delivery.id}`}
          </h1>
          <p className="mt-1 max-w-2xl text-xs font-semibold text-slate-500">
            {po?.poNumber} · {po?.seller?.name || 'Seller'} → {po?.buyer?.name || 'Buyer'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose} className="h-10 rounded-lg text-xs font-black uppercase">
              Close
            </Button>
          )}
          <Button variant="outline" onClick={reload} className="h-10 rounded-lg text-xs font-black uppercase">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {actionError && <InlineError message={actionError} />}
      {actionMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-emerald-700">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          {actionMessage}
        </div>
      )}

      {/* Key facts */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
          <Info label="Status">
            <DeliveryStatusBadge status={delivery.status} />
          </Info>
          <Info label="Tracking #" value={delivery.trackingNumber || `DLV-${delivery.id}`} />
          <Info label="Carrier" value={delivery.carrierName || delivery.logisticsPartnerName || 'Pending'} />
          <Info label="Expected" value={formatDate(delivery.expectedDelivery || po?.expectedDelivery)} />
          <Info label="Current Location" value={delivery.currentLocation || 'Pending'} />
          <Info label="Address" value={po?.deliveryAddress || 'Address not set'} />
          <Info label="PO Value" value={formatCurrency(po?.amount || po?.totalValue)} />
          <Info label="Settlement" value={delivery.settlement?.status || 'PENDING'} />
        </CardContent>
      </Card>

      {accessRole === 'admin' && adminSummary && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            <Info label="Total Deliveries" value={String(adminSummary.total)} />
            <Info label="Delayed" value={String(adminSummary.delayed)} />
            <Info label="Disputed" value={String(adminSummary.disputed)} />
            <Info label="Pending Payment" value={String(adminSummary.paymentPendingAfterAcceptance)} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className={sectionHeader}>Tracking Timeline</h2>
              <DeliveryTimeline status={delivery.status} events={delivery.events} statusLogs={delivery.statusLogs} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className={sectionHeader}>Documents</h2>
                <span className="text-[10px] font-bold uppercase text-slate-400">{docs.length} files</span>
              </div>
              {docs.length === 0 ? (
                <p className="text-xs font-semibold text-slate-500">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-[#12335f] shrink-0" />
                        <div className="min-w-0">
                          <p className="font-black uppercase tracking-wide text-slate-700 truncate">{doc.documentType.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] font-semibold text-slate-500 truncate">{doc.fileAsset?.originalName || `File #${doc.fileAsset?.id}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{doc.uploaderRole}</span>
                        {doc.fileAsset?.id && (
                          <a
                            href={`/api/files/${doc.fileAsset.id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-black uppercase tracking-widest text-[#12335f] hover:underline"
                          >
                            Open
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {accessRole && accessRole !== 'dispute' && (
                <DocumentUploadForm
                  onUpload={async (documentType, fileAssetId, description) =>
                    runAction('Document upload', () => addDeliveryDocument(delivery.id, { documentType, fileAssetId, description }))
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {accessRole === 'seller' && (
            <SellerActions
              delivery={delivery}
              partners={partners}
              run={runAction}
            />
          )}
          {(accessRole === 'logistics' || accessRole === 'admin') && (
            <LogisticsActions delivery={delivery} run={runAction} />
          )}
          {(accessRole === 'buyer' || accessRole === 'consignee') && (
            <BuyerActions delivery={delivery} run={runAction} />
          )}
          {(accessRole === 'finance' || accessRole === 'admin') && (
            <FinanceActions delivery={delivery} run={runAction} />
          )}
          {accessRole === 'admin' && <AdminActions delivery={delivery} run={runAction} />}
          {accessRole && (
            <DisputeActions delivery={delivery} accessRole={accessRole} run={runAction} />
          )}
        </div>
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

/* ================== Role-specific action panels ================== */

function SellerActions({
  delivery,
  partners,
  run
}: {
  delivery: DeliveryDetailDto;
  partners: LogisticsPartnerDto[];
  run: (label: string, runner: ActionRunner) => Promise<unknown>;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [packForm, setPackForm] = useState({ packageWeightKg: '', packageDimensions: '', packageCount: '' });
  const [dispatchForm, setDispatchForm] = useState({
    trackingNumber: delivery.trackingNumber || '',
    carrierName: delivery.carrierName || '',
    logisticsPartnerId: delivery.logisticsPartnerId ? String(delivery.logisticsPartnerId) : '',
    ewayBillNumber: delivery.ewayBillNumber || '',
    courierReceiptNumber: delivery.courierReceiptNumber || '',
    expectedDelivery: delivery.expectedDelivery ? delivery.expectedDelivery.split('T')[0] : ''
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h2 className={sectionHeader}>Seller Actions</h2>
        {delivery.status === 'CREATED' && (
          <div className="space-y-2">
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
              onClick={() => run('Order accepted', () => sellerAcceptDelivery(delivery.id))}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Accept Order
            </Button>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Rejection reason"
              className={textareaBase}
            />
            <Button
              variant="outline"
              className="w-full h-10 rounded-lg border-red-200 text-xs font-black uppercase text-red-700"
              onClick={() => run('Order rejected', () => sellerRejectDelivery(delivery.id, { reason: rejectReason }))}
              disabled={!rejectReason.trim()}
            >
              Reject Order
            </Button>
          </div>
        )}

        {(delivery.status === 'SELLER_ACCEPTED' || delivery.status === 'PACKED') && (
          <div className="space-y-2">
            <p className={fieldLabel}>Mark as packed</p>
            <Input
              placeholder="Weight (kg)"
              value={packForm.packageWeightKg}
              onChange={e => setPackForm(s => ({ ...s, packageWeightKg: e.target.value }))}
            />
            <Input
              placeholder="Dimensions (LxWxH)"
              value={packForm.packageDimensions}
              onChange={e => setPackForm(s => ({ ...s, packageDimensions: e.target.value }))}
            />
            <Input
              placeholder="Package count"
              value={packForm.packageCount}
              onChange={e => setPackForm(s => ({ ...s, packageCount: e.target.value }))}
            />
            <Button
              className="w-full h-10 rounded-lg bg-[#12335f] text-xs font-black uppercase text-white"
              onClick={() =>
                run('Mark packed', () =>
                  markDeliveryPacked(delivery.id, {
                    packageWeightKg: packForm.packageWeightKg ? Number(packForm.packageWeightKg) : undefined,
                    packageDimensions: packForm.packageDimensions || undefined,
                    packageCount: packForm.packageCount ? Number(packForm.packageCount) : undefined
                  })
                )
              }
            >
              Confirm Packed
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <p className={fieldLabel}>Dispatch details</p>
          <Input
            placeholder="Tracking number"
            value={dispatchForm.trackingNumber}
            onChange={e => setDispatchForm(s => ({ ...s, trackingNumber: e.target.value }))}
          />
          <Input
            placeholder="Carrier name"
            value={dispatchForm.carrierName}
            onChange={e => setDispatchForm(s => ({ ...s, carrierName: e.target.value }))}
          />
          <Select
            value={dispatchForm.logisticsPartnerId}
            onChange={e => setDispatchForm(s => ({ ...s, logisticsPartnerId: e.target.value }))}
          >
            <option value="">Select logistics partner</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Input
            placeholder="E-Way bill"
            value={dispatchForm.ewayBillNumber}
            onChange={e => setDispatchForm(s => ({ ...s, ewayBillNumber: e.target.value }))}
          />
          <Input
            placeholder="Courier receipt #"
            value={dispatchForm.courierReceiptNumber}
            onChange={e => setDispatchForm(s => ({ ...s, courierReceiptNumber: e.target.value }))}
          />
          <Input
            type="date"
            value={dispatchForm.expectedDelivery}
            onChange={e => setDispatchForm(s => ({ ...s, expectedDelivery: e.target.value }))}
          />
          <Button
            variant="outline"
            className="w-full h-10 rounded-lg text-xs font-black uppercase"
            onClick={() =>
              run('Dispatch details saved', () =>
                updateDispatchDetails(delivery.id, {
                  trackingNumber: dispatchForm.trackingNumber || undefined,
                  carrierName: dispatchForm.carrierName || undefined,
                  logisticsPartnerId: dispatchForm.logisticsPartnerId ? Number(dispatchForm.logisticsPartnerId) : undefined,
                  ewayBillNumber: dispatchForm.ewayBillNumber || undefined,
                  courierReceiptNumber: dispatchForm.courierReceiptNumber || undefined,
                  expectedDelivery: dispatchForm.expectedDelivery || undefined
                })
              )
            }
          >
            Save Dispatch Details
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-lg text-xs font-black uppercase"
            onClick={() => run('Ready for pickup', () => markReadyForPickup(delivery.id))}
            disabled={!['SELLER_ACCEPTED', 'PACKED'].includes(delivery.status)}
          >
            Ready
          </Button>
          <Button
            className="h-10 rounded-lg bg-[#12335f] text-xs font-black uppercase text-white"
            onClick={() => run('Mark dispatched', () => markDispatched(delivery.id))}
            disabled={!['PACKED', 'READY_FOR_PICKUP', 'PICKUP_SCHEDULED', 'PICKED_UP'].includes(delivery.status)}
          >
            <Truck className="mr-2 h-4 w-4" /> Dispatch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LogisticsActions({
  delivery,
  run
}: {
  delivery: DeliveryDetailDto;
  run: (label: string, runner: ActionRunner) => Promise<unknown>;
}) {
  const [form, setForm] = useState<{ status: DeliveryStatus | ''; location: string; remarks: string }>({
    status: '',
    location: '',
    remarks: ''
  });
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className={sectionHeader}>Logistics Update</h2>
        <Select
          value={form.status}
          onChange={e => setForm(s => ({ ...s, status: e.target.value as DeliveryStatus }))}
        >
          <option value="">Select status</option>
          {(['PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'DELIVERY_FAILED', 'REATTEMPT_SCHEDULED'] as DeliveryStatus[]).map(s => (
            <option key={s} value={s}>{DELIVERY_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Input placeholder="Location" value={form.location} onChange={e => setForm(s => ({ ...s, location: e.target.value }))} />
        <textarea
          className={textareaBase}
          placeholder="Remarks"
          value={form.remarks}
          onChange={e => setForm(s => ({ ...s, remarks: e.target.value }))}
        />
        <Button
          className="w-full h-10 rounded-lg bg-[#12335f] text-xs font-black uppercase text-white"
          disabled={!form.status}
          onClick={() => {
            if (!form.status) return;
            void run('Logistics status updated', () =>
              logisticsStatusUpdate(delivery.id, {
                status: form.status as DeliveryStatus,
                location: form.location || undefined,
                remarks: form.remarks || undefined
              })
            );
          }}
        >
          <ChevronRight className="mr-2 h-4 w-4" /> Update Status
        </Button>
      </CardContent>
    </Card>
  );
}

function BuyerActions({ delivery, run }: { delivery: DeliveryDetailDto; run: (label: string, runner: ActionRunner) => Promise<unknown> }) {
  const [accept, setAccept] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [damageNotes, setDamageNotes] = useState('');
  const [missingQty, setMissingQty] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnType, setReturnType] = useState<'RETURN' | 'REPLACEMENT' | 'REFUND'>('RETURN');

  const canAcceptStage = ['DELIVERED', 'DELIVERY_CONFIRMATION_PENDING', 'DISPUTE_RESOLVED'].includes(delivery.status);
  const canReturnStage = ['ACCEPTED', 'REJECTED', 'DELIVERED'].includes(delivery.status);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h2 className={sectionHeader}>Receipt &amp; Acceptance</h2>
        {!canAcceptStage && (
          <p className="text-xs font-semibold text-slate-500">
            Acceptance becomes available once the delivery is marked as delivered.
          </p>
        )}
        {canAcceptStage && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant={accept ? 'primary' : 'outline'}
                className="flex-1 h-10 rounded-lg text-xs font-black uppercase"
                onClick={() => setAccept(true)}
              >
                Accept
              </Button>
              <Button
                variant={!accept ? 'primary' : 'outline'}
                className="flex-1 h-10 rounded-lg text-xs font-black uppercase"
                onClick={() => setAccept(false)}
              >
                Reject
              </Button>
            </div>
            {!accept && (
              <>
                <textarea
                  className={textareaBase}
                  placeholder="Rejection reason (required)"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
                <textarea
                  className={textareaBase}
                  placeholder="Damage / wrong item notes (optional)"
                  value={damageNotes}
                  onChange={e => setDamageNotes(e.target.value)}
                />
                <Input
                  placeholder="Missing quantity"
                  value={missingQty}
                  onChange={e => setMissingQty(e.target.value)}
                />
              </>
            )}
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
              disabled={!accept && !rejectReason.trim()}
              onClick={() =>
                run(accept ? 'Delivery accepted' : 'Delivery rejected', () =>
                  buyerAcceptance(delivery.id, {
                    accepted: accept,
                    rejectionReason: accept ? undefined : rejectReason,
                    damageNotes: accept ? undefined : damageNotes,
                    missingQuantity: missingQty ? Number(missingQty) : undefined
                  })
                )
              }
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
            <textarea
              className={textareaBase}
              placeholder="Reason"
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
            />
            <Button
              variant="outline"
              className="w-full h-10 rounded-lg text-xs font-black uppercase"
              disabled={!returnReason.trim()}
              onClick={() => run('Return initiated', () => initiateReturn(delivery.id, { type: returnType, reason: returnReason }))}
            >
              Initiate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinanceActions({ delivery, run }: { delivery: DeliveryDetailDto; run: (label: string, runner: ActionRunner) => Promise<unknown> }) {
  const invoices = delivery.purchaseOrder?.invoices || [];

  // Auto-pick the most relevant invoice: prefer approved → submitted → newest.
  // Memoised so the user can still override the choice without it snapping back.
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

  // If the delivery reloads with a fresh invoice list, sync the default once.
  useEffect(() => {
    if (!invoiceId && defaultInvoiceId) setInvoiceId(defaultInvoiceId);
  }, [defaultInvoiceId, invoiceId]);

  const [decision, setDecision] = useState({ approve: true, rejectionReason: '', deductionAmount: '', penaltyAmount: '' });
  const [release, setRelease] = useState({ transactionReference: '', netReleasedAmount: '', remarks: '' });

  const selectedInvoice = invoices.find(inv => String(inv.id) === invoiceId);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h2 className={sectionHeader}>Finance / Payment</h2>

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
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Number</span>
                      <span className="font-black text-slate-900">{selectedInvoice.invoiceNumber || `#${selectedInvoice.id}`}</span>
                    </div>
                    {selectedInvoice.amount !== undefined && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Amount</span>
                        <span className="font-black text-slate-900">{formatCurrency(selectedInvoice.amount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Status</span>
                      <span className="font-black text-slate-900">{(selectedInvoice.invoiceStatus || selectedInvoice.status || 'submitted').toString().toUpperCase()}</span>
                    </div>
                    {selectedInvoice.invoiceFile?.id && (
                      <a
                        href={`/api/files/${selectedInvoice.invoiceFile.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#12335f] hover:underline"
                      >
                        <FileText className="h-3 w-3" /> Preview invoice
                      </a>
                    )}
                  </div>
                )}
                <Button
                  className="w-full h-10 rounded-lg bg-[#12335f] text-xs font-black uppercase text-white"
                  disabled={!invoiceId}
                  onClick={() => run('Invoice verified', () => verifyInvoice(delivery.id, { invoiceId: Number(invoiceId) }))}
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
              <textarea
                className={textareaBase}
                placeholder="Rejection reason"
                value={decision.rejectionReason}
                onChange={e => setDecision(s => ({ ...s, rejectionReason: e.target.value }))}
              />
            )}
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
              disabled={!decision.approve && !decision.rejectionReason.trim()}
              onClick={() =>
                run(decision.approve ? 'Payment approved' : 'Payment rejected', () =>
                  paymentDecision(delivery.id, {
                    approve: decision.approve,
                    rejectionReason: decision.approve ? undefined : decision.rejectionReason,
                    deductionAmount: decision.deductionAmount ? Number(decision.deductionAmount) : undefined,
                    penaltyAmount: decision.penaltyAmount ? Number(decision.penaltyAmount) : undefined
                  })
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
            <Input
              placeholder="Transaction reference"
              value={release.transactionReference}
              onChange={e => setRelease(s => ({ ...s, transactionReference: e.target.value }))}
            />
            <Input
              placeholder="Net released amount"
              value={release.netReleasedAmount}
              onChange={e => setRelease(s => ({ ...s, netReleasedAmount: e.target.value }))}
            />
            <textarea
              className={textareaBase}
              placeholder="Remarks"
              value={release.remarks}
              onChange={e => setRelease(s => ({ ...s, remarks: e.target.value }))}
            />
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
              disabled={!release.transactionReference.trim()}
              onClick={() =>
                run('Payment released', () =>
                  releaseDeliveryPayment(delivery.id, {
                    transactionReference: release.transactionReference,
                    netReleasedAmount: release.netReleasedAmount ? Number(release.netReleasedAmount) : undefined,
                    remarks: release.remarks || undefined
                  })
                )
              }
            >
              Release &amp; Close
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
          <p className={fieldLabel}>Settlement Snapshot</p>
          <p className="mt-1 text-slate-700 font-bold">
            Status: {delivery.settlement?.status || 'PENDING'}
          </p>
          {delivery.settlement?.transactionReference && (
            <p className="text-[10px] text-slate-500 font-semibold">
              Reference: {delivery.settlement.transactionReference}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminActions({ delivery, run }: { delivery: DeliveryDetailDto; run: (label: string, runner: ActionRunner) => Promise<unknown> }) {
  const [override, setOverride] = useState({ status: delivery.status, reason: '', location: '' });
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className={sectionHeader}>
          <ShieldAlert className="inline mr-1 h-3.5 w-3.5" /> Admin Override
        </h2>
        <Select value={override.status} onChange={e => setOverride(s => ({ ...s, status: e.target.value as DeliveryStatus }))}>
          {ALL_STATUSES.map(status => (
            <option key={status} value={status}>{DELIVERY_STATUS_LABELS[status]}</option>
          ))}
        </Select>
        <Input
          placeholder="Location (optional)"
          value={override.location}
          onChange={e => setOverride(s => ({ ...s, location: e.target.value }))}
        />
        <textarea
          className={textareaBase}
          placeholder="Reason (required)"
          value={override.reason}
          onChange={e => setOverride(s => ({ ...s, reason: e.target.value }))}
        />
        <Button
          variant="outline"
          className="w-full h-10 rounded-lg border-amber-200 bg-amber-50 text-xs font-black uppercase text-amber-700"
          disabled={!override.reason.trim()}
          onClick={() => run('Admin override', () => adminOverrideStatus(delivery.id, override))}
        >
          Apply Override
        </Button>
      </CardContent>
    </Card>
  );
}

function DisputeActions({
  delivery,
  accessRole,
  run
}: {
  delivery: DeliveryDetailDto;
  accessRole: string;
  run: (label: string, runner: ActionRunner) => Promise<unknown>;
}) {
  const [category, setCategory] = useState('Damaged Goods');
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('');

  const canRaise = ['buyer', 'seller', 'consignee'].includes(accessRole) && delivery.status !== 'DISPUTE_RAISED' && delivery.status !== 'CLOSED';
  const canResolve = accessRole === 'admin' && delivery.status === 'DISPUTE_RAISED';

  if (!canRaise && !canResolve) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className={sectionHeader}>
          <AlertTriangle className="inline mr-1 h-3.5 w-3.5" /> Dispute
        </h2>
        {canRaise && (
          <div className="space-y-2">
            <Select value={category} onChange={e => setCategory(e.target.value)}>
              <option>Damaged Goods</option>
              <option>Wrong Item</option>
              <option>Missing Quantity</option>
              <option>Delayed Payment</option>
              <option>Other</option>
            </Select>
            <textarea
              className={textareaBase}
              placeholder="Describe the issue"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <Button
              variant="outline"
              className="w-full h-10 rounded-lg border-red-200 text-xs font-black uppercase text-red-700"
              disabled={!reason.trim()}
              onClick={() => run('Dispute raised', () => raiseDeliveryDispute(delivery.id, { category, reason }))}
            >
              Raise Dispute
            </Button>
          </div>
        )}
        {canResolve && (
          <div className="space-y-2">
            <textarea
              className={textareaBase}
              placeholder="Resolution remarks"
              value={resolution}
              onChange={e => setResolution(e.target.value)}
            />
            <Button
              className="w-full h-10 rounded-lg bg-[#0f5132] text-xs font-black uppercase text-white"
              disabled={!resolution.trim()}
              onClick={() => run('Dispute resolved', () => resolveDeliveryDispute(delivery.id, { resolutionRemarks: resolution }))}
            >
              Resolve Dispute
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentUploadForm({
  onUpload
}: {
  onUpload: (documentType: DeliveryDocumentType, fileAssetId: number, description?: string) => Promise<unknown>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DeliveryDocumentType>('OTHER');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const asset = await uploadDeliveryFile(file);
      await onUpload(docType, asset.id, description || undefined);
      setFile(null);
      setDescription('');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <Upload className="h-4 w-4 text-[#12335f]" />
        <span>Upload Document</span>
      </div>
      <Select value={docType} onChange={e => setDocType(e.target.value as DeliveryDocumentType)}>
        {(['DELIVERY_CHALLAN', 'PACKING_SLIP', 'COURIER_RECEIPT', 'EWAY_BILL', 'PROOF_OF_DISPATCH', 'PROOF_OF_DELIVERY', 'INSPECTION_REPORT', 'REJECTION_REPORT', 'RETURN_DOCUMENT', 'TAX_INVOICE', 'PAYMENT_PROOF', 'OTHER'] as DeliveryDocumentType[]).map(t => (
          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
        ))}
      </Select>
      <input
        type="file"
        onChange={e => setFile(e.target.files?.[0] || null)}
        className="block w-full text-xs"
      />
      <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
      {err && <p className="text-[10px] font-bold text-red-700">{err}</p>}
      <Button
        variant="outline"
        className="w-full h-10 rounded-lg text-xs font-black uppercase"
        disabled={!file || busy}
        onClick={() => void submit()}
      >
        <ClipboardList className="mr-2 h-4 w-4" /> {busy ? 'Uploading...' : 'Attach to delivery'}
      </Button>
    </div>
  );
}

export default DeliveryDetailPage;
