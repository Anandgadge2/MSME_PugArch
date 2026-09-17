import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw, Download, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import type { DocumentPreview } from '../lib/files';
import { FocusTrap } from './ui/FocusTrap';
import { api, resolveMediaUrl } from '../lib/api';

const getDocumentPreviewUrl = (url: string) => {
  if (!url) return url;

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.png') || lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.gif') || lowerUrl.includes('.webp') || lowerUrl.includes('.pdf')) {
    return url;
  }

  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
};

const getOfficePreviewUrl = (url: string) =>
  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

export function DocumentPreviewModal({
  previewDocument,
  onClose
}: {
  previewDocument: DocumentPreview | null;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [resolvedImageSrc, setResolvedImageSrc] = useState(previewDocument?.url || '');
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageLoadError, setImageLoadError] = useState(false);
  const recoveryAttemptedRef = useRef(false);

  // Derived state: reset controls if the previewed document URL changes
  useEffect(() => {
    if (previewDocument) {
      setResolvedImageSrc(previewDocument.url);
      setScale(1);
      setRotation(0);
      setIsImageLoading(true);
      setImageLoadError(false);
      recoveryAttemptedRef.current = false;
    }
  }, [previewDocument?.url]);

  // Attempt resilient recovery if image fails to load directly
  const handleImageError = useCallback(async () => {
    if (recoveryAttemptedRef.current || !previewDocument?.url) {
      setImageLoadError(true);
      setIsImageLoading(false);
      return;
    }
    recoveryAttemptedRef.current = true;
    setIsImageLoading(true);

    try {
      const targetUrl = resolveMediaUrl(previewDocument.url) || previewDocument.url;
      const res = await api.fetch(targetUrl, { skipCache: true });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          setResolvedImageSrc(blobUrl);
          setImageLoadError(false);
          setIsImageLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[DocumentPreviewModal] Authenticated blob recovery failed:', err);
    }

    setImageLoadError(true);
    setIsImageLoading(false);
  }, [previewDocument?.url]);

  // Lock body scroll while preview is open (save & restore previous value)
  useEffect(() => {
    if (!previewDocument) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [previewDocument]);

  if (!previewDocument) return null;
  if (typeof document === 'undefined') return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  // Stop wheel propagation so parent modals don't steal scroll, and delegate to image container
  const handleOverlayWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop += e.deltaY;
      scrollContainerRef.current.scrollLeft += e.deltaX;
    }
  };

  const activeDownloadUrl = resolvedImageSrc || previewDocument.url;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4"
      onWheel={handleOverlayWheel}
    >
      <FocusTrap onEscape={onClose} className="w-full max-w-6xl">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-preview-title"
          className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-[2rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <h3 id="doc-preview-title" className="truncate text-sm font-black uppercase text-slate-900 sm:text-lg">{previewDocument.label}</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Document Preview</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              <a
                href={activeDownloadUrl}
                download={previewDocument.label || 'document'}
                className="inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 sm:px-4 text-[10px] font-black uppercase text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download Document</span>
                <span className="sm:hidden">Download</span>
              </a>
              <a
                href={activeDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase text-slate-600 transition-all hover:bg-slate-50 sm:inline-flex"
              >
                Open Original
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close preview"
                className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative flex-1 bg-slate-100 overflow-hidden">
            {previewDocument.mode === 'image' && (
              <>
                {/* Scrollable image container */}
                <div ref={scrollContainerRef} className="h-full w-full overflow-auto overscroll-contain p-4 flex items-center justify-center">
                  {isImageLoading && (
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Loading preview...</span>
                    </div>
                  )}

                  {imageLoadError ? (
                    <div className="m-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3">
                        <AlertCircle className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Direct Image Preview Unavailable</h4>
                      <p className="text-xs text-slate-500 mb-4">
                        This file cannot be rendered inside the inline preview frame. You can open or download the original file directly.
                      </p>
                      <div className="flex items-center gap-2">
                        <a
                          href={previewDocument.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Open Original</span>
                        </a>
                        <a
                          href={previewDocument.url}
                          download={previewDocument.label || 'document'}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex min-h-full w-full ${isImageLoading ? 'hidden' : ''}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolvedImageSrc}
                        alt={previewDocument.label}
                        onLoad={() => setIsImageLoading(false)}
                        onError={handleImageError}
                        style={{
                          transform: `rotate(${rotation}deg)`,
                          width: `${scale * 100}%`,
                          maxWidth: scale === 1 ? '100%' : 'none',
                          height: 'auto',
                          transition: 'transform 0.2s ease-in-out, width 0.15s ease-in-out',
                        }}
                        className="m-auto object-contain select-none"
                        draggable={false}
                      />
                    </div>
                  )}
                </div>

                {/* Floating controls toolbar */}
                {!imageLoadError && !isImageLoading && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      disabled={scale <= 0.5}
                      title="Zoom Out"
                      aria-label="Zoom Out"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="min-w-[3.5rem] text-center text-xs font-black text-slate-700">
                      {Math.round(scale * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      disabled={scale >= 3}
                      title="Zoom In"
                      aria-label="Zoom In"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    <div className="mx-1 h-4 w-px bg-slate-200" />
                    <button
                      type="button"
                      onClick={handleRotate}
                      title="Rotate 90°"
                      aria-label="Rotate 90 degrees"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      title="Reset View"
                      aria-label="Reset View"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
            {previewDocument.mode === 'pdf' && (
              <iframe
                src={previewDocument.url}
                title={previewDocument.label}
                className="h-full w-full"
              />
            )}
            {previewDocument.mode === 'office' && (
              <iframe
                src={getOfficePreviewUrl(previewDocument.url)}
                title={previewDocument.label}
                className="h-full w-full"
              />
            )}
            {previewDocument.mode === 'google' && (
              <iframe
                src={getDocumentPreviewUrl(previewDocument.url)}
                title={previewDocument.label}
                className="h-full w-full"
              />
            )}
          </div>
        </div>
      </FocusTrap>
    </div>,
    document.body
  );
}
