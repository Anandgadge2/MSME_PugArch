'use client';

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getBaseUrl } from '../../../lib/api';
import { getPusherClient, isPusherAvailable } from '../../../lib/realtime';

export type WebSocketStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR';

export interface ProcurementSocketEvent {
  type: string;
  requirementId?: number | string;
  procurementId?: number | string;
  responseId?: number;
  offeredPrice?: number;
  sellerOrgId?: number | null;
  status?: string;
  updatedBy?: string;
  timestamp?: string;
}

export const useProcurementRealtime = (procurementId: string | number | undefined | null) => {
  const [status, setStatus] = useState<WebSocketStatus>('DISCONNECTED');
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);

  const cleanId = procurementId !== undefined && procurementId !== null ? String(procurementId).trim() : '';

  useEffect(() => {
    if (!cleanId) return;

    let isMounted = true;

    const handleQuotationEvent = (data: ProcurementSocketEvent) => {
      console.log(`[Realtime] Received procurement event for #${cleanId}:`, data);

      // Invalidate all related procurement & quotation queries immediately
      void queryClient.invalidateQueries({ queryKey: ['rfq-buyer-responses-v2'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-bid'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-bids'] });
      void queryClient.invalidateQueries({ queryKey: ['buyer-procurements'] });
      void queryClient.invalidateQueries({ queryKey: ['buyerMyProcurements'] });
      void queryClient.invalidateQueries({ queryKey: ['marketplace-requirement'] });
      void queryClient.invalidateQueries({ queryKey: ['rfq-detail-req'] });
      void queryClient.invalidateQueries({ queryKey: ['rfq-detail-bid'] });
      void queryClient.invalidateQueries({ queryKey: ['rfq-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['quote-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });

      if (data.type === 'QUOTATION_SUBMITTED') {
        const priceFmt = data.offeredPrice
          ? `₹${Number(data.offeredPrice).toLocaleString('en-IN')}`
          : null;

        toast.success('New Quotation Submitted!', {
          description: priceFmt
            ? `A vendor submitted a quotation for ${priceFmt}. List refreshed automatically.`
            : 'A new quotation was just submitted and added to your view automatically.',
          duration: 5000,
        });
      } else if (data.type === 'QUOTATION_STATUS_CHANGED') {
        toast.info('Quotation Status Updated', {
          description: `Status changed to ${data.status || 'UPDATED'}.`,
          duration: 4000,
        });
      }
    };

    // --- Mode 1: Pusher (Production/Managed Cloud) ---
    if (isPusherAvailable()) {
      const pusher = getPusherClient();
      if (!pusher) return;

      setStatus('CONNECTING');
      const channelName = `procurement-${cleanId}`;
      const channel = pusher.subscribe(channelName);

      channel.bind('pusher:subscription_succeeded', () => {
        if (!isMounted) return;
        setStatus('CONNECTED');
        void queryClient.invalidateQueries({ queryKey: ['rfq-buyer-responses-v2'] });
      });

      channel.bind('pusher:subscription_error', () => {
        if (!isMounted) return;
        setStatus('ERROR');
      });

      channel.bind('QUOTATION_SUBMITTED', (data: ProcurementSocketEvent) => {
        if (!isMounted) return;
        handleQuotationEvent(data);
      });

      channel.bind('QUOTATION_STATUS_CHANGED', (data: ProcurementSocketEvent) => {
        if (!isMounted) return;
        handleQuotationEvent(data);
      });

      channel.bind('PROCUREMENT_UPDATED', (data: ProcurementSocketEvent) => {
        if (!isMounted) return;
        handleQuotationEvent(data);
      });

      return () => {
        isMounted = false;
        channel.unbind_all();
        pusher.unsubscribe(channelName);
      };
    }

    // --- Mode 2: Native WebSocket with Graceful Polling Fallback (Serverless/Vercel Safe) ---
    let pollInterval: NodeJS.Timeout | null = null;
    let failedAttempts = 0;

    const startPollingFallback = () => {
      setStatus('CONNECTED');
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        if (!isMounted) return;
        void queryClient.invalidateQueries({ queryKey: ['rfq-buyer-responses-v2'] });
      }, 15000);
    };

    const isServerless = typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('.now.sh')
    );

    if (isServerless) {
      // Vercel serverless functions do not support long-lived TCP WebSockets; use polling fallback
      startPollingFallback();
      return () => {
        isMounted = false;
        if (pollInterval) clearInterval(pollInterval);
      };
    }

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      setStatus(backoffRef.current > 1000 ? 'RECONNECTING' : 'CONNECTING');

      let baseUrl = getBaseUrl().replace(/\/$/, '');
      if (!baseUrl && typeof window !== 'undefined') {
        baseUrl = window.location.origin;
      } else if (baseUrl.startsWith('/') && typeof window !== 'undefined') {
        baseUrl = window.location.origin + baseUrl;
      }
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
              ws.send(JSON.stringify({ type: 'SUBSCRIBE_PROCUREMENT', procurementId: cleanId }));
            } else if (data.type === 'SUBSCRIBE_PROCUREMENT_SUCCESS') {
              void queryClient.invalidateQueries({ queryKey: ['rfq-buyer-responses-v2'] });
            } else if (
              data.type === 'QUOTATION_SUBMITTED' ||
              data.type === 'QUOTATION_STATUS_CHANGED' ||
              data.type === 'PROCUREMENT_UPDATED'
            ) {
              handleQuotationEvent(data);
            }
          } catch (err) {
            console.error('[WS Procurement] Failed to parse message', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          failedAttempts++;
          wsRef.current = null;

          if (failedAttempts >= 2) {
            // After 2 failures (e.g. serverless host without WS), gracefully fallback to polling
            startPollingFallback();
            return;
          }

          setStatus('DISCONNECTED');
          if (backoffRef.current < 30000) {
            backoffRef.current *= 2;
          }
          reconnectTimeoutRef.current = setTimeout(connect, backoffRef.current);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          failedAttempts++;
          if (failedAttempts >= 2) {
            startPollingFallback();
          } else {
            setStatus('ERROR');
          }
        };
      } catch {
        startPollingFallback();
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE_PROCUREMENT', procurementId: cleanId }));
        }
        wsRef.current.close();
      }
    };
  }, [cleanId, queryClient]);

  return status;
};
