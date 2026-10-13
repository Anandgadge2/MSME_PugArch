'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Pencil, Lock, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

export interface EditProcurementGraceBannerProps {
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  postPublishEditCount?: number;
  participantsCount?: number;
  status?: string;
  onEditClick: () => void;
  onCancelClick?: () => void;
  className?: string;
}

export function EditProcurementGraceBanner({
  publishedAt,
  createdAt,
  postPublishEditCount = 0,
  participantsCount = 0,
  status = 'OPEN',
  onEditClick,
  onCancelClick,
  className
}: EditProcurementGraceBannerProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalMs: number } | null>(null);

  const statusUpper = String(status || '').toUpperCase();
  const isPublished = ['PUBLISHED', 'OPEN', 'OPEN_FOR_BIDDING'].includes(statusUpper);

  // Compute reference publish timestamp (fallback to createdAt if publishedAt is absent)
  const publishTimestamp = publishedAt ? new Date(publishedAt).getTime() : (createdAt ? new Date(createdAt).getTime() : null);

  useEffect(() => {
    if (!isPublished || !publishTimestamp) {
      setTimeLeft(null);
      return;
    }

    const calculateRemaining = () => {
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      const elapsed = Date.now() - publishTimestamp;
      const remainingMs = Math.max(0, SIX_HOURS_MS - elapsed);

      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, totalMs: remainingMs });
    };

    calculateRemaining();
    const timer = setInterval(calculateRemaining, 1000);
    return () => clearInterval(timer);
  }, [isPublished, publishTimestamp]);

  // If status is not active published, don't show the grace banner
  if (!isPublished) {
    return null;
  }

  const isTimeValid = Boolean(timeLeft && timeLeft.totalMs > 0);
  const hasZeroBids = Number(participantsCount || 0) === 0;
  const hasZeroEdits = Number(postPublishEditCount || 0) === 0;

  // ALL 3 GATES PASS
  const canEdit = isTimeValid && hasZeroBids && hasZeroEdits;

  // STATE 1: ALL 3 GATES PASS - ACTIVE GRACE EDIT AVAILABLE
  if (canEdit && timeLeft) {
    return (
      <div className={cn(
        "rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/80 p-4 sm:p-4.5 shadow-xs transition-all",
        className
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
              <Clock className="h-4.5 w-4.5 animate-pulse" />
            </span>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black tracking-wide uppercase text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded-md">
                  One-Time Grace Edit Window Active
                </span>
                <span className="text-[11px] font-bold text-blue-700 bg-white/80 border border-blue-200 px-2 py-0.5 rounded-md shadow-2xs">
                  0 of 1 edits used
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed pt-1">
                You can edit this procurement <strong>only once</strong> within the first 6 hours of publishing, provided no quotations have been submitted.
              </p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 pt-1">
                <span className="text-slate-500 font-medium">Window closes in:</span>
                <span className="font-mono bg-blue-600 text-white px-2 py-0.5 rounded text-[11px] font-black tracking-wider">
                  {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:shrink-0 self-end sm:self-center">
            <Button
              type="button"
              onClick={onEditClick}
              className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black tracking-wide shadow-xs hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5 border-none cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Procurement (1 of 1)</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // STATE 2: ALREADY EDITED ONCE
  if (postPublishEditCount > 0) {
    return (
      <div className={cn(
        "rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4 text-xs text-slate-700 flex items-start sm:items-center justify-between gap-3",
        className
      )}>
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-900">Procurement Updated (1/1 edits used)</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              This procurement has already utilized its one-time grace edit. Further edits are locked.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shrink-0">
          <Lock className="h-3 w-3" />
          <span>Edit Limit Reached</span>
        </span>
      </div>
    );
  }

  // STATE 3: QUOTATIONS ALREADY SUBMITTED
  if (!hasZeroBids) {
    return (
      <div className={cn(
        "rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 sm:p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
        className
      )}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-bold text-amber-950">Editing Locked: Quotations Received</span>
            <p className="text-[11px] text-amber-800 mt-0.5">
              {participantsCount} supplier{participantsCount !== 1 ? 's have' : ' has'} already submitted quotations. Editing is disabled to ensure bidding fairness.
            </p>
          </div>
        </div>
        {onCancelClick && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancelClick}
            className="h-8 px-3 rounded-lg border-amber-300 bg-white hover:bg-amber-100/80 text-amber-900 text-xs font-bold shrink-0 self-start sm:self-center cursor-pointer shadow-2xs"
          >
            <Ban className="h-3.5 w-3.5 mr-1 text-amber-700" />
            <span>Cancel &amp; Re-publish</span>
          </Button>
        )}
      </div>
    );
  }

  // STATE 4: TIME EXPIRED (6 HOURS PASSED)
  return (
    <div className={cn(
      "rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
      className
    )}>
      <div className="flex items-start gap-2.5">
        <Lock className="h-4.5 w-4.5 text-slate-500 shrink-0 mt-0.5 sm:mt-0" />
        <div>
          <span className="font-bold text-slate-800">6-Hour Grace Edit Window Closed</span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            The initial 6-hour correction period has expired. To modify specifications, please cancel this procurement and re-publish.
          </p>
        </div>
      </div>
      {onCancelClick && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancelClick}
          className="h-8 px-3 rounded-lg border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold shrink-0 self-start sm:self-center cursor-pointer shadow-2xs"
        >
          <Ban className="h-3.5 w-3.5 mr-1 text-slate-500" />
          <span>Cancel &amp; Re-publish</span>
        </Button>
      )}
    </div>
  );
}

export default EditProcurementGraceBanner;
