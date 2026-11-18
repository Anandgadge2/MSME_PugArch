'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Mail, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  HardDrive, 
  ChevronDown, 
  ChevronUp, 
  X,
  ShieldAlert
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';

interface EmailHealthAdvisoryBannerProps {
  email?: string | null;
  emailVerified?: boolean;
  className?: string;
}

export function EmailHealthAdvisoryBanner({
  email,
  emailVerified = false,
  className = ''
}: EmailHealthAdvisoryBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true); // default true to avoid SSR hydration flicker
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!email) return;

    try {
      const storageKey = `jsg_email_advisory_ack_${email.toLowerCase().trim()}`;
      const savedAck = localStorage.getItem(storageKey);

      if (savedAck) {
        const ackDate = parseInt(savedAck, 10);
        // Resurface reminder after 14 days if unverified, or 30 days if verified
        const reminderIntervalDays = emailVerified ? 30 : 14;
        const now = Date.now();
        const diffDays = (now - ackDate) / (1000 * 60 * 60 * 24);

        if (diffDays > reminderIntervalDays) {
          setIsDismissed(false);
        } else {
          setIsDismissed(true);
        }
      } else {
        // Never acknowledged
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }
  }, [email, emailVerified]);

  if (isDismissed || !email) {
    return null;
  }

  const handleAcknowledge = () => {
    try {
      const storageKey = `jsg_email_advisory_ack_${email.toLowerCase().trim()}`;
      localStorage.setItem(storageKey, Date.now().toString());
    } catch {}

    setIsDismissed(true);
    toast.success('Email deliverability advisory noted. Thank you for keeping your inbox active.');
  };

  return (
    <div 
      role="region"
      aria-label="Email Delivery and Storage Health Advisory"
      className={`relative overflow-hidden rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50/95 via-orange-50/90 to-amber-50/95 p-4 shadow-sm transition-all duration-200 ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        {/* Left icon and message */}
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 ring-1 ring-amber-400/30">
            {emailVerified ? (
              <Mail className="h-5 w-5" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-700" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-amber-600/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-900 border border-amber-600/20">
                <AlertTriangle className="h-3 w-3" /> Important Email Delivery Notice
              </span>
              {!emailVerified && (
                <span className="inline-flex items-center rounded bg-rose-600/10 px-2 py-0.5 text-[9px] font-bold text-rose-800 border border-rose-500/20">
                  Unverified Email
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              Ensure active email delivery for <span className="font-mono text-amber-950 underline decoration-amber-400">{email}</span>
            </h4>

            <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">
              Official purchase orders, payment certificates, and statutory tender notices are automatically dispatched to this inbox. If your mailbox storage is full (e.g. Google Drive/Gmail 15 GB quota exceeded) or your address is incorrect, notifications cannot be delivered.
            </p>

            {/* Expandable checklist */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#12335f] hover:underline"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" /> Hide Delivery & Storage Checklist
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" /> View Delivery & Storage Checklist
                  </>
                )}
              </button>

              {showDetails && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 rounded-lg border border-amber-200/80 bg-white/80 p-3 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <HardDrive className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-slate-900 font-semibold text-[11px]">Free Up Storage</strong>
                      <span className="text-[10px] text-slate-600">If your Google Drive/Gmail is at 100%, delete old files so incoming mail won&apos;t bounce.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-slate-900 font-semibold text-[11px]">Whitelist Portal Sender</strong>
                      <span className="text-[10px] text-slate-600">Mark <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">jsgsmileportal@gmail.com</code> as safe so notices never hit Spam.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-slate-900 font-semibold text-[11px]">Update if Changed</strong>
                      <span className="text-[10px] text-slate-600">If your designated procurement contact has changed, update it in your profile.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0 pt-2 md:pt-0">
          <Link href="/profile">
            <Button
              size="sm"
              className="h-8 rounded-lg bg-[#0b2545] hover:bg-[#12335f] text-white text-[11px] font-bold shadow-sm flex items-center gap-1.5 px-3"
            >
              Update / Check Email
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>

          <Button
            size="sm"
            variant="outline"
            onClick={handleAcknowledge}
            className="h-8 rounded-lg border-amber-300 bg-white hover:bg-amber-100/50 text-slate-800 text-[11px] font-bold px-3"
          >
            I&apos;ve Checked My Inbox
          </Button>

          <button
            type="button"
            onClick={handleAcknowledge}
            aria-label="Dismiss email advisory"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
