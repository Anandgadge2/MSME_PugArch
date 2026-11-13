import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw, Download, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { signedUrlCache, detectBlobMimeType, type DocumentPreview } from '../lib/files';
import { FocusTrap } from './ui/FocusTrap';
import { api, resolveMediaUrl } from '../lib/api';

const getDocumentPreviewUrl = (url: string) => {
  if (!url) return url;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.png') || lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.gif') || lowerUrl.includes('.webp') || lowerUrl.includes('.pdf')) {
    return url;
  }
  const isPublicHttps = url.startsWith('https://') && !url.includes('localhost') && !url.includes('127.0.0.1');
  if (isPublicHttps) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  }
  return url;
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
  const [resolvedImageSrc, setResolvedImageSrc] = useState<string | null>(
    previewDocument?.mode === 'image' ? (previewDocument?.url?.trim() || null) : null
  );
  const [resolvedPdfSrc, setResolvedPdfSrc] = useState<string | null>(
    previewDocument?.mode === 'pdf' ? (previewDocument?.url?.trim() || null) : null
  );
  const [isImageLoading, setIsImageLoading] = useState(previewDocument?.mode === 'image' && Boolean(previewDocument?.url?.trim()));
  const [imageLoadError, setImageLoadError] = useState(previewDocument?.mode === 'image' && !previewDocument?.url?.trim());
  const [isPdfLoading, setIsPdfLoading] = useState(previewDocument?.mode === 'pdf' && Boolean(previewDocument?.url?.trim()));
  const [pdfLoadError, setPdfLoadError] = useState(previewDocument?.mode === 'pdf' && !previewDocument?.url?.trim());
  const recoveryAttemptedRef = useRef(false);
  const createdBlobUrlsRef = useRef<string[]>([]);

  // Cleanup created blob URLs after safe timeout so quick modal re-opens don't hit revoked blob URLs
  useEffect(() => {
    return () => {
      const urlsToClean = [...createdBlobUrlsRef.current];
      createdBlobUrlsRef.current = [];
      setTimeout(() => {
        urlsToClean.forEach(url => {
          try { URL.revokeObjectURL(url); } catch {}
        });
      }, 60_000);
    };
  }, []);

  // Fallback timer: Chromium internal PDF plugin might not fire onLoad event in some subframes
  useEffect(() => {
    if (!isPdfLoading) return;
    const timer = setTimeout(() => {
      setIsPdfLoading(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, [isPdfLoading]);

  // Attempt resilient recovery if PDF fails to load inside iframe
  const handlePdfError = useCallback(async () => {
    if (recoveryAttemptedRef.current || !previewDocument) {
      setResolvedPdfSrc(null);
      setPdfLoadError(true);
      setIsPdfLoading(false);
      return;
    }
    recoveryAttemptedRef.current = true;
    setIsPdfLoading(true);

    try {
      if (previewDocument.fileId) {
        signedUrlCache.delete(previewDocument.fileId);
      }
      const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('msme_auth_token')) : null;
      const isRealToken = Boolean(token && token !== 'null' && token !== 'undefined' && token !== 'cookie-session');
      const authQuery = isRealToken ? `?token=${encodeURIComponent(token!)}` : '';
      const authHeaders: Record<string, string> = {};
      if (isRealToken) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }

      const endpointsToTry: string[] = [];
      if (previewDocument.fileId) {
        endpointsToTry.push(`/api/files/${previewDocument.fileId}/view${authQuery}`);
      }
      if (previewDocument.originalUrl && !previewDocument.originalUrl.startsWith('blob:')) {
        const orig = previewDocument.originalUrl;
        if (!endpointsToTry.includes(orig)) endpointsToTry.push(orig);
      }
      if (previewDocument.url && !previewDocument.url.startsWith('blob:') && !previewDocument.url.startsWith('data:')) {
        const u = previewDocument.url;
        if (!endpointsToTry.includes(u)) endpointsToTry.push(u);
      }

      for (const ep of endpointsToTry) {
        try {
          const res = await api.fetch(ep, { headers: authHeaders, credentials: 'omit', skipCache: true });
          if (res.ok) {
            const rawBlob = await res.blob();
            if (rawBlob.size > 0) {
              const detected = await detectBlobMimeType(rawBlob);
              if (detected.isValid && detected.mode === 'image') {
                const imgBlob = rawBlob.type.startsWith('image/') ? rawBlob : new Blob([rawBlob], { type: detected.mime || 'image/png' });
                const blobUrl = URL.createObjectURL(imgBlob);
                createdBlobUrlsRef.current.push(blobUrl);
                setResolvedImageSrc(blobUrl);
                setIsImageLoading(false);
                setImageLoadError(false);
                setResolvedPdfSrc(null);
                setPdfLoadError(false);
                setIsPdfLoading(false);
                return;
              }
              const pdfBlob = rawBlob.type === 'application/pdf' ? rawBlob : new Blob([rawBlob], { type: 'application/pdf' });
              const blobUrl = URL.createObjectURL(pdfBlob);
              createdBlobUrlsRef.current.push(blobUrl);
              setResolvedPdfSrc(blobUrl);
              setPdfLoadError(false);
              setIsPdfLoading(false);
              return;
            }
          }
        } catch {
          // Try next endpoint
        }
      }
    } catch (err) {
      console.warn('[DocumentPreviewModal] PDF recovery failed:', err);
    }

    setResolvedPdfSrc(null);
    setPdfLoadError(true);
    setIsPdfLoading(false);
  }, [previewDocument]);

  // Derived state: reset controls if the previewed document URL changes
  useEffect(() => {
    if (previewDocument) {
      const url = previewDocument.url?.trim() || null;
      setScale(1);
      setRotation(0);
      recoveryAttemptedRef.current = false;

      if (previewDocument.mode === 'image') {
        setResolvedImageSrc(url);
        setIsImageLoading(Boolean(url));
        setImageLoadError(!url);
        setResolvedPdfSrc(null);
        setIsPdfLoading(false);
        setPdfLoadError(false);
      } else if (previewDocument.mode === 'pdf') {
        setResolvedImageSrc(null);
        setIsImageLoading(false);
        setImageLoadError(false);

        if (url) {
          setResolvedPdfSrc(url);
          setIsPdfLoading(false);
          setPdfLoadError(false);
        } else {
          setResolvedPdfSrc(null);
          setIsPdfLoading(true);
          setPdfLoadError(false);
          void handlePdfError();
        }
      } else {
        setResolvedImageSrc(null);
        setResolvedPdfSrc(null);
        setIsImageLoading(false);
        setIsPdfLoading(false);
      }
    }
  }, [previewDocument?.url, previewDocument?.mode, handlePdfError]);

  // Attempt resilient recovery if image fails to load directly
  const handleImageError = useCallback(async () => {
    if (recoveryAttemptedRef.current || !previewDocument?.url || !previewDocument.url.trim()) {
      setImageLoadError(true);
      setIsImageLoading(false);
      return;
    }
    recoveryAttemptedRef.current = true;
    setIsImageLoading(true);

    try {
      if (previewDocument.fileId) {
        signedUrlCache.delete(previewDocument.fileId);
      }

      // If we have a fileId or an original HTTP URL, prioritize server fetch over a broken blob: URL
      const recoveryUrl = previewDocument.fileId
        ? `/api/files/${previewDocument.fileId}/view`
        : (previewDocument.originalUrl && !previewDocument.originalUrl.startsWith('blob:')
            ? previewDocument.originalUrl
            : (previewDocument.url && !previewDocument.url.startsWith('blob:') ? previewDocument.url : ''));

      // Avoid refetching a dead blob: URL
      if (recoveryUrl && !recoveryUrl.startsWith('blob:')) {
        const res = await api.fetch(recoveryUrl, { skipCache: true });
        if (res.ok) {
          const rawBlob = await res.blob();
          if (rawBlob.size > 0) {
            const detected = await detectBlobMimeType(rawBlob);
            if (detected.isValid && detected.mode === 'pdf') {
              const pdfBlob = rawBlob.type === 'application/pdf' ? rawBlob : new Blob([rawBlob], { type: 'application/pdf' });
              const blobUrl = URL.createObjectURL(pdfBlob);
              createdBlobUrlsRef.current.push(blobUrl);
              setResolvedPdfSrc(blobUrl);
              setPdfLoadError(false);
              setIsPdfLoading(false);
              setResolvedImageSrc(null);
              setIsImageLoading(false);
              setImageLoadError(false);
              return;
            }
            const blob = rawBlob.type.startsWith('image/') ? rawBlob : new Blob([rawBlob], { type: detected.mime || 'image/png' });
            const blobUrl = URL.createObjectURL(blob);
            createdBlobUrlsRef.current.push(blobUrl);
            setResolvedImageSrc(blobUrl);
            setImageLoadError(false);
            setIsImageLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('[DocumentPreviewModal] Authenticated blob recovery failed:', err);
    }

    setImageLoadError(true);
    setIsImageLoading(false);
  }, [previewDocument]);

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

  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('msme_auth_token')) : null;
  const authQuery = token ? `?token=${encodeURIComponent(token)}` : '';

  const fallbackDownloadUrl = previewDocument.fileId
    ? `/api/files/${previewDocument.fileId}/view${authQuery}`
    : (previewDocument.originalUrl && !previewDocument.originalUrl.startsWith('blob:')
        ? (previewDocument.originalUrl.includes('?') ? `${previewDocument.originalUrl}&token=${encodeURIComponent(token || '')}` : `${previewDocument.originalUrl}${authQuery}`)
        : '');
  const activeDownloadUrl = (
    resolvedPdfSrc ||
    resolvedImageSrc ||
    previewDocument.url ||
    fallbackDownloadUrl
  ).trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[99999999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4 animate-in fade-in duration-100 will-change-[opacity]"
      onWheel={handleOverlayWheel}
    >
      <FocusTrap onEscape={onClose} className="w-full max-w-6xl">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-preview-title"
          className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-[2rem] transform-gpu will-change-[transform,opacity] animate-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <h3 id="doc-preview-title" className="truncate text-sm font-black uppercase text-slate-900 sm:text-lg">{previewDocument.label}</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Document Preview</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              {activeDownloadUrl ? (
                <>
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
                </>
              ) : null}
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
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-600 py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Loading preview...</span>
                    </div>
                  )}

                  {imageLoadError || !resolvedImageSrc ? (
                    <div className="m-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3">
                        <AlertCircle className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">Direct Image Preview Unavailable</h4>
                      <p className="text-xs text-slate-500 mb-4">
                        {previewDocument.url
                          ? 'This file cannot be rendered inside the inline preview frame. You can open or download the original file directly.'
                          : 'No valid document source is available for this file.'}
                      </p>
                      {previewDocument.url ? (
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
                      ) : null}
                    </div>
                  ) : (
                    <div className={`flex min-h-full w-full ${isImageLoading ? 'hidden' : ''}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolvedImageSrc}
                        alt={previewDocument.label || 'Document preview'}
                        loading="eager"
                        decoding="sync"
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
                {!imageLoadError && !isImageLoading && Boolean(resolvedImageSrc) && (
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
              <div className="relative h-full w-full flex flex-col items-center justify-center bg-slate-100">
                {isPdfLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-600">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Loading PDF...</span>
                  </div>
                )}
                {pdfLoadError || !resolvedPdfSrc ? (
                  <div className="m-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">Direct PDF Preview Unavailable</h4>
                    <p className="text-xs text-slate-500 mb-4">
                      This document cannot be rendered inside the frame. You can open or download the original PDF directly.
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={activeDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Original</span>
                      </a>
                      <a
                        href={activeDownloadUrl}
                        download={previewDocument.label || 'document.pdf'}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <object
                    key={`${resolvedPdfSrc}-${previewDocument.fileId || previewDocument.label}`}
                    data={resolvedPdfSrc}
                    type="application/pdf"
                    className="h-full w-full border-0"
                    onLoad={() => setIsPdfLoading(false)}
                    onError={handlePdfError}
                  >
                    <iframe
                      src={resolvedPdfSrc}
                      title={previewDocument.label || 'PDF Preview'}
                      className="h-full w-full border-0"
                      onLoad={() => setIsPdfLoading(false)}
                      onError={handlePdfError}
                    />
                  </object>
                )}
              </div>
            )}
            {previewDocument.mode === 'office' && (
              previewDocument.url ? (
                <iframe
                  src={getOfficePreviewUrl(previewDocument.url)}
                  title={previewDocument.label || 'Office Document Preview'}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-8 text-center text-slate-500">
                  <p className="text-xs font-bold uppercase">No document URL provided</p>
                </div>
              )
            )}
            {previewDocument.mode === 'google' && (
              previewDocument.url && previewDocument.url.startsWith('https://') && !previewDocument.url.includes('localhost') ? (
                <iframe
                  src={getDocumentPreviewUrl(previewDocument.url)}
                  title={previewDocument.label || 'Document Preview'}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-slate-600">
                  <AlertCircle className="h-12 w-12 text-slate-400 mb-3" />
                  <p className="text-sm font-bold text-slate-800">Preview Not Supported Directly In Frame</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    This file format cannot be rendered inside the inline preview frame. You can open or download the original file directly.
                  </p>
                  {activeDownloadUrl ? (
                    <div className="mt-4 flex items-center gap-2">
                      <a
                        href={activeDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Original</span>
                      </a>
                      <a
                        href={activeDownloadUrl}
                        download={previewDocument.label || 'document'}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ) : null}
                </div>
              )
            )}
          </div>
        </div>
      </FocusTrap>
    </div>,
    document.body
  );
}
