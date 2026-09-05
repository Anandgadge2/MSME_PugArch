import { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw, Download } from 'lucide-react';
import type { DocumentPreview } from '../lib/files';

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
  const [currentUrl, setCurrentUrl] = useState(previewDocument?.url || '');

  // Derived state: reset controls if the previewed document URL changes
  if (previewDocument && previewDocument.url !== currentUrl) {
    setCurrentUrl(previewDocument.url);
    setScale(1);
    setRotation(0);
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

  // Stop wheel propagation so parent modals don't steal scroll, and delegate to image container
  const handleOverlayWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop += e.deltaY;
      scrollContainerRef.current.scrollLeft += e.deltaX;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-150"
      onWheel={handleOverlayWheel}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={previewDocument.label || 'Document Preview'}
    >
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
        {/* Top Header Bar matching PO Receipt Modal */}
        <header className="bg-[#0b1f3a] text-white px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between border-b border-white/10 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h3 className="truncate text-xs sm:text-sm font-black uppercase text-white tracking-wide">
                {previewDocument.label}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/40 bg-blue-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-200">
                  Regular Document Format (800px)
                </span>
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest hidden sm:inline">
                  {previewDocument.mode.toUpperCase()} Preview
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href={previewDocument.url}
              download={previewDocument.label || 'document'}
              className="inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 transition-all active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download Document</span>
              <span className="sm:hidden">Download</span>
            </a>
            <a
              href={previewDocument.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-8 sm:h-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 transition-all sm:inline-flex"
            >
              Open Original
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all"
              title="Close Document"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Modal Canvas: #edf2f7 matching PO Receipt Modal Studio Canvas */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 bg-[#edf2f7] overflow-auto p-3 sm:p-6 flex justify-center items-start"
        >
          {previewDocument.mode === 'image' && (
            <div className="flex flex-col items-center justify-center my-auto shrink-0 w-full py-2">
              {/* Regular Document Container Sheet (800px) */}
              <div
                style={{
                  width: '800px',
                  maxWidth: '100%',
                }}
                className="bg-white text-slate-900 rounded-sm border-2 border-black p-4 sm:p-5 shadow-2xl shadow-slate-400/50 flex flex-col justify-between shrink-0 transition-shadow mx-auto"
              >
                <div className="flex justify-center items-center overflow-hidden rounded-sm min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewDocument.url}
                    alt={previewDocument.label}
                    style={{
                      transform: `rotate(${rotation}deg) scale(${scale})`,
                      transformOrigin: 'center center',
                      width: '100%',
                      height: 'auto',
                      maxHeight: '72vh',
                      transition: 'transform 0.2s ease-in-out',
                    }}
                    className="object-contain block mx-auto"
                  />
                </div>
              </div>

              {/* Floating Glassmorphism Toolbar */}
              <div className="sticky bottom-4 mt-4 flex items-center gap-1 sm:gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-3 py-1.5 sm:px-4 sm:py-2 shadow-lg backdrop-blur-md z-10 max-w-[95vw]">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95"
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
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 mx-0.5 sm:mx-1" />

                <button
                  type="button"
                  onClick={handleRotate}
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                  title="Rotate Right"
                >
                  <RotateCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                  title="Reset Zoom & Rotation"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {previewDocument.mode === 'pdf' && (
            <div
              style={{
                width: '800px',
                maxWidth: '100%',
                height: 'calc(92vh - 80px)',
              }}
              className="bg-white text-slate-900 rounded-sm border-2 border-black shadow-2xl shadow-slate-400/50 overflow-hidden flex flex-col shrink-0 my-auto mx-auto"
            >
              <iframe
                src={previewDocument.url}
                title={previewDocument.label}
                className="w-full flex-1 border-none"
              />
            </div>
          )}

          {previewDocument.mode === 'office' && (
            <div
              style={{
                width: '800px',
                maxWidth: '100%',
                height: 'calc(92vh - 80px)',
              }}
              className="bg-white text-slate-900 rounded-sm border-2 border-black shadow-2xl shadow-slate-400/50 overflow-hidden flex flex-col shrink-0 my-auto mx-auto"
            >
              <iframe
                src={getOfficePreviewUrl(previewDocument.url)}
                title={previewDocument.label}
                className="w-full flex-1 border-none"
              />
            </div>
          )}

          {previewDocument.mode === 'google' && (
            <div
              style={{
                width: '800px',
                maxWidth: '100%',
                height: 'calc(92vh - 80px)',
              }}
              className="bg-white text-slate-900 rounded-sm border-2 border-black shadow-2xl shadow-slate-400/50 overflow-hidden flex flex-col shrink-0 my-auto mx-auto"
            >
              <iframe
                src={getDocumentPreviewUrl(previewDocument.url)}
                title={previewDocument.label}
                className="w-full flex-1 border-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

