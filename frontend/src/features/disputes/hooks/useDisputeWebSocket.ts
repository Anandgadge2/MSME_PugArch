import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getBaseUrl } from '../../../lib/api';
import { getPusherClient, isPusherAvailable } from '../../../lib/realtime';
import type { DisputeDto } from '../api';

export type WebSocketStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR';

interface DisputeSocketEvent {
  type: string;
  disputeId?: number;
  message?: any;
  status?: string;
  previousStatus?: string;
  updatedBy?: string;
  dispute?: any;
  evidence?: any;
}

let isDisputeWsSupported = true;

export const useDisputeWebSocket = (disputeId: number | undefined) => {
  const [status, setStatus] = useState<WebSocketStatus>('DISCONNECTED');
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);

  useEffect(() => {
    if (!disputeId) return;

    let isMounted = true;

    // --- Pusher Mode (Production & Supported Env) ---
    if (isPusherAvailable()) {
      const pusher = getPusherClient();
      if (!pusher) return;

      setStatus('CONNECTING');
      const channelName = `private-dispute-${disputeId}`;
      console.log(`[Pusher] Subscribing to channel ${channelName}`);
      const channel = pusher.subscribe(channelName);

      channel.bind('pusher:subscription_succeeded', () => {
        if (!isMounted) return;
        console.log(`[Pusher] Subscription succeeded for ${channelName}`);
        setStatus('CONNECTED');
        void queryClient.invalidateQueries({ queryKey: ['disputes', 'detail', disputeId] });
      });

      channel.bind('pusher:subscription_error', (statusError: any) => {
        if (!isMounted) return;
        console.error(`[Pusher] Subscription error for ${channelName}:`, statusError);
        setStatus('ERROR');
      });

      channel.bind('DISPUTE_MESSAGE_CREATED', (data: DisputeSocketEvent) => {
        if (!isMounted || !data.message) return;
        console.log(`[Pusher] Received DISPUTE_MESSAGE_CREATED for dispute ${disputeId}:`, data.message);
        queryClient.setQueryData<DisputeDto>(['disputes', 'detail', disputeId], (oldData) => {
          if (!oldData) return oldData;
          const exists = oldData.messages?.some(m => m.id === data.message.id);
          if (exists) return oldData;

          return {
            ...oldData,
            messages: [...(oldData.messages || []), data.message]
          };
        });
      });

      channel.bind('DISPUTE_STATUS_CHANGED', (data: DisputeSocketEvent) => {
        if (!isMounted || !data.status) return;
        console.log(`[Pusher] Received DISPUTE_STATUS_CHANGED for dispute ${disputeId}:`, data.status);
        queryClient.setQueryData<DisputeDto>(['disputes', 'detail', disputeId], (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            status: String(data.status).toLowerCase() as any,
            statusEnum: data.status as any
          };
        });
      });

      channel.bind('DISPUTE_EVIDENCE_ADDED', () => {
        if (!isMounted) return;
        console.log(`[Pusher] Received DISPUTE_EVIDENCE_ADDED for dispute ${disputeId}`);
        void queryClient.invalidateQueries({ queryKey: ['disputes', 'detail', disputeId] });
      });

      channel.bind('DISPUTE_UPDATED', () => {
        if (!isMounted) return;
        void queryClient.invalidateQueries({ queryKey: ['disputes', 'detail', disputeId] });
      });

      return () => {
        isMounted = false;
        console.log(`[Pusher] Unsubscribing from channel ${channelName}`);
        channel.unbind_all();
        pusher.unsubscribe(channelName);
      };
    }

    // --- Standard WebSocket with Serverless Polling Fallback ---
    let pollInterval: NodeJS.Timeout | null = null;
    let failedAttempts = 0;

    const startPollingFallback = () => {
      setStatus('CONNECTED');
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        if (!isMounted) return;
        void queryClient.invalidateQueries({ queryKey: ['disputes', 'detail', disputeId] });
      }, 15000);
    };

    let baseUrl = getBaseUrl().replace(/\/$/, '');
    if (!baseUrl && typeof window !== 'undefined') {
      baseUrl = window.location.origin;
    } else if (baseUrl.startsWith('/') && typeof window !== 'undefined') {
      baseUrl = window.location.origin + baseUrl;
    }

    const isServerless = typeof window !== 'undefined' && (
      baseUrl.includes('vercel.app') ||
      baseUrl.includes('.now.sh') ||
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('.now.sh') ||
      process.env.NODE_ENV === 'production' ||
      (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1'))
    );

    if (!isDisputeWsSupported || isServerless) {
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
            const data = JSON.parse(event.data) as DisputeSocketEvent;
            
            if (data.type === 'AUTH_SUCCESS') {
              setStatus('CONNECTED');
              backoffRef.current = 1000;
              ws.send(JSON.stringify({ type: 'SUBSCRIBE', disputeId }));
            } else if (data.type === 'ERROR') {
              console.error(`[WS] Server error:`, data.message);
            }

            if (data.type === 'SUBSCRIBE_SUCCESS') {
              void queryClient.invalidateQueries({ queryKey: ['disputes', 'detail', disputeId] });
            }

            if (data.type === 'DISPUTE_MESSAGE_CREATED' && data.disputeId === disputeId) {
              queryClient.setQueryData<DisputeDto>(['disputes', 'detail', disputeId], (oldData) => {
                if (!oldData) return oldData;
                const exists = oldData.messages?.some(m => m.id === data.message.id);
                if (exists) return oldData;
                
                return {
                  ...oldData,
                  messages: [...(oldData.messages || []), data.message]
                };
              });
            }

            if (data.type === 'DISPUTE_STATUS_CHANGED' && data.disputeId === disputeId) {
              queryClient.setQueryData<DisputeDto>(['disputes', 'detail', disputeId], (oldData) => {
                if (!oldData) return oldData;
                return {
                  ...oldData,
                  status: String(data.status).toLowerCase() as any,
                  statusEnum: data.status as any
                };
              });
            }
            
            if (data.type === 'DISPUTE_EVIDENCE_ADDED' && data.disputeId === disputeId) {
               void queryClient.invalidateQueries({ queryKey: ['disputes', 'detail', disputeId] });
            }

          } catch (error) {
            console.error('Failed to parse WebSocket message', error);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          failedAttempts++;
          wsRef.current = null;
          
          if (failedAttempts >= 2) {
            isDisputeWsSupported = false;
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
            isDisputeWsSupported = false;
            startPollingFallback();
          } else {
            setStatus('ERROR');
          }
        };
      } catch {
        isDisputeWsSupported = false;
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
          wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE', disputeId }));
        }
        wsRef.current.close();
      }
    };
  }, [disputeId, queryClient]);

  return status;
};
