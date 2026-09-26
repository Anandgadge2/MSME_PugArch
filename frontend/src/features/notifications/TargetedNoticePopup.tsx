'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Building2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { getApi, postApi } from '../shared/apiClient';
import { Button } from '../../components/ui/button';
import { FocusTrap } from '../../components/ui/FocusTrap';
import { cn } from '../../lib/utils';

interface ActiveNotice {
  id: number;
  title: string;
  message: string;
  type: string;
  priority?: string;
  redirectUrl?: string;
  createdAt: string;
}

export default function TargetedNoticePopup() {
  const { user } = useAuth();
  const [notice, setNotice] = useState<ActiveNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const fetchActiveNotice = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await getApi<ActiveNotice | null>('/api/notices/active-popup');
      const data = (res as any)?.data !== undefined ? (res as any).data : res;
      if (data && data.id) {
        setNotice(data);
        setIsOpen(true);
      } else {
        setNotice(null);
        setIsOpen(false);
      }
    } catch {
      // Non-blocking fail-safe
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void fetchActiveNotice();

    const handleUpdate = () => {
      void fetchActiveNotice();
    };

    window.addEventListener('notifications:updated', handleUpdate);
    return () => {
      window.removeEventListener('notifications:updated', handleUpdate);
    };
  }, [user?.id, fetchActiveNotice]);

  const handleAcknowledge = async () => {
    if (!notice?.id) return;
    setLoading(true);
    try {
      await postApi(`/api/notices/${notice.id}/acknowledge`, {});
      toast.success('Notice Acknowledged', {
        description: 'You can review this circular anytime from your notification history.'
      });
      setIsOpen(false);
      setNotice(null);
      // Notify navbar bell to refresh state
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch (err: any) {
      toast.error('Failed to acknowledge notice', {
        description: err?.message || 'Please check your connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !notice) return null;

  const isUrgent = notice.priority === 'urgent';
  const isHigh = notice.priority === 'high';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="official-notice-title"
      aria-describedby="official-notice-desc"
    >
      <FocusTrap active={isOpen}>
        <div
          ref={modalRef}
          className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200"
        >
          {/* Header Banner */}
          <div
            className={cn(
              'px-6 py-4 border-b flex items-start gap-3.5',
              isUrgent
                ? 'bg-rose-950 text-white border-rose-900'
                : isHigh
                ? 'bg-amber-950 text-white border-amber-900'
                : 'bg-[#0c2340] text-white border-slate-800'
            )}
          >
            <div
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-inner',
                isUrgent
                  ? 'bg-rose-600 text-white'
                  : isHigh
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-blue-600 text-white'
              )}
            >
              {isUrgent ? (
                <ShieldAlert className="h-5 w-5" />
              ) : isHigh ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                  Government of Odisha • District Administration Jharsuguda
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
                    isUrgent
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : isHigh
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  )}
                >
                  {notice.priority || 'OFFICIAL CIRCULAR'}
                </span>
              </div>
              <h2
                id="official-notice-title"
                className="mt-1 text-base sm:text-lg font-bold text-white leading-snug line-clamp-2"
              >
                {notice.title.replace(/^\[CIRCULAR\]\s*/i, '')}
              </h2>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 font-medium">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                <span>Official Portal Notice Directive</span>
              </div>
              <span>
                {new Date(notice.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div
              id="official-notice-desc"
              className="text-sm leading-relaxed text-slate-700 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 whitespace-pre-wrap font-sans"
            >
              {notice.message}
            </div>

            {notice.redirectUrl && (
              <div className="pt-1">
                <a
                  href={notice.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                >
                  <span>Open Attached Resource / Reference Link</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Please acknowledge receipt to dismiss this announcement.
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAcknowledge}
                disabled={loading}
                className={cn(
                  'w-full sm:w-auto px-5 py-2 font-bold text-xs uppercase tracking-wide gap-1.5 shadow-sm text-white',
                  isUrgent
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#0c2340] hover:bg-[#12335f]'
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{loading ? 'Acknowledging...' : 'I Acknowledge & Dismiss'}</span>
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
