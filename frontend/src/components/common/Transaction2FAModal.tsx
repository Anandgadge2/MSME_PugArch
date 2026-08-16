import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, RefreshCw, X, AlertCircle, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { postApi } from '../../features/shared/apiClient';
import { formatCurrency } from '../../features/shared/format';

export interface Transaction2FAModalProps {
  isOpen: boolean;
  actionType: string;
  actionTitle?: string;
  orderId?: number | string;
  amount?: number;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export const Transaction2FAModal: React.FC<Transaction2FAModalProps> = ({
  isOpen,
  actionType,
  actionTitle,
  orderId,
  amount,
  onClose,
  onSuccess
}) => {
  const [otp, setOtp] = useState('');
  const [destination, setDestination] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isSent, setIsSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Send OTP when modal opens
  const handleSendOtpCb = useCallback(() => {
    handleSendOtp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionType, orderId, amount]);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setErrorMsg(null);
      handleSendOtpCb();
    }
  }, [isOpen, handleSendOtpCb]);

  // Resend Countdown timer
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  // Focus input automatically
  useEffect(() => {
    if (isSent && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSent]);

  const handleSendOtp = async () => {
    setIsSending(true);
    setErrorMsg(null);
    try {
      const res = await postApi<any>('/api/2fa/transaction/send-otp', {
        actionType,
        orderId,
        amount
      });
      if (res?.destination) {
        setDestination(res.destination);
      }
      setIsSent(true);
      setCountdown(60);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dispatch 2FA verification code. Please try again.');
      setCountdown(0); // Allow immediate retry on failure
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);
    try {
      await postApi('/api/2fa/transaction/verify-otp', {
        actionType,
        otp: otp.trim(),
        orderId,
        amount
      });
      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid or expired 2FA code. Please double-check and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl transition-all">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-white">
                  2-Factor Authorization
                </h3>
                <p className="text-xs font-medium text-emerald-200/80">
                  Step-up security for transaction approval
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Action / Amount Details Card */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Action</span>
              <span className="font-bold text-slate-800">{actionTitle || actionType.replace(/_/g, ' ')}</span>
            </div>
            {orderId && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Order ID</span>
                <span className="font-bold text-slate-800">#{orderId}</span>
              </div>
            )}
            {amount !== undefined && amount > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Transaction Value</span>
                <span className="font-black text-emerald-700 text-sm">{formatCurrency(amount)}</span>
              </div>
            )}
          </div>

          {/* Destination & Prompt */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-slate-600">
              {destination ? (
                <>Enter the 6-digit security code sent to <strong className="text-slate-900">{destination}</strong></>
              ) : (
                'Enter the 6-digit security code sent to your registered email/phone'
              )}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">Valid for 10 minutes</p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <input
                ref={inputRef}
                type="text"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                disabled={isSending || isVerifying}
                className="h-14 w-full text-center text-3xl font-black tracking-[0.4em] rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-300 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10 transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={countdown > 0 || isSending}
                onClick={handleSendOtp}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 disabled:text-slate-400 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSending ? 'animate-spin' : ''}`} />
                {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend Code'}
              </button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isVerifying}
                  className="h-10 px-4 text-xs font-black uppercase text-slate-600 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={otp.length !== 6 || isVerifying || isSending}
                  className="h-10 px-5 text-xs font-black uppercase text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-sm disabled:bg-slate-300"
                >
                  {isVerifying ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verifying...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Authorize
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
