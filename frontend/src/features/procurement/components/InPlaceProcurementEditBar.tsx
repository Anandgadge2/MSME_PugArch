'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  Loader2,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

export interface InPlaceProcurementEditBarProps {
  isEditing: boolean;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  isSubmitting?: boolean;
  confirmModalOpen: boolean;
  setConfirmModalOpen: (open: boolean) => void;
  onCancel: () => void;
  onSaveRequest: () => void;
  onConfirmSave: () => void | Promise<void>;
  className?: string;
}

export function InPlaceProcurementEditBar({
  isEditing,
  publishedAt,
  createdAt,
  isSubmitting = false,
  confirmModalOpen,
  setConfirmModalOpen,
  onCancel,
  onSaveRequest,
  onConfirmSave,
  className
}: InPlaceProcurementEditBarProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalMs: number } | null>(null);

  const publishTimestamp = publishedAt ? new Date(publishedAt).getTime() : (createdAt ? new Date(createdAt).getTime() : null);

  useEffect(() => {
    if (!publishTimestamp) {
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
  }, [publishTimestamp]);

  if (!isEditing) return null;

  return (
    <>
      {/* Sticky Edit Session Banner at Top */}
      <div
        role="region"
        aria-label="Procurement Edit Session"
        className={cn(
          "sticky top-16 z-30 mb-4 rounded-2xl border-2 border-indigo-400 bg-gradient-to-r from-indigo-900 via-slate-900 to-[#0b2447] text-white p-4 shadow-xl backdrop-blur-md transition-all",
          className
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-md ring-2 ring-indigo-300/40">
              <Clock className="h-5 w-5 animate-pulse" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-indigo-400/25 border border-indigo-300/40 text-indigo-100 px-2.5 py-0.5 rounded-md">
                  In-Place Edit Mode Active
                </span>
                <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-md">
                  Tab-by-Tab Live Editing
                </span>
                {timeLeft && (
                  <span className="text-[11px] font-mono font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">
                    {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s remaining
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                Directly edit fields across <strong>Overview</strong>, <strong>Scope</strong>, and <strong>Terms</strong> tabs. Click <em>Save &amp; Publish</em> when complete.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              className="h-9 px-3.5 text-xs font-bold border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700 hover:text-white transition shadow-sm rounded-xl cursor-pointer"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel Edit
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSaveRequest}
              disabled={isSubmitting}
              className="h-9 px-4 text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg transition rounded-xl cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save &amp; Publish Version 2
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Accessible Single Confirmation Modal */}
      {confirmModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-edit-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <div className="space-y-1">
                <h3 id="confirm-edit-title" className="text-base font-black text-slate-900 tracking-tight">
                  Publish One-Time Procurement Changes?
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  You are about to publish the revised specifications for this procurement.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Version 2 Increment:</strong> Procurement specifications will be officially incremented to Version 2.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>1 of 1 Edit Utilized:</strong> This exhausts your post-publishing edit allowance. Any subsequent modifications will require issuing a corrigendum or formal cancellation.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Supplier Notification:</strong> All registered and invited suppliers will receive an automatic system notification of the updated terms.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Back to Editing
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onConfirmSave}
                disabled={isSubmitting}
                className="h-9 px-4 text-xs font-black bg-[#12335f] hover:bg-[#0b2447] text-white shadow-md cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    Confirm &amp; Publish Version 2
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default InPlaceProcurementEditBar;
