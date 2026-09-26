'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Users,
  Store,
  HeartHandshake,
  Building2,
  Mail,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Eye,
  Loader2,
  Link as LinkIcon,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi, postApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { FocusTrap } from '../../../components/ui/FocusTrap';
import { cn } from '../../../lib/utils';

interface RecipientCounts {
  all: number;
  sellers: number;
  shg: number;
  buyers: number;
}

type AudienceKey = 'ALL_USERS' | 'SELLERS_ONLY' | 'SHG_ONLY' | 'BUYERS_ONLY';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AdminNoticeCircularModal({ open, onClose, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false);
  const [counts, setCounts] = useState<RecipientCounts>({ all: 0, sellers: 0, shg: 0, buyers: 0 });
  const [countsLoading, setCountsLoading] = useState(false);

  const [audience, setAudience] = useState<AudienceKey>('ALL_USERS');
  const [channels, setChannels] = useState<{ in_app: boolean; email: boolean; sms: boolean }>({
    in_app: true,
    email: true,
    sms: false
  });
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [actionUrl, setActionUrl] = useState('');

  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Initialize auto-generated reference number and fetch live recipient counts
  useEffect(() => {
    if (open) {
      const year = new Date().getFullYear();
      const code = String(Date.now()).slice(-5);
      setRefNumber(`JSG/CIRCULAR/${year}/${code}`);
      void fetchCounts();
    }
  }, [open]);

  const fetchCounts = async () => {
    setCountsLoading(true);
    try {
      const res = await getApi<any>('/api/admin/notices/recipient-counts');
      const data = res?.data !== undefined ? res.data : res;
      if (data && typeof data.all === 'number') {
        setCounts({
          all: Number(data.all || 0),
          sellers: Number(data.sellers || 0),
          shg: Number(data.shg || 0),
          buyers: Number(data.buyers || 0)
        });
      }
    } catch (err) {
      console.warn('[AdminNotice] Could not fetch recipient counts:', err);
    } finally {
      setCountsLoading(false);
    }
  };

  const getActiveAudienceCount = () => {
    switch (audience) {
      case 'SELLERS_ONLY':
        return counts.sellers;
      case 'SHG_ONLY':
        return counts.shg;
      case 'BUYERS_ONLY':
        return counts.buyers;
      case 'ALL_USERS':
      default:
        return counts.all;
    }
  };

  const getAudienceLabel = () => {
    switch (audience) {
      case 'SELLERS_ONLY':
        return 'Sellers Only';
      case 'SHG_ONLY':
        return 'SHGs Only';
      case 'BUYERS_ONLY':
        return 'Buyers Only';
      case 'ALL_USERS':
      default:
        return 'All Users';
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || title.length < 3) {
      toast.error('Title required', { description: 'Please provide a valid circular title (min 3 chars).' });
      return;
    }

    if (!message.trim() || message.length < 5) {
      toast.error('Message required', { description: 'Please enter the directive/notice text (min 5 chars).' });
      return;
    }

    const selectedChannels = (['in_app', 'email', 'sms'] as const).filter(c => channels[c]);
    if (selectedChannels.length === 0) {
      toast.error('Channel required', { description: 'Please select at least one delivery channel.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        targetAudience: audience,
        channels: selectedChannels,
        priority,
        title: title.trim(),
        message: message.trim(),
        referenceNumber: refNumber.trim() || undefined,
        actionUrl: actionUrl.trim() || undefined,
        showModalPopup: channels.in_app
      };

      const res = await postApi<any>('/api/admin/notices/broadcast', payload);
      const recipientCount = res?.data?.recipientCount ?? getActiveAudienceCount();

      toast.success('Official Notice Broadcasted', {
        description: `Dispatched circular to ${recipientCount} active recipients across ${selectedChannels.join(', ')}.`
      });

      setTitle('');
      setMessage('');
      setActionUrl('');
      setPreviewMode(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Broadcast Failed', {
        description: err?.message || 'Could not dispatch notice circular. Check inputs.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const audienceOptions: Array<{ key: AudienceKey; label: string; count: number; desc: string; icon: any }> = [
    {
      key: 'ALL_USERS',
      label: 'All Users',
      count: counts.all,
      desc: 'Sellers, SHGs, Buyers & Admins',
      icon: Users
    },
    {
      key: 'SELLERS_ONLY',
      label: 'Sellers Only',
      count: counts.sellers,
      desc: 'MSME Sellers & Suppliers',
      icon: Store
    },
    {
      key: 'SHG_ONLY',
      label: 'SHGs Only',
      count: counts.shg,
      desc: 'Women & Artisan SHGs',
      icon: HeartHandshake
    },
    {
      key: 'BUYERS_ONLY',
      label: 'Buyers Only',
      count: counts.buyers,
      desc: 'Govt Depts & Buyers',
      icon: Building2
    }
  ];

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <FocusTrap active={open} onEscape={onClose} autoFocus={false} className="w-full flex justify-center max-w-3xl">
        <div
          ref={modalRef}
          onClick={e => e.stopPropagation()}
          className="relative flex flex-col w-full max-h-[88vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200"
        >
          {/* 1. Modal Fixed Header (Pinned at Top) */}
          <div className="shrink-0 flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-[#0c2340] text-white">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 id="broadcast-modal-title" className="text-base font-bold text-white leading-tight">
                  Circulate Official Notice / Administrative Directive
                </h2>
                <p className="text-xs text-slate-300">
                  Targeted mass broadcast via Centered Pop-up, Government HTML Email & SMS
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 2. Scrollable Body Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Section A: Target Audience Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Target Audience Selection *
                </label>
                <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 inline-flex items-center gap-1">
                  {countsLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      <span>Checking accounts...</span>
                    </>
                  ) : (
                    <span>Targeting: {getActiveAudienceCount()} active accounts</span>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {audienceOptions.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = audience === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setAudience(opt.key)}
                      className={cn(
                        'flex flex-col text-left p-3 rounded-xl border transition-all relative group',
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <Icon className={cn('h-4 w-4', isSelected ? 'text-blue-700' : 'text-slate-500')} />
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            isSelected ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-transparent border border-slate-300'
                          )}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-900 leading-tight">{opt.label}</span>
                      <span className="text-[10px] text-slate-500 line-clamp-1">{opt.desc}</span>
                      <span className="mt-2 text-xs font-black text-blue-700">
                        {countsLoading ? '...' : `${opt.count} Users`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section B: Dispatch Channels & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/90 p-4 rounded-xl border border-slate-200">
              {/* Channels */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  2. Dispatch Channels *
                </label>
                <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200/80">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800 hover:text-blue-900">
                    <input
                      type="checkbox"
                      checked={channels.in_app}
                      onChange={e => setChannels(c => ({ ...c, in_app: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Center Screen Pop-up Modal (In-App)</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800 hover:text-blue-900">
                    <input
                      type="checkbox"
                      checked={channels.email}
                      onChange={e => setChannels(c => ({ ...c, email: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Government-Grade HTML Email</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800 hover:text-blue-900">
                    <input
                      type="checkbox"
                      checked={channels.sms}
                      onChange={e => setChannels(c => ({ ...c, sms: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>SMS Alert Message (Urgent Directive)</span>
                  </label>
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  3. Notice Priority Level *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority('medium')}
                    className={cn(
                      'px-3 py-2 text-xs font-bold rounded-lg border text-center transition-all',
                      priority === 'medium'
                        ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('high')}
                    className={cn(
                      'px-3 py-2 text-xs font-bold rounded-lg border text-center transition-all',
                      priority === 'high'
                        ? 'border-amber-600 bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    Important
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('urgent')}
                    className={cn(
                      'px-3 py-2 text-xs font-bold rounded-lg border text-center transition-all',
                      priority === 'urgent'
                        ? 'border-rose-600 bg-rose-600 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    Urgent
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  {priority === 'urgent' && 'Emergency Red: Highlights with emergency badges and audio notice.'}
                  {priority === 'high' && 'Warning Amber: Displays with high-priority notice indicators.'}
                  {priority === 'medium' && 'Official Navy: Standard government administrative circular badge.'}
                </div>
              </div>
            </div>

            {/* Section C: Notice Reference & Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="notice-ref" className="text-xs font-bold text-slate-700 block mb-1">
                  Circular Ref No.
                </label>
                <input
                  id="notice-ref"
                  type="text"
                  value={refNumber}
                  onChange={e => setRefNumber(e.target.value)}
                  className="w-full text-xs font-mono font-bold text-slate-800 rounded-lg border border-slate-300 px-3 py-2 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="JSG/CIRCULAR/2026/..."
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="notice-title" className="text-xs font-bold text-slate-700 block mb-1">
                  Notice Subject / Heading *
                </label>
                <input
                  id="notice-title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={180}
                  className="w-full text-xs font-semibold text-slate-900 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Revised MSME Procurement Policy & Catalog Upload Deadline"
                  required
                />
              </div>
            </div>

            {/* Section D: Message Directive */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="notice-message" className="text-xs font-bold text-slate-700">
                  Circular Directive & Message Body *
                </label>
                <span className="text-[10px] text-slate-400">{message.length}/4000 chars</span>
              </div>
              <textarea
                id="notice-message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                maxLength={4000}
                className="w-full text-xs text-slate-800 rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
                placeholder="Type the complete official directive, instructions, guidelines, and compliance requirements here..."
                required
              />
            </div>

            {/* Section E: Optional Portal Resource Link */}
            <div>
              <label htmlFor="notice-link" className="text-xs font-bold text-slate-700 block mb-1">
                Optional Direct Portal Link (Resource / Policy Page)
              </label>
              <div className="flex items-center rounded-lg border border-slate-300 px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                <LinkIcon className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                <input
                  id="notice-link"
                  type="text"
                  value={actionUrl}
                  onChange={e => setActionUrl(e.target.value)}
                  className="w-full text-xs border-0 p-0 focus:outline-none focus:ring-0 text-slate-800"
                  placeholder="e.g. /seller/catalogue or /procurement or https://..."
                />
              </div>
            </div>

            {/* Section F: Live Preview Drawer Toggle */}
            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900"
              >
                <Eye className="h-4 w-4" />
                <span>{previewMode ? 'Hide Notice Preview' : 'Show Live Pop-up & Email Preview'}</span>
              </button>

              {previewMode && (
                <div className="mt-3 p-4 bg-slate-900 text-white rounded-xl shadow-inner space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                    <span className="font-mono">{refNumber || 'JSG/CIRCULAR/...'}</span>
                    <span
                      className={cn(
                        'uppercase font-bold px-2 py-0.5 rounded text-[10px]',
                        priority === 'urgent'
                          ? 'bg-rose-500/20 text-rose-300'
                          : priority === 'high'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-blue-500/20 text-blue-300'
                      )}
                    >
                      {priority} PRIORITY
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{title || 'Notice Subject Preview'}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {message || 'The full message directive will appear here in the centered user screen pop-up and official HTML email.'}
                  </p>
                  <div className="pt-2 text-[10px] text-slate-400 italic">
                    Audience: {getAudienceLabel()} ({getActiveAudienceCount()} verified accounts)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Modal Fixed Footer (Pinned at Bottom) */}
          <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600 flex items-center gap-1.5">
              <span>Broadcasting to:</span>
              {countsLoading ? (
                <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  <span>Checking accounts...</span>
                </span>
              ) : (
                <strong className="text-slate-900 font-bold bg-slate-200/80 px-2 py-0.5 rounded-full text-xs">
                  {getActiveAudienceCount()} {getAudienceLabel()}
                </strong>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleBroadcast}
                disabled={submitting || countsLoading}
                className="bg-[#0c2340] hover:bg-[#12335f] text-white text-xs font-bold uppercase tracking-wide gap-1.5 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Dispatch Circular Notice</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
