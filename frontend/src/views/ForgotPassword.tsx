import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password', { email });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to request reset');
      setSent(true);
      toast.success('If the account exists, a reset code has been sent.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to request reset');
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/reset-password', { email, otp, newPassword });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to reset password');
      toast.success('Password reset successful. Please sign in.');
      setOtp('');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Unable to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h1 className="text-xl font-black text-[#12335f]">Reset Password</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Use your official email to receive a secure reset code.</p>

        <form onSubmit={sent ? resetPassword : requestReset} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Official Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sent}
              required
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
            />
          </div>

          {sent && (
            <>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Reset Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-center text-lg font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-[#12335f]/20"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                  placeholder="12+ chars with upper, lower, number, symbol"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                />
              </div>
            </>
          )}

          <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-xl bg-[#12335f] font-black uppercase tracking-widest text-white">
            {isLoading ? 'Please wait...' : sent ? 'Reset Password' : 'Send Reset Code'}
          </Button>
        </form>

        <Link href="/login" className="mt-4 block text-center text-xs font-black uppercase tracking-widest text-[#12335f] underline underline-offset-4">
          Back to login
        </Link>
      </div>
    </div>
  );
}
