import React from 'react';
import { Gavel } from 'lucide-react';
import { cn } from '../../lib/utils';

export type OpportunityType =
  | 'RFQ'
  | 'RFP'
  | 'Open Tender'
  | 'Limited Tender'
  | 'Reverse Auction'
  | 'Direct Purchase'
  | 'Rate Contract'
  | 'Repeat Order'
  | 'Cart Checkout'
  | 'Tender'
  | 'OpenTender'
  | 'LimitedTender'
  | 'RFQ + RA'
  | 'RFP + RA'
  | 'Open Tender + RA'
  | 'Limited Tender + RA'
  | 'Rate Contract + RA'
  | 'Tender + RA'
  | string;

export function TypeBadge({ type, className }: { type: OpportunityType; className?: string }) {
  const rawType = String(type || '').trim();
  const isPlusRa = /(\s*\+\s*RA)/i.test(rawType);
  const baseType = rawType.replace(/(\s*\+\s*RA)+$/gi, '').trim() || 'Procurement';

  const getBaseColorClass = (t: string) => {
    const norm = t.toLowerCase();
    if (norm === 'rfq') return 'border-orange-200 bg-orange-50 text-orange-700';
    if (norm === 'rfp') return 'border-purple-200 bg-purple-50 text-purple-700';
    if (norm.includes('open tender') || norm === 'opentender' || norm === 'tender') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (norm.includes('limited tender') || norm === 'limitedtender') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (norm.includes('rate contract')) return 'border-teal-200 bg-teal-50 text-teal-800';
    if (norm.includes('cart checkout') || norm.includes('direct purchase')) return 'border-violet-200 bg-violet-50 text-violet-800';
    if (norm.includes('repeat order')) return 'border-pink-200 bg-pink-50 text-pink-800';
    if (norm.includes('reverse auction') || norm === 'auction') return 'border-red-200 bg-red-50 text-red-700';
    return 'border-slate-200 bg-slate-50 text-slate-700';
  };

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <span className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider border whitespace-nowrap",
        getBaseColorClass(baseType)
      )}>
        {baseType}
      </span>
      {isPlusRa && (
        <span className="inline-flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-700 shrink-0 shadow-2xs whitespace-nowrap">
          <Gavel className="h-2.5 w-2.5 text-rose-600" aria-hidden="true" />
          + RA
        </span>
      )}
    </div>
  );
}

export default TypeBadge;
