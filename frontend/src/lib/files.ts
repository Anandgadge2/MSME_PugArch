import { api } from './api';

export const openFileAsset = async (fileAsset: any, label = 'Document') => {
  const fileId = Number(fileAsset?.id || fileAsset?.fileAssetId || fileAsset?.fileId);
  const fallbackUrl = fileAsset?.url || fileAsset?.signedUrl;
  const previewWindow = window.open('about:blank', '_blank');

  if (previewWindow) {
    previewWindow.opener = null;
    previewWindow.document.title = label;
    previewWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Opening document...</p>';
  }

  try {
    if (!fileId) {
      if (!fallbackUrl) throw new Error('Document link is not available yet. Please refresh and try again.');
      if (previewWindow) previewWindow.location.href = fallbackUrl;
      else window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const res = await api.fetch(`/api/files/${fileId}/view`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      },
      skipCache: true
    });

    if (!res.ok) {
      let message = '';
      if (res.headers.get('content-type')?.includes('application/json')) {
        const body = await res.json().catch(() => null);
        message = body?.message || body?.error || body?.detail || '';
      } else {
        message = (await res.text().catch(() => '')).trim().slice(0, 160);
      }
      throw new Error(message || `Unable to open document (HTTP ${res.status})`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    if (previewWindow) previewWindow.close();
    throw err;
  }
};
