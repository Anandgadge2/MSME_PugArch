import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, CheckCircle2, Clock, Send, ShieldAlert, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface SuspensionAppealFormProps {
  organization: {
    id?: number;
    organizationName?: string;
    isBlacklisted?: boolean;
    blacklistReason?: string | null;
    blacklistedAt?: string | null;
    suspensionType?: string | null;
    appealStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
    appealMessage?: string | null;
    appealDocumentUrl?: string | null;
    appealSubmittedAt?: string | null;
    appealReviewedAt?: string | null;
    appealRejectionReason?: string | null;
    appealCount?: number;
  };
  authHeaders?: Record<string, string>;
  onAppealSubmitted?: () => void;
}

export function SuspensionAppealForm({
  organization,
  authHeaders = {},
  onAppealSubmitted
}: SuspensionAppealFormProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const appealStatus = organization?.appealStatus || 'NONE';
  const appealCount = organization?.appealCount || 0;
  const maxAppealsReached = appealCount >= 2 && appealStatus !== 'PENDING';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMessage = message.trim();
    if (cleanMessage.length < 20) {
      toast.error('Clarification message must be at least 20 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.fetch('/api/org/appeal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          message: cleanMessage,
          documentUrl: documentUrl.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit appeal');
      }

      toast.success('Your appeal has been submitted to the Collectorate administration.');
      setMessage('');
      setDocumentUrl('');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['org-status'] });
      onAppealSubmitted?.();
    } catch (err: any) {
      toast.error(err.message || 'Error submitting appeal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Official Suspension Clarification Desk
              </CardTitle>
              <p className="text-xs text-slate-500">
                Submit representation or remediation documents for Collectorate review
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
            <span>Appeals submitted:</span>
            <span className="font-bold text-slate-900">{appealCount} / 2 allowed</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Status: Under Review */}
        {appealStatus === 'PENDING' && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-amber-900"
          >
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-amber-950">
                  Appeal Case is Under Administrative Review
                </h4>
                <p className="text-xs leading-relaxed text-amber-900/90">
                  Your formal explanation was submitted on{' '}
                  {organization.appealSubmittedAt
                    ? new Date(organization.appealSubmittedAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })
                    : 'record'}{' '}
                  and is queued with the District Collectorate Desk. You will be notified once a determination is reached.
                </p>
                {organization.appealMessage && (
                  <div className="mt-3 rounded-lg border border-amber-200/80 bg-white/80 p-3 text-xs text-slate-700">
                    <span className="block font-semibold text-slate-900 mb-1">Your Submitted Statement:</span>
                    <p className="italic whitespace-pre-wrap">{organization.appealMessage}</p>
                    {organization.appealDocumentUrl && (
                      <a
                        href={organization.appealDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 font-semibold text-[#0c2340] hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        View Attached Remediation Document
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status: Previous Appeal Rejected */}
        {appealStatus === 'REJECTED' && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50/70 p-4 text-red-900"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-950">
                  Previous Appeal Outcome: Rejected
                </h4>
                {organization.appealRejectionReason && (
                  <p className="text-xs text-red-900">
                    <strong>Admin Reason:</strong> {organization.appealRejectionReason}
                  </p>
                )}
                {!maxAppealsReached && (
                  <p className="text-[11px] text-red-800/80 mt-1">
                    You have 1 remaining appeal attempt. Please provide concrete rectification evidence below.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Max Appeals Reached */}
        {maxAppealsReached && (
          <div
            role="status"
            className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-700"
          >
            <p className="text-sm font-semibold text-slate-900">
              Maximum Appeals Exhausted (2/2)
            </p>
            <p className="mt-1 text-xs text-slate-600">
              The portal appeal mechanism allows up to 2 submissions. Further review requires manual in-person escalation with the District Collectorate Office.
            </p>
          </div>
        )}

        {/* Form: Available if not PENDING and not max appeals reached */}
        {appealStatus !== 'PENDING' && !maxAppealsReached && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="appeal-message"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Statement of Rectification / Clarification <span className="text-red-500">*</span>
              </label>
              <textarea
                id="appeal-message"
                rows={4}
                required
                minLength={20}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the steps taken to resolve the violation, dispute settlements, or statutory compliance updates..."
                aria-describedby="appeal-help appeal-counter"
                className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:ring-2 focus:ring-[#0c2340]/10 outline-none transition"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span id="appeal-help">Minimum 20 characters required. Provide factual specifics.</span>
                <span id="appeal-counter" className={message.trim().length >= 20 ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                  {message.trim().length} / 2000
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="appeal-document-url"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Supporting Proof / Document URL (Optional)
              </label>
              <input
                id="appeal-document-url"
                type="url"
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://... or uploaded cloud link (GST return, court decree, settlement receipt)"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:ring-2 focus:ring-[#0c2340]/10 outline-none transition"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Provide a publicly accessible or portal-hosted link to documentary evidence.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || message.trim().length < 20}
                className="h-10 rounded-xl bg-[#0c2340] px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#12335f] disabled:opacity-50 transition"
              >
                {isSubmitting ? (
                  <span>Submitting Representation...</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    Submit Formal Appeal
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
