'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getPusherClient, isPusherAvailable } from '../lib/realtime';
import { api } from '../lib/api';
import { toast } from 'sonner';

export type RealtimeTransport = 'pusher' | 'polling' | 'disconnected';

export interface UseRealtimeSyncOptions {
  /** Channel name (e.g., 'procurement-123' or 'auction-456') */
  channel: string | null | undefined;
  /** Events to listen for */
  events: string[];
  /** Query keys to invalidate on any event */
  invalidateKeys: string[][];
  /** Polling interval when in fallback mode (ms). Defaults to 15,000 */
  pollingInterval?: number;
  /** Whether to enable polling fallback. Defaults to true */
  enablePolling?: boolean;
  /** Custom event handler callback */
  onEvent?: (eventType: string, data: any) => void;
  /** Optional human-readable page name for diagnostics */
  label?: string;
}

const DEFAULT_EVENT_TOASTS: Record<string, (d: any) => { title: string; description: string; type: 'success' | 'info' | 'warning' }> = {
  QUOTATION_SUBMITTED: (d) => ({
    title: 'New Quotation Received!',
    description: d?.offeredPrice ? `₹${Number(d.offeredPrice).toLocaleString('en-IN')}` : 'A vendor submitted a quotation.',
    type: 'success',
  }),
  PROCUREMENT_AWARDED: (d) => ({
    title: '🏆 Award Offered',
    description: d?.awardedAmount ? `Contract award offer issued for ₹${Number(d.awardedAmount).toLocaleString('en-IN')}.` : 'A contract award offer has been issued.',
    type: 'success',
  }),
  BID_ACCEPTED: () => ({
    title: '✅ Award Accepted',
    description: 'The seller has formally accepted the award.',
    type: 'success',
  }),
  BID_REJECTED: () => ({
    title: '❌ Award Declined',
    description: 'The seller has declined the award offer.',
    type: 'warning',
  }),
  TECHNICAL_EVALUATION_STARTED: () => ({
    title: '📋 Technical Evaluation Active',
    description: 'Technical bids are now under evaluation.',
    type: 'info',
  }),
  FINANCIAL_EVALUATION_STARTED: (d) => ({
    title: '💰 Financial Bids Opened',
    description: d?.l1Price ? `L1 benchmark: ₹${Number(d.l1Price).toLocaleString('en-IN')}.` : 'Financial envelopes have been opened.',
    type: 'info',
  }),
  L1_GENERATED: (d) => ({
    title: '📊 L1 Standings Computed',
    description: d?.l1Price ? `Lowest quotation is ₹${Number(d.l1Price).toLocaleString('en-IN')}.` : 'Rankings calculated.',
    type: 'info',
  }),
  REVERSE_AUCTION_BID: (d) => ({
    title: `Leading Bid: ₹${Number(d?.currentLowest || 0).toLocaleString('en-IN')}`,
    description: 'Live auction leaderboard updated.',
    type: 'info',
  }),
  REVERSE_AUCTION_UPDATED: (d) => ({
    title: 'Auction Status Updated',
    description: `Status changed to ${d?.status || 'UPDATED'}.`,
    type: 'info',
  }),
  REVERSE_AUCTION_STATUS_CHANGED: (d) => ({
    title: 'Auction Status Changed',
    description: `Status changed to ${d?.status || 'UPDATED'}.`,
    type: 'info',
  }),
};

export const useRealtimeSync = ({
  channel,
  events,
  invalidateKeys,
  pollingInterval = 15_000,
  enablePolling = true,
  onEvent,
  label,
}: UseRealtimeSyncOptions) => {
  const queryClient = useQueryClient();
  const [transport, setTransport] = useState<RealtimeTransport>('disconnected');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Periodically query Pusher health / quota (every 5 min)
  const { data: health } = useQuery({
    queryKey: ['realtime-health'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/realtime/health');
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data || data;
      } catch {
        return null;
      }
    },
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
    retry: false,
  });

  const isThrottled = health?.isThrottled === true;

  const invalidateAll = useCallback(() => {
    invalidateKeys.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key });
    });
  }, [queryClient, invalidateKeys]);

  useEffect(() => {
    if (!channel) return;
    let isMounted = true;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      pollTimerRef.current = setInterval(() => {
        if (!isMounted) return;
        invalidateAll();
      }, pollingInterval);
    };

    // --- Primary Transport: Pusher (unless server throttled) ---
    if (isPusherAvailable() && !isThrottled) {
      const pusher = getPusherClient();
      if (pusher) {
        const ch = pusher.subscribe(channel);

        ch.bind('pusher:subscription_succeeded', () => {
          if (!isMounted) return;
          setTransport('pusher');
          stopPolling();
          invalidateAll();
        });

        ch.bind('pusher:subscription_error', (error: any) => {
          if (!isMounted) return;
          console.warn(`[RealtimeSync] Pusher subscription failed for ${channel}`, error);
          if (enablePolling) {
            setTransport('polling');
            startPolling();
          }
        });

        events.forEach((eventName) => {
          ch.bind(eventName, (data: any) => {
            if (!isMounted) return;
            invalidateAll();
            const toastGenerator = DEFAULT_EVENT_TOASTS[eventName];
            if (toastGenerator) {
              const { title, description, type } = toastGenerator(data);
              toast[type](title, { description, duration: 4000 });
            }
            onEvent?.(eventName, data);
          });
        });

        // Connection state monitoring
        pusher.connection.bind('disconnected', () => {
          if (!isMounted) return;
          if (enablePolling) {
            setTransport('polling');
            startPolling();
          }
        });

        pusher.connection.bind('connected', () => {
          if (!isMounted) return;
          setTransport('pusher');
          stopPolling();
        });

        return () => {
          isMounted = false;
          stopPolling();
          ch.unbind_all();
          pusher.unsubscribe(channel);
        };
      }
    }

    // --- Fallback: Smart Polling ---
    if (enablePolling) {
      setTransport('polling');
      startPolling();
    }

    return () => {
      isMounted = false;
      stopPolling();
    };
  }, [channel, events, invalidateAll, pollingInterval, enablePolling, onEvent, isThrottled]);

  return {
    transport,
    isPusherConnected: transport === 'pusher',
    invalidateAll,
  };
};
