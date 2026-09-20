"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Paperclip,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Info,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  PhoneCall,
  Mail,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Scale,
  Sparkles,
  X,
  Package,
  Award,
  Trash2,
  Tag,
  AlertCircle,
  HelpCircle,
  Gavel,
  Ban,
  Lock,
  Truck,
  Activity,
  Trophy,
  Target,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { DataTable, ColumnDef } from "../../../components/ui/data-table";
import { useAuth } from "../../../hooks/useAuth";
import {
  openFileAsset,
  getFileAssetPreview,
  type DocumentPreview,
} from "../../../lib/files";
import { TechnicalEvaluationModal } from "./TechnicalEvaluationModal";
import { DocumentPreviewModal } from "../../../components/DocumentPreviewModal";
import { FocusTrap } from "../../../components/ui/FocusTrap";
import { ProcurementLifecycleStepper } from "./ProcurementLifecycleStepper";
import { PurchaseOrderReceiptModal } from "../../purchaseOrders/components/PurchaseOrderReceiptModal";
import { cn } from "../../../lib/utils";
import { PdfEngine, moneyPdf } from "../../../lib/pdfEngine";
import { getApi } from "../../shared/apiClient";
import { procurementBidApi } from "../../procurementBid/api";
import { KpiCard } from "../../shared/KpiCard";
import ClarificationPanel from "./ClarificationPanel";
import { EmdCard, EmdInfo, isEmdApplicable } from "./EmdCard";
import { EmdPaymentModal } from "./EmdPaymentModal";
import StartReverseAuctionModal, {
  SubmittedVendorItem,
} from "../../reverseAuctions/components/StartReverseAuctionModal";
import { ExtendScheduleModal } from "./ExtendScheduleModal";
import LiveAuctionLeaderboard from "../../reverseAuctions/components/LiveAuctionLeaderboard";
import SellerLiveAuctionBanner from "../../reverseAuctions/components/SellerLiveAuctionBanner";
import { reverseAuctionApi } from "../../reverseAuctions/api";
import {
  formatDate,
  formatDateTime,
  cleanDeliveryAddress,
} from "../../shared/format";
import { sanitizeUom, sanitizeHsn } from "../utils/quoteItemParser";

type IconComponent = React.ComponentType<{ className?: string }>;
type Tone =
  | "slate"
  | "emerald"
  | "rose"
  | "amber"
  | "sky"
  | "indigo"
  | "violet";

export type DisplayDocument = {
  id?: string | number;
  name: string;
  meta?: string;
  fileAssetId?: string | number;
  url?: string;
  required?: boolean;
};

const toneStyles: Record<
  Tone,
  { card: string; icon: string; text: string; badge: string }
> = {
  slate: {
    card: "border-slate-200 bg-white",
    icon: "bg-slate-100 text-slate-700",
    text: "text-slate-900",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
  },
  emerald: {
    card: "border-emerald-200 bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-950",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rose: {
    card: "border-rose-200 bg-rose-50",
    icon: "bg-rose-100 text-rose-700",
    text: "text-rose-950",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
  },
  amber: {
    card: "border-amber-200 bg-amber-50",
    icon: "bg-amber-100 text-amber-700",
    text: "text-amber-950",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  sky: {
    card: "border-sky-200 bg-sky-50",
    icon: "bg-sky-100 text-sky-700",
    text: "text-sky-950",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50",
    icon: "bg-indigo-100 text-indigo-700",
    text: "text-indigo-950",
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  violet: {
    card: "border-violet-200 bg-violet-50",
    icon: "bg-violet-100 text-violet-700",
    text: "text-violet-950",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

const formatMoney = (val: any) => {
  const n = Number(val);
  return isNaN(n) || n <= 0 ? "Refer Specs" : `₹${n.toLocaleString("en-IN")}`;
};

const noisyDetailKeys = new Set([
  "_id",
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "createdBy",
  "updatedBy",
  "tenantId",
  "organizationId",
  "buyerId",
  "sellerId",
  "bidId",
  "requirementId",
  "authUserId",
  "userId",
  "creatorId",
  "internalId",
  "sourceId",
  "sourceModel",
  "linkedProcurementBidId",
  "isDeleted",
  "originalPayload",
  "password",
  "token",
  "sourcePayload",
  "rawPayload",
  "technicalPacket",
  "fileAssetId",
  "assetId",
  "draftMeta",
  "draftStep",
  "__v",
  "statusEnum",
  "metadata",
  "hash",
  "signature",
  "emdRequired",
  "emdAmount",
  "isEmdRequired",
  "emdDisplay",
  "emd",
  "pbgRequired",
  "pbgAmount",
  "isPbgRequired",
  "pbg",
  "documentFee",
  "documentFeeAmount",
  "documentFeeRequired",
  "docFee",
  "documentCost",
  "documentCostFee",
  "document_cost_fee",
  "document_cost",
  "costFee",
  "docCost",
  "performanceSecurity",
  "retentionAmount",
  "retention_amount",
  "retention",
  "retentionPercentage",
  "retention_percentage",
  "isRetentionApplicable",
  "retentionApplicable",
  "securityDeposit",
  "security_deposit",
  "securityDepositAmount",
  "security_deposit_amount",
  "securityDepositPercentage",
  "security_deposit_percentage",
  "securityDepositRequired",
  "security_deposit_required",
]);

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase())
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim();
}

function hasDetailData(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return true;
  if (typeof val === "number") return !isNaN(val);
  if (typeof val === "string")
    return (
      val.trim().length > 0 &&
      val.trim() !== "null" &&
      val.trim() !== "undefined"
    );
  if (Array.isArray(val)) return val.some(hasDetailData);
  if (typeof val === "object") return Object.values(val).some(hasDetailData);
  return false;
}

function isPlainObject(val: any): boolean {
  return !!val && typeof val === "object" && !Array.isArray(val);
}

function compactObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (noisyDetailKeys.has(key)) continue;
    if (hasDetailData(val)) {
      result[key] = val;
    }
  }
  return result;
}

function detailEntries(obj: Record<string, any>): [string, any][] {
  return Object.entries(compactObject(obj));
}

function firstPresent(...vals: any[]): any {
  for (const val of vals) {
    if (hasDetailData(val)) return val;
  }
  return undefined;
}

function asArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "object") return [val];
  return [val];
}

function hasExplicitDateTime(val?: string | Date | null): boolean {
  if (!val) return false;
  if (typeof val === "string") {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    if (/T00:00:00(\.000)?(Z|[+-]00:00)?$/i.test(s)) return false;
    return s.includes("T") || s.includes(":");
  }
  if (val instanceof Date) {
    return !(
      (val.getUTCHours() === 0 &&
        val.getUTCMinutes() === 0 &&
        val.getUTCSeconds() === 0 &&
        val.getUTCMilliseconds() === 0) ||
      (val.getHours() === 0 &&
        val.getMinutes() === 0 &&
        val.getSeconds() === 0 &&
        val.getMilliseconds() === 0)
    );
  }
  return false;
}

function formatDateString(
  dateVal?: string | Date | null,
  includeTime?: boolean,
  defaultMidnightTime?: "endOfDay" | "startOfDay",
) {
  if (!dateVal) return null;
  try {
    let s = typeof dateVal === "string" ? dateVal.trim() : dateVal;
    if (typeof s === "string") {
      s = s.replace(/\bSept\b/i, "Sep");
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sept",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    const isDateOnlyStr =
      typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim());
    const isMidnightUtc =
      d.getUTCHours() === 0 &&
      d.getUTCMinutes() === 0 &&
      d.getUTCSeconds() === 0;
    const isMidnightLocal =
      d.getHours() === 0 &&
      d.getMinutes() === 0 &&
      d.getSeconds() === 0;
    const isMidnight = isMidnightUtc || isMidnightLocal;

    const shouldIncludeTime =
      includeTime !== undefined
        ? includeTime
        : (hasExplicitDateTime(dateVal) || Boolean(defaultMidnightTime));

    if (!shouldIncludeTime) {
      return `${day} ${month} ${year}`;
    }

    if ((isDateOnlyStr || isMidnight) && !defaultMidnightTime && !includeTime) {
      return `${day} ${month} ${year}`;
    }

    let hoursNum: number;
    let minutesStr: string;
    if ((isMidnight || isDateOnlyStr) && defaultMidnightTime) {
      if (defaultMidnightTime === "startOfDay") {
        hoursNum = 0;
        minutesStr = "00";
      } else {
        hoursNum = 23;
        minutesStr = "59";
      }
    } else {
      hoursNum = d.getHours();
      minutesStr = String(d.getMinutes()).padStart(2, "0");
    }
    const ampm = hoursNum >= 12 ? "PM" : "AM";
    let h12 = hoursNum % 12;
    if (h12 === 0) h12 = 12;
    const hoursFormatted = String(h12).padStart(2, "0");
    return `${day} ${month} ${year}, ${hoursFormatted}:${minutesStr} ${ampm}`;
  } catch {
    return String(dateVal);
  }
}

function formatCurrency(val?: number | string | null) {
  if (val === undefined || val === null || val === "") return "N/A";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "N/A";
  if (num === 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPrimitiveValue(val: any, valueKey?: string): string {
  if (val === null || val === undefined || val === "") return "N/A";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") {
    const lk = (valueKey || "").toLowerCase();
    const isCurrency =
      (lk.includes("amount") ||
        lk.includes("budget") ||
        lk.includes("value") ||
        lk.includes("price") ||
        lk.includes("cost") ||
        lk.includes("fee") ||
        lk.includes("deposit") ||
        (lk.includes("rate") &&
          !lk.includes("contract") &&
          !lk.includes("rating"))) &&
      !lk.includes("day") &&
      !lk.includes("period") &&
      !lk.includes("validity") &&
      !lk.includes("count") &&
      !lk.includes("qty") &&
      !lk.includes("quantity") &&
      !lk.includes("percent");

    if (isCurrency) {
      return formatCurrency(val);
    }
    if (
      lk.includes("day") ||
      lk.includes("period") ||
      lk.includes("validity")
    ) {
      return `${val} Days`;
    }
    return val.toLocaleString("en-IN");
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (
      !trimmed ||
      trimmed === "null" ||
      trimmed === "undefined" ||
      trimmed === "[object Object]"
    )
      return "N/A";
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const vk = (valueKey || "").toLowerCase();
      const isDateOrDeadline =
        vk.includes("date") ||
        vk.includes("deadline") ||
        vk.includes("schedule") ||
        trimmed.includes("T") ||
        trimmed.includes(":");
      const isStart = vk.includes("start") || vk.includes("publish");
      const formattedDate = formatDateString(
        trimmed,
        isDateOrDeadline,
        isStart ? "startOfDay" : "endOfDay",
      );
      if (formattedDate) return formattedDate;
    }
    // Format ALL_CAPS_WITH_UNDERSCORE enums to title case (e.g. ON_DELIVERY -> On Delivery)
    if (/^[A-Z0-9_ -]+$/.test(trimmed) && trimmed.includes("_")) {
      return humanizeKey(trimmed.toLowerCase());
    }
    if (valueKey && valueKey.toLowerCase().includes("evaluation")) {
      const lower = trimmed.toLowerCase();
      if (
        lower.includes("qcbs") ||
        lower.includes("quality and cost") ||
        lower.includes("weighted technical")
      ) {
        return "Quality and Cost Based Selection (QCBS)";
      }
      if (lower === "l1" || lower === "l1 basis") {
        return "L1 Basis";
      }
      if (lower.includes("item-wise") || lower.includes("item wise")) {
        return "Item-wise L1";
      }
      if (lower.includes("package-wise") || lower.includes("package wise")) {
        return "Package-wise L1";
      }
      if (
        lower.includes("technical qualification then l1") ||
        lower.includes("technical then l1")
      ) {
        return "Technical Qualification then L1";
      }
      if (lower.includes("reverse auction")) {
        return "Reverse Auction Final Bid Rank";
      }
      if (lower.includes("lowest landed cost")) {
        return "Lowest Landed Cost";
      }
      if (lower.includes("l1 total value") || lower.includes("l1 total")) {
        return "L1 Total Value";
      }
    }
    return trimmed;
  }
  if (Array.isArray(val)) {
    const cleanList = val
      .map((v) => formatPrimitiveValue(v, valueKey))
      .filter((v) => v !== "N/A" && v !== "");
    return cleanList.length ? cleanList.join(", ") : "N/A";
  }
  if (typeof val === "object") {
    return "N/A";
  }
  return String(val);
}

interface EvaluationMethodDetails {
  title: string;
  badge: string;
  basisLabel: string;
  shortSummary: string;
  description: string;
  keyPoints: string[];
}

function getEvaluationMethodDetails(
  methodRaw?: string | null,
): EvaluationMethodDetails {
  const lower = (methodRaw || "").toLowerCase().trim();

  // 1. QCBS / Weighted
  if (
    lower.includes("qcbs") ||
    lower.includes("quality and cost") ||
    lower.includes("weighted technical") ||
    lower.includes("weighted")
  ) {
    return {
      title: "Quality and Cost Based Selection (QCBS)",
      badge: "Weighted Tech-Commercial",
      basisLabel: "Highest Composite Score (H1)",
      shortSummary:
        "Weighted evaluation combining technical evaluation scores and commercial financial price.",
      description:
        "Bids are evaluated on a combined technical and commercial scoring matrix. The bidder achieving the highest composite score (H1) is recommended for contract award.",
      keyPoints: [
        "Combined Technical & Financial Scoring",
        "Configured Tech/Financial Weightage",
        "Highest Ranked Combined Bidder (H1) Award",
      ],
    };
  }

  // 2. Item-wise L1
  // if (lower.includes("item-wise") || lower.includes("item wise")) {
  //   return {
  //     title: "Item-wise L1 Evaluation",
  //     badge: "Split Line-by-Line",
  //     basisLabel: "Lowest Landed Cost Per Item",
  //     shortSummary:
  //       "Each line item is evaluated independently for lowest landed cost.",
  //     description:
  //       "Line items are evaluated independently on their landed price. Contracts or Purchase Orders may be awarded separately to the lowest responsive bidder (L1) for each individual line item, allowing split awards across multiple vendors.",
  //     keyPoints: [
  //       "Independent Line Item Evaluation",
  //       "Lowest Landed Cost (L1) Per Item",
  //       "Multiple Supplier Awards Permitted",
  //     ],
  //   };
  // }

  // 3. Package-wise L1
  // if (
  //   lower.includes("package-wise") ||
  //   lower.includes("package wise") ||
  //   lower.includes("schedule-wise") ||
  //   lower.includes("schedule wise")
  // ) {
  //   return {
  //     title: "Package-wise / Schedule L1",
  //     badge: "Package / Lot Award",
  //     basisLabel: "Package Aggregate L1",
  //     shortSummary:
  //       "Evaluation is based on aggregate lowest landed cost per bundled package.",
  //     description:
  //       "Items are grouped into cohesive packages or schedules. Evaluation is conducted on the aggregate lowest landed price (L1) of all items within each package. Bidders must quote for all items in a package.",
  //     keyPoints: [
  //       "Package / Lot Aggregate Cost",
  //       "All Items in Package Required",
  //       "Award to Package L1 Lowest Bidder",
  //     ],
  //   };
  // }

  // 4. Technical Qualification then L1
  if (
    lower.includes("technical qualification then l1") ||
    lower.includes("technical then l1")
  ) {
    return {
      title: "Technical Qualification then L1",
      badge: "Two-Stage Gated L1",
      basisLabel: "L1 Among Qualified",
      shortSummary:
        "Two-stage evaluation: mandatory technical qualification followed by price unsealing.",
      description:
        "Bidders must first clear all mandatory technical specifications, eligibility checks, and qualification gates. Commercial bids are unsealed only for technically compliant bidders, and award goes to the lowest landed bidder (L1).",
      keyPoints: [
        "Cover 1: Technical & Eligibility Scrutiny",
        "Cover 2: Price Unsealing for Qualified Only",
        "Lowest Landed Cost (L1) Award",
      ],
    };
  }

  // 5. Reverse Auction
  if (lower.includes("reverse auction")) {
    return {
      title: "Reverse Auction Final Bid Rank",
      badge: "Dynamic Auction",
      basisLabel: "Lowest Final Auction Rank (L1)",
      shortSummary:
        "Dynamic downward online auction where lowest real-time price at close wins.",
      description:
        "Eligible and technically qualified bidders participate in a real-time electronic reverse auction. Commercial award is granted to the lowest valid bid rank (L1) submitted before the countdown clock expires.",
      keyPoints: [
        "Dynamic Real-Time Decrement Bidding",
        "Automated Live Rank & Clock Rules",
        "Contract to Lowest Final Auction Rank (L1)",
      ],
    };
  }

  // 6. Lowest Landed Cost
  if (lower.includes("lowest landed cost")) {
    return {
      title: "Lowest Landed Cost (L1 Basis)",
      badge: "All-Inclusive Landed L1",
      basisLabel: "Total Delivered Landed Cost",
      shortSummary: "All-inclusive lowest price delivered to destination.",
      description:
        "The quotation with the lowest total landed cost—factoring in basic price, applicable GST, freight, transit insurance, and delivery charges—is designated as L1 for contract award.",
      keyPoints: [
        "Base Price + Taxes + Freight + Incidental Costs",
        "Normalized Net Delivered Price",
        "Award to Overall Lowest Landed Bidder",
      ],
    };
  }

  // 7. L1 Total Value (Default & standard)
  return {
    title: "L1 Total Value Basis",
    badge: "Overall Lowest Cost (L1)",
    basisLabel: "Lowest Landed Price (L1)",
    shortSummary:
      "Lowest overall landed cost for the complete scope of requirements.",
    description:
      "Commercial award is determined strictly on the aggregate lowest landed cost (L1) for the entire procurement scope. All eligible items, applicable GST, freight, and incidental expenses are totaled to identify the lowest compliant quotation.",
    keyPoints: [
      "Comprehensive Scope Evaluation (All-or-None)",
      "Inclusive of Base Price, Taxes & Delivery",
      "Awarded to Lowest Responsive Bidder (L1)",
    ],
  };
}

function parseDateValue(
  dateVal?: string | Date | null,
  isStart = false,
): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    return dateVal;
  }
  let s = String(dateVal).trim();
  if (!s) return null;
  s = s.replace(/\bSept\b/i, "Sep");
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const isDateOnlyStr = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const isMidnightUtc =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  const isMidnightLocal =
    d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  if (isMidnightUtc || isMidnightLocal || isDateOnlyStr) {
    const adjusted = new Date(d.getTime());
    if (isStart) {
      adjusted.setHours(0, 0, 0, 0);
    } else {
      adjusted.setHours(23, 59, 59, 999);
    }
    return adjusted;
  }
  return d;
}

function DeadlineCountdown({
  targetDate,
  startDate,
  label = "Quote Due: ",
  startLabel = "Starts in: ",
}: {
  targetDate: Date | string;
  startDate?: Date | string | null;
  label?: string;
  startLabel?: string;
}) {
  const startObj = useMemo(() => parseDateValue(startDate, true), [startDate]);
  const endObj = useMemo(() => parseDateValue(targetDate, false), [targetDate]);
  const [timerState, setTimerState] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPassed: boolean;
    isBeforeStart: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPassed: false,
    isBeforeStart: false,
  });

  React.useEffect(() => {
    const calc = () => {
      const now = Date.now();
      if (startObj && startObj.getTime() > now) {
        const ms = startObj.getTime() - now;
        const days = Math.floor(ms / 86_400_000);
        const hours = Math.floor((ms % 86_400_000) / 3_600_000);
        const minutes = Math.floor((ms % 3_600_000) / 60_000);
        const seconds = Math.floor((ms % 60_000) / 1000);
        setTimerState({
          days,
          hours,
          minutes,
          seconds,
          isPassed: false,
          isBeforeStart: true,
        });
        return;
      }
      if (!endObj) {
        setTimerState({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPassed: false,
          isBeforeStart: false,
        });
        return;
      }
      const ms = endObj.getTime() - now;
      if (ms <= 0) {
        setTimerState({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPassed: true,
          isBeforeStart: false,
        });
        return;
      }
      const days = Math.floor(ms / 86_400_000);
      const hours = Math.floor((ms % 86_400_000) / 3_600_000);
      const minutes = Math.floor((ms % 3_600_000) / 60_000);
      const seconds = Math.floor((ms % 60_000) / 1000);
      setTimerState({
        days,
        hours,
        minutes,
        seconds,
        isPassed: false,
        isBeforeStart: false,
      });
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [startObj, endObj]);

  if (!endObj && !startObj) return null;

  if (timerState.isBeforeStart) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800 shadow-2xs"
        role="timer"
        aria-live="polite"
      >
        <Clock
          className="h-3 w-3 text-sky-600 animate-pulse"
          aria-hidden="true"
        />
        <span className="font-mono">
          <span className="text-sky-900/80 font-bold">{startLabel}</span>
          {timerState.days > 0 ? `${timerState.days}d ` : ""}
          {String(timerState.hours).padStart(2, "0")}h{" "}
          {String(timerState.minutes).padStart(2, "0")}m{" "}
          {String(timerState.seconds).padStart(2, "0")}s
        </span>
      </span>
    );
  }

  if (timerState.isPassed) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 shadow-2xs"
      role="timer"
      aria-live="polite"
    >
      <Clock
        className="h-3 w-3 text-amber-600 animate-pulse"
        aria-hidden="true"
      />
      <span className="font-mono">
        <span className="text-amber-900/80 font-bold">{label}</span>
        {timerState.days > 0 ? `${timerState.days}d ` : ""}
        {String(timerState.hours).padStart(2, "0")}h{" "}
        {String(timerState.minutes).padStart(2, "0")}m{" "}
        {String(timerState.seconds).padStart(2, "0")}s left
      </span>
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const label = (status || "ACTIVE").toUpperCase();
  const isClosed = [
    "CLOSED",
    "COMPLETED",
    "CANCELLED",
    "EXPIRED",
    "AWARDED",
    "SUBMISSION CLOSED",
    "SUBMISSION_CLOSED",
  ].includes(label);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        isClosed
          ? "border-slate-300 bg-slate-100 text-slate-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isClosed ? "bg-slate-500" : "bg-emerald-500 animate-pulse",
        )}
      />
      {label}
    </span>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  badge,
  action,
}: {
  title: string;
  icon: IconComponent;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100/80 shadow-2xs">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-xs sm:text-[13px] font-bold uppercase tracking-wide text-slate-900 truncate">
          {title}
        </h2>
      </div>
      {(badge || action) && (
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          {action}
        </div>
      )}
    </div>
  );
}

function DetailValue({ value, valueKey }: { value: any; valueKey?: string }) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "—" ||
    value === "N/A" ||
    value === "Not Specified" ||
    value === "null"
  ) {
    return <span className="text-slate-400 font-normal">N/A</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider border",
          value
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-100 text-slate-600",
        )}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (typeof value === "number" || typeof value === "string") {
    return <span>{formatPrimitiveValue(value, valueKey)}</span>;
  }

  if (Array.isArray(value)) {
    const list = value.filter(hasDetailData);
    if (!list.length)
      return <span className="text-slate-400 font-normal">N/A</span>;

    return (
      <div className="space-y-2 mt-1">
        {list.map((item, index) => (
          <div
            key={index}
            className="rounded-xl bg-slate-50/70 p-3 border border-slate-150"
          >
            {typeof item === "object" ? (
              <PropertyGrid columns={3}>
                {detailEntries(item)
                  .filter(([k]) => {
                    const lk = k.toLowerCase().replace(/[^a-z]/g, "");
                    return (
                      !lk.includes("advance") &&
                      !lk.includes("retention") &&
                      !lk.includes("securitydeposit") &&
                      !lk.includes("warranty")
                    );
                  })
                  .map(([k, v]) => (
                    <PropertyItem key={k} label={humanizeKey(k)} value={v} />
                  ))}
              </PropertyGrid>
            ) : (
              <span className="text-xs font-bold text-slate-900">
                {formatPrimitiveValue(item, valueKey)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = detailEntries(value).filter(([k]) => {
      const lk = k.toLowerCase().replace(/[^a-z]/g, "");
      return (
        !lk.includes("advance") &&
        !lk.includes("retention") &&
        !lk.includes("securitydeposit") &&
        !lk.includes("warranty")
      );
    });
    if (!entries.length)
      return <span className="text-slate-400 font-normal">N/A</span>;

    return (
      <PropertyGrid columns={3} className="mt-1">
        {entries.map(([k, v]) => (
          <PropertyItem key={k} label={humanizeKey(k)} value={v} />
        ))}
      </PropertyGrid>
    );
  }

  return <span>{String(value)}</span>;
}

function PropertyGrid({
  columns = 2,
  children,
  className,
}: {
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  className?: string;
}) {
  const colClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }[columns];

  return (
    <dl
      className={cn("grid gap-x-6 gap-y-3.5 sm:gap-y-4", colClass, className)}
    >
      {children}
    </dl>
  );
}

interface BuyerSideContextValue {
  isBuyer: boolean;
  isOpenTender: boolean;
  isLimitedTender: boolean;
  shouldShowEstimatedCost?: boolean;
}

const BuyerSideContext = React.createContext<BuyerSideContextValue>({
  isBuyer: false,
  isOpenTender: false,
  isLimitedTender: false,
  shouldShowEstimatedCost: false,
});

function PropertyItem({
  label,
  value,
  icon: Icon,
  className,
  fullWidth = false,
  highlight = false,
  mono = false,
  subtext,
}: {
  label: string;
  value: any;
  icon?: IconComponent;
  className?: string;
  fullWidth?: boolean;
  highlight?: boolean;
  mono?: boolean;
  subtext?: string;
}) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === "boolean" ? ctx : ctx.isBuyer;
  const isOpenTender = typeof ctx === "boolean" ? false : ctx.isOpenTender;
  const isLimitedTender =
    typeof ctx === "boolean" ? false : ctx.isLimitedTender || false;

  const hasData =
    hasDetailData(value) &&
    value !== "—" &&
    value !== "N/A" &&
    value !== "Not Specified" &&
    value !== "null";
  if (!hasData) {
    if (!isBuyer) return null;
  }

  if (label) {
    const lower = label.toLowerCase().replace(/[^a-z]/g, "");
    if (
      lower.includes("advance") ||
      lower === "advanceallowed" ||
      lower === "advance" ||
      lower === "advancepayment" ||
      // Warranty Terms strictly hidden from both seller and buyer side
      lower === "warrantyterms" ||
      lower === "warranty" ||
      lower === "warrantyperiod" ||
      lower.includes("warranty") ||
      lower === "retentionamount" ||
      lower === "securitydeposit" ||
      lower === "retention" ||
      lower === "securitydepositamount" ||
      lower === "retentionpercentage" ||
      lower === "securitydepositpercentage" ||
      lower === "securitydepositrequired" ||
      lower.includes("retention") ||
      lower.includes("securitydeposit")
    ) {
      return null;
    }
  }

  const effectiveValue = hasData ? value : "N/A";

  return (
    <div
      className={cn(
        "min-w-0 flex flex-col justify-start py-0.5",
        fullWidth && "sm:col-span-2 lg:col-span-full",
        className,
      )}
    >
      <dt className="flex items-center gap-1 text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
        {Icon && <Icon className="h-3 w-3 text-slate-400 shrink-0" />}
        <span className="truncate">{label}</span>
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-xs font-medium text-slate-900 break-words leading-snug",
          highlight && hasData && "text-blue-700 font-bold",
          mono && hasData && "font-mono text-[11px]",
        )}
      >
        <DetailValue value={effectiveValue} valueKey={label} />
        {subtext && hasData && (
          <span className="block text-[10.5px] font-medium text-slate-500 mt-0.5">
            {subtext}
          </span>
        )}
      </dd>
    </div>
  );
}

function DataCard({
  title,
  icon: Icon,
  badge,
  action,
  children,
  className,
}: {
  title: string;
  icon: IconComponent;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs space-y-3",
        className,
      )}
    >
      <SectionHeader title={title} icon={Icon} badge={badge} action={action} />
      {children}
    </section>
  );
}

function BuyerProfileSection({
  orgName,
  contactPerson,
  email,
  phone,
  address,
  department,
  deliveryLocation,
}: {
  orgName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  department?: string;
  deliveryLocation?: string;
}) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === "boolean" ? ctx : ctx.isBuyer;

  const hasContact =
    hasDetailData(contactPerson) &&
    contactPerson !== "—" &&
    contactPerson !== "N/A";
  const hasEmail = hasDetailData(email) && email !== "—" && email !== "N/A";
  const hasPhone = hasDetailData(phone) && phone !== "—" && phone !== "N/A";
  const hasAddress =
    hasDetailData(address) && address !== "—" && address !== "N/A";
  const isAddressIdenticalToDelivery = Boolean(
    hasAddress &&
    deliveryLocation &&
    cleanDeliveryAddress(address).toLowerCase().trim() ===
      cleanDeliveryAddress(deliveryLocation).toLowerCase().trim(),
  );

  return (
    <DataCard
      title={isBuyer ? "Organization & Contact Details" : "Buyer Information"}
      icon={Building2}
    >
      <div className="space-y-4">
        {/* Org Banner Card */}
        <div className="flex items-start gap-3 rounded-xl bg-slate-50/80 p-3 border border-slate-150">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b2447] to-[#123668] text-white shadow-xs font-bold text-sm">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                {orgName ||
                  (isBuyer ? "My Organization" : "Buyer Organization")}
              </h3>
              {department && (
                <span className="rounded-full bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 text-[9.5px] font-bold text-indigo-700">
                  {department}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Authorized Procurement Authority
            </p>
          </div>
        </div>

        {/* Contact & Location Details in Clean Key-Values */}
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 pt-0.5">
          {(hasContact || isBuyer) && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <User className="h-3 w-3 text-slate-400" />
                <span>Contact Person</span>
              </dt>
              <dd className="text-xs font-semibold text-slate-900">
                {hasContact ? (
                  contactPerson
                ) : (
                  <span className="text-slate-400 font-normal">N/A</span>
                )}
              </dd>
            </div>
          )}

          {(hasEmail || isBuyer) && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Mail className="h-3 w-3 text-slate-400" />
                <span>Email Address</span>
              </dt>
              <dd className="text-xs font-semibold">
                {hasEmail ? (
                  <a
                    href={`mailto:${email}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline transition-colors break-all"
                  >
                    {email}
                  </a>
                ) : (
                  <span className="text-slate-400 font-normal">N/A</span>
                )}
              </dd>
            </div>
          )}

          {(hasPhone || isBuyer) && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <PhoneCall className="h-3 w-3 text-slate-400" />
                <span>Contact Number</span>
              </dt>
              <dd className="text-xs font-semibold">
                {hasPhone ? (
                  <a
                    href={`tel:${phone}`}
                    className="text-slate-800 hover:text-blue-600 transition-colors font-mono"
                  >
                    {phone}
                  </a>
                ) : (
                  <span className="text-slate-400 font-normal">N/A</span>
                )}
              </dd>
            </div>
          )}

          {(hasAddress || isBuyer) && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span>Registered Location</span>
              </dt>
              <dd className="text-xs font-medium text-slate-700 leading-snug">
                {hasAddress ? (
                  isAddressIdenticalToDelivery ? (
                    <span className="text-slate-600 italic">
                      Same as Procurement Delivery Location
                    </span>
                  ) : (
                    address
                  )
                ) : (
                  <span className="text-slate-400 font-normal">N/A</span>
                )}
              </dd>
            </div>
          )}
        </div>
      </div>
    </DataCard>
  );
}

function InternalComplianceSection({
  approvalAuthority,
  justification,
  budgetConfirmed,
  competentAuthority,
  fileNumber,
  sanctionDate,
  department,
}: {
  approvalAuthority?: string | null;
  justification?: string | null;
  budgetConfirmed?: boolean;
  competentAuthority?: string | null;
  fileNumber?: string | null;
  sanctionDate?: string | null;
  department?: string | null;
}) {
  return (
    <DataCard
      title="Internal Approval & Statutory Compliance"
      icon={ShieldCheck}
      badge={
        budgetConfirmed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800 tracking-wider">
            <CheckCircle2
              className="h-3 w-3 text-emerald-600"
              aria-hidden="true"
            />
            Budget Sanctioned
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Top summary grid */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {approvalAuthority && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
              <dt className="text-[10px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <User className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                Internal Approval Authority
              </dt>
              <dd className="mt-1 text-xs font-black text-slate-900 leading-snug">
                {approvalAuthority}
              </dd>
            </div>
          )}

          {budgetConfirmed !== undefined && (
            <div
              className={cn(
                "rounded-xl border p-3",
                budgetConfirmed
                  ? "border-emerald-150 bg-emerald-50/40"
                  : "border-slate-200 bg-slate-50/60",
              )}
            >
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShieldCheck
                  className={cn(
                    "h-3 w-3",
                    budgetConfirmed ? "text-emerald-600" : "text-slate-400",
                  )}
                  aria-hidden="true"
                />
                Budget Allocation & Sanction
              </dt>
              <dd className="mt-1 text-xs font-black text-slate-900 flex items-center gap-1.5">
                {budgetConfirmed ? (
                  <>
                    <CheckCircle2
                      className="h-3.5 w-3.5 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Sanctioned & Allocated (GFR Compliance)</span>
                  </>
                ) : (
                  <span className="text-slate-500 font-semibold">
                    Not Specified
                  </span>
                )}
              </dd>
            </div>
          )}

          {competentAuthority && competentAuthority !== approvalAuthority && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building2
                  className="h-3 w-3 text-slate-400"
                  aria-hidden="true"
                />
                Competent Financial Authority (CFA)
              </dt>
              <dd className="mt-1 text-xs font-black text-slate-900 leading-snug">
                {competentAuthority}
              </dd>
            </div>
          )}

          {fileNumber && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText
                  className="h-3 w-3 text-slate-400"
                  aria-hidden="true"
                />
                Department File / Case Number
              </dt>
              <dd className="mt-1 font-mono text-xs font-bold text-slate-900">
                {fileNumber}
              </dd>
            </div>
          )}

          {department && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building2
                  className="h-3 w-3 text-slate-400"
                  aria-hidden="true"
                />
                Sanctioning Department / Unit
              </dt>
              <dd className="mt-1 text-xs font-bold text-slate-900">
                {department}
              </dd>
            </div>
          )}

          {sanctionDate && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar
                  className="h-3 w-3 text-slate-400"
                  aria-hidden="true"
                />
                Sanction Approval Date
              </dt>
              <dd className="mt-1 text-xs font-bold text-slate-900">
                {sanctionDate}
              </dd>
            </div>
          )}
        </div>

        {/* Purchase Justification & Compliance Reason full-width callout */}
        {justification && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
                <FileText className="h-3 w-3" aria-hidden="true" />
              </span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                Purchase Justification & Compliance Reason
              </h4>
              <span className="rounded-full bg-amber-100/80 border border-amber-300/60 px-2 py-0.5 text-[9px] font-bold text-amber-900">
                Statutory Audit Record
              </span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap pl-7">
              {justification}
            </p>
          </div>
        )}
      </div>
    </DataCard>
  );
}

function TimelineRibbon({
  dates,
}: {
  dates: Array<{
    label: string;
    value?: string | null;
    icon: IconComponent;
    tone: Tone;
  }>;
}) {
  const validDates = dates.filter(
    (d) => d.value && d.value !== "—" && d.value !== "N/A",
  );
  if (!validDates.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100/80 shadow-2xs">
          <CalendarDays className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-xs sm:text-[13px] font-bold uppercase tracking-wide text-slate-900">
          Key Dates & Milestone Schedule
        </h2>
      </div>

      <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-150">
        <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {validDates.map((date, idx) => {
            const styles = toneStyles[date.tone] || toneStyles.slate;
            return (
              <div
                key={idx}
                className="flex flex-col justify-between space-y-1 min-w-0"
              >
                <div
                  className="flex items-center gap-1.5"
                  aria-label={date.label}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      styles.icon.replace("text-", "bg-").split(" ")[0],
                    )}
                  />
                  <span
                    title={date.label}
                    className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 truncate"
                  >
                    {date.label}
                  </span>
                </div>
                <p className="text-[11.5px] font-bold text-slate-900 leading-tight break-words">
                  {date.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PolicyRulesMatrix({
  rules,
}: {
  rules: Array<{
    label: string;
    value: any;
    icon?: IconComponent;
    subtext?: string;
  }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {rules.map((rule, idx) => {
        const valStr =
          typeof rule.value === "boolean"
            ? rule.value
              ? "Yes"
              : "No"
            : String(
                rule.value !== null && rule.value !== undefined
                  ? rule.value
                  : "",
              ).trim();
        const isYes = ["yes", "true", "1", "enabled", "scheduled"].includes(
          valStr.toLowerCase(),
        );
        const isNo = ["no", "false", "0", "disabled"].includes(
          valStr.toLowerCase(),
        );
        const Icon = rule.icon || (isYes ? CheckCircle2 : Info);

        return (
          <div
            key={idx}
            title={rule.subtext ? `${rule.label}: ${rule.subtext}` : undefined}
            className={cn(
              "flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-colors",
              isYes
                ? "bg-emerald-50/50 border-emerald-200/80 text-emerald-950"
                : isNo
                  ? "bg-slate-50/60 border-slate-200/80 text-slate-700"
                  : "bg-white border-slate-200 text-slate-900",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isYes
                    ? "text-emerald-600"
                    : isNo
                      ? "text-slate-400"
                      : "text-indigo-600",
                )}
              />
              <div className="min-w-0 flex flex-col">
                <span className="text-[11px] font-semibold truncate text-slate-800">
                  {rule.label}
                </span>
                {rule.subtext && (
                  <span className="text-[9.5px] text-slate-500 font-medium truncate leading-tight">
                    {rule.subtext}
                  </span>
                )}
              </div>
            </div>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
                isYes
                  ? "bg-emerald-100 text-emerald-800"
                  : isNo
                    ? "bg-slate-200/70 text-slate-600"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-200",
              )}
            >
              {valStr}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Legacy-compatible Property wrapper without individual box borders */
function FieldCard({
  label,
  value,
  className,
}: {
  label: string;
  value: any;
  className?: string;
}) {
  if (!hasDetailData(value)) return null;
  return <PropertyItem label={label} value={value} className={className} />;
}

/** Legacy-compatible Compact wrapper */
function CompactField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  if (!hasDetailData(value)) return null;
  return <PropertyItem label={label} value={value} className={className} />;
}

function CompactSectionGrid({
  title,
  icon: Icon,
  data,
  defaultOpen = true,
}: {
  title: string;
  icon: IconComponent;
  data: Record<string, any>;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  if (!hasDetailData(data)) return null;

  const entries = detailEntries(data);
  if (!entries.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-3.5 sm:p-4 text-left transition hover:bg-slate-50/80"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100/80 shadow-2xs">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-xs sm:text-[13px] font-bold uppercase tracking-wide text-slate-900 truncate">
            {title}
          </h2>
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shrink-0">
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 p-4 pt-3">
          <PropertyGrid columns={3}>
            {entries.map(([key, value]) => (
              <PropertyItem key={key} label={humanizeKey(key)} value={value} />
            ))}
          </PropertyGrid>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  subtext,
}: {
  label: string;
  value: React.ReactNode;
  icon: IconComponent;
  tone: Tone;
  subtext?: string;
  isBuyer?: boolean;
}) {
  const styles = toneStyles[tone] || toneStyles.slate;
  return (
    <article
      className={cn(
        "flex flex-col rounded-lg border px-2 py-1.5 sm:px-2.5 sm:py-1.5 justify-between min-h-[56px] sm:min-h-[60px] shadow-2xs transition-all hover:shadow-xs",
        styles.card,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 truncate flex-1">
          {label}
        </p>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded shadow-2xs",
            styles.icon,
          )}
          aria-hidden="true"
        >
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <div className="min-w-0 mt-0.5">
        <div
          className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 leading-snug truncate"
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-[9px] sm:text-[9.5px] font-medium text-slate-500 truncate">
          <span
            className="h-1 w-1 shrink-0 rounded-full bg-slate-300"
            aria-hidden="true"
          />
          <span className="truncate">{subtext || "Procurement details"}</span>
        </p>
      </div>
    </article>
  );
}

const requiredDocumentsColumns: ColumnDef<any>[] = [
  {
    key: "docName",
    header: "DOCUMENT NAME",
    cell: (item, idx) => {
      const docName = firstPresent(
        item.name,
        item.documentName,
        item.title,
        item.label,
        `Document ${idx + 1}`,
      );
      return (
        <span className="font-bold text-slate-900">
          {formatPrimitiveValue(docName)}
        </span>
      );
    },
  },
  {
    key: "instructions",
    header: "INSTRUCTIONS",
    cell: (item) => {
      const instructions = firstPresent(
        item.instructions,
        item.description,
        item.guidelines,
        item.note,
        "-",
      );
      return (
        <span className="font-normal text-slate-600 max-w-xs">
          {formatPrimitiveValue(instructions)}
        </span>
      );
    },
  },
  {
    key: "fileType",
    header: "ALLOWED FILE TYPES",
    cell: (item) => {
      const fileType = firstPresent(
        item.fileType,
        item.allowedFormat,
        item.format,
        item.fileTypes,
        item.mimeType,
        "PDF",
      );
      return (
        <span className="inline-block rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-slate-700 uppercase bg-slate-100">
          {formatPrimitiveValue(fileType)}
        </span>
      );
    },
  },
  {
    key: "maxSize",
    header: "MAX SIZE",
    cell: (item) => {
      const rawMaxSize = firstPresent(item.maxSize, item.maxMb, item.size, "5");
      const maxSize = String(rawMaxSize).replace(/\s*mb/gi, "");
      return (
        <span className="font-medium text-slate-700">
          {maxSize !== "-" ? `${maxSize} MB` : "-"}
        </span>
      );
    },
  },
  {
    key: "status",
    header: "STATUS",
    align: "center",
    cell: (item) => {
      const isRequired =
        item.required !== false &&
        String(item.required).toLowerCase() !== "false";
      return (
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider border",
            isRequired
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-slate-50 text-slate-600",
          )}
        >
          {isRequired ? "REQUIRED" : "OPTIONAL"}
        </span>
      );
    },
  },
];

function RequiredDocumentsList({
  data,
  documents,
  title = "Required Documents & Checklist",
  hideIfEmpty = false,
}: {
  data?: any;
  documents?: any;
  title?: string;
  hideIfEmpty?: boolean;
}) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === "boolean" ? ctx : ctx.isBuyer;

  const rawItems = asArray(documents || data).filter(hasDetailData);
  if (!rawItems.length) {
    if (hideIfEmpty || !isBuyer) return null;
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-indigo-600" />
            {title}
          </h3>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs font-semibold text-slate-400">
          No required documents or checklist specified (N/A)
        </div>
      </div>
    );
  }

  const processedItems = rawItems.map((item: any, idx: number) => {
    if (typeof item === "string") {
      return {
        name: item,
        instructions: "Upload required document according to specifications.",
        fileType: "PDF, DOCX",
        maxSize: "5 MB",
        required: true,
      };
    }

    if (isPlainObject(item)) {
      return {
        ...item,
        name:
          item.name ||
          item.documentName ||
          item.title ||
          item.label ||
          `Document ${idx + 1}`,
        instructions:
          item.instructions ||
          item.description ||
          "Upload required document according to specifications.",
        fileType: item.fileType || item.format || "PDF, DOCX",
        maxSize: item.maxSize
          ? String(item.maxSize).includes("MB")
            ? item.maxSize
            : `${item.maxSize} MB`
          : "5 MB",
        required: item.required !== false,
      };
    }

    return {
      name: `Document ${idx + 1}`,
      instructions: "Upload required document according to specifications.",
      fileType: "PDF, DOCX",
      maxSize: "5 MB",
      required: true,
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-indigo-600" />
          {title}
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-600">
          {processedItems.length}{" "}
          {processedItems.length === 1 ? "Document" : "Documents"}
        </span>
      </div>
      <DataTable<any>
        data={processedItems}
        columns={requiredDocumentsColumns}
        keyExtractor={(item: any, idx: number) =>
          String(item.id || item.fileAssetId || idx)
        }
        showSrNo={true}
        srNoHeader="#"
        srNoWidth="w-12"
        minWidth="min-w-[680px]"
        emptyTitle="No documents required"
        emptyDescription="No document checklist specified for this procurement."
      />
    </div>
  );
}

function AuctionWorkflowStepper({
  isTwoStage,
  auctionStatus,
  hasJoined,
  evaluationPending,
  startTime,
  endTime,
  minDecrement,
  rankVisibility,
}: {
  isTwoStage: boolean;
  auctionStatus: string;
  hasJoined?: boolean;
  evaluationPending?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  minDecrement?: string;
  rankVisibility?: string;
}) {
  const isLive = auctionStatus === "LIVE";
  const isClosed = ["CLOSED", "COMPLETED", "AWARDED", "CANCELLED"].includes(
    auctionStatus,
  );

  if (isTwoStage) {
    return (
      <div className="rounded-xl border border-purple-200/80 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white p-3 sm:p-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-2xs">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-purple-950">
                  Two-Stage Tender with Reverse Auction Sourcing
                </h4>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-black text-purple-800 uppercase">
                  Multi-Stage Sourcing
                </span>
              </div>
              <p className="text-xs font-medium text-purple-800/80 mt-0.5">
                Suppliers qualify through Stage 1 technical compliance before
                competing in Stage 2 live reverse decrement bidding.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-white border border-purple-200 text-purple-700 shadow-2xs">
            {isLive ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                Stage 2: Live Auction Active
              </>
            ) : isClosed ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Reverse Auction Concluded
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5 text-purple-600" />
                {evaluationPending
                  ? "Stage 1: Under Evaluation"
                  : "Stage 1: Submission / Baseline"}
              </>
            )}
          </span>
        </div>

        <div className="grid gap-3 pt-3.5 sm:grid-cols-2">
          {/* Stage 1 Box */}
          <div
            className={cn(
              "rounded-xl border p-3.5 transition-all flex flex-col justify-between",
              isLive || isClosed
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-purple-200 bg-white shadow-2xs",
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                  Stage 1: Technical &amp; Baseline Qualification
                </span>
                {isLive || isClosed ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                    <CheckCircle2 className="h-3 w-3 text-emerald-700" />{" "}
                    Qualified / Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-[9px] font-black uppercase text-purple-800">
                    {evaluationPending ? "Auditing" : "Submissions"}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-900 mt-1">
                Specification Compliance &amp; Base Price Packet
              </p>
              <p className="text-[11px] text-slate-600 leading-snug mt-1">
                Vendors submit technical packets, mandatory compliance
                documents, and initial baseline pricing for buyer committee
                evaluation.
              </p>
            </div>
            <div className="mt-2.5 pt-2 border-t border-purple-100/60 text-[10px] font-semibold text-purple-900/80">
              Requirement: Only technically approved bidders advance to Stage 2.
            </div>
          </div>

          {/* Stage 2 Box */}
          <div
            className={cn(
              "rounded-xl border p-3.5 transition-all flex flex-col justify-between",
              isLive
                ? "border-emerald-400 bg-emerald-50/80 ring-2 ring-emerald-400/20 shadow-sm"
                : isClosed
                  ? "border-slate-200 bg-slate-50/60"
                  : "border-slate-200 bg-white/80 shadow-2xs",
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-[10px] font-black uppercase tracking-wider",
                    isLive ? "text-emerald-700" : "text-slate-500",
                  )}
                >
                  Stage 2: Live Reverse Auction
                </span>
                {isLive ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-2xs">
                    <Activity className="h-3 w-3 animate-pulse" /> Live
                    Decrement Console
                  </span>
                ) : isClosed ? (
                  <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-700">
                    Concluded
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">
                    Scheduled Window
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-900 mt-1">
                Dynamic Decrement Bidding Window
              </p>
              <p className="text-[11px] text-slate-600 leading-snug mt-1">
                Qualified vendors submit downward bids against the prevailing L1
                price step. Real-time rank feedback guides negotiation.
              </p>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-semibold text-slate-700">
              <span>Step: {minDecrement || "Dynamic Step"}</span>
              <span>Visibility: {rankVisibility || "Rank Only"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standalone Direct Reverse Auction Stepper
  return (
    <div className="rounded-xl border border-rose-200/80 bg-gradient-to-r from-rose-50/60 via-amber-50/30 to-white p-3 sm:p-3.5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-2xs">
            <Gavel className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-rose-950">
                Direct Reverse Auction Sourcing
              </h4>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-800 uppercase">
                Dynamic Clock Sourcing
              </span>
            </div>
            <p className="text-xs font-medium text-rose-800/80 mt-0.5">
              Direct live reverse price competition without separate technical
              pre-qualification round.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-white border border-rose-200 text-rose-700 shadow-2xs">
          {isLive ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Live Bidding Window Active
            </>
          ) : isClosed ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Auction Concluded
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 text-rose-600" />
              {auctionStatus === "SCHEDULED"
                ? "Scheduled Window"
                : "Draft / Open"}
            </>
          )}
        </span>
      </div>

      <div className="grid gap-2.5 pt-3.5 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[9.5px] font-black uppercase text-slate-400 block">
            Step 1
          </span>
          <span className="text-xs font-bold text-slate-900 block mt-0.5">
            Terms Acceptance
          </span>
          <span className="text-[10.5px] font-semibold text-emerald-700 mt-1 inline-flex items-center gap-1">
            {hasJoined ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Joined &amp; Ready
              </>
            ) : (
              "Open to Join"
            )}
          </span>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[9.5px] font-black uppercase text-slate-400 block">
            Step 2
          </span>
          <span className="text-xs font-bold text-slate-900 block mt-0.5">
            Scheduled Window
          </span>
          <span className="text-[10.5px] font-medium text-slate-600 mt-1 block truncate">
            {startTime ? formatDate(startTime) : "Configured"}
          </span>
        </div>
        <div
          className={cn(
            "rounded-xl border p-3 shadow-2xs transition-all",
            isLive
              ? "border-emerald-300 bg-emerald-50/60 ring-2 ring-emerald-400/20"
              : "border-slate-200/80 bg-white",
          )}
        >
          <span className="text-[9.5px] font-black uppercase text-slate-400 block">
            Step 3
          </span>
          <span className="text-xs font-bold text-slate-900 block mt-0.5">
            Live Decrement
          </span>
          <span
            className={cn(
              "text-[10.5px] font-bold mt-1 inline-flex items-center gap-1",
              isLive
                ? "text-emerald-700"
                : isClosed
                  ? "text-slate-500"
                  : "text-amber-700",
            )}
          >
            {isLive ? (
              <>
                <Activity className="h-3 w-3 animate-pulse" /> Live Now
              </>
            ) : isClosed ? (
              "Ended"
            ) : (
              "Scheduled"
            )}
          </span>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[9.5px] font-black uppercase text-slate-400 block">
            Step 4
          </span>
          <span className="text-xs font-bold text-slate-900 block mt-0.5">
            L1 Award
          </span>
          <span className="text-[10.5px] font-semibold text-slate-600 mt-1 block">
            {isClosed ? "Award Recommendation" : "Post Auction"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ScopeSummaryCard({
  scopeText,
  procurementTypeLabel = "PROCUREMENT",
  estimatedValue,
  urgency = "Normal",
  procurementMethod,
}: {
  scopeText?: string;
  procurementTypeLabel?: string;
  estimatedValue?: any;
  urgency?: string;
  procurementMethod?: string;
}) {
  const raw = String(scopeText || "");
  const formatted = raw
    .replace(/(Sourcing Method:?\s*)/gi, "\nSourcing Method: ")
    .replace(/(RFP\s?Value:?\s*)/gi, "\nRFP Value: ")
    .replace(/(Estimated\s?Value:?\s*)/gi, "\nEstimated Value: ")
    .replace(/(Value:?\s*)/gi, "\nValue: ")
    .replace(/(Urgency:?\s*)/gi, "\nUrgency: ")
    .replace(/(Priority:?\s*)/gi, "\nPriority: ")
    .replace(/([a-z0-9])([A-Z][a-z])/g, "$1\n$2")
    .replace(/(INR\s?[\d,]+)([A-Z])/g, "$1\n$2");

  const lines = formatted
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const parsedKeyValues: { label: string; val: string }[] = [];
  const textParts: string[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < line.length - 1) {
      const k = line.slice(0, colonIdx).trim();
      const v = line.slice(colonIdx + 1).trim();
      if (k && v) {
        const lk = k.toLowerCase();
        if (!lk.includes("sourcing") && !lk.includes("method")) {
          parsedKeyValues.push({ label: humanizeKey(k), val: v });
        }
      } else if (line) {
        if (!line.toLowerCase().includes("sourcing method")) {
          textParts.push(line);
        }
      }
    } else if (line) {
      if (!line.toLowerCase().includes("sourcing method")) {
        textParts.push(line);
      }
    }
  }

  const ctx = React.useContext(BuyerSideContext);
  const shouldShowCost = ctx.shouldShowEstimatedCost ?? ctx.isBuyer;

  const freeText = textParts.join(" ").trim();

  // Resolve urgency: prefer explicit non-normal prop, otherwise fallback to parsed text/KV, else default to prop or Normal
  const parsedUrgencyFromKVs = parsedKeyValues.find(
    (kv) =>
      kv.label.toLowerCase() === "urgency" ||
      kv.label.toLowerCase() === "priority",
  )?.val;
  const parsedUrgencyFromRaw = raw.match(
    /(?:urgency|priority):\s*([A-Za-z0-9_-]+)/i,
  )?.[1];
  const detectedUrgency = parsedUrgencyFromKVs || parsedUrgencyFromRaw;

  const effectiveUrgency =
    urgency && urgency.toLowerCase() !== "normal"
      ? urgency
      : detectedUrgency || urgency || "Normal";

  const normUrgency = String(effectiveUrgency).trim().toLowerCase();
  const isEmergency = normUrgency.includes("emergency");
  const isUrgent =
    normUrgency.includes("urgent") || normUrgency.includes("high");

  const visibleKeyValues = parsedKeyValues.filter((kv) => {
    const lk = kv.label.toLowerCase();
    if (lk === "urgency" || lk === "priority") {
      return false;
    }
    // Filter out redundant estimated value pill since Estimated Value is already displayed as the first badge
    if (lk === "value" || lk === "rfp value" || lk === "estimated value") {
      return false;
    }
    if (!shouldShowCost) {
      if (
        lk.includes("value") ||
        lk.includes("price") ||
        lk.includes("cost") ||
        lk.includes("rate") ||
        lk.includes("budget")
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Top Scope Highlights Ribbon */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50/80 p-3 border border-slate-150">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
            Estimated Value:
          </span>
          {shouldShowCost ? (
            <span className="text-xs font-bold text-emerald-700">
              {formatCurrency(estimatedValue)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
              Confidential <Lock className="h-3 w-3 text-slate-400" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
            Urgency:
          </span>
          <span
            className={cn(
              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
              isEmergency
                ? "bg-rose-100 text-rose-800 border-rose-300 font-black"
                : isUrgent
                  ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                  : "bg-slate-100 text-slate-700 border-slate-200",
            )}
          >
            {effectiveUrgency}
          </span>
        </div>
        {visibleKeyValues.map((kv, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs"
          >
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
              {kv.label}:
            </span>
            <span className="text-xs font-semibold text-slate-800">
              {kv.val}
            </span>
          </div>
        ))}
      </div>

      {/* Scope Statement */}
      {freeText && freeText !== "No scope summary provided." && (
        <div className="rounded-xl border-l-4 border-indigo-600 bg-slate-50/70 p-3.5 border border-slate-150">
          <p className="text-xs font-normal text-slate-700 leading-relaxed whitespace-pre-line">
            {freeText}
          </p>
        </div>
      )}
    </div>
  );
}

const milestoneColumns: ColumnDef<any>[] = [
  {
    key: "label",
    header: "Milestone Label",
    cell: (m, idx) => {
      const label = firstPresent(
        m.label,
        m.name,
        m.title,
        `Milestone ${idx + 1}`,
      );
      return (
        <span className="font-bold text-slate-900">
          {formatPrimitiveValue(label)}
        </span>
      );
    },
  },
  {
    key: "percentage",
    header: "Percentage",
    cell: (m) => {
      const pct = firstPresent(m.percentage, m.percent, m.share, "-");
      return (
        <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700 text-[9.5px]">
          {pct !== "-" ? `${pct}%` : "-"}
        </span>
      );
    },
  },
  {
    key: "trigger",
    header: "Trigger / Condition",
    cell: (m) => {
      const trigger = firstPresent(m.trigger, m.condition, m.description, "-");
      return (
        <span className="text-slate-600 max-w-xs">
          {formatPrimitiveValue(trigger)}
        </span>
      );
    },
  },
];

function MilestonesTable({ milestones }: { milestones: any }) {
  const list = asArray(milestones).filter(hasDetailData);
  if (!list.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
        <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" /> Payment
        &amp; Deliverable Milestones
      </h4>
      <DataTable<any>
        data={list}
        columns={milestoneColumns}
        keyExtractor={(m, idx) => String(m.id || idx)}
        showSrNo={true}
        srNoHeader="#"
        srNoWidth="w-12"
        minWidth="min-w-[550px]"
        emptyTitle="No milestones"
        emptyDescription="No payment milestones defined."
      />
    </div>
  );
}

function ServiceDetailsSection({
  serviceDetails,
  isRfqType,
}: {
  serviceDetails: any;
  isRfqType?: boolean;
}) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === "boolean" ? ctx : ctx.isBuyer;
  const isOpenTender = typeof ctx === "boolean" ? false : ctx.isOpenTender;
  const isLimitedTender =
    typeof ctx === "boolean" ? false : ctx.isLimitedTender || false;

  // Strictly hide Service Details & Parameters on RFQ globally, or on buyer side for limited tender, open tender, etc.
  if (
    isRfqType ||
    (isBuyer && (isLimitedTender || isOpenTender)) ||
    !serviceDetails ||
    !isPlainObject(serviceDetails)
  )
    return null;

  const {
    duration,
    projectDuration,
    penaltyClause,
    slaResponseTime,
    manpowerRequired,
    experienceRequired,
    milestones,
    warranty,
    warrantyTerms,
    warrantyPeriod,
    paymentTerms,
    ...rest
  } = serviceDetails;

  const mainFields = compactObject({
    ...(isRfqType
      ? {}
      : {
          duration,
          projectDuration,
          penaltyClause,
          slaResponseTime,
          manpowerRequired,
          experienceRequired,
        }),
    ...rest,
  });

  const entries = detailEntries(mainFields);
  if (!entries.length) return null;

  return (
    <div className="space-y-2.5 pt-1.5">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <Building2 className="h-3.5 w-3.5 text-indigo-600" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
          Service Details &amp; Parameters
        </h3>
      </div>
      <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-150">
        <PropertyGrid columns={5}>
          {entries.map(([key, val]) => (
            <PropertyItem key={key} label={humanizeKey(key)} value={val} />
          ))}
        </PropertyGrid>
      </div>
    </div>
  );
}
function getUniqueItemFiles(
  item: any,
  sp: any = {},
  defaultName: string = "Item",
): any[] {
  if (!item && !sp) return [];

  const rawCandidates: any[] = [
    ...asArray(item?.attachments),
    ...asArray(item?.files),
    ...asArray(item?.documents),
    ...asArray(item?.itemFiles),
    ...asArray(sp?.attachments),
    ...asArray(sp?.files),
    ...asArray(sp?.documents),
    ...asArray(sp?.uploadedSpecificationFiles),
  ];

  // Include individual file fields if present
  if (
    item?.fileAssetId ||
    item?.url ||
    item?.fileUrl ||
    item?.specificationFileName ||
    item?.attachmentUrl ||
    item?.attachmentName
  ) {
    rawCandidates.push({
      fileAssetId: item.fileAssetId,
      url: item.url || item.fileUrl || item.attachmentUrl,
      fileName:
        item.fileName ||
        item.originalName ||
        item.specificationFileName ||
        item.attachmentName,
      name:
        item.fileName ||
        item.originalName ||
        item.specificationFileName ||
        item.attachmentName,
    });
  }
  if (
    sp?.fileAssetId ||
    sp?.url ||
    sp?.fileUrl ||
    sp?.specificationFileName ||
    sp?.attachmentUrl ||
    sp?.attachmentName
  ) {
    rawCandidates.push({
      fileAssetId: sp.fileAssetId,
      url: sp.url || sp.fileUrl || sp.attachmentUrl,
      fileName:
        sp.fileName ||
        sp.originalName ||
        sp.specificationFileName ||
        sp.attachmentName,
      name:
        sp.fileName ||
        sp.originalName ||
        sp.specificationFileName ||
        sp.attachmentName,
    });
  }

  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();
  const result: any[] = [];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    let fileObj: any = raw;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (
        !trimmed ||
        trimmed === "[]" ||
        trimmed === "{}" ||
        trimmed === "null" ||
        trimmed === "undefined"
      )
        continue;
      try {
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          fileObj = JSON.parse(trimmed);
        } else {
          fileObj = {
            url: trimmed,
            name: trimmed.split("/").pop()?.split("?")[0] || trimmed,
          };
        }
      } catch {
        fileObj = {
          url: trimmed,
          name: trimmed.split("/").pop()?.split("?")[0] || trimmed,
        };
      }
    } else if (typeof raw === "number") {
      fileObj = {
        fileAssetId: raw,
        fid: raw,
        name: `File #${raw}`,
        url: `/api/files/${raw}/view`,
      };
    }

    if (!fileObj || typeof fileObj !== "object") continue;

    const fileAssetId =
      fileObj.fileAssetId ??
      fileObj.fid ??
      fileObj.id ??
      (typeof fileObj.fileId === "number" ? fileObj.fileId : undefined);
    const rawUrl =
      fileObj.url ||
      fileObj.fileUrl ||
      fileObj.attachmentUrl ||
      (fileAssetId ? `/api/files/${fileAssetId}/view` : undefined);
    const cleanUrl = rawUrl
      ? String(rawUrl).split("?")[0].trim().toLowerCase()
      : "";

    let extractedId = fileAssetId ? String(fileAssetId) : undefined;
    if (!extractedId && cleanUrl) {
      const match = cleanUrl.match(/\/files\/(\d+)/i);
      if (match) extractedId = match[1];
    }

    const rawName =
      fileObj.fileName ||
      fileObj.name ||
      fileObj.originalName ||
      fileObj.documentName ||
      fileObj.specificationFileName ||
      fileObj.title;
    const derivedName =
      rawName && String(rawName).trim()
        ? String(rawName).trim()
        : cleanUrl
          ? cleanUrl.split("/").pop()?.split("?")[0]
          : extractedId
            ? `File #${extractedId}`
            : `${defaultName} Attachment`;

    const lowerName = String(derivedName || "")
      .toLowerCase()
      .trim();
    const isGenericName =
      !lowerName ||
      lowerName === "document" ||
      lowerName === "attachment" ||
      lowerName === "specification" ||
      lowerName === "specification file" ||
      lowerName === "procurement document" ||
      lowerName === `${defaultName.toLowerCase()} specification` ||
      lowerName === `${defaultName.toLowerCase()} attachment`;

    // Deduplication checks:
    if (extractedId && seenIds.has(extractedId)) {
      continue;
    }
    if (cleanUrl && seenUrls.has(cleanUrl)) {
      continue;
    }
    if (!isGenericName && lowerName && seenNames.has(lowerName)) {
      continue;
    }

    if (extractedId) seenIds.add(extractedId);
    if (cleanUrl) seenUrls.add(cleanUrl);
    if (!isGenericName && lowerName) seenNames.add(lowerName);

    result.push({
      ...fileObj,
      fileAssetId: extractedId ? Number(extractedId) : fileAssetId,
      fid: extractedId ? Number(extractedId) : fileAssetId,
      id: extractedId ? Number(extractedId) : (fileObj.id ?? fileAssetId),
      fileName: derivedName,
      name: derivedName,
      originalName: fileObj.originalName || derivedName,
      url:
        rawUrl || (extractedId ? `/api/files/${extractedId}/view` : undefined),
    });
  }

  return result;
}

function LineItemsTable({
  items,
  defaultSubject,
  isBuyer,
}: {
  items: any;
  defaultSubject?: string;
  isBuyer?: boolean;
}) {
  const ctx = React.useContext(BuyerSideContext);
  const shouldShowCost = ctx.shouldShowEstimatedCost ?? ctx.isBuyer ?? isBuyer;
  const [viewingItemFiles, setViewingItemFiles] = useState<{
    title: string;
    files: any[];
  } | null>(null);
  const list = asArray(items).filter(hasDetailData);

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        key: "type",
        header: "Type",
        width: "w-20",
        cell: (item) => {
          const sp =
            typeof item.specifications === "object" && item.specifications
              ? item.specifications
              : {};
          const rawType = firstPresent(
            item.itemType,
            item.type,
            item.categoryType,
            sp.itemType,
            sp.type,
            sp.categoryType,
          );
          const isService = String(rawType || "")
            .toLowerCase()
            .includes("service");
          const itemType = isService ? "Service" : "Product";
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider",
                isService
                  ? "border border-purple-200 bg-purple-50 text-purple-700"
                  : "border border-blue-200 bg-blue-50 text-blue-700",
              )}
            >
              {itemType}
            </span>
          );
        },
      },
      {
        key: "name",
        header: "Item / Service Name",
        width: "w-[28%]",
        cell: (item, idx) => {
          const sp =
            typeof item.specifications === "object" && item.specifications
              ? item.specifications
              : {};
          const rawName = firstPresent(
            item.name,
            item.itemName,
            item.title,
            item.productName,
            item.materialName,
            item.serviceName,
            sp.itemName,
            sp.name,
            sp.title,
          );
          const isGeneric =
            !rawName ||
            /^item\s*#?\d+$/i.test(String(rawName).trim()) ||
            String(rawName).trim().toLowerCase() === "item";
          const name = !isGeneric
            ? String(rawName)
            : defaultSubject && !/^item\s*#?\d+$/i.test(defaultSubject)
              ? defaultSubject
              : `Item #${idx + 1}`;
          return (
            <div
              className="font-bold text-slate-900 text-xs line-clamp-2 break-words max-w-[320px]"
              title={String(name)}
            >
              {formatPrimitiveValue(name)}
            </div>
          );
        },
      },
      {
        key: "spec",
        header: "Specifications / Scope",
        width: "w-[24%]",
        cell: (item) => {
          const sp =
            typeof item.specifications === "object" && item.specifications
              ? item.specifications
              : {};
          const rawSpec = firstPresent(
            item.technicalSpecification,
            item.specification,
            item.spec,
            typeof item.specifications === "string"
              ? item.specifications
              : null,
            sp.technicalSpecification,
            sp.specification,
            sp.text,
            sp.description,
            sp.details,
            sp.scopeOfWork,
            sp.scope,
            sp.remarks,
            item.description,
            item.desc,
            item.details,
            item.scopeOfWork,
            item.scope,
            item.remarks,
            item.requirements,
            item.particulars,
            sp.particulars,
          );
          const allFiles = getUniqueItemFiles(item, sp, item.name || "Item");
          const hasFiles = allFiles.length > 0;

          return (
            <div className="text-slate-600 font-normal max-w-[280px]">
              {rawSpec ? (
                <span
                  className="line-clamp-2 text-[11px] font-medium text-slate-800 break-words block"
                  title={String(rawSpec)}
                >
                  {formatPrimitiveValue(rawSpec)}
                </span>
              ) : hasFiles ? (
                <span className="text-indigo-600 text-[11px] font-medium">
                  Specifications Attached ({allFiles.length} file
                  {allFiles.length === 1 ? "" : "s"})
                </span>
              ) : (
                <span className="text-slate-400 italic text-[11px]">
                  Standard specifications apply
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "qty",
        header: "Qty & UOM",
        width: "w-24",
        align: "center",
        cell: (item) => {
          const sp =
            typeof item.specifications === "object" && item.specifications
              ? item.specifications
              : {};
          const rawQty = firstPresent(
            item.quantity,
            item.qty,
            item.targetQty,
            item.requiredQty,
            item.quantityRequired,
            item.itemQuantity,
            item.count,
            item.unitCount,
            item.numberOfUnits,
            sp.quantity,
            sp.qty,
          );
          const unit =
            firstPresent(
              item.unit,
              item.uom,
              item.unitOfMeasure,
              item.unitType,
              item.measuringUnit,
              sp.unit,
              sp.uom,
              sp.unitOfMeasure,
            ) || "NOS.";
          const cleanUom = sanitizeUom(unit);
          const qtyDisplay =
            rawQty !== undefined &&
            rawQty !== null &&
            rawQty !== "" &&
            rawQty !== "-"
              ? String(rawQty)
              : unit
                ? "1"
                : "-";
          return (
            <div className="flex items-center justify-center gap-1 min-w-0 max-w-full">
              <span className="font-bold text-slate-900 tabular-nums shrink-0">
                {qtyDisplay}
              </span>{" "}
              <span
                className="text-[9.5px] font-bold text-slate-500 uppercase truncate max-w-[65px] shrink"
                title={unit ? String(unit) : undefined}
              >
                {cleanUom}
              </span>
            </div>
          );
        },
      },
      {
        key: "rate",
        header: "Est. Unit Rate",
        width: "w-24",
        align: "right",
        cell: (item) => {
          if (!shouldShowCost) {
            return (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                Confidential
              </span>
            );
          }
          const sp =
            typeof item.specifications === "object" && item.specifications
              ? item.specifications
              : {};
          const rawRate = firstPresent(
            item.estimatedUnitPrice,
            item.unitPrice,
            item.estimatedRate,
            item.price,
            item.rate,
            item.targetRate,
            sp.estimatedUnitPrice,
            sp.unitPrice,
            sp.estimatedRate,
            sp.price,
            sp.rate,
          );
          const rateNumber =
            rawRate !== undefined &&
            rawRate !== null &&
            rawRate !== "" &&
            !isNaN(Number(rawRate)) &&
            Number(rawRate) > 0
              ? Number(rawRate)
              : null;
          return (
            <div className="font-bold text-slate-900 whitespace-nowrap">
              {rateNumber !== null ? (
                <span>₹{rateNumber.toLocaleString("en-IN")}</span>
              ) : (
                <span className="text-slate-400 font-normal">-</span>
              )}
            </div>
          );
        },
      },
      {
        key: "hsn",
        header: "HSN / SAC",
        width: "w-20",
        align: "center",
        cell: (item) => {
          const sp =
            typeof item.specifications === "object" && item.specifications
              ? item.specifications
              : {};
          const rawHsn = firstPresent(
            item.hsn_sac_code,
            item.hsnSacCode,
            item.hsnSac,
            item.hsn,
            item.hsnCode,
            item.sac,
            item.sacCode,
            sp.hsn_sac_code,
            sp.hsnSacCode,
            sp.hsnSac,
            sp.hsn,
            sp.hsnCode,
            sp.sac,
            sp.sacCode,
          );
          const cleanHsnCode = sanitizeHsn(rawHsn);
          return (
            <span
              className="font-mono text-[10.5px] font-medium text-slate-600 truncate max-w-[80px] block"
              title={cleanHsnCode !== "-" ? cleanHsnCode : undefined}
            >
              {cleanHsnCode}
            </span>
          );
        },
      },
      {
        key: "brand",
        header: "Brand & Policy",
        width: "w-28",
        cell: (item) => {
          const sp =
            typeof item.specifications === "object" && item.specifications
              ? item.specifications
              : {};
          const itemBrand = firstPresent(
            item.brand_preference,
            item.brandPreference,
            item.preferredBrand,
            item.brand,
            item.brandName,
            item.make,
            item.manufacturer,
            item.makeModel,
            item.model,
            item.brandRequirement,
            sp.brand_preference,
            sp.brandPreference,
            sp.preferredBrand,
            sp.brand,
            sp.brandName,
            sp.make,
            sp.manufacturer,
            sp.brandRequirement,
          );
          const itemPolicy = firstPresent(
            item.brand_flexible,
            item.brandFlexible,
            item.isBrandFlexible,
            sp.brand_flexible,
            sp.brandFlexible,
            sp.isBrandFlexible,
            item.brandPolicy,
            item.policy,
            item.brandRule,
            sp.brandPolicy,
            sp.policy,
          );
          const isLocked =
            itemPolicy === "No" ||
            itemPolicy === false ||
            String(itemPolicy).toLowerCase() === "no" ||
            String(itemPolicy).toLowerCase() === "lock" ||
            String(itemPolicy).toLowerCase() === "locked" ||
            String(itemPolicy).toLowerCase() === "strict";
          const brandStr =
            itemBrand &&
            String(itemBrand).trim() &&
            String(itemBrand).trim() !== "-"
              ? String(itemBrand).trim()
              : "Any Brand";
          const brandDisplayName =
            brandStr.length > 30 ? brandStr.slice(0, 25) + "..." : brandStr;
          return (
            <div className="min-w-0">
              <div
                className="text-slate-800 text-[11px] font-semibold truncate max-w-[110px]"
                title={brandStr}
              >
                {brandDisplayName}
              </div>
              <div className="mt-0.5">
                {isLocked ? (
                  <span className="inline-flex items-center text-[8.5px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                    Lock
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[8.5px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                    Flexible
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "docs",
        header: "Documents & Specs",
        width: "w-36",
        cell: (item, idx) => {
          const sp =
            typeof item.specifications === "object" && item.specifications
              ? item.specifications
              : {};
          const rawName = firstPresent(
            item.name,
            item.itemName,
            item.title,
            item.productName,
            item.materialName,
            item.serviceName,
            sp.itemName,
            sp.name,
            sp.title,
          );
          const isGeneric =
            !rawName ||
            /^item\s*#?\d+$/i.test(String(rawName).trim()) ||
            String(rawName).trim().toLowerCase() === "item";
          const name = !isGeneric
            ? String(rawName)
            : defaultSubject && !/^item\s*#?\d+$/i.test(defaultSubject)
              ? defaultSubject
              : `Item #${idx + 1}`;
          const allFiles = getUniqueItemFiles(item, sp, name);
          const fileCount = allFiles.length;
          if (fileCount === 0)
            return <span className="text-slate-400 font-normal">-</span>;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (allFiles.length === 1) {
                  const f = allFiles[0];
                  const fname =
                    f.fileName ||
                    f.name ||
                    f.originalName ||
                    `${name} Attachment`;
                  openFileAsset(
                    {
                      fileAssetId:
                        f.fileAssetId ||
                        f.id ||
                        (typeof f === "number" ? f : undefined),
                      url:
                        f.url ||
                        f.fileUrl ||
                        (typeof f === "string" ? f : undefined),
                      originalName: fname,
                    },
                    fname,
                  );
                } else {
                  setViewingItemFiles({ title: name, files: allFiles });
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 px-2 py-1 text-[10px] font-extrabold transition-colors cursor-pointer shadow-2xs"
              title="Click to view attachment"
            >
              <Paperclip className="h-3 w-3 text-emerald-600 shrink-0" />
              <span>
                {fileCount} file{fileCount === 1 ? "" : "s"}
              </span>
              <Eye className="h-3 w-3 text-emerald-700 shrink-0 ml-0.5" />
            </button>
          );
        },
      },
    ],
    [defaultSubject, shouldShowCost],
  );

  if (!list.length) return null;

  return (
    <div className="space-y-2.5 pt-1.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-indigo-600" />
          Line Items ({list.length})
        </h3>
      </div>
      <DataTable<any>
        data={list}
        columns={columns}
        keyExtractor={(item, idx) => String(item.id || item.itemId || idx)}
        showSrNo={true}
        srNoHeader="#"
        srNoWidth="w-12"
        minWidth="min-w-[1000px]"
        emptyTitle="No line items"
        emptyDescription="No line items available for this procurement."
      />

      {viewingItemFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Item Attachments
                </h4>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {viewingItemFiles.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingItemFiles(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {viewingItemFiles.files.map((file: any, fIdx: number) => {
                const fName =
                  file.fileName ||
                  file.name ||
                  file.originalName ||
                  `Attachment #${fIdx + 1}`;
                return (
                  <div
                    key={fIdx}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5"
                  >
                    <span
                      className="text-xs font-semibold text-slate-800 truncate max-w-[220px]"
                      title={fName}
                    >
                      {fName}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        openFileAsset(
                          {
                            fileAssetId:
                              file.fileAssetId ||
                              file.id ||
                              (typeof file === "number" ? file : undefined),
                            url:
                              file.url ||
                              file.fileUrl ||
                              (typeof file === "string" ? file : undefined),
                            originalName: fName,
                          },
                          fName,
                        );
                      }}
                      className="h-7 text-[11px] gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoqTableList({
  data,
  defaultSubject,
  defaultCategory,
  defaultEstimatedValue,
}: {
  data: any;
  defaultSubject?: string;
  defaultCategory?: string;
  defaultEstimatedValue?: any;
}) {
  const ctx = React.useContext(BuyerSideContext);
  const shouldShowCost = ctx.shouldShowEstimatedCost ?? ctx.isBuyer;
  const list = asArray(data).filter(hasDetailData);

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        key: "category",
        header: "Category",
        cell: (item) => {
          const rawCat = firstPresent(
            item.category,
            item.itemCategory,
            item.name,
            item.itemName,
            item.title,
          );
          const isGenericCat =
            !rawCat ||
            String(rawCat).trim().toLowerCase() === "general" ||
            /^category\s*#?\d+$/i.test(String(rawCat).trim()) ||
            /^item\s*#?\d+$/i.test(String(rawCat).trim());
          const category = !isGenericCat
            ? String(rawCat)
            : defaultCategory && defaultCategory !== "General Procurement"
              ? defaultCategory
              : defaultSubject || "General";
          return (
            <span className="font-bold text-slate-900">
              {formatPrimitiveValue(category)}
            </span>
          );
        },
      },
      {
        key: "quantity",
        header: "Quantity",
        cell: (item) => {
          const qty = firstPresent(
            item.quantity,
            item.qty,
            item.targetQty,
            item.count,
            "1",
          );
          const uom = firstPresent(
            item.uom,
            item.unit,
            item.unitOfMeasure,
            "Nos",
          );
          return (
            <span className="font-medium text-slate-800">
              {qty} {uom}
            </span>
          );
        },
      },
      {
        key: "uom",
        header: "UOM",
        cell: (item) => {
          const uom = firstPresent(
            item.uom,
            item.unit,
            item.unitOfMeasure,
            "Nos",
          );
          return (
            <span className="text-slate-600">
              {formatPrimitiveValue(uom || "-")}
            </span>
          );
        },
      },
      {
        key: "estimatedRate",
        header: "Est. Rate",
        cell: (item) => {
          if (!shouldShowCost) {
            return (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                Confidential
              </span>
            );
          }
          const rawRate = firstPresent(
            item.estimatedRate,
            item.rate,
            item.unitPrice,
            item.price,
            item.estimatedPrice,
          );
          const rateNum =
            rawRate !== undefined &&
            rawRate !== null &&
            rawRate !== "" &&
            rawRate !== "-" &&
            !isNaN(Number(rawRate))
              ? Number(rawRate)
              : defaultEstimatedValue && Number(defaultEstimatedValue) > 0
                ? Number(defaultEstimatedValue)
                : null;
          return (
            <span className="text-slate-700">
              {rateNum !== null ? formatCurrency(rateNum) : "-"}
            </span>
          );
        },
      },
      {
        key: "tax",
        header: "Tax %",
        cell: (item) => {
          const tax = firstPresent(
            item.taxPercent,
            item.tax,
            item.gstPercent,
            item.gst,
            item.gstRate,
          );
          const taxNum =
            tax !== undefined && tax !== null && tax !== "" && tax !== "-"
              ? Number(String(tax).replace("%", ""))
              : null;
          return (
            <span className="text-slate-700">
              {taxNum !== null && !isNaN(taxNum) ? `${taxNum}%` : "-"}
            </span>
          );
        },
      },
      {
        key: "total",
        header: "Total",
        cell: (item) => {
          if (!shouldShowCost) {
            return (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                Confidential
              </span>
            );
          }
          const rawTotal = firstPresent(
            item.total,
            item.amount,
            item.totalPrice,
            item.estimatedTotal,
          );
          const totalNum =
            rawTotal !== undefined &&
            rawTotal !== null &&
            rawTotal !== "" &&
            rawTotal !== "-" &&
            !isNaN(Number(rawTotal))
              ? Number(rawTotal)
              : defaultEstimatedValue && Number(defaultEstimatedValue) > 0
                ? Number(defaultEstimatedValue)
                : null;
          return (
            <span className="font-bold text-slate-900">
              {totalNum !== null ? formatCurrency(totalNum) : "-"}
            </span>
          );
        },
      },
    ],
    [defaultCategory, defaultSubject, defaultEstimatedValue, shouldShowCost],
  );

  if (!list.length) return null;

  return (
    <div className="space-y-2.5 pt-1.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
          BOQ Table ({list.length})
        </h3>
      </div>
      <DataTable<any>
        data={list}
        columns={columns}
        keyExtractor={(item, idx) => String(item.srNo || item.id || idx)}
        showSrNo={true}
        srNoHeader="Sr #"
        srNoWidth="w-12"
        minWidth="min-w-[650px]"
        emptyTitle="No BOQ items"
        emptyDescription="No BOQ items specified."
      />
    </div>
  );
}

const technicalCriteriaColumns: ColumnDef<any>[] = [
  {
    key: "name",
    header: "Criteria Name",
    cell: (item, idx) => {
      if (isPlainObject(item)) {
        const name = firstPresent(
          item.name,
          item.title,
          item.label,
          `Criteria ${idx + 1}`,
        );
        return (
          <span className="font-bold text-slate-900">
            {formatPrimitiveValue(name)}
          </span>
        );
      }
      return (
        <span className="font-bold text-slate-900">
          {formatPrimitiveValue(item)}
        </span>
      );
    },
  },
  {
    key: "description",
    header: "Description",
    cell: (item) => {
      if (!isPlainObject(item))
        return <span className="text-slate-400">-</span>;
      const desc = firstPresent(item.description, item.desc, item.details, "-");
      return (
        <span className="font-normal text-slate-600 max-w-xs">
          {formatPrimitiveValue(desc)}
        </span>
      );
    },
  },
  {
    key: "mandatory",
    header: "Mandatory",
    align: "center",
    cell: (item) => {
      if (!isPlainObject(item))
        return <span className="text-slate-400">-</span>;
      const mandatory =
        item.mandatory !== false &&
        String(item.mandatory).toLowerCase() === "yes";
      return (
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider border",
            mandatory
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-slate-50 text-slate-600",
          )}
        >
          {mandatory ? "Yes" : "No"}
        </span>
      );
    },
  },
  {
    key: "minMarks",
    header: "Min Marks",
    align: "center",
    cell: (item) => {
      if (!isPlainObject(item))
        return <span className="text-slate-400">-</span>;
      const minMarks = firstPresent(
        item.minMarks,
        item.minScore,
        item.passingMarks,
        "-",
      );
      return (
        <span className="font-semibold text-amber-700">
          {formatPrimitiveValue(minMarks)}
        </span>
      );
    },
  },
  {
    key: "maxScore",
    header: "Max Score",
    align: "center",
    cell: (item) => {
      if (!isPlainObject(item))
        return <span className="text-slate-400">-</span>;
      const maxScore = firstPresent(
        item.maxScore,
        item.maxMarks,
        item.score,
        "-",
      );
      return (
        <span className="font-bold text-slate-900">
          {formatPrimitiveValue(maxScore)}
        </span>
      );
    },
  },
  {
    key: "weightage",
    header: "Weightage",
    align: "center",
    cell: (item) => {
      if (!isPlainObject(item))
        return <span className="text-slate-400">-</span>;
      const weightage = firstPresent(item.weightage, item.weight, "-");
      return (
        <span className="font-bold text-indigo-700">
          {weightage !== "-" ? `${weightage}%` : "-"}
        </span>
      );
    },
  },
];

function TechnicalCriteriaTableList({ data }: { data: any }) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === "boolean" ? ctx : ctx.isBuyer;

  let list: any[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (isPlainObject(data)) {
    list = asArray(
      data.technicalCriteria ||
        data.criteria ||
        data.evaluationCriteria ||
        data.items,
    );
  }
  list = list.filter(hasDetailData);

  if (!list.length) {
    if (!isBuyer) return null;
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-3.5 w-3.5 text-indigo-600" />
            Technical Evaluation Criteria
          </h3>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs font-semibold text-slate-400">
          No detailed scoring criteria defined (N/A)
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="h-3.5 w-3.5 text-indigo-600" />
          Technical Evaluation Criteria ({list.length})
        </h3>
      </div>
      <DataTable<any>
        data={list}
        columns={technicalCriteriaColumns}
        keyExtractor={(item, idx) => String(item.id || idx)}
        showSrNo={true}
        srNoHeader="#"
        srNoWidth="w-12"
        minWidth="min-w-[700px]"
        emptyTitle="No evaluation criteria"
        emptyDescription="No technical evaluation criteria specified."
      />
    </div>
  );
}

const consigneeColumns: ColumnDef<any>[] = [
  {
    key: "name",
    header: "Consignee Name",
    cell: (item, idx) => {
      if (isPlainObject(item)) {
        const name = firstPresent(
          item.name,
          item.consigneeName,
          item.contactPerson,
          `Consignee ${idx + 1}`,
        );
        return (
          <span className="font-bold text-slate-900">
            {formatPrimitiveValue(name)}
          </span>
        );
      }
      return (
        <span className="font-bold text-slate-900">
          {formatPrimitiveValue(item)}
        </span>
      );
    },
  },
  {
    key: "quantity",
    header: "Quantity",
    cell: (item) => {
      if (!isPlainObject(item))
        return <span className="text-slate-400">-</span>;
      const qty = firstPresent(item.quantity, item.qty, "-");
      return (
        <span className="inline-block rounded-md bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 font-semibold text-indigo-700 text-[10px]">
          {formatPrimitiveValue(qty)}
        </span>
      );
    },
  },
  {
    key: "location",
    header: "Delivery Location / Address",
    cell: (item) => {
      if (!isPlainObject(item))
        return <span className="text-slate-400">-</span>;
      const rawLoc = firstPresent(
        item.location,
        item.address,
        item.deliveryAddress,
        "-",
      );
      const cleanLoc = cleanDeliveryAddress(rawLoc);
      return (
        <span className="text-slate-700">
          {cleanLoc || formatPrimitiveValue(rawLoc)}
        </span>
      );
    },
  },
];

function ConsigneeTableList({
  data,
  deliveryLocation,
  deliveryTerms,
  isBuyerRfq,
  isBuyerSide,
  isRfqType,
  isRfpType,
  isRateContractType,
}: {
  data: any;
  deliveryLocation?: any;
  deliveryTerms?: any;
  isBuyerRfq?: boolean;
  isBuyerSide?: boolean;
  isRfqType?: boolean;
  isRfpType?: boolean;
  isRateContractType?: boolean;
}) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === "boolean" ? ctx : ctx.isBuyer;
  const items = asArray(data).filter(hasDetailData);

  const hasDeliveryTerms =
    hasDetailData(deliveryTerms) &&
    deliveryTerms !== "N/A" &&
    deliveryTerms !== "—";
  // Avoid repeating the exact same delivery location above the consignee table when the table already specifies destination addresses
  const hasConsigneeAddress = items.some(
    (item) =>
      isPlainObject(item) &&
      hasDetailData(item.location || item.address || item.deliveryAddress),
  );
  const showGeneralLocation =
    !hasConsigneeAddress && hasDetailData(deliveryLocation);
  const showDeliveryMeta =
    !isRfqType &&
    !isRfpType &&
    !isRateContractType &&
    (showGeneralLocation || hasDeliveryTerms);

  if (!showDeliveryMeta && items.length === 0) {
    if (!isBuyer) return null;
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
        <SectionHeader title="Consignee & Delivery Information" icon={MapPin} />
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs font-semibold text-slate-400">
          No consignee delivery destinations specified (N/A)
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
      <SectionHeader title="Consignee & Delivery Information" icon={MapPin} />

      {/* General Delivery Location & Delivery Terms */}
      {showDeliveryMeta && (
        <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-150">
          <PropertyGrid
            columns={showGeneralLocation && hasDeliveryTerms ? 2 : 1}
          >
            {showGeneralLocation && (
              <PropertyItem
                label="General Delivery Location"
                value={cleanDeliveryAddress(deliveryLocation)}
              />
            )}
            {hasDeliveryTerms && (
              <PropertyItem label="Delivery Terms" value={deliveryTerms} />
            )}
          </PropertyGrid>
        </div>
      )}

      {items.length > 0 && (
        <DataTable<any>
          data={items}
          columns={consigneeColumns}
          keyExtractor={(item, idx) => String(item.id || idx)}
          showSrNo={true}
          srNoHeader="#"
          srNoWidth="w-12"
          minWidth="min-w-[600px]"
          emptyTitle="No consignees"
          emptyDescription="No consignee delivery destinations listed."
        />
      )}
    </div>
  );
}

export interface ProcurementDetailUnifiedViewProps {
  procurementType:
    | "RFP"
    | "RFQ"
    | "RATE_CONTRACT"
    | "OPEN_TENDER"
    | "LIMITED_TENDER"
    | string;
  procurementLabel?: string;
  id: string | number;
  displayId?: string;
  requirementNumber?: string;
  subject: string;
  title?: string;
  status: string;
  buyerName?: string;
  orgName?: string;
  contactPerson?: string;
  buyerEmail?: string;
  buyerMobile?: string;
  buyerAddress?: string;
  department?: string;
  buyer?: any;
  estimatedValue?: number | string;
  discloseEstimatedCost?: boolean;
  urgency?: string;
  priority?: string;
  deadlineDate?: Date | string | null;
  createdAt?: Date | string | null;
  startDate?: Date | string | null;
  publishedDate?: string;
  submissionStartDate?: string;
  closingDate?: string;
  clarificationDate?: string;
  technicalDate?: string;
  presentationDate?: string;
  financialDate?: string;
  awardDate?: string;
  requiredByDate?: string;
  requiredBy?: string;
  expectedDeliveryDate?: string;
  bidValidityDate?: string;
  validityDays?: number | string;
  preBidDate?: string;
  category?: string;
  projectDuration?: string;
  procurementMethod?: string;
  buyingType?: string;
  deliveryLocation?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  freightIncluded?: boolean;
  description?: string;
  payload?: any;
  documents?: DisplayDocument[];
  items?: any[];
  requiredDocuments?: any;
  boqTable?: any;
  serviceDetails?: any;
  consigneeDetails?: any;
  evaluationMethod?: string;
  timeSlot?: string;
  technicalOpeningDate?: string;
  financialOpeningDate?: string;
  participations?: any[];
  awards?: any;
  participantsCount?: number;
  totalClarifications?: number;
  hasSubmittedProposal?: boolean;
  ownParticipation?: any;
  ownResponse?: any;
  emdAmount?: number;
  isEmdRequired?: boolean;
  packetType?: string;
  allowClarification?: boolean;
  backRoute?: string;
  backRouteLabel?: string;
  onBack?: () => void;
  onDiscardClick?: () => void;
  onCancelClick?: () => void;
  cancelButtonLabel?: string;
  submitButtonLabel?: string;
  onSubmitClick?: () => void;
  onViewQuotationClick?: () => void;
  isSubmitDisabled?: boolean;
  onDownloadClick?: () => void;
  /** Override the ClarificationPanel kind (defaults to 'quote-request' for RFQ/RFP, 'requirement' for Rate Contract/Limited Tender) */
  clarificationKind?: "quote-request" | "requirement";
  /** Override the entity ID used for clarifications (defaults to props.id) */
  clarificationEntityId?: string | number;

  // Invoice conversion feature
  invoiceStatus?: {
    exists: boolean;
    invoiceId?: number;
    canConvertToInvoice?: boolean;
    hasAcceptedPO?: boolean;
    loading?: boolean;
  } | null;
  isConvertingInvoice?: boolean;
  onConvertToInvoiceClick?: () => void;

  // Invitations
  invitedCount?: number;
  invitedSellers?: any[];
  invitations?: any[];

  // Internal Approvals & Statutory Compliance (Buyer / Admin Side Only)
  approvalAuthority?: string;
  justification?: string;
  internalDetails?: Record<string, any>;

  // Reverse Auction extensions
  linkedAuction?: any;
  onAuctionBidSubmitted?: () => void;
  customClarificationPanel?: React.ReactNode;
  sellerAuctionActions?: React.ReactNode;
  buyerAuctionActions?: React.ReactNode;

  lifecycleStage?: string;
  rawBid?: any;
  quantity?: number | string;
  unit?: string;
}

export function ProcurementDetailUnifiedView(
  props: ProcurementDetailUnifiedViewProps,
) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { user } = useAuth();
  const currentUser: any = user;
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "scope_docs"
    | "terms_schedule"
    | "evaluation"
    | "clarifications"
  >("overview");
  const [isEmdModalOpen, setIsEmdModalOpen] = useState(false);
  const [selectedQuotationForReview, setSelectedQuotationForReview] = useState<
    any | null
  >(null);
  const [selectedForTechnicalEval, setSelectedForTechnicalEval] = useState<
    any | null
  >(null);
  const [isCompletingTechEval, setIsCompletingTechEval] = useState(false);
  const [isCompletingTechEvalSuccess, setIsCompletingTechEvalSuccess] =
    useState(false);
  const queryClient = useQueryClient();
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [isCompareChooserOpen, setIsCompareChooserOpen] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [localCreatedOrder, setLocalCreatedOrder] = useState<any | null>(null);
  const [localAcceptedPO, setLocalAcceptedPO] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isExtendScheduleOpen, setIsExtendScheduleOpen] = useState(false);

  const [nowMs, setNowMs] = useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const targetId = String(
    props.displayId && props.displayId !== "N/A" && props.displayId !== "—"
      ? props.displayId
      : props.id,
  );
  const userRoleStr = String(currentUser?.role || "").toLowerCase();
  const isBuyerOrAdmin =
    userRoleStr === "buyer" ||
    userRoleStr === "admin" ||
    userRoleStr === "master_admin" ||
    (!!currentUser?.id && String(currentUser?.id) === String(props.buyer?.id));
  const isBuyerSide =
    userRoleStr === "buyer" ||
    pathname.startsWith("/buyer") ||
    (isBuyerOrAdmin &&
      !pathname.startsWith("/seller") &&
      !pathname.startsWith("/shg"));

  const statusUpper = String(props.status || "").toUpperCase();
  const isPostFinancialOrAwarded = [
    "AWARDED",
    "AWARD_ACCEPTED",
    "AWARD_OFFERED",
    "AWARD_RECOMMENDED",
    "PO_GENERATED",
    "IN_PROGRESS",
    "DELIVERED",
    "GRN_COMPLETED",
    "INVOICE_SUBMITTED",
    "PAYMENT_COMPLETED",
    "COMPLETED",
    "CANCELLED",
    "FINANCIAL_EVALUATION",
    "L1_GENERATED",
  ].includes(statusUpper);

  const canExtendSchedule = isBuyerSide && !isPostFinancialOrAwarded;

  const [isStartAuctionModalOpen, setIsStartAuctionModalOpen] = useState(false);

  // ── Bid Lifecycle & Price-Match Counter-Offer State ──
  const [declineModal, setDeclineModal] = useState<{
    show: boolean;
    awardId: string;
    type: "price_match" | "award";
    reason: string;
    submitting: boolean;
  }>({
    show: false,
    awardId: "",
    type: "price_match",
    reason: "",
    submitting: false,
  });
  const [isAcceptingAction, setIsAcceptingAction] = useState(false);
  const [isIssuingPOFromBanner, setIsIssuingPOFromBanner] = useState(false);
  const [awardingParticipation, setAwardingParticipation] = useState<
    any | null
  >(null);
  const [awardJustification, setAwardJustification] = useState("");
  const [awardRemarks, setAwardRemarks] = useState("");
  const [isSubmittingAward, setIsSubmittingAward] = useState(false);
  const [isAcceptingPO, setIsAcceptingPO] = useState(false);

  const { data: fallbackBidData } = useQuery({
    queryKey: ["procurement-detail-fallback-bid", targetId],
    queryFn: async () => {
      try {
        if (!targetId || targetId === "N/A" || targetId === "—") return null;
        const res = await procurementBidApi.detail(targetId);
        return res || null;
      } catch {
        return null;
      }
    },
    enabled:
      Boolean(targetId) &&
      (!props.rawBid?.awards || props.rawBid.awards.length === 0) &&
      (!props.awards || props.awards.length === 0),
    staleTime: 10_000,
  });

  const rawParticipations: any[] = Array.isArray(props.rawBid?.participations) && props.rawBid.participations.length > 0
    ? props.rawBid.participations
    : Array.isArray(props.participations) && props.participations.length > 0
      ? props.participations
      : Array.isArray((props as any)?.participations) && (props as any).participations.length > 0
        ? (props as any).participations
        : Array.isArray(fallbackBidData?.participations)
          ? fallbackBidData.participations
          : [];

  const currentUserId = String(currentUser?.id || "");
  const currentOrgId = String(
    currentUser?.organizationId ||
      currentUser?.sellerProfile?.id ||
      currentUser?.sellerProfile?.organizationId ||
      "",
  );

  const myParticipation = React.useMemo(() => {
    if (isBuyerSide || !currentUser) return null;
    return rawParticipations.find(
      (p: any) =>
        String(
          p.sellerUserId || p.sellerId || p.seller?.id || p.sellerUser?.id,
        ) === currentUserId ||
        String(
          p.sellerOrganizationId ||
            p.sellerOrganization?.id ||
            p.seller?.organizationId,
        ) === currentOrgId ||
        (currentUser.sellerProfile?.id &&
          String(p.sellerProfileId || p.sellerId) === String(currentUser.sellerProfile.id)) ||
        (currentUser.sellerProfile?.organizationId &&
          String(p.sellerOrganizationId || p.sellerOrganization?.id || p.seller?.organizationId) === String(currentUser.sellerProfile.organizationId)),
    );
  }, [
    rawParticipations,
    isBuyerSide,
    currentUser,
    currentUserId,
    currentOrgId,
  ]);

  const effectiveMyParticipation =
    props.ownParticipation || props.ownResponse || myParticipation;
  const isSellerParticipated = Boolean(
    props.hasSubmittedProposal || effectiveMyParticipation,
  );

  const rawAwards: any[] = Array.isArray(props.rawBid?.awards) && props.rawBid.awards.length > 0
    ? props.rawBid.awards
    : Array.isArray(props.awards) && props.awards.length > 0
      ? props.awards
      : Array.isArray((props as any)?.awards) && (props as any).awards.length > 0
        ? (props as any).awards
        : Array.isArray(fallbackBidData?.awards) && fallbackBidData.awards.length > 0
          ? fallbackBidData.awards
          : [];

  const myAward = !isBuyerSide
    ? rawAwards.find((a: any) => {
        const aSellerId = String(
          a.awardedSellerId || a.sellerId || a.seller?.id || a.participation?.sellerId || "",
        );
        const aOrgId = String(
          a.seller?.organizationId || a.participation?.sellerOrganizationId || "",
        );
        const aPartId = a.participationId || a.participation?.id;
        const myPartId = myParticipation?.id || effectiveMyParticipation?.id || props.ownParticipation?.id;
        return (
          (aSellerId && (aSellerId === currentUserId || aSellerId === currentOrgId)) ||
          (aOrgId && aOrgId === currentOrgId) ||
          (myPartId && aPartId && Number(aPartId) === Number(myPartId))
        );
      })
    : null;

  const activeAward =
    myAward ||
    rawAwards.find(
      (a: any) =>
        a.awardStatus === "OFFERED" ||
        a.awardStatus === "ACCEPTED" ||
        a.awardStatus === "RECOMMENDED" ||
        a.counterOfferStatus === "PENDING",
    ) ||
    rawAwards[0] ||
    null;

  const isAwardedToMe = Boolean(
    activeAward &&
    !isBuyerSide &&
    ((activeAward.awardedSellerId &&
      (String(activeAward.awardedSellerId) === currentUserId ||
        String(activeAward.awardedSellerId) === currentOrgId)) ||
      (activeAward.sellerId &&
        (String(activeAward.sellerId) === currentUserId ||
          String(activeAward.sellerId) === currentOrgId)) ||
      (activeAward.seller?.id &&
        (String(activeAward.seller.id) === currentUserId ||
          String(activeAward.seller.id) === currentOrgId)) ||
      (activeAward.seller?.organizationId &&
        String(activeAward.seller.organizationId) === currentOrgId) ||
      (activeAward.participation?.sellerId &&
        (String(activeAward.participation.sellerId) === currentUserId ||
          String(activeAward.participation.sellerId) === currentOrgId)) ||
      (activeAward.participation?.sellerOrganizationId &&
        String(activeAward.participation.sellerOrganizationId) === currentOrgId) ||
      (myParticipation?.id &&
        activeAward.participationId &&
        Number(activeAward.participationId) === Number(myParticipation.id)) ||
      (effectiveMyParticipation?.id &&
        activeAward.participationId &&
        Number(activeAward.participationId) === Number(effectiveMyParticipation.id)) ||
      (props.ownParticipation?.id &&
        activeAward.participationId &&
        Number(activeAward.participationId) === Number(props.ownParticipation.id))),
  );

  const rawOrders: any[] = Array.isArray(props.rawBid?.purchaseOrders)
    ? props.rawBid.purchaseOrders
    : Array.isArray((props as any)?.purchaseOrders)
      ? (props as any).purchaseOrders
      : [];
  const directActiveOrder: any =
    localCreatedOrder ||
    props.rawBid?.activeOrder ||
    (props as any)?.activeOrder ||
    activeAward?.order ||
    rawOrders[0] ||
    null;

  const { data: fetchedOrder } = useQuery({
    queryKey: ["procurement-active-order", targetId, activeAward?.id],
    queryFn: async () => {
      try {
        const res: any = await getApi(`/api/orders/procurement?take=20${targetId ? `&bidId=${targetId}` : ""}`);
        const list = Array.isArray(res) ? res : res?.items || res?.data || [];
        return (
          list.find(
            (o: any) =>
              String(o.procurementBidId || o.bidId || o.requirementId) ===
                String(targetId) ||
              (activeAward?.id && String(o.awardId || o.sourceId) === String(activeAward.id)),
          ) || null
        );
      } catch {
        return null;
      }
    },
    enabled: Boolean(targetId),
    staleTime: 4000,
    refetchInterval: (query) => {
      const ord = query.state.data;
      const st = String(ord?.status || ord?.poStatus || "").toLowerCase();
      if (["closed", "cancelled", "completed", "paid"].includes(st)) return false;
      return 6000;
    },
  });
  const effectiveActiveOrder = useMemo(() => {
    const ord = fetchedOrder || localCreatedOrder || directActiveOrder || null;
    if (ord && localAcceptedPO) {
      return { ...ord, status: "accepted", poStatus: "ACCEPTED" };
    }
    return ord;
  }, [fetchedOrder, localCreatedOrder, directActiveOrder, localAcceptedPO]);

  const rawOrderStatus = String(
    effectiveActiveOrder?.status || effectiveActiveOrder?.poStatus || "",
  ).toLowerCase();

  const isPOAccepted = Boolean(
    effectiveActiveOrder &&
      (Boolean(effectiveActiveOrder.acceptedAt) ||
        activeAward?.awardStatus === "ACCEPTED" ||
        localAcceptedPO ||
        [
          "accepted",
          "in_fulfillment",
          "dispatched",
          "in_transit",
          "delivered",
          "grn_created",
          "grn_pending",
          "grn_completed",
          "grn_approved",
          "invoice_submitted",
          "invoiced",
          "payment_initiated",
          "paid",
          "completed",
          "closed",
        ].includes(rawOrderStatus) ||
        (rawOrderStatus &&
          ![
            "issued",
            "generated",
            "order_placed",
            "pending_acceptance",
            "cancelled",
            "rejected",
          ].includes(rawOrderStatus))),
  );

  const poStatusBadgeText = useMemo(() => {
    if (["delivered", "grn_completed", "grn_pending"].includes(rawOrderStatus)) {
      return "Supplier Accepted — Items Delivered (GRN Pending)";
    }
    if (
      [
        "grn_approved",
        "invoiced",
        "invoice_submitted",
        "payment_initiated",
        "paid",
        "completed",
        "closed",
      ].includes(rawOrderStatus)
    ) {
      return "Supplier Accepted — Fulfilled & Progressing";
    }
    if (["in_fulfillment", "dispatched", "in_transit"].includes(rawOrderStatus)) {
      return "Supplier Accepted — Delivery In Progress";
    }
    if (isPOAccepted) {
      return "Supplier Accepted — Fulfillment Committed";
    }
    return "Awaiting Supplier Acceptance & Commitment";
  }, [rawOrderStatus, isPOAccepted]);

  const handleAcceptPriceMatch = async (awardId: string) => {
    try {
      setIsAcceptingAction(true);
      await procurementBidApi.acceptPriceMatchCounterOffer(targetId, awardId);
      toast.success(
        "Price-match counter-offer accepted! You have won the contract allocation.",
      );
      queryClient.invalidateQueries();
      if (typeof window !== "undefined") window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept price-match counter-offer.");
    } finally {
      setIsAcceptingAction(false);
    }
  };

  const handleDeclinePriceMatchSubmit = async () => {
    if (!declineModal.awardId) return;
    if (!declineModal.reason.trim()) {
      toast.error("Please provide a reason for declining.");
      return;
    }
    try {
      setDeclineModal((prev) => ({ ...prev, submitting: true }));
      await procurementBidApi.declinePriceMatchCounterOffer(
        targetId,
        declineModal.awardId,
        declineModal.reason.trim(),
      );
      toast.success(
        "Price-match counter-offer declined. Tender returned to evaluation.",
      );
      setDeclineModal({
        show: false,
        awardId: "",
        type: "price_match",
        reason: "",
        submitting: false,
      });
      queryClient.invalidateQueries();
      if (typeof window !== "undefined") window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to decline counter-offer.");
      setDeclineModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleAcceptAward = async (awardId: string) => {
    try {
      setIsAcceptingAction(true);
      await procurementBidApi.acceptAward(targetId, awardId);
      toast.success(
        "Bid award accepted! Buyer will now issue the Purchase Order.",
      );
      await queryClient.invalidateQueries();
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 700);
    } catch (err: any) {
      toast.error(err.message || "Failed to accept award.");
    } finally {
      setIsAcceptingAction(false);
    }
  };

  const handleDeclineAwardSubmit = async () => {
    if (!declineModal.awardId) return;
    if (!declineModal.reason.trim()) {
      toast.error("Please provide a reason for declining.");
      return;
    }
    try {
      setDeclineModal((prev) => ({ ...prev, submitting: true }));
      await procurementBidApi.declineAward(
        targetId,
        declineModal.awardId,
        declineModal.reason.trim(),
      );
      toast.success("Award declined. Tender returned to evaluation.");
      setDeclineModal({
        show: false,
        awardId: "",
        type: "award",
        reason: "",
        submitting: false,
      });
      await queryClient.invalidateQueries();
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 700);
    } catch (err: any) {
      toast.error(err.message || "Failed to decline award.");
      setDeclineModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleGeneratePOFromBanner = async (awardId: string) => {
    try {
      setIsIssuingPOFromBanner(true);
      const res: any = await procurementBidApi.generatePO(targetId, { awardId });
      toast.success(
        "Purchase Order issued successfully! Non-selected bidders notified.",
      );
      const created = res?.purchaseOrder || res?.data?.purchaseOrder || res?.data || res;
      if (created && (created.id || created.poNumber)) {
        setLocalCreatedOrder(created);
      }
      await queryClient.invalidateQueries();
      queryClient.refetchQueries({ queryKey: ["procurement-active-order"] });
      queryClient.refetchQueries({ queryKey: ["rfq-detail-bid"] });
      queryClient.refetchQueries({ queryKey: ["bid-dispatcher-meta"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to issue Purchase Order.");
    } finally {
      setIsIssuingPOFromBanner(false);
    }
  };

  const handleAcceptPO = async (poId: string | number) => {
    try {
      setIsAcceptingPO(true);
      await procurementBidApi.acceptPO(poId);
      toast.success(
        "Purchase Order accepted! Delivery committed and non-selected bidders transitioned.",
      );
      setLocalAcceptedPO(true);
      await queryClient.invalidateQueries();
      queryClient.refetchQueries({ queryKey: ["procurement-active-order"] });
      queryClient.refetchQueries({ queryKey: ["rfq-detail-bid"] });
      queryClient.refetchQueries({ queryKey: ["bid-dispatcher-meta"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to accept Purchase Order.");
    } finally {
      setIsAcceptingPO(false);
    }
  };

  const linkedAuctionQuery = useQuery({
    queryKey: ["linked-reverse-auction", targetId],
    queryFn: () => reverseAuctionApi.getByProcurement(targetId),
    staleTime: 30000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const status = String(
        data?.statusEnum || data?.status || "",
      ).toUpperCase();
      return status === "LIVE" ? 3000 : false;
    },
    enabled: Boolean(targetId) && !props.linkedAuction,
  });
  const linkedAuction = props.linkedAuction ?? linkedAuctionQuery.data;

  const { data: fetchedParticipants } = useQuery({
    queryKey: ["buyer-unified-participations", props.procurementType, targetId],
    queryFn: async () => {
      if (!targetId) return [];

      const extractArray = (res: any): any[] => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.responses)) return res.responses;
        if (Array.isArray(res.participants)) return res.participants;
        if (Array.isArray(res.participations)) return res.participations;
        if (Array.isArray(res.results)) return res.results;
        if (Array.isArray(res.items)) return res.items;
        if (res.data) return extractArray(res.data);
        return [];
      };

      const normalizeItem = (r: any, idx: number) => {
        const respData =
          typeof r.responseData === "string"
            ? JSON.parse(r.responseData)
            : r.responseData || {};
        const sId =
          r.sellerUserId ||
          r.sellerId ||
          r.seller?.id ||
          r.sellerUser?.id ||
          r.id;
        const sellerOrgName =
          r.sellerOrgName ||
          r.sellerOrganization?.organizationName ||
          r.seller?.organization?.organizationName ||
          r.seller?.sellerProfile?.organizationName ||
          r.sellerProfile?.organizationName ||
          r.companyName ||
          r.sellerName ||
          r.sellerUser?.name ||
          r.seller?.name ||
          (sId && String(sId) !== "undefined"
            ? `Supplier #${sId}`
            : `Supplier ${idx + 1}`);
        const contactPerson =
          r.sellerUser?.name ||
          r.contactPerson ||
          r.sellerName ||
          r.seller?.name ||
          "Contact Person";

        return {
          id: r.id || `p-${idx}`,
          sellerId: sId,
          sellerUserId: sId,
          sellerOrganizationId:
            r.sellerOrganizationId ||
            r.sellerOrganization?.id ||
            r.seller?.organizationId ||
            r.seller?.organization?.id,
          sellerOrgName: sellerOrgName,
          sellerName: contactPerson,
          companyName: sellerOrgName,
          contactPerson: contactPerson,
          email:
            r.sellerUser?.email ||
            r.email ||
            r.sellerEmail ||
            r.seller?.email ||
            "",
          phone:
            r.sellerUser?.mobile ||
            r.phone ||
            r.sellerMobile ||
            r.seller?.mobile ||
            "",
          submittedAt: r.createdAt || r.submittedAt || r.updatedAt,
          submissionStatus:
            r.status === "SHORTLISTED" || r.status === "ACCEPTED"
              ? "SUBMITTED"
              : r.status || r.submissionStatus || "SUBMITTED",
          status: r.status || r.submissionStatus || "SUBMITTED",
          quotedAmount: Number(
            r.offeredPrice ||
              r.quotedAmount ||
              r.totalAmount ||
              r.totalPrice ||
              0,
          ),
          totalAmount: Number(
            r.offeredPrice ||
              r.quotedAmount ||
              r.totalAmount ||
              r.totalPrice ||
              0,
          ),
          offeredQuantity: r.offeredQuantity || r.quantity || undefined,
          deliveryTimeline:
            r.deliveryTimeline && r.deliveryTimeline !== "Standard"
              ? r.deliveryTimeline
              : respData.deliveryTimeline &&
                  respData.deliveryTimeline !== "Standard"
                ? respData.deliveryTimeline
                : undefined,
          paymentTerms:
            r.paymentTerms || respData.paymentTerms || "As per tender",
          makeBrand: r.makeBrand || respData.makeBrand || "Standard",
          documents: r.documents || respData.documents || [],
          lineItems:
            Array.isArray(r.lineItems) && r.lineItems.length
              ? r.lineItems
              : Array.isArray(respData.lineItems) && respData.lineItems.length
                ? respData.lineItems
                : Array.isArray(respData.lineQuotes) &&
                    respData.lineQuotes.length
                  ? respData.lineQuotes
                  : Array.isArray(r.lineQuotes)
                    ? r.lineQuotes
                    : [],
          message: r.message || r.remarks || r.rfqNotes || "",
          seller: r.seller || {
            name: contactPerson,
            email: r.sellerUser?.email || r.email,
            mobile: r.sellerUser?.mobile || r.phone,
            organization: r.sellerOrganization || {
              organizationName: sellerOrgName,
            },
          },
          sellerUser: r.sellerUser || r.seller || { name: contactPerson },
          sellerOrganization: r.sellerOrganization ||
            r.seller?.organization || { organizationName: sellerOrgName },
          technicalStatus:
            r.technicalStatus ||
            respData.technicalStatus ||
            (r.status === "SHORTLISTED" || r.status === "ACCEPTED"
              ? "QUALIFIED"
              : r.status === "REJECTED"
                ? "DISQUALIFIED"
                : "PENDING"),
          technicalRemarks:
            r.technicalRemarks ||
            r.rejectionReason ||
            respData.technicalRemarks ||
            "",
          score: r.score ?? respData.score ?? null,
          isDisqualified:
            r.technicalStatus === "DISQUALIFIED" ||
            r.status === "REJECTED" ||
            Boolean(r.isDisqualified),
        };
      };

      const trailingDigits = String(targetId).match(/\d+/g);
      const lastNumericPart = trailingDigits
        ? trailingDigits[trailingDigits.length - 1]
        : null;
      const rawPropId =
        props.id !== undefined && props.id !== null ? String(props.id) : null;
      const absPropId =
        rawPropId && !isNaN(Number(rawPropId)) && Number(rawPropId) !== 0
          ? String(Math.abs(Number(rawPropId)))
          : null;
      const idsToTry = Array.from(
        new Set(
          [
            targetId,
            rawPropId,
            absPropId,
            props.requirementNumber ? String(props.requirementNumber) : null,
            props.displayId &&
            props.displayId !== "N/A" &&
            props.displayId !== "—"
              ? String(props.displayId)
              : null,
            lastNumericPart,
          ].filter(Boolean) as string[],
        ),
      );

      for (const idToken of idsToTry) {
        const candidateResults = await Promise.allSettled([
          getApi(
            `/api/buyer/procurement-bids/${encodeURIComponent(idToken)}/participants`,
            true,
          ),
          procurementBidApi.detail(idToken),
          getApi(
            `/api/buyer/requirements/${encodeURIComponent(idToken)}/responses`,
            true,
          ),
        ]);

        const candidateLists: any[][] = [];
        for (const r of candidateResults) {
          if (r.status === "fulfilled" && r.value) {
            const items = extractArray(r.value);
            if (items.length > 0) {
              candidateLists.push(items.map(normalizeItem));
            }
          }
        }

        if (candidateLists.length > 0) {
          const mergedVendorMap = new Map<string, any>();
          for (const list of candidateLists) {
            for (const item of list) {
              const baseKeys = [
                item.id ? `id-${item.id}` : null,
                item.participationId ? `part-${item.participationId}` : null,
                item.participationNumber ? `partNum-${item.participationNumber}` : null,
                item.sellerUserId ? `user-${item.sellerUserId}` : null,
                item.sellerId ? `user-${item.sellerId}` : null,
                item.sellerOrganizationId ? `org-${item.sellerOrganizationId}` : null,
                item.sellerOrgName ? `name-${String(item.sellerOrgName).trim().toLowerCase()}` : null,
                item.sellerOrgName ? `norm-${String(item.sellerOrgName).trim().toLowerCase().replace(/[^a-z0-9]/g, '')}` : null,
              ].filter(Boolean) as string[];

              let existing = baseKeys.map(k => mergedVendorMap.get(k)).find(Boolean);

              const ts = String(item.technicalStatus || "").toUpperCase();
              const isItemEvaluated =
                ts === "QUALIFIED" ||
                ts === "DISQUALIFIED" ||
                ts === "NOT_QUALIFIED" ||
                Boolean(item.isDisqualified);

              if (existing) {
                if (isItemEvaluated) {
                  existing.technicalStatus = ts === "NOT_QUALIFIED" ? "DISQUALIFIED" : ts;
                  existing.isDisqualified = ts === "DISQUALIFIED" || ts === "NOT_QUALIFIED" || Boolean(item.isDisqualified);
                  if (item.technicalRemarks) existing.technicalRemarks = item.technicalRemarks;
                  if (item.score != null) existing.score = item.score;
                }
                if (item.quotedAmount && !existing.quotedAmount) existing.quotedAmount = item.quotedAmount;
                if (item.totalAmount && !existing.totalAmount) existing.totalAmount = item.totalAmount;
                for (const k of baseKeys) mergedVendorMap.set(k, existing);
              } else {
                const newObj = { ...item };
                if (isItemEvaluated) {
                  newObj.technicalStatus = ts === "NOT_QUALIFIED" ? "DISQUALIFIED" : ts;
                  newObj.isDisqualified = ts === "DISQUALIFIED" || ts === "NOT_QUALIFIED" || Boolean(item.isDisqualified);
                }
                for (const k of baseKeys) mergedVendorMap.set(k, newObj);
              }
            }
          }
          const uniqueItems = Array.from(new Set(mergedVendorMap.values()));
          if (uniqueItems.length > 0) return uniqueItems;
        }
      }

      return [];
    },
    enabled: Boolean(
      isBuyerOrAdmin && targetId && targetId !== "RFQ" && targetId !== "RFP",
    ),
    staleTime: 5_000,
  });
  const {
    data: emdRes,
    refetch: refetchEmd,
    isLoading: emdLoading,
  } = useQuery({
    queryKey: ["emd-status-unified", targetId, currentUser?.id],
    queryFn: async () => {
      if (!targetId) return null;
      try {
        const r = await getApi<any>(
          `/api/emd/status?requestId=${encodeURIComponent(targetId)}`,
        );
        return r?.data ?? r;
      } catch {
        return null;
      }
    },
    enabled: currentUser?.role === "seller" && !!targetId,
  });

  const isEmdPaid = emdRes?.status === "PAID" || emdRes?.status === "VERIFIED";
  const emdInfo: EmdInfo | null = useMemo(() => {
    const isEmdReq = emdRes?.isEmdRequired ?? props.isEmdRequired ?? false;
    const amt = emdRes?.emdAmount ?? props.emdAmount ?? 0;
    if (!isEmdReq || Number(amt) <= 0) return null;

    return {
      isEmdRequired: isEmdReq,
      emdAmount: Number(amt),
      paymentMethod: emdRes?.paymentMethod || "Online Escrow",
      paymentDeadline: emdRes?.paymentDeadline,
      refundPolicy:
        emdRes?.refundPolicy || "Refundable upon completion of evaluation",
      instructions: emdRes?.instructions,
      status: isEmdPaid ? "PAID" : emdRes?.status || "PENDING",
      payment: emdRes?.payment || null,
    };
  }, [emdRes, props.isEmdRequired, props.emdAmount, isEmdPaid]);

  // ── EMD Flow (Commented out as requested) ──
  const showEmdCard = false; // isEmdApplicable(props.procurementType, emdInfo?.isEmdRequired, emdInfo?.emdAmount);
  const isEmdGated = false; // showEmdCard && !isEmdPaid && !props.hasSubmittedProposal;

  const handleActionSubmit = () => {
    if (!currentUser) {
      toast.error("Please login to participate.");
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isEmdGated) {
      toast.error(
        "Please complete EMD Payment before submitting your quotation/proposal.",
      );
      setIsEmdModalOpen(true);
      return;
    }

    if (props.onSubmitClick) {
      props.onSubmitClick();
    }
  };

  const payload = props.payload || {};
  const basics = payload.basics || {};
  const internal =
    props.internalDetails ||
    payload.internal ||
    payload.basics?.internal ||
    (props as any).technicalPacket?.internal ||
    (props as any).internal ||
    {};
  const approvalAuthority = firstPresent(
    props.approvalAuthority,
    internal.approvalAuthority,
    internal.authorityName,
    internal.authority,
    payload.approvalAuthority,
    (props as any).approvalAuthority,
  );
  const justification = firstPresent(
    props.justification,
    internal.justification,
    internal.purchaseJustification,
    internal.complianceReason,
    payload.justification,
    basics.justification,
    (props as any).justification,
  );
  const budgetConfirmed =
    internal.budgetSanctionConfirmed === true ||
    internal.budgetSanctionConfirmed === "true" ||
    internal.budgetConfirmed === true ||
    internal.budgetConfirmed === "true" ||
    internal.isBudgetSanctioned === true ||
    internal.budgetSanction === true;
  const competentAuthority = firstPresent(
    internal.competentAuthority,
    approvalAuthority,
  );
  const internalFileNumber = firstPresent(
    internal.internalFileNumber,
    internal.fileNumber,
    internal.sanctionOrderNo,
  );
  const internalDepartment = firstPresent(
    internal.department,
    internal.departmentName,
    internal.costCenter,
  );
  const sanctionDateFormatted =
    internal.sanctionDate || internal.approvalDate
      ? formatDateString(internal.sanctionDate || internal.approvalDate, false)
      : undefined;

  const hasInternalCompliance = Boolean(
    isBuyerSide &&
    (approvalAuthority ||
      justification ||
      internal.budgetConfirmed !== undefined ||
      internal.budgetSanctionConfirmed !== undefined ||
      competentAuthority ||
      internalFileNumber),
  );
  const schedule = payload.schedule || {};
  const tender = payload.tender || {};
  const terms = payload.terms || {};
  const rules = payload.rules || {};
  const evaluation = payload.evaluation || {};
  const serviceDetails = props.serviceDetails || payload.serviceDetails || {};
  const buyerProfile = props.buyer?.buyerProfile || {};
  const buyerOrg =
    props.buyer?.buyerOrganization || props.buyer?.organization || {};

  const discloseEstimatedCost = Boolean(
    props.discloseEstimatedCost ??
    payload?.discloseEstimatedCost ??
    basics?.discloseEstimatedCost ??
    payload?.basics?.discloseEstimatedCost ??
    (props as any)?.bid?.discloseEstimatedCost ??
    (props as any)?.technicalPacket?.discloseEstimatedCost ??
    (props as any)?.rawBid?.discloseEstimatedCost ??
    false,
  );

  const lifecycleStageUpper = String(
    (props as any).lifecycleStage ||
      (props as any).rawBid?.lifecycleStage ||
      payload.lifecycleStage ||
      "",
  ).toUpperCase();
  const isPostBiddingStage = [
    "FINANCIAL_EVALUATION",
    "L1_GENERATED",
    "AWARD_RECOMMENDED",
    "AWARDED",
    "CLOSED",
    "COMPLETED",
  ].includes(statusUpper);

  const isTechEvalCompleted = useMemo(() => {
    if (isCompletingTechEvalSuccess) return true;
    return (
      statusUpper === "TECHNICAL_EVALUATION_COMPLETED" ||
      lifecycleStageUpper === "TECHNICAL_EVALUATION_COMPLETED" ||
      [
        "FINANCIAL_EVALUATION",
        "L1_GENERATED",
        "AWARD_RECOMMENDED",
        "AWARDED",
        "PO_GENERATED",
        "COMPLETED",
      ].includes(statusUpper) ||
      [
        "FINANCIAL_EVALUATION",
        "L1_GENERATED",
        "AWARD_RECOMMENDED",
        "AWARDED",
        "PO_GENERATED",
      ].includes(lifecycleStageUpper)
    );
  }, [isCompletingTechEvalSuccess, statusUpper, lifecycleStageUpper]);

  const shouldShowEstimatedCost = Boolean(
    isBuyerSide ||
    isBuyerOrAdmin ||
    discloseEstimatedCost ||
    isPostBiddingStage,
  );

  const isRateContractType =
    props.procurementType === "RATE_CONTRACT" ||
    props.procurementType === "rate-contract" ||
    String(props.procurementType || "")
      .toUpperCase()
      .includes("RATE_CONTRACT") ||
    String(props.procurementType || "")
      .toUpperCase()
      .includes("RATE CONTRACT") ||
    String(props.procurementLabel || "")
      .toUpperCase()
      .includes("RATE CONTRACT") ||
    String(props.procurementMethod || "")
      .toUpperCase()
      .includes("RATE CONTRACT") ||
    pathname.includes("/rate-contract");

  const isReverseAuctionType =
    !isRateContractType &&
    (props.procurementType === "REVERSE_AUCTION" ||
      props.procurementType === "reverse-auction" ||
      String(props.procurementType || "")
        .toUpperCase()
        .includes("REVERSE_AUCTION") ||
      String(props.procurementLabel || "")
        .toUpperCase()
        .includes("REVERSE AUCTION") ||
      String(props.procurementMethod || "")
        .toUpperCase()
        .includes("REVERSE AUCTION") ||
      pathname.includes("/reverse-auction"));

  const allowsReverseAuction = Boolean(
    !isRateContractType &&
    (isReverseAuctionType ||
      Boolean((props as any)?.allowReverseAuction) ||
      Boolean(payload?.allowReverseAuction) ||
      Boolean(rules?.allowReverseAuction) ||
      Boolean(basics?.isReverseAuctionNeeded) ||
      Boolean(payload?.basics?.isReverseAuctionNeeded) ||
      ["REVERSE_AUCTION", "BID_WITH_REVERSE_AUCTION"].includes(
        String(
          props.procurementMethod || props.procurementType || "",
        ).toUpperCase(),
      )),
  );

  const isTwoStageReverseAuction = Boolean(
    !isRateContractType &&
    (props.linkedAuction?.preBidStage ||
      props.linkedAuction?.linkedBidId ||
      (props.linkedAuction?.linkedRequirementId &&
        props.procurementMethod === "BID_WITH_REVERSE_AUCTION") ||
      (allowsReverseAuction && !isReverseAuctionType)),
  );

  const isDirectReverseAuction = Boolean(
    !isRateContractType &&
    (isReverseAuctionType || props.linkedAuction) &&
    !isTwoStageReverseAuction,
  );

  const documents = props.documents || [];
  const requiredDocuments = firstPresent(
    props.requiredDocuments,
    payload.requiredDocuments,
    payload.requiredDocs,
    payload.documentsRequired,
    rules.requiredDocuments,
    rules.documentsRequired,
    payload.tender?.requiredDocuments,
    payload.rateContractConfig?.requiredDocuments,
  );
  const rawLineItems = asArray(
    props.items || payload.items || payload.lineItems,
  );
  const fallbackLineItems = asArray(
    payload.items || payload.lineItems || payload.wizardData?.items,
  );
  const lineItems = useMemo(() => {
    const seen = new Set<string>();
    const res: any[] = [];
    for (let i = 0; i < rawLineItems.length; i++) {
      const item = rawLineItems[i];
      if (!item) continue;
      const fallback = fallbackLineItems[i] || {};
      const mergedItem = {
        ...fallback,
        ...item,
        specifications: {
          ...(typeof fallback.specifications === "object"
            ? fallback.specifications
            : {}),
          ...(typeof item.specifications === "object"
            ? item.specifications
            : {}),
        },
      };
      const name =
        mergedItem.name ||
        mergedItem.itemName ||
        mergedItem.description ||
        mergedItem.title ||
        "";
      const qty = mergedItem.quantity || mergedItem.qty || 0;
      const uom =
        mergedItem.unitOfMeasure || mergedItem.unit || mergedItem.uom || "";
      const key = `${String(name).trim().toLowerCase()}_${qty}_${String(uom).trim().toLowerCase()}_${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        res.push(mergedItem);
      }
    }
    return res;
  }, [rawLineItems, fallbackLineItems]);

  const rawBoqTable = asArray(
    props.boqTable || payload.boqTable || payload.boq,
  );
  const boqTable = useMemo(() => {
    const seen = new Set<string>();
    const res: any[] = [];
    for (const item of rawBoqTable) {
      if (!item) continue;
      const name = item.itemName || item.name || item.description || "";
      const qty = item.quantity || item.qty || 0;
      const key = `${String(name).trim().toLowerCase()}_${qty}`;
      if (!seen.has(key)) {
        seen.add(key);
        res.push(item);
      }
    }
    return res;
  }, [rawBoqTable]);

  const statusLabel = (props.status || "ACTIVE").toUpperCase();
  const displayIdStr = String(props.displayId || props.id);
  const procurementTypeLabel =
    props.procurementLabel || props.procurementType || "PROCUREMENT";

  // Title / Procurement Name Resolution
  const isGenericTitle = (val?: string | null) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return (
      s === "procurement bid" ||
      s.startsWith("procurement bid #") ||
      s.startsWith("procurement #") ||
      s === "untitled procurement bid" ||
      s === "procurement requirement" ||
      s === "procurement tender" ||
      s === "open tender" ||
      s === "limited tender" ||
      s === "request for quotation" ||
      s === "request for proposal" ||
      s === "rate contract" ||
      s === "rate contract opportunity" ||
      s === "rfq opportunity" ||
      s === "rfp opportunity" ||
      s === "tender opportunity" ||
      s.includes("no description") ||
      s.includes("no scope") ||
      s === "n/a" ||
      s === "—"
    );
  };

  const candidateTitles = [
    props.subject,
    (props as any).title,
    props.buyer?.requirement?.title,
    props.buyer?.title,
    (props as any).requirement?.title,
    (props as any).data?.requirement?.title,
    (props as any).data?.title,
    payload.title,
    basics.title,
    basics.contractTitle,
    basics.procurementTitle,
    basics.serviceTitle,
    payload.rateContractConfig?.contractTitle,
    payload.tender?.tenderTitle,
    payload.tender?.title,
    serviceDetails.title,
    serviceDetails.serviceTitle,
    payload.wizardData?.basics?.title,
    payload.wizardData?.serviceDetails?.title,
    payload.wizardData?.serviceDetails?.serviceTitle,
    lineItems[0]?.name,
    lineItems[0]?.itemName,
    lineItems[0]?.title,
    lineItems[0]?.specification,
    boqTable[0]?.name,
    boqTable[0]?.category,
  ];

  const firstValidTitle = candidateTitles.find((t) => t && !isGenericTitle(t));

  const resolvedSubject = firstValidTitle
    ? String(firstValidTitle).trim()
    : displayIdStr && displayIdStr !== "N/A" && displayIdStr !== "—"
      ? `${procurementTypeLabel} #${displayIdStr}`
      : `${procurementTypeLabel} Opportunity`;

  // Data Extractions for Overview & Dates Tab
  const procurementNumber =
    firstPresent(
      props.requirementNumber,
      props.displayId && props.displayId !== "-1" && props.displayId !== "—"
        ? props.displayId
        : undefined,
      payload.requirementNumber,
      payload.bidNumber,
      payload.linkedProcurementBidNumber,
      basics.bidNumber,
      basics.requirementNumber,
      props.id && Number(props.id) > 0
        ? `${procurementTypeLabel.toUpperCase().replace(/\s+/g, "_")}-${props.id}`
        : undefined,
    ) || `RFQ-${Math.abs(Number(props.id || 1))}`;

  const isRfqType =
    props.procurementType === "RFQ" ||
    String(props.procurementType || "")
      .toUpperCase()
      .includes("RFQ") ||
    String(props.procurementLabel || "")
      .toUpperCase()
      .includes("QUOTATION") ||
    String(props.procurementLabel || "")
      .toUpperCase()
      .includes("RFQ") ||
    String(props.procurementMethod || "")
      .toUpperCase()
      .includes("QUOTATION") ||
    String(props.procurementMethod || "")
      .toUpperCase()
      .includes("RFQ") ||
    pathname.includes("/rfq");
  const isBuyerRfq = isBuyerSide && (isRfqType || pathname.includes("/rfq"));

  const isRfpType =
    props.procurementType === "RFP" ||
    String(props.procurementType || "")
      .toUpperCase()
      .includes("RFP") ||
    String(props.procurementLabel || "")
      .toUpperCase()
      .includes("PROPOSAL") ||
    String(props.procurementLabel || "")
      .toUpperCase()
      .includes("RFP") ||
    String(props.procurementMethod || "")
      .toUpperCase()
      .includes("PROPOSAL") ||
    String(props.procurementMethod || "")
      .toUpperCase()
      .includes("RFP") ||
    pathname.includes("/rfp");
  const isBuyerRfp = isBuyerSide && (isRfpType || pathname.includes("/rfp"));

  const isOpenTenderType =
    props.procurementType === "OPEN_TENDER" ||
    String(props.procurementType || "")
      .toUpperCase()
      .includes("OPEN_TENDER") ||
    String(props.procurementType || "")
      .toUpperCase()
      .includes("OPEN TENDER") ||
    String(props.procurementLabel || "")
      .toUpperCase()
      .includes("OPEN TENDER") ||
    String(props.procurementMethod || "")
      .toUpperCase()
      .includes("OPEN TENDER") ||
    pathname.includes("/open-tender") ||
    (pathname.includes("/tender") && !pathname.includes("/limited"));
  const isBuyerOpenTender = isBuyerSide && isOpenTenderType;

  const isLimitedTenderType =
    props.procurementType === "LIMITED_TENDER" ||
    String(props.procurementType || "")
      .toUpperCase()
      .includes("LIMITED_TENDER") ||
    String(props.procurementType || "")
      .toUpperCase()
      .includes("LIMITED TENDER") ||
    String(props.procurementLabel || "")
      .toUpperCase()
      .includes("LIMITED TENDER") ||
    String(props.procurementMethod || "")
      .toUpperCase()
      .includes("LIMITED TENDER") ||
    pathname.includes("/limited-tender") ||
    pathname.includes("/limited");
  const isBuyerLimitedTender = isBuyerSide && isLimitedTenderType;

  const cleanBuyerTerms = (val: any): any => {
    if (!val) return val;
    if (typeof val === "string") {
      if (val.toLowerCase().includes("warranty")) {
        return null;
      }
      return val;
    }
    if (typeof val !== "object") return val;
    if (Array.isArray(val)) {
      return val.map(cleanBuyerTerms).filter((item) => {
        if (item === null || item === undefined || item === "") return false;
        if (typeof item === "string" && item.toLowerCase().includes("warranty"))
          return false;
        return true;
      });
    }
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const lower = k.toLowerCase().replace(/[^a-z]/g, "");
      if (
        // Warranty terms strictly hidden from both seller and buyer side
        lower === "warrantyterms" ||
        lower === "warranty" ||
        lower === "warrantyperiod" ||
        lower.includes("warranty") ||
        // Commercial & payment terms already rendered in top card
        lower === "paymentterms" ||
        lower === "paymentterm" ||
        lower === "paymentmode" ||
        lower.includes("paymentterm") ||
        lower === "deliveryterms" ||
        lower === "deliveryterm" ||
        lower === "deliverytype" ||
        lower === "deliverymode" ||
        lower.includes("deliveryterm") ||
        lower === "freightterms" ||
        lower === "freightincluded" ||
        // RFQ / RFP / Rate Contract specific exclusions: Project Duration, Service Details, Service Title
        ((isRfqType || isRfpType || isRateContractType) &&
          (lower === "projectduration" ||
            lower === "duration" ||
            lower === "contractperiod" ||
            lower === "servicedetails" ||
            lower === "servicetitle")) ||
        lower === "retentionamount" ||
        lower === "securitydeposit" ||
        lower === "retention" ||
        lower === "securitydepositamount" ||
        lower === "retentionpercentage" ||
        lower === "securitydepositpercentage" ||
        lower === "securitydepositrequired" ||
        lower === "isretentionapplicable" ||
        lower === "retentionapplicable" ||
        lower === "advanceallowed" ||
        lower === "advance" ||
        lower === "advancepayment" ||
        lower === "advancepaymentallowed" ||
        lower === "advanceallowedflag" ||
        lower === "advancepercentage" ||
        lower === "advanceamount" ||
        lower === "mobilizationadvance" ||
        lower.includes("advance") ||
        lower.includes("retention") ||
        lower.includes("securitydeposit")
      ) {
        continue;
      }
      clean[k] = cleanBuyerTerms(v);
    }
    return clean;
  };

  const rawMethod =
    firstPresent(
      props.procurementMethod,
      payload.fullProcurementMethod,
      payload.type,
      props.procurementLabel,
      props.procurementType,
    ) || procurementTypeLabel;

  const procurementMethod = isRfqType
    ? "Request for Quotation"
    : rawMethod === "RFQ"
      ? "Request for Quotation"
      : rawMethod;

  const buyingType =
    firstPresent(
      props.buyingType,
      payload.buyingType,
      basics.whatAreYouBuying,
      basics.buyingType,
      payload.bidType,
    ) || "Product";

  const isBoqProcurement =
    String(buyingType || "")
      .trim()
      .toUpperCase() === "BOQ";

  const filteredBoqTable = useMemo(() => {
    return boqTable.filter((row: any) => {
      if (!row) return false;
      const desc = String(
        row.description || row.itemName || row.name || "",
      ).trim();
      const rate = Number(row.estimatedRate || row.rate || row.unitPrice || 0);
      const total = Number(row.total || row.amount || 0);
      const rowCat = String(row.category || "")
        .trim()
        .toLowerCase();
      const isGenericCat =
        !rowCat || rowCat === "general" || /^category\s*#?\d+$/i.test(rowCat);
      const hasRemarks = Boolean(
        row.remarks && String(row.remarks).trim().length > 0,
      );
      return (
        desc.length > 0 || rate > 0 || total > 0 || !isGenericCat || hasRemarks
      );
    });
  }, [boqTable]);

  const isLegitimateBoq =
    (isBoqProcurement && filteredBoqTable.length > 0) ||
    (lineItems.length === 0 && filteredBoqTable.length > 0);

  const category =
    firstPresent(
      props.category && props.category !== "—" && props.category !== "N/A"
        ? props.category
        : undefined,
      basics.category,
      payload.categoryName,
    ) || "General Procurement";

  const publishedDateValue = (() => {
    // Determine authentic live creation/approval time
    const createdTimestamp = props.createdAt;
    const tCreated = createdTimestamp
      ? new Date(createdTimestamp).getTime()
      : NaN;

    // Check candidate published dates
    const rawPublish =
      props.publishedDate || schedule.publishDate || tender.publishDate;
    if (rawPublish && Number.isFinite(tCreated)) {
      const tPub = new Date(rawPublish).getTime();
      if (Number.isFinite(tPub)) {
        // If the candidate publish date is in the future relative to creation (+ 1 min), honor it as scheduled publish.
        // If it is in the past or earlier than creation (e.g. 5:44 AM form draft vs 5:06 PM live creation),
        // the authentic live publication time is createdTimestamp!
        if (tPub > tCreated + 60000) {
          return rawPublish;
        }
        return createdTimestamp;
      }
    }

    // 1. If explicit time is present on the primary published date candidates
    if (hasExplicitDateTime(props.publishedDate)) return props.publishedDate;
    if (hasExplicitDateTime(schedule.publishDate)) return schedule.publishDate;
    if (hasExplicitDateTime(tender.publishDate)) return tender.publishDate;

    // 2. If createdAt has explicit time
    if (hasExplicitDateTime(props.createdAt)) return props.createdAt;

    // 3. Fallback to first present publication or creation date
    return firstPresent(
      props.publishedDate,
      schedule.publishDate,
      tender.publishDate,
      props.createdAt,
    );
  })();

  const closingDateValue = firstPresent(
    schedule.submissionDate,
    schedule.submissionDeadline,
    schedule.submissionEndDate,
    schedule.bidClosingDate,
    tender.bidClosingDate,
    props.closingDate,
    props.deadlineDate,
  );

  // Clarification window resolution: Check whether bidder clarifications are allowed
  const isClarificationAllowed = (() => {
    // 1. Explicit false/no in schedule
    if (
      schedule.clarificationAllowed === false ||
      schedule.clarificationAllowed === "false" ||
      schedule.clarificationAllowed === 0 ||
      schedule.clarificationAllowed === "No" ||
      schedule.clarificationAllowed === "no"
    ) {
      return false;
    }
    // 2. Explicit false/no in rules
    if (
      rules.clarificationAllowed === false ||
      rules.clarificationAllowed === "false" ||
      rules.clarificationAllowed === 0 ||
      rules.clarificationAllowed === "No" ||
      rules.clarificationAllowed === "no"
    ) {
      return false;
    }
    // 3. Explicit false in payload root
    if (
      payload.clarificationAllowed === false ||
      payload.clarificationAllowed === "false" ||
      payload.allowClarification === false ||
      payload.allowClarification === "false"
    ) {
      return false;
    }
    // 4. Props override if false
    if (
      (props as any).allowClarification === false ||
      (props as any).allowClarification === "false" ||
      (props as any).rawBid?.allowClarification === false
    ) {
      return false;
    }
    // 5. Positive indicators
    if (
      schedule.clarificationAllowed === true ||
      schedule.clarificationAllowed === "true" ||
      schedule.clarificationAllowed === "Yes" ||
      schedule.clarificationAllowed === "yes" ||
      rules.clarificationAllowed === true ||
      rules.clarificationAllowed === "true" ||
      payload.clarificationAllowed === true ||
      payload.allowClarification === true ||
      (props as any).allowClarification === true ||
      (props as any).rawBid?.allowClarification === true
    ) {
      return true;
    }
    return true;
  })();

  // Packet & Opening Evaluation checks: Resolve candidates from all paths
  const candidateTechDate = firstPresent(
    props.technicalDate,
    props.technicalOpeningDate,
    schedule.technicalOpeningDate,
    tender.technicalEvaluationDate,
    payload.technicalOpeningDate,
    payload.technicalEvaluationDate,
  );

  const candidateFinDate = firstPresent(
    props.financialDate,
    props.financialOpeningDate,
    schedule.financialOpeningDate,
    tender.financialEvaluationDate,
    schedule.finalEvaluationDate,
    payload.financialOpeningDate,
    payload.financialEvaluationDate,
  );

  const rawPacketType = String(
    firstPresent(
      props.packetType,
      schedule.packetType,
      payload.packetType,
      tender.packetType,
      rules.packetType,
    ) || (candidateFinDate ? "Two" : "Single"),
  ).toUpperCase();

  const isExplicitSingle =
    rawPacketType.includes("SINGLE") ||
    rawPacketType === "1";

  const isTwoPacket =
    !isExplicitSingle &&
    (rawPacketType.includes("TWO") ||
      rawPacketType === "2" ||
      Boolean(candidateFinDate));

  const isTechnicalEvaluationNeeded = Boolean(
    basics.isTechnicalEvaluationNeeded ||
    payload.isTechnicalEvaluationNeeded ||
    tender.isTechnicalEvaluationNeeded ||
    isTwoPacket ||
    candidateTechDate,
  );
  const hasTechnicalOpening =
    isTechnicalEvaluationNeeded || Boolean(candidateTechDate);
  const hasFinancialOpening = isTwoPacket || Boolean(candidateFinDate);

  const clarificationDateValue = isClarificationAllowed
    ? firstPresent(
        schedule.clarificationEndDate,
        schedule.clarificationDeadline,
        tender.clarificationEndDate,
        props.clarificationDate,
        schedule.preBidDate,
        schedule.preBidMeetingDate,
        tender.preBidDate,
        tender.preBidMeetingDate,
      )
    : undefined;

  const technicalDateValue = candidateTechDate;

  const presentationDateValue = firstPresent(
    schedule.presentationDate,
    tender.presentationDate,
    props.presentationDate,
  );

  const financialDateValue = candidateFinDate;

  const awardDateValue = firstPresent(
    tender.awardDate,
    schedule.awardDate,
    schedule.awardingDate,
    schedule.expectedAwardDate,
    props.awardDate,
  );

  const rawSubmissionStartDate = firstPresent(
    props.submissionStartDate,
    props.rawBid?.submissionStartDate,
    props.rawBid?.rawSubmissionStartDate,
    props.rawBid?.technicalPacket?.schedule?.submissionStartDate,
    props.rawBid?.startDate,
    props.startDate,
    schedule.submissionStartDate,
    schedule.startDate,
    tender.bidStartDate,
    payload.submissionStartDate,
  );

  const submissionStartDateValue = firstPresent(
    rawSubmissionStartDate,
    props.createdAt,
    publishedDateValue,
  );

  const subStartDateObj = rawSubmissionStartDate
    ? parseDateValue(rawSubmissionStartDate, true)
    : null;
  const isBeforeSubmissionStart = Boolean(
    subStartDateObj &&
    !isNaN(subStartDateObj.getTime()) &&
    subStartDateObj.getTime() > nowMs,
  );

  const clarificationDeadlineValue = isClarificationAllowed
    ? firstPresent(
        closingDateValue,
        props.deadlineDate,
        schedule.submissionDate,
        schedule.submissionDeadline,
        tender.bidClosingDate,
      )
    : undefined;

  const preBidDateValue = firstPresent(
    schedule.preBidMeetingDate,
    schedule.preBidDate,
    tender.preBidMeetingDate,
    tender.preBidDate,
    props.preBidDate,
  );

  const requiredByDateValue = firstPresent(
    basics.requiredByDate,
    basics.requiredBy,
    basics.expectedDeliveryDate,
    basics.deliveryDate,
    schedule.requiredByDate,
    schedule.deliveryDate,
    schedule.expectedDeliveryDate,
    payload.requiredByDate,
    payload.requiredBy,
    tender.requiredByDate,
    tender.requiredBy,
    tender.deliveryDate,
    props.requiredByDate,
    props.requiredBy,
    props.expectedDeliveryDate,
  );

  const rawValidityDays = firstPresent(
    schedule.validityDays,
    tender.validityDays,
    rules.validityDays,
    payload.validityDays,
    props.validityDays,
  );
  const validityDaysDisplay = rawValidityDays
    ? String(rawValidityDays).toLowerCase().includes("day")
      ? String(rawValidityDays)
      : `${rawValidityDays} Days`
    : undefined;

  const bidValidityDateValue = firstPresent(
    schedule.bidValidityDate,
    tender.bidValidityDate,
    schedule.bidValidityDeadline,
    props.bidValidityDate,
  );

  const bidValidityDateComputed = (() => {
    if (closingDateValue && rawValidityDays) {
      try {
        const cDate = new Date(closingDateValue);
        if (!isNaN(cDate.getTime())) {
          const daysToAdd = Number(rawValidityDays);
          if (daysToAdd > 0) {
            return new Date(
              cDate.getTime() + daysToAdd * 86_400_000,
            ).toISOString();
          }
        }
      } catch {}
    }
    return bidValidityDateValue;
  })();

  const publishedDateFormatted = publishedDateValue
    ? formatDateString(publishedDateValue, true)
    : props.publishedDate
      ? formatDateString(props.publishedDate, true)
      : undefined;
  const closingDateFormatted = closingDateValue
    ? formatDateString(closingDateValue, true, "endOfDay")
    : props.closingDate
      ? formatDateString(props.closingDate, true, "endOfDay")
      : undefined;
  const displaySealedClosingDate: string = String(
    closingDateFormatted ||
      (props.closingDate ? String(props.closingDate) : "") ||
      (props.deadlineDate ? String(props.deadlineDate) : "") ||
      "the submission deadline",
  );
  const clarificationDateFormatted = clarificationDateValue
    ? formatDateString(clarificationDateValue, true)
    : props.clarificationDate
      ? formatDateString(props.clarificationDate, true)
      : undefined;
  const clarificationDeadlineFormatted = clarificationDeadlineValue
    ? formatDateString(clarificationDeadlineValue, true)
    : clarificationDateFormatted && clarificationDateFormatted !== "N/A"
      ? clarificationDateFormatted
      : undefined;
  const technicalDateFormatted = technicalDateValue
    ? formatDateString(technicalDateValue, true)
    : props.technicalDate || props.technicalOpeningDate
      ? formatDateString(
          props.technicalDate || props.technicalOpeningDate,
          true,
        )
      : undefined;
  const presentationDateFormatted = presentationDateValue
    ? formatDateString(presentationDateValue, true)
    : props.presentationDate
      ? formatDateString(props.presentationDate, true)
      : undefined;
  const financialDateFormatted = financialDateValue
    ? formatDateString(financialDateValue, true)
    : props.financialDate || props.financialOpeningDate
      ? formatDateString(
          props.financialDate || props.financialOpeningDate,
          true,
        )
      : undefined;
  const awardDateFormatted = awardDateValue
    ? formatDateString(awardDateValue, true)
    : props.awardDate
      ? formatDateString(props.awardDate, true)
      : undefined;
  const submissionStartDateFormatted = submissionStartDateValue
    ? formatDateString(submissionStartDateValue, true)
    : publishedDateFormatted;
  const requiredByDateFormatted = requiredByDateValue
    ? formatDateString(requiredByDateValue, true)
    : undefined;
  const preBidDateFormatted = preBidDateValue
    ? formatDateString(preBidDateValue, true)
    : undefined;
  const bidValidityDateFormatted = bidValidityDateComputed
    ? formatDateString(bidValidityDateComputed, false)
    : undefined;

  const rawDeliveryLocation = firstPresent(
    props.deliveryLocation &&
      props.deliveryLocation !== "—" &&
      props.deliveryLocation !== "N/A" &&
      props.deliveryLocation !== "Delivery location not specified"
      ? props.deliveryLocation
      : undefined,
    payload.deliveryLocation,
    basics.deliveryLocation,
    basics.location,
    internal.deliveryAddress,
    internal.location,
    tender.deliveryAddress,
    tender.deliveryLocation,
    buyerOrg.city ? `${buyerOrg.city}, ${buyerOrg.state || ""}` : undefined,
    buyerProfile.city
      ? `${buyerProfile.city}, ${buyerProfile.state || ""}`
      : undefined,
  );
  const deliveryLocation = rawDeliveryLocation
    ? cleanDeliveryAddress(rawDeliveryLocation) || rawDeliveryLocation
    : undefined;

  const isServices = String(buyingType || "")
    .toLowerCase()
    .includes("service");
  const projectDuration =
    !isRfqType && (isServices || isRateContractType)
      ? firstPresent(
          props.projectDuration &&
            props.projectDuration !== "—" &&
            props.projectDuration !== "N/A"
            ? props.projectDuration
            : undefined,
          basics.projectDuration,
          basics.duration,
          serviceDetails.duration,
          serviceDetails.contractPeriod,
          terms.contractPeriod,
          terms.projectDuration,
          schedule.contractPeriod,
          schedule.duration,
        )
      : undefined;

  const cleanPaymentTerm = (val?: any) => {
    if (!val || typeof val !== "string") return undefined;
    const trimmed = val.trim();
    if (
      !trimmed ||
      trimmed === "—" ||
      trimmed === "N/A" ||
      trimmed === "Not Specified" ||
      trimmed === "null" ||
      trimmed === "undefined" ||
      ["two packet", "single packet", "two_packet", "single_packet"].includes(
        trimmed.toLowerCase(),
      )
    ) {
      return undefined;
    }
    return trimmed;
  };

  const paymentTerms = firstPresent(
    cleanPaymentTerm(props.paymentTerms),
    cleanPaymentTerm(terms.paymentTerms),
    cleanPaymentTerm(terms.paymentMode),
  );

  const scopeText =
    firstPresent(
      props.description &&
        props.description !== "No description provided." &&
        props.description !== "—"
        ? props.description
        : undefined,
      basics.description,
      basics.justification,
      payload.recommendation?.reason,
      serviceDetails.scopeOfWork,
      serviceDetails.description,
      props.subject && !isGenericTitle(props.subject)
        ? `Procurement requirement for ${props.subject}`
        : undefined,
    ) || "Detailed line item specifications attached in BOQ schedule.";

  const extractUrgencyFromText = (text?: string): string | undefined => {
    if (!text) return undefined;
    const match = String(text).match(
      /(?:urgency|priority):\s*([A-Za-z0-9_-]+)/i,
    );
    return match ? match[1].trim() : undefined;
  };

  const resolvedUrgency =
    firstPresent(
      props.urgency,
      (props as any).priority,
      payload.urgency,
      payload.priority,
      basics.priority,
      basics.urgency,
      payload.basics?.priority,
      payload.basics?.urgency,
      (props.rawBid as any)?.urgency,
      (props.rawBid as any)?.priority,
      (props.rawBid as any)?.technicalPacket?.urgency,
      (props.rawBid as any)?.technicalPacket?.priority,
      (props.rawBid as any)?.technicalPacket?.basics?.priority,
      (props.rawBid as any)?.technicalPacket?.basics?.urgency,
      (props.rawBid as any)?.technicalPacket?.rules?.urgency,
      (props.rawBid as any)?.technicalPacket?.recommendation?.urgency,
      rules.urgency,
      rules.priority,
      internal.urgency,
      internal.priority,
      extractUrgencyFromText(props.description),
      extractUrgencyFromText(basics.description),
      extractUrgencyFromText((props.rawBid as any)?.description),
      extractUrgencyFromText(scopeText),
    ) || "Normal";

  const buyerOrgName =
    firstPresent(
      props.orgName && props.orgName !== "—" && props.orgName !== "N/A"
        ? props.orgName
        : undefined,
      (props.rawBid as any)?.buyerOrganizationName,
      (props.rawBid as any)?.buyerOrganization?.organizationName,
      internal.orgName,
      basics.organizationName,
      buyerOrg.organizationName,
      buyerProfile.organizationName,
      buyerProfile.companyName,
      props.buyer?.buyerProfile?.organizationName,
      props.buyer?.organization?.organizationName,
    ) || "Buyer Organization";

  const isCandidateSameAsOrg = (candidate?: string | null) => {
    if (!candidate) return false;
    const c = candidate.trim().toLowerCase();
    const org = buyerOrgName.trim().toLowerCase();
    return (
      c === org ||
      c === "buyer" ||
      c === "buyer organization" ||
      c === "authorized procurement officer"
    );
  };

  const contactPerson =
    firstPresent(
      // Specific representative / person names first
      buyerProfile.representativeName,
      props.buyer?.buyerProfile?.representativeName,
      props.contactPerson && !isCandidateSameAsOrg(props.contactPerson)
        ? props.contactPerson
        : undefined,
      internal.contactPerson && !isCandidateSameAsOrg(internal.contactPerson)
        ? internal.contactPerson
        : undefined,
      internal.contactPersonName &&
        !isCandidateSameAsOrg(internal.contactPersonName)
        ? internal.contactPersonName
        : undefined,
      buyerProfile.contactPersonName &&
        !isCandidateSameAsOrg(buyerProfile.contactPersonName)
        ? buyerProfile.contactPersonName
        : undefined,
      buyerProfile.contactPerson &&
        !isCandidateSameAsOrg(buyerProfile.contactPerson)
        ? buyerProfile.contactPerson
        : undefined,
      props.buyer?.buyerProfile?.contactPerson &&
        !isCandidateSameAsOrg(props.buyer?.buyerProfile?.contactPerson)
        ? props.buyer?.buyerProfile?.contactPerson
        : undefined,
      props.buyerName && !isCandidateSameAsOrg(props.buyerName)
        ? props.buyerName
        : undefined,
      buyerOrg.contactPerson && !isCandidateSameAsOrg(buyerOrg.contactPerson)
        ? buyerOrg.contactPerson
        : undefined,
      props.buyer?.name && !isCandidateSameAsOrg(props.buyer?.name)
        ? props.buyer?.name
        : undefined,
      buyerProfile.name && !isCandidateSameAsOrg(buyerProfile.name)
        ? buyerProfile.name
        : undefined,
      // Fallback to buyerName / contactPerson if no other person name
      props.buyerName &&
        props.buyerName !== "—" &&
        props.buyerName !== "N/A" &&
        props.buyerName !== "Buyer"
        ? props.buyerName
        : undefined,
      props.contactPerson &&
        props.contactPerson !== "—" &&
        props.contactPerson !== "N/A"
        ? props.contactPerson
        : undefined,
    ) ||
    (buyerOrgName &&
    buyerOrgName !== "N/A" &&
    buyerOrgName !== "Buyer Organization"
      ? `${buyerOrgName} Purchase Officer`
      : "Authorized Procurement Officer");

  const email =
    firstPresent(
      props.buyerEmail && props.buyerEmail !== "N/A" && props.buyerEmail !== ""
        ? props.buyerEmail
        : undefined,
      buyerProfile.representativeEmail,
      buyerProfile.email,
      props.buyer?.email,
      props.buyer?.buyerProfile?.email,
      props.buyer?.buyerProfile?.contactPersonEmail,
      internal.email,
      internal.contactEmail,
      buyerOrg.email,
      buyerProfile.contactPersonEmail,
    ) || "";

  const phone =
    firstPresent(
      props.buyerMobile &&
        props.buyerMobile !== "N/A" &&
        props.buyerMobile !== ""
        ? props.buyerMobile
        : undefined,
      buyerProfile.representativeMobile,
      buyerProfile.mobile,
      buyerProfile.phone,
      props.buyer?.mobile,
      props.buyer?.phone,
      props.buyer?.buyerProfile?.mobile,
      props.buyer?.buyerProfile?.phone,
      props.buyer?.buyerProfile?.contactPersonMobile,
      internal.mobile,
      internal.phone,
      buyerOrg.mobile,
      buyerOrg.phone,
      buyerProfile.contactPersonMobile,
    ) || "";

  const rawStreet =
    buyerProfile.registeredAddress ||
    buyerOrg.registeredAddress ||
    buyerProfile.address ||
    buyerOrg.address;
  const rawCity = buyerProfile.city || buyerOrg.city;
  const rawDistrict = buyerProfile.district || buyerOrg.district;
  const rawState = buyerProfile.state || buyerOrg.state;
  const rawPin =
    buyerProfile.pincode ||
    buyerOrg.pincode ||
    props.buyer?.buyerProfile?.pincode;

  let computedAddress = "";
  if (rawStreet) {
    computedAddress = rawStreet.trim();
    const lowerStreet = computedAddress.toLowerCase();
    const partsToAdd: string[] = [];
    if (rawCity && !lowerStreet.includes(rawCity.toLowerCase())) {
      partsToAdd.push(rawCity);
    }
    if (
      rawDistrict &&
      rawDistrict.toLowerCase() !== rawCity?.toLowerCase() &&
      !lowerStreet.includes(rawDistrict.toLowerCase())
    ) {
      partsToAdd.push(rawDistrict);
    }
    if (rawState && !lowerStreet.includes(rawState.toLowerCase())) {
      partsToAdd.push(rawState);
    }
    if (partsToAdd.length > 0) {
      computedAddress = `${computedAddress}, ${partsToAdd.join(", ")}`;
    }
    if (rawPin && !computedAddress.includes(String(rawPin))) {
      computedAddress = `${computedAddress} - ${rawPin}`;
    }
  } else {
    const locParts = [
      rawCity,
      rawDistrict && rawDistrict.toLowerCase() !== rawCity?.toLowerCase()
        ? rawDistrict
        : null,
      rawState,
    ].filter(Boolean);
    computedAddress = locParts.join(", ");
    if (rawPin && computedAddress) {
      computedAddress = `${computedAddress} - ${rawPin}`;
    }
  }

  const rawBuyerAddress =
    firstPresent(
      props.buyerAddress,
      props.buyer?.buyerProfile?.address,
      props.buyer?.buyerProfile?.registeredAddress,
      computedAddress || undefined,
    ) || "";
  const buyerAddress = cleanDeliveryAddress(rawBuyerAddress) || rawBuyerAddress;

  const department =
    firstPresent(
      props.department && props.department !== "N/A" && props.department !== "—"
        ? props.department
        : undefined,
      buyerOrg.department,
      buyerOrg.departmentName,
      buyerProfile.department,
      buyerProfile.departmentName,
      internal.department,
      props.buyer?.buyerProfile?.department,
      props.buyer?.buyerProfile?.departmentName,
    ) || "Procurement & Stores Department";

  const cleanDeliveryTerm = (val?: any) => {
    if (!val || typeof val !== "string") return undefined;
    const trimmed = val.trim();
    if (
      !trimmed ||
      trimmed === "—" ||
      trimmed === "N/A" ||
      trimmed === "Not Specified" ||
      trimmed === "null" ||
      trimmed === "undefined" ||
      [
        "nos",
        "nos.",
        "kg",
        "ton",
        "mt",
        "bag",
        "box",
        "packet",
        "set",
        "pair",
        "roll",
        "litre",
        "meter",
        "feet",
        "piece",
        "unit",
      ].includes(trimmed.toLowerCase())
    ) {
      return undefined;
    }
    return trimmed;
  };

  const deliveryTerms = firstPresent(
    cleanDeliveryTerm(props.deliveryTerms),
    cleanDeliveryTerm(terms.deliveryTerms),
    cleanDeliveryTerm(terms.deliveryType),
    cleanDeliveryTerm(terms.deliveryMode),
    cleanDeliveryTerm(terms.deliverySchedule),
  );

  const rawConsignee =
    props.consigneeDetails ||
    payload.consigneeDetails ||
    payload.consignee ||
    payload.consignees ||
    payload.consigneeList;
  const consigneeList = asArray(rawConsignee);
  const consigneeDetails = consigneeList.length
    ? consigneeList
    : deliveryLocation && deliveryLocation !== "—" && deliveryLocation !== "N/A"
      ? [
          {
            name:
              contactPerson && contactPerson !== "—" && contactPerson !== "N/A"
                ? contactPerson
                : buyerOrgName,
            quantity: lineItems[0]?.quantity || boqTable[0]?.quantity || "100",
            location: deliveryLocation,
          },
        ]
      : [];

  const isEmdRequired = Boolean(
    props.isEmdRequired ??
    emdInfo?.isEmdRequired ??
    payload?.emd?.isEmdRequired ??
    basics?.isEmdRequired ??
    rules?.isEmdRequired ??
    false,
  );
  const rawEmdAmt = isEmdRequired
    ? (emdInfo?.emdAmount ??
      props.emdAmount ??
      payload?.emd?.amount ??
      rules?.emdAmount ??
      0)
    : 0;

  const emdDisplay =
    isEmdRequired && Number(rawEmdAmt) > 0
      ? formatCurrency(rawEmdAmt)
      : isEmdRequired
        ? "Required"
        : "Not required";

  const vendors = payload.vendors || {};
  const approval = payload.approval || {};

  const defaultRequirementQuantity = useMemo(() => {
    if (lineItems && lineItems.length > 0) {
      const sum = lineItems.reduce(
        (acc: number, item: any) => acc + (Number(item.quantity) || 0),
        0,
      );
      if (sum > 0) return sum;
    }
    const rawQty = Number(
      props.quantity ||
        payload.quantity ||
        payload.basics?.quantity ||
        (props as any).rawBid?.quantity ||
        0,
    );
    return Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 0;
  }, [lineItems, props.quantity, payload, (props as any).rawBid?.quantity]);

  const defaultRequirementUnit = useMemo(() => {
    if (lineItems && lineItems.length > 0) {
      const u =
        lineItems[0]?.unitOfMeasure || lineItems[0]?.unit || lineItems[0]?.uom;
      if (u) return String(u);
    }
    return String(
      props.unit ||
        payload.unit ||
        payload.basics?.unit ||
        (props as any).rawBid?.unit ||
        "Nos",
    );
  }, [lineItems, props.unit, payload, (props as any).rawBid?.unit]);

  const defaultProcurementDeliverySchedule = useMemo(() => {
    if (requiredByDateValue) {
      const parsed = formatDateString(requiredByDateValue, false);
      if (parsed && parsed !== "—") return `By ${parsed}`;
    }
    if (lineItems && lineItems.length > 0 && lineItems[0]?.deliveryDate) {
      const parsed = formatDateString(lineItems[0].deliveryDate, false);
      if (parsed && parsed !== "—") return `By ${parsed}`;
    }
    if (
      deliveryTerms &&
      deliveryTerms !== "—" &&
      deliveryTerms !== "N/A" &&
      deliveryTerms !== "Standard"
    ) {
      return deliveryTerms;
    }
    return "As per RFQ schedule";
  }, [requiredByDateValue, lineItems, deliveryTerms]);

  const rawSpecificEvalMethod = [
    evaluation.method,
    evaluation.evaluationMethod,
    evaluation.type,
    evaluation.name,
    payload.evaluationMethod,
    payload.evaluation_method,
    rules.evaluationMethod,
    tender.evaluationMethod,
    (props as any).payload?.evaluation?.method,
    (props as any).payload?.evaluation?.evaluationMethod,
    (props as any).payload?.evaluationMethod,
    (props as any).payload?.rules?.evaluationMethod,
    (props as any).evaluation?.method,
    (props as any).evaluationMethod,
  ].find(
    (v) =>
      typeof v === "string" &&
      v.trim().length > 0 &&
      !["l1", "l1 basis", "l1 evaluation"].includes(v.trim().toLowerCase()),
  );

  const evaluationMethod =
    rawSpecificEvalMethod ||
    firstPresent(
      props.evaluationMethod,
      evaluation.evaluationMethod,
      evaluation.method,
      rules.evaluationMethod,
      payload.evaluationMethod,
      tender.evaluationMethod,
    ) ||
    "L1 Basis";

  const isQcbsMethod = Boolean(
    evaluationMethod &&
    (evaluationMethod.toLowerCase().includes("qcbs") ||
      evaluationMethod.toLowerCase().includes("weighted")),
  );

  const evalDetails = useMemo(() => {
    return getEvaluationMethodDetails(evaluationMethod);
  }, [evaluationMethod]);

  const isTechEvalNeeded = Boolean(
    payload.isTechnicalEvaluationNeeded ||
    basics.isTechnicalEvaluationNeeded ||
    rules.isTechnicalEvaluationNeeded ||
    (evaluationMethod &&
      (evaluationMethod.toLowerCase().includes("qcbs") ||
        evaluationMethod.toLowerCase().includes("tech") ||
        evaluationMethod.toLowerCase().includes("score"))),
  );

  const technicalCriteria = firstPresent(
    evaluation.technicalCriteria,
    evaluation.criteria,
    evaluation.evaluationCriteria,
    payload.technicalCriteria,
    payload.criteria,
    rules.technicalCriteria,
    rules.criteria,
  );

  const hasExplicitTechCriteria = Boolean(
    isTechEvalNeeded &&
    technicalCriteria &&
    hasDetailData(technicalCriteria) &&
    (Array.isArray(technicalCriteria) ? technicalCriteria.length > 0 : true),
  );

  const questionnaireData = firstPresent(
    payload.questionnaire,
    rules.questionnaire,
    evaluation.questionnaire,
  );

  const effectiveInviteCount = useMemo(() => {
    // 1. Check array candidates for real invited seller records
    const arrayCandidates = [
      props.invitations,
      props.invitedSellers,
      vendors.invitedSellers,
      vendors.invitedSuppliers,
      payload.invitedSellers,
      payload.invitations,
      payload.invitedSuppliers,
      payload.rateContractConfig?.selectedSuppliers,
      payload.rateContract?.selectedSuppliers,
      payload.auctionConfig?.qualifiedVendors,
      rules.invitedSellers,
    ];

    let maxFromArrays = 0;
    for (const arr of arrayCandidates) {
      if (Array.isArray(arr) && arr.length > maxFromArrays) {
        maxFromArrays = arr.length;
      }
    }
    if (maxFromArrays > 0) return maxFromArrays;

    // 2. Check numeric candidates if array is not populated
    const numericCandidates = [
      props.invitedCount,
      (props as any).invitationsCount,
      vendors.inviteCount,
      vendors.invitedCount,
      payload.inviteCount,
      payload.invitedCount,
      rules.inviteCount,
    ];

    for (const val of numericCandidates) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) {
        return num;
      }
    }
    return 0;
  }, [
    props.invitedCount,
    (props as any).invitationsCount,
    props.invitations,
    props.invitedSellers,
    vendors.inviteCount,
    vendors.invitedCount,
    vendors.invitedSellers,
    vendors.invitedSuppliers,
    payload.inviteCount,
    payload.invitedCount,
    payload.invitedSellers,
    payload.invitations,
    payload.invitedSuppliers,
    payload.rateContractConfig?.selectedSuppliers,
    payload.rateContract?.selectedSuppliers,
    payload.auctionConfig?.qualifiedVendors,
    rules.inviteCount,
    rules.invitedSellers,
  ]);

  const resolvedWorkflow = (() => {
    const rawWf = String(
      approval.workflow || payload.workflow || rules.workflow || "",
    ).trim();
    if (
      isTwoPacket ||
      rawWf.toLowerCase().includes("two") ||
      rawWf.toLowerCase().includes("technical")
    ) {
      return "Two-Stage (Technical + Financial)";
    }
    return "Single Stage (Commercial Only)";
  })();

  const supplierControlsData = compactObject({
    selectionMode: firstPresent(
      vendors.selectionMode,
      vendors.selection,
      vendors.type,
      rules.selectionMode,
      "Open",
    ),
    inviteCount: String(effectiveInviteCount),
    msmePreference: firstPresent(
      vendors.msmePreference,
      rules.msmePreference,
      "Yes",
    ),
    excludeBlacklisted: firstPresent(
      vendors.excludeBlacklisted,
      rules.excludeBlacklisted,
      "Yes",
    ),
    localVendorPreference: firstPresent(
      vendors.localVendorPreference,
      rules.localVendorPreference,
      "Yes",
    ),
    approvalNotes: firstPresent(
      approval.notes,
      approval.approvalNotes,
      rules.approvalNotes,
    ),
    workflow: resolvedWorkflow,
  });

  // isBuyerOrAdmin already defined at top level of component

  const allParticipationsList = useMemo(() => {
    const combined = [
      ...asArray(props.participations),
      ...asArray(fetchedParticipants),
    ];

    const vendorMap = new Map<string, any>();
    const result: any[] = [];

    const getVendorKeys = (p: any) => {
      const sId =
        p.sellerUserId || p.sellerId || p.seller?.id || p.sellerUser?.id;
      const sOrg =
        p.sellerOrganizationId ||
        p.sellerOrgId ||
        p.seller?.organizationId ||
        p.sellerUser?.organizationId ||
        p.sellerOrganization?.id ||
        p.seller?.organization?.id;
      const orgName = (
        p.sellerOrgName ||
        p.sellerOrganization?.organizationName ||
        p.seller?.organization?.organizationName ||
        p.seller?.sellerProfile?.organizationName ||
        p.sellerProfile?.organizationName ||
        p.companyName ||
        p.sellerName ||
        ""
      )
        .trim()
        .toLowerCase();

      const keys: string[] = [];
      if (p.id && String(p.id) !== "0") keys.push(`id-${p.id}`);
      if (p.participationId && String(p.participationId) !== "0") keys.push(`part-${p.participationId}`);
      if (p.participationNumber) keys.push(`partNum-${String(p.participationNumber).trim()}`);
      if (sOrg && String(sOrg) !== "0" && String(sOrg) !== "undefined")
        keys.push(`org-${sOrg}`);
      if (sId && String(sId) !== "0" && String(sId) !== "undefined")
        keys.push(`user-${sId}`);
      if (
        orgName &&
        !orgName.startsWith("supplier #") &&
        !orgName.startsWith("verified supplier") &&
        !orgName.startsWith("seller partner")
      ) {
        keys.push(`name-${orgName}`);
        keys.push(`norm-${orgName.replace(/[^a-z0-9]/g, "")}`);
      }
      const email = (p.sellerEmail || p.email || p.seller?.email || p.sellerUser?.email || "").trim().toLowerCase();
      if (email && email.includes("@")) {
        keys.push(`email-${email}`);
      }
      return { sId, sOrg, orgName, keys };
    };

    for (let idx = 0; idx < combined.length; idx++) {
      const p = combined[idx];
      if (!p) continue;

      const { sId, sOrg, orgName, keys } = getVendorKeys(p);
      let existing = keys.map((k) => vendorMap.get(k)).find(Boolean);

      const respData =
        typeof p.responseData === "string"
          ? (() => {
              try {
                return JSON.parse(p.responseData);
              } catch {
                return {};
              }
            })()
          : p.responseData || {};

      const s = String(p.status || p.submissionStatus || "").toUpperCase();
      const rawTs = String(
        p.technicalStatus ||
          respData.technicalStatus ||
          (s === "SHORTLISTED" || s === "ACCEPTED"
            ? "QUALIFIED"
            : s === "REJECTED"
              ? "DISQUALIFIED"
              : "PENDING"),
      ).toUpperCase();

      const isEvaluated =
        rawTs === "QUALIFIED" ||
        rawTs === "DISQUALIFIED" ||
        rawTs === "NOT_QUALIFIED" ||
        s === "REJECTED";
      const ts =
        rawTs === "QUALIFIED"
          ? "QUALIFIED"
          : rawTs === "DISQUALIFIED" ||
              rawTs === "NOT_QUALIFIED" ||
              s === "REJECTED"
            ? "DISQUALIFIED"
            : "PENDING";

      const itemOfferedQty = Number(
        p.offeredQuantity ?? respData.offeredQuantity ?? 0,
      );
      const itemTimeline = p.deliveryTimeline || respData.deliveryTimeline;
      const itemDocs = Array.isArray(p.documents)
        ? p.documents
        : Array.isArray(respData.documents)
          ? respData.documents
          : [];
      const itemLines = Array.isArray(p.lineItems)
        ? p.lineItems
        : Array.isArray(respData.lineItems)
          ? respData.lineItems
          : Array.isArray(respData.lineQuotes)
            ? respData.lineQuotes
            : [];
      const offeredPrice =
        p.offeredPrice ??
        p.quotedAmount ??
        p.totalAmount ??
        respData.offeredPrice ??
        respData.quotedAmount ??
        respData.totalAmount;

      if (existing) {
        // Merge into existing vendor record
        // 1. Technical Evaluation Priority: If this record has evaluation decisions, apply them
        const existingTs = String(existing.technicalStatus || "").toUpperCase();
        const existingIsEvaluated =
          existingTs === "QUALIFIED" ||
          existingTs === "DISQUALIFIED" ||
          existingTs === "NOT_QUALIFIED" ||
          Boolean(existing.isDisqualified);

        if (
          isEvaluated &&
          (!existingIsEvaluated ||
            existingTs === "PENDING" ||
            ts === "QUALIFIED" ||
            p.technicalStatus === "QUALIFIED")
        ) {
          existing.technicalStatus = ts;
          existing.technicalRemarks =
            p.technicalRemarks ||
            p.rejectionReason ||
            respData.technicalRemarks ||
            existing.technicalRemarks;
          existing.score = p.score ?? respData.score ?? existing.score;
          existing.isDisqualified =
            ts === "DISQUALIFIED" ||
            Boolean(p.isDisqualified) ||
            existing.isDisqualified;
        }

        // 2. Commercial / Quotation details priority: preserve authentic offered quantity, timeline, line items, documents
        if (!existing.offeredQuantity && itemOfferedQty > 0) {
          existing.offeredQuantity = itemOfferedQty;
        }
        if (
          (!existing.deliveryTimeline ||
            existing.deliveryTimeline === "Standard") &&
          itemTimeline &&
          itemTimeline !== "Standard"
        ) {
          existing.deliveryTimeline = itemTimeline;
        }
        if (
          (!existing.offeredPrice || existing.offeredPrice === 0) &&
          offeredPrice != null &&
          Number(offeredPrice) > 0
        ) {
          existing.offeredPrice = Number(offeredPrice);
          existing.quotedAmount = Number(offeredPrice);
          existing.totalAmount = Number(offeredPrice);
        }
        if (
          (!existing.lineItems || existing.lineItems.length === 0) &&
          itemLines.length > 0
        ) {
          existing.lineItems = itemLines;
        }
        if (
          (!existing.documents || existing.documents.length === 0) &&
          itemDocs.length > 0
        ) {
          existing.documents = itemDocs;
        }
        if (
          p.id &&
          !existing.participationId &&
          String(p.participationNumber || "").startsWith("PRT-")
        ) {
          existing.participationId = p.id;
          existing.id = p.id;
        }
        if (p.message || p.coverNote || respData.message) {
          existing.message =
            existing.message || p.message || p.coverNote || respData.message;
        }

        for (const k of keys) {
          vendorMap.set(k, existing);
        }
      } else {
        const newRecord: any = {
          ...p,
          id: p.id || (keys[0] ? `p-${keys[0]}` : `item-${idx}`),
          sellerId: sId,
          sellerUserId: sId,
          sellerOrganizationId: sOrg,
          technicalStatus: ts,
          technicalRemarks:
            p.technicalRemarks ||
            p.rejectionReason ||
            respData.technicalRemarks ||
            "",
          score: p.score ?? respData.score ?? null,
          isDisqualified:
            ts === "DISQUALIFIED" ||
            s === "REJECTED" ||
            Boolean(p.isDisqualified),
          offeredQuantity:
            itemOfferedQty > 0
              ? itemOfferedQty
              : p.offeredQuantity || undefined,
          deliveryTimeline:
            itemTimeline && itemTimeline !== "Standard"
              ? itemTimeline
              : p.deliveryTimeline && p.deliveryTimeline !== "Standard"
                ? p.deliveryTimeline
                : undefined,
          documents: itemDocs.length ? itemDocs : p.documents || [],
          lineItems: itemLines.length ? itemLines : p.lineItems || [],
          quotedAmount:
            offeredPrice != null ? Number(offeredPrice) : (p.quotedAmount ?? 0),
          totalAmount:
            offeredPrice != null ? Number(offeredPrice) : (p.totalAmount ?? 0),
        };

        result.push(newRecord);
        if (keys.length > 0) {
          for (const k of keys) {
            vendorMap.set(k, newRecord);
          }
        } else {
          vendorMap.set(`id-${newRecord.id}`, newRecord);
        }
      }
    }
    return result;
  }, [props.participations, fetchedParticipants]);

  const submittedParticipations = useMemo(() => {
    return allParticipationsList.filter((p: any) => {
      const statusStr = String(
        p.submissionStatus || p.status || "",
      ).toUpperCase();
      return statusStr !== "DRAFT" && statusStr !== "CANCELLED";
    });
  }, [allParticipationsList]);

  const qualifiedParticipations = useMemo(() => {
    return submittedParticipations.filter((p: any) => {
      const ts = String(p.technicalStatus || "").toUpperCase();
      const isDisq =
        ts === "DISQUALIFIED" || ts === "NOT_QUALIFIED" || p.isDisqualified;
      return !isDisq;
    });
  }, [submittedParticipations]);

  const lowestQualifiedL1ParticipationId = useMemo(() => {
    let lowestId: any = null;
    let lowestAmt = Infinity;
    for (const p of qualifiedParticipations) {
      const amt = Number(
        p.totalAmount || p.quotedAmount || p.offeredPrice || 0,
      );
      if (amt > 0 && amt < lowestAmt) {
        lowestAmt = amt;
        lowestId = p.id;
      }
    }
    return lowestId;
  }, [qualifiedParticipations]);

  const handleOpenMyQuotationModal = useCallback(() => {
    let targetPart = effectiveMyParticipation;
    if (!targetPart) {
      targetPart =
        submittedParticipations.find(
          (p: any) =>
            (currentUserId &&
              String(
                p.sellerUserId || p.sellerId || p.seller?.id || p.sellerUser?.id,
              ) === currentUserId) ||
            (currentOrgId &&
              String(
                p.sellerOrganizationId ||
                  p.sellerOrganization?.id ||
                  p.seller?.organizationId ||
                  p.sellerOrgId,
              ) === currentOrgId),
        ) ||
        allParticipationsList.find(
          (p: any) =>
            (currentUserId &&
              String(
                p.sellerUserId || p.sellerId || p.seller?.id || p.sellerUser?.id,
              ) === currentUserId) ||
            (currentOrgId &&
              String(
                p.sellerOrganizationId ||
                  p.sellerOrganization?.id ||
                  p.seller?.organizationId ||
                  p.sellerOrgId,
              ) === currentOrgId),
        ) ||
        (submittedParticipations.length === 1 && !isBuyerOrAdmin
          ? submittedParticipations[0]
          : null) ||
        {
          id: `my-quote-${targetId}`,
          sellerOrgName:
            currentUser?.organization?.organizationName ||
            currentUser?.organization?.name ||
            currentUser?.companyName ||
            currentUser?.name ||
            "My Quoting Organization",
          sellerName: currentUser?.name || "Authorized Representative",
          sellerEmail: currentUser?.email || "N/A",
          sellerPhone: currentUser?.mobile || currentUser?.phone || "N/A",
          submissionStatus: "SUBMITTED",
          status: "SUBMITTED",
          quotedAmount: Number(props.rawBid?.quotedAmount || props.rawBid?.totalAmount || 0),
          totalAmount: Number(props.rawBid?.totalAmount || props.rawBid?.quotedAmount || 0),
          lineItems: props.rawBid?.lineItems || props.items || [],
          documents: props.rawBid?.documents || [],
          submittedAt: props.rawBid?.submittedAt || new Date().toISOString(),
          deliveryTimeline: props.rawBid?.deliveryTimeline || "Standard",
          paymentTerms: props.rawBid?.paymentTerms || "Standard Payment Terms",
        };
    }
    setSelectedQuotationForReview(targetPart);
  }, [
    effectiveMyParticipation,
    submittedParticipations,
    allParticipationsList,
    currentUserId,
    currentOrgId,
    currentUser,
    isBuyerOrAdmin,
    targetId,
    props.rawBid,
    props.items,
    props.documents,
  ]);

  const handleConfirmAwardSubmit = async () => {
    if (!awardingParticipation) return;
    const isTargetL1 =
      String(awardingParticipation.id) ===
      String(lowestQualifiedL1ParticipationId);
    if (!isTargetL1 && !awardJustification.trim()) {
      toast.error(
        "Please provide justification for awarding to a non-L1 bidder.",
      );
      return;
    }
    try {
      setIsSubmittingAward(true);
      await procurementBidApi.recommendAward(targetId, {
        participationId: awardingParticipation.id,
        justificationReason: awardJustification.trim() || undefined,
        remarks: awardRemarks.trim() || undefined,
      });
      toast.success(
        "Contract award offered to vendor! Vendor has been notified to formally accept.",
      );
      setAwardingParticipation(null);
      setAwardJustification("");
      setAwardRemarks("");
      queryClient.invalidateQueries();
      if (typeof window !== "undefined") window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to offer contract award.");
    } finally {
      setIsSubmittingAward(false);
    }
  };

  const isTwoPacketMode = useMemo(() => {
    return isTwoPacket;
  }, [isTwoPacket]);

  const techEvaluationStats = useMemo(() => {
    let qualified = 0;
    let disqualified = 0;
    let pending = 0;

    for (const p of submittedParticipations) {
      const ts = String(p.technicalStatus || "").toUpperCase();
      if (ts === "QUALIFIED") {
        qualified++;
      } else if (
        ts === "DISQUALIFIED" ||
        ts === "NOT_QUALIFIED" ||
        p.isDisqualified
      ) {
        disqualified++;
      } else {
        pending++;
      }
    }

    return {
      total: submittedParticipations.length,
      qualified,
      disqualified,
      pending,
    };
  }, [submittedParticipations]);

  const handleCompleteTechnicalEvaluation = async () => {
    try {
      setIsCompletingTechEval(true);
      await procurementBidApi.completeTechnicalEvaluation(targetId);
      setIsCompletingTechEvalSuccess(true);
      toast.success(
        "Stage 1 Technical Evaluation completed successfully! You can now open financial bids or launch Stage 2 Reverse Auction.",
      );
      queryClient.invalidateQueries({
        queryKey: ["procurement-bid-detail", targetId],
      });
      queryClient.invalidateQueries({
        queryKey: ["procurement-bid-detail"],
      });
      queryClient.invalidateQueries({
        queryKey: ["procurement-bid", targetId],
      });
      queryClient.invalidateQueries({
        queryKey: ["procurement-bid"],
      });
      queryClient.invalidateQueries({
        queryKey: ["buyer-unified-participations"],
      });
      queryClient.invalidateQueries({ queryKey: ["rfq-buyer-responses-v2"] });
      queryClient.invalidateQueries({ queryKey: ["rfq-detail-v2"] });
      queryClient.invalidateQueries({ queryKey: ["rfq-detail"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to complete technical evaluation.");
    } finally {
      setIsCompletingTechEval(false);
    }
  };

  const effectiveDeadlineTarget = closingDateValue || props.deadlineDate;
  const isDeadlinePassed = Boolean(
    !isBeforeSubmissionStart &&
    effectiveDeadlineTarget &&
    (() => {
      const parsed = parseDateValue(effectiveDeadlineTarget, false);
      return parsed ? parsed.getTime() < nowMs : false;
    })(),
  );

  const isBiddingClosed =
    isPostBiddingStage ||
    Boolean(props.isSubmitDisabled) ||
    isDeadlinePassed;

  const effectiveStatusLabel = useMemo(() => {
    if (isBeforeSubmissionStart) {
      return "SUBMISSION OPENS SOON";
    }
    if (isDeadlinePassed || isBiddingClosed) {
      const u = statusUpper;
      const l = String(statusLabel || "").toUpperCase();
      if (
        u === "OPEN" ||
        u === "ACTIVE" ||
        u === "IN_PROGRESS" ||
        u === "PENDING" ||
        u === "PUBLISHED" ||
        l === "OPEN" ||
        l === "ACTIVE" ||
        l === "IN PROGRESS" ||
        l === "PENDING"
      ) {
        return "SUBMISSION CLOSED";
      }
    }
    return statusLabel;
  }, [statusUpper, isDeadlinePassed, isBiddingClosed, isBeforeSubmissionStart, statusLabel]);

  const isEvaluationReady = Boolean(
    isPostBiddingStage ||
    isDeadlinePassed ||
    Boolean(props.isSubmitDisabled) ||
    [
      "CLOSED",
      "TECHNICAL_EVALUATION",
      "FINANCIAL_EVALUATION",
      "L1_GENERATED",
      "AWARD_RECOMMENDED",
      "AWARDED",
      "COMPLETED",
      "EXPIRED",
    ].includes(statusUpper),
  );

  const isBidAwarded = useMemo(() => {
    return (
      ["AWARDED", "PO_GENERATED", "COMPLETED"].includes(statusUpper) ||
      ["AWARDED", "PO_GENERATED", "COMPLETED"].includes(lifecycleStageUpper) ||
      Boolean((props as any).awardedSupplier) ||
      Boolean((props as any).awardDetails) ||
      submittedParticipations.some(
        (p: any) =>
          String(p.status || "").toUpperCase() === "AWARDED" ||
          String(p.finalStatus || "").toUpperCase() === "AWARDED" ||
          p.resultStatus === "Awarded",
      )
    );
  }, [statusUpper, lifecycleStageUpper, props, submittedParticipations]);

  const awardedParticipation = useMemo(() => {
    return submittedParticipations.find(
      (p: any) =>
        String(p.status || "").toUpperCase() === "AWARDED" ||
        String(p.finalStatus || "").toUpperCase() === "AWARDED" ||
        p.resultStatus === "Awarded",
    );
  }, [submittedParticipations]);

  const awardedVendorName = useMemo(() => {
    return (
      awardedParticipation?.sellerOrgName ||
      awardedParticipation?.sellerOrganization?.organizationName ||
      awardedParticipation?.seller?.sellerProfile?.organizationName ||
      awardedParticipation?.seller?.organization?.organizationName ||
      awardedParticipation?.supplier?.organizationName ||
      awardedParticipation?.organizationName ||
      awardedParticipation?.companyName ||
      awardedParticipation?.sellerName ||
      (props as any).awardedSupplierName ||
      "Awarded Supplier"
    );
  }, [awardedParticipation, props]);

  const quotationListColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        key: "supplier",
        header: "Supplier Organization",
        width: "w-[18%]",
        cell: (participation, idx) => {
          const sellerOrgName =
            participation.sellerOrgName ||
            participation.sellerOrganization?.organizationName ||
            participation.seller?.sellerProfile?.organizationName ||
            participation.seller?.organization?.organizationName ||
            participation.sellerProfile?.organizationName ||
            participation.companyName ||
            participation.sellerName ||
            participation.seller?.name ||
            participation.sellerUser?.name ||
            (participation.sellerId ||
            participation.sellerUserId ||
            (participation.id && !String(participation.id).startsWith("id-"))
              ? `Supplier #${participation.sellerId || participation.sellerUserId || participation.id}`
              : `Supplier ${idx + 1}`);
          const contactName =
            participation.sellerName ||
            participation.contactPerson ||
            participation.seller?.name ||
            participation.sellerUser?.name ||
            "";
          return (
            <div className="min-w-0 pr-2">
              <p
                className="font-bold text-slate-950 text-xs truncate"
                title={sellerOrgName}
              >
                {sellerOrgName}
              </p>
              {contactName && contactName !== sellerOrgName && (
                <p
                  className="text-[10px] font-normal text-slate-400 truncate mt-0.5"
                  title={`Contact: ${contactName}`}
                >
                  Contact: {contactName}
                </p>
              )}
            </div>
          );
        },
      },
      {
        key: "amount",
        header: "Quoted Amount (INR)",
        width: "w-[12%]",
        cell: (participation) => {
          if (!isEvaluationReady) {
            return (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-xs whitespace-nowrap">
                <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                Sealed until closing
              </span>
            );
          }
          if (isTwoPacketMode && !isTechEvalCompleted) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50/80 px-2.5 py-0.5 text-[10.5px] font-bold text-indigo-700 whitespace-nowrap">
                <Lock className="h-3 w-3 text-indigo-500 shrink-0" />
                Sealed (Stage 2)
              </span>
            );
          }
          const amount = Number(
            participation.totalAmount ||
              participation.quotedAmount ||
              participation.offeredPrice ||
              0,
          );
          return (
            <span className="font-extrabold text-slate-900 text-xs whitespace-nowrap">
              {amount > 0
                ? `₹${amount.toLocaleString("en-IN")}`
                : "Sealed / Rates On File"}
            </span>
          );
        },
      },
      {
        key: "qtyDelivery",
        header: "Offered Qty & Delivery",
        width: "w-[12%]",
        cell: (participation) => {
          const rawQty = Number(
            participation.offeredQuantity ??
              participation.quantity ??
              participation.responseData?.offeredQuantity ??
              0,
          );
          const hasCustomQty = Number.isFinite(rawQty) && rawQty > 0;
          const finalQty = hasCustomQty ? rawQty : defaultRequirementQuantity;
          const uom = defaultRequirementUnit || "Nos";
          const qtyText =
            finalQty > 0
              ? `${finalQty.toLocaleString("en-IN")} ${uom}`
              : "As specified in RFQ";

          const rawDelivery = (
            participation.deliveryTimeline ||
            participation.responseData?.deliveryTimeline ||
            ""
          ).trim();
          const hasCustomDelivery =
            rawDelivery && rawDelivery.toLowerCase() !== "standard";
          const deliveryText = hasCustomDelivery
            ? rawDelivery
            : defaultProcurementDeliverySchedule || "Standard";

          const formatDelivery = (val: string) => {
            if (!val || val === "—" || val.toLowerCase() === "standard") {
              return "Standard Schedule";
            }
            const trimmed = val.trim();
            if (/^\d+$/.test(trimmed)) {
              const n = Number(trimmed);
              return `${n} ${n === 1 ? "Day" : "Days"} Delivery`;
            }
            if (/^\d+\s*(d|day|days)$/i.test(trimmed)) {
              return `${trimmed} Delivery`;
            }
            return trimmed;
          };

          return (
            <div className="text-slate-600 min-w-0 pr-1">
              <p className="font-semibold text-xs text-slate-900 truncate">
                {qtyText}
              </p>
              <p className="text-[10.5px] font-medium text-slate-500 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                <Truck className="h-3 w-3 text-slate-400 shrink-0" />
                <span>{formatDelivery(deliveryText)}</span>
              </p>
            </div>
          );
        },
      },
      {
        key: "submittedAt",
        header: "Submitted At",
        width: "w-[11%]",
        cell: (participation) => {
          const dateStr = formatDateString(
            participation.submittedAt ||
              participation.updatedAt ||
              participation.createdAt,
            true,
          );
          return (
            <span className="text-slate-500 font-medium text-xs whitespace-nowrap">
              {dateStr}
            </span>
          );
        },
      },
      {
        key: "technicalStatus",
        header: "Technical Evaluation",
        width: "w-[11%]",
        cell: (participation) => {
          if (!isEvaluationReady) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-600 whitespace-nowrap">
                <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                Sealed Proposal
              </span>
            );
          }
          const ts = String(participation.technicalStatus || "").toUpperCase();
          const isQual = ts === "QUALIFIED";
          const isDisq =
            ts === "DISQUALIFIED" ||
            ts === "NOT_QUALIFIED" ||
            participation.isDisqualified;
          return (
            <div className="whitespace-nowrap">
              {isQual ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[9.5px] font-extrabold text-emerald-800 shadow-2xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                  Qualified
                </span>
              ) : isDisq ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-[9.5px] font-extrabold text-rose-800 shadow-2xs">
                  <XCircle className="h-3 w-3 text-rose-600 shrink-0" />
                  Disqualified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[9.5px] font-extrabold text-amber-800 shadow-2xs">
                  <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                  Pending Review
                </span>
              )}
              {participation.score !== undefined &&
                participation.score !== null && (
                  <span className="text-[10px] font-bold text-slate-500 block mt-0.5">
                    Score: {participation.score}/100
                  </span>
                )}
            </div>
          );
        },
      },
      {
        key: "status",
        header: "Lifecycle & Award Status",
        width: "w-[12%]",
        cell: (participation) => {
          const isAwardWinner = Boolean(
            activeAward &&
            ((activeAward.awardedSellerId &&
              String(activeAward.awardedSellerId) ===
                String(
                  participation.sellerUserId ||
                    participation.sellerId ||
                    participation.id,
                )) ||
              (activeAward.sellerId &&
                String(activeAward.sellerId) ===
                  String(
                    participation.sellerUserId ||
                      participation.sellerId ||
                      participation.id,
                  )) ||
              (activeAward.participationId &&
                String(activeAward.participationId) ===
                  String(participation.id))),
          );

          if (isAwardWinner) {
            if (effectiveActiveOrder) {
              return (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[9.5px] font-black uppercase text-emerald-800 shadow-2xs whitespace-nowrap">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                  Ordered & Active
                </span>
              );
            }
            if (activeAward.awardStatus === "ACCEPTED") {
              return (
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-0.5 text-[9.5px] font-black uppercase text-indigo-800 shadow-2xs whitespace-nowrap">
                  <Award className="h-3 w-3 text-indigo-600 shrink-0" />
                  Award Accepted
                </span>
              );
            }
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[9.5px] font-black uppercase text-amber-800 shadow-2xs whitespace-nowrap">
                <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                Award Offered (Pending)
              </span>
            );
          }

          if (
            isPOAccepted ||
            String(participation.finalStatus || "").toUpperCase() ===
              "NOT_SELECTED"
          ) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[9.5px] font-bold uppercase text-slate-500 whitespace-nowrap">
                Not Selected
              </span>
            );
          }

          if (activeAward || isEvaluationReady) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[9.5px] font-bold uppercase text-sky-700 shadow-2xs whitespace-nowrap">
                <Clock className="h-3 w-3 text-sky-500 shrink-0" />
                Under Review
              </span>
            );
          }

          const statusLabel =
            participation.submissionStatus ||
            participation.status ||
            "Submitted";
          return (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold uppercase text-slate-700 whitespace-nowrap">
              {statusLabel}
            </span>
          );
        },
      },
      {
        key: "action",
        header: "Action",
        align: "right",
        width: "w-[24%]",
        cell: (participation) => {
          const ts = String(participation.technicalStatus || "").toUpperCase();
          const isQual =
            ts === "QUALIFIED" || ts === "ACCEPTED" || ts === "SHORTLISTED";
          const isDisq =
            ts === "DISQUALIFIED" ||
            ts === "NOT_QUALIFIED" ||
            ts === "REJECTED" ||
            Boolean(participation.isDisqualified);
          const isEvaluated = isQual || isDisq;

          return (
            <div className="flex items-center justify-end gap-1.5 flex-nowrap">
              {isBuyerOrAdmin && (
                <Button
                  type="button"
                  size="sm"
                  disabled={!isEvaluationReady}
                  onClick={
                    isEvaluationReady
                      ? () => setSelectedForTechnicalEval(participation)
                      : undefined
                  }
                  className={cn(
                    "h-7.5 px-2.5 gap-1 text-[11px] font-bold border shadow-2xs rounded-lg shrink-0 whitespace-nowrap",
                    isEvaluationReady
                      ? isQual
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                        : isDisq
                          ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 cursor-pointer"
                          : "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 cursor-pointer"
                      : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-75",
                  )}
                  title={
                    isEvaluationReady
                      ? isQual
                        ? isTechEvalCompleted
                          ? "View technical evaluation record (Locked under Stage 2)"
                          : "View or edit evaluation decision, score, and remarks"
                        : isDisq
                          ? "View disqualification record"
                          : "Evaluate technical proposal, compliance and eligibility (Qualify / Disqualify)"
                      : "Evaluation unlocks after bidding window closes"
                  }
                >
                  {isEvaluationReady ? (
                    isQual ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : isDisq ? (
                      <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    )
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                  <span>
                    {isQual
                      ? isTechEvalCompleted
                        ? "View Evaluation"
                        : "Edit Remarks"
                      : isDisq
                        ? "View Disqualification"
                        : "Evaluate Bid"}
                  </span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!isEvaluationReady}
                onClick={
                  isEvaluationReady
                    ? () => setSelectedQuotationForReview(participation)
                    : undefined
                }
                className={cn(
                  "h-7.5 px-2.5 gap-1 text-[11px] font-bold shadow-2xs rounded-lg shrink-0 whitespace-nowrap",
                  isEvaluationReady
                    ? "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-75",
                )}
                title={
                  isEvaluationReady
                    ? "Review full quotation details, line item rates and compliance"
                    : "Quotation remains sealed until bidding closes"
                }
              >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Review<span className="hidden xl:inline"> Quotation</span>
                </span>
              </Button>
            </div>
          );
        },
      },
    ],
    [
      isEvaluationReady,
      isBuyerOrAdmin,
      isTwoPacketMode,
      isTechEvalCompleted,
      defaultRequirementQuantity,
      defaultRequirementUnit,
      defaultProcurementDeliverySchedule,
      activeAward,
      effectiveActiveOrder,
      lowestQualifiedL1ParticipationId,
    ],
  );

  const proposalStatusDisplay = useMemo(() => {
    // If current user is explicitly a seller and not viewing as buyer, show their authentic submission & evaluation status
    if (currentUser?.role === "seller" && !isBuyerSide) {
      if (isSellerParticipated) {
        if (isAwardedToMe) return "Awarded to You";
        if (activeAward && !isAwardedToMe && !effectiveActiveOrder)
          return "Standby (Under Evaluation)";
        if (isBiddingClosed || isDeadlinePassed)
          return "Submitted • Under Evaluation";
        return "Quotation Submitted";
      } else {
        if (isBeforeSubmissionStart) return "Upcoming";
        if (isBiddingClosed || isDeadlinePassed) return "Submission Closed";
        return "Open for Quotation";
      }
    }

    // For buyer, admin, or general viewer, derive authentic status from real database records
    const rawStatus = String(props.status || "").toUpperCase();
    const count = Math.max(
      props.participantsCount || 0,
      submittedParticipations.length,
    );

    // 1. Awarded / Completed
    const hasAwarded = submittedParticipations.some((p: any) => {
      const s = String(
        p.finalStatus || p.status || p.submissionStatus || "",
      ).toUpperCase();
      return s === "AWARDED" || s === "ACCEPTED" || s === "PO_GENERATED";
    });
    if (
      hasAwarded ||
      rawStatus === "AWARDED" ||
      rawStatus === "PO_GENERATED" ||
      rawStatus === "AWARD_RECOMMENDED"
    ) {
      return "Awarded";
    }

    // 2. Under Evaluation
    const hasEvaluation = submittedParticipations.some((p: any) => {
      const ts = String(p.technicalStatus || "").toUpperCase();
      const fs = String(p.financialStatus || "").toUpperCase();
      const s = String(p.status || p.submissionStatus || "").toUpperCase();
      return (
        ts === "QUALIFIED" ||
        ts === "DISQUALIFIED" ||
        ts === "NOT_QUALIFIED" ||
        ts === "UNDER_EVALUATION" ||
        fs === "OPENED" ||
        s === "UNDER_REVIEW" ||
        s === "SHORTLISTED"
      );
    });
    if (
      hasEvaluation ||
      rawStatus === "TECHNICAL_EVALUATION" ||
      rawStatus === "FINANCIAL_EVALUATION" ||
      rawStatus === "UNDER_EVALUATION" ||
      rawStatus === "TECHNICAL_EVALUATION_COMPLETED" ||
      rawStatus === "L1_GENERATED" ||
      rawStatus === "NEGOTIATION"
    ) {
      return "Under Evaluation";
    }

    // 3. Proposals received
    if (count > 0) {
      if (isDeadlinePassed || rawStatus === "CLOSED") {
        return `${count} Received (Under Review)`;
      }
      return `${count} ${count === 1 ? (isRfqType ? "Quotation" : "Proposal") : isRfqType ? "Quotations" : "Proposals"} Received`;
    }

    // 4. No proposals received
    if (isDeadlinePassed || rawStatus === "CLOSED" || rawStatus === "EXPIRED") {
      return isRfqType ? "No Quotations Received" : "No Proposals Received";
    }
    if (rawStatus === "CANCELLED") {
      return "Cancelled";
    }

    // 5. Open / active awaiting submissions
    return isRfqType ? "Awaiting Quotations" : "Awaiting Proposals";
  }, [
    currentUser?.role,
    isBuyerSide,
    isSellerParticipated,
    isAwardedToMe,
    activeAward,
    effectiveActiveOrder,
    isBeforeSubmissionStart,
    isBiddingClosed,
    isDeadlinePassed,
    props.status,
    props.participantsCount,
    submittedParticipations,
    props.deadlineDate,
    nowMs,
    isRfqType,
  ]);

  const buyerContactPerson =
    contactPerson && contactPerson !== "N/A" && contactPerson !== "—"
      ? contactPerson
      : buyerOrgName !== "N/A"
        ? buyerOrgName
        : "Procurement Officer";
  const buyerPhoneNum =
    phone && phone !== "N/A" && phone !== "—"
      ? phone
      : props.buyerMobile && props.buyerMobile !== "N/A"
        ? props.buyerMobile
        : "";

  const summaryCards = [
    {
      label: "Status",
      value:
        !isBuyerSide && currentUser?.role === "seller"
          ? proposalStatusDisplay
          : statusLabel,
      icon: ShieldCheck,
      tone: (!isBuyerSide && currentUser?.role === "seller"
        ? isSellerParticipated
          ? isAwardedToMe
            ? "emerald"
            : "sky"
          : isBeforeSubmissionStart
            ? "sky"
            : isBiddingClosed || isDeadlinePassed
              ? "slate"
              : "amber"
        : "slate") as Tone,
      subtext:
        !isBuyerSide && currentUser?.role === "seller"
          ? isSellerParticipated
            ? isAwardedToMe
              ? "Contract won"
              : isBiddingClosed || isDeadlinePassed
                ? "Quotation under evaluation"
                : "Bid received on time"
            : isBeforeSubmissionStart
              ? "Submission opens soon"
              : isBiddingClosed || isDeadlinePassed
                ? "Missed cutoff deadline"
                : "Accepting proposals"
          : "Current lifecycle state",
    },
    {
      label: "Submission Deadline",
      value: closingDateFormatted || "N/A",
      icon: Clock,
      tone: "rose" as Tone,
      subtext: allowsReverseAuction
        ? "Stage 1 initial quotation cutoff"
        : "Bidding window closing",
    },
    shouldShowEstimatedCost
      ? {
          label: "Estimated Value",
          value: formatCurrency(props.estimatedValue),
          icon: IndianRupee,
          tone: "emerald" as Tone,
          subtext: "Total budget estimate",
        }
      : {
          label: "Estimated Value",
          value: (
            <span className="inline-flex items-center gap-1.5 text-slate-700 font-bold">
              <span>Confidential</span>
              <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </span>
          ),
          icon: Lock,
          tone: "slate" as Tone,
          subtext: "(sealed)",
        },
    {
      label: "Buyer Contact",
      value: formatPrimitiveValue(buyerContactPerson, "buyerContact"),
      icon: PhoneCall,
      tone: "amber" as Tone,
      subtext: buyerPhoneNum || "Procurement officer",
    },
    {
      label: "Evaluation",
      value: formatPrimitiveValue(evaluationMethod, "evaluationMethod"),
      icon: ClipboardCheck,
      tone: "violet" as Tone,
      subtext: "Selection criteria",
    },
    ...(isBuyerOrAdmin
      ? [
          {
            label: "Responses",
            value: Math.max(
              props.participantsCount || 0,
              submittedParticipations.length,
            ).toLocaleString("en-IN"),
            icon: Users,
            tone: "sky" as Tone,
            subtext: isRfqType ? "Quotations submitted" : "Proposals submitted",
          },
        ]
      : []),
  ];

  const tabs = [
    { id: "overview", label: "Overview & Dates", icon: ClipboardList },
    {
      id: "scope_docs",
      label: "Scope & Documents",
      icon: FileText,
      count: documents.length,
    },
    { id: "terms_schedule", label: "Terms & Schedule", icon: CalendarDays },
    {
      id: "evaluation",
      label: isBuyerSide ? "Evaluation & Controls" : "Evaluation Criteria",
      icon: ClipboardCheck,
    },
    {
      id: "clarifications",
      label: isBuyerOrAdmin
        ? isTwoPacketMode
          ? "Proposals & Evaluation"
          : isRfqType
            ? "Quotations & Evaluation"
            : "Proposals & Evaluation"
        : isClarificationAllowed
          ? isRfqType
            ? "Clarifications & Quotations"
            : "Clarifications & Proposals"
          : isRfqType
            ? "Quotations"
            : "Proposals",
      icon: isBuyerOrAdmin
        ? ShieldCheck
        : isClarificationAllowed
          ? MessageSquare
          : ClipboardList,
      count: isBuyerOrAdmin
        ? techEvaluationStats.pending > 0
          ? techEvaluationStats.pending
          : submittedParticipations.length
        : (isClarificationAllowed ? props.totalClarifications || 0 : 0) +
          (submittedParticipations.length || 0),
    },
  ];

  const defaultSubmitBtnLabel = props.hasSubmittedProposal
    ? props.procurementType === "RFQ"
      ? "Quotation Submitted"
      : props.procurementType === "RATE_CONTRACT"
        ? "Rate Quotation Submitted"
        : "Proposal Submitted"
    : props.procurementType === "RFQ"
      ? "Submit Quotation"
      : props.procurementType === "RATE_CONTRACT"
        ? "Submit Rate Quote"
        : "Submit Proposal";

  const handleDefaultPdfDownload = async () => {
    try {
      toast.info(`Generating ${procurementTypeLabel} PDF…`);
      const buyerReg =
        (props.buyer?.registrationDetails as Record<string, any>) || {};
      const buyerLogo =
        props.buyer?.organization?.profile?.logoUrl ||
        buyerReg.logoUrl ||
        props.buyer?.organization?.logoFile?.url ||
        props.buyer?.organization?.logoFile?.fileUrl ||
        (props.buyer?.organization?.organizationLogoFileId
          ? `/api/files/${props.buyer.organization.organizationLogoFileId}/view`
          : null) ||
        (props.buyer?.organization?.organizationLogoFileId
          ? `/api/files/${props.buyer.organization.organizationLogoFileId}/download`
          : null);

      const engine = new PdfEngine("p");
      const doc = await engine.generate({
        documentTitle: `${procurementTypeLabel.toUpperCase()} PROCUREMENT DETAILS`,
        documentNumber: displayIdStr,
        dateStr: publishedDateFormatted || "N/A",
        status: statusLabel,
        issuerName:
          buyerOrgName !== "N/A" ? buyerOrgName : "Enterprise Procurement",
        issuerSubtitle: `${procurementTypeLabel.toUpperCase()} Notice`,
        issuerLogo: buyerLogo,
        parties: [
          {
            title: "BUYER ORGANIZATION",
            name: buyerOrgName !== "N/A" ? buyerOrgName : "Verified Buyer",
            address: deliveryLocation !== "N/A" ? deliveryLocation : "N/A",
            email: props.buyer?.email || buyerReg.email || "N/A",
            phone:
              props.buyer?.mobile ||
              props.buyer?.phone ||
              buyerReg.mobile ||
              "N/A",
            gstin: props.buyer?.organization?.gstin || buyerReg.gstin || "N/A",
            details: [
              `Contact: ${contactPerson !== "N/A" ? contactPerson : "Procurement Officer"}`,
              `Category: ${category !== "N/A" ? category : "General"}`,
            ],
          },
          {
            title: procurementTypeLabel.toUpperCase(),
            name: resolvedSubject,
            details: [
              `Method: ${procurementMethod}`,
              `Deadline: ${closingDateFormatted}`,
              `Estimated Value: ${shouldShowEstimatedCost ? moneyPdf(props.estimatedValue) : "Confidential (Competitive Bidding)"}`,
            ],
          },
        ],
        infoGrid: {
          "Delivery Location": deliveryLocation,
          "Payment Terms":
            paymentTerms !== "N/A" ? paymentTerms : "As per procurement rules",
          "Delivery SLA": props.deliveryTerms || "Standard Delivery SLA",
          "Evaluation Method": evaluationMethod,
        },
        tableHeaders: [
          "#",
          "Item / Scope Description",
          "Qty",
          "Unit",
          "Estimated Price",
          "GST %",
        ],
        tableData: lineItems.map((it: any, i: number) => [
          String(i + 1),
          it.itemName || it.name || it.description || `Item ${i + 1}`,
          String(it.quantity || it.qty || 1),
          it.unit || "Units",
          shouldShowEstimatedCost
            ? it.estimatedPrice || it.unitPrice || it.price
              ? moneyPdf(it.estimatedPrice || it.unitPrice || it.price)
              : "N/A"
            : "Confidential",
          it.gstRate || it.gst ? `${it.gstRate || it.gst}%` : "Standard",
        ]),
        financials: shouldShowEstimatedCost
          ? { grandTotal: Number(props.estimatedValue || 0) }
          : undefined,
        terms: [
          `Payment Terms: ${paymentTerms}`,
          `Delivery Terms: ${props.deliveryTerms || "Standard"}`,
          `Evaluation Method: ${evaluationMethod}`,
        ],
        footerNote: "MSME Enterprise Unified Sourcing & Procurement Portal",
      });
      doc.save(
        `${displayIdStr.replace(/[^a-zA-Z0-9-]/g, "_")}-${procurementTypeLabel.replace(/\s+/g, "_")}.pdf`,
      );
      toast.success(`${procurementTypeLabel} PDF downloaded.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF.");
    }
  };

  const isPreBidConfigured = Boolean(
    preBidDateFormatted ||
    schedule.preBidMeeting === true ||
    schedule.preBidMeeting === "true" ||
    schedule.preBidMeeting === "Yes" ||
    (schedule.preBidMeetingDate &&
      schedule.preBidMeetingDate !== "—" &&
      schedule.preBidMeetingDate !== "N/A"),
  );

  const rawFreightVal = firstPresent(
    props.freightIncluded,
    terms.freightIncluded,
    payload.freightIncluded,
    rules.freightIncluded,
    true,
  );
  const isFreightIncluded =
    rawFreightVal === true ||
    rawFreightVal === "true" ||
    rawFreightVal === "Yes" ||
    rawFreightVal === 1 ||
    rawFreightVal === "1";

  return (
    <BuyerSideContext.Provider
      value={{
        isBuyer: isBuyerSide,
        isOpenTender: isBuyerOpenTender,
        isLimitedTender: isBuyerLimitedTender,
        shouldShowEstimatedCost,
      }}
    >
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-2.5 px-3 py-2 sm:px-6 sm:py-3 lg:px-8">
          {/* Navigation Breadcrumb & Back Button */}
          <div className="flex flex-wrap items-center gap-3">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                onClick={() => {
                  if (props.onBack) props.onBack();
                  else router.push(props.backRoute || "/seller/opportunities");
                }}
                className="h-7 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 transition-colors"
              >
                <ArrowLeft
                  className="h-3 w-3 text-slate-400"
                  aria-hidden="true"
                />
                <span>
                  {props.backRouteLabel ||
                    `${procurementTypeLabel} Opportunities`}
                </span>
              </button>
            </nav>
          </div>

          {/* Unified 5-Stage Procurement Lifecycle Progression Bar */}
          <ProcurementLifecycleStepper
            status={props.rawBid?.status || props.status}
            lifecycleStage={
              props.rawBid?.lifecycleStage || props.lifecycleStage
            }
            awards={rawAwards}
            activeAward={activeAward}
            purchaseOrders={rawOrders}
            activeOrder={effectiveActiveOrder}
            hasApprovedGrn={Boolean(
              effectiveActiveOrder?.grns?.some(
                (g: any) => String(g.status || "").toUpperCase() === "APPROVED",
              ),
            )}
            invoices={
              effectiveActiveOrder?.invoices || props.rawBid?.invoices || []
            }
            isBuyer={isBuyerSide}
            isStandby={
              !isBuyerSide &&
              currentUser?.role === "seller" &&
              !isAwardedToMe &&
              Boolean(activeAward && !effectiveActiveOrder)
            }
            isSellerParticipated={isSellerParticipated}
            myParticipation={effectiveMyParticipation}
            canSubmitBid={
              !isSellerParticipated &&
              !isBiddingClosed &&
              !isDeadlinePassed &&
              !isBeforeSubmissionStart
            }
            submittedBidsCount={Math.max(
              props.participantsCount || 0,
              submittedParticipations.length,
            )}
            onSubmitClick={props.onSubmitClick}
            onViewQuotationClick={handleOpenMyQuotationModal}
            onViewEvaluation={() => {
              setActiveTab(isBuyerSide ? "evaluation" : "clarifications");
              const targetEl =
                document.getElementById("tabs-navigation-section") ||
                document.getElementById("tabpanel-clarifications") ||
                document.getElementById("tabpanel-evaluation");
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            onViewPO={() => {
              if (effectiveActiveOrder) {
                setIsReceiptModalOpen(true);
              } else if (isBuyerSide) {
                router.push("/buyer/orders");
              } else {
                router.push("/seller/orders");
              }
            }}
            onNavigateDelivery={() => {
              const poNum = effectiveActiveOrder?.poNumber || effectiveActiveOrder?.id;
              const searchParam = poNum ? `?search=${encodeURIComponent(poNum)}` : '';
              if (isBuyerSide) {
                router.push(`/buyer/grn${searchParam}`);
              } else {
                router.push(`/seller/delivery-management${searchParam}`);
              }
            }}
            onNavigateInvoice={() => {
              const allInvoices = [
                ...(Array.isArray(effectiveActiveOrder?.invoices) ? effectiveActiveOrder.invoices : []),
                ...(Array.isArray(props.rawBid?.invoices) ? props.rawBid.invoices : [])
              ];
              const existingInv = allInvoices.find(
                (inv: any) => !['CANCELLED', 'DRAFT'].includes(String(inv.status || inv.invoiceStatus || '').toUpperCase())
              );
              if (existingInv) {
                const invNo = existingInv.invoiceNumber || existingInv.id;
                const invParam = invNo ? `?viewInvoiceNo=${encodeURIComponent(invNo)}` : '';
                router.push(isBuyerSide ? `/buyer/invoices${invParam}` : `/seller/invoices${invParam}`);
              } else if (isBuyerSide) {
                router.push("/buyer/invoices");
              } else {
                const amountVal =
                  effectiveActiveOrder?.amount ||
                  effectiveActiveOrder?.totalValue ||
                  activeAward?.finalAmount ||
                  0;
                if (effectiveActiveOrder?.id) {
                  router.push(
                    `/seller/invoices?convertPoId=${effectiveActiveOrder.id}&amount=${amountVal}`,
                  );
                } else {
                  router.push("/seller/invoices");
                }
              }
            }}
            onNavigateSettlement={() => {
              const poNum = effectiveActiveOrder?.poNumber || effectiveActiveOrder?.id;
              const searchParam = poNum ? `?search=${encodeURIComponent(poNum)}` : '';
              if (isBuyerSide) {
                router.push(`/buyer/payments${searchParam}`);
              } else {
                router.push(`/seller/invoices${searchParam}`);
              }
            }}
          />

          {!currentUser && (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-black text-amber-950">
                    Login required for participation
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-amber-800">
                    Sellers can login to submit or view their response.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
                }
                className="shrink-0 bg-slate-950 text-white hover:bg-slate-800 text-xs"
              >
                Login
              </Button>
            </div>
          )}

          {/* Live/Scheduled Reverse Auction Banner for Sellers */}
          {!isBuyerSide &&
            linkedAuction &&
            !(linkedAuction as any).auctionPlanned &&
            allowsReverseAuction &&
            ["LIVE", "SCHEDULED"].includes(
              String(
                linkedAuction.statusEnum || linkedAuction.status || "",
              ).toUpperCase(),
            ) && (
              <SellerLiveAuctionBanner
                auctionId={linkedAuction.id}
                procurementTitle={resolvedSubject}
                procurementReference={displayIdStr}
                onBidSubmitted={() => {
                  linkedAuctionQuery.refetch();
                  if (props.onAuctionBidSubmitted)
                    props.onAuctionBidSubmitted();
                }}
              />
            )}

          {/* Seller Auction Actions / Status Notices */}
          {!isBuyerSide && props.sellerAuctionActions}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ENTERPRISE BID LIFECYCLE HERO ACTION BANNER                     */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {/* Buyer: Award Offered to Seller, Waiting for Acceptance */}
          {isBuyerSide &&
            activeAward &&
            activeAward.awardStatus === "OFFERED" &&
            activeAward.counterOfferStatus !== "PENDING" && (
              <div className="relative overflow-hidden rounded-xl border border-amber-400 bg-gradient-to-r from-amber-600 via-orange-600 to-slate-900 p-3 sm:p-4 text-white shadow-md animate-fadeIn">
                <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-black/30 border border-white/20 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-amber-200">
                      <Clock className="h-3 w-3 text-amber-300" />
                      Contract Award Offered — Awaiting Vendor Acceptance
                    </div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Award Offered to{" "}
                      {activeAward.sellerName ||
                        activeAward.seller?.name ||
                        activeAward.awardedSellerName ||
                        activeAward.sellerOrganization?.name ||
                        "Selected Supplier"}
                    </h3>
                    <p className="text-xs font-medium text-amber-100 max-w-2xl">
                      The formal contract award has been offered for ₹
                      {Number(
                        activeAward.finalAmount ||
                          activeAward.awardAmount ||
                          activeAward.originalBidAmount ||
                          0,
                      ).toLocaleString("en-IN")}
                      . Waiting for supplier acceptance before Purchase Order
                      generation can be unlocked. Participating bidders remain
                      safely under review on standby.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setActiveTab("evaluation")}
                      className="h-8.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs px-3.5 border border-white/30 cursor-pointer rounded-lg"
                    >
                      View Evaluation Details
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Seller: Purchase Order Received — Accept PO & Commit Delivery */}
          {!isBuyerSide &&
            isAwardedToMe &&
            effectiveActiveOrder &&
            !isPOAccepted && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-950 p-5 text-white shadow-xl animate-fadeIn">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-300">
                      <Truck className="h-3.5 w-3.5" />
                      Official Purchase Order Issued
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-white">
                      Purchase Order Received (PO #
                      {effectiveActiveOrder.poNumber || effectiveActiveOrder.id}
                      )
                    </h3>
                    <p className="text-sm font-medium text-emerald-100 max-w-2xl">
                      The Buyer has officially generated and released Purchase
                      Order #
                      {effectiveActiveOrder.poNumber || effectiveActiveOrder.id}{" "}
                      for ₹
                      {Number(
                        effectiveActiveOrder.amount ||
                          effectiveActiveOrder.totalValue ||
                          activeAward?.finalAmount ||
                          0,
                      ).toLocaleString("en-IN")}
                      . Please accept the order to commit your delivery timeline
                      and unlock fulfillment dispatch.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Button
                      type="button"
                      disabled={isAcceptingPO}
                      onClick={() => handleAcceptPO(effectiveActiveOrder.id)}
                      className="h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm px-6 shadow-xl border border-emerald-300 gap-2 cursor-pointer transition-transform active:scale-95"
                    >
                      {isAcceptingPO ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-slate-950" />
                      )}
                      Accept PO &amp; Commit Delivery
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Seller: Purchase Order Accepted — Fulfillment Committed */}
          {!isBuyerSide &&
            isAwardedToMe &&
            effectiveActiveOrder &&
            isPOAccepted && (
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white p-3 sm:p-3.5 shadow-2xs transition-all animate-fadeIn">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Purchase Order Accepted &amp; Committed
                        </span>
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10.5px] font-mono font-bold text-slate-700 shadow-2xs">
                          PO #{effectiveActiveOrder.poNumber || effectiveActiveOrder.id}
                        </span>
                      </div>
                      <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight">
                        Order Confirmed — Delivery Stage Active
                      </h3>
                      <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                        You have formally accepted Purchase Order #{effectiveActiveOrder.poNumber || effectiveActiveOrder.id} for{" "}
                        <strong className="text-emerald-700 font-bold">
                          ₹{Number(
                            effectiveActiveOrder.amount ||
                              effectiveActiveOrder.totalValue ||
                              activeAward?.finalAmount ||
                              0,
                          ).toLocaleString("en-IN")}
                        </strong>
                        . Your delivery commitment has been recorded. Dispatch goods, track shipment, and upload delivery challan for buyer GRN inspection.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-emerald-100">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsReceiptModalOpen(true)}
                      className="h-8 px-3 gap-1.5 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs rounded-lg cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 mr-0.5 text-slate-500" />
                      View PO Copy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const amountVal = effectiveActiveOrder.amount || effectiveActiveOrder.totalValue || activeAward?.finalAmount || 0;
                        router.push(`/seller/invoices?convertPoId=${effectiveActiveOrder.id}&amount=${amountVal}`);
                      }}
                      className="h-8 px-3 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs rounded-lg cursor-pointer transition-transform active:scale-95"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Create Invoice from PO
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => router.push("/seller/delivery-management")}
                      className="h-8 px-3 gap-1.5 text-xs font-bold bg-[#12335f] hover:bg-[#0b2445] text-white shadow-2xs rounded-lg cursor-pointer transition-transform active:scale-95"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      Go to Delivery Management
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Seller: Price-Match Counter-Offer Received */}
          {!isBuyerSide &&
            isAwardedToMe &&
            activeAward?.counterOfferStatus === "PENDING" && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 p-5 text-white shadow-xl animate-fadeIn">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-xs">
                      <Target className="h-3.5 w-3.5 text-amber-200" />
                      Price Match Counter-Offer Extended
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-white">
                      The Buyer has requested a Price-Match Counter-Offer
                    </h3>
                    <p className="text-sm font-medium text-amber-100 max-w-2xl">
                      You are invited to match the lowest qualified commercial
                      bid (L1) at{" "}
                      <strong className="text-white underline font-black">
                        ₹
                        {Number(
                          activeAward.priceMatchTargetPrice || 0,
                        ).toLocaleString("en-IN")}
                      </strong>{" "}
                      {activeAward.originalBidAmount && (
                        <span className="text-xs text-amber-200">
                          (Your initial quote: ₹
                          {Number(activeAward.originalBidAmount).toLocaleString(
                            "en-IN",
                          )}
                          )
                        </span>
                      )}
                      . Accepting secures the 100% single-supplier contract
                      allocation.
                    </p>
                    {activeAward.counterOfferDeadline && (
                      <div className="flex items-center gap-2 pt-1 text-xs font-bold text-amber-200">
                        <Clock className="h-4 w-4 shrink-0" />
                        Response Deadline:{" "}
                        <span className="rounded bg-black/30 px-2 py-0.5 font-mono font-black text-white">
                          {formatDateTime(activeAward.counterOfferDeadline)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Button
                      type="button"
                      disabled={isAcceptingAction}
                      onClick={() => handleAcceptPriceMatch(activeAward.id)}
                      className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-6 shadow-lg border border-emerald-400 gap-2 cursor-pointer transition-transform active:scale-95"
                    >
                      {isAcceptingAction ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Accept Price Match
                    </Button>
                    <Button
                      type="button"
                      disabled={isAcceptingAction}
                      onClick={() =>
                        setDeclineModal({
                          show: true,
                          awardId: activeAward.id,
                          type: "price_match",
                          reason: "",
                          submitting: false,
                        })
                      }
                      className="h-11 bg-black/30 hover:bg-black/50 text-white font-bold text-sm px-5 border border-white/30 gap-2 cursor-pointer"
                    >
                      <XCircle className="h-4 w-4" />
                      Decline Counter-Offer
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Seller: Award Offered (Ready for Acceptance) */}
          {!isBuyerSide &&
            isAwardedToMe &&
            Boolean(activeAward) &&
            ["OFFERED", "RECOMMENDED", "ADMIN_APPROVED"].includes(
              String(activeAward?.awardStatus || "").toUpperCase(),
            ) &&
            activeAward?.counterOfferStatus !== "PENDING" && (
              <div className="relative overflow-hidden rounded-xl border border-emerald-400 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#12335f] p-3 sm:p-4 text-white shadow-md animate-fadeIn">
                <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider backdrop-blur-xs">
                      <Trophy className="h-3 w-3 text-amber-300" />
                      Bid Award Offered
                    </div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Congratulations! Your Organization has been Awarded the
                      Contract
                    </h3>
                    <p className="text-xs font-medium text-emerald-100 max-w-2xl">
                      The Buyer has recommended and awarded this tender to your
                      organization. Please formally accept the award to initiate
                      official Purchase Order issuance.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <Button
                      type="button"
                      disabled={isAcceptingAction}
                      onClick={() =>
                        handleAcceptAward(String(activeAward?.id || ""))
                      }
                      className="h-9 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs px-4 shadow-sm gap-1.5 rounded-lg cursor-pointer transition-transform active:scale-95"
                      aria-label="Formally accept contract award"
                    >
                      {isAcceptingAction ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin text-emerald-600"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-emerald-600"
                          aria-hidden="true"
                        />
                      )}
                      Formally Accept Award
                    </Button>
                    <Button
                      type="button"
                      disabled={isAcceptingAction}
                      onClick={() =>
                        setDeclineModal({
                          show: true,
                          awardId: String(activeAward?.id || ""),
                          type: "award",
                          reason: "",
                          submitting: false,
                        })
                      }
                      className="h-9 bg-black/30 hover:bg-black/50 text-white font-bold text-xs px-3.5 border border-white/30 gap-1.5 rounded-lg cursor-pointer"
                      aria-label="Decline contract award"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Decline Award
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Seller: Award Accepted, Waiting for PO */}
          {!isBuyerSide &&
            isAwardedToMe &&
            activeAward?.awardStatus === "ACCEPTED" &&
            !effectiveActiveOrder && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-2.5 sm:p-3 shadow-2xs animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-[13px] font-extrabold text-indigo-950 leading-tight">
                      Award Acceptance Confirmed — Awaiting Purchase Order
                      Issuance
                    </h4>
                    <p className="text-[11px] sm:text-xs font-medium text-indigo-800/90 mt-0.5 leading-snug">
                      You have accepted the award. The buyer is now finalizing
                      and issuing the official Purchase Order. You will receive
                      an immediate notification upon issuance.
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Seller: Participating Bidder on Standby */}
          {!isBuyerSide &&
            myParticipation &&
            !isAwardedToMe &&
            activeAward &&
            (activeAward.counterOfferStatus === "PENDING" ||
              activeAward.awardStatus === "OFFERED") && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 sm:p-3 shadow-2xs animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-[13px] font-extrabold text-blue-950 leading-tight">
                      Tender Under Final Award Evaluation (Backup Supplier
                      Standby)
                    </h4>
                    <p className="text-[11px] sm:text-xs font-medium text-blue-800/90 mt-0.5 leading-snug">
                      The buyer is actively finalizing award formalities. Your
                      proposal remains valid, responsive, and safely on standby
                      under evaluation. Final tender status will be updated upon
                      PO issuance.
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Buyer: Award Accepted — Ready to Issue PO */}
          {isBuyerSide &&
            activeAward &&
            activeAward.awardStatus === "ACCEPTED" &&
            !effectiveActiveOrder && (
              <div className="relative overflow-hidden rounded-xl border border-indigo-400 bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 p-3 sm:p-4 text-white shadow-md animate-fadeIn">
                <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-emerald-200">
                      <Award className="h-3 w-3 text-emerald-300" />
                      Supplier Accepted Bid Award
                    </div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Contract Ready for Purchase Order Generation
                    </h3>
                    <p className="text-xs font-medium text-slate-200 max-w-2xl">
                      The awarded supplier has formally accepted the award
                      terms. Generate and issue the Purchase Order to bind the
                      contract and automatically notify all participating
                      suppliers.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Button
                      type="button"
                      disabled={isIssuingPOFromBanner}
                      onClick={() => handleGeneratePOFromBanner(activeAward.id)}
                      className="h-9 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 shadow-md border border-emerald-300 gap-1.5 cursor-pointer rounded-lg transition-transform active:scale-95"
                    >
                      {isIssuingPOFromBanner ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      Generate &amp; Issue Purchase Order
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Buyer: Purchase Order Issued & Active */}
          {isBuyerSide &&
            activeAward &&
            effectiveActiveOrder && (
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white p-3 sm:p-3.5 shadow-2xs transition-all animate-fadeIn">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Purchase Order Issued &amp; Active
                        </span>
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10.5px] font-mono font-bold text-slate-700 shadow-2xs">
                          PO #{effectiveActiveOrder.poNumber || effectiveActiveOrder.id}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border",
                            isPOAccepted
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-amber-100 text-amber-800 border-amber-200",
                          )}
                        >
                          {poStatusBadgeText}
                        </span>
                      </div>
                      <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight">
                        {isPOAccepted
                          ? "Purchase Order Accepted — Fulfillment & Delivery Active"
                          : "Official Purchase Order Released — Contract Binding Enacted"}
                      </h3>
                      <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                        {isPOAccepted ? (
                          <>
                            Purchase Order #{effectiveActiveOrder.poNumber || effectiveActiveOrder.id} has been formally accepted by{" "}
                            <strong className="text-slate-900 font-bold">
                              {activeAward.sellerName ||
                                activeAward.seller?.name ||
                                activeAward.awardedSellerName ||
                                activeAward.sellerOrganization?.name ||
                                "Awarded Supplier"}
                            </strong>{" "}
                            for{" "}
                            <strong className="text-emerald-700 font-bold">
                              ₹{Number(
                                effectiveActiveOrder.amount ||
                                  effectiveActiveOrder.totalValue ||
                                  activeAward?.finalAmount ||
                                  0,
                              ).toLocaleString("en-IN")}
                            </strong>
                            . Order binding is established and fulfillment progress is actively tracked under Stage 3 (Delivery &amp; GRN).
                          </>
                        ) : (
                          <>
                            Purchase Order #{effectiveActiveOrder.poNumber || effectiveActiveOrder.id} has been formally issued to{" "}
                            <strong className="text-slate-900 font-bold">
                              {activeAward.sellerName ||
                                activeAward.seller?.name ||
                                activeAward.awardedSellerName ||
                                activeAward.sellerOrganization?.name ||
                                "Awarded Supplier"}
                            </strong>{" "}
                            for{" "}
                            <strong className="text-emerald-700 font-bold">
                              ₹{Number(
                                effectiveActiveOrder.amount ||
                                  effectiveActiveOrder.totalValue ||
                                  activeAward?.finalAmount ||
                                  0,
                              ).toLocaleString("en-IN")}
                            </strong>
                            . All participating bidders have been transitioned, and awaiting supplier acceptance &amp; commitment.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-emerald-100">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsReceiptModalOpen(true)}
                      className="h-8 px-3 gap-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs rounded-lg cursor-pointer transition-transform active:scale-95"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View Purchase Order
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/buyer/orders")}
                      className="h-8 px-3 gap-1.5 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs rounded-lg cursor-pointer"
                    >
                      <Truck className="h-3.5 w-3.5 mr-0.5 text-slate-500" />
                      Manage All Orders
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Buyer: Price Match Counter-Offer Pending */}
          {isBuyerSide &&
            activeAward &&
            activeAward.counterOfferStatus === "PENDING" && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 sm:p-3 shadow-2xs animate-fadeIn">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-[13px] font-extrabold text-amber-950 leading-tight">
                        Price-Match Counter-Offer Pending Supplier Response
                      </h4>
                      <p className="text-[11px] sm:text-xs font-medium text-amber-800 mt-0.5 leading-snug">
                        Target Price:{" "}
                        <strong className="text-amber-950">
                          ₹
                          {Number(
                            activeAward.priceMatchTargetPrice || 0,
                          ).toLocaleString("en-IN")}
                        </strong>{" "}
                        | Deadline:{" "}
                        <strong className="text-amber-950">
                          {activeAward.counterOfferDeadline
                            ? formatDateTime(activeAward.counterOfferDeadline)
                            : "Active"}
                        </strong>
                        . Other bidders remain safely on standby.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => router.push(`/bids/${targetId}/results`)}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 h-8 rounded-lg px-3"
                  >
                    View Bid Evaluation
                  </Button>
                </div>
              </div>
            )}

          {/* Decline Price Match or Award Modal */}
          {declineModal.show && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="decline-modal-title"
              aria-describedby="decline-modal-desc"
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn"
            >
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3
                    id="decline-modal-title"
                    className="text-base font-black text-slate-900 flex items-center gap-2"
                  >
                    <AlertCircle
                      className="h-5 w-5 text-rose-600"
                      aria-hidden="true"
                    />
                    {declineModal.type === "price_match"
                      ? "Decline Price-Match Counter-Offer"
                      : "Decline Contract Award"}
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setDeclineModal({
                        show: false,
                        awardId: "",
                        type: "price_match",
                        reason: "",
                        submitting: false,
                      })
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    aria-label="Close dialog"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <p
                  id="decline-modal-desc"
                  className="text-xs font-semibold text-slate-600 mt-3"
                >
                  {declineModal.type === "price_match"
                    ? "Please provide an explanation for declining this price-match counter-offer. The buyer will be notified and can award L1 or another vendor."
                    : "Please provide a reason for declining this contract award. The tender will be returned to the buyer for re-evaluation."}
                </p>
                <div className="mt-3">
                  <label
                    htmlFor="decline-modal-reason-input"
                    className="text-xs font-black text-slate-700 block mb-1"
                  >
                    Reason for Declining{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="decline-modal-reason-input"
                    rows={3}
                    value={declineModal.reason}
                    onChange={(e) =>
                      setDeclineModal((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    placeholder="e.g. Cannot meet target price due to raw material cost escalation..."
                    className="w-full rounded-xl border border-slate-300 p-3 text-xs font-medium text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none resize-none"
                    aria-required="true"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDeclineModal({
                        show: false,
                        awardId: "",
                        type: "price_match",
                        reason: "",
                        submitting: false,
                      })
                    }
                    className="text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      declineModal.submitting || !declineModal.reason.trim()
                    }
                    onClick={
                      declineModal.type === "price_match"
                        ? handleDeclinePriceMatchSubmit
                        : handleDeclineAwardSubmit
                    }
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black gap-1.5 cursor-pointer"
                  >
                    {declineModal.submitting ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Confirm Decline
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isReceiptModalOpen && effectiveActiveOrder && (
            <PurchaseOrderReceiptModal
              order={effectiveActiveOrder}
              onClose={() => setIsReceiptModalOpen(false)}
              isBuyer={isBuyerSide}
              isSeller={!isBuyerSide}
              onCreateInvoice={(o) => {
                setIsReceiptModalOpen(false);
                const amountVal = o.amount || (o as any).totalValue || 0;
                router.push(`/seller/invoices?convertPoId=${o.id}&amount=${amountVal}`);
              }}
              onManageDispatch={(o) => {
                setIsReceiptModalOpen(false);
                const poNum = o.poNumber || o.id;
                const targetRoute = isBuyerSide ? '/orders/tracking' : '/seller/delivery-management';
                router.push(`${targetRoute}?search=${encodeURIComponent(poNum)}`);
              }}
            />
          )}

          {isExtendScheduleOpen && (
            <ExtendScheduleModal
              isOpen={isExtendScheduleOpen}
              onClose={() => setIsExtendScheduleOpen(false)}
              bidId={props.id}
              bidTitle={resolvedSubject}
              bidNumber={props.displayId || String(props.id)}
              currentSchedule={{
                closingDate: closingDateValue || props.deadlineDate || props.closingDate,
                technicalOpeningDate: technicalDateValue || props.technicalDate || props.technicalOpeningDate,
                financialOpeningDate: financialDateValue || props.financialDate || props.financialOpeningDate,
                requiredByDate: requiredByDateValue || props.requiredByDate || props.requiredBy,
                bidValidityDate: bidValidityDateComputed || bidValidityDateValue || props.bidValidityDate,
                validityDays: rawValidityDays || props.validityDays,
              }}
              onSuccess={() => {
                queryClient.invalidateQueries();
              }}
            />
          )}

          {/* Buyer: Award Contract Confirmation Modal */}
          {awardingParticipation && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="award-modal-title"
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn"
            >
              <FocusTrap>
                <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <h3
                          id="award-modal-title"
                          className="text-base font-black text-slate-900"
                        >
                          Award Tender Contract
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          Offer contract award to chosen qualified supplier
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAwardingParticipation(null)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      aria-label="Close award modal"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3.5">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Vendor
                        </span>
                        <span className="font-black text-slate-900">
                          {awardingParticipation.sellerOrgName ||
                            awardingParticipation.companyName ||
                            awardingParticipation.sellerName ||
                            "Supplier"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Quoted Amount
                        </span>
                        <span className="font-black text-slate-900 text-sm">
                          ₹
                          {Number(
                            awardingParticipation.totalAmount ||
                              awardingParticipation.quotedAmount ||
                              0,
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Ranking
                        </span>
                        <span>
                          {String(awardingParticipation.id) ===
                          String(lowestQualifiedL1ParticipationId) ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" /> L1 Lowest
                              Compliant Bidder
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800">
                              Non-L1 Qualified Bidder
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {String(awardingParticipation.id) !==
                      String(lowestQualifiedL1ParticipationId) && (
                      <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-black text-amber-950">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          Non-L1 Justification Required (GFR 173 Compliance)
                        </div>
                        <p className="text-[11.5px] leading-relaxed text-amber-800">
                          Under public procurement standards, awarding to a
                          bidder other than L1 requires an explicit committee
                          justification (e.g. delivery feasibility, technical
                          superiority, or past performance).
                        </p>
                      </div>
                    )}

                    {String(awardingParticipation.id) !==
                      String(lowestQualifiedL1ParticipationId) && (
                      <div>
                        <label
                          htmlFor="award-justification"
                          className="text-xs font-black text-slate-700 block mb-1"
                        >
                          Justification for Non-L1 Selection{" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          id="award-justification"
                          rows={3}
                          value={awardJustification}
                          onChange={(e) =>
                            setAwardJustification(e.target.value)
                          }
                          placeholder="State clear official rationale for selecting this vendor over lower commercial bids..."
                          className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="award-remarks"
                        className="text-xs font-black text-slate-700 block mb-1"
                      >
                        Award Remarks / Notes (Optional)
                      </label>
                      <textarea
                        id="award-remarks"
                        rows={2}
                        value={awardRemarks}
                        onChange={(e) => setAwardRemarks(e.target.value)}
                        placeholder="Internal committee notes or specific terms to be communicated..."
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAwardingParticipation(null)}
                      className="text-xs font-bold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        isSubmittingAward ||
                        (String(awardingParticipation.id) !==
                          String(lowestQualifiedL1ParticipationId) &&
                          !awardJustification.trim())
                      }
                      onClick={handleConfirmAwardSubmit}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black gap-1.5 cursor-pointer shadow-sm"
                    >
                      {isSubmittingAward ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Confirm &amp; Offer Contract Award
                    </Button>
                  </div>
                </div>
              </FocusTrap>
            </div>
          )}

          {/* Header */}
          <header className="rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={effectiveStatusLabel} />
                  {isTwoStageReverseAuction && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                      <Layers className="h-3 w-3" aria-hidden="true" />
                      Two-Stage Tender + Reverse Auction
                    </span>
                  )}
                  {isDirectReverseAuction && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                      <Gavel className="h-3 w-3" aria-hidden="true" />
                      Direct Reverse Auction
                    </span>
                  )}
                  {(props.deadlineDate || closingDateValue) && (
                    <DeadlineCountdown
                      targetDate={props.deadlineDate || closingDateValue || ""}
                      startDate={rawSubmissionStartDate}
                      startLabel="Submission Opens in: "
                      label={
                        allowsReverseAuction
                          ? "Stage 1 Quote Due: "
                          : "Quote Due: "
                      }
                    />
                  )}
                  {!isBuyerSide && currentUser?.role === "seller" ? (
                    isSellerParticipated ? (
                      isAwardedToMe ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 shadow-2xs">
                          <Award
                            className="h-3 w-3 text-emerald-600"
                            aria-hidden="true"
                          />
                          Contract Awarded to You
                        </span>
                      ) : activeAward && !effectiveActiveOrder ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-900 shadow-2xs">
                          <Clock
                            className="h-3 w-3 text-sky-700"
                            aria-hidden="true"
                          />
                          Standby Vendor • Reserve List
                        </span>
                      ) : isBiddingClosed || isDeadlinePassed ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 shadow-2xs">
                          <ShieldCheck
                            className="h-3 w-3 text-emerald-600"
                            aria-hidden="true"
                          />
                          Submitted • Under Evaluation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 shadow-2xs">
                          <CheckCircle2
                            className="h-3 w-3 text-emerald-600"
                            aria-hidden="true"
                          />
                          {props.procurementType === "RFQ"
                            ? "Quotation Submitted"
                            : "Proposal Submitted"}
                        </span>
                      )
                    ) : isBeforeSubmissionStart ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-900 shadow-2xs">
                        <Clock
                          className="h-3 w-3 text-sky-700"
                          aria-hidden="true"
                        />
                        Submission Opens Soon
                      </span>
                    ) : isBiddingClosed || isDeadlinePassed ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-800 shadow-2xs">
                        <Lock
                          className="h-3 w-3 text-rose-600"
                          aria-hidden="true"
                        />
                        Submission Window Closed (Missed Deadline)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 shadow-2xs">
                        <Clock
                          className="h-3 w-3 text-amber-600"
                          aria-hidden="true"
                        />
                        Awaiting Your Quotation
                      </span>
                    )
                  ) : (
                    props.hasSubmittedProposal && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        <ShieldCheck
                          className="h-3 w-3 text-emerald-600"
                          aria-hidden="true"
                        />
                        {props.procurementType === "RFQ"
                          ? "Quotation Submitted"
                          : "Proposal Submitted"}
                      </span>
                    )
                  )}
                </div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 break-words leading-snug">
                  {resolvedSubject}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500 tracking-normal">
                  {/* Requisition ID badge */}
                  {displayIdStr &&
                    displayIdStr !== "N/A" &&
                    displayIdStr !== "—" && (
                      <>
                        <span className="rounded px-1.5 py-0.5 font-mono text-slate-700 text-[10.5px] font-bold bg-slate-100 border border-slate-200/60">
                          {displayIdStr}
                        </span>
                        <span>•</span>
                      </>
                    )}
                  <span>
                    {formatPrimitiveValue(
                      procurementMethod,
                      "procurementMethod",
                    )}
                  </span>
                  {category !== "N/A" && (
                    <>
                      <span>•</span>
                      <span>{formatPrimitiveValue(category, "category")}</span>
                    </>
                  )}
                  {buyerOrgName && buyerOrgName !== "N/A" && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Building2
                          className="h-3.5 w-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        <span>
                          Published by{" "}
                          <strong className="font-semibold text-slate-800">
                            {formatPrimitiveValue(buyerOrgName, "organization")}
                          </strong>
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 lg:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (props.onDownloadClick) {
                      props.onDownloadClick();
                    } else {
                      handleDefaultPdfDownload();
                    }
                  }}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs gap-1.5 flex items-center cursor-pointer transition-all active:scale-95"
                >
                  <Download
                    className="h-3.5 w-3.5 text-slate-600"
                    aria-hidden="true"
                  />
                  Download
                </Button>
                {props.invoiceStatus &&
                  (props.invoiceStatus.exists ? (
                    <Button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/seller/invoices/${props.invoiceStatus!.invoiceId}`,
                        )
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 h-8 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Eye className="h-3.5 w-3.5 mr-0.5" aria-hidden="true" />
                      View Invoice
                    </Button>
                  ) : props.invoiceStatus.canConvertToInvoice &&
                    props.onConvertToInvoiceClick ? (
                    <Button
                      type="button"
                      disabled={
                        props.isConvertingInvoice || props.invoiceStatus.loading
                      }
                      onClick={props.onConvertToInvoiceClick}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 h-8 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      {props.isConvertingInvoice ? (
                        <Loader2
                          className="h-3.5 w-3.5 mr-0.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <FileText
                          className="h-3.5 w-3.5 mr-0.5"
                          aria-hidden="true"
                        />
                      )}
                      {props.isConvertingInvoice
                        ? "Converting..."
                        : "Convert to Invoice"}
                    </Button>
                  ) : null)}
                {props.onDiscardClick && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={props.onDiscardClick}
                    className="h-8 px-3 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 text-xs font-semibold rounded-lg transition-all active:scale-95 cursor-pointer shadow-2xs gap-1.5 flex items-center"
                  >
                    <Trash2
                      className="h-3 w-3 text-rose-600"
                      aria-hidden="true"
                    />
                    Discard Draft
                  </Button>
                )}
                {isBuyerOrAdmin && props.buyerAuctionActions}
                {canExtendSchedule && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsExtendScheduleOpen(true)}
                    className="h-9 px-3.5 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-2xs gap-1.5 flex items-center"
                    aria-label="Extend tender schedule and submission deadline"
                  >
                    <CalendarDays
                      className="h-3.5 w-3.5 text-indigo-600"
                      aria-hidden="true"
                    />
                    Extend Schedule
                  </Button>
                )}
                {props.onCancelClick && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={props.onCancelClick}
                    className="h-9 px-3.5 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-2xs gap-1.5 flex items-center"
                  >
                    <Ban
                      className="h-3.5 w-3.5 text-rose-600"
                      aria-hidden="true"
                    />
                    {props.cancelButtonLabel || "Cancel Procurement"}
                  </Button>
                )}
                {!isBuyerOrAdmin && isSellerParticipated && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="View your submitted quotation"
                    onClick={() => {
                      if (
                        isReverseAuctionType &&
                        !isBiddingClosed &&
                        props.onSubmitClick
                      ) {
                        props.onSubmitClick();
                      } else {
                        handleOpenMyQuotationModal();
                      }
                    }}
                    className="h-8 px-3 text-xs font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs gap-1.5 flex items-center cursor-pointer transition-all active:scale-95"
                  >
                    <Eye
                      className="h-3.5 w-3.5 text-slate-600"
                      aria-hidden="true"
                    />
                    <span>
                      {isRfqType
                        ? "View My Quotation"
                        : isRateContractType
                          ? "View My Rate Proposal"
                          : isReverseAuctionType
                            ? isBiddingClosed
                              ? "View Auction Results"
                              : "Live Bid Console"
                            : "View My Proposal"}
                    </span>
                  </Button>
                )}
                {!isBuyerOrAdmin &&
                  !isSellerParticipated &&
                  isBeforeSubmissionStart && (
                    <Button
                      type="button"
                      size="sm"
                      disabled
                      aria-disabled="true"
                      title={`Submission opens on ${submissionStartDateFormatted || "the scheduled start date"}.`}
                      className="h-8 px-3.5 bg-sky-50 text-sky-800 border border-sky-200 font-bold text-xs rounded-lg cursor-not-allowed opacity-95 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Clock className="h-3.5 w-3.5 text-sky-600" />
                      <span>
                        Submission Opens{" "}
                        {submissionStartDateFormatted
                          ? `on ${submissionStartDateFormatted}`
                          : "Soon"}
                      </span>
                    </Button>
                  )}
                {!isBuyerOrAdmin &&
                  !isSellerParticipated &&
                  !isBeforeSubmissionStart &&
                  (isBiddingClosed || isDeadlinePassed) && (
                    <Button
                      type="button"
                      size="sm"
                      disabled
                      aria-disabled="true"
                      title={`The quotation submission deadline ended on ${closingDateFormatted || "the scheduled cutoff"}. New submissions are closed.`}
                      className="h-8 px-3.5 bg-slate-100 text-slate-500 border border-slate-200 font-bold text-xs rounded-lg cursor-not-allowed opacity-90 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Submission Window Closed</span>
                    </Button>
                  )}
                {isBuyerOrAdmin && !isEvaluationReady && (
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    aria-disabled="true"
                    title={`Quotations remain strictly sealed until the bidding window closes on ${displaySealedClosingDate}.`}
                    className="h-8 px-3.5 bg-slate-100 text-slate-500 border border-slate-200 font-bold text-xs rounded-lg cursor-not-allowed opacity-90 flex items-center gap-1.5 shadow-2xs"
                  >
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Evaluation Opens at Closing</span>
                  </Button>
                )}
                {props.onSubmitClick &&
                  (isBuyerOrAdmin
                    ? isEvaluationReady
                    : !props.hasSubmittedProposal &&
                      !isBiddingClosed &&
                      !isBeforeSubmissionStart) && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleActionSubmit}
                      className={cn(
                        "h-8 px-3.5 text-white text-xs font-bold rounded-lg bg-[#0b2447] hover:bg-[#12335f] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5",
                        isEmdGated ? "bg-amber-600 hover:bg-amber-700" : "",
                      )}
                    >
                      <span>
                        {isEmdGated
                          ? "Pay EMD to Submit"
                          : isBuyerOrAdmin && isBidAwarded
                            ? "View Awarded Results & Ranking"
                            : props.submitButtonLabel || defaultSubmitBtnLabel}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
              </div>
            </div>
          </header>

          {/* Reverse Auction Workflow Stepper (Two-Stage Tender vs Direct Reverse Auction) */}
          {!isRateContractType &&
            (isTwoStageReverseAuction ||
              isDirectReverseAuction ||
              linkedAuction) && (
              <AuctionWorkflowStepper
                isTwoStage={isTwoStageReverseAuction}
                auctionStatus={String(
                  linkedAuction?.statusEnum ||
                    linkedAuction?.status ||
                    props.status ||
                    "DRAFT",
                ).toUpperCase()}
                hasJoined={
                  props.hasSubmittedProposal ||
                  Boolean((linkedAuction as any)?.hasJoined)
                }
                evaluationPending={Boolean(
                  (linkedAuction as any)?.evaluationPending,
                )}
                startTime={
                  linkedAuction?.startTime ||
                  (props as any).submissionStartDate ||
                  null
                }
                endTime={linkedAuction?.endTime || props.deadlineDate || null}
                minDecrement={
                  linkedAuction?.minDecrementAmount
                    ? formatMoney(linkedAuction.minDecrementAmount)
                    : linkedAuction?.minDecrementPercent
                      ? `${linkedAuction.minDecrementPercent}%`
                      : undefined
                }
                rankVisibility={
                  linkedAuction?.rankVisibility
                    ? String(linkedAuction.rankVisibility)
                    : undefined
                }
              />
            )}

          {/* EMD Section commented out */}

          {/* Summary Metrics */}
          <section
            aria-label="Procurement Key Metrics"
            className={cn(
              "grid gap-1.5 sm:gap-2",
              summaryCards.length === 6
                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
            )}
          >
            {summaryCards.map((card) => (
              <MetricCard key={card.label} {...card} isBuyer={isBuyerSide} />
            ))}
          </section>

          {/* Tab Navigation Bar (WAI-ARIA Compliant) */}
          <div
            id="tabs-navigation-section"
            role="tablist"
            aria-label="Procurement details navigation"
            className="flex items-center gap-1 overflow-x-auto scrollbar-none rounded-xl border border-slate-200 bg-white p-1 shadow-2xs scroll-mt-6"
          >
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id as any)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      const nextIdx = (idx + 1) % tabs.length;
                      setActiveTab(tabs[nextIdx].id as any);
                      document
                        .getElementById(`tab-${tabs[nextIdx].id}`)
                        ?.focus();
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      const prevIdx = (idx - 1 + tabs.length) % tabs.length;
                      setActiveTab(tabs[prevIdx].id as any);
                      document
                        .getElementById(`tab-${tabs[prevIdx].id}`)
                        ?.focus();
                    } else if (e.key === "Home") {
                      e.preventDefault();
                      setActiveTab(tabs[0].id as any);
                      document.getElementById(`tab-${tabs[0].id}`)?.focus();
                    } else if (e.key === "End") {
                      e.preventDefault();
                      setActiveTab(tabs[tabs.length - 1].id as any);
                      document
                        .getElementById(`tab-${tabs[tabs.length - 1].id}`)
                        ?.focus();
                    }
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1",
                    isActive
                      ? "bg-slate-950 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[9px] font-bold",
                        isActive
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Overview & Dates */}
          {activeTab === "overview" && (
            <div
              role="tabpanel"
              id="tabpanel-overview"
              aria-labelledby="tab-overview"
              tabIndex={0}
              className="space-y-3.5 sm:space-y-4 focus:outline-none"
            >
              {/* Procurement Awarded Banner for Buyer (when awarded and before PO released) */}
              {isBuyerOrAdmin && isBidAwarded && !effectiveActiveOrder && (
                <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white p-3 sm:p-3.5 shadow-2xs transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                        <Award className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Procurement
                            Awarded &amp; Finalized
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight">
                          Contract Awarded to {awardedVendorName}
                        </h3>
                        <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                          Technical evaluation and commercial stage have
                          concluded. The procurement contract has been
                          officially awarded and archived.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Technical / Quotation Evaluation Quick-Action Shortcut Banner for Buyer */}
              {isBuyerOrAdmin &&
                !isBidAwarded &&
                (isDeadlinePassed ||
                  [
                    "CLOSED",
                    "TECHNICAL_EVALUATION",
                    "FINANCIAL_EVALUATION",
                    "L1_GENERATED",
                    "AWARD_RECOMMENDED",
                  ].includes(statusUpper)) &&
                submittedParticipations.length > 0 && (
                  isTwoPacketMode ? (
                    <div className="rounded-xl border border-indigo-150 bg-gradient-to-r from-indigo-50/90 via-blue-50/50 to-white p-3 sm:p-3.5 shadow-2xs transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                                Two-Packet Evaluation Workflow
                              </span>
                              {techEvaluationStats.pending === 0 &&
                              techEvaluationStats.qualified > 0 ? (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Technical
                                  Scrutiny Completed
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock className="h-3 w-3" />{" "}
                                  {techEvaluationStats.pending} Pending Review
                                </span>
                              )}
                            </div>
                            <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight">
                              {techEvaluationStats.pending === 0 &&
                              techEvaluationStats.qualified > 0
                                ? "Stage 1 Technical Evaluation Complete — Ready for Stage 2"
                                : "Stage 1 Technical Scrutiny & Seller Qualification Required"}
                            </h3>
                            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                              {techEvaluationStats.pending > 0
                                ? `${submittedParticipations.length} supplier quotation(s) received. Review technical specifications, compliance attachments, and qualify suppliers before opening financial bids.`
                                : `All ${submittedParticipations.length} supplier(s) evaluated (${techEvaluationStats.qualified} qualified, ${techEvaluationStats.disqualified} disqualified). Proceed to Stage 2 financial opening or launch Reverse Auction.`}
                            </p>
                          </div>
                        </div>

                        <div className="flex sm:flex-col sm:items-end justify-between items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-indigo-100">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setActiveTab("clarifications");
                              setTimeout(() => {
                                const el =
                                  document.getElementById("proposals-section");
                                if (el) el.scrollIntoView({ behavior: "smooth" });
                              }, 50);
                            }}
                            className="h-8 px-3 gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs rounded-lg cursor-pointer"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Start Technical Scrutiny</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                          <span className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">
                            {techEvaluationStats.qualified} of{" "}
                            {submittedParticipations.length} qualified
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-blue-150 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white p-3 sm:p-3.5 shadow-2xs transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                            <ClipboardCheck className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                                Single-Packet Quotation Evaluation
                              </span>
                              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Users className="h-3 w-3 text-slate-500" />
                                {submittedParticipations.length} Quotation{submittedParticipations.length === 1 ? "" : "s"} Received
                              </span>
                            </div>
                            <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight">
                              Supplier Quotations Received — Ready for Evaluation
                            </h3>
                            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                              {submittedParticipations.length} supplier quotation(s) received. All commercial rates, GST breakdowns, and technical specifications are unsealed for unified review, comparison, and contract award.
                            </p>
                          </div>
                        </div>

                        <div className="flex sm:flex-col sm:items-end justify-between items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-blue-100">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setActiveTab("clarifications");
                              setTimeout(() => {
                                const el =
                                  document.getElementById("proposals-section");
                                if (el) el.scrollIntoView({ behavior: "smooth" });
                              }, 50);
                            }}
                            className="h-8 px-3 gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs rounded-lg cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Review Quotations</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                          <span className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">
                            Unified Commercial Review
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}

              {/* Seller Reassurance Banner: Submitted Quotation Under Evaluation */}
              {!isBuyerOrAdmin &&
                isSellerParticipated &&
                (isBiddingClosed || isDeadlinePassed) &&
                !isAwardedToMe && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50/90 via-indigo-50/30 to-white p-3 sm:p-3.5 shadow-2xs transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-2xs">
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-900 bg-sky-100/90 border border-sky-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                              <CheckCircle2
                                className="h-3 w-3 text-sky-700"
                                aria-hidden="true"
                              />
                              {activeAward && !effectiveActiveOrder
                                ? "Standby Vendor • Reserve Pool Active"
                                : "Quotation Successfully Recorded"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              Submission Cutoff Elapsed
                            </span>
                          </div>
                          <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight">
                            {activeAward && !effectiveActiveOrder
                              ? "Provisional Award Processing with Primary Bidder (You: Standby Vendor)"
                              : "Under Official Procurement Evaluation"}
                          </h3>
                          <p className="text-xs text-slate-700 max-w-2xl leading-relaxed">
                            {activeAward && !effectiveActiveOrder
                              ? "A provisional award is currently being processed with the primary bidder. As a qualified bidder, you remain on the active standby reserve list; should the primary bidder decline or fail compliance, the award may revert to reserve vendors."
                              : "Your quotation was received on time before the deadline. The procurement authority is currently reviewing technical compliance and evaluating bids. In accordance with statutory sealed-bidding rules, all competitor prices remain confidential."}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(props.onViewQuotationClick ||
                          props.onSubmitClick) && (
                          <Button
                            type="button"
                            size="sm"
                            aria-label="View your submitted quotation"
                            onClick={
                              props.onViewQuotationClick || props.onSubmitClick
                            }
                            className="h-8 px-3 gap-1.5 text-xs font-bold bg-[#0b2447] hover:bg-[#12335f] text-white shadow-2xs rounded-lg cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>View My Submitted Quotation</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {/* Seller Notification Banner: Upcoming Procurement / Opens Soon */}
              {!isBuyerOrAdmin &&
                !isSellerParticipated &&
                isBeforeSubmissionStart && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50/90 via-blue-50/30 to-white p-3 sm:p-3.5 shadow-2xs transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-2xs">
                          <Clock className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-900 bg-sky-100/90 border border-sky-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                              <Clock className="h-3 w-3 text-sky-700" aria-hidden="true" />
                              Submission Window Opens Soon
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              Upcoming Procurement
                            </span>
                          </div>
                          <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight">
                            Bidding Commences on {submissionStartDateFormatted || "Scheduled Start Time"}
                          </h3>
                          <p className="text-xs text-slate-700 max-w-2xl leading-relaxed">
                            Quotation submissions have not opened yet. You will be able to submit your quotations and pricing as soon as the window officially commences.
                          </p>
                        </div>
                      </div>
                      {subStartDateObj && (
                        <div className="flex items-center gap-2 shrink-0">
                          <DeadlineCountdown
                            targetDate={closingDateValue || props.deadlineDate || ""}
                            startDate={subStartDateObj}
                            label="Submission Closes in: "
                            startLabel="Submission Opens in: "
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Seller Notification Banner: Did Not Participate / Missed Deadline */}
              {!isBuyerOrAdmin &&
                !isSellerParticipated &&
                !isBeforeSubmissionStart &&
                (isBiddingClosed || isDeadlinePassed) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-3.5 shadow-2xs transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-300 text-slate-700 shadow-2xs">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Submission Window
                              Closed
                            </span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              Did Not Participate
                            </span>
                          </div>
                          <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight">
                            Quotation Submission Deadline Has Expired
                          </h3>
                          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                            The deadline for submitting quotations for this
                            requirement was{" "}
                            {closingDateFormatted || "the scheduled cutoff"}.
                            You did not submit a quotation prior to closing. In
                            accordance with public procurement guidelines, new
                            submissions cannot be accepted.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href="/seller/opportunities"
                          className="inline-flex h-8 px-3 items-center justify-center gap-1.5 text-xs font-bold bg-[#0b2447] hover:bg-[#12335f] text-white shadow-2xs rounded-lg cursor-pointer"
                        >
                          <span>Browse Active Opportunities</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              <div className="grid gap-3.5 sm:gap-4 lg:grid-cols-2">
                <DataCard
                  title={
                    isBuyerSide
                      ? `${procurementTypeLabel} Information`
                      : `Buyer ${procurementTypeLabel} Information`
                  }
                  icon={ClipboardList}
                >
                  <PropertyGrid columns={2}>
                    <PropertyItem
                      label="Procurement Method"
                      value={procurementMethod}
                    />
                    <PropertyItem
                      label="Urgency / Priority"
                      value={resolvedUrgency}
                    />
                    <PropertyItem label="Buying Type" value={buyingType} />
                    <PropertyItem label="Category" value={category} />
                    <PropertyItem
                      label="Delivery Location"
                      value={deliveryLocation}
                    />
                  </PropertyGrid>
                </DataCard>

                <BuyerProfileSection
                  orgName={buyerOrgName}
                  contactPerson={contactPerson}
                  email={email}
                  phone={phone}
                  address={buyerAddress}
                  department={department}
                  deliveryLocation={deliveryLocation}
                />
              </div>

              {/* Internal Approval & Statutory Compliance Section (Buyer & Admin Side Only) */}
              {hasInternalCompliance && (
                <InternalComplianceSection
                  approvalAuthority={approvalAuthority}
                  justification={justification}
                  budgetConfirmed={budgetConfirmed}
                  competentAuthority={competentAuthority}
                  fileNumber={internalFileNumber}
                  sanctionDate={sanctionDateFormatted}
                  department={internalDepartment}
                />
              )}

              <TimelineRibbon
                dates={[
                  {
                    label: "Published",
                    value: publishedDateFormatted,
                    icon: Calendar,
                    tone: "emerald",
                  },
                  ...(submissionStartDateFormatted
                    ? [
                        {
                          label: "Submission Starts",
                          value: submissionStartDateFormatted,
                          icon: Calendar,
                          tone: "sky" as Tone,
                        },
                      ]
                    : []),
                  ...(isClarificationAllowed &&
                  clarificationDateFormatted &&
                  clarificationDateFormatted !== "N/A"
                    ? [
                        {
                          label: "Clarification",
                          value: clarificationDateFormatted,
                          icon: Info,
                          tone: "sky" as Tone,
                        },
                      ]
                    : []),
                  {
                    label: submissionStartDateFormatted
                      ? "Submission Ends"
                      : "Submission",
                    value: closingDateFormatted,
                    icon: Clock,
                    tone: "rose",
                  },
                  ...(hasTechnicalOpening && technicalDateFormatted !== "N/A"
                    ? [
                        {
                          label: "Technical Opening",
                          value: technicalDateFormatted,
                          icon: ClipboardCheck,
                          tone: "indigo" as Tone,
                        },
                      ]
                    : []),
                  ...(hasFinancialOpening && financialDateFormatted !== "N/A"
                    ? [
                        {
                          label: "Financial Opening",
                          value: financialDateFormatted,
                          icon: IndianRupee,
                          tone: "amber" as Tone,
                        },
                      ]
                    : []),
                  {
                    label: "Award Status",
                    value: awardDateFormatted,
                    icon: ShieldCheck,
                    tone: "slate",
                  },
                ]}
              />
            </div>
          )}

          {/* Tab 2: Scope & Documents */}
          {activeTab === "scope_docs" && (
            <div
              role="tabpanel"
              id="tabpanel-scope_docs"
              aria-labelledby="tab-scope_docs"
              tabIndex={0}
              className="space-y-5 focus:outline-none"
            >
              <DataCard
                title={`${procurementTypeLabel} Scope & Sourcing Summary`}
                icon={FileText}
              >
                <ScopeSummaryCard
                  scopeText={scopeText}
                  procurementTypeLabel={procurementTypeLabel}
                  estimatedValue={props.estimatedValue}
                  urgency={resolvedUrgency}
                  procurementMethod={procurementMethod}
                />

                {hasDetailData(lineItems) && (
                  <LineItemsTable
                    items={lineItems}
                    defaultSubject={resolvedSubject}
                    isBuyer={isBuyerSide}
                  />
                )}

                {/* BOQ Table (Buyer-side only, only shown for legitimate BOQ procurements) */}
                {isBuyerSide &&
                  isLegitimateBoq &&
                  !isRfqType &&
                  !isRateContractType && (
                    <BoqTableList
                      data={filteredBoqTable}
                      defaultSubject={resolvedSubject}
                      defaultCategory={category}
                      defaultEstimatedValue={props.estimatedValue}
                    />
                  )}
              </DataCard>

              {(() => {
                const validDownloadableDocs = documents.filter(
                  (doc) => doc && (doc.fileAssetId || doc.url),
                );
                const checklistDocs = documents.filter(
                  (doc) => doc && !doc.fileAssetId && !doc.url,
                );
                const hasExplicitRequired =
                  Array.isArray(requiredDocuments) &&
                  requiredDocuments.length > 0;
                const effectiveChecklist = hasExplicitRequired
                  ? requiredDocuments
                  : checklistDocs;

                return (
                  <div className="space-y-5">
                    {validDownloadableDocs.length > 0 && (
                      <DataCard
                        title={`${procurementTypeLabel} Attached Documents`}
                        icon={FileSpreadsheet}
                      >
                        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                          {validDownloadableDocs.map((doc, index) => {
                            const isGenericName =
                              !doc.name ||
                              doc.name.toLowerCase().startsWith("attached_doc");
                            const docDisplayName = isGenericName
                              ? doc.meta ||
                                `${procurementTypeLabel} Document ${index + 1}`
                              : doc.name;

                            return (
                              <article
                                key={
                                  doc.id
                                    ? `doc-${doc.id}-${index}`
                                    : `doc-idx-${index}`
                                }
                                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-xs flex flex-col justify-between hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    <FileText className="h-5 w-5" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="break-words text-xs font-bold text-slate-900 leading-snug">
                                      {docDisplayName}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      <span
                                        className={cn(
                                          "rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                          doc.required
                                            ? "border-rose-200 bg-rose-50 text-rose-700"
                                            : "border-slate-200 bg-white text-slate-600",
                                        )}
                                      >
                                        {doc.required
                                          ? "Required"
                                          : doc.meta || "Document"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (doc.fileAssetId || doc.url) {
                                      openFileAsset(
                                        {
                                          fileAssetId: doc.fileAssetId,
                                          url: doc.url,
                                          originalName: docDisplayName,
                                        },
                                        docDisplayName,
                                      );
                                    }
                                  }}
                                  disabled={!doc.fileAssetId && !doc.url}
                                  className="mt-3.5 w-full text-xs h-8.5 rounded-lg border-slate-250 bg-white hover:bg-slate-100 font-bold"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                  Open Document
                                </Button>
                              </article>
                            );
                          })}
                        </div>
                      </DataCard>
                    )}

                    {effectiveChecklist && effectiveChecklist.length > 0 ? (
                      <RequiredDocumentsList
                        data={effectiveChecklist}
                        title={
                          validDownloadableDocs.length > 0
                            ? "Mandatory Submission & Compliance Checklist"
                            : `${procurementTypeLabel} Required Documents & Checklist`
                        }
                      />
                    ) : validDownloadableDocs.length === 0 ? (
                      <DataCard
                        title={`${procurementTypeLabel} Attached Documents`}
                        icon={FileSpreadsheet}
                      >
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs font-semibold text-slate-400">
                          No downloadable documents or submission checklist
                          specified for this procurement.
                        </div>
                      </DataCard>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 3: Terms & Schedule */}
          {activeTab === "terms_schedule" && (
            <div
              role="tabpanel"
              id="tabpanel-terms_schedule"
              aria-labelledby="tab-terms_schedule"
              tabIndex={0}
              className="space-y-5 focus:outline-none"
            >
              <DataCard
                title={`${procurementTypeLabel} Milestones & Schedule`}
                icon={CalendarDays}
              >
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-indigo-600" />
                        Milestones &amp; Critical Dates
                      </h3>
                      {canExtendSchedule && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsExtendScheduleOpen(true)}
                          className="h-7 px-2.5 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-bold rounded-lg gap-1 flex items-center cursor-pointer shadow-2xs"
                          aria-label="Extend schedule dates"
                        >
                          <CalendarDays className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                          Extend Schedule
                        </Button>
                      )}
                    </div>
                    <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150">
                      <PropertyGrid columns={3}>
                        <PropertyItem
                          label="Publish Date & Time"
                          value={publishedDateFormatted}
                        />
                        <PropertyItem
                          label="Submission Start Date"
                          value={submissionStartDateFormatted}
                        />
                        <PropertyItem
                          label="Submission Deadline"
                          value={closingDateFormatted}
                          highlight
                        />
                        {isClarificationAllowed &&
                          clarificationDeadlineFormatted && (
                            <PropertyItem
                              label="Clarification Deadline"
                              value={clarificationDeadlineFormatted}
                            />
                          )}
                        {hasTechnicalOpening && technicalDateFormatted && (
                          <PropertyItem
                            label="Technical Opening Date"
                            value={technicalDateFormatted}
                          />
                        )}
                        {hasFinancialOpening && financialDateFormatted && (
                          <PropertyItem
                            label="Financial Opening Date"
                            value={financialDateFormatted}
                          />
                        )}
                        <PropertyItem
                          label="Bid Validity Date"
                          value={bidValidityDateFormatted}
                        />
                        <PropertyItem
                          label="Validity Days"
                          value={validityDaysDisplay}
                        />
                        <PropertyItem
                          label="Required By Date & Time"
                          value={requiredByDateFormatted}
                        />
                        <PropertyItem
                          label="Envelope Configuration"
                          value={
                            isTwoPacket
                              ? "Two Packet Envelope (Technical + Commercial Separated)"
                              : "Single Packet Envelope (Commercial Only)"
                          }
                        />
                      </PropertyGrid>
                    </div>
                  </div>
                </div>
              </DataCard>

              <DataCard title="Commercial & Payment Terms" icon={IndianRupee}>
                <PropertyGrid columns={3}>
                  <PropertyItem
                    label="Freight Terms"
                    icon={Truck}
                    value={
                      isFreightIncluded
                        ? "Freight Included (Door Delivery)"
                        : "Freight Excluded (Extra as per actuals)"
                    }
                    subtext={
                      isFreightIncluded
                        ? "Bid price must include all shipping, insurance & delivery to destination."
                        : "Freight is not included in bid price and will be paid extra."
                    }
                  />
                  <PropertyItem label="Payment Terms" value={paymentTerms} />
                  {hasDetailData(deliveryTerms) &&
                    deliveryTerms !== "N/A" &&
                    deliveryTerms !== "—" && (
                      <PropertyItem
                        label="Delivery Terms"
                        value={deliveryTerms}
                      />
                    )}
                  {!isRfqType &&
                    (isRateContractType || isServices) &&
                    (() => {
                      const periodVal = firstPresent(
                        terms.contractPeriod,
                        serviceDetails.contractPeriod,
                        isRateContractType
                          ? payload.rateContractConfig?.validityPeriod ||
                              payload.rateContract?.validityPeriod ||
                              terms.projectDuration
                          : undefined,
                        isServices ? serviceDetails.duration : undefined,
                        projectDuration,
                      );
                      if (
                        !periodVal ||
                        periodVal === "—" ||
                        periodVal === "N/A" ||
                        periodVal === "Not Specified" ||
                        periodVal === "null" ||
                        periodVal === "undefined"
                      ) {
                        return null;
                      }
                      return (
                        <PropertyItem
                          label="Contract Period"
                          value={periodVal}
                        />
                      );
                    })()}
                  {/* Service Parameters & Related Terms */}
                  {(hasDetailData(serviceDetails) ||
                    String(buyingType || "")
                      .toLowerCase()
                      .includes("service")) &&
                    !isRfqType && (
                      <>
                        <PropertyItem
                          label="Service Title"
                          value={
                            serviceDetails.serviceTitle || serviceDetails.title
                          }
                        />
                        <PropertyItem
                          label="SLA Response Time"
                          value={serviceDetails.slaResponseTime}
                        />
                        <PropertyItem
                          label="Penalty Clause"
                          value={
                            serviceDetails.penaltyClause || terms.penaltyClause
                          }
                        />
                        <PropertyItem
                          label="Manpower Required"
                          value={formatPrimitiveValue(
                            serviceDetails.manpowerRequired,
                          )}
                        />
                        <PropertyItem
                          label="Experience Required"
                          value={formatPrimitiveValue(
                            serviceDetails.experienceRequired,
                          )}
                        />
                        {(() => {
                          const {
                            duration: _dur,
                            projectDuration: _projDur,
                            contractPeriod: _cPer,
                            penaltyClause: _pen,
                            slaResponseTime: _sla,
                            manpowerRequired: _man,
                            experienceRequired: _exp,
                            milestones: _miles,
                            warranty: _warr,
                            warrantyTerms: _warrT,
                            warrantyPeriod: _warrP,
                            paymentTerms: _payT,
                            serviceTitle: _sTitle,
                            title: _t,
                            scopeOfWork: _sow,
                            description: _desc,
                            ...restService
                          } = serviceDetails || {};
                          const extraEntries = detailEntries(
                            compactObject(restService),
                          );
                          return extraEntries.map(([k, v]) => (
                            <PropertyItem
                              key={k}
                              label={humanizeKey(k)}
                              value={v}
                            />
                          ));
                        })()}
                      </>
                    )}
                  {/* Retention Amount & Security Deposit commented out / hidden on buyer side */}
                  {/* Warranty Terms strictly commented out / hidden on buyer side in open tender */}
                  <PropertyItem
                    label="Terms & Conditions"
                    value={cleanBuyerTerms(
                      terms.termsAndConditions || terms.terms || payload.terms,
                    )}
                    fullWidth
                  />
                </PropertyGrid>
              </DataCard>

              <ConsigneeTableList
                data={consigneeDetails}
                deliveryLocation={deliveryLocation}
                deliveryTerms={deliveryTerms}
                isBuyerSide={isBuyerSide}
                isBuyerRfq={isBuyerRfq}
                isRfqType={isRfqType}
                isRfpType={isRfpType}
                isRateContractType={isRateContractType}
              />
            </div>
          )}

          {/* Tab 4: Evaluation & Controls */}
          {activeTab === "evaluation" && (
            <div
              role="tabpanel"
              id="tabpanel-evaluation"
              aria-labelledby="tab-evaluation"
              tabIndex={0}
              className="space-y-5 focus:outline-none"
            >
              {(isReverseAuctionType || linkedAuction) && (
                <DataCard title="Reverse Auction Sourcing Rules" icon={Gavel}>
                  <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150 space-y-4">
                    <PropertyGrid columns={3}>
                      <PropertyItem
                        label="Opening / Start Price"
                        value={formatCurrency(
                          linkedAuction?.startPrice ?? props.estimatedValue,
                        )}
                        highlight
                      />
                      <PropertyItem
                        label="Minimum Decrement"
                        value={
                          linkedAuction?.minDecrementAmount != null
                            ? formatCurrency(linkedAuction.minDecrementAmount)
                            : linkedAuction?.minDecrementPercent
                              ? `${linkedAuction.minDecrementPercent}%`
                              : "Standard Decrement"
                        }
                      />
                      <PropertyItem
                        label="Rank Visibility Mode"
                        value={formatPrimitiveValue(
                          linkedAuction?.rankVisibility || "SHOW_RANK_ONLY",
                          "rankVisibility",
                        )}
                      />
                      <PropertyItem
                        label="Min Qualified Bidders"
                        value={String(
                          linkedAuction?.minimumQualifiedBidders ?? 2,
                        )}
                      />
                      <PropertyItem
                        label="Auto-Extension"
                        value={
                          linkedAuction?.autoExtensionEnabled !== false
                            ? `Enabled (${linkedAuction?.autoExtensionWindowMinutes || 5}m trigger / ${linkedAuction?.autoExtensionByMinutes || 5}m extension)`
                            : "Disabled"
                        }
                      />
                      <PropertyItem
                        label="Auction Format"
                        value={`${formatPrimitiveValue(linkedAuction?.auctionType || "ENGLISH_REVERSE", "auctionType")} (${formatPrimitiveValue(linkedAuction?.auctionMode || "ONLINE", "auctionMode")})`}
                      />
                    </PropertyGrid>
                  </div>
                </DataCard>
              )}

              <DataCard
                title="Evaluation Overview & Method"
                icon={ClipboardCheck}
              >
                <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150 space-y-4">
                  <PropertyGrid columns={2}>
                    <PropertyItem
                      label="Evaluation Method"
                      value={formatPrimitiveValue(
                        evaluationMethod,
                        "evaluationMethod",
                      )}
                      highlight
                      subtext={evalDetails.badge}
                    />
                    <PropertyItem
                      label="Award Basis"
                      value={evalDetails.basisLabel}
                    />
                  </PropertyGrid>

                  {/* Short, clear, informative method explanation */}
                  <div className="border-t border-slate-200/80 pt-3.5">
                    <div className="rounded-lg border border-blue-100/90 bg-blue-50/50 p-3.5 text-xs">
                      <div className="flex items-start gap-2.5">
                        <Scale
                          className="h-4 w-4 text-blue-700 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-blue-900">
                              Method Description
                            </span>
                            <span className="inline-flex items-center rounded-md bg-blue-100/90 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                              {evalDetails.shortSummary}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-700 leading-relaxed">
                            {evalDetails.description}
                          </p>
                          {evalDetails.keyPoints &&
                            evalDetails.keyPoints.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {evalDetails.keyPoints.map((point, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 border border-slate-200 shadow-2xs"
                                  >
                                    <CheckCircle2
                                      className="h-3 w-3 text-emerald-600 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>{point}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DataCard>

              {(hasExplicitTechCriteria ||
                (isBuyerSide && (isTechEvalNeeded || isQcbsMethod))) && (
                <TechnicalCriteriaTableList data={technicalCriteria} />
              )}

              {hasDetailData(questionnaireData) && (
                <CompactSectionGrid
                  title="Questionnaire & Technical Form"
                  icon={ClipboardList}
                  data={compactObject({ questionnaire: questionnaireData })}
                  defaultOpen={true}
                />
              )}

              {isBuyerSide && (
                <DataCard title="Supplier & Approval Controls" icon={Users}>
                  <div className="space-y-5">
                    <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150">
                      <PropertyGrid columns={3}>
                        <PropertyItem
                          label="Selection Mode"
                          value={
                            vendors.selection ||
                            payload.selectionMode ||
                            rules.selectionMode ||
                            "Open"
                          }
                        />
                        <PropertyItem
                          label="Invite Count"
                          value={String(effectiveInviteCount)}
                        />
                        <PropertyItem
                          label="Workflow"
                          value={resolvedWorkflow}
                        />
                      </PropertyGrid>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Vendor Preferences &amp; Eligibility Controls
                      </h3>
                      <PolicyRulesMatrix
                        rules={[
                          {
                            label: "MSME Preference",
                            value:
                              (vendors.msmePreference !== undefined
                                ? vendors.msmePreference
                                : payload.msmePreference) !== undefined
                                ? (vendors.msmePreference ??
                                  payload.msmePreference)
                                  ? "Yes"
                                  : "No"
                                : "No",
                          },
                          {
                            label: "Exclude Blacklisted",
                            value:
                              (vendors.excludeBlacklisted !== undefined
                                ? vendors.excludeBlacklisted
                                : payload.excludeBlacklisted) !== undefined
                                ? (vendors.excludeBlacklisted ??
                                  payload.excludeBlacklisted)
                                  ? "Yes"
                                  : "No"
                                : "No",
                          },
                          {
                            label: "Local Vendor Preference",
                            value:
                              (vendors.localVendorPreference !== undefined
                                ? vendors.localVendorPreference
                                : payload.localVendorPreference) !== undefined
                                ? (vendors.localVendorPreference ??
                                  payload.localVendorPreference)
                                  ? "Yes"
                                  : "No"
                                : "No",
                          },
                        ]}
                      />
                    </div>

                    {(approval.notes || payload.approvalNotes) &&
                      isBuyerOrAdmin && (
                        <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-150">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Approval Notes:
                          </span>
                          <p className="text-xs font-semibold text-slate-700">
                            {approval.notes || payload.approvalNotes}
                          </p>
                        </div>
                      )}
                  </div>
                </DataCard>
              )}
            </div>
          )}

          {/* Tab 5: Clarifications & Proposals */}
          {activeTab === "clarifications" && (
            <div
              role="tabpanel"
              id="tabpanel-clarifications"
              aria-labelledby="tab-clarifications"
              tabIndex={0}
              className="space-y-4 focus:outline-none"
            >
              {/* Live Reverse Auction Leaderboard for Buyer */}
              {isBuyerOrAdmin &&
                linkedAuction &&
                [
                  "LIVE",
                  "PAUSED",
                  "CLOSED",
                  "COMPLETED",
                  "AWARD_RECOMMENDED",
                  "AWARDED",
                ].includes(
                  String(
                    linkedAuction.statusEnum || linkedAuction.status || "",
                  ).toUpperCase(),
                ) && (
                  <LiveAuctionLeaderboard
                    auctionId={linkedAuction.id}
                    onAuctionClosed={() => linkedAuctionQuery.refetch()}
                    onPoGenerated={() => linkedAuctionQuery.refetch()}
                  />
                )}

              {isBuyerOrAdmin && (
                <section
                  id="proposals-section"
                  className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 tracking-tight">
                          {isRfqType
                            ? "Seller Submitted Quotations"
                            : "Seller Proposals & Submitted Quotations"}
                        </h3>
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9.5px] font-bold text-blue-700">
                          {submittedParticipations.length}{" "}
                          {submittedParticipations.length === 1
                            ? isRfqType
                              ? "Quotation"
                              : "Proposal"
                            : isRfqType
                              ? "Quotations"
                              : "Proposals"}{" "}
                          Received
                        </span>
                      </div>
                      <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                        {isRfqType
                          ? "Review seller quotation details, financial quotes, line item rates, and attached technical specifications."
                          : "Review seller proposal details, financial quotes, line item rates, and attached technical specifications."}
                      </p>
                    </div>

                    {/* Action Buttons: Compare Quotes & Reverse Auction */}
                    <div className="flex flex-wrap items-center gap-2">
                      {submittedParticipations.length >= 2 &&
                        isEvaluationReady && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const allIds = submittedParticipations.map(
                                (p: any) =>
                                  String(p.id || p.sellerId || p.sellerUserId),
                              );
                              if (submittedParticipations.length === 2) {
                                setSelectedCompareIds(allIds);
                                setIsComparisonModalOpen(true);
                              } else {
                                setSelectedCompareIds(allIds);
                                setIsCompareChooserOpen(true);
                              }
                            }}
                            className="h-7.5 gap-1.5 text-xs font-bold border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 shadow-2xs rounded-lg px-3 cursor-pointer"
                          >
                            <Scale className="h-3.5 w-3.5 text-indigo-600" />
                            <span>
                              Compare Quotations (
                              {submittedParticipations.length})
                            </span>
                          </Button>
                        )}
                      {!isBidAwarded &&
                        allowsReverseAuction &&
                        isEvaluationReady &&
                        (!linkedAuction ||
                          (linkedAuction as any).auctionPlanned === true ||
                          ["DRAFT", "CANCELLED"].includes(
                            String(
                              linkedAuction.statusEnum ||
                                linkedAuction.status ||
                                "",
                            ).toUpperCase(),
                          )) &&
                        submittedParticipations.length > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const qualifiedSellers =
                                submittedParticipations.filter(
                                  (p: any) =>
                                    String(
                                      p.technicalStatus || "",
                                    ).toUpperCase() === "QUALIFIED",
                                );
                              if (
                                submittedParticipations.length > 0 &&
                                qualifiedSellers.length === 0
                              ) {
                                toast.error(
                                  "No sellers are technically qualified yet. Please evaluate and qualify at least one seller before launching Stage 2 Reverse Auction.",
                                );
                                return;
                              }
                              setIsStartAuctionModalOpen(true);
                            }}
                            className="h-7.5 gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-2xs rounded-lg px-3 cursor-pointer"
                          >
                            <Gavel className="h-3 w-3" />
                            <span>Launch Stage 2 Reverse Auction</span>
                          </Button>
                        )}
                    </div>
                  </div>

                  {/* Evaluation Progress Banner for both Two-Packet and Single-Packet mode */}
                  {submittedParticipations.length > 0 &&
                    isEvaluationReady && (
                      <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-blue-50/60 to-slate-50 p-3.5 sm:p-4 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs",
                                isBidAwarded
                                  ? "bg-emerald-600"
                                  : "bg-indigo-600",
                              )}
                            >
                              {isBidAwarded ? (
                                <Award className="h-5 w-5" />
                              ) : (
                                <ShieldCheck className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                                  {isBidAwarded
                                    ? isTwoPacketMode
                                      ? "Two-Packet Procurement Concluded"
                                      : "Procurement Concluded"
                                    : isTwoPacketMode
                                      ? "Two-Packet Procurement • Stage 1"
                                      : "Single-Packet Evaluation"}
                                </span>
                                {isBidAwarded ? (
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />{" "}
                                    Contract Awarded
                                  </span>
                                ) : isTechEvalCompleted ||
                                  (techEvaluationStats.pending === 0 &&
                                    techEvaluationStats.qualified > 0) ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                                    Technical Evaluation Complete
                                  </span>
                                ) : null}
                              </div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
                                {isBidAwarded
                                  ? "Evaluations Concluded & Contract Finalized"
                                  : isTwoPacketMode
                                    ? "Technical Packet Opening & Seller Qualification"
                                    : "Quotation Scrutiny & Supplier Qualification"}
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                {isBidAwarded
                                  ? "Proposal evaluations are concluded and archived. Contract has been awarded."
                                  : isTwoPacketMode
                                    ? "Evaluate supplier technical proposals below. Only technically qualified sellers advance to Stage 2 (Financial Opening / Reverse Auction)."
                                    : "Review seller quotations and evaluate technical/commercial compliance below. Mark bidders as Qualified or Disqualified before finalizing award on Results page."}
                              </p>
                            </div>
                          </div>

                          {/* Progress Stats Pills */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              {techEvaluationStats.qualified} Qualified
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-800 shadow-2xs">
                              <XCircle className="h-3.5 w-3.5 text-rose-600" />
                              {techEvaluationStats.disqualified} Disqualified
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-bold text-amber-800 shadow-2xs">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              {techEvaluationStats.pending} Pending Review
                            </span>
                          </div>
                        </div>

                        {/* Action Bar for Completing Tech Eval & Opening Financial Bids */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-100/70">
                          <span className="text-[11px] font-semibold text-slate-600">
                            {isBidAwarded
                              ? `✅ Procurement Awarded. Contract finalized with ${awardedVendorName}.`
                              : isTwoPacketMode
                                ? isTechEvalCompleted
                                  ? `✅ Stage 1 technical evaluation finalized. ${techEvaluationStats.qualified} qualified seller(s) advanced to Stage 2.`
                                  : techEvaluationStats.pending > 0
                                    ? `⚠️ Please evaluate the remaining ${techEvaluationStats.pending} pending seller(s) before proceeding.`
                                    : techEvaluationStats.qualified > 0
                                      ? `All sellers evaluated. ${techEvaluationStats.qualified} qualified seller(s) are eligible for Stage 2.`
                                      : `⚠️ At least one seller must be technically qualified to proceed.`
                                : techEvaluationStats.pending > 0
                                  ? `⚠️ ${techEvaluationStats.pending} quotation(s) pending review. Evaluate and qualify/disqualify vendors below.`
                                  : `✅ Evaluation complete. ${techEvaluationStats.qualified} vendor(s) qualified for commercial ranking & award.`}
                          </span>

                          <div className="flex items-center gap-2">
                            {isTwoPacketMode &&
                              !isBidAwarded &&
                              !isTechEvalCompleted &&
                              techEvaluationStats.pending === 0 &&
                              techEvaluationStats.qualified > 0 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isCompletingTechEval}
                                  onClick={handleCompleteTechnicalEvaluation}
                                  className="h-7.5 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  <span>
                                    {isCompletingTechEval
                                      ? "Finalizing..."
                                      : "Complete Technical Evaluation"}
                                  </span>
                                </Button>
                              )}

                            {(isTechEvalCompleted || isBidAwarded) && (
                              <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>
                                  {isBidAwarded
                                    ? "Procurement Awarded"
                                    : "Stage 1 Evaluation Completed"}
                                </span>
                              </div>
                            )}

                            {!isBidAwarded && (
                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  techEvaluationStats.pending === 0 || isTechEvalCompleted
                                    ? "primary"
                                    : "outline"
                                }
                                onClick={() =>
                                  router.push(`/bids/${targetId}/results`)
                                }
                                className={cn(
                                  "h-7.5 gap-1.5 text-xs font-bold shadow-2xs cursor-pointer",
                                  techEvaluationStats.pending === 0 || isTechEvalCompleted
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                    : "text-indigo-700 border-indigo-200 bg-white hover:bg-indigo-50",
                                )}
                              >
                                <span>
                                  {isTwoPacketMode
                                    ? "View Stage 2 Financial Opening & Results"
                                    : "View Evaluation & Results"}
                                </span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {submittedParticipations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-7 px-4 text-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                        <Users className="h-4.5 w-4.5" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-700">
                        {isRfqType
                          ? "No seller quotations submitted yet"
                          : "No seller proposals submitted yet"}
                      </h4>
                      <p className="text-[11px] font-normal text-slate-400 max-w-sm mt-0.5">
                        {isRfqType
                          ? "As soon as suppliers submit their quotations for this RFQ, their responses will appear here for your review."
                          : "As soon as suppliers submit their technical and financial proposals for this procurement, their quotations will appear here for your review."}
                      </p>
                    </div>
                  ) : !isEvaluationReady ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 py-8 px-5 text-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white mb-3 shadow-md shadow-indigo-600/20">
                        <Lock className="h-5 w-5" />
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-0.5 text-xs font-black text-emerald-800 mb-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Bidding Window Active
                      </span>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        {submittedParticipations.length} Quotation
                        {submittedParticipations.length === 1 ? "" : "s"}{" "}
                        Received (Sealed)
                      </h4>
                      <p className="text-xs font-medium text-slate-600 max-w-md mt-1 leading-relaxed">
                        In accordance with procurement integrity and
                        sealed-bidding rules, supplier quotes and commercial
                        proposals remain strictly confidential until bidding
                        concludes on{" "}
                        <strong className="text-slate-800">
                          {displaySealedClosingDate}
                        </strong>
                        .
                      </p>
                      <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-100/80 px-3 py-1 text-xs font-bold text-indigo-900 border border-indigo-200">
                        <Clock className="h-3.5 w-3.5 text-indigo-600" />{" "}
                        Quotations and evaluation tools will unlock upon closing
                      </span>
                    </div>
                  ) : (
                    <DataTable<any>
                      data={submittedParticipations}
                      columns={quotationListColumns}
                      keyExtractor={(participation, idx) =>
                        String(
                          participation.id || participation.sellerId || idx,
                        )
                      }
                      showSrNo={false}
                      minWidth="min-w-[1150px]"
                      emptyTitle={
                        isRfqType
                          ? "No seller quotations submitted yet"
                          : "No seller proposals submitted yet"
                      }
                      emptyDescription={
                        isRfqType
                          ? "As soon as suppliers submit their quotations for this RFQ, their responses will appear here for your review."
                          : "As soon as suppliers submit their technical and financial proposals for this procurement, their quotations will appear here for your review."
                      }
                    />
                  )}
                </section>
              )}

              {/* Quotation Review Modal Renderer */}
              {selectedQuotationForReview && (
                <SellerQuotationReviewModal
                  isOpen={Boolean(selectedQuotationForReview)}
                  onClose={() => setSelectedQuotationForReview(null)}
                  participation={selectedQuotationForReview}
                  procurementTitle={props.subject || props.procurementLabel}
                  targetId={targetId}
                  router={router}
                  isTwoPacketMode={isTwoPacketMode}
                  isFinancialStageOpened={isTechEvalCompleted || isBidAwarded}
                  isBidAwarded={isBidAwarded}
                  canAward={false}
                  isBuyer={Boolean(isBuyerSide || isBuyerOrAdmin)}
                  onOpenCompare={
                    isBuyerSide || isBuyerOrAdmin
                      ? () => {
                          setSelectedQuotationForReview(null);
                          setSelectedCompareIds(
                            submittedParticipations.map((p: any) =>
                              String(p.id || p.sellerId || p.sellerUserId),
                            ),
                          );
                          setIsComparisonModalOpen(true);
                        }
                      : undefined
                  }
                  onOpenTechnicalEvaluation={
                    isBuyerSide || isBuyerOrAdmin
                      ? (p) => {
                          setSelectedQuotationForReview(null);
                          setSelectedForTechnicalEval(p);
                        }
                      : undefined
                  }
                />
              )}

              {/* Technical Packet Evaluation Modal Renderer */}
              {selectedForTechnicalEval && (
                <TechnicalEvaluationModal
                  isOpen={Boolean(selectedForTechnicalEval)}
                  onClose={() => setSelectedForTechnicalEval(null)}
                  participation={selectedForTechnicalEval}
                  bidId={targetId}
                  readOnly={isBidAwarded}
                  isFinancialStageOpened={isTechEvalCompleted || isBidAwarded}
                  isStage2Active={isTechEvalCompleted || isBidAwarded}
                  bidStatus={props.status || props.lifecycleStage}
                  procurementTitle={props.subject || props.procurementLabel}
                  onEvaluationSuccess={() => {
                    queryClient.invalidateQueries({
                      queryKey: ["buyer-unified-participations"],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["rfq-buyer-responses-v2"],
                    });
                  }}
                />
              )}

              {/* Select Quotations to Compare Modal */}
              {isCompareChooserOpen && (
                <SelectQuotationsToCompareModal
                  isOpen={isCompareChooserOpen}
                  onClose={() => setIsCompareChooserOpen(false)}
                  participations={submittedParticipations}
                  onConfirmCompare={(selectedIds) => {
                    setSelectedCompareIds(selectedIds);
                    setIsCompareChooserOpen(false);
                    setIsComparisonModalOpen(true);
                  }}
                />
              )}

              {/* Quotation Comparison Matrix Modal Renderer */}
              {isComparisonModalOpen && (
                <QuotationComparisonModal
                  isOpen={isComparisonModalOpen}
                  onClose={() => setIsComparisonModalOpen(false)}
                  participations={submittedParticipations}
                  initialSelectedSellerIds={selectedCompareIds}
                  procurementTitle={props.subject || props.procurementLabel}
                  targetId={targetId}
                  router={router}
                  onSelectQuotationReview={(p) =>
                    setSelectedQuotationForReview(p)
                  }
                />
              )}

              {/* Start Reverse Auction Modal */}
              {isStartAuctionModalOpen && (
                <StartReverseAuctionModal
                  isOpen={isStartAuctionModalOpen}
                  onClose={() => setIsStartAuctionModalOpen(false)}
                  procurementId={targetId}
                  procurementTitle={resolvedSubject}
                  initialLowestQuote={
                    submittedParticipations.length
                      ? Math.min(
                          ...submittedParticipations
                            .map((p: any) =>
                              Number(
                                p.totalAmount ||
                                  p.quotedAmount ||
                                  p.offeredPrice ||
                                  Infinity,
                              ),
                            )
                            .filter((q: number) => q > 0 && q < Infinity),
                        )
                      : undefined
                  }
                  submittedVendors={submittedParticipations.map(
                    (p: any, idx: number) => ({
                      sellerOrgId:
                        p.sellerOrgId ||
                        p.sellerOrganization?.id ||
                        p.seller?.organizationId,
                      sellerUserId:
                        p.sellerUserId || p.sellerId || p.seller?.id,
                      sellerId: p.sellerId || p.sellerUserId,
                      vendorName:
                        p.sellerOrgName ||
                        p.sellerOrganization?.organizationName ||
                        p.seller?.sellerProfile?.organizationName ||
                        p.seller?.name ||
                        `Supplier ${idx + 1}`,
                      quotedAmount: Number(
                        p.totalAmount || p.quotedAmount || p.offeredPrice || 0,
                      ),
                      offeredQty: p.offeredQuantity || p.quantity,
                      deliveryTimeline: p.deliveryTimeline,
                      makeBrand:
                        p.makeBrand ||
                        p.brand ||
                        p.technicalDetails?.brand ||
                        p.quotationDetails?.makeBrand,
                      model:
                        p.model ||
                        p.technicalDetails?.model ||
                        p.quotationDetails?.model,
                      technicalStatus:
                        p.technicalStatus ||
                        (p.isDisqualified ? "DISQUALIFIED" : "QUALIFIED"),
                      warranty: p.warranty || p.warrantyPeriod,
                    }),
                  )}
                  onAuctionStarted={() => {
                    linkedAuctionQuery.refetch();
                  }}
                  auctionDefaults={
                    linkedAuction
                      ? {
                          ...linkedAuction,
                          minDecrementAmount:
                            linkedAuction.minDecrementAmount != null
                              ? Number(linkedAuction.minDecrementAmount)
                              : undefined,
                        }
                      : undefined
                  }
                />
              )}

              {/* Seller Submission & Quotation View Panel */}
              {!isBuyerOrAdmin && (
                <div className="space-y-4">
                  {isSellerParticipated ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">
                              {isRfqType
                                ? "My Submitted Quotation"
                                : "My Submitted Proposal"}
                            </h3>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                                isAwardedToMe
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : activeAward && !effectiveActiveOrder
                                    ? "bg-sky-50 text-sky-900 border-sky-300"
                                    : isBiddingClosed || isDeadlinePassed
                                      ? "bg-sky-50 text-sky-900 border-sky-300"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-300",
                              )}
                            >
                              {isAwardedToMe
                                ? "Contract Awarded"
                                : activeAward && !effectiveActiveOrder
                                  ? "Standby Vendor • Reserve List"
                                  : isBiddingClosed || isDeadlinePassed
                                    ? "Submitted • Under Evaluation"
                                    : "Submitted"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {effectiveMyParticipation?.submittedAt ||
                            effectiveMyParticipation?.createdAt
                              ? `Submitted on ${formatDateTime(effectiveMyParticipation.submittedAt || effectiveMyParticipation.createdAt)}`
                              : "Quotation officially received on portal"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleOpenMyQuotationModal}
                            className="h-8 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View Full Quotation</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (props.onDownloadClick)
                                props.onDownloadClick();
                              else handleDefaultPdfDownload();
                            }}
                            className="h-8 px-3 text-xs font-bold gap-1.5 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download PDF</span>
                          </Button>
                        </div>
                      </div>

                      {/* Quoted Overview Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Total Quoted Value
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {formatCurrency(
                              effectiveMyParticipation?.quotedAmount ||
                                effectiveMyParticipation?.totalAmount ||
                                effectiveMyParticipation?.offeredPrice ||
                                0,
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Delivery Timeline
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {effectiveMyParticipation?.deliveryTimeline ||
                              "As per specifications"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Payment Terms
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {effectiveMyParticipation?.paymentTerms ||
                              "As per tender terms"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Technical Documents
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {Array.isArray(effectiveMyParticipation?.documents)
                              ? effectiveMyParticipation.documents.length
                              : 0}{" "}
                            Document(s) Attached
                          </span>
                        </div>
                      </div>

                      {/* Sealed Bidding Confidentiality Notice */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600 flex items-start gap-2.5">
                        <Lock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          <strong className="text-slate-800">
                            Confidential Sealed Bidding:
                          </strong>{" "}
                          In compliance with official procurement guidelines,
                          competing quotations, commercial rates, and rankings
                          remain strictly sealed and confidential until
                          technical evaluation is finalized and awards are
                          completed.
                        </p>
                      </div>
                    </div>
                  ) : isBeforeSubmissionStart ? (
                    <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                        <Clock className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="space-y-1 max-w-md mx-auto">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          Quotation Submission Window Opens Soon
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Bidding for this procurement opens on{" "}
                          <strong className="text-slate-800">{submissionStartDateFormatted || "the scheduled start time"}</strong>. You will be able to prepare and submit your technical response and commercial quotation as soon as the window commences.
                        </p>
                      </div>
                      {subStartDateObj && (
                        <div className="pt-2 flex justify-center">
                          <DeadlineCountdown
                            targetDate={closingDateValue || props.deadlineDate || ""}
                            startDate={subStartDateObj}
                            label="Submission Closes in: "
                            startLabel="Submission Opens in: "
                          />
                        </div>
                      )}
                    </div>
                  ) : isBiddingClosed || isDeadlinePassed ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
                        <Lock className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 max-w-md mx-auto">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          Quotation Submission Window Closed
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          The quotation submission deadline for this procurement
                          concluded on{" "}
                          {closingDateFormatted || "the scheduled cutoff"}. You
                          did not submit a quotation prior to the deadline.
                          Under sealed procurement rules, bids and evaluations
                          are restricted to participating suppliers and the
                          procurement committee.
                        </p>
                      </div>
                      <div className="pt-2">
                        <Link
                          href="/seller/opportunities"
                          className="inline-flex h-8.5 px-4 items-center justify-center gap-1.5 text-xs font-bold bg-[#0b2447] hover:bg-[#12335f] text-white shadow-xs rounded-xl cursor-pointer"
                        >
                          <span>Browse Active Opportunities</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 p-8 text-center space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 max-w-md mx-auto">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          Awaiting Your Quotation
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          The quotation window is currently open until{" "}
                          {closingDateFormatted || "the deadline"}. Prepare your
                          technical response and commercial rates to submit your
                          bid.
                        </p>
                      </div>
                      {props.onSubmitClick && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleActionSubmit}
                            className="h-8.5 px-4 text-xs font-bold bg-[#0b2447] hover:bg-[#12335f] text-white shadow-xs rounded-xl cursor-pointer gap-1.5"
                          >
                            <span>Submit Quotation Now</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {props.customClarificationPanel
                ? props.customClarificationPanel
                : isClarificationAllowed &&
                  (() => {
                    const clarKind =
                      props.clarificationKind ??
                      (props.procurementType === "RATE_CONTRACT" ||
                      props.procurementType === "LIMITED_TENDER"
                        ? "requirement"
                        : "quote-request");
                    const clarId = props.clarificationEntityId ?? targetId;
                    const isClarDeadlinePassed = (() => {
                      const d = parseDateValue(
                        closingDateValue || props.deadlineDate || schedule.submissionDate,
                      );
                      const t = d && !isNaN(d.getTime()) ? d.getTime() : 0;
                      return t > 0 ? t < nowMs : false;
                    })();
                    return (
                      <ClarificationPanel
                        quoteRequestId={clarId}
                        kind={clarKind}
                        role={
                          isBuyerOrAdmin || isBuyerSide ? "buyer" : "seller"
                        }
                        deadlinePassed={isClarDeadlinePassed}
                        submissionStartDate={rawSubmissionStartDate}
                        notStarted={isBeforeSubmissionStart}
                        clarificationDeadline={clarificationDeadlineValue}
                        procurementLabel={
                          props.procurementLabel || procurementTypeLabel
                        }
                      />
                    );
                  })()}
            </div>
          )}

          {/* EMD Payment Modal commented out */}
        </div>
      </div>
    </BuyerSideContext.Provider>
  );
}

interface SellerQuotationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  participation: any;
  procurementTitle?: string;
  targetId: string;
  router: any;
  isTwoPacketMode?: boolean;
  isFinancialStageOpened?: boolean;
  isBidAwarded?: boolean;
  canAward?: boolean;
  isBuyer?: boolean;
  onAwardVendor?: (participation: any) => void;
  onOpenCompare?: () => void;
  onOpenTechnicalEvaluation?: (participation: any) => void;
}

export function SellerQuotationReviewModal({
  isOpen,
  onClose,
  participation,
  procurementTitle,
  targetId,
  router,
  isTwoPacketMode,
  isFinancialStageOpened,
  isBidAwarded,
  canAward,
  isBuyer,
  onAwardVendor,
  onOpenCompare,
  onOpenTechnicalEvaluation,
}: SellerQuotationReviewModalProps) {
  const [previewDocument, setPreviewDocument] =
    useState<DocumentPreview | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<
    string | number | null
  >(null);

  const isFinancialSealed = Boolean(isTwoPacketMode && !isFinancialStageOpened);

  const handleViewAttachment = async (doc: any, docName: string) => {
    const rawUrl =
      doc.url || doc.fileUrl || doc.signedUrl || doc.documentUrl || "";
    const urlMatchId = String(rawUrl).match(
      /\/api\/(?:public\/)?files\/(\d+)/,
    )?.[1];

    const fileId =
      doc.fileAssetId ||
      doc.fileId ||
      (typeof doc.id === "number" || /^\d+$/.test(String(doc.id || ""))
        ? Number(doc.id)
        : urlMatchId
          ? Number(urlMatchId)
          : undefined);

    const effectiveUrl = rawUrl || (fileId ? `/api/files/${fileId}/view` : "");

    setPreviewLoadingId(doc.id || docName);
    try {
      if (fileId || effectiveUrl) {
        try {
          const prev = await getFileAssetPreview(
            {
              id: fileId,
              fileAssetId: fileId,
              url: effectiveUrl,
              fileName: doc.fileName || docName,
            },
            docName,
          );
          if (prev) {
            setPreviewDocument(prev);
            return;
          }
        } catch (e) {
          console.warn("getFileAssetPreview fallback to openFileAsset:", e);
        }

        await openFileAsset(
          {
            id: fileId,
            fileAssetId: fileId,
            originalName: doc.fileName || docName,
            url: effectiveUrl,
          },
          docName,
        );
        return;
      }

      toast.error("Document file is not available for preview.");
    } catch (err: any) {
      console.error("Failed to view attachment:", err);
      toast.error(
        err instanceof Error ? err.message : "Unable to open document file.",
      );
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const reviewLineItemsColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        key: "itemName",
        header: "Line Item & Specifications",
        width: "w-[40%] min-w-[280px]",
        cellClassName: "align-top",
        headerClassName: "w-[40%] min-w-[280px]",
        cell: (item, idx) => {
          const itemHsn = item.hsnCode || item.hsn_sac_code;
          const itemBrandPolicy = item.brandPolicy;
          const itemAttachments: any[] = Array.isArray(item.attachments) ? item.attachments : [];
          return (
            <div className="space-y-2 py-0.5">
              <div>
                <span className="font-bold text-slate-900 text-xs">
                  {item.itemName ||
                    item.name ||
                    item.description ||
                    `Item #${idx + 1}`}
                </span>
                {item.remarks && (
                  <p className="text-[10.5px] font-normal text-slate-500 mt-0.5 break-words">
                    {item.remarks}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {itemHsn && (
                  <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-indigo-800">
                    HSN: {itemHsn}
                  </span>
                )}
                {itemBrandPolicy && (
                  <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                    itemBrandPolicy === "EQUIVALENT_ACCEPTED"
                      ? "bg-purple-50 text-purple-800 border-purple-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}>
                    {itemBrandPolicy === "EQUIVALENT_ACCEPTED" ? "Equivalent OK" : "Strict Lock"}
                  </span>
                )}
                {item.model && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 break-words max-w-full">
                    <span className="font-bold text-slate-500">Model:</span> {item.model}
                  </span>
                )}
                {item.complianceStatus && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    {item.complianceStatus === "DEVIATION"
                      ? "⚠ Deviation"
                      : item.complianceStatus === "ALTERNATIVE"
                        ? "✦ Alternative"
                        : "✓ 100% Compliant"}
                  </span>
                )}
              </div>

              {item.specifications && (
                <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2 text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Offered Specifications:
                  </span>
                  <span className="break-words font-medium">{item.specifications}</span>
                </div>
              )}

              {itemAttachments.length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-[9.5px] font-bold uppercase text-slate-500 block">
                    Item Documents ({itemAttachments.length}):
                  </span>
                  <div className="flex flex-col gap-1">
                    {itemAttachments.map((att: any, attIdx: number) => {
                      const attName = att.fileName || att.name || att.documentName || `Document #${attIdx + 1}`;
                      const isAttLoading = previewLoadingId === (att.id || attName);
                      return (
                        <div
                          key={attIdx}
                          className="flex items-center justify-between rounded border border-slate-200 bg-white p-1.5 text-xs shadow-2xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-slate-800 truncate text-[11px]" title={attName}>
                              {attName}
                            </p>
                            <p className="text-[9px] font-medium text-slate-400">
                              {att.documentType ? att.documentType.replace(/_/g, " ") : "Technical Sheet"}
                              {att.customNote ? ` • ${att.customNote}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isAttLoading}
                            onClick={() => handleViewAttachment(att, attName)}
                            className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {isAttLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                            ) : (
                              <Eye className="h-3 w-3 text-blue-600" />
                            )}
                            View
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "makeBrand",
        header: "Make / Brand",
        width: "w-[14%] min-w-[100px]",
        cellClassName: "align-top",
        cell: (item) => (
          <div className="pt-0.5">
            <span className="text-slate-800 font-medium break-words text-xs">
              {item.makeBrand || item.brand || "—"}
            </span>
          </div>
        ),
      },
      {
        key: "quantity",
        header: "Qty",
        width: "w-[10%] min-w-[80px]",
        cellClassName: "align-top",
        align: "right",
        cell: (item) => {
          const q = Number(item.quantity ?? item.qty ?? 1);
          return (
            <div className="pt-0.5 flex justify-end">
              <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[11px] border border-slate-200 inline-flex items-center gap-1 whitespace-nowrap">
                <span>{q}</span>{" "}
                <span
                  className="text-[9px] font-semibold text-slate-500 uppercase truncate max-w-[60px]"
                  title={item.unitOfMeasure || item.unit || "Nos"}
                >
                  {sanitizeUom(item.unitOfMeasure || item.unit || "Nos")}
                </span>
              </span>
            </div>
          );
        },
      },
      {
        key: "unitRate",
        header: "Unit Rate (₹)",
        width: "w-[14%] min-w-[100px]",
        cellClassName: "align-top",
        align: "right",
        cell: (item) => {
          if (isFinancialSealed) {
            return (
              <div className="pt-0.5 flex justify-end">
                <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  <Lock className="h-2.5 w-2.5 text-indigo-500" /> Sealed
                </span>
              </div>
            );
          }
          const uPrice = Number(
            item.unitPrice ?? item.unitRate ?? item.rate ?? item.price ?? 0,
          );
          return (
            <div className="pt-0.5">
              <span className="tabular-nums font-bold text-slate-900 text-xs whitespace-nowrap">
                ₹
                {uPrice.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          );
        },
      },
      {
        key: "gst",
        header: "GST %",
        width: "w-[8%] min-w-[65px]",
        cellClassName: "align-top",
        align: "right",
        cell: (item) => {
          if (isFinancialSealed) {
            return (
              <div className="pt-0.5">
                <span className="text-slate-400 font-medium text-xs">—</span>
              </div>
            );
          }
          const gst = item.gstPercent != null ? Number(item.gstPercent) : 18;
          return (
            <div className="pt-0.5">
              <span className="tabular-nums font-semibold text-slate-700 text-xs">
                {gst}%
              </span>
            </div>
          );
        },
      },
      {
        key: "lineTotal",
        header: "Line Total (₹)",
        width: "w-[14%] min-w-[110px]",
        cellClassName: "align-top",
        align: "right",
        cell: (item) => {
          if (isFinancialSealed) {
            return (
              <div className="pt-0.5 flex justify-end">
                <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  <Lock className="h-2.5 w-2.5 text-indigo-500" /> Sealed
                </span>
              </div>
            );
          }
          const uPrice = Number(
            item.unitPrice ?? item.unitRate ?? item.rate ?? item.price ?? 0,
          );
          const q = Number(item.quantity ?? item.qty ?? 1);
          const gst = item.gstPercent != null ? Number(item.gstPercent) : 18;
          const tot =
            item.lineTotal != null || item.totalAmount != null
              ? Number(item.lineTotal ?? item.totalAmount)
              : uPrice * q * (1 + gst / 100);
          return (
            <div className="pt-0.5">
              <span className="font-black text-slate-900 tabular-nums text-xs whitespace-nowrap">
                ₹
                {tot.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          );
        },
      },
    ],
    [isFinancialSealed, previewLoadingId],
  );

  if (!isOpen || !participation) return null;

  const sellerOrg =
    participation.sellerOrgName ||
    participation.sellerOrganization?.organizationName ||
    participation.seller?.sellerProfile?.organizationName ||
    participation.seller?.organization?.organizationName ||
    participation.sellerProfile?.organizationName ||
    participation.companyName ||
    participation.sellerName ||
    participation.seller?.name ||
    participation.sellerUser?.name ||
    (participation.sellerId ||
    participation.sellerUserId ||
    (participation.id && !String(participation.id).startsWith("id-"))
      ? `Supplier #${participation.sellerId || participation.sellerUserId || participation.id}`
      : "Supplier Partner");

  const contactPerson =
    participation.sellerName ||
    participation.contactPerson ||
    participation.seller?.name ||
    participation.sellerUser?.name ||
    "N/A";
  const email =
    participation.sellerEmail ||
    participation.seller?.email ||
    participation.sellerUser?.email ||
    "N/A";
  const phone =
    participation.sellerPhone ||
    participation.seller?.mobile ||
    participation.seller?.phone ||
    participation.sellerUser?.mobile ||
    participation.sellerUser?.phone ||
    "N/A";

  const quotedAmount = Number(
    participation.totalAmount ||
      participation.quotedAmount ||
      participation.offeredPrice ||
      0,
  );
  const offeredQty =
    participation.offeredQuantity ||
    participation.quantity ||
    participation.responseData?.offeredQuantity ||
    participation.acknowledgement?.offeredQuantity ||
    "As Specified";
  const deliveryTimeline =
    participation.deliveryTimeline ||
    participation.responseData?.deliveryTimeline ||
    participation.acknowledgement?.deliveryTimeline ||
    "Standard";
  const paymentTerms =
    participation.terms ||
    participation.responseData?.paymentTerms ||
    participation.acknowledgement?.paymentTerms ||
    "Standard Payment Terms";
  const makeBrand =
    participation.makeBrand ||
    participation.responseData?.makeBrand ||
    participation.acknowledgement?.makeBrand ||
    participation.brand ||
    "—";
  const model =
    participation.model ||
    participation.responseData?.model ||
    participation.acknowledgement?.model ||
    "—";
  const techSpecs =
    participation.technicalSpecifications ||
    participation.specifications ||
    participation.responseData?.technicalSpecifications ||
    participation.responseData?.specifications ||
    participation.acknowledgement?.technicalSpecifications ||
    participation.acknowledgement?.specifications ||
    (participation.offeredItemDescription &&
    participation.offeredItemDescription !== participation.message
      ? participation.offeredItemDescription
      : "") ||
    (participation.responseData?.offeredItemDescription &&
    participation.responseData?.offeredItemDescription !==
      participation.responseData?.message
      ? participation.responseData?.offeredItemDescription
      : "") ||
    "";
  const complianceStatement =
    participation.complianceStatement ||
    participation.responseData?.complianceStatement ||
    participation.acknowledgement?.complianceStatement ||
    "";
  const submittedAt =
    participation.submittedAt ||
    participation.createdAt ||
    participation.updatedAt;
  const statusStr = String(
    participation.submissionStatus || participation.status || "Submitted",
  ).toUpperCase();
  const techStatus = String(
    participation.technicalStatus ||
      participation.responseData?.technicalStatus ||
      participation.acknowledgement?.technicalStatus ||
      "PENDING",
  ).toUpperCase();
  const techRemarks =
    participation.technicalRemarks ||
    participation.responseData?.technicalRemarks ||
    participation.acknowledgement?.technicalRemarks;
  const techScore =
    participation.technicalScore ??
    participation.responseData?.technicalScore ??
    participation.score;

  const candList = [
    participation.lineItems,
    participation.items,
    participation.lineQuotes,
    participation.responseData?.lineItems,
    participation.responseData?.items,
    participation.responseData?.lineQuotes,
    participation.responseData?.boqTable,
    participation.details?.lineItems,
    participation.details?.items,
    participation.quotation?.lineItems,
    participation.quotation?.items,
    participation.acknowledgement?.responseData?.lineItems,
    participation.acknowledgement?.responseData?.lineQuotes,
    participation.acknowledgement?.lineItems,
    participation.acknowledgement?.items,
    participation.boqTable,
  ];
  let lineItems: any[] = [];
  for (const arr of candList) {
    if (Array.isArray(arr) && arr.length > lineItems.length) {
      lineItems = arr;
    }
  }
  const docs: any[] =
    Array.isArray(participation.documents) && participation.documents.length
      ? participation.documents
      : Array.isArray(participation.responseData?.documents) &&
          participation.responseData.documents.length
        ? participation.responseData.documents
        : Array.isArray(participation.acknowledgement?.documents) &&
            participation.acknowledgement.documents.length
          ? participation.acknowledgement.documents
          : [];
  const message =
    participation.offeredItemDescription ||
    participation.message ||
    participation.responseData?.message ||
    participation.acknowledgement?.offeredItemDescription ||
    "";

  const handleDownloadQuotationPdf = async () => {
    try {
      const supplierReg =
        (participation.supplier?.registrationDetails as Record<string, any>) ||
        {};
      const supplierLogo =
        participation.supplier?.organization?.profile?.logoUrl ||
        supplierReg.logoUrl ||
        participation.supplier?.organization?.logoFile?.url ||
        participation.supplier?.organization?.logoFile?.fileUrl ||
        (participation.supplier?.organization?.organizationLogoFileId
          ? `/api/files/${participation.supplier.organization.organizationLogoFileId}/view`
          : null) ||
        (participation.supplier?.organization?.organizationLogoFileId
          ? `/api/files/${participation.supplier.organization.organizationLogoFileId}/download`
          : null);

      const supplierSig = supplierReg.signatureUrl || null;
      const supplierStamp = supplierReg.stampUrl || null;

      const engine = new PdfEngine("p");
      const hasLineItems = lineItems.length > 0;
      const doc = await engine.generate({
        documentTitle: "SUPPLIER QUOTATION RESPONSE",
        documentNumber: `QUOTE-${targetId}`,
        dateStr: formatDate(submittedAt || new Date()),
        status: statusStr,
        issuerName: sellerOrg,
        issuerSubtitle: "Supplier Official Quotation Response",
        issuerLogo: supplierLogo,
        sellerSignatureUrl: supplierSig,
        sellerStampUrl: supplierStamp,
        parties: [
          {
            title: "BUYER ORGANIZATION",
            name: procurementTitle || "Procurement Buyer",
            details: [`Procurement ID: ${targetId}`],
          },
          {
            title: "SUPPLIER / QUOTING ORGANIZATION",
            name: sellerOrg,
            email: email !== "N/A" ? email : "N/A",
            phone: phone !== "N/A" ? phone : "N/A",
            details: [
              `Contact Person: ${contactPerson !== "N/A" ? contactPerson : "Authorized Representative"}`,
              `Submitted Date: ${formatDateTime(submittedAt)}`,
            ],
          },
        ],
        infoGrid: {
          "Make / Brand": makeBrand,
          "Model / Specs": model,
          "Delivery Timeline": deliveryTimeline,
          "Payment Terms": paymentTerms,
          "Offered Quantity": String(offeredQty),
        },
        tableHeaders: hasLineItems
          ? [
              "#",
              "Item Description",
              "Make / Brand",
              "Qty",
              "Unit Price",
              "GST %",
              "Line Total",
            ]
          : ["#", "Offered Item Description", "Offered Qty", "Quoted Value"],
        tableData: hasLineItems
          ? lineItems.map((item: any, idx: number) => {
              const uPrice = Number(
                item.unitPrice ?? item.unitRate ?? item.rate ?? item.price ?? 0,
              );
              const q = Number(item.quantity ?? item.qty ?? 1);
              const gst =
                item.gstPercent != null ? Number(item.gstPercent) : 18;
              const tot =
                item.lineTotal != null || item.totalAmount != null
                  ? Number(item.lineTotal ?? item.totalAmount)
                  : uPrice * q * (1 + gst / 100);
              return [
                String(idx + 1),
                item.itemName ||
                  item.name ||
                  item.description ||
                  `Item #${idx + 1}`,
                item.makeBrand || item.brand || "—",
                `${q} ${item.unitOfMeasure || item.unit || "Nos"}`,
                isFinancialSealed ? "Sealed" : moneyPdf(uPrice),
                isFinancialSealed ? "—" : `${gst}%`,
                isFinancialSealed ? "Sealed" : moneyPdf(tot),
              ];
            })
          : [
              [
                "1",
                message || "Procurement item quotation",
                String(offeredQty),
                isFinancialSealed
                  ? "Sealed (Stage 2)"
                  : quotedAmount > 0
                    ? moneyPdf(quotedAmount)
                    : "Sealed Rate",
              ],
            ],
        financials: {
          grandTotal: isFinancialSealed ? 0 : quotedAmount,
        },
        terms: message ? [`Supplier Remarks: ${message}`] : [],
        footerNote:
          "MSME Enterprise Procurement Portal — Official Quotation Record",
      });

      doc.save(
        `Quotation_${sellerOrg.replace(/[^a-zA-Z0-9]/g, "_")}_${targetId}.pdf`,
      );
      toast.success("Quotation PDF downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate Quotation PDF");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quotation-review-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn overflow-y-auto"
    >
      <FocusTrap active={isOpen} onEscape={onClose} className="w-full max-w-5xl xl:max-w-6xl my-auto">
        <div className="flex max-h-[92vh] w-full flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
          {/* Enhanced Header */}
          <div className="relative shrink-0 border-b border-blue-900/40 bg-gradient-to-r from-[#0d2137] via-[#1B365D] to-[#1e3a8a] px-6 py-4 text-white shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded bg-emerald-400/20 border border-emerald-300/40 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-emerald-200">
                    {statusStr}
                  </span>
                  {isFinancialSealed ? (
                    <span className="rounded bg-indigo-400/20 border border-indigo-300/40 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-indigo-200 inline-flex items-center gap-1">
                      <Lock className="h-3 w-3 text-indigo-300" /> Stage 1: Technical Scrutiny (Financials Sealed)
                    </span>
                  ) : isTwoPacketMode ? (
                    <span className="rounded bg-emerald-400/20 border border-emerald-300/40 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-emerald-200 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-300" /> Stage 2: Financials Unsealed
                    </span>
                  ) : (
                    <span className="rounded bg-sky-400/20 border border-sky-300/40 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-sky-200 inline-flex items-center gap-1">
                      <FileText className="h-3 w-3 text-sky-300" /> Single-Packet Commercial Quotation
                    </span>
                  )}
                </div>
                <h2 id="quotation-review-modal-title" className="text-base sm:text-lg font-black text-white mt-1 break-words">
                  {sellerOrg}
                </h2>
                {procurementTitle && (
                  <p className="text-xs font-medium text-blue-200/90 break-words max-w-2xl mt-0.5">
                    For: {procurementTitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isFinancialSealed && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadQuotationPdf}
                    className="flex items-center gap-1.5 border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Download PDF</span>
                  </Button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-blue-200 hover:bg-white/15 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-label="Close quotation review modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 sm:space-y-5 custom-scrollbar">
            {/* Top Highlights KPI Metric Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Total Quoted Value
                </span>
                <div className="mt-1 text-base sm:text-lg font-black text-slate-900 break-words">
                  {isFinancialSealed ? (
                    <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-indigo-700">
                      <Lock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      Sealed (Stage 2)
                    </span>
                  ) : quotedAmount > 0 ? (
                    `₹${quotedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                  ) : (
                    "Rates On File"
                  )}
                </div>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                  {isFinancialSealed ? "Unlocks upon technical qualification" : "Total quoted value (incl. GST)"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Delivery Timeline SLA
                </span>
                <div className="mt-1 text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="break-words leading-tight">{deliveryTimeline}</span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                  Promised fulfillment window
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Quoted Scope &amp; Qty
                </span>
                <div className="mt-1 text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="break-words leading-tight">{offeredQty}</span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                  {lineItems.length > 0 ? `${lineItems.length} line item(s) quoted` : "Offered delivery scope"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Technical Compliance
                </span>
                <div className="mt-1 text-base sm:text-lg font-black break-words">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-xs sm:text-sm font-bold",
                    complianceStatement === "WITH_DEVIATION"
                      ? "text-amber-700"
                      : complianceStatement === "ALTERNATIVE_OFFERED"
                        ? "text-purple-700"
                        : "text-emerald-700"
                  )}>
                    {complianceStatement === "WITH_DEVIATION" ? (
                      "⚠ Minor Deviation"
                    ) : complianceStatement === "ALTERNATIVE_OFFERED" ? (
                      "✦ Alternative Offered"
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>100% Compliant</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                  Seller declaration status
                </p>
              </div>
            </div>

            {/* TWO-PACKET ONLY: Stage 1 Technical Packet Evaluation Summary Card */}
            {isTwoPacketMode && (
              <div
                className={`rounded-xl border p-4 transition-all ${
                  techStatus === "QUALIFIED"
                    ? "border-emerald-200 bg-emerald-50/60"
                    : techStatus === "DISQUALIFIED"
                      ? "border-rose-200 bg-rose-50/60"
                      : "border-amber-200 bg-amber-50/60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        techStatus === "QUALIFIED"
                          ? "bg-emerald-100 text-emerald-700"
                          : techStatus === "DISQUALIFIED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Stage 1 Evaluation:
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${
                            techStatus === "QUALIFIED"
                              ? "bg-emerald-100 border border-emerald-300 text-emerald-800"
                              : techStatus === "DISQUALIFIED"
                                ? "bg-rose-100 border border-rose-300 text-rose-800"
                                : "bg-amber-100 border border-amber-300 text-amber-800"
                          }`}
                        >
                          {techStatus === "QUALIFIED" && (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {techStatus === "DISQUALIFIED" && (
                            <XCircle className="h-3 w-3" />
                          )}
                          {techStatus === "PENDING" && (
                            <Clock className="h-3 w-3" />
                          )}
                          {techStatus === "QUALIFIED"
                            ? "Technically Qualified"
                            : techStatus === "DISQUALIFIED"
                              ? "Disqualified (Failed Tech Packet)"
                              : "Pending Technical Review"}
                        </span>
                        {techScore != null && (
                          <span className="rounded-md bg-white/80 border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                            Score: {techScore}/100
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {techStatus === "QUALIFIED"
                          ? "This vendor has passed technical scrutiny and is eligible for Stage 2 commercial opening / reverse auction."
                          : techStatus === "DISQUALIFIED"
                            ? "This vendor has been disqualified at Stage 1 and will NOT be admitted to Stage 2 financial opening."
                            : "Technical packet must be evaluated and qualified before this vendor can participate in Stage 2 commercial opening."}
                      </p>
                      {techRemarks && (
                        <div className="mt-2 rounded-lg bg-white/90 border border-slate-200 p-2 text-xs text-slate-800">
                          <span className="font-bold text-slate-500">
                            Evaluation Remarks:{" "}
                          </span>
                          {techRemarks}
                        </div>
                      )}
                    </div>
                  </div>
                  {isBuyer && onOpenTechnicalEvaluation && !isBidAwarded && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onOpenTechnicalEvaluation(participation);
                      }}
                      className={`font-bold text-xs shadow-xs cursor-pointer ${
                        techStatus === "QUALIFIED"
                          ? "border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
                          : techStatus === "DISQUALIFIED"
                            ? "border border-rose-300 bg-white text-rose-800 hover:bg-rose-50"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                      {techStatus === "PENDING"
                        ? "Evaluate Technical Packet"
                        : "Update Technical Evaluation"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Supplier Profile & Commercial Terms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Supplier Organization &amp; Representative
                  </h4>
                </div>
                <div className="text-xs space-y-1.5 text-slate-700 font-medium">
                  <p className="flex justify-between items-center py-0.5 border-b border-slate-50">
                    <span className="text-slate-400 font-bold">Company:</span>
                    <span className="font-bold text-slate-900 text-right">{sellerOrg}</span>
                  </p>
                  <p className="flex justify-between items-center py-0.5 border-b border-slate-50">
                    <span className="text-slate-400 font-bold">Representative:</span>
                    <span className="font-bold text-slate-800 text-right">{contactPerson}</span>
                  </p>
                  <p className="flex justify-between items-center py-0.5 border-b border-slate-50">
                    <span className="text-slate-400 font-bold">Email:</span>
                    <span className="text-blue-600 font-medium text-right">{email}</span>
                  </p>
                  <p className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-bold">Contact Phone:</span>
                    <span className="font-bold text-slate-800 text-right">{phone}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <IndianRupee className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Commercial &amp; Submission Terms
                  </h4>
                </div>
                <div className="text-xs space-y-1.5 text-slate-700 font-medium">
                  <p className="flex justify-between items-center py-0.5 border-b border-slate-50">
                    <span className="text-slate-400 font-bold">Total Quoted:</span>
                    {isFinancialSealed ? (
                      <span className="font-bold text-indigo-700 inline-flex items-center gap-1">
                        <Lock className="h-3 w-3 text-indigo-500" /> Sealed (Stage 2)
                      </span>
                    ) : quotedAmount > 0 ? (
                      <span className="font-black text-emerald-700">
                        ₹{quotedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-slate-500">Rates On File</span>
                    )}
                  </p>
                  <p className="flex justify-between items-center py-0.5 border-b border-slate-50">
                    <span className="text-slate-400 font-bold">Payment Terms:</span>
                    <span className="font-bold text-slate-800 text-right">{paymentTerms}</span>
                  </p>
                  <p className="flex justify-between items-center py-0.5 border-b border-slate-50">
                    <span className="text-slate-400 font-bold">Delivery Terms:</span>
                    <span className="font-bold text-slate-800 text-right">{deliveryTimeline}</span>
                  </p>
                  <p className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-bold">Submission Time:</span>
                    <span className="font-semibold text-slate-600 text-right">
                      {submittedAt ? formatDateTime(submittedAt) : "—"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Technical Specifications, Model & Remarks */}
            {(makeBrand !== "—" || model !== "—" || techSpecs || message) && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-700">
                    <Tag className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Offered Product Specifications &amp; Parameters
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Make / Brand
                    </span>
                    <p className="font-bold text-slate-900 break-words leading-tight" title={makeBrand}>{makeBrand}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Model / Ref No
                    </span>
                    <p className="font-bold text-slate-900 break-words leading-tight" title={model}>{model}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Offered Quantity
                    </span>
                    <p className="font-bold text-slate-900 break-words leading-tight">{offeredQty}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Delivery Window
                    </span>
                    <p className="font-bold text-slate-900 break-words leading-tight">{deliveryTimeline}</p>
                  </div>
                </div>

                {techSpecs && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Technical Specifications:
                    </span>
                    <p className="whitespace-pre-wrap font-medium leading-relaxed text-slate-700 break-words">
                      {techSpecs}
                    </p>
                  </div>
                )}

                {message && message !== techSpecs && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Supplier Remarks / Cover Note:
                    </span>
                    <p className="whitespace-pre-wrap font-medium text-slate-700 leading-relaxed break-words">
                      "{message}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Quoted Line Items Breakdown Table */}
            {lineItems.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-slate-500" /> Quoted Line Items Breakdown ({lineItems.length})
                  </h4>
                  {isFinancialSealed && (
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      <Lock className="h-2.5 w-2.5 text-indigo-500" /> Rates sealed under Stage 2
                    </span>
                  )}
                </div>
                <DataTable<any>
                  data={lineItems}
                  columns={reviewLineItemsColumns}
                  keyExtractor={(item, idx) => String(item.id || idx)}
                  showSrNo={false}
                  minWidth="w-full min-w-[720px]"
                  tableClassName="table-fixed"
                  emptyTitle="No line items"
                  emptyDescription="No line items attached."
                  footer={
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider"
                      >
                        Total Quoted Value (incl. GST)
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-black tabular-nums">
                        {isFinancialSealed ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                            <Lock className="h-3 w-3 text-indigo-500" /> Commercial Bid Sealed (Stage 2)
                          </span>
                        ) : quotedAmount > 0 ? (
                          <span className="text-emerald-700 font-black">
                            ₹{quotedAmount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  }
                />
              </div>
            )}

            {/* Proposal Files & Attachments */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-500" /> Supplier Proposal Files &amp; Attachments
              </h4>
              {docs.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                  No file attachments uploaded with this quotation.
                </p>
              ) : (
                (() => {
                  const techDocs = docs.filter((d: any) => {
                    const c = String(d.documentCategory || d.documentType || "").toLowerCase();
                    const n = String(d.documentName || d.fileName || d.name || "").toLowerCase();
                    return c.includes("tech") || c.includes("spec") || c.includes("compliance") || n.includes("tech") || n.includes("spec");
                  });
                  const finDocs = docs.filter((d: any) => {
                    const c = String(d.documentCategory || d.documentType || "").toLowerCase();
                    const n = String(d.documentName || d.fileName || d.name || "").toLowerCase();
                    return c.includes("finan") || c.includes("quote") || c.includes("price") || n.includes("price") || n.includes("quote") || n.includes("cost");
                  });
                  const boqDocs = docs.filter((d: any) => {
                    const c = String(d.documentCategory || d.documentType || "").toLowerCase();
                    const n = String(d.documentName || d.fileName || d.name || "").toLowerCase();
                    return c.includes("boq") || c.includes("schedule") || n.includes("boq") || n.includes("sheet") || n.includes("excel");
                  });
                  const otherDocs = docs.filter((d: any) => !techDocs.includes(d) && !finDocs.includes(d) && !boqDocs.includes(d));

                  const renderDocItem = (doc: any, idx: number, iconColor: string) => {
                    const docName = doc.documentName || doc.name || doc.fileName || `Attachment #${idx + 1}`;
                    const isCurrentlyLoading = previewLoadingId === (doc.id || docName);
                    return (
                      <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className={`h-4 w-4 ${iconColor} shrink-0`} />
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-900 truncate" title={docName}>{docName}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{doc.documentCategory || doc.documentType || "Proposal Document"}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isCurrentlyLoading}
                          onClick={(e) => { e.stopPropagation(); handleViewAttachment(doc, docName); }}
                          className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isCurrentlyLoading ? <Loader2 className="h-3 w-3 animate-spin text-blue-600" /> : <Eye className="h-3 w-3 text-blue-600" />}
                          View
                        </button>
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-3">
                      {techDocs.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">
                            Technical Specifications &amp; Datasheets ({techDocs.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {techDocs.map((d: any, i: number) => renderDocItem(d, i, "text-blue-600"))}
                          </div>
                        </div>
                      )}
                      {finDocs.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                            Financial Proposals &amp; Detailed Quotations ({finDocs.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {finDocs.map((d: any, i: number) => renderDocItem(d, i, "text-emerald-600"))}
                          </div>
                        </div>
                      )}
                      {boqDocs.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">
                            BOQ &amp; Rate Schedules ({boqDocs.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {boqDocs.map((d: any, i: number) => renderDocItem(d, i, "text-purple-600"))}
                          </div>
                        </div>
                      )}
                      {otherDocs.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                            Statutory &amp; Compliance Attachments ({otherDocs.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {otherDocs.map((d: any, i: number) => renderDocItem(d, i, "text-slate-600"))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="relative shrink-0 flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer shadow-2xs"
            >
              Close
            </Button>

            {isBuyer && (
              <div className="flex items-center gap-2 flex-wrap">
                {onOpenCompare && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onOpenCompare();
                    }}
                    className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer shadow-2xs"
                  >
                    <Scale className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    Compare Quotations
                  </Button>
                )}

                {/* Evaluate Bid / Technical Packet button for both single and two-packet mode */}
                {onOpenTechnicalEvaluation && !isBidAwarded && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onOpenTechnicalEvaluation(participation);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-xs cursor-pointer"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                    {techStatus === "PENDING"
                      ? "Evaluate Bid (Qualify / Disqualify)"
                      : "Update Evaluation Decision"}
                  </Button>
                )}

                {/* View Results & Award: Direct link to official Results & Commercial Ranking page */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    router.push(`/bids/${targetId}/results`);
                  }}
                  className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs cursor-pointer shadow-2xs"
                >
                  <Trophy className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  View Results &amp; Award
                </Button>
              </div>
            )}
          </div>
        </div>
      </FocusTrap>

      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          previewDocument={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}

interface QuotationComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  participations: any[];
  initialSelectedSellerIds?: string[];
  procurementTitle?: string;
  targetId: string;
  router: any;
  onSelectQuotationReview?: (participation: any) => void;
}

export function QuotationComparisonModal({
  isOpen,
  onClose,
  participations = [],
  initialSelectedSellerIds,
  procurementTitle,
  targetId,
  router,
  onSelectQuotationReview,
}: QuotationComparisonModalProps) {
  const list = participations || [];
  const [activeSelectedIds, setActiveSelectedIds] = useState<string[]>(() => {
    if (initialSelectedSellerIds && initialSelectedSellerIds.length > 0)
      return initialSelectedSellerIds;
    return list.map((p) => String(p.id || p.sellerId || p.sellerUserId));
  });

  useEffect(() => {
    if (initialSelectedSellerIds && initialSelectedSellerIds.length > 0) {
      setActiveSelectedIds(initialSelectedSellerIds);
    } else if (list.length > 0) {
      setActiveSelectedIds(
        list.map((p) => String(p.id || p.sellerId || p.sellerUserId)),
      );
    }
  }, [initialSelectedSellerIds, participations, isOpen]);

  const displayParticipations = useMemo(() => {
    if (!activeSelectedIds || activeSelectedIds.length === 0) return list;
    const filtered = list.filter((p) => {
      const pId = p.id != null ? String(p.id) : "";
      const pSellerId = p.sellerId != null ? String(p.sellerId) : "";
      const pSellerUserId =
        p.sellerUserId != null ? String(p.sellerUserId) : "";
      return (
        (pId && activeSelectedIds.includes(pId)) ||
        (pSellerId && activeSelectedIds.includes(pSellerId)) ||
        (pSellerUserId && activeSelectedIds.includes(pSellerUserId))
      );
    });
    return filtered.length > 0 ? filtered : list;
  }, [list, activeSelectedIds]);

  // Sort participations by quoted total price ascending (L1, L2, L3...)
  const sorted = useMemo(() => {
    return [...displayParticipations].sort((a, b) => {
      const pA = Number(
        a.totalAmount || a.quotedAmount || a.offeredPrice || Infinity,
      );
      const pB = Number(
        b.totalAmount || b.quotedAmount || b.offeredPrice || Infinity,
      );
      return pA - pB;
    });
  }, [displayParticipations]);

  if (!isOpen || !participations || participations.length === 0) return null;

  const lowestPrice = Number(
    sorted[0]?.totalAmount ||
      sorted[0]?.quotedAmount ||
      sorted[0]?.offeredPrice ||
      0,
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-800 flex items-center gap-1">
                <Layers className="h-3 w-3" /> L1 Commercial Comparison Matrix
              </span>
              <span className="text-xs font-bold text-slate-400">
                {sorted.length} Proposals Submitted
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-0.5">
              Supplier Quotations Side-by-Side Comparison
            </h2>
            {procurementTitle && (
              <p className="text-xs font-semibold text-slate-500 truncate max-w-lg">
                Procurement: {procurementTitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Top L1 Highlight Metric */}
          {lowestPrice > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    L1 Lowest Quoted Price
                  </p>
                  <p className="text-lg font-black text-emerald-950">
                    ₹{lowestPrice.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-emerald-200/80 px-2.5 py-1 text-xs font-black text-emerald-900 uppercase">
                  L1 Supplier:{" "}
                  {sorted[0]?.seller?.sellerProfile?.organizationName ||
                    sorted[0]?.seller?.organization?.organizationName ||
                    sorted[0]?.sellerOrganization?.organizationName ||
                    sorted[0]?.seller?.name ||
                    sorted[0]?.sellerUser?.name ||
                    "L1 Bidder"}
                </span>
              </div>
            </div>
          )}

          {/* Matrix Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 font-black text-slate-600 uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 border-r border-slate-200 w-[200px] bg-slate-100">
                      Comparison Parameter
                    </th>
                    {sorted.map((r, i) => {
                      const amount = Number(
                        r.totalAmount || r.quotedAmount || r.offeredPrice || 0,
                      );
                      const isL1 = i === 0 && lowestPrice > 0;
                      const sellerOrg =
                        r.seller?.sellerProfile?.organizationName ||
                        r.seller?.organization?.organizationName ||
                        r.sellerOrganization?.organizationName ||
                        r.seller?.name ||
                        r.sellerUser?.name ||
                        `Supplier #${r.sellerId || r.sellerUserId}`;

                      return (
                        <th
                          key={r.id || i}
                          className={`p-3.5 border-r border-slate-200 text-center min-w-[200px] ${isL1 ? "bg-emerald-50/70" : ""}`}
                        >
                          <div className="font-extrabold text-slate-950 text-xs">
                            {sellerOrg}
                          </div>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                isL1
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {isL1 ? "L1 - Lowest Quote" : `L${i + 1}`}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                  {/* Quoted Total Amount */}
                  <tr className="bg-slate-50/50">
                    <td className="p-3.5 border-r border-slate-200 font-black text-slate-900">
                      Total Quoted Amount (INR)
                    </td>
                    {sorted.map((r, i) => {
                      const amount = Number(
                        r.totalAmount || r.quotedAmount || r.offeredPrice || 0,
                      );
                      const isL1 = i === 0 && lowestPrice > 0;
                      return (
                        <td
                          key={r.id || i}
                          className={`p-3.5 border-r border-slate-200 text-center font-black text-sm ${isL1 ? "bg-emerald-50 text-emerald-950 font-black" : "text-slate-900"}`}
                        >
                          {amount > 0
                            ? `₹${amount.toLocaleString("en-IN")}`
                            : "Sealed / Rates On File"}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Offered Quantity */}
                  <tr>
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                      Offered Quantity
                    </td>
                    {sorted.map((r, i) => (
                      <td
                        key={r.id || i}
                        className="p-3.5 border-r border-slate-200 text-center"
                      >
                        {r.offeredQuantity || r.quantity || "As Specified"}
                      </td>
                    ))}
                  </tr>

                  {/* Delivery Timeline */}
                  <tr className="bg-slate-50/50">
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                      Delivery Timeline
                    </td>
                    {sorted.map((r, i) => (
                      <td
                        key={r.id || i}
                        className="p-3.5 border-r border-slate-200 text-center"
                      >
                        {r.deliveryTimeline ||
                          r.responseData?.deliveryTimeline ||
                          "Standard"}
                      </td>
                    ))}
                  </tr>

                  {/* Payment Terms */}
                  <tr>
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                      Payment Terms
                    </td>
                    {sorted.map((r, i) => (
                      <td
                        key={r.id || i}
                        className="p-3.5 border-r border-slate-200 text-center truncate max-w-[180px]"
                      >
                        {r.terms ||
                          r.responseData?.paymentTerms ||
                          "Standard Terms"}
                      </td>
                    ))}
                  </tr>

                  {/* Brand / Make Offered */}
                  <tr className="bg-slate-50/50">
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                      Brand / Make Offered
                    </td>
                    {sorted.map((r, i) => (
                      <td
                        key={r.id || i}
                        className="p-3.5 border-r border-slate-200 text-center"
                      >
                        {r.makeBrand ||
                          r.responseData?.makeBrand ||
                          "As per specification"}
                      </td>
                    ))}
                  </tr>

                  {/* Submitted Date */}
                  <tr>
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                      Submission Date & Time
                    </td>
                    {sorted.map((r, i) => {
                      const dt = r.submittedAt || r.createdAt || r.updatedAt;
                      return (
                        <td
                          key={r.id || i}
                          className="p-3.5 border-r border-slate-200 text-center text-slate-500 font-medium"
                        >
                          {dt ? formatDateTime(dt) : "—"}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Status */}
                  <tr className="bg-slate-50/50">
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                      Quotation Status
                    </td>
                    {sorted.map((r, i) => (
                      <td
                        key={r.id || i}
                        className="p-3.5 border-r border-slate-200 text-center"
                      >
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                          {r.submissionStatus || r.status || "SUBMITTED"}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Actions */}
                  <tr>
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">
                      Action
                    </td>
                    {sorted.map((r, i) => (
                      <td
                        key={r.id || i}
                        className="p-3.5 border-r border-slate-200 text-center"
                      >
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onClose();
                            onSelectQuotationReview?.(r);
                          }}
                          className="h-7 text-[11px] font-extrabold bg-[#12335f] hover:bg-[#0b2445] text-white"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="font-bold"
          >
            Close Comparison
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/bids/${targetId}/results`);
            }}
            className="bg-[#12335f] hover:bg-[#0b2445] font-bold text-white shadow-sm"
          >
            Proceed to Evaluation & Award
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SelectQuotationsToCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  participations: any[];
  onConfirmCompare: (selectedIds: string[]) => void;
}

export function SelectQuotationsToCompareModal({
  isOpen,
  onClose,
  participations = [],
  onConfirmCompare,
}: SelectQuotationsToCompareModalProps) {
  const list = participations || [];
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    list.map((p) => String(p.id || p.sellerId || p.sellerUserId)),
  );

  useEffect(() => {
    if (list.length > 0) {
      setSelectedIds(
        list.map((p) => String(p.id || p.sellerId || p.sellerUserId)),
      );
    }
  }, [participations, isOpen]);

  if (!isOpen || !participations || participations.length === 0) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const allIds = participations.map((p) =>
      String(p.id || p.sellerId || p.sellerUserId),
    );
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const handleStartCompare = () => {
    if (selectedIds.length < 2) {
      toast.info("Please select at least 2 quotations to compare.");
      return;
    }
    onConfirmCompare(selectedIds);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-800 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Select Bids
              </span>
            </div>
            <h2 className="text-base font-black text-slate-900 mt-0.5">
              Select Quotations to Compare
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Choose 2 or more seller quotations to compare side-by-side.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List of Sellers with Checkboxes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <div className="flex items-center justify-between px-2 py-1 text-xs">
            <span className="font-extrabold text-slate-700">
              {selectedIds.length} of {participations.length} Selected
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="font-bold text-blue-600 hover:underline"
            >
              {selectedIds.length === participations.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          <div className="space-y-2">
            {participations.map((p) => {
              const pId = String(p.id || p.sellerId || p.sellerUserId);
              const isChecked = selectedIds.includes(pId);
              const sellerOrg =
                p.seller?.sellerProfile?.organizationName ||
                p.seller?.organization?.organizationName ||
                p.sellerOrganization?.organizationName ||
                p.seller?.name ||
                p.sellerUser?.name ||
                `Supplier #${pId}`;
              const contactName = p.seller?.name || p.sellerUser?.name || "";
              const amount = Number(
                p.totalAmount || p.quotedAmount || p.offeredPrice || 0,
              );

              return (
                <div
                  key={pId}
                  onClick={() => toggleSelect(pId)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all",
                    isChecked
                      ? "border-blue-500 bg-blue-50/60 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                    />
                    <div>
                      <p className="text-xs font-black text-slate-900">
                        {sellerOrg}
                      </p>
                      {contactName && contactName !== sellerOrg && (
                        <p className="text-[10px] font-medium text-slate-400">
                          Contact: {contactName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">
                      {amount > 0
                        ? `₹${amount.toLocaleString("en-IN")}`
                        : "Sealed Rate"}
                    </p>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                      {p.submissionStatus || p.status || "Submitted"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="font-bold text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleStartCompare}
            disabled={selectedIds.length < 2}
            className="bg-[#12335f] hover:bg-[#0b2445] font-bold text-xs text-white shadow-sm disabled:opacity-50"
          >
            Compare Selected ({selectedIds.length})
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ProcurementDetailSkeleton } from "../../../components/ui/skeleton";
