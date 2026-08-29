'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Lock, Smartphone, CheckCircle2, ArrowRight, KeyRound, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/button';

export const SubUserActivationGate: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [currentStep, setCurrentStep] = useState<'password' | 'mobile'>('password');
  
  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Mobile OTP State
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const isSubUser = Boolean(user?.isSubUser);
  const needsPasswordChange = Boolean(user?.mustChangePassword);
  const needsMobileVerification = Boolean(!user?.mobileVerified);

  useEffect(() => {
    if (user?.mobile) {
      setMobile(user.mobile);
    }
    if (needsPasswordChange) {
      setCurrentStep('password');
    } else if (needsMobileVerification) {
      setCurrentStep('mobile');
    }
  }, [user, needsPasswordChange, needsMobileVerification]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  if (!isSubUser || (!needsPasswordChange && !needsMobileVerification)) {
    return null;
  }

  // Password validation helpers
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!isPasswordValid) {
      setPasswordError('Password must meet all security requirements listed below.');
      return;
    }
    if (!passwordsMatch) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.post('/api/auth/sub-user/activate/password', {
        newPassword
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to set new password');
      }

      toast.success('Password updated successfully!');
      await refreshUser({ skipCache: true });
      setCurrentStep('mobile');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
      toast.error(err.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendMobileOtp = async () => {
    const cleanMobile = mobile.trim().replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await api.post('/api/auth/sub-user/activate/send-mobile-otp', {
        mobile: cleanMobile
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to send OTP');
      }

      toast.success(`OTP sent to +91 ${cleanMobile}`);
      setOtpSent(true);
      setResendTimer(60);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send mobile OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = mobile.trim().replace(/\D/g, '').slice(-10);
    const cleanOtp = otp.trim();

    if (cleanOtp.length !== 6) {
      toast.error('Please enter the 6-digit OTP.');
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await api.post('/api/auth/sub-user/activate/verify-mobile-otp', {
        mobile: cleanMobile,
        otp: cleanOtp
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'OTP verification failed');
      }

      toast.success('Mobile verified! Your account is now fully activated.');
      await refreshUser({ skipCache: true });
    } catch (err: any) {
      toast.error(err.message || 'Invalid OTP code.');
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 ring-8 ring-white/5 mb-3">
            <ShieldCheck className="w-6 h-6 text-blue-300" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Account Activation Required</h2>
          <p className="text-xs text-blue-200 mt-1 max-w-sm mx-auto">
            Welcome to <span className="font-semibold text-white">{user?.organization?.organizationName || 'your Organization'}</span>. Please complete these 2 steps to activate your sub-user dashboard access.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className={`flex items-center gap-2 text-xs font-bold ${!needsPasswordChange ? 'text-emerald-600' : currentStep === 'password' ? 'text-blue-900' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${!needsPasswordChange ? 'bg-emerald-100 text-emerald-700' : currentStep === 'password' ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {!needsPasswordChange ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
            </span>
            <span>1. Set New Password</span>
          </div>

          <div className="mx-3 flex items-center text-slate-300">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          <div className={`flex items-center gap-2 text-xs font-bold ${!needsMobileVerification ? 'text-emerald-600' : currentStep === 'mobile' ? 'text-blue-900' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${!needsMobileVerification ? 'bg-emerald-100 text-emerald-700' : currentStep === 'mobile' ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {!needsMobileVerification ? <CheckCircle2 className="w-3.5 h-3.5" /> : '2'}
            </span>
            <span>2. Verify Mobile OTP</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {currentStep === 'password' && needsPasswordChange ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>You logged in using a temporary password. For security, please set your permanent password.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new secure password"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-800"
                    required
                  />
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <div className="font-bold text-slate-700 mb-1">Password Requirements:</div>
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  At least 8 characters
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase && hasLowercase ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasUppercase && hasLowercase ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  Uppercase and lowercase letters
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  At least one number
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-700' : 'text-slate-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasSpecial ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  At least one special character (!@#$%^&*)
                </div>
              </div>

              {passwordError && (
                <div className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  {passwordError}
                </div>
              )}

              <Button
                type="submit"
                disabled={passwordLoading || !isPasswordValid || !passwordsMatch}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                {passwordLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Save Password & Continue &rarr;
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyMobileOtp} className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Verify your phone number with a 6-digit OTP to complete organization security verification.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile Number (10 Digits)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">+91</span>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      maxLength={10}
                      disabled={otpSent}
                      className="w-full pl-12 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-800 font-mono"
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendMobileOtp}
                    disabled={otpLoading || mobile.length !== 10 || resendTimer > 0}
                    className="shrink-0 text-xs font-bold border-slate-300 hover:bg-slate-100"
                  >
                    {otpLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    {resendTimer > 0 ? `Resend (${resendTimer}s)` : otpSent ? 'Resend OTP' : 'Send OTP'}
                  </Button>
                </div>
              </div>

              {otpSent && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Enter 6-Digit OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP code"
                    maxLength={6}
                    className="w-full text-center text-xl font-bold tracking-widest py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-800 font-mono"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1 text-center">
                    Enter the verification code sent to +91 {mobile}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={verifyLoading || !otpSent || otp.length !== 6}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                {verifyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Verify Mobile & Access Dashboard &rarr;
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
