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
  ChevronsUpDown,
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
  readerHeightClassName,
  compact = true,
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
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Determine height: if fullscreen, full height. If isExpanded, h-[260px] sm:h-[300px]. Else compact height h-[120px] sm:h-[135px].
  const effectiveHeightClass = isFullscreen
    ? 'flex-1 min-h-[400px]'
    : isExpanded
    ? 'h-[260px] sm:h-[300px]'
    : (readerHeightClassName || 'h-[120px] sm:h-[135px]');

  return (
    <div
      className={cn(
        'w-full transition-all duration-200',
        isFullscreen && 'fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-3 sm:p-6 backdrop-blur-sm flex flex-col justify-center items-center',
        className
      )}
    >
      <div
        className={cn(
          'w-full rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden transition-all',
          isFullscreen && 'max-w-4xl h-[92vh] flex flex-col shadow-2xl p-1.5'
        )}
      >
        {/* Multi-doc tabs if more than 1 document */}
        {activeDocs.length > 1 && (
          <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {activeDocs.map(doc => (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  setActiveDocId(doc.id);
                  if (scrollRef.current) scrollRef.current.scrollTop = 0;
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
                  activeDocId === doc.id
                    ? 'bg-[#12335f] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                )}
              >
                <FileText className="h-3 w-3" aria-hidden="true" />
                <span>{doc.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Compact Navy Toolbar (#12335f) */}
        <div className="flex h-9 sm:h-10 items-center justify-between gap-2 bg-[#12335f] px-3 sm:px-4 text-white select-none">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-300" aria-hidden="true" />
            <span className="truncate text-xs font-bold text-white tracking-tight" title={currentDoc.name}>
              {currentDoc.name}
            </span>
            <span className="hidden md:inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-white/15 text-blue-100 uppercase tracking-wider">
              Statutory Compliance
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Quick Scroll Controls */}
            <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-md border border-white/15">
              <button
                type="button"
                onClick={() => scrollByAmount(-180)}
                className="p-0.5 text-blue-200 hover:text-white hover:bg-white/20 rounded transition-colors cursor-pointer"
                title="Scroll Up"
                aria-label="Scroll legal text up"
              >
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollByAmount(180)}
                className="p-0.5 text-blue-200 hover:text-white hover:bg-white/20 rounded transition-colors cursor-pointer"
                title="Scroll Down"
                aria-label="Scroll legal text down"
              >
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>

            {/* View PDF */}
            <button
              type="button"
              onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-100 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/10"
              title="Open authentic PDF document in new tab"
            >
              <span>View PDF</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={() => handleDownload(pdfUrl, currentDoc.name)}
              className="inline-flex items-center gap-1 text-[11px] font-bold bg-white/15 hover:bg-white/25 active:scale-95 text-white px-2 py-0.5 sm:py-1 rounded-md transition-all shadow-2xs cursor-pointer"
              title="Download official PDF copy"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Expand / Collapse Reader Height */}
            {!isFullscreen && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-blue-200 hover:text-white hover:bg-white/15 rounded transition-colors cursor-pointer"
                title={isExpanded ? 'Compact View' : 'Expand Height'}
                aria-label={isExpanded ? 'Collapse reader height' : 'Expand reader height'}
              >
                <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 text-blue-200 hover:text-white hover:bg-white/15 rounded transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen View' : 'Open Fullscreen View'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-3 w-3" aria-hidden="true" />
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
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f8fafc' }}
          className={cn(
            'bg-white p-3 sm:p-4 overflow-y-auto overscroll-contain focus:outline-none transition-all cursor-ns-resize',
            '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#12335f]',
            effectiveHeightClass
          )}
        >
          <article className="mx-auto max-w-full font-sans text-xs leading-relaxed text-slate-700">
            {currentDoc.content}
          </article>
        </main>

        {/* Policy Library Link (Compact Single Line) */}
        {showPolicyLibrary && (
          <div className="border-t border-slate-100 px-3 py-1.5 bg-slate-50/70 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setShowLibrary(!showLibrary)}
              className="flex items-center gap-1 font-semibold text-slate-500 hover:text-[#12335f] transition-colors cursor-pointer"
            >
              <Info className="h-3 w-3" aria-hidden="true" />
              <span>{showLibrary ? 'Hide Related Policies' : 'Related Platform Policies (6)'}</span>
              <ChevronDown className={cn('h-2.5 w-2.5 transition-transform duration-150', showLibrary && 'rotate-180')} />
            </button>
            <span className="text-[10px] font-medium text-slate-400">Statutory Compliant</span>
          </div>
        )}

        {showPolicyLibrary && showLibrary && (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 p-2.5 bg-slate-50 border-t border-slate-200/60 text-[11px]">
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
                  className="flex items-center justify-between px-2 py-1 rounded border border-slate-200 bg-white"
                >
                  <span className="font-semibold text-slate-700 truncate">{doc.label}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      type="button"
                      onClick={() => window.open(docUrl, '_blank', 'noopener,noreferrer')}
                      className="p-0.5 text-slate-500 hover:text-[#12335f] cursor-pointer"
                      title="View PDF"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(docUrl, doc.file)}
                      className="p-0.5 text-slate-500 hover:text-[#12335f] cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Enhanced Standard OS-Style Acceptance Checkbox Tile */}
        <div className="border-t border-slate-200/80 p-2 sm:p-2.5 bg-slate-50/90">
          <label
            htmlFor={checkboxId}
            className={cn(
              'group flex items-start gap-2.5 sm:gap-3 rounded-lg border p-2.5 sm:p-3 transition-all duration-150 cursor-pointer select-none',
              accepted
                ? 'border-blue-600 bg-blue-50/60 shadow-2xs ring-1 ring-blue-600/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
            )}
          >
            {/* Standard OS Checkbox Box */}
            <div className="relative flex items-center justify-center shrink-0 mt-0.5">
              <input
                type="checkbox"
                id={checkboxId}
                checked={accepted}
                onChange={(e) => onAcceptedChange(e.target.checked)}
                aria-required={required}
                className="peer sr-only"
              />
              <div
                className={cn(
                  'flex h-4 w-4 sm:h-4.5 sm:w-4.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                  accepted
                    ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                    : 'border-slate-300 bg-white group-hover:border-slate-400 group-focus-within:ring-2 group-focus-within:ring-blue-500/30'
                )}
                aria-hidden="true"
              >
                <Check
                  className={cn(
                    'h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[3] transition-transform duration-150',
                    accepted ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                  )}
                />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs sm:text-[13px] font-bold text-slate-900 group-hover:text-blue-950 transition-colors leading-snug">
                {checkboxLabel} {required && <span className="text-rose-600 font-bold ml-0.5">*</span>}
              </div>
              {checkboxDescription && (
                <div className="text-[11px] font-normal text-slate-500 mt-0.5 leading-relaxed">
                  {checkboxDescription}
                </div>
              )}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
