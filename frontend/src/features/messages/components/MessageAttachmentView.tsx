'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, FileText, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { openFileAsset } from '../../../lib/files';
import { api } from '../../../lib/api';

type AttachmentFileAsset = {
  id: number;
  originalName?: string;
  mimeType?: string;
  size?: number;
  viewUrl?: string;
  downloadUrl?: string;
};

const formatFileSize = (size?: number) => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageMime = (mime?: string) => Boolean(mime?.startsWith('image/'));

export default function MessageAttachmentView({
  attachment,
  isMe,
}: {
  attachment: { id: number; fileAssetId: number; fileAsset?: AttachmentFileAsset };
  isMe: boolean;
}) {
  const fileAsset = attachment.fileAsset || { id: attachment.fileAssetId };
  const label = fileAsset.originalName || `Attachment #${attachment.fileAssetId}`;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      if (!isImageMime(fileAsset.mimeType)) return;
      setLoadingPreview(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
        const res = await api.fetch(`/api/files/${fileAsset.id}/view`, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          skipCache: true,
        });
        if (!res.ok) return;
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPreviewUrl(objectUrl);
      } catch {
        // Preview is optional; view button still works.
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileAsset.id, fileAsset.mimeType]);

  const handleOpen = async () => {
    try {
      await openFileAsset(fileAsset, label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open attachment');
    }
  };

  const chipClass = isMe
    ? 'border-white/20 bg-white/10 text-white/90 hover:bg-white/15'
    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';

  return (
    <div className={cn('mt-2 space-y-2', isMe ? 'text-white' : 'text-slate-900')}>
      {loadingPreview && (
        <div className={cn('flex items-center gap-2 rounded-md border px-2 py-2 text-[10px] font-bold', chipClass)}>
          <Loader2 className="h-3 w-3 animate-spin" /> Loading preview…
        </div>
      )}
      {previewUrl && (
        <button type="button" onClick={() => void handleOpen()} className="block max-w-full overflow-hidden rounded-md border border-slate-200 bg-white">
          <img src={previewUrl} alt={label} className="max-h-48 w-full object-contain" />
        </button>
      )}
      <button
        type="button"
        onClick={() => void handleOpen()}
        className={cn('flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-[10px] font-bold transition', chipClass)}
      >
        {isImageMime(fileAsset.mimeType) ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {fileAsset.size ? <span className={cn('shrink-0', isMe ? 'text-white/55' : 'text-slate-400')}>{formatFileSize(fileAsset.size)}</span> : null}
        <span className={cn('inline-flex shrink-0 items-center gap-1', isMe ? 'text-white/80' : 'text-[#12335f]')}>
          <Eye className="h-3 w-3" /> View
        </span>
        <Download className={cn('h-3 w-3 shrink-0', isMe ? 'text-white/70' : 'text-slate-500')} />
      </button>
    </div>
  );
}
