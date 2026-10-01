'use client';

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getBaseUrl } from '../../../lib/api';
import { getPusherClient, isPusherAvailable } from '../../../lib/realtime';

export type WebSocketStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR';

export interface ReverseAuctionSocketEvent {
  type: string;
  auctionId?: number | string;
  auctionCode?: string;
  currentLowest?: number;
  minimumNextBid?: number;
  sellerOrgId?: number | null;
  status?: string;
  timestamp?: string;
}

let isAuctionWsSupported = true;

const lastAuctionToastTimes = new Map<string, number>();

const triggerDeduplicatedAuctionToast = (
  dedupeKey: string,
  toastFn: () => void,
  cooldownMs = 4000
) => {
  const now = Date.now();
  const lastTime = lastAuctionToastTimes.get(dedupeKey) || 0;
  if (now - lastTime < cooldownMs) return;
  lastAuctionToastTimes.set(dedupeKey, now);
  toastFn();
};

export const useReverseAuctionRealtime = (
  auctionId: string | number | undefined | null,
  canonicalCode?: string
) => {
  const [status, setStatus] = useState<WebSocketStatus>('DISCONNECTED');
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);

  const cleanId = auctionId !== undefined && auctionId !== null ? String(auctionId).trim() : '';
  const cleanCode = canonicalCode ? String(canonicalCode).trim() : '';

  useEffect(() => {
    if (!cleanId) return;

    let isMounted = true;

    const handleAuctionEvent = (data: ReverseAuctionSocketEvent) => {
      // Invalidate queries for both numerical ID and canonical auction code
      const keysToInvalidate = [
        ['reverse-auction', auctionId],
        ['reverse-auction-summary', auctionId],
        ['reverse-auction-live', auctionId],
        ['reverse-auction-participants', auctionId],
        ['reverse-auction-bids', auctionId],
        ['reverse-auction-result', auctionId],
        ['procurement-bid'],
        ['procurement-bids'],
        ['rfq-detail-bid'],
        ['rfq-buyer-responses-v2']
      ];
      if (cleanCode && cleanCode !== cleanId) {
        keysToInvalidate.push(
          ['reverse-auction', cleanCode],
          ['reverse-auction-summary', cleanCode],
          ['reverse-auction-live', cleanCode],
          ['reverse-auction-participants', cleanCode],
          ['reverse-auction-bids', cleanCode],
          ['reverse-auction-result', cleanCode]
        );
      }

      keysToInvalidate.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });

      if (data.type === 'REVERSE_AUCTION_BID') {
        const priceFmt = data.currentLowest
          ? `₹${Number(data.currentLowest).toLocaleString('en-IN')}`
          : null;
        if (priceFmt) {
          triggerDeduplicatedAuctionToast(`auction-bid-${cleanId}-${data.currentLowest}`, () => {
            toast.info(`Leading Bid Lowered: ${priceFmt}`, {
              id: `auction-bid-${cleanId}`,
              description: data.minimumNextBid
                ? `Next maximum permitted bid is ₹${Number(data.minimumNextBid).toLocaleString('en-IN')}. Live board refreshed.`
                : 'The live auction board and standings have been updated.',
              duration: 4000
            });
          });
        }
      } else if (data.type === 'REVERSE_AUCTION_UPDATED' || data.type === 'REVERSE_AUCTION_STATUS_CHANGED') {
        triggerDeduplicatedAuctionToast(`auction-status-${cleanId}`, () => {
          toast.info('Auction Status Changed', {
            id: `auction-status-${cleanId}`,
            description: `Auction status moved to ${data.status || 'UPDATED'}.`,
            duration: 3500
          });
        });
      }
    };

    // --- Mode 1: Pusher (Production/Managed Cloud) ---
    if (isPusherAvailable()) {
      const pusher = getPusherClient();
      if (!pusher) return;

      setStatus('CONNECTING');
      const channelName = `auction-${cleanId}`;
      const channel = pusher.subscribe(channelName);

      channel.bind('pusher:subscription_succeeded', () => {
        if (!isMounted) return;
        setStatus('CONNECTED');
        void queryClient.invalidateQueries({ queryKey: ['reverse-auction-live', auctionId] });
      });

      channel.bind('pusher:subscription_error', () => {
        if (!isMounted) return;
        setStatus('ERROR');
      });

      channel.bind('REVERSE_AUCTION_BID', (data: ReverseAuctionSocketEvent) => {
        if (!isMounted) return;
        handleAuctionEvent(data);
      });

      channel.bind('REVERSE_AUCTION_UPDATED', (data: ReverseAuctionSocketEvent) => {
        if (!isMounted) return;
        handleAuctionEvent(data);
      });

      channel.bind('REVERSE_AUCTION_STATUS_CHANGED', (data: ReverseAuctionSocketEvent) => {
        if (!isMounted) return;
        handleAuctionEvent(data);
      });

      return () => {
        isMounted = false;
        channel.unbind_all();
        pusher.unsubscribe(channelName);
      };
    }

    // --- Mode 2: Native WebSocket with Polling Fallback ---
    let pollInterval: NodeJS.Timeout | null = null;
    let failedAttempts = 0;

    const startPollingFallback = () => {
      setStatus('DISCONNECTED');
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        if (!isMounted) return;
        void queryClient.invalidateQueries({ queryKey: ['reverse-auction-live', auctionId] });
        void queryClient.invalidateQueries({ queryKey: ['reverse-auction-bids', auctionId] });
      }, 3000);
    };

    const baseUrl = getBaseUrl();
    const isServerless = typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('.now.sh') ||
      (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1'))
    );

    if (!isAuctionWsSupported || isServerless) {
      startPollingFallback();
      return () => {
        isMounted = false;
        if (pollInterval) clearInterval(pollInterval);
      };
    }

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      setStatus(backoffRef.current > 1000 ? 'RECONNECTING' : 'CONNECTING');
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/ws';

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          failedAttempts = 0;
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'AUTH_SUCCESS') {
              setStatus('CONNECTED');
              backoffRef.current = 1000;
              ws.send(JSON.stringify({ type: 'SUBSCRIBE_AUCTION', auctionId: cleanId }));
              if (cleanCode && cleanCode !== cleanId) {
                ws.send(JSON.stringify({ type: 'SUBSCRIBE_AUCTION', auctionId: cleanCode }));
              }
            } else if (data.type === 'SUBSCRIBE_AUCTION_SUCCESS') {
              void queryClient.invalidateQueries({ queryKey: ['reverse-auction-live', auctionId] });
            } else if (
              data.type === 'REVERSE_AUCTION_BID' ||
              data.type === 'REVERSE_AUCTION_UPDATED' ||
              data.type === 'REVERSE_AUCTION_STATUS_CHANGED'
            ) {
              handleAuctionEvent(data);
            }
          } catch (err) {
            console.error('[WS Auction] Failed to parse message', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          failedAttempts++;
          wsRef.current = null;

          if (failedAttempts >= 2) {
            isAuctionWsSupported = false;
            startPollingFallback();
            return;
          }

          setStatus('DISCONNECTED');
          const nextBackoff = Math.min(backoffRef.current * 1.5, 10000);
          backoffRef.current = nextBackoff;

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) connect();
          }, nextBackoff);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setStatus('ERROR');
        };
      } catch (err) {
        console.error('[WS Auction] Connection setup failed:', err);
        failedAttempts++;
        if (failedAttempts >= 2) {
          isAuctionWsSupported = false;
          startPollingFallback();
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollInterval) clearInterval(pollInterval);
      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE_AUCTION', auctionId: cleanId }));
            if (cleanCode && cleanCode !== cleanId) {
              wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE_AUCTION', auctionId: cleanCode }));
            }
          }
        } catch {
          // Ignore send on closing
        }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [cleanId, cleanCode, auctionId, queryClient]);

  return { status };
};
