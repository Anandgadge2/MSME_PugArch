import { api, unwrapApiData, BASE_URL, resolveMediaUrl } from './api';
import { getCookieValue } from './auth';

export type DocumentPreviewMode = 'image' | 'pdf' | 'office' | 'google';

export type DocumentPreview = {
  label: string;
  url: string;
  mode: DocumentPreviewMode;
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

  const fileName = typeof fileAsset === 'object' ? (fileAsset?.fileName || fileAsset?.originalName || fileAsset?.name || '') : '';
  const fileExt = (fileName || label || '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';

  if (typeof fileAsset === 'object' && fileAsset?.signedUrl) {
    return {
      label,
      url: fileAsset.signedUrl,
      mode: getDocumentPreviewMode(fileAsset.signedUrl, fileAsset?.mimeType || '', fileExt)
    };
  }

  const fallbackUrl = typeof fileAsset === 'object'
    ? (fileAsset?.fileUrl || fileAsset?.url || fileAsset?.signedUrl || fileAsset?.documentUrl)
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

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const hasSession = Boolean(token || getCookieValue('csrfToken'));
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  // 2. If we have a file ID, fetch directly from viewEndpoint for authenticated blob streaming
  if (fileId) {
    const viewEndpoint = hasSession ? `/api/files/${fileId}/view` : `/api/public/files/${fileId}/view`;
    try {
      const res = await api.fetch(viewEndpoint, {
        method: 'GET',
        headers: authHeaders,
        skipCache: true
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || fileAsset?.mimeType || '';
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        return {
          label,
          url: blobUrl,
          mode: getDocumentPreviewMode(blobUrl, contentType, (fileAsset?.fileName || label).split('.').pop() || '')
        };
      }
    } catch {
      // Fallback below
    }

    // Try signed URL endpoint if view endpoint failed
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
          const isRealSignedUrl = data.signedUrl.includes('X-Goog-Algorithm') || data.signedUrl.includes('Signature=');
          const previewUrl = isRealSignedUrl ? data.signedUrl : (resolveMediaUrl(data.signedUrl) || data.signedUrl);
          return {
            label,
            url: previewUrl,
            mode: getDocumentPreviewMode(previewUrl, data.file?.mimeType || fileAsset?.mimeType || '')
          };
        }
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
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          return {
            label,
            url: blobUrl,
            mode: getDocumentPreviewMode(blobUrl, contentType)
          };
        }
      } catch {
        // Fallback to absolute url directly
      }
    }

    return {
      label,
      url: absoluteFallbackUrl,
      mode: getDocumentPreviewMode(absoluteFallbackUrl, fileAsset?.mimeType || '', fileExt)
    };
  }

  throw new Error('Document file is not uploaded on server.');
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
    ? (fileAsset?.fileUrl || fileAsset?.url || fileAsset?.signedUrl || fileAsset?.documentUrl)
    : null;
  const rawAbsoluteFallbackUrl = fallbackUrl ? getAbsoluteApiUrl(fallbackUrl) : '';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
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

  const previewWindow = window.open('about:blank', '_blank');

  if (previewWindow) {
    previewWindow.opener = null;
    previewWindow.document.title = label;
    previewWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Opening document...</p>';
  }

  try {
    if (!fileId) {
      if (!absoluteFallbackUrl) throw new Error('Document file is not uploaded on server.');
      if (previewWindow) previewWindow.location.href = absoluteFallbackUrl;
      else window.open(absoluteFallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const hasSession = Boolean((typeof window !== 'undefined' && localStorage.getItem('token')) || getCookieValue('csrfToken'));
    const signedUrlEndpoint = hasSession ? `/api/files/${fileId}/signed-url` : `/api/public/files/${fileId}/signed-url`;
    const viewEndpoint = hasSession ? `/api/files/${fileId}/view` : `/api/public/files/${fileId}/view`;

    // Try fetching signed URL from backend
    try {
      const res = await api.fetch(signedUrlEndpoint, {
        method: 'GET',
        skipCache: true
      });

      if (res.ok) {
        const body = await res.json().catch(() => null);
        const data = unwrapApiData<any>(body);
        if (data?.signedUrl) {
          const isRealSignedUrl = data.signedUrl.includes('X-Goog-Algorithm') || data.signedUrl.includes('Signature=');
          if (isRealSignedUrl) {
            if (previewWindow) {
              previewWindow.location.href = data.signedUrl;
            } else {
              window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
            }
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
        skipCache: true
      });
    } catch {
      res = null;
    }

    if (!res || !res.ok) {
      if (absoluteFallbackUrl) {
        if (previewWindow) previewWindow.location.href = absoluteFallbackUrl;
        else window.open(absoluteFallbackUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      throw new Error('Document file is not uploaded on server.');
    }

    const contentType = res.headers.get('content-type') || fileAsset?.mimeType || '';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (previewWindow) {
      previewWindow.document.body.innerHTML = '';
      if (contentType.startsWith('image/')) {
        previewWindow.document.body.style.margin = '0';
        previewWindow.document.body.style.background = '#edf2f7';
        previewWindow.document.body.style.display = 'flex';
        previewWindow.document.body.style.justifyContent = 'center';
        previewWindow.document.body.style.alignItems = 'center';
        previewWindow.document.body.style.minHeight = '100vh';
        previewWindow.document.body.style.padding = '20px';
        const img = previewWindow.document.createElement('img');
        img.src = url;
        img.style.width = '800px';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
        img.style.borderRadius = '2px';
        img.style.border = '2px solid black';
        img.style.background = 'white';
        previewWindow.document.body.appendChild(img);
      } else if (contentType === 'application/pdf') {
        previewWindow.document.body.style.margin = '0';
        previewWindow.document.body.style.background = '#edf2f7';
        previewWindow.document.body.style.display = 'flex';
        previewWindow.document.body.style.justifyContent = 'center';
        previewWindow.document.body.style.minHeight = '100vh';
        previewWindow.document.body.style.padding = '16px';
        const docWrapper = previewWindow.document.createElement('div');
        docWrapper.style.width = '800px';
        docWrapper.style.maxWidth = '100%';
        docWrapper.style.height = 'calc(100vh - 32px)';
        docWrapper.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
        docWrapper.style.borderRadius = '2px';
        docWrapper.style.border = '2px solid black';
        docWrapper.style.background = 'white';
        docWrapper.style.overflow = 'hidden';
        const iframe = previewWindow.document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        docWrapper.appendChild(iframe);
        previewWindow.document.body.appendChild(docWrapper);
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
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    if (previewWindow) previewWindow.close();
    throw err;
  }
};
