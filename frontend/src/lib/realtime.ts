import Pusher from 'pusher-js';
import { getBaseUrl } from './api';
import { COOKIE_SESSION_TOKEN, getCookieValue, getStoredToken } from './auth';

const getPusherKey = (): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_PUSHER_KEY || (process.env as any).VITE_PUSHER_KEY || '';
  }
  return '';
};

const getPusherCluster = (): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_PUSHER_CLUSTER || (process.env as any).VITE_PUSHER_CLUSTER || 'ap2';
  }
  return 'ap2';
};

let pusherInstance: Pusher | null = null;

export const isPusherAvailable = (): boolean => {
  return typeof window !== 'undefined' && Boolean(getPusherKey());
};

export const disconnectPusher = (): void => {
  if (pusherInstance) {
    try {
      pusherInstance.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
    pusherInstance = null;
  }
};

export const getPusherClient = (): Pusher | null => {
  if (typeof window === 'undefined') return null;

  const key = getPusherKey();
  if (!key) return null;

  if (!pusherInstance) {
    let baseUrl = getBaseUrl().replace(/\/$/, '');
    if (!baseUrl && typeof window !== 'undefined') {
      baseUrl = window.location.origin;
    }
    const authEndpoint = `${baseUrl}/api/pusher/auth`;

    pusherInstance = new Pusher(key, {
      cluster: getPusherCluster(),
      forceTLS: true,
      channelAuthorization: {
        endpoint: authEndpoint,
        transport: 'ajax',
        customHandler: (params, callback) => {
          const token = getStoredToken();
          const hasAuthCookie = typeof document !== 'undefined' && document.cookie.includes('token=');

          // Guard: Do not attempt server authorization if no session credentials exist
          if (!token && !hasAuthCookie) {
            return callback(new Error('User is not authenticated for private realtime channel'), null);
          }

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (token && token !== COOKIE_SESSION_TOKEN && token !== 'null' && token !== 'undefined') {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const csrfToken = getCookieValue('csrfToken');
          if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
          }

          fetch(authEndpoint, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              socket_id: params.socketId,
              channel_name: params.channelName,
            }),
          })
            .then(async (res) => {
              if (res.status === 401) {
                return callback(new Error('Session expired or unauthorized for realtime channel'), null);
              }
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                return callback(new Error(errorData.message || 'Pusher authorization failed'), null);
              }
              const data = await res.json();
              callback(null, data);
            })
            .catch((err) => callback(err, null));
        },
      },
    });
  }

  return pusherInstance;
};

