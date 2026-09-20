"use client";

import React, { useState, useEffect, useId, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  AlertCircle,
  X,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { FocusTrap } from "../../../components/ui/FocusTrap";
import { Button } from "../../../components/ui/button";
import { procurementBidApi } from "../../procurementBid/api";
import { toast } from "sonner";
import { formatDateTime, formatDate } from "../../shared/format";

export interface ExtendScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bidId: string | number;
  bidTitle?: string;
  bidNumber?: string;
  currentSchedule: {
    closingDate?: string | Date | null;
    technicalOpeningDate?: string | Date | null;
    financialOpeningDate?: string | Date | null;
    requiredByDate?: string | Date | null;
    bidValidityDate?: string | Date | null;
    validityDays?: number | string | null;
  };
  onSuccess?: (updatedBid?: any) => void;
}

const toInputDateTime = (dateVal?: string | Date | null): string => {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toInputDate = (dateVal?: string | Date | null): string => {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const ExtendScheduleModal: React.FC<ExtendScheduleModalProps> = ({
  isOpen,
  onClose,
  bidId,
  bidTitle,
  bidNumber,
  currentSchedule,
  onSuccess,
}) => {
  const modalTitleId = useId();
  const modalDescId = useId();

  // Baseline dates
  const initialClosing = useMemo(
    () => toInputDateTime(currentSchedule.closingDate),
    [currentSchedule.closingDate],
  );
  const initialTech = useMemo(
    () => toInputDateTime(currentSchedule.technicalOpeningDate),
    [currentSchedule.technicalOpeningDate],
  );
  const initialFin = useMemo(
    () => toInputDateTime(currentSchedule.financialOpeningDate),
    [currentSchedule.financialOpeningDate],
  );
  const initialReqBy = useMemo(
    () => toInputDate(currentSchedule.requiredByDate),
    [currentSchedule.requiredByDate],
  );
  const initialValidity = useMemo(
    () => toInputDate(currentSchedule.bidValidityDate),
    [currentSchedule.bidValidityDate],
  );

  // Form State
  const [closingDate, setClosingDate] = useState<string>("");
  const [technicalOpeningDate, setTechnicalOpeningDate] = useState<string>("");
  const [financialOpeningDate, setFinancialOpeningDate] = useState<string>("");
  const [requiredByDate, setRequiredByDate] = useState<string>("");
  const [bidValidityDate, setBidValidityDate] = useState<string>("");
  const [autoCascade, setAutoCascade] = useState<boolean>(true);
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize or reset fields on modal open
  useEffect(() => {
    if (isOpen) {
      setClosingDate(initialClosing);
      setTechnicalOpeningDate(initialTech);
      setFinancialOpeningDate(initialFin);
      setRequiredByDate(initialReqBy);
      setBidValidityDate(initialValidity);
      setReason("");
      setFormError(null);
      setAutoCascade(true);
    }
  }, [isOpen, initialClosing, initialTech, initialFin, initialReqBy, initialValidity]);

  // Handle closing date change with smart auto-cascade
  const handleClosingDateChange = (newClosingStr: string) => {
    setClosingDate(newClosingStr);
    setFormError(null);

    if (!autoCascade || !newClosingStr || !initialClosing) return;

    const baseClosingTime = new Date(initialClosing).getTime();
    const newClosingTime = new Date(newClosingStr).getTime();
    if (isNaN(baseClosingTime) || isNaN(newClosingTime)) return;

    const deltaMs = newClosingTime - baseClosingTime;
    if (deltaMs <= 0) return;

    // Cascade Technical Opening Date
    if (initialTech) {
      const baseTechTime = new Date(initialTech).getTime();
      if (!isNaN(baseTechTime)) {
        setTechnicalOpeningDate(toInputDateTime(new Date(baseTechTime + deltaMs)));
      }
    } else {
      setTechnicalOpeningDate(toInputDateTime(new Date(newClosingTime + 30 * 60000)));
    }

    // Cascade Financial Opening Date
    if (initialFin) {
      const baseFinTime = new Date(initialFin).getTime();
      if (!isNaN(baseFinTime)) {
        setFinancialOpeningDate(toInputDateTime(new Date(baseFinTime + deltaMs)));
      }
    }

    // Cascade Required-By Date
    if (initialReqBy) {
      const baseReqTime = new Date(initialReqBy).getTime();
      if (!isNaN(baseReqTime)) {
        setRequiredByDate(toInputDate(new Date(baseReqTime + deltaMs)));
      }
    }

    // Cascade Bid Validity Date
    const valDays = Number(currentSchedule.validityDays);
    if (!isNaN(valDays) && valDays > 0) {
      const calcValidityTime = newClosingTime + valDays * 86400000;
      setBidValidityDate(toInputDate(new Date(calcValidityTime)));
    } else if (initialValidity) {
      const baseValTime = new Date(initialValidity).getTime();
      if (!isNaN(baseValTime)) {
        setBidValidityDate(toInputDate(new Date(baseValTime + deltaMs)));
      }
    }
  };

  // Validation
  const validateForm = (): string | null => {
    if (!closingDate) {
      return "Please select a new submission closing date & time.";
    }

    const newClosingTime = new Date(closingDate).getTime();
    if (isNaN(newClosingTime)) {
      return "Invalid submission closing date format.";
    }

    if (newClosingTime <= Date.now()) {
      return "The new submission closing date must be strictly in the future.";
    }

    if (initialClosing) {
      const oldClosingTime = new Date(initialClosing).getTime();
      if (!isNaN(oldClosingTime) && newClosingTime <= oldClosingTime) {
        return "The new submission closing date must be later than the current deadline.";
      }
    }

    if (technicalOpeningDate) {
      const techTime = new Date(technicalOpeningDate).getTime();
      if (!isNaN(techTime) && techTime < newClosingTime) {
        return "Technical opening date cannot be earlier than the submission closing date.";
      }
    }

    if (financialOpeningDate) {
      const finTime = new Date(financialOpeningDate).getTime();
      const techTime = technicalOpeningDate ? new Date(technicalOpeningDate).getTime() : NaN;
      const minFin = !isNaN(techTime) ? techTime : newClosingTime;
      if (!isNaN(finTime) && finTime < minFin) {
        return "Financial opening date cannot be earlier than the technical opening date.";
      }
    }

    if (requiredByDate) {
      const reqTime = new Date(requiredByDate).getTime();
      if (!isNaN(reqTime) && reqTime < newClosingTime) {
        return "Required-by delivery date cannot be earlier than the submission closing date.";
      }
    }

    if (bidValidityDate) {
      const valTime = new Date(bidValidityDate).getTime();
      if (!isNaN(valTime) && valTime < newClosingTime) {
        return "Bid validity expiry date cannot be earlier than the submission closing date.";
      }
    }

    if (!reason.trim() || reason.trim().length < 5) {
      return "Please provide an extension reason or corrigendum remarks (minimum 5 characters).";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validateForm();
    if (errorMsg) {
      setFormError(errorMsg);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        closingDate: new Date(closingDate).toISOString(),
        technicalOpeningDate: technicalOpeningDate
          ? new Date(technicalOpeningDate).toISOString()
          : null,
        financialOpeningDate: financialOpeningDate
          ? new Date(financialOpeningDate).toISOString()
          : null,
        requiredByDate: requiredByDate
          ? new Date(requiredByDate).toISOString()
          : null,
        bidValidityDate: bidValidityDate
          ? new Date(bidValidityDate).toISOString()
          : null,
        reason: reason.trim(),
      };

      const updated = await procurementBidApi.extendBidSchedule(bidId, payload);
      toast.success("Schedule extended successfully! Corrigendum notice issued.");
      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err: any) {
      const msg =
        err?.message || err?.error || "Failed to extend schedule. Please try again.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      aria-describedby={modalDescId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <FocusTrap onEscape={onClose}>
        <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id={modalTitleId}
                  className="text-base sm:text-lg font-black tracking-tight text-slate-900"
                >
                  Extend Tender Schedule &amp; Milestones
                </h2>
                <p id={modalDescId} className="text-xs text-slate-500 mt-0.5">
                  Manual corrigendum extension for buyers. Submitted supplier bids remain valid.
                  {bidNumber && (
                    <span className="font-mono font-bold text-slate-700 ml-1">
                      ({bidNumber})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Current Baseline Summary */}
          <div className="mt-4 rounded-xl bg-slate-50 p-3.5 border border-slate-150 text-xs">
            <p className="font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              Current Active Milestones
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600">
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400 block">
                  Closing Deadline:
                </span>
                <span className="font-semibold text-slate-900">
                  {currentSchedule.closingDate
                    ? formatDateTime(currentSchedule.closingDate)
                    : "Not set"}
                </span>
              </div>
              {currentSchedule.technicalOpeningDate && (
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">
                    Technical Opening:
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatDateTime(currentSchedule.technicalOpeningDate)}
                  </span>
                </div>
              )}
              {currentSchedule.financialOpeningDate && (
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">
                    Financial Opening:
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatDateTime(currentSchedule.financialOpeningDate)}
                  </span>
                </div>
              )}
              {currentSchedule.requiredByDate && (
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">
                    Required-By Delivery:
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatDate(currentSchedule.requiredByDate)}
                  </span>
                </div>
              )}
              {currentSchedule.bidValidityDate && (
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">
                    Validity Expiry:
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatDate(currentSchedule.bidValidityDate)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {formError && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 flex items-start gap-2 animate-fadeIn"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Auto-cascade helper toggle */}
            <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-2.5">
              <label
                htmlFor="auto-cascade-checkbox"
                className="text-xs font-bold text-indigo-950 flex items-center gap-2 cursor-pointer select-none"
              >
                <input
                  id="auto-cascade-checkbox"
                  type="checkbox"
                  checked={autoCascade}
                  onChange={(e) => setAutoCascade(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                Auto-cascade downstream milestones
              </label>
              <span className="text-[11px] font-medium text-indigo-700 hidden sm:inline">
                Shifts technical, financial, and delivery dates forward by the same duration
              </span>
            </div>

            {/* Closing Date Picker */}
            <div>
              <label
                htmlFor="extend-closing-date-input"
                className="block text-xs font-bold text-slate-800 mb-1"
              >
                New Submission Closing Date &amp; Time <span className="text-rose-500">*</span>
              </label>
              <input
                id="extend-closing-date-input"
                type="datetime-local"
                value={closingDate}
                onChange={(e) => handleClosingDateChange(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Vendors cannot submit new bids or revise existing proposals once this clock expires.
              </p>
            </div>

            {/* Downstream Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label
                  htmlFor="extend-tech-date-input"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Technical Opening Date &amp; Time
                </label>
                <input
                  id="extend-tech-date-input"
                  type="datetime-local"
                  value={technicalOpeningDate}
                  onChange={(e) => setTechnicalOpeningDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
                />
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  Must be on or after the new closing date.
                </p>
              </div>

              <div>
                <label
                  htmlFor="extend-fin-date-input"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Financial Opening Date &amp; Time
                </label>
                <input
                  id="extend-fin-date-input"
                  type="datetime-local"
                  value={financialOpeningDate}
                  onChange={(e) => setFinancialOpeningDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
                />
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  Must be on or after technical opening.
                </p>
              </div>

              <div>
                <label
                  htmlFor="extend-reqby-date-input"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Required-By / Delivery Date
                </label>
                <input
                  id="extend-reqby-date-input"
                  type="date"
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
                />
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  Contractual goods/services delivery deadline.
                </p>
              </div>

              <div>
                <label
                  htmlFor="extend-validity-date-input"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Bid Validity Expiry Date
                </label>
                <input
                  id="extend-validity-date-input"
                  type="date"
                  value={bidValidityDate}
                  onChange={(e) => setBidValidityDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
                />
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  Validity guarantee period for submitted quotes.
                </p>
              </div>
            </div>

            {/* Extension Reason / Corrigendum remarks */}
            <div>
              <label
                htmlFor="extend-reason-textarea"
                className="block text-xs font-bold text-slate-800 mb-1"
              >
                Extension Reason / Corrigendum Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="extend-reason-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="e.g. Extended submission deadline by 7 days to facilitate wider vendor participation following pre-bid queries..."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none resize-none"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                This notice will be recorded in the audit trail and emailed to all participating suppliers.
              </p>
            </div>

            {/* Notice */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong>Non-Destructive Extension:</strong> All suppliers who have already submitted bids will remain validly submitted. They will be notified of the extended deadline and may revise their bids if desired.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md gap-1.5 cursor-pointer rounded-lg transition-transform active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Publishing Corrigendum...
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    Save &amp; Issue Corrigendum
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>
  );
};
export default ExtendScheduleModal;
