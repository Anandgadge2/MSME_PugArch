import React, { useState, useRef, useId } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Check,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ComplianceDoc {
  id: string;
  name: string;
  pdfFile: string;
  title: string;
  content: React.ReactNode;
}

interface ComplianceConsentCardProps {
  /** Single doc mode or multi-doc tabs mode */
  docs?: ComplianceDoc[];
  /** Shortcut props for single-document mode */
  title?: string;
  subtitle?: string;
  pdfFile?: string;
  children?: React.ReactNode;

  /** Checkbox state & controller */
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  checkboxLabel: string;
  checkboxDescription?: string;
  required?: boolean;

  /** Visual options */
  className?: string;
  readerHeightClassName?: string;
  compact?: boolean;
  showPolicyLibrary?: boolean;
}

export function ComplianceConsentCard({
  docs,
  title,
  subtitle,
  pdfFile,
  children,
  accepted,
  onAcceptedChange,
  checkboxLabel,
  checkboxDescription,
  required = true,
  className,
  readerHeightClassName = 'h-[320px] sm:h-[360px]',
  compact = false,
  showPolicyLibrary = false,
}: ComplianceConsentCardProps) {
  const generatedId = useId();
  const checkboxId = `compliance-consent-${generatedId}`;

  // Build document list
  const activeDocs: ComplianceDoc[] = docs && docs.length > 0
    ? docs
    : [
        {
          id: 'default',
          name: pdfFile || 'Policy_Document.pdf',
          pdfFile: pdfFile || 'Order_Placement_Procurement_Policy.pdf',
          title: title || 'Statutory Compliance Policy',
          content: children,
        },
      ];

  const [activeDocId, setActiveDocId] = useState<string>(activeDocs[0].id);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const currentDoc = activeDocs.find(d => d.id === activeDocId) || activeDocs[0];
  const pdfUrl = `/docs/${currentDoc.pdfFile}`;

  const scrollByAmount = (amount: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ top: amount, behavior: 'smooth' });
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop += e.deltaY;
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={cn(
        'w-full transition-all duration-300',
        isFullscreen && 'fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4 sm:p-6 backdrop-blur-sm flex flex-col justify-center items-center',
        className
      )}
    >
      <div
        className={cn(
          'w-full rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-sm transition-all',
          isFullscreen && 'max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden p-2'
        )}
      >
        {/* Card Header & Multi-tab switcher if applicable */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#12335f]">
              <ShieldCheck className="h-4 w-4 text-[#12335f]" aria-hidden="true" />
              <span>Legal Compliance &amp; Regulatory Undertaking</span>
            </div>
            <h3 className="mt-1 text-sm sm:text-base font-black text-slate-900 tracking-tight">
              {title || currentDoc.title}
            </h3>
            {subtitle && (
              <p className="text-xs font-semibold text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>

          {activeDocs.length > 1 && (
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-100/90 p-1 border border-slate-200/60">
              {activeDocs.map(doc => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    setActiveDocId(doc.id);
                    if (scrollRef.current) scrollRef.current.scrollTop = 0;
                  }}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer',
                    activeDocId === doc.id
                      ? 'bg-[#12335f] text-white shadow-xs font-black'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  )}
                >
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  <span>{doc.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navy Blue Reader Bar (#12335f) */}
        <div className="flex h-11 sm:h-12 items-center justify-between gap-2 bg-[#12335f] px-3 sm:px-5 text-white">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
            <span className="truncate text-xs font-bold tracking-tight text-white" title={currentDoc.name}>
              {currentDoc.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Scroll Controls */}
            <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-lg border border-white/15">
              <button
                type="button"
                onClick={() => scrollByAmount(-220)}
                className="p-1 text-blue-200 hover:text-white hover:bg-white/20 rounded transition-colors cursor-pointer"
                title="Scroll Up"
                aria-label="Scroll legal text up"
              >
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollByAmount(220)}
                className="p-1 text-blue-200 hover:text-white hover:bg-white/20 rounded transition-colors cursor-pointer"
                title="Scroll Down"
                aria-label="Scroll legal text down"
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* View PDF in External Tab */}
            <button
              type="button"
              onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-100 hover:text-white transition-colors cursor-pointer px-1.5 py-1"
              title="Open authentic PDF document in new tab"
            >
              <span className="hidden xs:inline">View PDF</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={() => handleDownload(pdfUrl, currentDoc.name)}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-all shadow-xs cursor-pointer"
              title="Download authentic PDF copy"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 text-blue-200 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer ml-0.5"
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen View'}
              aria-label={isFullscreen ? 'Exit Fullscreen View' : 'Open Fullscreen Legal View'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Document Text Container */}
        <main
          ref={scrollRef}
          onWheel={handleWheel}
          tabIndex={0}
          role="region"
          aria-label={`${currentDoc.title} terms content`}
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 #f1f5f9' }}
          className={cn(
            'bg-white p-4 sm:p-6 overflow-y-auto overscroll-contain focus:outline-none transition-all cursor-ns-resize',
            '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#12335f]',
            isFullscreen ? 'flex-1 min-h-[400px]' : readerHeightClassName
          )}
        >
          <article className="mx-auto max-w-full font-sans text-xs leading-relaxed text-slate-700 sm:text-sm">
            {currentDoc.content}
          </article>
        </main>

        {/* Optional Expandable PDF Policy Library Reference */}
        {showPolicyLibrary && (
          <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/70 text-xs">
            <button
              type="button"
              onClick={() => setShowLibrary(!showLibrary)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-[#12335f] transition-colors cursor-pointer"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{showLibrary ? 'Hide Related Legal Reference Documents' : 'View All Related Policy PDFs (6)'}</span>
              <ChevronDown className={cn('h-3 w-3 transition-transform', showLibrary && 'rotate-180')} />
            </button>

            {showLibrary && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-3 pt-2 border-t border-slate-200/60">
                {[
                  { label: 'Procurement Policy', file: 'Order_Placement_Procurement_Policy.pdf' },
                  { label: 'Cancellation & Refund', file: 'Order_Cancellation_Refund_Policy.pdf' },
                  { label: 'MSME Supplier Agreement', file: 'MSME_Registration_Supplier_Participation_Agreement.pdf' },
                  { label: 'General Terms & Conditions', file: 'Terms_and_Conditions.pdf' },
                  { label: 'Vendor Verification', file: 'Vendor_Verification_Policy.pdf' },
                  { label: 'Privacy Policy', file: 'Privacy_Policy_JSG_Smile.pdf' },
                ].map(doc => {
                  const docUrl = `/docs/${doc.file}`;
                  return (
                    <div
                      key={doc.label}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white text-[11px]"
                    >
                      <span className="font-semibold text-slate-700 truncate">{doc.label}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={() => window.open(docUrl, '_blank', 'noopener,noreferrer')}
                          className="p-1 text-slate-500 hover:text-[#12335f] rounded cursor-pointer"
                          title="View PDF"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(docUrl, doc.file)}
                          className="p-1 text-slate-500 hover:text-[#12335f] rounded cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Acceptance Bar with High-Contrast Checkbox */}
        <div
          className={cn(
            'border-t border-slate-200/80 bg-slate-50/90 p-3.5 sm:p-4 rounded-b-2xl sm:rounded-b-3xl transition-colors',
            accepted && 'bg-blue-50/40 border-blue-200/60'
          )}
        >
          <label
            htmlFor={checkboxId}
            className="flex cursor-pointer items-start gap-3 text-slate-800 select-none group"
          >
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                id={checkboxId}
                checked={accepted}
                onChange={(e) => onAcceptedChange(e.target.checked)}
                aria-required={required}
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 transition-all checked:bg-[#12335f] checked:border-[#12335f] hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
              />
              <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" aria-hidden="true" />
            </div>

            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-[#12335f] transition-colors leading-tight">
                {checkboxLabel} {required && <span className="text-red-500 font-bold">*</span>}
              </span>
              {checkboxDescription && (
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1 leading-relaxed">
                  {checkboxDescription}
                </span>
              )}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
