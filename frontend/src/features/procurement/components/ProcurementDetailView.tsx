'use client';

import React from 'react';
import {
  ChevronRight,
  Clock,
  ArrowLeft,
  Check,
  Package,
  Truck,
  ShieldCheck,
  Sliders,
  Wallet,
  FileCheck2,
  FileText,
  ScrollText,
  Sparkles,
  ClipboardList,
  Info,
  CalendarDays,
  IndianRupee,
  Layers,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { formatDate } from '../../shared/format';

/* ── Badge Styles ── */
export const TYPE_BADGE_STYLES: Record<string, string> = {
  rfq: 'border-blue-200 bg-blue-50 text-blue-800',
  rfp: 'border-purple-200 bg-purple-50 text-purple-800',
  tender: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  direct_purchase: 'border-sky-200 bg-sky-50 text-sky-800',
  procurement_request: 'border-violet-200 bg-violet-50 text-violet-800',
  rate_contract: 'border-teal-200 bg-teal-50 text-teal-800',
  reverse_auction: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  bid_tender: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  requirement: 'border-amber-200 bg-amber-50 text-amber-800',
  bid_draft: 'border-slate-200 bg-slate-50 text-slate-700',
  'RFQ': 'border-blue-200 bg-blue-50 text-blue-800',
  'RFP': 'border-purple-200 bg-purple-50 text-purple-800',
  'Reverse Auction': 'border-indigo-200 bg-indigo-50 text-indigo-800',
  'Cart Checkout': 'border-violet-200 bg-violet-50 text-violet-800',
  'OpenTender': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Open Tender': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Draft': 'border-slate-200 bg-slate-50 text-slate-700',
  'Rate Contract': 'border-teal-200 bg-teal-50 text-teal-800',
  'Limited Tender': 'border-amber-200 bg-amber-50 text-amber-800',
  'LimitedTender': 'border-amber-200 bg-amber-50 text-amber-800',
  'Repeat order': 'border-pink-200 bg-pink-50 text-pink-850 text-pink-800',
};

export const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-55/20 text-slate-700',
  pending_approval: 'border-amber-200 bg-amber-55/20 text-amber-800',
  active: 'border-sky-200 bg-sky-55/20 text-sky-850 text-sky-800',
  completed: 'border-emerald-200 bg-emerald-55/20 text-emerald-800',
  cancelled: 'border-red-200 bg-red-55/20 text-red-700',
};

/* ── Formatters ── */
export const formatCurrency = (v: number | string | null | undefined) => {
  const num = Number(v || 0);
  return num ? `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
};

export const formatDateTime = (value?: string) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
    });
  } catch {
    return value;
  }
};

export const parseDescription = (desc?: string) => {
  if (!desc) return { method: '', value: '', urgency: '', text: '' };

  const cleanedDesc = desc.replace(/\r/g, '');

  const methodMatch = cleanedDesc.match(/Sourcing Method:\s*(.*?)(?=(?:Value:|Urgency:|$))/i);
  const valueMatch = cleanedDesc.match(/Value:\s*(.*?)(?=(?:Urgency:|$))/i);
  const urgencyMatch = cleanedDesc.match(/Urgency:\s*(.*?)(?=$)/i);

  let cleanText = cleanedDesc;
  if (methodMatch || valueMatch || urgencyMatch) {
    cleanText = cleanedDesc
      .replace(/Sourcing Method:[^\n]*/gi, '')
      .replace(/Value:[^\n]*/gi, '')
      .replace(/Urgency:[^\n]*/gi, '')
      .replace(/\n+/g, '\n')
      .trim();
  }

  return {
    method: methodMatch ? methodMatch[1].trim() : '',
    value: valueMatch ? valueMatch[1].trim() : '',
    urgency: urgencyMatch ? urgencyMatch[1].trim() : '',
    text: cleanText,
  };
};

export const formatDisplayValue = (val: string, label?: string) => {
  if (!val) return '—';
  if (val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) || val.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return formatDate(val);
  }
  if (val.match(/^[A-Z][A-Z0-9_]*$/)) {
    return val
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  if (val.includes('Sourcing Method:')) {
    const parsed = parseDescription(val);
    return `Sourcing Method: ${parsed.method || '—'}\nValue: ${parsed.value || '—'}\nUrgency: ${parsed.urgency || '—'}`;
  }
  return val;
};

/* ── Cart/Checkout Classification (Source of Truth) ── */
export function isCartCheckoutProcurement(p: any): boolean {
  if (!p) return false;
  const rawType = String(p.type || '').toLowerCase();
  const rawMethod = String(p.method || '').toLowerCase();
  const cm = String(p.canonicalMethod || '').toLowerCase();
  const pt = String(p.procurementType || '').toLowerCase();
  const bt = String(p.bidType || '').toLowerCase();
  const title = String(p.title || '').toLowerCase();
  const typeLabel = String(p.typeLabel || '').toLowerCase();
  const methodLabel = String(p.methodLabel || '').toLowerCase();
  const refNum = String(p.referenceNumber || p.bidNumber || p.id || '').toLowerCase();

  const status = String(p.status || '').toLowerCase();
  const statusGroup = String(p.statusGroup || '').toLowerCase();
  if (status === 'draft' || statusGroup === 'draft' || rawType === 'bid_draft') {
    return false;
  }
  if (
    cm.includes('rate') ||
    rawMethod.includes('rate') ||
    rawType.includes('rate') ||
    title.includes('rate contract') ||
    refNum.startsWith('rc-')
  ) {
    return false;
  }

  return (
    rawType === 'procurement_request' ||
    rawType === 'direct_purchase' ||
    rawType.includes('checkout') ||
    rawType.includes('cart') ||
    rawType.includes('direct') ||
    rawMethod.includes('direct') ||
    rawMethod.includes('cart') ||
    rawMethod.includes('checkout') ||
    cm.includes('direct') ||
    cm.includes('cart') ||
    pt.includes('cart') ||
    pt.includes('checkout') ||
    bt.includes('cart') ||
    bt.includes('checkout') ||
    typeLabel.includes('cart') ||
    typeLabel.includes('checkout') ||
    typeLabel.includes('direct purchase') ||
    methodLabel.includes('direct') ||
    refNum.startsWith('prq-') ||
    refNum.startsWith('dp-')
  );
}

/* ═══════════════════════════════════════════════
   PROCUREMENT DETAIL VIEW (Exact Source of Truth)
   ═══════════════════════════════════════════════ */

export function ProcurementDetailView({
  procurement: p,
  onBack,
  onGoTo,
  breadcrumbParent = 'My Procurements',
}: {
  procurement: any;
  onBack: () => void;
  onGoTo?: () => void;
  breadcrumbParent?: string;
}) {
  /* ── 1. Timeline Calculations (Guaranteed Order) ── */
  const rawSteps =
    p.tracking && p.tracking.length > 0
      ? p.tracking.map((t: any) => ({
          label: t.label,
          date: t.date ? formatDateTime(t.date) : 'Pending',
          isActive: ['completed', 'approved', 'in_progress'].includes(
            String(t.status || '').toLowerCase()
          ),
        }))
      : [
          { label: 'Created', date: formatDateTime(p.createdAt), isActive: true },
          {
            label: 'Submitted',
            date: p.statusGroup !== 'draft' ? formatDateTime(p.updatedAt || p.createdAt) : 'Pending',
            isActive: p.statusGroup !== 'draft',
          },
          {
            label: 'Approval / Review',
            date:
              p.statusGroup === 'pending_approval'
                ? 'In Progress'
                : ['active', 'completed'].includes(p.statusGroup)
                ? formatDateTime(p.updatedAt)
                : 'Pending',
            isActive: ['pending_approval', 'active', 'completed'].includes(p.statusGroup),
          },
          {
            label: 'Approved / Ordered',
            date: p.statusGroup === 'completed' ? formatDateTime(p.updatedAt) : 'Pending',
            isActive: p.statusGroup === 'completed',
          },
        ];

  const lastActiveIndex = rawSteps.map((s: any) => s.isActive).lastIndexOf(true);

  const timelineSteps = rawSteps.map((step: any, idx: number) => {
    let state: 'completed' | 'current' | 'pending' = 'pending';
    if (idx < lastActiveIndex) {
      state = 'completed';
    } else if (idx === lastActiveIndex) {
      state = idx === rawSteps.length - 1 && step.isActive ? 'completed' : 'current';
    }
    return { ...step, state };
  });

  const progressPercent =
    timelineSteps.length > 1
      ? (Math.max(0, lastActiveIndex) / (timelineSteps.length - 1)) * 100
      : 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-200">
      
      {/* ── Breadcrumb Navigation ── */}
      <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 px-1">
        <button
          onClick={onBack}
          className="hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer font-medium"
        >
          {breadcrumbParent}
        </button>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span title={p.referenceNumber || p.title} className="text-slate-600 truncate max-w-[200px] sm:max-w-none font-medium">
          {p.referenceNumber || p.title}
        </span>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="text-blue-950 font-bold bg-blue-50 text-blue-900 px-2 py-0.5 rounded-md border border-blue-100">
          Details
        </span>
      </nav>

      {/* ── Executive Header Banner ── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d213f] via-[#12335f] to-[#1e4976] p-5 md:p-6 text-white shadow-md border border-blue-950/40">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 h-36 w-36 rounded-full bg-emerald-400/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase border backdrop-blur-md',
                  TYPE_BADGE_STYLES[p.type] || 'border-blue-300/30 bg-blue-500/20 text-blue-100'
                )}
              >
                {p.typeLabel || 'PROCUREMENT'}
              </span>

              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border backdrop-blur-md',
                  STATUS_BADGE_STYLES[p.statusGroup] || 'border-emerald-300/40 bg-emerald-500/20 text-emerald-200'
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {p.statusLabel || p.status || 'Active'}
              </span>

              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 text-blue-100 border border-white/10">
                {p.referenceNumber || 'REF-PENDING'}
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white drop-shadow-xs">
              {p.title}
            </h1>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-blue-100/80 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-300" />
                Created {formatDateTime(p.createdAt)}
              </span>
              {p.organizationName && (
                <>
                  <span>•</span>
                  <span>Org: <strong className="text-white">{p.organizationName}</strong></span>
                </>
              )}
              {p.estimatedValue && (
                <>
                  <span>•</span>
                  <span className="text-emerald-300 font-bold">
                    Est. Value: {formatCurrency(p.estimatedValue)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <Button
              type="button"
              onClick={onBack}
              className="h-9 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-sm transition-all shadow-xs active:scale-95"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to List
            </Button>
          </div>
        </div>
      </section>

      {/* ── Compact Stepper Timeline ── */}
      <section className="rounded-xl border border-slate-200/80 bg-white py-3.5 px-4 md:px-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between relative gap-5 md:gap-0">
          
          {/* Horizontal Progress Bar */}
          <div className="hidden md:block absolute top-[16px] left-[36px] right-[36px] h-[3px] bg-slate-100 rounded-full z-0">
            <div
              className="h-full bg-gradient-to-r from-blue-700 to-blue-900 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Vertical Progress Bar (Mobile) */}
          <div className="block md:hidden absolute top-[16px] bottom-[16px] left-[15px] w-[3px] bg-slate-100 rounded-full z-0">
            <div
              className="w-full bg-blue-900 rounded-full transition-all duration-700 ease-out"
              style={{ height: `${progressPercent}%` }}
            />
          </div>

          {timelineSteps.map((step: any, idx: number) => (
            <div
              key={idx}
              className="flex flex-row md:flex-col items-center gap-3 md:gap-1.5 relative z-10 md:w-32 text-left md:text-center group"
            >
              <div className="relative">
                {step.state === 'current' && (
                  <div className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-25 duration-1000" />
                )}

                <div
                  className={cn(
                    'relative flex h-8 w-8 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 shadow-xs z-10',
                    step.state === 'completed'
                      ? 'bg-blue-950 border-blue-950 text-white'
                      : step.state === 'current'
                      ? 'bg-blue-700 border-blue-700 text-white ring-4 ring-blue-100'
                      : 'bg-white border-slate-200 text-slate-300'
                  )}
                >
                  {step.state === 'completed' ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : step.state === 'current' ? (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                <p
                  className={cn(
                    'text-xs font-bold tracking-tight leading-none',
                    step.state === 'current'
                      ? 'text-blue-950 font-extrabold'
                      : step.state === 'completed'
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  )}
                >
                  {step.label}
                </p>
                <p
                  className={cn(
                    'text-[10px] font-medium leading-tight',
                    step.state === 'pending' ? 'text-slate-400' : 'text-slate-500'
                  )}
                >
                  {step.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOQ & Item Specifications Table ── */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-900 text-white shadow-xs">
              <Package className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                ITEM / BOQ SPECIFICATIONS
              </h2>
              <p className="text-[10px] text-slate-500 font-medium leading-none">
                Detailed bill of quantities and compliance specs
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold bg-white text-blue-950 border border-blue-200/80 px-2.5 py-0.5 rounded-md shadow-2xs">
            {(p.items || []).length || 1} {(p.items || []).length === 1 ? 'Item' : 'Items'} Listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                <th className="px-3 py-2.5 min-w-[200px]">Item Name & Description</th>
                <th className="px-3 py-2.5 min-w-[150px]">Technical Specifications</th>
                <th className="px-3 py-2.5 min-w-[130px]">Brand / Make</th>
                <th className="px-3 py-2.5 min-w-[110px]">HSN / Tax</th>
                <th className="px-3 py-2.5 w-20 text-center">Quantity</th>
                <th className="px-3 py-2.5 w-28 text-right">Unit Price</th>
                <th className="px-3 py-2.5 w-28 text-right bg-emerald-50/40">Total Amount</th>
                <th className="px-3 py-2.5 min-w-[130px] text-center">Warranty & SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {p.items && p.items.length > 0 ? (
                p.items.map((item: any, idx: number) => {
                  const spec = item.specifications || {};
                  const unitPrice = item.estimatedUnitPrice || item.price || item.unitPrice || 0;
                  const qty = Number(item.quantity || 1);
                  const totalPrice = unitPrice ? unitPrice * qty : 0;
                  const hsn = spec.hsn_sac_code || spec.hsn || '—';
                  const gst =
                    spec.gst !== undefined
                      ? `${spec.gst}%`
                      : spec.gstPercent
                      ? `${spec.gstPercent}%`
                      : '18%';

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-blue-50/20 transition-colors align-top group"
                    >
                      <td className="px-3 py-3 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 space-y-1">
                        <p className="font-bold text-slate-900 group-hover:text-blue-900 transition-colors">
                          {item.itemName}
                        </p>
                        {item.description && (
                          <p title={item.description} className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-slate-600">
                        <span className="bg-slate-100/80 px-2 py-0.5 rounded text-slate-700 border border-slate-200/60 inline-block">
                          {spec.technicalSpecs || item.technicalSpecs || 'Refer to BOQ'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[11px] space-y-1 text-slate-700">
                        <div>
                          <span className="text-slate-400">Make:</span>{' '}
                          <span className="font-bold text-slate-800">
                            {spec.brand_preference || item.brand || 'Any Standard'}
                          </span>
                        </div>
                        <div className="text-[10px]">
                          <span className="text-slate-400">Alt Allowed:</span>{' '}
                          <span
                            className={cn(
                              'font-bold px-1.5 py-0.2 rounded text-[10px]',
                              spec.brand_flexible?.toLowerCase() === 'no'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-emerald-50 text-emerald-700'
                            )}
                          >
                            {spec.brand_flexible?.toLowerCase() === 'no' ? 'No' : 'Yes'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[11px] space-y-0.5 text-slate-700">
                        <div className="font-mono text-slate-600">{hsn}</div>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-bold text-[10px]">
                          GST {gst}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="font-black text-slate-900">{qty}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {item.unitOfMeasure || 'Nos'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800 tabular-nums">
                        {unitPrice ? formatCurrency(unitPrice) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-800 tabular-nums bg-emerald-50/40">
                        {totalPrice
                          ? formatCurrency(totalPrice)
                          : p.estimatedValue
                          ? formatCurrency(p.estimatedValue)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-[11px] space-y-1 text-slate-600">
                        <div className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-[10px]">
                          {spec.warranty || '12M Warranty'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {spec.deliverySchedule || 'Standard SLA'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="hover:bg-slate-50/80">
                  <td className="px-3 py-3 text-center font-bold text-slate-400">1</td>
                  <td className="px-3 py-3">
                    <p className="font-bold text-slate-900">{p.title || 'Procurement Item'}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {p.description || 'Standard procurement items'}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-slate-600">Refer to attached BOQ</td>
                  <td className="px-3 py-3 text-[11px] text-slate-700">Any Standard Make</td>
                  <td className="px-3 py-3 text-[11px] text-slate-700">GST 18%</td>
                  <td className="px-3 py-3 text-center font-bold">{p.quantity || 1} Nos</td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {p.estimatedValue ? formatCurrency(p.estimatedValue) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-black text-emerald-800 bg-emerald-50/40">
                    {p.estimatedValue ? formatCurrency(p.estimatedValue) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-[11px] text-slate-600">12 Months</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Rich Multi-Tonal Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Delivery & Consignee (Blue Tone) */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/40 to-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-blue-100/80">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800 shrink-0">
              <Truck className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider">
              Delivery & Consignee
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="bg-white/80 p-2 rounded-lg border border-blue-100/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Delivery Location
              </span>
              <p className="font-semibold text-slate-800 leading-snug mt-0.5">
                {p.deliveryLocation || 'Mahabad: Jalgaon, Maharashtra - 425001'}
              </p>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
              <span className="text-slate-500 font-medium">Delivery Period</span>
              <span className="font-bold text-slate-900 bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-100">
                {p.endDate ? formatDateTime(p.endDate) : '7 Working Days'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 text-[11px]">
              <span className="text-slate-500 font-medium">Consignee</span>
              <span title={p.organizationName || 'VANSIKA DAWANI'} className="font-bold text-slate-800 truncate max-w-[140px]">
                {p.organizationName || 'VANSIKA DAWANI'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Supplier Eligibility (Teal/Emerald Tone) */}
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-emerald-100/80">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
              Eligibility & Rules
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">MSME Pref.</span>
                <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 text-xs mt-0.5">
                  <Check className="h-3 w-3" /> Applicable
                </span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Vendor Selection</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">Open Bidding</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
              <span className="text-slate-500 font-medium">Exclude Blacklisted</span>
              <span className="font-bold text-emerald-700">Yes</span>
            </div>
            <div className="flex justify-between items-center py-1 text-[11px]">
              <span className="text-slate-500 font-medium">Exp. Required</span>
              <span className="font-bold text-slate-800">0 Years (Open to all)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Evaluation Criteria (Purple Tone) */}
        <div className="rounded-xl border border-purple-100 bg-gradient-to-b from-purple-50/40 to-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-purple-100/80">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-800 shrink-0">
              <Sliders className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider">
              Evaluation Basis
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="bg-white/80 p-2 rounded-lg border border-purple-100/60 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Method</span>
              <span className="font-bold text-purple-950 text-xs">
                {(() => {
                  const raw = (p as any).evaluationMethod || (p as any).payload?.evaluation?.method || (p as any).payload?.evaluationMethod || (p as any).payload?.rules?.evaluationMethod;
                  if (!raw) return 'L1 Total Value';
                  const lower = String(raw).toLowerCase();
                  if (lower.includes('qcbs') || lower.includes('quality and cost') || lower.includes('weighted technical')) return 'Quality and Cost Based Selection (QCBS)';
                  if (lower.includes('item-wise') || lower.includes('item wise')) return 'Item-wise L1';
                  if (lower.includes('package-wise') || lower.includes('package wise')) return 'Package-wise L1';
                  if (lower.includes('technical qualification')) return 'Technical Qualification then L1';
                  if (lower.includes('reverse auction')) return 'Reverse Auction Final Bid Rank';
                  if (lower.includes('lowest landed cost')) return 'Lowest Landed Cost';
                  if (lower === 'l1' || lower === 'l1 basis') return 'L1 Basis';
                  return String(raw);
                })()}
              </span>
            </div>
            {String((p as any).evaluationMethod || (p as any).payload?.evaluation?.method || '').toLowerCase().includes('qcbs') ? (
              <>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
                  <span className="text-slate-500 font-medium">Technical Weight</span>
                  <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                    {(p as any).payload?.evaluation?.techWeight ?? 70}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 text-[11px]">
                  <span className="text-slate-500 font-medium">Commercial Weight</span>
                  <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                    {(p as any).payload?.evaluation?.commWeight ?? 30}%
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center py-1 text-[11px]">
                <span className="text-slate-500 font-medium">Selection Rule</span>
                <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                  Lowest Landed Cost (L1)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Financial Summary (Amber Tone) */}
        <div className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-amber-200/60">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 shrink-0">
              <Wallet className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
              Financial Terms
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="bg-amber-100/40 p-2 rounded-lg border border-amber-200/70 flex justify-between items-center">
              <span className="text-[10px] font-bold text-amber-900 uppercase">Est. Budget</span>
              <span className="font-black text-emerald-800 text-sm">
                {p.estimatedValue ? formatCurrency(p.estimatedValue) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]">
              <span className="text-slate-500 font-medium">EMD Amount</span>
              <span className="font-bold text-slate-800">Exempted</span>
            </div>
            <div className="flex justify-between items-center py-1 text-[11px]">
              <span className="text-slate-500 font-medium">Freight Charges</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                Included in Price
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Lower 2-Column Grid: Compliance & Terms ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Required Documents */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <FileCheck2 className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Mandatory Seller Documents
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">8 Required</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              'GST Certificate',
              'PAN Card',
              'Bank Details',
              'Compliance Sheet',
              'Price Breakup',
              'Experience Cert',
              'Turnover Cert',
              'No-Deviation',
            ].map((docName, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-700 hover:bg-blue-50/50 hover:border-blue-200 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span title={docName} className="truncate">{docName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <ScrollText className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Contract Terms & Permissions
              </h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              Standard SLA
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Withdrawal</span>
              <span className="text-xs font-extrabold text-emerald-700">Allowed</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Bid Revision</span>
              <span className="text-xs font-extrabold text-emerald-700">Allowed</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Seller Queries</span>
              <span className="text-xs font-extrabold text-emerald-700">Allowed</span>
            </div>
          </div>

          {p.termsAndConditions && p.termsAndConditions.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
                {p.termsAndConditions.map((term: string, idx: number) => (
                  <li key={idx} className="leading-tight">{term}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>

      {/* ── Dynamic Additional Specification Cards (If Present) ── */}
      {p.detailSections && p.detailSections.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-800" />
              Additional Procurement Parameters
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
              {p.detailSections.length} Sections
            </span>
          </div>

          <div className="columns-1 md:columns-2 gap-4 space-y-4 [&>div]:break-inside-avoid-column">
            {p.detailSections.map((section: any, idx: number) => {
              const getSectionIcon = (title: string) => {
                const t = title.toLowerCase();
                if (t.includes('intent') || t.includes('scope')) return ClipboardList;
                if (t.includes('buyer') || t.includes('user') || t.includes('contact') || t.includes('org')) return Info;
                if (t.includes('item') || t.includes('qty')) return Package;
                if (t.includes('date') || t.includes('time') || t.includes('schedule')) return CalendarDays;
                if (t.includes('price') || t.includes('budget') || t.includes('cost') || t.includes('value')) return IndianRupee;
                return Layers;
              };

              const SectionIcon = getSectionIcon(section.title);

              const longTextFields = section.fields.filter((f: any) => {
                const val = String(f.value || '');
                return (
                  val.length > 80 ||
                  f.label.toLowerCase().includes('description') ||
                  f.label.toLowerCase().includes('scope') ||
                  f.label.toLowerCase().includes('notes')
                );
              });

              const propertyFields = section.fields.filter((f: any) => !longTextFields.includes(f));

              return (
                <div
                  key={`${section.title}-${idx}`}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3 inline-block w-full"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-900 font-bold shrink-0">
                        <SectionIcon className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        {section.title}
                      </h3>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {section.fields.length} params
                    </span>
                  </div>

                  {propertyFields.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {propertyFields.map((field: any, fieldIdx: number) => (
                        <div
                          key={fieldIdx}
                          className="bg-slate-50/60 p-2 rounded-lg border border-slate-100 space-y-0.5"
                        >
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            {field.label}
                          </span>
                          <p title={formatDisplayValue(field.value, field.label)} className="text-xs font-bold text-slate-800 truncate">
                            {formatDisplayValue(field.value, field.label)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {longTextFields.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {longTextFields.map((field: any, fieldIdx: number) => (
                        <div
                          key={fieldIdx}
                          className="p-2.5 rounded-lg bg-blue-50/30 border border-blue-100/60 space-y-1"
                        >
                          <span className="text-[10px] font-bold uppercase text-blue-900 tracking-wider block">
                            {field.label}
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {formatDisplayValue(field.value, field.label)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
