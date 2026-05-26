import { useMemo } from 'react';
import { CheckCircle2, Circle, Clock, Truck } from 'lucide-react';
import { formatDate } from '../../shared/format';
import { DELIVERY_HAPPY_PATH, labelFor, toneClassFor } from '../status';
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
      status: event.status,
      location: event.location,
      remarks: event.remarks,
      occurredAt: event.occurredAt
    })),
    ...statusLogs.map(log => ({
      key: `log-${log.id}`,
      status: log.newStatus,
      location: undefined,
      remarks: log.remarks,
      occurredAt: log.createdAt
    }))
  ].filter(entry => entry.status);

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

  const currentIndex = Math.max(0, DELIVERY_HAPPY_PATH.findIndex(step => step === status));
  const progressPercent =
    DELIVERY_HAPPY_PATH.length <= 1 ? 0 : (currentIndex / (DELIVERY_HAPPY_PATH.length - 1)) * 100;

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

      {/* Procurement stage strip */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
          Procurement Stage
        </p>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_HAPPY_PATH.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={step}
                className={cn(
                  'dt-fade-in-up flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-all duration-300',
                  isCompleted || isCurrent ? toneClassFor(step) : 'border-slate-200 bg-white text-slate-400',
                  isCurrent && 'dt-pulse-ring scale-105 shadow-sm',
                  'hover:-translate-y-0.5 hover:shadow-sm'
                )}
                style={{ animationDelay: `${idx * 35}ms` }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : isCurrent ? (
                  <Truck className="h-3 w-3 dt-bounce" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <span>{labelFor(step)}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar that animates as the order moves through stages. */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#12335f] via-sky-500 to-emerald-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Event log */}
      <div className="relative space-y-5 py-2">
        {merged.length > 0 && (
          <div
            className="dt-line-grow absolute bottom-3 left-3 top-3 w-0.5 bg-gradient-to-b from-[#12335f] via-slate-200 to-transparent"
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
                    'z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#12335f] text-white shadow-sm transition-transform duration-300 hover:scale-110',
                    isLatest && 'dt-pulse-ring ring-2 ring-[#12335f]/30'
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
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-black uppercase text-slate-900">
                      {labelFor(event.status as string)}
                    </p>
                    {isLatest && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-700 dt-fade-in-up">
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
