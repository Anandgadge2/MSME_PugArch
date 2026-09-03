'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, FileSpreadsheet, FileText, FileType, ImageIcon, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { openFileAsset } from '../../../lib/files';
import { api } from '../../../lib/api';
import VoiceNotePlayer from './VoiceNotePlayer';

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

const isAudioAttachment = (fileAsset?: AttachmentFileAsset) => {
  const mime = fileAsset?.mimeType || '';
  const name = (fileAsset?.originalName || '').toLowerCase();
  return (
    mime.startsWith('audio/') ||
    name.endsWith('.webm') ||
    name.endsWith('.ogg') ||
    name.endsWith('.mp3') ||
    name.endsWith('.wav') ||
    name.endsWith('.m4a') ||
    name.includes('voice-message') ||
    name.includes('voice-note')
  );
};

const isImageMime = (mime?: string) => Boolean(mime?.startsWith('image/'));

const isWordDoc = (fileAsset?: AttachmentFileAsset) => {
  const mime = fileAsset?.mimeType || '';
  const name = (fileAsset?.originalName || '').toLowerCase();
  return (
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessingml')
  );
};

const isExcelDoc = (fileAsset?: AttachmentFileAsset) => {
  const mime = fileAsset?.mimeType || '';
  const name = (fileAsset?.originalName || '').toLowerCase();
  return (
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.csv') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('csv')
  );
};

const isPdfDoc = (fileAsset?: AttachmentFileAsset) => {
  const mime = fileAsset?.mimeType || '';
  const name = (fileAsset?.originalName || '').toLowerCase();
  return name.endsWith('.pdf') || mime.includes('pdf');
};

// Global memory cache for image object URLs to eliminate repeat network fetches
export const imageBlobUrlCache = new Map<number, string>();

export default function MessageAttachmentView({
  attachment,
  isMe
}: {
  attachment: { id: number; fileAssetId: number; fileAsset?: AttachmentFileAsset };
  isMe: boolean;
}) {
  const fileAsset = attachment.fileAsset || { id: attachment.fileAssetId };
  const label = fileAsset.originalName || `Attachment #${attachment.fileAssetId}`;
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => imageBlobUrlCache.get(fileAsset.id) || null);
  const [loadingPreview, setLoadingPreview] = useState(() => !imageBlobUrlCache.has(fileAsset.id) && isImageMime(fileAsset.mimeType));
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (isAudioAttachment(fileAsset) || !isImageMime(fileAsset.mimeType)) return;
    if (imageBlobUrlCache.has(fileAsset.id)) {
      setPreviewUrl(imageBlobUrlCache.get(fileAsset.id)!);
      setLoadingPreview(false);
      return;
    }

    let cancelled = false;
    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
        const res = await api.fetch(`/api/files/${fileAsset.id}/view`, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        imageBlobUrlCache.set(fileAsset.id, objectUrl);
        if (!cancelled) {
          setPreviewUrl(objectUrl);
        }
      } catch {
        // Fallback silently
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [fileAsset.id, fileAsset.mimeType]);

  // If this is a voice note / audio, render the audio player directly!
  if (isAudioAttachment(fileAsset)) {
    return (
      <VoiceNotePlayer
        fileAssetId={fileAsset.id}
        originalName={fileAsset.originalName}
        isMe={isMe}
      />
    );
  }

  const handleOpen = async () => {
    try {
      await openFileAsset(fileAsset, label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open attachment');
    }
  };

  const isWord = isWordDoc(fileAsset);
  const isExcel = isExcelDoc(fileAsset);
  const isPdf = isPdfDoc(fileAsset);
  const isImage = isImageMime(fileAsset.mimeType);

  const chipClass = isMe
    ? 'border-white/20 bg-white/10 text-white/90 hover:bg-white/15'
    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';

  return (
    <div className={cn('mt-2 space-y-2', isMe ? 'text-white' : 'text-slate-900')}>
      {loadingPreview && (
        <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold', chipClass)}>
          <Loader2 className="h-3 w-3 animate-spin" /> Loading image preview…
        </div>
      )}

      {/* Image Thumbnail */}
      {previewUrl && (
        <div className="relative group overflow-hidden rounded-xl border border-slate-200/80 bg-slate-900/5">
          <img
            src={previewUrl}
            alt={label}
            onClick={() => setLightboxOpen(true)}
            className="max-h-56 w-full cursor-pointer object-contain transition group-hover:scale-102"
          />
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxOpen && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in">
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-white p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={previewUrl} alt={label} className="max-h-[80vh] w-auto object-contain rounded-xl" />
            <div className="flex items-center justify-between p-2">
              <span className="text-xs font-bold text-slate-700">{label}</span>
              <button
                type="button"
                onClick={() => void handleOpen()}
                className="flex items-center gap-1 text-xs font-black text-[#12335f] hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Download Full
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document / File Card */}
      <button
        type="button"
        onClick={() => void handleOpen()}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs font-bold transition shadow-2xs',
          chipClass
        )}
      >
        {/* Specific File Type Badge */}
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-inner',
            isWord
              ? 'bg-blue-600 text-white'
              : isPdf
              ? 'bg-rose-600 text-white'
              : isExcel
              ? 'bg-emerald-600 text-white'
              : isImage
              ? 'bg-purple-600 text-white'
              : 'bg-slate-700 text-white'
          )}
        >
          {isWord ? (
            <span className="font-mono text-[10px] font-black">DOC</span>
          ) : isPdf ? (
            <span className="font-mono text-[10px] font-black">PDF</span>
          ) : isExcel ? (
            <FileSpreadsheet className="h-4 w-4" />
          ) : isImage ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </div>

        {/* Name and Size */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black leading-tight">{label}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] opacity-75">
            {fileAsset.size ? <span>{formatFileSize(fileAsset.size)}</span> : null}
            <span>•</span>
            <span className="uppercase">{isWord ? 'Word Doc' : isPdf ? 'PDF' : isExcel ? 'Excel' : 'File'}</span>
          </div>
        </div>

        {/* View / Download Action */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-black/5 px-2 py-1 text-[10px] font-bold">
          <Eye className="h-3 w-3" />
          <span>View</span>
        </div>
        <Download className="h-4 w-4 shrink-0 opacity-70 hover:opacity-100" />
      </button>
    </div>
  );
}
