import { useMemo, useRef, useEffect, useState } from 'react';
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
  const eventEntries: TimelineEntry[] = events
    .filter(e => e && e.status)
    .map(event => ({
      key: `event-${event.id}`,
      status: normalizeTrackingStatus(event.status) || event.status,
      location: event.location || undefined,
      remarks: event.remarks || undefined,
      actorRole: undefined,
      occurredAt: event.occurredAt
    }));

  const logEntries: TimelineEntry[] = statusLogs
    .filter(log => log && log.newStatus && (!log.previousStatus || log.previousStatus !== log.newStatus))
    .map(log => ({
      key: `log-${log.id}`,
      status: normalizeTrackingStatus(log.newStatus) || log.newStatus,
      location: undefined,
      remarks: log.remarks || undefined,
      actorRole: log.actorRole,
      occurredAt: log.createdAt
    }));

  const result: TimelineEntry[] = [];
  const consumedLogKeys = new Set<string>();

  for (const ev of eventEntries) {
    if (!ev.status || !TRACKING_STATUSES.has(String(ev.status))) continue;

    const evTime = ev.occurredAt ? new Date(ev.occurredAt).getTime() : 0;
    let bestMatch: TimelineEntry | null = null;
    let minDiff = Infinity;

    for (const lg of logEntries) {
      if (consumedLogKeys.has(lg.key)) continue;
      if (lg.status !== ev.status) continue;
      const lgTime = lg.occurredAt ? new Date(lg.occurredAt).getTime() : 0;
      const diff = Math.abs(evTime - lgTime);
      if (diff <= 120_000 || !evTime || !lgTime) {
        if (diff < minDiff) {
          minDiff = diff;
          bestMatch = lg;
        }
      }
    }

    if (bestMatch) {
      consumedLogKeys.add(bestMatch.key);
      result.push({
        key: `milestone-${ev.status}-${ev.key}`,
        status: ev.status,
        location: ev.location || bestMatch.location,
        remarks: ev.remarks || bestMatch.remarks,
        actorRole: bestMatch.actorRole,
        occurredAt: ev.occurredAt || bestMatch.occurredAt
      });
    } else {
      result.push({
        key: `milestone-${ev.status}-${ev.key}`,
        status: ev.status,
        location: ev.location,
        remarks: ev.remarks,
        actorRole: ev.actorRole,
        occurredAt: ev.occurredAt
      });
    }
  }

  for (const lg of logEntries) {
    if (!consumedLogKeys.has(lg.key) && lg.status && TRACKING_STATUSES.has(String(lg.status))) {
      const lgTime = lg.occurredAt ? new Date(lg.occurredAt).getTime() : 0;
      const alreadyHas = result.some(
        r => r.status === lg.status && Math.abs((r.occurredAt ? new Date(r.occurredAt).getTime() : 0) - lgTime) <= 60_000
      );
      if (!alreadyHas) {
        result.push({
          key: `milestone-${lg.status}-${lg.key}`,
          status: lg.status,
          location: lg.location,
          remarks: lg.remarks,
          actorRole: lg.actorRole,
          occurredAt: lg.occurredAt
        });
      }
    }
  }

  return result.sort(
    (a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()
  );
};

/**
 * Animated wrapper — uses IntersectionObserver to trigger staggered
 * entrance animations for each timeline entry when it scrolls into view.
 */
function AnimatedEntry({
  children,
  index,
  className
}: {
  children: React.ReactNode;
  index: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check if prefers-reduced-motion
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Stagger delay based on index
          const delay = Math.min(index * 80, 400);
          setTimeout(() => setVisible(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -30px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        visible
          ? 'opacity-100 translate-y-0 translate-x-0'
          : 'opacity-0 translate-y-3 -translate-x-2',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DeliveryTimeline({ status, events = [], statusLogs = [] }: Props) {
  const merged = useMemo(() => buildTimeline(events, statusLogs), [events, statusLogs]);

  const timelineStatus = normalizeTrackingStatus(status);
  const currentIndex = Math.max(0, TRACKING_PATH.findIndex(step => step === timelineStatus));
  const isAllDelivered = timelineStatus === 'DELIVERED' || timelineStatus === 'ACCEPTED' || timelineStatus === 'CLOSED';
  const effectiveIndex = isAllDelivered ? TRACKING_PATH.length - 1 : currentIndex;
  
  const progressPercent =
    TRACKING_PATH.length <= 1 ? 0 : Math.round((effectiveIndex / (TRACKING_PATH.length - 1)) * 100);

  // Track progress bar animation
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Animate progress bar with a slight delay
          setTimeout(() => setAnimatedProgress(progressPercent), 200);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [progressPercent]);

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
    <div className="space-y-4">
      {/* ─── Compact Stage Tracker with Animated Progress Bar ─── */}
      <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40 p-3 shadow-xs sm:p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0f766e]/10 text-[#0f766e]">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-900">
              Shipment Progress Journey
            </span>
          </div>
          <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#0f766e]">
            Stage {effectiveIndex + 1} of {TRACKING_PATH.length} • {progressPercent}% Completed
          </span>
        </div>

        {/* Compact Horizontal Stepper — single row with connected dots */}
        <div className="relative">
          {/* Connection line behind steps */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200/80 sm:block hidden" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-gradient-to-r from-emerald-500 to-[#0f766e] transition-all duration-1000 ease-out sm:block hidden"
            style={{ width: `calc(${animatedProgress}% - 32px)` }}
          />

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {TRACKING_PATH.map((step, idx) => {
              const isCompleted = idx < effectiveIndex || (isAllDelivered && idx === effectiveIndex);
              const isCurrent = idx === effectiveIndex && !isAllDelivered;
              const StepIcon = STEP_ICONS[step] || Truck;
              const stepDate = stepDateMap.get(step);

              return (
                <AnimatedEntry key={step} index={idx} className="relative z-10">
                  <div
                    className={cn(
                      'flex flex-col items-center text-center gap-1 rounded-lg border px-1.5 py-2 transition-all duration-300',
                      isCompleted && 'border-emerald-200/90 bg-emerald-50/60',
                      isCurrent && 'border-[#0f766e] bg-gradient-to-b from-teal-50/90 to-emerald-50/30 ring-1 ring-[#0f766e]/20 shadow-sm',
                      !isCompleted && !isCurrent && 'border-slate-200/60 bg-white/80 opacity-60'
                    )}
                  >
                    {/* Step circle */}
                    <div
                      className={cn(
                        'relative flex h-7 w-7 items-center justify-center rounded-lg font-bold shadow-xs transition-all duration-300',
                        isCompleted ? 'bg-emerald-600 text-white shadow-emerald-600/20' :
                        isCurrent ? 'bg-[#0f766e] text-white dt-pulse-glow shadow-teal-600/30' :
                        'bg-slate-100 text-slate-400'
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      ) : isCurrent ? (
                        <StepIcon className="h-3.5 w-3.5 dt-bounce-soft" />
                      ) : (
                        <span className="text-[10px] font-black">{idx + 1}</span>
                      )}
                    </div>

                    {/* Status label */}
                    {(isCompleted || isCurrent) && (
                      <span className={cn(
                        'text-[8px] font-extrabold uppercase tracking-wider',
                        isCompleted ? 'text-emerald-700' : 'text-[#0f766e]'
                      )}>
                        {isCompleted ? '✓ Done' : 'Active'}
                      </span>
                    )}

                    <p className={cn(
                      'truncate text-[9px] font-black tracking-tight uppercase leading-tight w-full',
                      isCompleted ? 'text-emerald-950' : isCurrent ? 'text-[#0f766e]' : 'text-slate-600'
                    )}>
                      {labelFor(step)}
                    </p>
                    <p className="truncate text-[8px] font-semibold text-slate-400 w-full leading-tight">
                      {STEP_SUBTITLES[step] || `Step ${idx + 1}`}
                    </p>
                    {stepDate && (
                      <p className="truncate text-[8px] font-bold text-slate-400 w-full">
                        {formatDate(stepDate)}
                      </p>
                    )}
                  </div>
                </AnimatedEntry>
              );
            })}
          </div>
        </div>

        {/* Animated Progress Track Bar */}
        <div className="mt-3" ref={progressRef}>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
            <div
              className="dt-shimmer-bar h-full rounded-full bg-gradient-to-r from-emerald-500 via-[#0f766e] to-sky-500 shadow-[0_0_8px_rgba(15,118,110,0.3)] transition-all duration-1000 ease-out"
              style={{ width: `${animatedProgress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
            <span>Dispatched from Seller</span>
            <span>Handed to Buyer</span>
          </div>
        </div>
      </div>

      {/* ─── Compact Activity Log / Tracking History ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-[#0f766e]" /> Milestone Activity History
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-500">
            {merged.length} {merged.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        <div className="relative space-y-1.5 pt-0.5">
          {merged.length > 0 && (
            <div className="absolute bottom-2 left-3 top-2 w-px bg-gradient-to-b from-[#0f766e] via-slate-200 to-slate-100" />
          )}

          {merged.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-[10px] font-semibold text-slate-500">
              <Package className="mx-auto h-6 w-6 text-slate-300 mb-1.5" aria-hidden="true" />
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
                <AnimatedEntry
                  key={event.key}
                  index={idx}
                  className="relative flex items-start gap-2.5"
                >
                  {/* Timeline Dot / Icon — smaller */}
                  <div
                    className={cn(
                      'z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg shadow-xs transition-all duration-300 ring-1',
                      isLatest
                        ? 'bg-[#0f766e] text-white ring-teal-200 shadow-teal-700/20'
                        : isTerminal
                        ? 'bg-emerald-600 text-white ring-emerald-200'
                        : 'bg-white text-slate-500 ring-slate-200'
                    )}
                  >
                    {isTerminal ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : isMoving ? (
                      <Truck className={cn('h-3 w-3', isLatest && 'dt-bounce-soft')} />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                  </div>

                  {/* Card Body — compact */}
                  <div
                    className={cn(
                      'min-w-0 flex-1 rounded-lg border px-2.5 py-2 shadow-2xs transition-all duration-200',
                      isLatest
                        ? 'border-teal-200/90 bg-gradient-to-r from-teal-50/50 via-white to-white ring-1 ring-teal-500/10'
                        : 'border-slate-200/70 bg-white/95 hover:border-slate-300'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-tight text-slate-900">
                          {labelFor(event.status as string)}
                        </span>
                        {isLatest && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-px text-[7px] font-black uppercase tracking-widest text-emerald-800">
                            <span className="h-1 w-1 rounded-full bg-emerald-600 animate-ping" />
                            Latest
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">
                        {formatDate(event.occurredAt)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold text-slate-500">
                      {event.location && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 font-bold">
                          <MapPin className="h-2.5 w-2.5 text-slate-400" />
                          {event.location}
                        </span>
                      )}
                      {event.actorRole && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 font-bold uppercase">
                          <User className="h-2.5 w-2.5 text-slate-400" />
                          {event.actorRole}
                        </span>
                      )}
                      {event.remarks && (
                        <span className="text-slate-600 text-[9px]">
                          &ldquo;{event.remarks}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                </AnimatedEntry>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
