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
    fullName: 'Request for Quotation (मूल्य उद्धरण)',
    definition: 'Direct pricing request for standardized items. Buyers compare quotes directly on price without complex multi-envelope scoring.',
    hindiHint: 'मानक सामान के लिए सीधे दाम मांगना। सबसे कम रेट वाले को तुरंत ऑर्डर मिलता है।',
    whoDoesWhat: 'Buyer specifies quantities; Sellers submit competitive prices directly.'
  },
  RFP: {
    term: 'RFP',
    fullName: 'Request for Proposal (तकनीकी प्रस्ताव)',
    definition: 'Two-stage sourcing for complex requirements. Technical specifications and vendor credentials are evaluated and scored before commercial quotes are opened.',
    hindiHint: 'जटिल कार्यों के लिए दो-चरणीय प्रक्रिया। पहले तकनीकी योग्यता जांची जाती है, फिर रेट खोला जाता है।',
    whoDoesWhat: 'Sellers upload technical proposal + price packet; Buyer scrutinizes credentials before price opening.'
  },
  OPEN_TENDER: {
    term: 'Open Tender',
    fullName: 'Public Open Tender (खुली निविदा)',
    definition: 'Transparent public procurement open to any verified vendor meeting eligibility criteria. Widely publicized across the portal.',
    hindiHint: 'सार्वजनिक निविदा जिसमें कोई भी पंजीकृत और पात्र विक्रेता भाग ले सकता है।',
    whoDoesWhat: 'Buyer advertises public requirements; All eligible registered MSMEs can bid.'
  },
  LIMITED_TENDER: {
    term: 'Limited Tender',
    fullName: 'Limited / Invited Sourcing (सीमित निविदा)',
    definition: 'Sourcing where only pre-selected or verified registered vendors are formally invited to submit quotes.',
    hindiHint: 'केवल चुने हुए या आमंत्रित विक्रेताओं के लिए निविदा।',
    whoDoesWhat: 'Buyer sends direct invites; Only invited vendors can participate.'
  },
  REVERSE_AUCTION: {
    term: 'Reverse Auction',
    fullName: 'Dynamic Reverse Auction (रिवर्स नीलामी)',
    definition: 'An online real-time bidding event where vendors compete by progressively lowering their price quotes during a live countdown floor.',
    hindiHint: 'लाइव नीलामी जहां विक्रेता समय सीमा के भीतर अपना रेट कम करके जीतते हैं।',
    whoDoesWhat: 'Buyer opens the live floor; Vendors submit lower bids live in real-time.'
  },
  RATE_CONTRACT: {
    term: 'Rate Contract',
    fullName: 'Annual Rate Contract (दर अनुबंध)',
    definition: 'Fixed pre-negotiated unit pricing valid for a specific period (e.g. 1 year), enabling repeated direct purchase orders on demand.',
    hindiHint: 'तय समय के लिए निश्चित दर अनुबंध। जरूरत पड़ने पर कभी भी ऑर्डर दिया जा सकता है।',
    whoDoesWhat: 'Buyer fixes contract rates; Seller delivers multiple batches over the agreement period.'
  },
  BOQ: {
    term: 'BOQ',
    fullName: 'Bill of Quantities (मात्रा का बिल)',
    definition: 'A detailed itemized list or spreadsheet specifying multiple distinct products, materials, and line items within a single procurement requirement.',
    hindiHint: 'कई सामानों की सूची। विक्रेता प्रत्येक आइटम का अलग-अलग रेट भरते हैं।',
    whoDoesWhat: 'Buyer uploads multi-line schedule; Sellers quote rates for each row or total package.'
  },
  GRN: {
    term: 'GRN',
    fullName: 'Goods Receipt Note (माल पावती रसीद)',
    definition: 'Official proof issued by the consignee/buyer confirming that ordered goods were delivered, inspected, and accepted at the delivery site.',
    hindiHint: 'सामान डिलीवरी के बाद खरीदार द्वारा जारी की गई आधिकारिक निरीक्षण और स्वीकृति रसीद।',
    whoDoesWhat: 'Consignee inspects items and approves GRN; Unlocks supplier payment release.'
  },
  L1: {
    term: 'L1 Bidder',
    fullName: 'Lowest Compliant Bidder (न्यूनतम मूल्य विक्रेता)',
    definition: 'The supplier offering the lowest total landed cost (Base price + GST + Freight) strictly conforming to all mandatory technical specifications.',
    hindiHint: 'नियमों के अनुसार सबसे कम दाम देने वाला विक्रेता, जिसे ऑर्डर मिलने की पहली प्राथमिकता होती है।',
    whoDoesWhat: 'Evaluated automatically by system formula; Buyer awards contract to L1.'
  },
  PAC: {
    term: 'PAC',
    fullName: 'Proprietary Article Certificate (एकमात्र निर्माता प्रमाणपत्र)',
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
    fullName: 'Two-Envelope Evaluation (दो-लिफाफा प्रणाली)',
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
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanKey = String(term || '').trim().toUpperCase().replace(/[\s-]/g, '_');
  const entry = GLOSSARY_DICTIONARY[cleanKey] || {
    term,
    fullName: term,
    definition: 'Enterprise procurement terminology used in government and MSME contracting.'
  };

  useEffect(() => {
    if (!isOpen) return;
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
          'inline-flex items-center gap-1 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-0.5',
          showIconOnly
            ? 'text-slate-400 hover:text-blue-600'
            : 'text-xs font-semibold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-md border border-slate-200'
        )}
      >
        {!showIconOnly && <span>{badgeLabel || entry.term}</span>}
        <HelpCircle className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 sm:w-80 rounded-2xl border border-blue-200 bg-white p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <Info className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
              <h4 className="text-xs font-black text-slate-900 leading-tight">
                {entry.fullName}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
              aria-label="Close explanation"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-2 text-xs font-medium text-slate-700 leading-relaxed">
            {entry.definition}
          </p>

          {entry.hindiHint && (
            <div className="mt-2 rounded-lg bg-amber-50/80 border border-amber-200/60 p-2 text-[11px] font-medium text-amber-900 leading-snug">
              💡 {entry.hindiHint}
            </div>
          )}

          {entry.whoDoesWhat && (
            <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Role: <span className="text-slate-700 normal-case font-semibold">{entry.whoDoesWhat}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProcurementGlossaryTooltip;
