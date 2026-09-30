'use client';

import React from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  Gavel, 
  FileText, 
  ShieldCheck, 
  Store, 
  CheckCircle2 
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

export interface NextBestActionData {
  id?: string;
  actionKey?: string;
  type?: string;
  title: string;
  description?: string;
  subtitle?: string;
  ctaText?: string;
  actionLabel?: string;
  ctaPath?: string;
  actionHref?: string;
  urgency?: 'critical' | 'high' | 'HIGH' | 'medium' | 'MEDIUM' | 'normal' | 'NORMAL';
  badge?: string;
}

interface NextBestActionBannerProps {
  action?: NextBestActionData | null;
  className?: string;
}

export function NextBestActionBanner({ action, className }: NextBestActionBannerProps) {
  if (!action || !action.title) return null;
  if ((action as any).isClosed || (action as any).status === 'CLOSED') return null;

  const title = action.title;
  const description = action.description || action.subtitle || '';
  const ctaText = action.ctaText || action.actionLabel || 'View Action';
  const ctaPath = action.ctaPath || action.actionHref || '/dashboard';
  const urgencyUpper = String(action.urgency || 'NORMAL').toUpperCase();
  const isCritical = urgencyUpper === 'CRITICAL' || action.actionKey === 'accept_purchase_order' || action.type === 'PURCHASE_ORDER';
  const isHigh = !isCritical && (urgencyUpper === 'HIGH' || action.type === 'REVERSE_AUCTION' || action.type === 'APPROVAL');
  const badge = action.badge || (action.type ? action.type.replace(/_/g, ' ') : 'Recommended Action');

  const getIcon = () => {
    const key = (action.actionKey || action.type || '').toLowerCase();
    if (key.includes('purchase_order') || key.includes('order')) {
      return <AlertTriangle className="h-5 w-5 text-rose-600 animate-pulse" />;
    }
    if (key.includes('reverse_auction') || key.includes('auction')) {
      return <Gavel className="h-5 w-5 text-amber-600 animate-bounce" />;
    }
    if (key.includes('rfq') || key.includes('approval')) {
      return <FileText className="h-5 w-5 text-amber-600" />;
    }
    if (key.includes('onboarding') || key.includes('profile')) {
      return <ShieldCheck className="h-5 w-5 text-blue-600" />;
    }
    if (key.includes('catalogue')) {
      return <Store className="h-5 w-5 text-indigo-600" />;
    }
    return <Sparkles className="h-5 w-5 text-[#12335f]" />;
  };

  return (
    <section
      role="region"
      aria-label="Next Recommended Action"
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all shadow-sm",
        isCritical 
          ? "border-rose-300 bg-gradient-to-r from-rose-50 via-white to-red-50 text-slate-900 shadow-rose-100"
          : isHigh
          ? "border-amber-300 bg-gradient-to-r from-amber-50 via-white to-orange-50 text-slate-900 shadow-amber-100"
          : "border-blue-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/60 text-slate-900",
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Icon + Label + Description */}
        <div className="flex items-start gap-3.5 max-w-3xl">
          <div
            className={cn(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs",
              isCritical
                ? "bg-rose-100 text-rose-700 border border-rose-200"
                : isHigh
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-blue-100 text-[#12335f] border border-blue-200"
            )}
          >
            {getIcon()}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                  isCritical
                    ? "bg-rose-600 text-white"
                    : isHigh
                    ? "bg-amber-500 text-slate-950 font-black"
                    : "bg-[#12335f] text-white"
                )}
              >
                {badge}
              </span>
              <span className="text-xs font-bold text-slate-400">• Priority Guidance</span>
            </div>

            <h3 className="text-base font-extrabold tracking-tight text-slate-900">
              {title}
            </h3>

            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Right: CTA Button */}
        <div className="shrink-0 self-start md:self-center">
          <Link href={ctaPath}>
            <Button
              className={cn(
                "h-10 px-5 rounded-xl font-bold uppercase text-xs tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer",
                isCritical
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/20"
                  : isHigh
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-950/20"
                  : "bg-[#12335f] hover:bg-[#0b2445] text-white shadow-blue-950/20"
              )}
            >
              <span>{ctaText}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default NextBestActionBanner;
