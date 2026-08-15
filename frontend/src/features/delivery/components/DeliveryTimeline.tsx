import { useMemo } from 'react';
import { CheckCircle2, Clock, Truck } from 'lucide-react';
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
      occurredAt: event.occurredAt
    })),
    ...statusLogs
      .filter(log => !log.previousStatus || log.previousStatus !== log.newStatus)
      .map(log => ({
        key: `log-${log.id}`,
        status: normalizeTrackingStatus(log.newStatus) || log.newStatus,
        location: undefined,
        remarks: log.remarks,
        occurredAt: log.createdAt
      }))
  ].filter(entry => entry.status && TRACKING_STATUSES.has(String(entry.status)));

  // Bucket by status + nearest 5-second window. Anything within that window for
  // the same status counts as a single transition; we keep the entry that
  // carries more information (location/remarks).
  const buckets = new Map<string, TimelineEntry>();
  for (const entry of merged) {
    const ts = entry.occurredAt ? Math.floor(new Date(entry.occurredAt).getTime() / 5000) : 'no-ts';
    const bucketKey = `${entry.status}::${ts}`;
    const existing = buckets.get(bucketKey);
    if (!existing) {
      buckets.set(bucketKey, entry);
      continue;
    }
    const score = (e: TimelineEntry) => (e.location ? 1 : 0) + (e.remarks ? 1 : 0);
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
  const progressPercent =
    TRACKING_PATH.length <= 1 ? 0 : (currentIndex / (TRACKING_PATH.length - 1)) * 100;

  return (
    <div className="space-y-6">
      {/* Local keyframes - keeps the component self-contained without touching
          tailwind config. */}
      <style>{`
        @keyframes dt-fade-in-up {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes dt-slide-in {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes dt-grow-line {
          0% { transform: scaleY(0); }
          100% { transform: scaleY(1); }
        }
        @keyframes dt-pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(18, 51, 95, 0.45); }
          50%      { box-shadow: 0 0 0 6px rgba(18, 51, 95, 0); }
        }
        @keyframes dt-bounce-soft {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        .dt-fade-in-up { animation: dt-fade-in-up 350ms ease-out both; }
        .dt-slide-in   { animation: dt-slide-in 400ms ease-out both; }
        .dt-pulse-ring { animation: dt-pulse-ring 2.4s ease-in-out infinite; }
        .dt-bounce     { animation: dt-bounce-soft 1.6s ease-in-out infinite; }
        .dt-line-grow  { transform-origin: top; animation: dt-grow-line 700ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .dt-fade-in-up, .dt-slide-in, .dt-pulse-ring, .dt-bounce, .dt-line-grow {
            animation: none !important;
          }
        }
      `}</style>

      <div>
        <div className="relative grid gap-3 sm:grid-cols-5">
          {TRACKING_PATH.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={step}
                className={cn(
                  'dt-fade-in-up relative rounded-xl border bg-white p-3 shadow-sm transition-all duration-300',
                  isCompleted && 'border-emerald-200 bg-emerald-50/70',
                  isCurrent && 'border-[#12335f]/30 bg-[#12335f]/5 ring-2 ring-[#12335f]/10',
                  !isCompleted && !isCurrent && 'border-slate-200 text-slate-400'
                )}
                style={{ animationDelay: `${idx * 35}ms` }}
              >
                <div
                  className={cn(
                    'mb-2 flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm',
                    isCompleted ? 'bg-emerald-600' : isCurrent ? 'bg-[#12335f] dt-pulse-ring' : 'bg-slate-200'
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Truck className="h-4 w-4 dt-bounce" /> : <Clock className="h-4 w-4" />}
                </div>
                <p className={cn('text-[10px] font-black uppercase tracking-wide', isCompleted || isCurrent ? 'text-slate-950' : 'text-slate-400')}>
                  {labelFor(step)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#12335f] transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="relative space-y-3">
        {merged.length > 0 && (
          <div
            className="dt-line-grow absolute bottom-3 left-4 top-3 w-0.5 bg-slate-200"
          />
        )}
        {merged.length === 0 ? (
          <div className="dt-fade-in-up rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs font-semibold text-slate-500">
            No status updates yet.
          </div>
        ) : (
          merged.map((event, idx) => {
            const isLatest = idx === 0;
            const isTerminal =
              String(event.status).includes('DELIVERED') || String(event.status) === 'CLOSED';
            const isMoving =
              String(event.status) === 'OUT_FOR_DELIVERY' || String(event.status).startsWith('IN_');
            return (
              <div
                key={event.key}
                className="dt-slide-in relative flex items-start gap-4"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div
                  className={cn(
                    'z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#12335f] ring-1 ring-slate-200 shadow-sm transition-transform duration-300',
                    isLatest && 'bg-[#12335f] text-white ring-[#12335f]/30'
                  )}
                >
                  {isTerminal ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isMoving ? (
                    <Truck className={cn('h-3.5 w-3.5', isLatest && 'dt-bounce')} />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-black uppercase text-slate-900">
                      {labelFor(event.status as string)}
                    </p>
                    {isLatest && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-700">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                    {[event.location, event.remarks, formatDate(event.occurredAt)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
