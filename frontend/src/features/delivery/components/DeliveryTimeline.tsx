import { useMemo } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
  User
} from 'lucide-react';
import { formatDate } from '../../shared/format';
import { labelFor } from '../status';
import type { DeliveryEventDto, DeliveryStatusLogDto, DeliveryStatus } from '../types';
import { cn } from '../../../lib/utils';

interface Props {
  status?: string;
  events?: DeliveryEventDto[];
  statusLogs?: DeliveryStatusLogDto[];
}

interface TimelineEntry {
  key: string;
  status: DeliveryStatus | string;
  location?: string;
  remarks?: string;
  actorRole?: string;
  occurredAt?: string;
}

const TRACKING_PATH: DeliveryStatus[] = [
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

const TRACKING_STATUSES = new Set<string>(TRACKING_PATH);

const normalizeTrackingStatus = (status?: string) => (status === 'DISPATCHED' ? 'IN_TRANSIT' : status);

const STEP_ICONS: Record<DeliveryStatus, React.ComponentType<{ className?: string }>> = {
  READY_FOR_PICKUP: Package,
  PICKED_UP: Truck,
  IN_TRANSIT: Truck,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: CheckCircle2,
  CREATED: Clock,
  SELLER_ACCEPTED: Check,
  SELLER_REJECTED: Clock,
  PACKED: Package,
  PICKUP_SCHEDULED: Clock,
  DISPATCHED: Truck,
  AT_HUB: MapPin,
  DELIVERY_CONFIRMATION_PENDING: Clock,
  ACCEPTED: ShieldCheck,
  REJECTED: Clock,
  RETURN_INITIATED: Clock,
  RETURNED: Clock,
  REPLACEMENT_REQUESTED: Clock,
  DISPUTE_RAISED: Clock,
  DISPUTE_RESOLVED: ShieldCheck,
  INVOICE_VERIFIED: Check,
  PAYMENT_APPROVED: Check,
  PAYMENT_RELEASED: Check,
  CLOSED: CheckCircle2,
  DELAYED: Clock,
  REATTEMPT_SCHEDULED: Clock,
  DELIVERY_FAILED: Clock,
  CANCELLED: Clock
};

const STEP_SUBTITLES: Record<string, string> = {
  READY_FOR_PICKUP: 'Packed & Ready',
  PICKED_UP: 'Collected by Courier',
  IN_TRANSIT: 'In Transit to Hub',
  OUT_FOR_DELIVERY: 'Out for Handover',
  DELIVERED: 'Delivered to Consignee'
};

/**
 * Merge events + status logs and dedupe entries that represent the same
 * transition. The service writes one row to each table per status change, so
 * without dedupe the user sees every step twice.
 */
const buildTimeline = (
  events: DeliveryEventDto[] = [],
  statusLogs: DeliveryStatusLogDto[] = []
): TimelineEntry[] => {
  const merged: TimelineEntry[] = [
    ...events.map(event => ({
      key: `event-${event.id}`,
      status: normalizeTrackingStatus(event.status) || event.status,
      location: event.location,
      remarks: event.remarks,
      actorRole: undefined,
      occurredAt: event.occurredAt
    })),
    ...statusLogs
      .filter(log => !log.previousStatus || log.previousStatus !== log.newStatus)
      .map(log => ({
      key: `log-${log.id}`,
      status: normalizeTrackingStatus(log.newStatus) || log.newStatus,
      location: undefined,
      remarks: log.remarks,
      actorRole: log.actorRole,
      occurredAt: log.createdAt
    }))
  ].filter(entry => entry.status && TRACKING_STATUSES.has(String(entry.status)));

  // Bucket by status + nearest 5-second window.
  const buckets = new Map<string, TimelineEntry>();
  for (const entry of merged) {
    const ts = entry.occurredAt ? Math.floor(new Date(entry.occurredAt).getTime() / 5000) : 'no-ts';
    const bucketKey = `${entry.status}::${ts}`;
    const existing = buckets.get(bucketKey);
    if (!existing) {
      buckets.set(bucketKey, entry);
      continue;
    }
    const score = (e: TimelineEntry) => (e.location ? 1 : 0) + (e.remarks ? 1 : 0) + (e.actorRole ? 1 : 0);
    if (score(entry) > score(existing)) buckets.set(bucketKey, entry);
  }

  return [...buckets.values()].sort(
    (a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()
  );
};

export function DeliveryTimeline({ status, events = [], statusLogs = [] }: Props) {
  const merged = useMemo(() => buildTimeline(events, statusLogs), [events, statusLogs]);

  const timelineStatus = normalizeTrackingStatus(status);
  const currentIndex = Math.max(0, TRACKING_PATH.findIndex(step => step === timelineStatus));
  const isAllDelivered = timelineStatus === 'DELIVERED' || timelineStatus === 'ACCEPTED' || timelineStatus === 'CLOSED';
  const effectiveIndex = isAllDelivered ? TRACKING_PATH.length - 1 : currentIndex;
  
  const progressPercent =
    TRACKING_PATH.length <= 1 ? 0 : Math.round((effectiveIndex / (TRACKING_PATH.length - 1)) * 100);

  // Map each tracking step to its latest event date if available
  const stepDateMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of merged) {
      if (item.occurredAt && !map.has(String(item.status))) {
        map.set(String(item.status), item.occurredAt);
      }
    }
    return map;
  }, [merged]);

  return (
    <div className="space-y-6">
      {/* ─── Top Stage Tracker with Animated Progress Bar ─── */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40 p-4 shadow-xs sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0f766e]/10 text-[#0f766e]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">
              Shipment Progress Journey
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0f766e]">
              Stage {effectiveIndex + 1} of {TRACKING_PATH.length} • {progressPercent}% Completed
            </span>
          </div>
        </div>

        {/* 5-Step Stepper Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5 sm:gap-3">
          {TRACKING_PATH.map((step, idx) => {
            const isCompleted = idx < effectiveIndex || (isAllDelivered && idx === effectiveIndex);
            const isCurrent = idx === effectiveIndex && !isAllDelivered;
            const StepIcon = STEP_ICONS[step] || Truck;
            const stepDate = stepDateMap.get(step);

            return (
              <div
                key={step}
                className={cn(
                  'dt-fade-in-up group relative flex flex-col justify-between overflow-hidden rounded-xl border p-3 transition-all duration-300',
                  isCompleted && 'border-emerald-200/90 bg-emerald-50/60 shadow-xs hover:border-emerald-300',
                  isCurrent && 'border-[#0f766e] bg-gradient-to-b from-teal-50/90 via-white to-emerald-50/30 ring-2 ring-[#0f766e]/20 shadow-md shadow-teal-900/5',
                  !isCompleted && !isCurrent && 'border-slate-200/70 bg-white/80 opacity-70 hover:opacity-90'
                )}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Active Glowing Indicator Bar */}
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-[#0f766e] to-emerald-400" />
                )}

                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      'relative flex h-8 w-8 items-center justify-center rounded-xl font-bold transition-transform duration-300 shadow-xs',
                      isCompleted ? 'bg-emerald-600 text-white shadow-emerald-600/20' :
                      isCurrent ? 'bg-[#0f766e] text-white dt-pulse-glow shadow-teal-600/30' :
                      'bg-slate-100 text-slate-400'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : isCurrent ? (
                      <StepIcon className="h-4 w-4 dt-bounce-soft" />
                    ) : (
                      <span className="text-[11px] font-black">{idx + 1}</span>
                    )}
                  </div>

                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0f766e] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-xs">
                      <span className="h-1 w-1 rounded-full bg-white animate-ping" />
                      Active
                    </span>
                  )}
                  {isCompleted && (
                    <span className="inline-flex items-center text-[9px] font-extrabold text-emerald-700">
                      ✓ Done
                    </span>
                  )}
                </div>

                <div className="mt-2.5 min-w-0">
                  <p
                    className={cn(
                      'truncate text-[11px] font-black tracking-tight uppercase',
                      isCompleted ? 'text-emerald-950' : isCurrent ? 'text-[#0f766e]' : 'text-slate-700'
                    )}
                  >
                    {labelFor(step)}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                    {STEP_SUBTITLES[step] || `Step ${idx + 1}`}
                  </p>
                  {stepDate && (
                    <p className="mt-0.5 truncate text-[9px] font-bold text-slate-400">
                      {formatDate(stepDate)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Track Bar */}
        <div className="mt-4">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/70 p-0.5">
            <div
              className="dt-shimmer-bar h-full rounded-full bg-gradient-to-r from-emerald-500 via-[#0f766e] to-sky-500 shadow-[0_0_12px_rgba(15,118,110,0.4)] transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span>Dispatched from Seller</span>
            <span>Handed to Buyer</span>
          </div>
        </div>
      </div>

      {/* ─── Activity Log / Tracking History ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-[#0f766e]" /> Milestone Activity History
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
            {merged.length} {merged.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        <div className="relative space-y-3 pt-1">
          {merged.length > 0 && (
            <div className="absolute bottom-4 left-4 top-4 w-0.5 bg-gradient-to-b from-[#0f766e] via-slate-200 to-slate-100" />
          )}

          {merged.length === 0 ? (
            <div className="dt-fade-in-up rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-xs font-semibold text-slate-500">
              <Package className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              No milestone log events recorded yet. Updates will appear as the shipment progresses.
            </div>
          ) : (
            merged.map((event, idx) => {
              const isLatest = idx === 0;
              const isTerminal =
                String(event.status).includes('DELIVERED') || String(event.status) === 'CLOSED';
              const isMoving =
                String(event.status) === 'OUT_FOR_DELIVERY' ||
                String(event.status).startsWith('IN_') ||
                String(event.status) === 'PICKED_UP';

              return (
                <div
                  key={event.key}
                  className="dt-slide-in relative flex items-start gap-3.5"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Timeline Dot / Icon */}
                  <div
                    className={cn(
                      'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-xs transition-all duration-300 ring-2',
                      isLatest
                        ? 'bg-[#0f766e] text-white ring-teal-200 shadow-teal-700/20'
                        : isTerminal
                        ? 'bg-emerald-600 text-white ring-emerald-200'
                        : 'bg-white text-slate-600 ring-slate-200'
                    )}
                  >
                    {isTerminal ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isMoving ? (
                      <Truck className={cn('h-4 w-4', isLatest && 'dt-bounce-soft')} />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </div>

                  {/* Card Body */}
                  <div
                    className={cn(
                      'min-w-0 flex-1 rounded-xl border p-3 shadow-xs transition-all duration-200',
                      isLatest
                        ? 'border-teal-200/90 bg-gradient-to-r from-teal-50/50 via-white to-white ring-1 ring-teal-500/10'
                        : 'border-slate-200/70 bg-white/95 hover:border-slate-300'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                          {labelFor(event.status as string)}
                        </span>
                        {isLatest && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-800">
                            <span className="h-1 w-1 rounded-full bg-emerald-600 animate-ping" />
                            Latest
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        {formatDate(event.occurredAt)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
                      {event.location && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 font-bold">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {event.location}
                        </span>
                      )}
                      {event.actorRole && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 font-bold uppercase">
                          <User className="h-3 w-3 text-slate-400" />
                          {event.actorRole}
                        </span>
                      )}
                      {event.remarks && (
                        <span className="text-slate-600">
                          “{event.remarks}”
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

