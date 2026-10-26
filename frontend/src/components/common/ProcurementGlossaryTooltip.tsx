'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface GlossaryEntry {
  term: string;
  fullName: string;
  definition: string;
  hindiHint?: string;
  whoDoesWhat?: string;
}

export const GLOSSARY_DICTIONARY: Record<string, GlossaryEntry> = {
  RFQ: {
    term: 'RFQ',
    fullName: 'Request for Quotation',
    definition: 'Direct pricing request for standardized items. Buyers compare quotes directly on price without complex multi-envelope scoring.',
    hindiHint: 'मानक सामान के लिए सीधे दाम मांगना। सबसे कम रेट वाले को तुरंत ऑर्डर मिलता है।',
    whoDoesWhat: 'Buyer specifies quantities; Sellers submit competitive prices directly.'
  },
  RFP: {
    term: 'RFP',
    fullName: 'Request for Proposal',
    definition: 'Two-stage sourcing for complex requirements. Technical specifications and vendor credentials are evaluated and scored before commercial quotes are opened.',
    hindiHint: 'जटिल कार्यों के लिए दो-चरणीय प्रक्रिया। पहले तकनीकी योग्यता जांची जाती है, फिर रेट खोला जाता है।',
    whoDoesWhat: 'Sellers upload technical proposal + price packet; Buyer scrutinizes credentials before price opening.'
  },
  OPEN_TENDER: {
    term: 'Open Tender',
    fullName: 'Public Open Tender',
    definition: 'Transparent public procurement open to any verified vendor meeting eligibility criteria. Widely publicized across the portal.',
    hindiHint: 'सार्वजनिक निविदा जिसमें कोई भी पंजीकृत और पात्र विक्रेता भाग ले सकता है।',
    whoDoesWhat: 'Buyer advertises public requirements; All eligible registered MSMEs can bid.'
  },
  LIMITED_TENDER: {
    term: 'Limited Tender',
    fullName: 'Limited / Invited Sourcing',
    definition: 'Sourcing where only pre-selected or verified registered vendors are formally invited to submit quotes.',
    hindiHint: 'केवल चुने हुए या आमंत्रित विक्रेताओं के लिए निविदा।',
    whoDoesWhat: 'Buyer sends direct invites; Only invited vendors can participate.'
  },
  REVERSE_AUCTION: {
    term: 'Reverse Auction',
    fullName: 'Dynamic Reverse Auction',
    definition: 'An online real-time bidding event where vendors compete by progressively lowering their price quotes during a live countdown floor.',
    hindiHint: 'लाइव नीलामी जहां विक्रेता समय सीमा के भीतर अपना रेट कम करके जीतते हैं।',
    whoDoesWhat: 'Buyer opens the live floor; Vendors submit lower bids live in real-time.'
  },
  RATE_CONTRACT: {
    term: 'Rate Contract',
    fullName: 'Annual Rate Contract',
    definition: 'Fixed pre-negotiated unit pricing valid for a specific period (e.g. 1 year), enabling repeated direct purchase orders on demand.',
    hindiHint: 'तय समय के लिए निश्चित दर अनुबंध। जरूरत पड़ने पर कभी भी ऑर्डर दिया जा सकता है।',
    whoDoesWhat: 'Buyer fixes contract rates; Seller delivers multiple batches over the agreement period.'
  },
  BOQ: {
    term: 'BOQ',
    fullName: 'Bill of Quantities',
    definition: 'A detailed itemized list or spreadsheet specifying multiple distinct products, materials, and line items within a single procurement requirement.',
    hindiHint: 'कई सामानों की सूची। विक्रेता प्रत्येक आइटम का अलग-अलग रेट भरते हैं।',
    whoDoesWhat: 'Buyer uploads multi-line schedule; Sellers quote rates for each row or total package.'
  },
  GRN: {
    term: 'GRN',
    fullName: 'Goods Receipt Note',
    definition: 'Official proof issued by the consignee/buyer confirming that ordered goods were delivered, inspected, and accepted at the delivery site.',
    hindiHint: 'सामान डिलीवरी के बाद खरीदार द्वारा जारी की गई आधिकारिक निरीक्षण और स्वीकृति रसीद।',
    whoDoesWhat: 'Consignee inspects items and approves GRN; Unlocks supplier payment release.'
  },
  L1: {
    term: 'L1 Bidder',
    fullName: 'Lowest Compliant Bidder',
    definition: 'The supplier offering the lowest total landed cost (Base price + GST + Freight) strictly conforming to all mandatory technical specifications.',
    hindiHint: 'नियमों के अनुसार सबसे कम दाम देने वाला विक्रेता, जिसे ऑर्डर मिलने की पहली प्राथमिकता होती है।',
    whoDoesWhat: 'Evaluated automatically by system formula; Buyer awards contract to L1.'
  },
  PAC: {
    term: 'PAC',
    fullName: 'Proprietary Article Certificate',
    definition: 'Procurement initiated from a single specific OEM or authorized distributor when only that specific brand/make can fulfill statutory or technical needs.',
    hindiHint: 'केवल एक विशिष्ट ब्रांड या निर्माता से खरीद जब कोई दूसरा विकल्प मान्य न हो।',
    whoDoesWhat: 'Buyer certifies PAC necessity; Single vendor provides official quotation.'
  },
  TREDS: {
    term: 'TReDS',
    fullName: 'Trade Receivables Discounting System',
    definition: 'RBI-regulated electronic platform enabling MSME sellers to auction accepted invoices to banks for immediate liquidity within 24–48 hours.',
    hindiHint: 'आरबीआई द्वारा अनुमोदित प्लेटफॉर्म जहां एमएसएमई खरीदार के स्वीकृत बिल पर तुरंत बैंक से भुगतान ले सकते हैं।',
    whoDoesWhat: 'Seller discounts approved buyer invoice; Financier deposits funds directly to seller account.'
  },
  TWO_PACKET: {
    term: 'Two-Packet',
    fullName: 'Two-Envelope Evaluation',
    definition: 'Sealed bidding where Technical documents (Envelope 1) are evaluated first. Commercial prices (Envelope 2) remain locked until technical qualification is finalized.',
    hindiHint: 'गोपनीय प्रणाली जहां रेट केवल उन्हीं विक्रेताओं का खुलेगा जो तकनीकी जांच में पास होंगे।',
    whoDoesWhat: 'System enforces anti-bias lock on prices until technical scrutiny is officially approved.'
  }
};

interface ProcurementGlossaryTooltipProps {
  term: string;
  badgeLabel?: string;
  showIconOnly?: boolean;
  className?: string;
}

export function ProcurementGlossaryTooltip({
  term,
  badgeLabel,
  showIconOnly = false,
  className
}: ProcurementGlossaryTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [align, setAlign] = useState<'right' | 'left' | 'center'>('right');
  const [verticalAlign, setVerticalAlign] = useState<'top' | 'bottom'>('top');
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanKey = String(term || '').trim().toUpperCase().replace(/[\s-]/g, '_');
  const entry = GLOSSARY_DICTIONARY[cleanKey] || {
    term,
    fullName: term,
    definition: 'Enterprise procurement terminology used in government and MSME contracting.'
  };

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceRight = viewportWidth - rect.right;
    const spaceLeft = rect.left;

    // Horizontally align so popover never overflows viewport
    if (spaceRight < 340 && spaceLeft >= 280) {
      setAlign('right');
    } else if (spaceLeft < 340) {
      setAlign('left');
    } else {
      setAlign('center');
    }

    // Vertically align so popover never gets cut off by top of window
    if (rect.top < 220 && viewportHeight - rect.bottom >= 200) {
      setVerticalAlign('bottom');
    } else {
      setVerticalAlign('top');
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const placementClasses = cn(
    verticalAlign === 'top' ? 'bottom-full mb-2.5' : 'top-full mt-2.5',
    align === 'right' && 'right-0 left-auto translate-x-0',
    align === 'left' && 'left-0 right-auto translate-x-0',
    align === 'center' && 'left-1/2 -translate-x-1/2'
  );

  return (
    <div ref={containerRef} className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(prev => !prev);
          }
        }}
        aria-expanded={isOpen}
        aria-label={`Explain term ${entry.term}`}
        className={cn(
          'inline-flex items-center gap-1 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1.5 py-0.5',
          showIconOnly
            ? 'text-slate-400 hover:text-blue-600'
            : 'text-xs font-semibold text-slate-700 hover:text-blue-700 bg-slate-100/90 hover:bg-blue-50 rounded-md border border-slate-200/90'
        )}
      >
        {!showIconOnly && <span>{badgeLabel || entry.term}</span>}
        <HelpCircle className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150 ring-1 ring-slate-900/5",
            placementClasses
          )}
        >
          <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Info className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 leading-tight">
                  {entry.fullName}
                </h4>
                <span className="text-[10px] font-bold text-slate-400">
                  {entry.term} Standard
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-lg transition-colors shrink-0"
              aria-label="Close explanation"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-2.5 text-xs font-medium text-slate-600 leading-relaxed">
            {entry.definition}
          </p>

          {entry.whoDoesWhat && (
            <div className="mt-3 rounded-xl bg-slate-50/90 border border-slate-200/80 p-2.5 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Participant Role
              </span>
              <p className="text-[11px] font-semibold text-slate-700 leading-snug">
                {entry.whoDoesWhat}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProcurementGlossaryTooltip;
