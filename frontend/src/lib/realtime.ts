import Pusher from 'pusher-js';
import { getBaseUrl } from './api';

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
          fetch(authEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              socket_id: params.socketId,
              channel_name: params.channelName,
            }),
          })
            .then(async (res) => {
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
