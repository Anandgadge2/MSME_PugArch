import { api, unwrapApiData, BASE_URL, resolveMediaUrl } from './api';
import { getCookieValue } from './auth';
import { triggerBrowserDownload, canInitiateDownload } from './downloadManager';

export type DocumentPreviewMode = 'image' | 'pdf' | 'office' | 'google';

export type DocumentPreview = {
  label: string;
  url: string;
  mode: DocumentPreviewMode;
  fileId?: number;
  originalUrl?: string;
};

const getAbsoluteApiUrl = (endpoint: string) => {
  if (!endpoint) return '';
  const resolved = resolveMediaUrl(endpoint) || endpoint;
  if (resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('data:') || resolved.startsWith('blob:')) {
    return resolved;
  }
  return `${BASE_URL}${resolved.startsWith('/') ? '' : '/'}${resolved}`;
};

export const getDocumentPreviewMode = (url: string, contentType = '', extension = ''): DocumentPreviewMode => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  const ext = extension || cleanUrl.match(/\.([a-z0-9]+)$/)?.[1] || '';

  if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (contentType.toLowerCase().includes('application/pdf') || ext === 'pdf') return 'pdf';
  if (
    contentType.toLowerCase().includes('word') ||
    contentType.toLowerCase().includes('excel') ||
    contentType.toLowerCase().includes('powerpoint') ||
    ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)
  ) return 'office';
  return 'google';
};

export const detectBlobMimeType = async (blob: Blob): Promise<{ mime: string; mode: DocumentPreviewMode; isValid: boolean }> => {
  if (!blob || blob.size === 0) {
    return { mime: '', mode: 'google', isValid: false };
  }
  try {
    const slice = blob.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PDF magic bytes: %PDF (0x25, 0x50, 0x44, 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { mime: 'application/pdf', mode: 'pdf', isValid: true };
    }
    // PNG magic bytes: \x89PNG (0x89, 0x50, 0x4E, 0x47)
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return { mime: 'image/png', mode: 'image', isValid: true };
    }
    // JPEG magic bytes: 0xFF 0xD8 0xFF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return { mime: 'image/jpeg', mode: 'image', isValid: true };
    }
    // WebP magic bytes: RIFF....WEBP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return { mime: 'image/webp', mode: 'image', isValid: true };
    }
    // Text / HTML / JSON error response (starts with < or { or [)
    if (bytes[0] === 0x3C || bytes[0] === 0x7B || bytes[0] === 0x5B) {
      return { mime: 'application/json', mode: 'google', isValid: false };
    }
  } catch {
    // fallback
  }
  return { mime: blob.type || 'application/octet-stream', mode: 'google', isValid: true };
};

interface CachedPreviewEntry {
  preview: DocumentPreview;
  blob?: Blob;
  expiresAt: number;
}

class SignedUrlCacheManager {
  private cache = new Map<string, CachedPreviewEntry>();
  private readonly TTL_MS = 15 * 60 * 1000; // 15-minute TTL for cloud signed URLs
  private readonly MAX_ENTRIES = 250;

  private makeKey(fileId: number | string, hasSession: boolean): string {
    return `${hasSession ? 'auth' : 'pub'}_${fileId}`;
  }

  get(fileId: number | string, hasSession: boolean): DocumentPreview | null {
    const key = this.makeKey(fileId, hasSession);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // If the cached preview was backed by a Blob, generate a fresh live Object URL on each access.
    // This completely prevents "revoked blob URL" errors when closing and re-opening the preview modal.
    if (entry.blob) {
      const freshBlobUrl = URL.createObjectURL(entry.blob);
      return {
        ...entry.preview,
        url: freshBlobUrl
      };
    }

    // If it's a bare blob: URL without the backing blob, it may be revoked; purge and return null.
    if (entry.preview.url?.startsWith('blob:')) {
      this.cache.delete(key);
      return null;
    }

    return entry.preview;
  }

  set(fileId: number | string, hasSession: boolean, preview: DocumentPreview, blob?: Blob): void {
    if (!preview.url || !preview.url.trim()) {
      return;
    }

    if (this.cache.size >= this.MAX_ENTRIES) {
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 50);
      keysToDelete.forEach((k) => this.cache.delete(k));
    }

    // Never cache a bare blob: string without the underlying Blob object
    if (preview.url?.startsWith('blob:') && !blob) {
      return;
    }

    const key = this.makeKey(fileId, hasSession);
    this.cache.set(key, {
      preview,
      blob,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  delete(fileId: number | string, hasSession?: boolean): void {
    if (hasSession !== undefined) {
      this.cache.delete(this.makeKey(fileId, hasSession));
    } else {
      this.cache.delete(this.makeKey(fileId, true));
      this.cache.delete(this.makeKey(fileId, false));
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const signedUrlCache = new SignedUrlCacheManager();
const inFlightPreviews = new Map<string, Promise<DocumentPreview>>();

const predecodeImage = (url: string) => {
  if (typeof window === 'undefined' || !url) return;
  const isImg = url.match(/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i) || url.includes('image/');
  if (isImg) {
    const img = new Image();
    img.src = url;
    if ('decode' in img) {
      img.decode().catch(() => undefined);
    }
  }
};

/**
 * Proactively pre-warms the signed URL and image/PDF stream in the background
 * during the 150-300ms hover/focus window before the user completes their click.
 */
export const prewarmFileAssetPreview = (fileAsset: any, label = 'Document'): void => {
  if (!fileAsset) return;
  getFileAssetPreview(fileAsset, label).catch(() => undefined);
};

export const getFileAssetPreview = async (fileAsset: any, label = 'Document'): Promise<DocumentPreview> => {
  // 1. If local File object is available, create instant local blob
  if (fileAsset?.file instanceof File) {
    const blobUrl = URL.createObjectURL(fileAsset.file);
    const fileName = fileAsset.fileName || fileAsset.file.name || label;
    return {
      label: fileName,
      url: blobUrl,
      mode: getDocumentPreviewMode(blobUrl, fileAsset.file.type || '', fileName.split('.').pop() || '')
    };
  }

  let fileId: number | null = null;
  if (typeof fileAsset === 'number') {
    fileId = fileAsset;
  } else if (typeof fileAsset === 'string' && /^\d+$/.test(fileAsset)) {
    fileId = Number(fileAsset);
  } else if (fileAsset && typeof fileAsset === 'object') {
    if (fileAsset.fileAssetId && !isNaN(Number(fileAsset.fileAssetId))) {
      fileId = Number(fileAsset.fileAssetId);
    } else if (fileAsset.fileId && !isNaN(Number(fileAsset.fileId))) {
      fileId = Number(fileAsset.fileId);
    } else if (typeof fileAsset.id === 'number' && !isNaN(fileAsset.id)) {
      fileId = fileAsset.id;
    } else if (typeof fileAsset.id === 'string' && /^\d+$/.test(fileAsset.id)) {
      fileId = Number(fileAsset.id);
    }
  }

  const fallbackUrl = typeof fileAsset === 'object'
    ? (fileAsset?.viewUrl || fileAsset?.downloadUrl || fileAsset?.fileUrl || fileAsset?.url || fileAsset?.signedUrl || fileAsset?.documentUrl)
    : null;
  const absoluteFallbackUrl = fallbackUrl ? getAbsoluteApiUrl(fallbackUrl) : '';

  if (!fileId && fallbackUrl) {
    const match = String(fallbackUrl).match(/\/api\/(?:public\/)?files\/(\d+)/);
    if (match && match[1]) {
      const parsedId = Number(match[1]);
      if (Number.isFinite(parsedId) && parsedId > 0) {
        fileId = parsedId;
      }
    }
  }

  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('msme_auth_token')) : null;
  const isRealToken = Boolean(token && token !== 'null' && token !== 'undefined' && token !== 'cookie-session');
  const hasSession = Boolean(token || getCookieValue('csrfToken'));

  // Check in-memory cache first for instant (< 1ms) resolution
  if (fileId) {
    const cached = signedUrlCache.get(fileId, hasSession);
    if (cached) {
      if (cached.mode === 'image') predecodeImage(cached.url);
      return cached;
    }

    const inFlightKey = `${hasSession ? 'auth' : 'pub'}_${fileId}`;
    const inFlight = inFlightPreviews.get(inFlightKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const authHeaders: Record<string, string> = {};
  if (isRealToken) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }
  const authQuery = isRealToken ? `?token=${encodeURIComponent(token!)}` : '';

  const resolvePreview = async (): Promise<DocumentPreview> => {
    // 2. If we have a file ID, fetch direct signed URL first for fast cloud CDN streaming
    if (fileId) {
      const signedUrlEndpoint = hasSession ? `/api/files/${fileId}/signed-url` : `/api/public/files/${fileId}/signed-url`;
      try {
        const res = await api.fetch(signedUrlEndpoint, {
          method: 'GET',
          headers: authHeaders,
          skipCache: true
        });

        if (res.ok) {
          const body = await res.json().catch(() => null);
          const data = unwrapApiData<any>(body);
          if (data?.signedUrl) {
            const isRealSignedUrl =
              data.signedUrl.includes('X-Goog-Algorithm') ||
              data.signedUrl.includes('Signature=') ||
              data.signedUrl.includes('GoogleAccessId=');

            // Only use direct cloud CDN streaming if it's an authentic, cryptographically pre-signed cloud URL
            if (isRealSignedUrl && (data.signedUrl.startsWith('http://') || data.signedUrl.startsWith('https://'))) {
              const previewUrl = data.signedUrl;
              const result: DocumentPreview = {
                label,
                url: previewUrl,
                mode: getDocumentPreviewMode(previewUrl, data.file?.mimeType || fileAsset?.mimeType || ''),
                fileId: fileId ?? undefined,
                originalUrl: absoluteFallbackUrl || previewUrl
              };
              signedUrlCache.set(fileId, hasSession, result);
              if (result.mode === 'image') predecodeImage(result.url);
              return result;
            }
          }
        }
      } catch {
        // Fallback to viewEndpoint below
      }

      // Fallback / Private documents: stream binary Blob via authenticated API with bearer token
      const viewEndpoint = hasSession ? `/api/files/${fileId}/view` : `/api/public/files/${fileId}/view`;
      const viewEndpointWithAuth = `${viewEndpoint}${authQuery}`;
      try {
        let res = await api.fetch(viewEndpointWithAuth, {
          method: 'GET',
          headers: authHeaders,
          skipCache: true
        });

        // In local development, if cross-origin cookie issue occurs, try same-origin rewrite proxy
        if (!res.ok && typeof window !== 'undefined' && window.location.origin.includes('localhost:3000')) {
          try {
            res = await fetch(`/proxy${viewEndpointWithAuth}`, {
              method: 'GET',
              headers: authHeaders,
              credentials: 'include'
            });
          } catch {}
        }

        if (res.ok) {
          const contentType = res.headers.get('content-type') || fileAsset?.mimeType || '';
          const rawBlob = await res.blob();
          const fileName = fileAsset?.fileName || label;
          const detected = await detectBlobMimeType(rawBlob);

          if (!detected.isValid) {
            return {
              label,
              url: '',
              mode: 'google',
              fileId: fileId ?? undefined,
              originalUrl: absoluteFallbackUrl || `/api/files/${fileId}/view${authQuery}`
            };
          }

          const finalMime = detected.mime || contentType || rawBlob.type || 'application/octet-stream';
          const blob = rawBlob.type === finalMime ? rawBlob : new Blob([rawBlob], { type: finalMime });
          const blobUrl = URL.createObjectURL(blob);
          const finalMode = (detected.mode === 'image' || detected.mode === 'pdf')
            ? detected.mode
            : getDocumentPreviewMode(blobUrl, finalMime, fileName.split('.').pop() || '');

          const result: DocumentPreview = {
            label,
            url: blobUrl,
            mode: finalMode,
            fileId: fileId ?? undefined,
            originalUrl: absoluteFallbackUrl || `/api/files/${fileId}/view${authQuery}`
          };
          signedUrlCache.set(fileId, hasSession, result, blob);
          if (result.mode === 'image') predecodeImage(result.url);
          return result;
        }
      } catch {
        // Fallback below
      }
    }

    // 3. If fallback URL is present, try fetching its blob or resolving it
    if (absoluteFallbackUrl) {
      const isImageOrPdf = /\.(png|jpe?g|webp|gif|svg|pdf)($|\?)/i.test(absoluteFallbackUrl) ||
        fileAsset?.mimeType?.startsWith('image/') ||
        fileAsset?.mimeType === 'application/pdf';

      if (isImageOrPdf) {
        try {
          const res = await api.fetch(absoluteFallbackUrl, {
            method: 'GET',
            headers: authHeaders,
            skipCache: true
          });
          if (res.ok) {
            const contentType = res.headers.get('content-type') || fileAsset?.mimeType || '';
            const rawBlob = await res.blob();
            const fileName = fileAsset?.fileName || label;
            const detected = await detectBlobMimeType(rawBlob);

            if (!detected.isValid) {
              return {
                label,
                url: '',
                mode: 'google',
                fileId: fileId ?? undefined,
                originalUrl: absoluteFallbackUrl
              };
            }

            const finalMime = detected.mime || contentType || rawBlob.type || 'application/octet-stream';
            const blob = rawBlob.type === finalMime ? rawBlob : new Blob([rawBlob], { type: finalMime });
            const blobUrl = URL.createObjectURL(blob);
            const authParam = (isRealToken && absoluteFallbackUrl.includes('/api/files/'))
              ? (absoluteFallbackUrl.includes('?') ? `&token=${encodeURIComponent(token!)}` : `?token=${encodeURIComponent(token!)}`)
              : '';
            const finalMode = (detected.mode === 'image' || detected.mode === 'pdf')
              ? detected.mode
              : getDocumentPreviewMode(blobUrl, finalMime, fileName.split('.').pop() || '');
            const result: DocumentPreview = {
              label,
              url: blobUrl,
              mode: finalMode,
              fileId: fileId ?? undefined,
              originalUrl: `${absoluteFallbackUrl}${authParam}`
            };
            if (fileId) signedUrlCache.set(fileId, hasSession, result, blob);
            if (result.mode === 'image') predecodeImage(result.url);
            return result;
          }
        } catch {
          // Fallback to absolute url directly
        }
      }

      const mode = getDocumentPreviewMode(absoluteFallbackUrl, fileAsset?.mimeType || '');
      const result: DocumentPreview = {
        label,
        url: mode === 'pdf' ? '' : absoluteFallbackUrl,
        mode,
        fileId: fileId ?? undefined,
        originalUrl: absoluteFallbackUrl
      };
      if (fileId && result.url) signedUrlCache.set(fileId, hasSession, result);
      if (result.mode === 'image' && result.url) predecodeImage(result.url);
      return result;
    }

    throw new Error('Document file is not uploaded on server.');
  };

  if (fileId) {
    const inFlightKey = `${hasSession ? 'auth' : 'pub'}_${fileId}`;
    const promise = resolvePreview().finally(() => {
      inFlightPreviews.delete(inFlightKey);
    });
    inFlightPreviews.set(inFlightKey, promise);
    return promise;
  }

  return resolvePreview();
};

export const openFileAsset = async (fileAsset: any, label = 'Document') => {
  let fileId: number | null = null;
  if (typeof fileAsset === 'number') {
    fileId = fileAsset;
  } else if (typeof fileAsset === 'string' && /^\d+$/.test(fileAsset)) {
    fileId = Number(fileAsset);
  } else if (fileAsset && typeof fileAsset === 'object') {
    if (fileAsset.fileAssetId && !isNaN(Number(fileAsset.fileAssetId))) {
      fileId = Number(fileAsset.fileAssetId);
    } else if (fileAsset.fileId && !isNaN(Number(fileAsset.fileId))) {
      fileId = Number(fileAsset.fileId);
    } else if (typeof fileAsset.id === 'number' && !isNaN(fileAsset.id)) {
      fileId = fileAsset.id;
    } else if (typeof fileAsset.id === 'string' && /^\d+$/.test(fileAsset.id)) {
      fileId = Number(fileAsset.id);
    }
  }

  const fallbackUrl = typeof fileAsset === 'object'
    ? (fileAsset?.viewUrl || fileAsset?.downloadUrl || fileAsset?.fileUrl || fileAsset?.url || fileAsset?.signedUrl || fileAsset?.documentUrl)
    : null;
  const rawAbsoluteFallbackUrl = fallbackUrl ? getAbsoluteApiUrl(fallbackUrl) : '';
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('msme_auth_token')) : null;
  const absoluteFallbackUrl = (token && rawAbsoluteFallbackUrl && (rawAbsoluteFallbackUrl.includes('/api/files/') || rawAbsoluteFallbackUrl.includes('/api/public/files/')) && !rawAbsoluteFallbackUrl.includes('token='))
    ? `${rawAbsoluteFallbackUrl}${rawAbsoluteFallbackUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    : rawAbsoluteFallbackUrl;

  if (!fileId && fallbackUrl) {
    const match = String(fallbackUrl).match(/\/api\/(?:public\/)?files\/(\d+)/);
    if (match && match[1]) {
      const urlFileId = Number(match[1]);
      if (Number.isFinite(urlFileId) && urlFileId > 0) {
        fileId = urlFileId;
      }
    }
  }

  let previewWindow: Window | null = null;
  try {
    previewWindow = window.open('about:blank', '_blank');
  } catch {
    previewWindow = null;
  }

  if (previewWindow) {
    try {
      previewWindow.document.title = label;
    } catch {
      // Ignore initial DOM access restrictions
    }
  }

  try {
    const navigateWindowSafely = (targetUrl: string) => {
      if (!targetUrl) return;
      if (previewWindow && !previewWindow.closed) {
        try {
          previewWindow.location.replace(targetUrl);
          try { previewWindow.opener = null; } catch {}
          return;
        } catch {
          try {
            previewWindow.location.href = targetUrl;
            try { previewWindow.opener = null; } catch {}
            return;
          } catch {
            // If direct href assignment fails, fallback below
          }
        }
      }
      try {
        const a = document.createElement('a');
        a.href = targetUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { document.body.removeChild(a); } catch {}
        }, 100);
      } catch {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    };

    if (!fileId) {
      if (!absoluteFallbackUrl) throw new Error('Document file is not uploaded on server.');
      navigateWindowSafely(absoluteFallbackUrl);
      return;
    }

    const hasSession = Boolean(token || getCookieValue('csrfToken'));
    const cached = signedUrlCache.get(fileId, hasSession);
    if (cached?.url) {
      navigateWindowSafely(cached.url);
      return;
    }

    const authHeaders: Record<string, string> = {};
    if (token && token !== 'null' && token !== 'undefined') {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    const signedUrlEndpoint = hasSession ? `/api/files/${fileId}/signed-url` : `/api/public/files/${fileId}/signed-url`;
    const viewEndpoint = hasSession ? `/api/files/${fileId}/view` : `/api/public/files/${fileId}/view`;

    // Try fetching signed URL from backend
    try {
      const res = await api.fetch(signedUrlEndpoint, {
        method: 'GET',
        headers: authHeaders,
        skipCache: true
      });

      if (res.ok) {
        const body = await res.json().catch(() => null);
        const data = unwrapApiData<any>(body);
        if (data?.signedUrl) {
          const isRealSignedUrl = data.signedUrl.includes('X-Goog-Algorithm') || data.signedUrl.includes('Signature=');
          const previewUrl = isRealSignedUrl ? data.signedUrl : (resolveMediaUrl(data.signedUrl) || getAbsoluteApiUrl(data.signedUrl) || data.signedUrl);
          if (previewUrl && (previewUrl.startsWith('http://') || previewUrl.startsWith('https://') || previewUrl.startsWith('/'))) {
            signedUrlCache.set(fileId, hasSession, {
              label,
              url: previewUrl,
              mode: getDocumentPreviewMode(previewUrl, data.file?.mimeType || fileAsset?.mimeType || '')
            });
            navigateWindowSafely(previewUrl);
            return;
          }
        }
      }
    } catch {
      // Gracefully ignore and fallback
    }

    // Fallback to fetching blob from view endpoint
    let res: Response | null = null;
    try {
      res = await api.fetch(viewEndpoint, {
        method: 'GET',
        headers: authHeaders,
        skipCache: true
      });
    } catch {
      res = null;
    }

    if (!res || !res.ok) {
      const fallbackTarget = absoluteFallbackUrl || (fileId ? getAbsoluteApiUrl(`/api/files/${fileId}/view${token ? `?token=${encodeURIComponent(token)}` : ''}`) : '');
      if (fallbackTarget) {
        navigateWindowSafely(fallbackTarget);
        return;
      }
      throw new Error('Document file is not uploaded on server.');
    }

    const contentType = res.headers.get('content-type') || fileAsset?.mimeType || '';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (previewWindow && !previewWindow.closed) {
      try {
        previewWindow.document.body.innerHTML = '';
        if (contentType.startsWith('image/')) {
          previewWindow.document.body.style.margin = '0';
          previewWindow.document.body.style.background = '#f1f5f9';
          previewWindow.document.body.style.display = 'flex';
          previewWindow.document.body.style.justifyContent = 'center';
          previewWindow.document.body.style.alignItems = 'center';
          previewWindow.document.body.style.minHeight = '100vh';
          const img = previewWindow.document.createElement('img');
          img.src = url;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100vh';
          img.style.objectFit = 'contain';
          img.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
          img.style.borderRadius = '8px';
          previewWindow.document.body.appendChild(img);
        } else if (contentType === 'application/pdf') {
          previewWindow.document.body.style.margin = '0';
          const iframe = previewWindow.document.createElement('iframe');
          iframe.src = url;
          iframe.style.width = '100%';
          iframe.style.height = '100vh';
          iframe.style.border = 'none';
          previewWindow.document.body.appendChild(iframe);
        } else {
          const link = previewWindow.document.createElement('a');
          link.href = url;
          link.download = fileAsset?.originalName || 'document';
          link.style.fontFamily = 'sans-serif';
          link.style.display = 'block';
          link.style.padding = '24px';
          link.style.textAlign = 'center';
          link.style.fontSize = '16px';
          link.style.fontWeight = 'bold';
          link.style.color = '#2563eb';
          link.style.textDecoration = 'none';
          link.innerText = 'Click here to download ' + (fileAsset?.originalName || 'document');
          previewWindow.document.body.appendChild(link);
          link.click();
        }
      } catch {
        previewWindow.location.href = url;
      }
    } else {
      navigateWindowSafely(url);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    if (previewWindow) previewWindow.close();
    throw err;
  }
};

const triggerDownloadBlob = (url: string, filename: string) => {
  triggerBrowserDownload(url, filename);
};

export const downloadFileAsset = async (fileAsset: any, fallbackName = 'document') => {
  let fileId: number | null = null;
  if (typeof fileAsset === 'number') {
    fileId = fileAsset;
  } else if (typeof fileAsset === 'string' && /^\d+$/.test(fileAsset)) {
    fileId = Number(fileAsset);
  } else if (fileAsset && typeof fileAsset === 'object') {
    if (fileAsset.fileAssetId && !isNaN(Number(fileAsset.fileAssetId))) {
      fileId = Number(fileAsset.fileAssetId);
    } else if (fileAsset.fileId && !isNaN(Number(fileAsset.fileId))) {
      fileId = Number(fileAsset.fileId);
    } else if (typeof fileAsset.id === 'number' && !isNaN(fileAsset.id)) {
      fileId = fileAsset.id;
    } else if (typeof fileAsset.id === 'string' && /^\d+$/.test(fileAsset.id)) {
      fileId = Number(fileAsset.id);
    }
  }

  const fileName = (typeof fileAsset === 'object' && (fileAsset?.originalName || fileAsset?.name || fileAsset?.fileName)) || fallbackName;
  const lockKey = `file-asset-${fileId || fileName}`;
  if (!canInitiateDownload(lockKey)) {
    return;
  }
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('msme_auth_token')) : null;
  const authHeaders: Record<string, string> = {};
  if (token && token !== 'null' && token !== 'undefined') {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  // 1. If local File object
  if (fileAsset?.file instanceof File) {
    const blobUrl = URL.createObjectURL(fileAsset.file);
    triggerDownloadBlob(blobUrl, fileName);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return;
  }

  // 2. If already a blob or data URL
  const existingUrl = typeof fileAsset === 'string' ? fileAsset : (fileAsset?.blobUrl || fileAsset?.url);
  if (existingUrl && (existingUrl.startsWith('blob:') || existingUrl.startsWith('data:'))) {
    triggerDownloadBlob(existingUrl, fileName);
    return;
  }

  // 3. If fileId is present, fetch blob via /api/files/:id/download or /api/files/:id/view with auth
  if (fileId) {
    const endpoints = [
      `/api/files/${fileId}/download`,
      `/api/files/${fileId}/view`,
      `/api/public/files/${fileId}/view`
    ];

    for (const ep of endpoints) {
      try {
        const res = await api.fetch(ep, {
          method: 'GET',
          headers: authHeaders,
          skipCache: true
        });
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          triggerDownloadBlob(blobUrl, fileName);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
          return;
        }
      } catch {}
    }
  }

  // 4. Try fallback URL
  const fallbackUrl = typeof fileAsset === 'object'
    ? (fileAsset?.downloadUrl || fileAsset?.viewUrl || fileAsset?.fileUrl || fileAsset?.url || fileAsset?.signedUrl || fileAsset?.documentUrl)
    : (typeof fileAsset === 'string' ? fileAsset : null);

  if (fallbackUrl) {
    const absoluteUrl = getAbsoluteApiUrl(fallbackUrl);
    try {
      const res = await api.fetch(absoluteUrl, {
        method: 'GET',
        headers: authHeaders,
        skipCache: true
      });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        triggerDownloadBlob(blobUrl, fileName);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }
    } catch {}

    const tokenParam = (token && (absoluteUrl.includes('/api/files/') || absoluteUrl.includes('/api/public/files/')) && !absoluteUrl.includes('token='))
      ? `${absoluteUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : '';
    triggerDownloadBlob(`${absoluteUrl}${tokenParam}`, fileName);
    return;
  }

  throw new Error('Document file is not uploaded on server.');
};

