import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  FileText,
  ShieldCheck,
  Lock,
  UserCheck,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Loader2 } from '../ui/loader';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  GtcContent,
  SupplierAgreementContent,
  ConsentPolicyContent,
  VerificationPolicyContent,
} from './LegalDocumentsText';

interface TermsConditionsProps {
  onAccept: () => void;
  onBack: () => void;
  role: 'buyer' | 'seller';
}

type DocTab = 'gtc' | 'supplier' | 'consent' | 'verification';

export default function TermsConditions({ onAccept, onBack, role }: TermsConditionsProps) {
  const [activeTab, setActiveTab] = useState<DocTab>('gtc');
  const [accepted, setAccepted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transitionState, setTransitionState] = useState<'idle' | 'back' | 'accept'>('idle');
  const isTransitioning = transitionState !== 'idle';

  const scrollRef = useRef<HTMLDivElement>(null);

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

  const handleBack = () => {
    if (isTransitioning) return;
    setTransitionState('back');
    window.setTimeout(onBack, 450);
  };

  const handleAccept = () => {
    if (!accepted || isTransitioning) return;
    setTransitionState('accept');
    window.setTimeout(onAccept, 650);
  };

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-5xl transition-all duration-300',
        isFullscreen && 'fixed inset-0 z-50 max-w-none overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8'
      )}
    >
      {isTransitioning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 backdrop-blur-sm">
          <div className="flex min-w-72 flex-col items-center gap-4 rounded-3xl border border-slate-100 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-md">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-[#12335f]/15" />
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#12335f] text-white shadow-lg shadow-blue-900/30">
                <Loader2 className="h-7 w-7 animate-spin" />
              </span>
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-slate-900">
                {transitionState === 'accept' ? 'Preparing Registration' : 'Returning to Pre-requisites'}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Please wait a moment...</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Section Card with Ultra-Smooth Rounded Borders */}
      <section
        className={cn(
          'rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 md:p-7',
          isFullscreen && 'flex h-full flex-col'
        )}
      >
        {/* Header & Smooth Segmented Tabs */}
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#12335f]">
              <ShieldCheck className="h-4 w-4 text-[#12335f]" />
              <span>{role === 'buyer' ? 'Buyer Procurement Registration' : 'Seller & SHG Onboarding Charter'}</span>
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl tracking-tight">
              Terms & Conditions Agreement
            </h2>
          </div>

          {/* Smooth Rounded Segmented Tab Bar */}
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-slate-100/90 p-1.5 border border-slate-200/60">
            {[
              { id: 'gtc' as const, label: 'General Terms (GTC)', icon: FileText },
              { id: 'supplier' as const, label: 'Supplier Agreement', icon: FileCheck },
              { id: 'consent' as const, label: 'Data Consent', icon: Lock },
              { id: 'verification' as const, label: 'Vendor Verification', icon: UserCheck },
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (scrollRef.current) scrollRef.current.scrollTop = 0;
                  }}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-200',
                    activeTab === tab.id
                      ? 'bg-[#12335f] text-white shadow-md shadow-blue-950/20 font-black'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  )}
                >
                  <IconComponent className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document Reader Container with Direct Mouse Wheel Scrolling Handler */}
        <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden', isFullscreen && 'min-h-0 flex-1')}>
          <PdfToolbar
            activeTab={activeTab}
            onScrollUp={() => scrollByAmount(-250)}
            onScrollDown={() => scrollByAmount(250)}
          />

          <main
            ref={scrollRef}
            onWheel={handleWheel}
            tabIndex={0}
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 #f1f5f9' }}
            className={cn(
              'bg-white p-5 sm:p-8 overflow-y-auto overscroll-contain focus:outline-none transition-all cursor-ns-resize',
              '[&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#12335f]',
              isFullscreen ? 'h-[calc(100dvh-230px)] min-h-[300px]' : 'h-[440px] sm:h-[480px]'
            )}
          >
            <article className="mx-auto max-w-full font-sans text-xs leading-relaxed text-slate-700 sm:text-sm">
              {activeTab === 'gtc' && <GtcContent />}
              {activeTab === 'supplier' && <SupplierAgreementContent />}
              {activeTab === 'consent' && <ConsentPolicyContent />}
              {activeTab === 'verification' && <VerificationPolicyContent />}

              {/* Official PDF Document Direct Download Grid */}
              <div className="mt-10 rounded-2xl bg-slate-50/80 p-5 border border-slate-200/80 space-y-4 font-sans text-xs">
                <div className="flex items-center gap-2.5 font-black text-slate-800 text-xs uppercase tracking-wider">
                  <FileText className="h-4 w-4 text-[#12335f]" />
                  <span>Official Platform Policy PDF Library</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-left">
                  {[
                    { label: 'General Terms & Conditions', file: 'Terms_and_Conditions.pdf' },
                    { label: 'Privacy Policy', file: 'Privacy_Policy_JSG_Smile.pdf' },
                    { label: 'MSME Supplier Agreement', file: 'MSME_Registration_Supplier_Participation_Agreement.pdf' },
                    { label: 'Data Sharing Consent Agreement', file: 'Data_Sharing_Consent_Agreement.pdf' },
                    { label: 'Vendor Verification Policy', file: 'Vendor_Verification_Policy.pdf' },
                    { label: 'Procurement Facilitation Policy', file: 'Order_Placement_Procurement_Policy.pdf' },
                  ].map(doc => {
                    const pdfUrl = `/docs/${doc.file}`;
                    return (
                      <div
                        key={doc.label}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-[#12335f] hover:bg-blue-50/40 transition-all shadow-2xs group"
                      >
                        <span className="truncate font-bold text-slate-700 group-hover:text-[#12335f] text-[11px]">
                          {doc.label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                            className="p-1.5 text-slate-500 hover:text-[#12335f] hover:bg-blue-100/50 rounded-lg transition-colors"
                            title="View PDF Document"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPdfFile(pdfUrl, doc.file)}
                            className="p-1.5 text-slate-500 hover:text-[#12335f] hover:bg-blue-100/50 rounded-lg transition-colors"
                            title="Download PDF Document"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          </main>
        </div>

        {/* Ultra-Smooth Theme-Aligned Acceptance Bar */}
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-slate-50/90 p-5 rounded-2xl border border-slate-200/80">
          <label className="flex cursor-pointer items-start gap-3.5 text-slate-800 group">
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                id="terms-checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 transition-all checked:bg-[#12335f] checked:border-[#12335f] hover:border-blue-500"
              />
              <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-900 group-hover:text-[#12335f] transition-colors">
                I accept the General Terms, Conditions & Participation Agreement <span className="text-red-500">*</span>
              </span>
              <span className="text-xs font-semibold text-slate-500 mt-0.5 leading-relaxed">
                I have read, understood, and agree to comply with the General Terms & Conditions, Participation Policy, and Data Consent Rules of the JsgSmile Portal.
              </span>
            </div>
          </label>

          <div className="flex items-center gap-3 shrink-0 justify-end">
            <button
              type="button"
              onClick={handleBack}
              disabled={isTransitioning}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {transitionState === 'back' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}
              Back
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((value) => !value)}
              disabled={isTransitioning}
              className="h-11 rounded-xl px-4 text-xs font-bold text-slate-700 hover:bg-slate-200/60 transition-all border border-transparent"
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <Button
              onClick={handleAccept}
              disabled={!accepted || isTransitioning}
              className={cn(
                'h-11 rounded-xl px-8 text-xs font-bold tracking-wide shadow-md transition-all active:scale-95',
                accepted
                  ? 'bg-[#12335f] text-white shadow-blue-950/20 hover:bg-[#0b2447]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              )}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {transitionState === 'accept' && <Loader2 className="h-4 w-4 animate-spin" />}
                {transitionState === 'accept' ? 'Preparing...' : 'Proceed to Registration'}
              </span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function downloadPdfFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function PdfToolbar({
  activeTab,
  onScrollUp,
  onScrollDown,
}: {
  activeTab: DocTab;
  onScrollUp: () => void;
  onScrollDown: () => void;
}) {
  const fileMap: Record<DocTab, { name: string; file: string }> = {
    gtc: { name: 'Terms_and_Conditions.pdf', file: 'Terms_and_Conditions.pdf' },
    supplier: { name: 'MSME_Supplier_Participation_Agreement.pdf', file: 'MSME_Registration_Supplier_Participation_Agreement.pdf' },
    consent: { name: 'Data_Sharing_Consent_Agreement.pdf', file: 'Data_Sharing_Consent_Agreement.pdf' },
    verification: { name: 'Vendor_Verification_Policy.pdf', file: 'Vendor_Verification_Policy.pdf' },
  };

  const currentDoc = fileMap[activeTab];
  const pdfUrl = `/docs/${currentDoc.file}`;

  return (
    <div className="flex h-12 items-center justify-between gap-3 bg-[#12335f] px-4 text-white sm:px-6">
      <div className="flex items-center gap-2.5 min-w-0">
        <FileText className="h-4 w-4 shrink-0 text-blue-300" />
        <span className="truncate text-xs font-bold tracking-tight text-white">
          {currentDoc.name}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Quick Scroll Controls */}
        <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-lg border border-white/15">
          <button
            type="button"
            onClick={onScrollUp}
            className="p-1 text-blue-200 hover:text-white hover:bg-white/15 rounded transition-colors"
            title="Scroll Up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onScrollDown}
            className="p-1 text-blue-200 hover:text-white hover:bg-white/15 rounded transition-colors"
            title="Scroll Down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-100 hover:text-white transition-colors cursor-pointer ml-1"
        >
          <span>View PDF</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => downloadPdfFile(pdfUrl, currentDoc.file)}
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
          title="Download Official PDF"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download PDF</span>
        </button>
      </div>
    </div>
  );
}
