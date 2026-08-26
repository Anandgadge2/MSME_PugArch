import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getBaseUrl } from '../../../lib/api';
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

export const useDisputeWebSocket = (disputeId: number | undefined) => {
  const [status, setStatus] = useState<WebSocketStatus>('DISCONNECTED');
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000); // Start with 1 second

  useEffect(() => {
    if (!disputeId) return;

    let isMounted = true;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      
      setStatus(backoffRef.current > 1000 ? 'RECONNECTING' : 'CONNECTING');

      let baseUrl = getBaseUrl();
      if (!baseUrl && typeof window !== 'undefined') {
        baseUrl = window.location.origin;
      }
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/ws';
      console.log(`[WS] Connecting to ${wsUrl} for dispute ${disputeId}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WS] Connection opened. Waiting for automatic HttpOnly cookie authentication...`);
        // The backend reads the token from the HttpOnly cookie automatically.
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data) as DisputeSocketEvent;
          
          if (data.type === 'AUTH_SUCCESS') {
            console.log(`[WS] Authentication successful. Subscribing to dispute ${disputeId}...`);
            setStatus('CONNECTED');
            backoffRef.current = 1000; // Reset backoff on successful connection
            ws.send(JSON.stringify({ type: 'SUBSCRIBE', disputeId }));
          } else if (data.type === 'ERROR') {
            console.error(`[WS] Server error:`, data.message);
          }

          if (data.type === 'SUBSCRIBE_SUCCESS') {
            console.log(`[WS] Subscription to dispute ${disputeId} successful.`);
            // Refetch to sync state immediately upon successful subscribe
            queryClient.invalidateQueries({ queryKey: ['disputes', 'detail', disputeId] });
          }

          if (data.type === 'DISPUTE_MESSAGE_CREATED' && data.disputeId === disputeId) {
            console.log(`[WS] Received new message for dispute ${disputeId}:`, data.message);
            queryClient.setQueryData<DisputeDto>(['disputes', 'detail', disputeId], (oldData) => {
              if (!oldData) return oldData;
              // Deduplicate by checking if message ID already exists
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
                status: data.status as any,
                statusEnum: data.status as any
              };
            });
          }
          
          if (data.type === 'DISPUTE_EVIDENCE_ADDED' && data.disputeId === disputeId) {
             queryClient.invalidateQueries({ queryKey: ['disputes', 'detail', disputeId] });
          }

        } catch (error) {
          console.error('Failed to parse WebSocket message', error);
        }
      };

      ws.onclose = (event) => {
        if (!isMounted) return;
        console.log(`[WS] Connection closed (code: ${event.code}, reason: ${event.reason}). Reconnecting...`);
        setStatus('DISCONNECTED');
        wsRef.current = null;
        
        // Exponential backoff reconnect
        if (backoffRef.current < 30000) {
          backoffRef.current *= 2;
        }
        reconnectTimeoutRef.current = setTimeout(connect, backoffRef.current);
      };

      ws.onerror = (error) => {
        if (!isMounted) return;
        console.error(`[WS] Connection error:`, error);
        setStatus('ERROR');
      };
    };

    connect();

    return () => {
      isMounted = false;
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
