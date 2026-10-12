'use client';

import React from 'react';
import { AlertTriangle, Pencil, Loader2, X, ShieldAlert } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export interface ConfirmOneTimeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  procurementTitle?: string;
  referenceNumber?: string;
  isSubmitting?: boolean;
}

export function ConfirmOneTimeEditModal({
  isOpen,
  onClose,
  onConfirm,
  procurementTitle,
  referenceNumber,
  isSubmitting = false
}: ConfirmOneTimeEditModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-edit-title"
    >
      <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0 shadow-2xs">
              <Pencil className="h-5 w-5" />
            </span>
            <div>
              <h2 id="confirm-edit-title" className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                Confirm One-Time Grace Edit
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Ref: <span className="font-mono font-bold text-slate-700">{referenceNumber || 'Procurement'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Title snippet */}
        {procurementTitle && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-800 line-clamp-2">
            {procurementTitle}
          </div>
        )}

        {/* Warning callout */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Strict One-Time Edit Policy</span>
          </div>
          <ul className="list-disc pl-5 space-y-1.5 text-amber-850 font-medium leading-relaxed">
            <li>
              <strong>This is your ONLY permitted edit.</strong> Once confirmed, this procurement cannot be edited again under any circumstance.
            </li>
            <li>
              <strong>Supplier Update Notice:</strong> An email and in-app notification with your revised details will be dispatched to all matching eligible suppliers.
            </li>
            <li>
              <strong>Audit Trail:</strong> The version will increment to V2, and all modifications will be recorded in the official audit log.
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-4 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Keep Reviewing
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              await onConfirm();
            }}
            className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black tracking-wide shadow-xs active:scale-95 border-none cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Publishing Updates...</span>
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                <span>Yes, Publish Final Update</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
