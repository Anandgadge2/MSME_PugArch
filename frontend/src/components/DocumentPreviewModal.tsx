import { X } from 'lucide-react';
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
  if (!previewDocument) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black uppercase text-slate-900 sm:text-lg">{previewDocument.label}</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Document Preview</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a
              href={previewDocument.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase text-slate-600 transition-all hover:bg-slate-50 sm:inline-flex"
            >
              Open Original
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100">
          {previewDocument.mode === 'image' && (
            <div className="flex h-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewDocument.url}
                alt={previewDocument.label}
                className="max-h-full max-w-full rounded-2xl bg-white object-contain shadow-lg"
              />
            </div>
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
    </div>
  );
}
