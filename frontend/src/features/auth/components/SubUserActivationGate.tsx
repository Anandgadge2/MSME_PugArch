'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Loader2, LogOut, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { api } from '../../../lib/api';
import { sanitizeIndianMobileInput, validateIndianMobile } from '../../../lib/validation';
import { Button } from '../../../components/ui/button';

const readError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => ({}));
  return payload?.message || fallback;
};

const passwordChecks = (password: string) => [
  { label: 'At least 12 characters', valid: password.length >= 12 },
  { label: 'Uppercase and lowercase letters', valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
  { label: 'At least one number', valid: /\d/.test(password) },
  { label: 'At least one special character', valid: /[^A-Za-z0-9]/.test(password) }
];

export default function SubUserActivationGate() {
  const { user, refreshUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMobile(sanitizeIndianMobileInput(user?.mobile || ''));
  }, [user?.mobile]);

  const passwordRules = useMemo(() => passwordChecks(newPassword), [newPassword]);
  const needsActivation = Boolean(user?.mustChangePassword || user?.requiresMobileVerification);
  if (!user || !needsActivation) return null;

  const passwordStep = Boolean(user.mustChangePassword);
  const mobileStep = !passwordStep && Boolean(user.requiresMobileVerification);

  const changePassword = async () => {
    if (!currentPassword) return toast.error('Enter the temporary password from your invitation email.');
    if (!passwordRules.every(rule => rule.valid)) return toast.error('Your new password does not meet all security requirements.');
    if (newPassword !== confirmPassword) return toast.error('New password and confirmation do not match.');
    if (currentPassword === newPassword) return toast.error('Choose a password different from the temporary password.');

    setBusy(true);
    try {
      const response = await api.post('/api/auth/change-password', { currentPassword, newPassword });
      if (!response.ok) throw new Error(await readError(response, 'Unable to change password.'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshUser({ skipCache: true });
      toast.success('Password changed. Now verify your mobile number.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change password.');
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    const normalized = sanitizeIndianMobileInput(mobile);
    const mobileError = validateIndianMobile(normalized, 'Mobile number');
    if (mobileError) return toast.error(mobileError);
    setBusy(true);
    try {
      const response = await api.post('/api/auth/sub-user/mobile/send-otp', { mobile: normalized });
      if (!response.ok) throw new Error(await readError(response, 'Unable to send OTP.'));
      const payload = await response.json().catch(() => ({}));
      setMobile(normalized);
      setOtpSent(true);
      toast.success(payload.message || 'OTP sent to your mobile number.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) return toast.error('Enter the 6-digit OTP.');
    setBusy(true);
    try {
      const response = await api.post('/api/auth/sub-user/mobile/verify', { mobile, otp });
      if (!response.ok) throw new Error(await readError(response, 'Unable to verify OTP.'));
      await refreshUser({ skipCache: true });
      toast.success('Account activated. Your assigned workspace is ready.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to verify OTP.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="activation-title">
      <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
        <div className="grid md:grid-cols-[260px_1fr]">
          <aside className="bg-[#0b2447] p-6 text-white md:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-blue-200">Secure setup</p>
            <h1 id="activation-title" className="mt-2 text-2xl font-black leading-tight">Activate your workspace access</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Complete both security steps before opening the organization dashboard.</p>

            <div className="mt-8 space-y-3">
              <div className={`flex items-center gap-3 rounded-xl border p-3 ${passwordStep ? 'border-blue-300 bg-white/10' : 'border-emerald-300/40 bg-emerald-400/10'}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${passwordStep ? 'bg-white text-[#0b2447]' : 'bg-emerald-400 text-emerald-950'}`}>
                  {passwordStep ? <KeyRound className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </span>
                <div><p className="text-sm font-bold">1. New password</p><p className="text-xs text-slate-300">Replace temporary access</p></div>
              </div>
              <div className={`flex items-center gap-3 rounded-xl border p-3 ${mobileStep ? 'border-blue-300 bg-white/10' : 'border-white/10'}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${mobileStep ? 'bg-white text-[#0b2447]' : 'bg-white/10 text-slate-300'}`}>
                  <Phone className="h-4 w-4" />
                </span>
                <div><p className="text-sm font-bold">2. Mobile OTP</p><p className="text-xs text-slate-300">Verify account ownership</p></div>
              </div>
            </div>

            <button onClick={() => logout('/login')} className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </aside>

          <section className="p-6 md:p-8">
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Signed in as</p>
              <p className="mt-1 font-black text-slate-950">{user.name}</p>
              <p className="text-sm text-slate-600">{user.email}</p>
            </div>

            {passwordStep && (
              <div>
                <h2 className="text-xl font-black text-slate-950">Create your permanent password</h2>
                <p className="mt-1 text-sm text-slate-600">Use the password from the invitation email once, then choose a private password.</p>
                <div className="mt-6 space-y-4">
                  <label className="block text-sm font-bold text-slate-700">Temporary password
                    <input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700">New password
                    <input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700">Confirm new password
                    <input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-[#12335f] focus:ring-2 focus:ring-blue-100" />
                  </label>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {passwordRules.map(rule => (
                    <div key={rule.label} className={`flex items-center gap-2 text-xs font-semibold ${rule.valid ? 'text-emerald-700' : 'text-slate-500'}`}>
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${rule.valid ? 'bg-emerald-100' : 'bg-slate-100'}`}><Check className="h-3 w-3" /></span>
                      {rule.label}
                    </div>
                  ))}
                </div>
                <Button onClick={changePassword} disabled={busy} className="mt-7 h-11 w-full bg-[#12335f] font-bold text-white hover:bg-[#0b2447]">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save password and continue
                </Button>
              </div>
            )}

            {mobileStep && (
              <div>
                <h2 className="text-xl font-black text-slate-950">Verify your mobile number</h2>
                <p className="mt-1 text-sm text-slate-600">This number becomes the verified contact for your sub-login.</p>
                <label className="mt-6 block text-sm font-bold text-slate-700">Mobile number
                  <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-[#12335f] focus-within:ring-2 focus-within:ring-blue-100">
                    <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">+91</span>
                    <input inputMode="numeric" maxLength={10} disabled={otpSent} value={mobile} onChange={event => setMobile(sanitizeIndianMobileInput(event.target.value))} className="h-11 min-w-0 flex-1 px-3 outline-none disabled:bg-slate-50" placeholder="10-digit mobile number" />
                  </div>
                </label>
                {!otpSent ? (
                  <Button onClick={sendOtp} disabled={busy} className="mt-6 h-11 w-full bg-[#12335f] font-bold text-white hover:bg-[#0b2447]">
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send verification OTP
                  </Button>
                ) : (
                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700">6-digit OTP</label>
                      <button type="button" onClick={() => { setOtpSent(false); setOtp(''); }} className="text-xs font-bold text-blue-700 hover:underline">Change number</button>
                    </div>
                    <input inputMode="numeric" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 text-center text-xl font-black tracking-[0.35em] outline-none focus:border-[#12335f] focus:ring-2 focus:ring-blue-100" placeholder="000000" />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Button variant="outline" onClick={sendOtp} disabled={busy} className="h-11 font-bold">Resend OTP</Button>
                      <Button onClick={verifyOtp} disabled={busy || otp.length !== 6} className="h-11 bg-[#12335f] font-bold text-white hover:bg-[#0b2447]">
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify & open dashboard
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
