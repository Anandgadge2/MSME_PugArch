'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    if (typeof window === 'undefined') {
      return { isOnline: true, isSlowConnection: false, effectiveType: '4g' };
    }
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    const isSlow = conn
      ? ['slow-2g', '2g'].includes(conn.effectiveType) || (typeof conn.rtt === 'number' && conn.rtt > 1200)
      : false;

    return {
      isOnline: navigator.onLine !== false,
      isSlowConnection: Boolean(isSlow),
      effectiveType: conn?.effectiveType || 'unknown',
      rtt: conn?.rtt,
      downlink: conn?.downlink,
      saveData: conn?.saveData,
    };
  });

  const wasOfflineRef = useRef(false);
  const warnedSlowRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        toast.success('Connection restored!', {
          id: 'network-status',
          description: 'You are back online. Refreshing marketplace data...',
          duration: 4000,
        });
      }
    };

    const handleOffline = () => {
      wasOfflineRef.current = true;
      setStatus((prev) => ({ ...prev, isOnline: false }));
      toast.error('Internet connection lost', {
        id: 'network-status',
        description: 'Operating in offline read mode. Previously loaded data remains accessible.',
        duration: 8000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (conn) {
      const handleConnectionChange = () => {
        const isSlow =
          ['slow-2g', '2g'].includes(conn.effectiveType) ||
          (typeof conn.rtt === 'number' && conn.rtt > 1200);

        setStatus({
          isOnline: navigator.onLine !== false,
          isSlowConnection: Boolean(isSlow),
          effectiveType: conn.effectiveType || 'unknown',
          rtt: conn.rtt,
          downlink: conn.downlink,
          saveData: conn.saveData,
        });

        if (isSlow && !warnedSlowRef.current) {
          warnedSlowRef.current = true;
          toast.warning('Weak internet connection detected', {
            id: 'network-speed-warning',
            description: 'Data-saver mode active. High-resolution media will load progressively.',
            duration: 6000,
          });
        }
      };

      conn.addEventListener('change', handleConnectionChange);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        conn.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
