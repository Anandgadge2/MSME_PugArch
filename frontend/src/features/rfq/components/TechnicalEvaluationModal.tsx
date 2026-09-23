"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  ExternalLink,
  Download,
  ShieldCheck,
  Award,
  HelpCircle,
  Loader2,
  Eye,
  Package,
  Lock,
  Building2,
  Calendar,
  UserCheck,
  Check,
} from "lucide-react";
import { FocusTrap } from "../../../components/ui/FocusTrap";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";
import { procurementBidApi } from "../../procurementBid/api";
import { useQueryClient } from "@tanstack/react-query";
import { postApi } from "../../shared/apiClient";
import { DocumentPreviewModal } from "../../../components/DocumentPreviewModal";
import {
  getFileAssetPreview,
  openFileAsset,
  type DocumentPreview,
} from "../../../lib/files";

export interface TechnicalEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  participation: any;
  bidId?: string;
  procurementId?: string | number;
  procurementTitle?: string;
  readOnly?: boolean;
  isFinancialStageOpened?: boolean;
  isStage2Active?: boolean;
  bidStatus?: string;
  isTwoPacketMode?: boolean;
  packetType?: string;
  onEvaluationSuccess?: () => void;
  onSuccess?: () => void;
}

export function TechnicalEvaluationModal({
  isOpen,
  onClose,
  participation,
  bidId,
  procurementId,
  procurementTitle,
  readOnly = false,
  isFinancialStageOpened = false,
  isStage2Active = false,
  bidStatus,
  isTwoPacketMode,
  packetType,
  onEvaluationSuccess,
  onSuccess,
}: TechnicalEvaluationModalProps) {
  const effectiveBidId = String(bidId || procurementId || "");
  const handleSuccessCallback = onEvaluationSuccess || onSuccess;
  const queryClient = useQueryClient();

  // Resolve packet type to correctly handle single packet vs two packet workflow
  const resolvedPacketType = String(
    packetType ||
    participation?.packetType ||
    participation?.bid?.packetType ||
    participation?.procurementBid?.packetType ||
    participation?.tender?.packetType ||
    ""
  ).toUpperCase();

  const isSinglePacket =
    isTwoPacketMode !== undefined
      ? !isTwoPacketMode
      : resolvedPacketType.includes("SINGLE") ||
        resolvedPacketType === "1" ||
        (!resolvedPacketType.includes("TWO") && resolvedPacketType !== "2" && !isStage2Active && !isFinancialStageOpened);

  const [decision, setDecision] = useState<"QUALIFIED" | "DISQUALIFIED">(
    "QUALIFIED",
  );
  const [initialDecision, setInitialDecision] = useState<"QUALIFIED" | "DISQUALIFIED">("QUALIFIED");
  const [score, setScore] = useState<string>("");
  const [initialScore, setInitialScore] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [initialRemarks, setInitialRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const [previewDocument, setPreviewDocument] =
    useState<DocumentPreview | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<
    string | number | null
  >(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const rawTechStatus = String(
    participation?.technicalStatus ||
      participation?.rawParticipation?.technicalStatus ||
      participation?.details?.technicalStatus ||
      (participation?.isDisqualified ? "DISQUALIFIED" : "")
  ).toUpperCase();

  const isAlreadyQualified =
    rawTechStatus === "QUALIFIED" ||
    rawTechStatus === "ACCEPTED" ||
    rawTechStatus === "SHORTLISTED";
  const isAlreadyDisqualified =
    rawTechStatus === "DISQUALIFIED" ||
    rawTechStatus === "REJECTED" ||
    Boolean(participation?.isDisqualified);
  const isAlreadyEvaluated = isAlreadyQualified || isAlreadyDisqualified;

  const rawBidStatus = String(
    bidStatus ||
      participation?.bidStatus ||
      participation?.lifecycleStage ||
      ""
  ).toUpperCase();

  const isStage2ActiveEffective = Boolean(
    readOnly ||
      isFinancialStageOpened ||
      isStage2Active ||
      [
        "FINANCIAL_EVALUATION",
        "L1_GENERATED",
        "AWARD_RECOMMENDED",
        "AWARDED",
        "PO_GENERATED",
        "PO_ISSUED",
        "COMPLETED",
        "TECHNICAL_EVALUATION_COMPLETED",
        "REVERSE_AUCTION_ACTIVE",
        "REVERSE_AUCTION_SCHEDULED",
      ].includes(rawBidStatus)
  );

  const isEffectiveReadOnly = Boolean(readOnly || isStage2ActiveEffective);

  useEffect(() => {
    if (isOpen && formRef.current) {
      formRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (participation && isOpen) {
      const currentTechStatus = String(
        participation.technicalStatus ||
          participation.rawParticipation?.technicalStatus ||
          participation.details?.technicalStatus ||
          (participation.isDisqualified ? "DISQUALIFIED" : "")
      ).toUpperCase();

      const initDec: "QUALIFIED" | "DISQUALIFIED" =
        currentTechStatus === "DISQUALIFIED" || currentTechStatus === "REJECTED"
          ? "DISQUALIFIED"
          : "QUALIFIED";
      const initRem =
        participation.technicalRemarks ||
        participation.rejectionReason ||
        participation.remarks ||
        "";
      const initScore =
        participation.score !== undefined && participation.score !== null
          ? String(participation.score)
          : "";

      setDecision(initDec);
      setInitialDecision(initDec);
      setRemarks(initRem);
      setInitialRemarks(initRem);
      setScore(initScore);
      setInitialScore(initScore);
      setValidationError("");
    }
  }, [participation, isOpen]);

  if (!isOpen || !participation) return null;

  const parseJsonSafe = (val: any): Record<string, any> => {
    if (!val) return {};
    if (typeof val === "object" && !Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const p = JSON.parse(val);
        return p && typeof p === "object" && !Array.isArray(p) ? p : {};
      } catch {
        return {};
      }
    }
    return {};
  };

  const ackData = parseJsonSafe(
    participation.acknowledgement ||
      participation.rawParticipation?.acknowledgement,
  );
  const respData = parseJsonSafe(
    participation.responseData || participation.rawParticipation?.responseData,
  );
  const descData = parseJsonSafe(
    participation.offeredItemDescription ||
      participation.details?.offeredItemDescription ||
      participation.rawParticipation?.offeredItemDescription,
  );
  const detailsData = parseJsonSafe(
    participation.details || participation.rawParticipation?.details,
  );
  const rawPart = participation.rawParticipation || {};

  const firstValid = (...vals: any[]) => {
    for (const v of vals) {
      if (
        v !== undefined &&
        v !== null &&
        typeof v === "string" &&
        v.trim() !== "" &&
        v.trim() !== "—" &&
        v.trim() !== "-" &&
        v.trim().toLowerCase() !== "null" &&
        v.trim().toLowerCase() !== "undefined"
      ) {
        return v.trim();
      }
      if (typeof v === "number" && !isNaN(v)) {
        return String(v);
      }
    }
    return "";
  };

  // Extract all candidate line items
  const candidateItemArrays = [
    participation.lineItems,
    detailsData.lineItems,
    respData.lineItems,
    respData.lineQuotes,
    respData.items,
    ackData.lineItems,
    ackData.lineQuotes,
    ackData.items,
    descData.lineItems,
    rawPart.lineItems,
  ];

  let lineItems: any[] = [];
  for (const arr of candidateItemArrays) {
    if (Array.isArray(arr) && arr.length > lineItems.length) {
      lineItems = arr;
    }
  }

  const firstLine = lineItems.length > 0 ? lineItems[0] : {};

  const sellerOrg = firstValid(
    participation.sellerOrgName,
    participation.sellerOrganization?.organizationName,
    participation.seller?.sellerProfile?.organizationName,
    participation.seller?.organization?.organizationName,
    detailsData.organizationName,
    participation.companyName,
    participation.sellerName,
    participation.seller?.name,
    rawPart.sellerOrgName,
    `Supplier #${participation.sellerId || participation.sellerUserId || participation.id || ""}`,
  );

  const contactPerson = firstValid(
    participation.contactPerson,
    detailsData.contactPerson,
    participation.sellerName,
    participation.sellerUser?.name,
    participation.seller?.name,
    "Authorized Representative",
  );

  const sellerEmail = firstValid(
    participation.sellerEmail,
    detailsData.email,
    detailsData.sellerEmail,
    participation.sellerUser?.email,
    participation.seller?.email,
    respData.sellerEmail,
    ackData.sellerEmail,
  );

  const sellerMobile = firstValid(
    participation.sellerMobile,
    detailsData.mobile,
    detailsData.sellerMobile,
    participation.sellerUser?.mobile,
    participation.seller?.mobile,
    respData.sellerMobile,
    ackData.sellerMobile,
  );

  const model = firstValid(
    participation.model,
    participation.offeredModel,
    participation.modelNumber,
    participation.modelRef,
    participation.partNumber,
    participation.catalogNumber,
    participation.itemModel,
    detailsData.model,
    detailsData.offeredModel,
    detailsData.modelNumber,
    respData.model,
    respData.offeredModel,
    respData.modelNumber,
    respData.modelRef,
    respData.partNumber,
    respData.technicalOffer?.model,
    respData.technicalOffer?.modelNumber,
    ackData.model,
    ackData.offeredModel,
    ackData.modelNumber,
    ackData.modelRef,
    ackData.partNumber,
    ackData.technicalOffer?.model,
    ackData.technicalOffer?.modelNumber,
    descData.model,
    descData.offeredModel,
    descData.modelNumber,
    rawPart.model,
    rawPart.offeredModel,
    rawPart.modelNumber,
    firstLine.model,
    firstLine.modelNumber,
    firstLine.partNumber,
    firstLine.catalogNumber,
    firstLine.ref,
    // Regex extract if Model: is in text description
    typeof participation.offeredItemDescription === "string"
      ? participation.offeredItemDescription.match(
          /Model[:\s]+([^\n,;]+)/i,
        )?.[1]
      : null,
    "Standard",
  );

  const makeBrand = firstValid(
    participation.makeBrand,
    participation.brand,
    participation.brandName,
    detailsData.makeBrand,
    detailsData.brand,
    respData.makeBrand,
    respData.brand,
    respData.technicalOffer?.makeBrand,
    ackData.makeBrand,
    ackData.brand,
    ackData.technicalOffer?.makeBrand,
    descData.makeBrand,
    descData.brand,
    rawPart.makeBrand,
    rawPart.brand,
    firstLine.makeBrand,
    firstLine.brand,
    "Standard / As Quoted",
  );

  const techSpecs = firstValid(
    participation.technicalSpecifications,
    participation.specifications,
    detailsData.technicalSpecifications,
    detailsData.specifications,
    respData.technicalSpecifications,
    respData.specifications,
    ackData.technicalSpecifications,
    ackData.specifications,
    firstLine.technicalSpecs,
    firstLine.specifications,
    firstLine.technicalSpecification,
    typeof participation.offeredItemDescription === "string" &&
      participation.offeredItemDescription !== participation.message
      ? participation.offeredItemDescription
      : "",
    typeof respData.offeredItemDescription === "string" &&
      respData.offeredItemDescription !== respData.message
      ? respData.offeredItemDescription
      : "",
  );

  const complianceStatement = firstValid(
    participation.complianceStatement,
    detailsData.complianceStatement,
    respData.complianceStatement,
    ackData.complianceStatement,
    firstLine.complianceStatus,
  );

  const deliveryTimeline = firstValid(
    participation.deliveryTimeline,
    detailsData.deliveryTimeline,
    respData.deliveryTimeline,
    ackData.deliveryTimeline,
    rawPart.deliveryTimeline,
    firstLine.deliveryTimeline,
    "As per RFQ schedule",
  );

  const offeredQty = firstValid(
    participation.offeredQuantity,
    participation.quantity,
    detailsData.offeredQuantity,
    respData.offeredQuantity,
    ackData.offeredQuantity,
    rawPart.offeredQuantity,
    lineItems.reduce(
      (sum: number, it: any) => sum + (Number(it.quantity) || 0),
      0,
    ) || null,
    "As Specified",
  );

  const message = firstValid(
    participation.message,
    detailsData.message,
    detailsData.rfqNotes,
    respData.message,
    respData.coverNote,
    ackData.message,
    typeof participation.offeredItemDescription === "string"
      ? participation.offeredItemDescription
      : "",
  );

  // Extract documents from all authentic sources
  const docCandidates = [
    participation.documents,
    detailsData.documents,
    respData.documents,
    ackData.documents,
    rawPart.documents,
  ];

  let rawDocs: any[] = [];
  for (const cand of docCandidates) {
    if (Array.isArray(cand) && cand.length > rawDocs.length) {
      rawDocs = cand;
    }
  }

  const docs: any[] = rawDocs.filter((d: any) => Boolean(d));

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

  const handleDecisionChange = (newDecision: "QUALIFIED" | "DISQUALIFIED") => {
    setDecision(newDecision);
    if (newDecision === "QUALIFIED" && validationError) {
      setValidationError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEffectiveReadOnly) {
      onClose();
      return;
    }

    // Prevent redundant re-submission if user made no changes to an already evaluated quotation
    if (isAlreadyEvaluated) {
      const isDecisionUnchanged = decision === initialDecision;
      const isRemarksUnchanged = remarks.trim() === initialRemarks.trim();
      const isScoreUnchanged =
        score.trim() === initialScore.trim() ||
        (!score.trim() && !initialScore.trim());

      if (isDecisionUnchanged && isRemarksUnchanged && isScoreUnchanged) {
        toast.info("No changes were made to the technical evaluation.");
        onClose();
        return;
      }
    }

    if (decision === "DISQUALIFIED" && !remarks.trim()) {
      setValidationError(
        "Please provide mandatory justification remarks explaining the reason for technical disqualification.",
      );
      return;
    }

    const numScore = score.trim() ? Number(score) : undefined;
    if (
      numScore !== undefined &&
      (isNaN(numScore) || numScore < 0 || numScore > 100)
    ) {
      setValidationError(
        "Evaluation score must be a number between 0 and 100.",
      );
      return;
    }

    setIsSubmitting(true);
    setValidationError("");

    try {
      const partId =
        participation.id ||
        participation.participationId ||
        participation.sellerId;
      const payload = {
        evaluations: [
          {
            participationId: partId,
            status: decision,
            remarks:
              remarks.trim() ||
              (decision === "QUALIFIED"
                ? "Technically compliant with requirement criteria."
                : "Does not meet technical criteria."),
            score: numScore,
          },
        ],
        closeBidIfOpen: true,
      };

      // Try primary procurement bids technical evaluation endpoint first
      let success = false;
      try {
        await procurementBidApi.submitTechnicalEvaluation(
          effectiveBidId,
          payload,
        );
        success = true;
      } catch (err: any) {
        // Fallback: If this is an RFQ QuoteResponse entity
        try {
          const qrId = Number(participation.id);
          if (!isNaN(qrId) && qrId > 0) {
            await postApi(`/api/quote-responses/${qrId}/technical-status`, {
              status: decision === "QUALIFIED" ? "QUALIFIED" : "NOT_QUALIFIED",
              remarks: remarks.trim(),
            });
            success = true;
          }
        } catch {
          throw err;
        }
      }

      if (success) {
        toast.success(
          decision === "QUALIFIED"
            ? `${sellerOrg} marked as Technically Qualified!`
            : `${sellerOrg} marked as Disqualified.`,
        );

        // Invalidate relevant React Query caches to trigger instant UI update
        queryClient.invalidateQueries({
          queryKey: ["buyer-unified-participations"],
        });
        queryClient.invalidateQueries({ queryKey: ["rfq-buyer-responses-v2"] });
        queryClient.invalidateQueries({ queryKey: ["rfq-detail-v2"] });
        queryClient.invalidateQueries({ queryKey: ["rfq-detail-v2-full"] });
        queryClient.invalidateQueries({ queryKey: ["procurement-bid"] });
        queryClient.invalidateQueries({ queryKey: ["procurement-bid-detail"] });
        queryClient.invalidateQueries({ queryKey: ["tender-detail"] });
        queryClient.invalidateQueries({ queryKey: ["tender"] });
        queryClient.refetchQueries({ queryKey: ["buyer-unified-participations"] }).catch(() => {});

        if (handleSuccessCallback) {
          handleSuccessCallback();
        }
        onClose();
      }
    } catch (err: any) {
      console.error("Failed to submit technical evaluation:", err);
      setValidationError(
        err.message ||
          "Failed to submit technical evaluation. Please check your network and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="technical-eval-modal-title"
    >
      <FocusTrap
        active={isOpen}
        onEscape={onClose}
        className="w-full max-w-3xl flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)]"
      >
        <div className="relative w-full rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-full min-h-0">
          {/* Header Section: Official MSME Government Enterprise Navy Gradient */}
          <div className="shrink-0 relative overflow-hidden border-b border-blue-900/40 bg-gradient-to-r from-[#0d2137] via-[#1B365D] to-[#1e3a8a] px-5 sm:px-6 py-4 text-white shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-50" />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300 border border-white/20 shadow-inner">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEffectiveReadOnly ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 text-amber-200 border border-amber-300/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                        <Lock className="h-2.5 w-2.5" aria-hidden="true" /> {isAlreadyQualified ? (isSinglePacket ? "Qualified Record • Sealed" : "Stage 2 Locked • Qualified Record") : "Sealed Audit Record"}
                      </span>
                    ) : isAlreadyQualified ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" /> Verified Qualified
                      </span>
                    ) : isAlreadyDisqualified ? (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-400/20 text-rose-200 border border-rose-300/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                        <XCircle className="h-2.5 w-2.5" aria-hidden="true" /> Recorded Disqualification
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-400/20 text-blue-200 border border-blue-300/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />{" "}
                        Technical Scrutiny
                      </span>
                    )}
                  </div>
                  <h3
                    id="technical-eval-modal-title"
                    className="text-base sm:text-lg font-black text-white tracking-tight leading-snug mt-1"
                  >
                    {isEffectiveReadOnly
                      ? "Technical Evaluation Record (Sealed Audit Trail)"
                      : isAlreadyQualified
                        ? isSinglePacket
                          ? "Technical Evaluation Record • Qualified"
                          : "Technical Evaluation Record • Stage 1 Qualified"
                        : "Technical & Compliance Evaluation Record"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                data-autofocus
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-200 hover:bg-white/15 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Close technical evaluation modal"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <form
            ref={formRef}
            onSubmit={
              isEffectiveReadOnly
                ? (e) => {
                    e.preventDefault();
                    onClose();
                  }
                : handleSubmit
            }
            className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 sm:space-y-5"
          >
            {isAlreadyQualified ? (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/95 p-3.5 text-xs text-emerald-950 font-medium flex items-start gap-3 shadow-2xs">
                <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Check className="h-5 w-5 stroke-[3]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-emerald-950 font-black text-xs sm:text-sm">
                      {isSinglePacket
                        ? "✅ Technically Qualified"
                        : "✅ Technically Qualified • Eligible for Stage 2"}
                    </strong>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-extrabold px-2 py-0.2">
                      {isSinglePacket ? "Technical Cleared" : "Stage 1 Cleared"}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-emerald-900/90 leading-relaxed">
                    {isSinglePacket
                      ? "This quotation has successfully passed technical scrutiny, statutory eligibility, and specification checks."
                      : "This quotation has successfully passed Stage 1 technical scrutiny, statutory eligibility, and specification checks."}
                    {isEffectiveReadOnly
                      ? isSinglePacket
                        ? " Evaluation decision is finalized and cannot be modified."
                        : " Stage 2 has opened, locking this evaluation decision against further modifications."
                      : isSinglePacket
                        ? " You may update scoring or committee remarks below if needed."
                        : " You may update scoring or committee remarks below if needed before Stage 2 opening."}
                  </p>
                  {(participation.score !== undefined && participation.score !== null && participation.score !== "") && (
                    <div className="flex items-center gap-3 text-[11px] text-emerald-800 font-bold pt-0.5">
                      <span>Technical Score: <strong className="text-emerald-950">{participation.score}/100</strong></span>
                      {participation.evaluatedAt && (
                        <span>Evaluated on: <strong>{new Date(participation.evaluatedAt).toLocaleDateString()}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : isAlreadyDisqualified ? (
              <div className="rounded-xl border border-rose-300 bg-rose-50/95 p-3.5 text-xs text-rose-950 font-medium flex items-start gap-3 shadow-2xs">
                <div className="h-8 w-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <XCircle className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <strong className="text-rose-950 font-black text-xs sm:text-sm block">
                    ❌ Technically Disqualified • Ineligible
                  </strong>
                  <p className="text-[11.5px] text-rose-900/90 leading-relaxed">
                    This vendor has been evaluated as disqualified due to non-conformity with technical specifications or compliance criteria.
                    {isEffectiveReadOnly && (isSinglePacket ? " Evaluation record is sealed." : " Decision is locked under active Stage 2.")}
                  </p>
                  {participation.technicalRemarks && (
                    <div className="text-[11px] text-rose-900 bg-white/80 rounded-lg p-2 border border-rose-200 mt-1">
                      <strong>Recorded Justification:</strong> {participation.technicalRemarks}
                    </div>
                  )}
                </div>
              </div>
            ) : isEffectiveReadOnly ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 font-medium flex items-center gap-2.5 shadow-2xs">
                <Lock className="h-4 w-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Audit Record Sealed:</strong> {isSinglePacket ? "This procurement technical evaluation is finalized. Technical evaluation decisions, scoring, and committee notes are permanently preserved and cannot be altered." : "This procurement is in Stage 2 or finalized. Technical evaluation decisions, scoring, and committee notes are permanently preserved and cannot be altered."}
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 font-medium flex items-center gap-2.5 shadow-2xs">
                <ShieldCheck className="h-4 w-4 text-blue-700 shrink-0" />
                <span>
                  <strong>Technical &amp; Compliance Scrutiny:</strong> Verify
                  offered model conformity, specifications, parameters, and
                  statutory eligibility. Bidders marked as Qualified are
                  eligible for commercial ranking and contract award.
                </span>
              </div>
            )}

            {/* Vendor & Quoted Parameters Box */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Supplier Organization
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Verified Bidder
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                    {sellerOrg}
                  </h4>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold text-slate-400 block">
                    Contact & Representative
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {contactPerson}
                  </span>
                  {(sellerEmail || sellerMobile) && (
                    <span className="text-[10px] text-slate-500 block">
                      {[sellerEmail, sellerMobile].filter(Boolean).join(" • ")}
                    </span>
                  )}
                </div>
              </div>

              {/* 5 Distinct Technical Parameter Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-0.5 text-xs">
                <div className="rounded-lg bg-white p-2 border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-400 font-bold block text-[9.5px] uppercase tracking-wider">
                    Make / Brand
                  </span>
                  <span
                    className="font-extrabold text-slate-900 truncate block mt-0.5 text-xs"
                    title={makeBrand}
                  >
                    {makeBrand}
                  </span>
                </div>
                <div className="rounded-lg bg-blue-50/70 p-2 border border-blue-200/90 shadow-2xs">
                  <span className="text-blue-700 font-bold block text-[9.5px] uppercase tracking-wider">
                    Model / Ref:
                  </span>
                  <span
                    className="font-black text-blue-950 truncate block mt-0.5 text-xs"
                    title={model}
                  >
                    {model}
                  </span>
                </div>
                <div className="rounded-lg bg-emerald-50/70 p-2 border border-emerald-200/90 shadow-2xs">
                  <span className="text-emerald-700 font-bold block text-[9.5px] uppercase tracking-wider">
                    Compliance
                  </span>
                  <span className="font-extrabold text-emerald-900 truncate block mt-0.5 text-xs">
                    {complianceStatement === "DEVIATION"
                      ? "⚠ Minor Deviation"
                      : complianceStatement === "ALTERNATIVE_OFFERED"
                        ? "✦ Alternative"
                        : "✓ Compliant"}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-2 border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-400 font-bold block text-[9.5px] uppercase tracking-wider">
                    Offered Qty
                  </span>
                  <span className="font-extrabold text-slate-900 truncate block mt-0.5 text-xs">
                    {offeredQty}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-2 border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-400 font-bold block text-[9.5px] uppercase tracking-wider">
                    Delivery SLA
                  </span>
                  <span
                    className="font-extrabold text-slate-900 truncate block mt-0.5 text-xs"
                    title={deliveryTimeline}
                  >
                    {deliveryTimeline}
                  </span>
                </div>
              </div>

              {techSpecs && (
                <div className="rounded-lg bg-white border border-slate-200 p-3 text-xs text-slate-800 shadow-2xs">
                  <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wider mb-1">
                    Offered Technical Specifications / Parameters:
                  </span>
                  <p className="whitespace-pre-wrap font-medium text-slate-700 leading-relaxed text-xs">
                    {techSpecs}
                  </p>
                </div>
              )}

              {lineItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600 block text-[10px] uppercase tracking-wider">
                      Quoted Item Technical Breakdown ({lineItems.length}):
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Individual item models & parameters
                    </span>
                  </div>
                  <div className={`border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-2xs ${lineItems.length > 5 ? "max-h-80 overflow-y-auto" : ""}`}>
                    {lineItems.map((item: any, i: number) => {
                      const itemModel =
                        item.model ||
                        item.modelNumber ||
                        item.partNumber ||
                        model;
                      const itemMake =
                        item.makeBrand || item.brand || makeBrand;
                      const itemHsn = item.hsnCode || item.hsn_sac_code;
                      const itemBrandPolicy = item.brandPolicy;
                      const itemAttachments: any[] = Array.isArray(
                        item.attachments,
                      )
                        ? item.attachments
                        : [];
                      return (
                        <div
                          key={i}
                          className="p-3 text-xs space-y-2 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="h-5 w-5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                                {i + 1}
                              </span>
                              <span className="font-extrabold text-slate-900">
                                {item.itemName || item.name || `Item #${i + 1}`}
                              </span>
                              {item.quantity && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  ({item.quantity}{" "}
                                  {item.unitOfMeasure || item.uom || "units"})
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {itemHsn && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[10px] font-mono font-bold text-indigo-800 border border-indigo-200">
                                  HSN: {itemHsn}
                                </span>
                              )}
                              {itemMake && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 border border-slate-200">
                                  Make: {itemMake}
                                </span>
                              )}
                              {itemBrandPolicy && (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    itemBrandPolicy === "EQUIVALENT_ACCEPTED"
                                      ? "bg-purple-50 text-purple-800 border-purple-200"
                                      : "bg-amber-50 text-amber-800 border-amber-200"
                                  }`}
                                >
                                  {itemBrandPolicy === "EQUIVALENT_ACCEPTED"
                                    ? "Equivalent OK"
                                    : "Strict Lock"}
                                </span>
                              )}
                              {itemModel && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[10px] font-bold text-blue-900 border border-blue-200">
                                  Model: {itemModel}
                                </span>
                              )}
                              {item.complianceStatus && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                  {item.complianceStatus === "DEVIATION"
                                    ? "⚠ Deviation"
                                    : item.complianceStatus === "ALTERNATIVE"
                                      ? "✦ Alternative"
                                      : "✓ Compliant"}
                                </span>
                              )}
                            </div>
                          </div>
                          {(item.technicalSpecs ||
                            item.specifications ||
                            item.technicalSpecification) && (
                            <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-2 text-[11px] text-slate-600 leading-relaxed">
                              <span className="font-bold text-slate-500 block text-[9.5px] uppercase tracking-wider mb-0.5">
                                Offered Specifications:
                              </span>
                              <p className="whitespace-pre-wrap font-normal">
                                {item.technicalSpecs ||
                                  item.specifications ||
                                  item.technicalSpecification}
                              </p>
                            </div>
                          )}

                          {itemAttachments.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1.5">
                                <FileText className="h-3 w-3 text-blue-600" />
                                Item Technical Documents (
                                {itemAttachments.length}):
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {itemAttachments.map(
                                  (att: any, attIdx: number) => {
                                    const attName =
                                      att.fileName ||
                                      att.name ||
                                      att.documentName ||
                                      `Document #${attIdx + 1}`;
                                    const isAttLoading =
                                      previewLoadingId === (att.id || attName);
                                    return (
                                      <div
                                        key={attIdx}
                                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-2xs"
                                      >
                                        <div className="min-w-0 pr-2">
                                          <p
                                            className="font-bold text-slate-800 truncate text-[11px]"
                                            title={attName}
                                          >
                                            {attName}
                                          </p>
                                          <p className="text-[9.5px] font-semibold text-slate-400">
                                            {att.documentType
                                              ? att.documentType.replace(
                                                  /_/g,
                                                  " ",
                                                )
                                              : "Technical Proposal"}
                                            {att.customNote
                                              ? ` • ${att.customNote}`
                                              : ""}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={isAttLoading}
                                          onClick={() =>
                                            handleViewAttachment(att, attName)
                                          }
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
                                  },
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {message && message !== techSpecs && (
                <div className="rounded-lg bg-white border border-slate-200 p-3 text-xs text-slate-800 shadow-2xs">
                  <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">
                    Supplier Proposal Remarks / Cover Note:
                  </span>
                  <p className="font-medium text-slate-700 italic">
                    "{message}"
                  </p>
                </div>
              )}
            </div>

            {/* Attached Technical Documents Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Technical Documents &amp; Compliance Attachments (
                  {docs.length})
                </label>
                <span className="text-[11px] text-slate-400">
                  Review attached sheets before deciding
                </span>
              </div>

              {docs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3.5 text-center text-xs text-slate-400 font-medium">
                  No separate document files uploaded by supplier. Review
                  specifications on file.
                </div>
              ) : (
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${docs.length > 6 ? "max-h-48 overflow-y-auto pr-1" : ""}`}>
                  {docs.map((doc: any, idx: number) => {
                    const docName =
                      doc.documentName ||
                      doc.name ||
                      doc.fileName ||
                      `Technical Attachment #${idx + 1}`;
                    const isCurrentlyLoading =
                      previewLoadingId === (doc.id || docName);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p
                            className="font-bold text-slate-800 truncate"
                            title={docName}
                          >
                            {docName}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">
                            {doc.documentCategory ||
                              doc.documentType ||
                              "Technical Proposal"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isCurrentlyLoading}
                          onClick={() => handleViewAttachment(doc, docName)}
                          className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isCurrentlyLoading ? (
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
              )}
            </div>

            {/* Evaluation Decision: Qualify vs Disqualify */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Technical Evaluation Decision{" "}
                  {!isEffectiveReadOnly && <span className="text-rose-500">*</span>}
                </label>
                {isEffectiveReadOnly && (
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    Recorded &amp; Sealed
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* QUALIFIED Card */}
                <div
                  role="radio"
                  aria-checked={decision === "QUALIFIED"}
                  tabIndex={isEffectiveReadOnly ? -1 : 0}
                  onClick={
                    isEffectiveReadOnly
                      ? undefined
                      : () => handleDecisionChange("QUALIFIED")
                  }
                  onKeyDown={
                    isEffectiveReadOnly
                      ? undefined
                      : (e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            handleDecisionChange("QUALIFIED");
                          }
                        }
                  }
                  className={`rounded-xl border p-4 transition-all focus:outline-none ${
                    isEffectiveReadOnly
                      ? decision === "QUALIFIED"
                        ? "border-emerald-500 bg-emerald-50/80 shadow-2xs ring-1 ring-emerald-500/30"
                        : "border-slate-200 bg-slate-50/50 opacity-40 cursor-default"
                      : `cursor-pointer focus:ring-2 focus:ring-emerald-500 ${
                          decision === "QUALIFIED"
                            ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-2xs"
                            : "border-slate-200 hover:border-slate-300 bg-white opacity-70"
                        }`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        decision === "QUALIFIED"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {decision === "QUALIFIED" && (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-extrabold text-emerald-900">
                          Technically Qualified (Pass)
                        </h4>
                        {(isEffectiveReadOnly || isAlreadyQualified) && decision === "QUALIFIED" && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Recorded Decision
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Eligible for commercial ranking, L1 award, and reverse
                        auction
                      </p>
                    </div>
                  </div>
                </div>

                {/* DISQUALIFIED Card */}
                <div
                  role="radio"
                  aria-checked={decision === "DISQUALIFIED"}
                  tabIndex={isEffectiveReadOnly ? -1 : 0}
                  onClick={
                    isEffectiveReadOnly
                      ? undefined
                      : () => handleDecisionChange("DISQUALIFIED")
                  }
                  onKeyDown={
                    isEffectiveReadOnly
                      ? undefined
                      : (e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            handleDecisionChange("DISQUALIFIED");
                          }
                        }
                  }
                  className={`rounded-xl border p-4 transition-all focus:outline-none ${
                    isEffectiveReadOnly
                      ? decision === "DISQUALIFIED"
                        ? "border-rose-500 bg-rose-50/80 shadow-2xs ring-1 ring-rose-500/30"
                        : "border-slate-200 bg-slate-50/50 opacity-40 cursor-default"
                      : `cursor-pointer focus:ring-2 focus:ring-rose-500 ${
                          decision === "DISQUALIFIED"
                            ? "border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20 shadow-2xs"
                            : "border-slate-200 hover:border-slate-300 bg-white opacity-70"
                        }`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        decision === "DISQUALIFIED"
                          ? "border-rose-600 bg-rose-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {decision === "DISQUALIFIED" && (
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-extrabold text-rose-900">
                          Disqualified (Fail)
                        </h4>
                        {(isEffectiveReadOnly || isAlreadyDisqualified) && decision === "DISQUALIFIED" && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            Recorded Decision
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Marked ineligible for contract award
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Score & Remarks */}
            <div className="space-y-3 pt-1 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1 space-y-1">
                  <label
                    htmlFor="eval-score-input"
                    className="text-xs font-bold text-slate-700 block"
                  >
                    Technical Score
                  </label>
                  <div className="relative">
                    <input
                      id="eval-score-input"
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      disabled={isEffectiveReadOnly}
                      placeholder={isEffectiveReadOnly ? "—" : "e.g. 85"}
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none ${
                        isEffectiveReadOnly
                          ? "bg-slate-100/80 cursor-not-allowed text-slate-600"
                          : ""
                      }`}
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400">
                      / 100
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {isEffectiveReadOnly ? "Evaluation Score" : "Optional"}
                  </span>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label
                    htmlFor="eval-remarks-input"
                    className="text-xs font-bold text-slate-700 flex items-center justify-between"
                  >
                    <span>
                      Evaluation Justification &amp; Remarks{" "}
                      {decision === "DISQUALIFIED" && !isEffectiveReadOnly && (
                        <span className="text-rose-500">*</span>
                      )}
                    </span>
                    <span className="text-[10.5px] font-normal text-slate-400">
                      {isEffectiveReadOnly
                        ? "Committee remarks on file"
                        : decision === "DISQUALIFIED"
                          ? "Mandatory for audit trail"
                          : "Recommended"}
                    </span>
                  </label>
                  <textarea
                    id="eval-remarks-input"
                    rows={3}
                    disabled={isEffectiveReadOnly}
                    placeholder={
                      isEffectiveReadOnly
                        ? "No committee justification remarks on file."
                        : decision === "QUALIFIED"
                          ? "e.g. Technical proposal complies with technical specifications, certified ISO compliant, and warranty terms accepted."
                          : "e.g. Disqualified due to non-submission of valid ISO certificate and delivery timeline exceeding required threshold."
                    }
                    value={remarks}
                    onChange={(e) => {
                      setRemarks(e.target.value);
                      if (validationError) setValidationError("");
                    }}
                    className={`w-full rounded-lg border p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                      isEffectiveReadOnly
                        ? "bg-slate-100/80 cursor-not-allowed text-slate-700"
                        : decision === "DISQUALIFIED" &&
                            !remarks.trim() &&
                            validationError
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                          : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Validation Error Alert */}
            {validationError && (
              <div
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-semibold flex items-start gap-2"
                role="alert"
              >
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}
          </form>

          {/* Footer Actions */}
          <div className="shrink-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 sm:px-6 py-3.5">
            {isEffectiveReadOnly ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  {isAlreadyQualified
                    ? isSinglePacket
                      ? "Technically Qualified • Evaluation Finalized (Read-Only)"
                      : "Technically Qualified • Stage 2 Active (Read-Only)"
                    : isAlreadyDisqualified
                      ? "Technically Disqualified • Evaluation Locked (Read-Only)"
                      : "Read-only audit record • Decision immutable"}
                </span>
                <Button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-bold bg-[#1B365D] hover:bg-[#122744] text-white px-5 cursor-pointer shadow-xs transition-colors"
                >
                  Close Record
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`text-xs font-bold text-white shadow-2xs gap-1.5 cursor-pointer ${
                    decision === "QUALIFIED"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving Evaluation...
                    </>
                  ) : (
                    <>
                      {isAlreadyQualified ? (
                        decision === "QUALIFIED" ? (
                          <>
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            Update Evaluation Remarks
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            Change Decision to Disqualified
                          </>
                        )
                      ) : isAlreadyDisqualified ? (
                        decision === "DISQUALIFIED" ? (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            Update Disqualification Remarks
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {isSinglePacket ? "Reconsider & Qualify" : "Reconsider & Qualify for Stage 2"}
                          </>
                        )
                      ) : decision === "QUALIFIED" ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isSinglePacket ? "Qualify" : "Qualify for Stage 2"}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          Disqualify Seller
                        </>
                      )}
                    </>
                  )}
                </Button>
              </>
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
export default TechnicalEvaluationModal;
