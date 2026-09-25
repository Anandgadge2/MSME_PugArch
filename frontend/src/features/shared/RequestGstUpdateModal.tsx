import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { AlertCircle, CheckCircle2, FileText, XCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

interface RequestGstUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGstin?: string | null;
  panNumber?: string | null;
  authHeaders?: Record<string, string>;
  onSuccess?: () => void;
}

export function RequestGstUpdateModal({
  isOpen,
  onClose,
  currentGstin,
  panNumber,
  authHeaders = {},
  onSuccess
}: RequestGstUpdateModalProps) {
  const [newGstin, setNewGstin] = useState('');
  const [reason, setReason] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const cleanGst = newGstin.trim().toUpperCase();
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  const isValidFormat = gstRegex.test(cleanGst);

  const derivedPan = cleanGst.length >= 12 ? cleanGst.substring(2, 12) : '';
  const panMatches = !panNumber || !derivedPan || derivedPan.toUpperCase() === panNumber.toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidFormat) {
      toast.error('Enter a valid 15-character Indian GSTIN format.');
      return;
    }

    if (!panMatches) {
      toast.error(`The PAN (${derivedPan}) inside the new GSTIN does not match your registered PAN (${panNumber}).`);
      return;
    }

    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters.');
      return;
    }

    if (!certificateUrl.trim()) {
      toast.error('Please provide a supporting certificate document URL.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.fetch('/api/org/request-gst-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          newGstin: cleanGst,
          reason: reason.trim(),
          certificateUrl: certificateUrl.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit GST update request');
      }

      toast.success('GST update request submitted successfully. It has been routed to the administration for review.');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error submitting GST update request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gst-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0c2340]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="gst-modal-title" className="text-base font-bold text-slate-900">
                Request GSTIN Update
              </h3>
              <p className="text-xs text-slate-500">
                Submit GST migration or amendment for Collectorate review
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Current GST & PAN Display */}
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
            <div>
              <span className="block font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Current Registered GSTIN
              </span>
              <span className="font-mono font-bold text-slate-800">
                {currentGstin || 'None / Unregistered'}
              </span>
            </div>
            <div>
              <span className="block font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Registered PAN
              </span>
              <span className="font-mono font-bold text-slate-800">
                {panNumber || 'Not specified'}
              </span>
            </div>
          </div>

          {/* New GSTIN Input */}
          <div>
            <label
              htmlFor="new-gstin"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
            >
              New GSTIN <span className="text-red-500">*</span>
            </label>
            <input
              id="new-gstin"
              type="text"
              required
              maxLength={15}
              value={newGstin}
              onChange={(e) => setNewGstin(e.target.value.toUpperCase())}
              placeholder="e.g. 21ABCDE1234F1Z5"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm uppercase text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:ring-1 focus:ring-[#0c2340] outline-none"
            />
            {cleanGst.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                {isValidFormat ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Valid GSTIN format (State code: {cleanGst.substring(0, 2)}, PAN: {derivedPan})
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Must be 15 alphanumeric characters matching Indian GST format.
                  </span>
                )}
              </div>
            )}
            {cleanGst.length >= 12 && panNumber && !panMatches && (
              <p className="mt-1 text-[11px] font-bold text-red-600">
                PAN Mismatch: Derived PAN ({derivedPan}) does not match your registered PAN ({panNumber}).
              </p>
            )}
          </div>

          {/* Reason for Update */}
          <div>
            <label
              htmlFor="gst-reason"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
            >
              Reason for Amendment / Migration <span className="text-red-500">*</span>
            </label>
            <textarea
              id="gst-reason"
              required
              rows={3}
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the reason for amending or updating your GST registration (e.g. principal place change, conversion from composition, new state GST)..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:ring-1 focus:ring-[#0c2340] outline-none"
            />
            <span className="mt-1 block text-[10px] text-slate-400">
              Minimum 10 characters.
            </span>
          </div>

          {/* Certificate Proof URL */}
          <div>
            <label
              htmlFor="certificate-url"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
            >
              GST Registration Certificate Proof (URL) <span className="text-red-500">*</span>
            </label>
            <input
              id="certificate-url"
              type="url"
              required
              value={certificateUrl}
              onChange={(e) => setCertificateUrl(e.target.value)}
              placeholder="https://... or uploaded GST REG-06 document link"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:ring-1 focus:ring-[#0c2340] outline-none"
            />
            <span className="mt-1 block text-[10px] text-slate-400">
              Provide link to your official Form GST REG-06 certificate for verification.
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isValidFormat || (Boolean(panNumber) && !panMatches) || reason.trim().length < 10 || !certificateUrl.trim()}
              className="h-9 rounded-xl bg-[#0c2340] px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#12335f] disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
