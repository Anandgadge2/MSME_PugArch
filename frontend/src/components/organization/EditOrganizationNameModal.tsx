import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Building2, ShieldCheck, Lock, AlertCircle, X } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { FocusTrap } from '../ui/FocusTrap';

interface EditOrganizationNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  legalName?: string;
  organizationType?: string;
  onSuccess: (newName: string) => void;
}

export function EditOrganizationNameModal({
  isOpen,
  onClose,
  currentName,
  legalName,
  organizationType = 'Proprietorship',
  onSuccess
}: EditOrganizationNameModalProps) {
  const [newName, setNewName] = useState(currentName || '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [maskedDestination, setMaskedDestination] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  React.useEffect(() => {
    if (isOpen) {
      setNewName(currentName || '');
      setOtp('');
      setOtpSent(false);
    }
  }, [isOpen, currentName]);

  React.useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleSendOtp = async (preferredChannel: 'email' | 'sms' = 'email') => {
    if (!newName.trim() || newName.trim().length < 3) {
      toast.error('Please enter a valid business/organization name (at least 3 characters)');
      return;
    }
    if (newName.trim() === currentName?.trim()) {
      toast.error('New organization name must be different from current name');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.fetch('/api/org/update-name/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: preferredChannel })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtpSent(true);
        setChannel(data.channel || preferredChannel);
        setMaskedDestination(data.maskedDestination || '');
        setResendCooldown(60);
        toast.success(data.message || 'Verification OTP sent successfully');
      } else {
        throw new Error(data.message || 'Failed to send verification OTP');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error('Please enter the 6-digit verification OTP');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.fetch('/api/org/update-name/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newOrganizationName: newName.trim(),
          otp: otp.trim(),
          channel
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Organization business name updated successfully!');
        onSuccess(newName.trim());
        onClose();
      } else {
        throw new Error(data.message || 'OTP verification failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update organization name');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-org-name-title"
    >
      <FocusTrap active={isOpen} onEscape={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur">
                <Building2 className="w-5 h-5 text-amber-300" aria-hidden="true" />
              </div>
              <div>
                <h3 id="edit-org-name-title" className="font-bold text-base tracking-tight">
                  Update Business / Trade Name
                </h3>
                <p className="text-xs text-blue-200">
                  {organizationType} Display Name Verification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Information Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-3 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Proprietorship / Partnership Trade Name Flexibility:
                </p>
                <p className="text-amber-800 leading-relaxed">
                  As per GST/PAN statutory rules, your legal tax identity remains bound to the proprietor or lead partner. You can customize your working business name for invoices, tender submissions, and purchase orders after OTP authorization.
                </p>
              </div>
            </div>

            {/* Read-Only Legal Name Display */}
            {legalName && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  Statutory GST/PAN Legal Name (Read-Only)
                </div>
                <div className="text-sm font-bold text-slate-800">
                  {legalName}
                </div>
                <p className="text-[11px] text-slate-500">
                  Matches taxpayer name on GSTIN records.
                </p>
              </div>
            )}

            {!otpSent ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-org-name-input" className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                    New Business / Trade Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="new-org-name-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Acme Engineering Works"
                    className="h-11 text-sm font-medium"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500">
                    This name will appear on your portal profile, quotations, and purchase orders.
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading}
                    className="h-10 text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSendOtp('email')}
                    disabled={isLoading || !newName.trim() || newName.trim() === currentName?.trim()}
                    className="h-10 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Send Verification OTP
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyAndUpdate} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex justify-between items-center">
                  <div>
                    <span className="font-semibold">New Name: </span>
                    <span className="font-bold text-blue-950">{newName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-blue-700 underline font-medium hover:text-blue-900"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="otp-verification-input" className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                    Enter 6-Digit OTP <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="otp-verification-input"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="h-12 text-center text-xl font-bold tracking-widest"
                    autoFocus
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                    <span>Sent to {maskedDestination || 'registered email/phone'}</span>
                    {resendCooldown > 0 ? (
                      <span className="text-slate-400 font-medium">Resend in {resendCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp(channel)}
                        disabled={isLoading}
                        className="text-blue-700 hover:underline font-bold"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOtpSent(false)}
                    disabled={isLoading}
                    className="h-10 text-xs font-semibold"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Confirm & Update Name
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
