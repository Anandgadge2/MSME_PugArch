import { COOKIE_SESSION_TOKEN, getCookieValue } from './auth';

export const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (process.env.NEXT_PUBLIC_BACKEND_PORT) {
        return `${protocol}//${hostname}:${process.env.NEXT_PUBLIC_BACKEND_PORT}`;
      }
      const parsedPort = parseInt(port, 10);
      if (!isNaN(parsedPort) && parsedPort >= 3000 && parsedPort <= 3010) {
        const backendPort = 5000 + (parsedPort - 3000);
        return `${protocol}//${hostname}:${backendPort}`;
      }
      return `${protocol}//${hostname}:5000`;
    }
  }

  const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  return rawBaseUrl;
};

export const BASE_URL = getBaseUrl().replace(/\/$/, '');
// Custom GET cache logic has been removed to allow TanStack Query to manage cache lifecycle exclusively.

const resolveUrl = (endpoint: string) => {
  if (endpoint.startsWith('http')) return endpoint;

  // On Vercel, BASE_URL is intentionally empty — all /api/* requests are
  // same-origin and proxied to the backend via Next.js rewrites.
  // In local dev, BASE_URL is the backend URL (e.g. http://localhost:5000).
  return `${BASE_URL}${endpoint}`;
};

export const resolveMediaUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const gcsMatch = trimmed.match(/^https?:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/);
    if (gcsMatch && !trimmed.includes('X-Goog-Algorithm')) {
      return `${BASE_URL}/api/files/raw/${gcsMatch[1]}`;
    }
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (cleanPath.startsWith('/banners/') || cleanPath.startsWith('/categories/')) {
    return `${BASE_URL}/api/files/raw${cleanPath}`;
  }
  if (cleanPath.startsWith('/org-logos/') || cleanPath.startsWith('/products/')) {
    return cleanPath;
  }
  return `${BASE_URL}${cleanPath}`;
};

export const readJsonResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await response.text();
    const preview = body.trim().slice(0, 80);
    throw new Error(
      preview.startsWith('<')
        ? 'Backend API returned HTML instead of JSON. Check NEXT_PUBLIC_API_URL.'
        : 'Backend API returned a non-JSON response.'
    );
  }

  return response.json();
};

export const unwrapApiData = <T = any>(body: any): T => {
  if (body && typeof body === 'object' && 'data' in body) return body.data as T;
  return body as T;
};

const normalizeHeaders = (headers: HeadersInit | undefined, body?: BodyInit | null) => {
  const next: Record<string, string> = { ...(headers as any) };
  const auth = next.Authorization || next.authorization || '';
  if (/^Bearer\s*(null|undefined|cookie-session)?$/i.test(auth.trim()) || auth.trim() === `Bearer ${COOKIE_SESSION_TOKEN}`) {
    delete next.Authorization;
    delete next.authorization;
  }
  if (body instanceof FormData) {
    delete next['Content-Type'];
    delete next['content-type'];
    delete next['CONTENT-TYPE'];
  } else if (!next['Content-Type'] && !next['content-type']) {
    next['Content-Type'] = 'application/json';
  }
  const csrfToken = getCookieValue('csrfToken');
  if (csrfToken && !next['X-CSRF-Token']) {
    next['X-CSRF-Token'] = csrfToken;
  }
  return next;
};

const shouldDispatchUnauthorized = (endpoint: string) =>
  ![
    '/api/auth/me',
    '/api/auth/refresh',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/notifications',
  ].some((path) => endpoint.startsWith(path));

const isUnsafeMethod = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

const isCsrfFailure = async (response: Response) => {
  if (response.status !== 403) return false;
  try {
    const body = await response.clone().json();
    const code = String(body?.code || body?.errorCode || body?.data?.code || body?.data?.errorCode || '');
    const message = String(body?.message || body?.error || '');
    return code === 'CSRF_TOKEN_INVALID' || /csrf/i.test(message);
  } catch {
    return false;
  }
};

const refreshSessionCookies = async () => {
  const response = await fetch(resolveUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: normalizeHeaders(undefined, null),
    body: '{}',
  });
  return response.ok;
};

const networkErrorResponse = (error: unknown) => {
  const detailMsg = error instanceof Error ? error.message : String(error || '');
  const message = detailMsg && !detailMsg.toLowerCase().includes('failed to fetch')
    ? `Request failed: ${detailMsg}`
    : 'Unable to reach the backend API. Please check that the backend server is running.';
  return new Response(
    JSON.stringify({
      success: false,
      message,
      code: 'NETWORK_ERROR',
      detail: detailMsg,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    },
  );
};

const clearApiCache = (matcher?: string) => {
  // Legacy cache clear stub
};

const invalidatePrefixFor = (endpoint: string) => {
  // Legacy cache invalidate stub
};

export const api = {
  fetch: (endpoint: string, options: RequestInit & { skipCache?: boolean } = {}) => {
    const url = resolveUrl(endpoint);
    const method = (options.method || 'GET').toUpperCase();
    const headers = normalizeHeaders(options.headers, options.body as BodyInit | null);

    const sendRequest = (requestHeaders: Record<string, string>) => fetch(url, {
      credentials: 'include',
      ...options,
      headers: requestHeaders,
    });

    const request = sendRequest(headers).then(async (response) => {
      if (isUnsafeMethod(method) && await isCsrfFailure(response)) {
        const refreshed = await refreshSessionCookies().catch(() => false);
        if (refreshed) {
          const retryHeaders = normalizeHeaders(options.headers, options.body as BodyInit | null);
          response = await sendRequest(retryHeaders);
        }
      }

      if (response.status === 401 && shouldDispatchUnauthorized(endpoint)) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      }
      if (response.status === 503 && !endpoint.includes('/health')) {
        if (typeof window !== 'undefined' && !window.location.pathname.includes('503')) {
          window.location.href = '/503.html';
        }
      }
      
      return response;
    }).catch(networkErrorResponse);

    return request;
  },

  get: (endpoint: string, options: RequestInit & { skipCache?: boolean } = {}) =>
    api.fetch(endpoint, { ...options, method: 'GET' }),

  post: (endpoint: string, body: any, options: RequestInit = {}) =>
    api.fetch(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    }),

  put: (endpoint: string, body: any, options: RequestInit = {}) =>
    api.fetch(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    }),

  patch: (endpoint: string, body: any, options: RequestInit = {}) =>
    api.fetch(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body)
    }),

  delete: (endpoint: string, options: RequestInit = {}) =>
    api.fetch(endpoint, { ...options, method: 'DELETE' }),

  peek: (endpoint: string, options: RequestInit = {}): any => {
    // Legacy API cache peek stub
    return null;
  },

  invalidate: clearApiCache,
};
