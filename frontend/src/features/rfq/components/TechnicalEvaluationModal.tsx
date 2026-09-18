'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, XCircle, FileText, AlertTriangle, 
  ExternalLink, Download, ShieldCheck, Award, HelpCircle, Loader2, Eye, Package
} from 'lucide-react';
import { FocusTrap } from '../../../components/ui/FocusTrap';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';
import { procurementBidApi } from '../../procurementBid/api';
import { useQueryClient } from '@tanstack/react-query';
import { postApi } from '../../shared/apiClient';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { getFileAssetPreview, openFileAsset, type DocumentPreview } from '../../../lib/files';

export interface TechnicalEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  participation: any;
  bidId?: string;
  procurementId?: string | number;
  procurementTitle?: string;
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
  onEvaluationSuccess,
  onSuccess,
}: TechnicalEvaluationModalProps) {
  const effectiveBidId = String(bidId || procurementId || '');
  const handleSuccessCallback = onEvaluationSuccess || onSuccess;
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<'QUALIFIED' | 'DISQUALIFIED'>('QUALIFIED');
  const [score, setScore] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | number | null>(null);

  useEffect(() => {
    if (participation) {
      const currentTechStatus = String(
        participation.technicalStatus || 
        (participation.isDisqualified ? 'DISQUALIFIED' : '')
      ).toUpperCase();

      if (currentTechStatus === 'DISQUALIFIED') {
        setDecision('DISQUALIFIED');
      } else {
        setDecision('QUALIFIED');
      }

      setRemarks(participation.technicalRemarks || participation.rejectionReason || '');
      setScore(participation.score !== undefined && participation.score !== null ? String(participation.score) : '');
      setValidationError('');
    }
  }, [participation, isOpen]);

  if (!isOpen || !participation) return null;

  const sellerOrg =
    participation.sellerOrgName ||
    participation.sellerOrganization?.organizationName ||
    participation.seller?.sellerProfile?.organizationName ||
    participation.seller?.organization?.organizationName ||
    participation.companyName ||
    participation.sellerName ||
    `Supplier #${participation.sellerId || participation.sellerUserId || participation.id || ''}`;

  const contactPerson =
    participation.contactPerson ||
    participation.sellerName ||
    participation.sellerUser?.name ||
    participation.seller?.name ||
    'Authorized Representative';

  const makeBrand =
    participation.makeBrand ||
    participation.responseData?.makeBrand ||
    participation.acknowledgement?.makeBrand ||
    participation.brand ||
    '—';

  const model =
    participation.model ||
    participation.responseData?.model ||
    participation.acknowledgement?.model ||
    '—';

  const deliveryTimeline =
    participation.deliveryTimeline ||
    participation.responseData?.deliveryTimeline ||
    participation.acknowledgement?.deliveryTimeline ||
    'As per RFQ schedule';

  const offeredQty =
    participation.offeredQuantity ||
    participation.quantity ||
    participation.responseData?.offeredQuantity ||
    participation.acknowledgement?.offeredQuantity ||
    'As Specified';

  const message =
    participation.offeredItemDescription ||
    participation.message ||
    participation.responseData?.message ||
    participation.acknowledgement?.offeredItemDescription ||
    '';

  const docs: any[] = Array.isArray(participation.documents) && participation.documents.length
    ? participation.documents
    : Array.isArray(participation.responseData?.documents) && participation.responseData.documents.length
      ? participation.responseData.documents
      : Array.isArray(participation.acknowledgement?.documents) && participation.acknowledgement.documents.length
        ? participation.acknowledgement.documents
        : [];

  const handleViewAttachment = async (doc: any, docName: string) => {
    const rawUrl =
      doc.url ||
      doc.fileUrl ||
      doc.signedUrl ||
      doc.documentUrl ||
      '';
    const urlMatchId = String(rawUrl).match(/\/api\/(?:public\/)?files\/(\d+)/)?.[1];

    const fileId =
      doc.fileAssetId ||
      doc.fileId ||
      (typeof doc.id === 'number' || /^\d+$/.test(String(doc.id || ''))
        ? Number(doc.id)
        : urlMatchId
          ? Number(urlMatchId)
          : undefined);

    const effectiveUrl = rawUrl || (fileId ? `/api/files/${fileId}/view` : '');

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
          console.warn('getFileAssetPreview fallback to openFileAsset:', e);
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

      toast.error('Document file is not available for preview.');
    } catch (err: any) {
      console.error('Failed to view attachment:', err);
      toast.error(
        err instanceof Error ? err.message : 'Unable to open document file.',
      );
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleDecisionChange = (newDecision: 'QUALIFIED' | 'DISQUALIFIED') => {
    setDecision(newDecision);
    if (newDecision === 'QUALIFIED' && validationError) {
      setValidationError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (decision === 'DISQUALIFIED' && !remarks.trim()) {
      setValidationError('Please provide mandatory justification remarks explaining the reason for technical disqualification.');
      return;
    }

    const numScore = score.trim() ? Number(score) : undefined;
    if (numScore !== undefined && (isNaN(numScore) || numScore < 0 || numScore > 100)) {
      setValidationError('Evaluation score must be a number between 0 and 100.');
      return;
    }

    setIsSubmitting(true);
    setValidationError('');

    try {
      const partId = participation.id || participation.participationId || participation.sellerId;
      const payload = {
        evaluations: [
          {
            participationId: partId,
            status: decision,
            remarks: remarks.trim() || (decision === 'QUALIFIED' ? 'Technically compliant with requirement criteria.' : 'Does not meet technical criteria.'),
            score: numScore,
          },
        ],
      };

      // Try primary procurement bids technical evaluation endpoint first
      let success = false;
      try {
        await procurementBidApi.submitTechnicalEvaluation(effectiveBidId, payload);
        success = true;
      } catch (err: any) {
        // Fallback: If this is an RFQ QuoteResponse entity
        try {
          const qrId = Number(participation.id);
          if (!isNaN(qrId) && qrId > 0) {
            await postApi(`/api/quote-responses/${qrId}/technical-status`, {
              status: decision === 'QUALIFIED' ? 'QUALIFIED' : 'NOT_QUALIFIED',
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
          decision === 'QUALIFIED'
            ? `${sellerOrg} marked as Technically Qualified for Stage 2!`
            : `${sellerOrg} marked as Technically Disqualified.`
        );

        // Invalidate relevant React Query caches to trigger instant UI update
        queryClient.invalidateQueries({ queryKey: ['buyer-unified-participations'] });
        queryClient.invalidateQueries({ queryKey: ['rfq-buyer-responses-v2'] });
        queryClient.invalidateQueries({ queryKey: ['rfq-detail-v2'] });
        queryClient.invalidateQueries({ queryKey: ['rfq-detail-v2-full'] });
        queryClient.invalidateQueries({ queryKey: ['procurement-bid'] });

        if (handleSuccessCallback) {
          handleSuccessCallback();
        }
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to submit technical evaluation:', err);
      setValidationError(err.message || 'Failed to submit technical evaluation. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="technical-eval-modal-title"
    >
      <FocusTrap active={isOpen} onEscape={onClose} className="w-full max-w-2xl my-8">
        <div className="relative w-full rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 id="technical-eval-modal-title" className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Technical Packet Evaluation (Stage 1)
                </h3>
                <p className="text-[11px] text-slate-300">
                  Evaluate technical proposal and eligibility for Stage 2 advancement
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label="Close technical evaluation modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            
            {/* Vendor Overview Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200/80 pb-2">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Supplier Organization
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{sellerOrg}</h4>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold text-slate-400 block">Contact Person</span>
                  <span className="text-xs font-semibold text-slate-700">{contactPerson}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[10.5px]">Make / Brand:</span>
                  <span className="font-semibold text-slate-800">{makeBrand}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10.5px]">Model / Specs:</span>
                  <span className="font-semibold text-slate-800">{model}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10.5px]">Offered Qty:</span>
                  <span className="font-semibold text-slate-800">{offeredQty}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10.5px]">Delivery SLA:</span>
                  <span className="font-semibold text-slate-800">{deliveryTimeline}</span>
                </div>
              </div>

              {message && (
                <div className="mt-2 rounded-lg bg-white/90 border border-slate-200 p-2 text-xs text-slate-800">
                  <span className="font-bold text-slate-500 block text-[10px] uppercase">
                    Supplier Proposal Remarks:
                  </span>
                  <p className="mt-0.5 font-medium text-slate-700">"{message}"</p>
                </div>
              )}
            </div>

            {/* Attached Technical Documents Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Technical Documents &amp; Compliance Attachments ({docs.length})
                </label>
                <span className="text-[11px] text-slate-400">Review attached sheets before deciding</span>
              </div>

              {docs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3.5 text-center text-xs text-slate-400 font-medium">
                  No separate document files uploaded by supplier. Review specifications on file.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {docs.map((doc: any, idx: number) => {
                    const docName = doc.documentName || doc.name || doc.fileName || `Technical Attachment #${idx + 1}`;
                    const isCurrentlyLoading = previewLoadingId === (doc.id || docName);
                    return (
                      <div 
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 truncate" title={docName}>{docName}</p>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">
                            {doc.documentCategory || doc.documentType || 'Technical Proposal'}
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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Technical Evaluation Decision <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* QUALIFIED Card */}
                <div
                  role="radio"
                  aria-checked={decision === 'QUALIFIED'}
                  tabIndex={0}
                  onClick={() => handleDecisionChange('QUALIFIED')}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleDecisionChange('QUALIFIED'); } }}
                  className={`cursor-pointer rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    decision === 'QUALIFIED'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      decision === 'QUALIFIED'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {decision === 'QUALIFIED' && <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-emerald-900">
                        Technically Qualified (Pass)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Admitted to Stage 2 (Financial Opening / Reverse Auction)
                      </p>
                    </div>
                  </div>
                </div>

                {/* DISQUALIFIED Card */}
                <div
                  role="radio"
                  aria-checked={decision === 'DISQUALIFIED'}
                  tabIndex={0}
                  onClick={() => handleDecisionChange('DISQUALIFIED')}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleDecisionChange('DISQUALIFIED'); } }}
                  className={`cursor-pointer rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                    decision === 'DISQUALIFIED'
                      ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      decision === 'DISQUALIFIED'
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {decision === 'DISQUALIFIED' && <XCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-rose-900">
                        Disqualified (Fail)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Eliminated; financial packet remains locked
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Score & Remarks */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1 space-y-1">
                  <label htmlFor="eval-score-input" className="text-xs font-bold text-slate-700 block">
                    Technical Score
                  </label>
                  <div className="relative">
                    <input
                      id="eval-score-input"
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      placeholder="e.g. 85"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400">/ 100</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">Optional</span>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label htmlFor="eval-remarks-input" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Evaluation Justification &amp; Remarks {decision === 'DISQUALIFIED' && <span className="text-rose-500">*</span>}
                    </span>
                    <span className="text-[10.5px] font-normal text-slate-400">
                      {decision === 'DISQUALIFIED' ? 'Mandatory for audit trail' : 'Recommended'}
                    </span>
                  </label>
                  <textarea
                    id="eval-remarks-input"
                    rows={3}
                    placeholder={
                      decision === 'QUALIFIED'
                        ? 'e.g. Technical proposal complies with technical specifications, certified ISO compliant, and warranty terms accepted.'
                        : 'e.g. Disqualified due to non-submission of valid ISO certificate and delivery timeline exceeding required threshold.'
                    }
                    value={remarks}
                    onChange={(e) => {
                      setRemarks(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    className={`w-full rounded-lg border p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                      decision === 'DISQUALIFIED' && !remarks.trim() && validationError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Validation Error Alert */}
            {validationError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-semibold flex items-start gap-2" role="alert">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Note about 2-packet procurement rule */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] text-blue-800 leading-relaxed">
              <strong>Two-Packet Procurement Notice:</strong> In accordance with public procurement standards, marking a seller as Technically Qualified permits their commercial bid to be opened in Stage 2 (or admitted to the Stage 2 Reverse Auction). Disqualified vendors are locked out of the financial stage.
            </div>

          </form>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
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
                decision === 'QUALIFIED'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving Evaluation...
                </>
              ) : (
                <>
                  {decision === 'QUALIFIED' ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Qualify for Stage 2
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
