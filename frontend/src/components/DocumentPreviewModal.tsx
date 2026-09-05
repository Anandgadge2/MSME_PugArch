import { useState, useRef, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileImage,
  AlertCircle,
  Loader2,
  FileCheck
} from 'lucide-react';
import type { DocumentPreview } from '../lib/files';

const getDocumentPreviewUrl = (url: string) => {
  if (!url) return url;
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('.png') ||
    lowerUrl.includes('.jpg') ||
    lowerUrl.includes('.jpeg') ||
    lowerUrl.includes('.gif') ||
    lowerUrl.includes('.webp') ||
    lowerUrl.includes('.pdf')
  ) {
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
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentUrl, setCurrentUrl] = useState(previewDocument?.url || '');

  // Derived state: reset controls if the previewed document URL changes
  if (previewDocument && previewDocument.url !== currentUrl) {
    setCurrentUrl(previewDocument.url);
    setScale(1);
    setRotation(0);
    setIsLoading(true);
    setHasError(false);
  }

  // Lock body scroll while preview is open (save & restore previous value)
  useEffect(() => {
    if (!previewDocument) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewDocument, onClose]);

  if (!previewDocument) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  // Stop wheel propagation so parent modals don't steal scroll
  const handleOverlayWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop += e.deltaY;
      scrollContainerRef.current.scrollLeft += e.deltaX;
    }
  };

  const isPdf = previewDocument.mode === 'pdf';
  const isImage = previewDocument.mode === 'image';
  const isOffice = previewDocument.mode === 'office';
  const ext = (previewDocument.label || previewDocument.url || '').split('?')[0].split('.').pop()?.toUpperCase() || '';

  const getFormatBadge = () => {
    if (isPdf) {
      return {
        label: 'PDF Document',
        cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
        icon: FileText
      };
    }
    if (isImage) {
      return {
        label: `Image (${ext || 'JPG/PNG'})`,
        cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
        icon: FileImage
      };
    }
    if (isOffice) {
      const isSheet = ['XLS', 'XLSX', 'CSV'].includes(ext);
      return {
        label: isSheet ? `Spreadsheet (${ext})` : `Word Document (${ext || 'DOCX'})`,
        cls: isSheet ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' : 'bg-blue-500/20 text-blue-200 border-blue-400/40',
        icon: isSheet ? FileSpreadsheet : FileText
      };
    }
    return {
      label: 'Document',
      cls: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
      icon: FileCheck
    };
  };

  const badge = getFormatBadge();
  const BadgeIcon = badge.icon;

  return (
    <div
      className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-950/85 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-150"
      onWheel={handleOverlayWheel}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={previewDocument.label || 'Document Preview'}
    >
      <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-700/30 animate-in zoom-in-95 duration-200">
        {/* Top Header Bar */}
        <header className="bg-[#0b1f3a] text-white px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between border-b border-white/10 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-white">
              <BadgeIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xs sm:text-sm font-bold text-white tracking-wide" title={previewDocument.label}>
                {previewDocument.label}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${badge.cls}`}>
                  {badge.label}
                </span>
                <span className="text-[10px] font-medium text-white/60 truncate hidden sm:inline">
                  Verified Quotation Attachment
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href={previewDocument.url}
              download={previewDocument.label || 'document'}
              className="inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 transition-all active:scale-95 shadow-2xs"
              title="Download Document"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <a
              href={previewDocument.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 transition-all sm:inline-flex shadow-2xs"
              title="Open Original in New Tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open in Tab</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all cursor-pointer"
              title="Close Document (Esc)"
              aria-label="Close Preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Modal Canvas */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 bg-slate-100 overflow-auto p-2 sm:p-4 flex flex-col justify-center items-center"
        >
          {/* ── IMAGE PREVIEW ── */}
          {isImage && (
            <div className="flex flex-col items-center justify-center my-auto w-full h-full relative py-2">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-slate-100/80 backdrop-blur-xs">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold text-slate-600">Loading document image...</span>
                </div>
              )}

              {hasError ? (
                <div className="text-center p-8 bg-white rounded-2xl border border-slate-250 shadow-lg max-w-md my-auto">
                  <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-900">Image Preview Unavailable</h4>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    The image could not be displayed directly. You can download or open the original file.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <a
                      href={previewDocument.url}
                      download={previewDocument.label}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition-all shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Image
                    </a>
                    <a
                      href={previewDocument.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 text-xs font-bold transition-all shadow-sm"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
                    </a>
                  </div>
                </div>
              ) : (
                <div className="relative flex-1 w-full flex items-center justify-center overflow-auto p-2">
                  <div className="max-w-full max-h-[76vh] flex items-center justify-center rounded-xl bg-white p-2 sm:p-3 shadow-lg border border-slate-200 transition-shadow">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewDocument.url}
                      alt={previewDocument.label}
                      onLoad={() => setIsLoading(false)}
                      onError={() => {
                        setIsLoading(false);
                        setHasError(true);
                      }}
                      style={{
                        transform: `rotate(${rotation}deg) scale(${scale})`,
                        transformOrigin: 'center center',
                        maxWidth: '100%',
                        maxHeight: '70vh',
                        transition: 'transform 0.2s ease-in-out',
                      }}
                      className="object-contain block mx-auto rounded"
                    />
                  </div>
                </div>
              )}

              {/* Floating Glassmorphism Toolbar */}
              <div className="sticky bottom-3 mt-3 flex items-center gap-1 sm:gap-1.5 rounded-full border border-slate-250 bg-white/95 px-3 py-1.5 sm:px-4 sm:py-2 shadow-lg backdrop-blur-md z-10 max-w-[95vw]">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>

                <span className="min-w-[2.8rem] sm:min-w-[3.5rem] text-center text-[11px] sm:text-xs font-bold text-slate-600 font-mono">
                  {Math.round(scale * 100)}%
                </span>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>

                <div className="h-4 w-px bg-slate-250 mx-0.5 sm:mx-1" />

                <button
                  type="button"
                  onClick={handleRotate}
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 cursor-pointer"
                  title="Rotate Right"
                >
                  <RotateCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 cursor-pointer"
                  title="Reset Zoom & Rotation"
                >
                  <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── PDF PREVIEW ── */}
          {isPdf && (
            <div className="w-full h-full flex flex-col flex-1 relative rounded-xl shadow-lg border border-slate-250 overflow-hidden bg-white">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-slate-50/90 backdrop-blur-xs">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold text-slate-600">Loading PDF document...</span>
                </div>
              )}
              <iframe
                src={previewDocument.url}
                title={previewDocument.label}
                onLoad={() => setIsLoading(false)}
                className="w-full flex-1 border-none min-h-[75vh]"
              />
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">
                  PDF document preview • Built-in browser reader
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={previewDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Full Screen</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── OFFICE / WORD / EXCEL PREVIEW ── */}
          {isOffice && (
            <div className="w-full h-full flex flex-col flex-1 gap-2.5">
              {/* Informative Document Card */}
              <div className="bg-white rounded-xl border border-slate-250 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center shrink-0">
                    <BadgeIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {previewDocument.label}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Microsoft Office Document ({ext || 'DOCX'}) • Embedded Viewer Active
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <a
                    href={previewDocument.url}
                    download={previewDocument.label}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs flex-1 sm:flex-initial"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download File</span>
                  </a>
                  <a
                    href={previewDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs flex-1 sm:flex-initial"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open Original</span>
                  </a>
                </div>
              </div>

              {/* Embedded Viewer Container */}
              <div className="w-full flex-1 relative rounded-xl shadow-lg border border-slate-250 overflow-hidden bg-white">
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-slate-50/90 backdrop-blur-xs">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-xs font-semibold text-slate-600">Connecting to Document Viewer...</span>
                  </div>
                )}
                <iframe
                  src={getOfficePreviewUrl(previewDocument.url)}
                  title={previewDocument.label}
                  onLoad={() => setIsLoading(false)}
                  className="w-full flex-1 border-none min-h-[60vh] h-full"
                />
              </div>
            </div>
          )}

          {/* ── GOOGLE / GENERIC PREVIEW ── */}
          {previewDocument.mode === 'google' && (
            <div className="w-full h-full flex flex-col flex-1 relative rounded-xl shadow-lg border border-slate-250 overflow-hidden bg-white">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-slate-50/90 backdrop-blur-xs">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold text-slate-600">Loading document preview...</span>
                </div>
              )}
              <iframe
                src={getDocumentPreviewUrl(previewDocument.url)}
                title={previewDocument.label}
                onLoad={() => setIsLoading(false)}
                className="w-full flex-1 border-none min-h-[75vh]"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
