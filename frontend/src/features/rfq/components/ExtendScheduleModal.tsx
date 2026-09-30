"use client";

import React, { useState, useEffect, useId, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  ShieldAlert,
  Layers,
  Info,
} from "lucide-react";
import { FocusTrap } from "../../../components/ui/FocusTrap";
import { Button } from "../../../components/ui/button";
import { DateTimePicker } from "../../../components/ui/DateTimePicker";
import { procurementBidApi } from "../../procurementBid/api";
import { toast } from "sonner";
import { formatDateTime, formatDate } from "../../shared/format";

export interface ExtendScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bidId: string | number;
  bidTitle?: string;
  bidNumber?: string;
  packetType?: string;
  procurementType?: string;
  isTwoPacket?: boolean;
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
  packetType,
  procurementType,
  isTwoPacket,
  currentSchedule,
  onSuccess,
}) => {
  const modalTitleId = useId();
  const modalDescId = useId();

  // Resolve whether this procurement is Two Packet (Technical + Financial) or Single Envelope
  const isTwoPacketMode = useMemo(() => {
    if (typeof isTwoPacket === "boolean") return isTwoPacket;
    if (packetType) {
      const ptUpper = String(packetType).toUpperCase();
      if (ptUpper.includes("TWO") || ptUpper === "2") return true;
      if (ptUpper.includes("SINGLE") || ptUpper === "1") return false;
    }
    if (procurementType) {
      const procUpper = String(procurementType).toUpperCase();
      if (procUpper.includes("TWO_PACKET") || procUpper.includes("TWO PACKET")) return true;
      if (
        procUpper === "RFQ" ||
        procUpper.includes("DIRECT_PURCHASE") ||
        procUpper.includes("RATE_CONTRACT") ||
        procUpper.includes("REVERSE_AUCTION")
      ) {
        // These methods default to single envelope unless financial opening is present
        if (!currentSchedule.financialOpeningDate) return false;
      }
    }
    // If there is an existing financial opening date from DB/schedule, it is two packet
    return Boolean(currentSchedule.financialOpeningDate);
  }, [isTwoPacket, packetType, procurementType, currentSchedule.financialOpeningDate]);

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
    () => (isTwoPacketMode ? toInputDateTime(currentSchedule.financialOpeningDate) : ""),
    [currentSchedule.financialOpeningDate, isTwoPacketMode],
  );
  const initialReqBy = useMemo(
    () => toInputDateTime(currentSchedule.requiredByDate),
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

  const isPastDeadline = Boolean(
    initialClosing && new Date(initialClosing).getTime() <= Date.now()
  );

  // Initialize or reset fields on modal open
  useEffect(() => {
    if (isOpen) {
      if (isPastDeadline) {
        const futureDate = new Date(Date.now() + 7 * 86400000);
        futureDate.setHours(17, 0, 0, 0);
        const defaultClosing = toInputDateTime(futureDate);
        setClosingDate(defaultClosing);

        const oldClosingMs = initialClosing ? new Date(initialClosing).getTime() : Date.now();
        const deltaMs = futureDate.getTime() - oldClosingMs;

        if (initialTech) {
          const oldTechMs = new Date(initialTech).getTime();
          setTechnicalOpeningDate(toInputDateTime(new Date(oldTechMs + deltaMs)));
        } else {
          setTechnicalOpeningDate(toInputDateTime(new Date(futureDate.getTime() + 30 * 60000)));
        }

        if (isTwoPacketMode) {
          if (initialFin) {
            const oldFinMs = new Date(initialFin).getTime();
            setFinancialOpeningDate(toInputDateTime(new Date(oldFinMs + deltaMs)));
          } else {
            const baseTechOrClosing = initialTech
              ? new Date(initialTech).getTime() + deltaMs
              : futureDate.getTime() + 30 * 60000;
            setFinancialOpeningDate(toInputDateTime(new Date(baseTechOrClosing + 7 * 86400000)));
          }
        } else {
          setFinancialOpeningDate("");
        }

        if (initialReqBy) {
          const oldReqMs = new Date(initialReqBy).getTime();
          setRequiredByDate(toInputDateTime(new Date(oldReqMs + deltaMs)));
        } else {
          setRequiredByDate("");
        }

        const valDays = Number(currentSchedule.validityDays);
        if (!isNaN(valDays) && valDays > 0) {
          setBidValidityDate(toInputDate(new Date(futureDate.getTime() + valDays * 86400000)));
        } else if (initialValidity) {
          const oldValMs = new Date(initialValidity).getTime();
          setBidValidityDate(toInputDate(new Date(oldValMs + deltaMs)));
        } else {
          setBidValidityDate("");
        }
      } else {
        setClosingDate(initialClosing);
        setTechnicalOpeningDate(initialTech);
        setFinancialOpeningDate(isTwoPacketMode ? initialFin : "");
        setRequiredByDate(initialReqBy);
        setBidValidityDate(initialValidity);
      }
      setReason("");
      setFormError(null);
      setAutoCascade(true);
    }
  }, [
    isOpen,
    initialClosing,
    initialTech,
    initialFin,
    initialReqBy,
    initialValidity,
    isPastDeadline,
    isTwoPacketMode,
  ]);

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

    // Cascade Opening Date (Technical opening for two packet, or Bid opening for single packet)
    if (initialTech) {
      const baseTechTime = new Date(initialTech).getTime();
      if (!isNaN(baseTechTime)) {
        setTechnicalOpeningDate(toInputDateTime(new Date(baseTechTime + deltaMs)));
      }
    } else {
      setTechnicalOpeningDate(toInputDateTime(new Date(newClosingTime + 30 * 60000)));
    }

    // Cascade Financial Opening Date ONLY for Two Packet flow
    if (isTwoPacketMode) {
      if (initialFin) {
        const baseFinTime = new Date(initialFin).getTime();
        if (!isNaN(baseFinTime)) {
          setFinancialOpeningDate(toInputDateTime(new Date(baseFinTime + deltaMs)));
        }
      }
    } else {
      setFinancialOpeningDate("");
    }

    // Cascade Required-By Date
    if (initialReqBy) {
      const baseReqTime = new Date(initialReqBy).getTime();
      if (!isNaN(baseReqTime)) {
        setRequiredByDate(toInputDateTime(new Date(baseReqTime + deltaMs)));
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

    if (initialClosing && !isPastDeadline) {
      const oldClosingTime = new Date(initialClosing).getTime();
      if (!isNaN(oldClosingTime) && newClosingTime <= oldClosingTime) {
        return "The new submission closing date must be later than the current deadline.";
      }
    }

    if (technicalOpeningDate) {
      const openTime = new Date(technicalOpeningDate).getTime();
      if (!isNaN(openTime) && openTime < newClosingTime) {
        return isTwoPacketMode
          ? "Technical opening date cannot be earlier than the submission closing date."
          : "Bid opening date cannot be earlier than the submission closing date.";
      }
    }

    if (isTwoPacketMode && financialOpeningDate) {
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
        financialOpeningDate:
          isTwoPacketMode && financialOpeningDate
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
      toast.success(
        "Schedule extended successfully! Corrigendum notice issued. Tender is now OPEN for submissions.",
      );
      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
      // Force page reload so all date-dependent calculations and caches refresh cleanly
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 700);
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
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id={modalTitleId}
                    className="text-base sm:text-lg font-black tracking-tight text-slate-900"
                  >
                    Extend Tender Schedule &amp; Milestones
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      isTwoPacketMode
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    <Layers className="h-3 w-3" aria-hidden="true" />
                    {isTwoPacketMode ? "Two Packet Envelope" : "Single Packet Envelope"}
                  </span>
                  {procurementType && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {procurementType}
                    </span>
                  )}
                </div>
                <p id={modalDescId} className="text-xs text-slate-500 mt-1">
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

          {/* Envelope Configuration Notice */}
          <div
            className={`mt-3.5 rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
              isTwoPacketMode
                ? "bg-purple-50/70 border-purple-200 text-purple-950"
                : "bg-blue-50/70 border-blue-200 text-blue-950"
            }`}
          >
            <Info
              className={`h-4 w-4 shrink-0 mt-0.5 ${
                isTwoPacketMode ? "text-purple-600" : "text-blue-600"
              }`}
              aria-hidden="true"
            />
            <div className="flex-1">
              <span className="font-bold block mb-0.5">
                {isTwoPacketMode
                  ? "Two Packet Envelope (Technical + Financial Separated)"
                  : "Single Packet Envelope (Commercial / Combined Opening)"}
              </span>
              <p className="text-[11px] leading-relaxed opacity-90">
                {isTwoPacketMode
                  ? "Technical proposals (Cover 1) are unlocked first at the Technical Opening Date. Price bids (Cover 2) are unlocked at Financial Opening only for qualified vendors."
                  : "Under Single Envelope procurement, technical compliance and commercial quotes are submitted together and opened at the Bid Opening Date & Time. There is no separate technical/financial opening split."}
              </p>
            </div>
          </div>

          {/* Current Baseline Summary */}
          <div className="mt-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs">
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
                    {isTwoPacketMode ? "Technical Opening:" : "Bid Opening:"}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatDateTime(currentSchedule.technicalOpeningDate)}
                  </span>
                </div>
              )}
              {isTwoPacketMode && currentSchedule.financialOpeningDate && (
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

          {/* Reopening Notification Banner for Closed/Expired Tenders */}
          {isPastDeadline && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-black text-emerald-900 block mb-0.5">
                  Submission Reopening Mode
                </span>
                <span>
                  The previous submission deadline has expired. Setting a new future deadline will automatically reactivate this tender back to <strong>OPEN</strong> status, allowing suppliers to submit new or revised proposals.
                </span>
              </div>
            </div>
          )}

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
                {isTwoPacketMode
                  ? "Shifts technical, financial, delivery, and validity dates forward by the same duration"
                  : "Shifts bid opening, delivery, and validity dates forward by the same duration"}
              </span>
            </div>

            {/* Closing Date Picker */}
            <div>
              <DateTimePicker
                id="extend-closing-date-input"
                label="New Submission Closing Date & Time"
                labelClassName="text-xs font-bold text-slate-800 mb-1"
                value={closingDate}
                onChange={handleClosingDateChange}
                required
                placeholder="Select submission closing date & time"
                min={new Date().toISOString()}
                hint="Vendors cannot submit new bids or revise existing proposals once this clock expires."
              />
            </div>

            {/* Downstream Dates Grid */}
            <div
              className={`grid grid-cols-1 ${
                isTwoPacketMode ? "sm:grid-cols-2" : "sm:grid-cols-3"
              } gap-3.5 pt-1`}
            >
              <div>
                <DateTimePicker
                  id="extend-tech-date-input"
                  label={
                    isTwoPacketMode
                      ? "Technical Opening Date & Time"
                      : "Bid Opening Date & Time"
                  }
                  labelClassName="text-xs font-bold text-slate-800 mb-1"
                  value={technicalOpeningDate}
                  onChange={setTechnicalOpeningDate}
                  placeholder={
                    isTwoPacketMode
                      ? "Select technical opening date & time"
                      : "Select bid opening date & time"
                  }
                  min={closingDate || new Date().toISOString()}
                  hint={
                    isTwoPacketMode
                      ? "Technical envelope unlocking date. Must be on or after closing."
                      : "Single envelope opening date & time. Must be on or after closing."
                  }
                />
              </div>

              {isTwoPacketMode && (
                <div>
                  <DateTimePicker
                    id="extend-fin-date-input"
                    label="Financial Opening Date & Time"
                    labelClassName="text-xs font-bold text-slate-800 mb-1"
                    value={financialOpeningDate}
                    onChange={setFinancialOpeningDate}
                    placeholder="Select financial opening date & time"
                    min={technicalOpeningDate || closingDate || new Date().toISOString()}
                    hint="Financial envelope unlocking date. Must be on or after technical opening."
                  />
                </div>
              )}

              <div>
                <DateTimePicker
                  id="extend-reqby-date-input"
                  label="Required-By / Delivery Date & Time"
                  labelClassName="text-xs font-bold text-slate-800 mb-1"
                  value={requiredByDate}
                  onChange={setRequiredByDate}
                  placeholder="Select required delivery date & time"
                  min={closingDate || new Date().toISOString()}
                  hint="Contractual goods/services delivery deadline."
                />
              </div>

              <div>
                <DateTimePicker
                  id="extend-validity-date-input"
                  label="Bid Validity Expiry Date"
                  labelClassName="text-xs font-bold text-slate-800 mb-1"
                  mode="date"
                  value={bidValidityDate}
                  onChange={setBidValidityDate}
                  placeholder="Select bid validity expiry date"
                  min={closingDate ? closingDate.split("T")[0] : undefined}
                  hint="Validity guarantee period for submitted quotes."
                />
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
