'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Users,
  Building2,
  Mail,
  MessageSquare,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Eye,
  Loader2,
  Sparkles,
  Link as LinkIcon,
  ChevronRight
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

  // Initialize auto-generated reference number
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
      const res = await getApi<RecipientCounts>('/api/admin/notices/recipient-counts');
      const data = (res as any)?.data !== undefined ? (res as any).data : res;
      if (data) setCounts(data);
    } catch {
      // Non-blocking
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
        return 'Sellers & Suppliers Only';
      case 'SHG_ONLY':
        return 'Self-Help Groups (SHG) Only';
      case 'BUYERS_ONLY':
        return 'Procurement Buyers & Depts';
      case 'ALL_USERS':
      default:
        return 'All Registered Users';
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

      // Clear state and close
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

  if (!open) return null;

  const audienceOptions: Array<{ key: AudienceKey; label: string; count: number; desc: string }> = [
    {
      key: 'ALL_USERS',
      label: 'All Users',
      count: counts.all,
      desc: 'Sellers, SHGs, Buyers & Admins'
    },
    {
      key: 'SELLERS_ONLY',
      label: 'Sellers Only',
      count: counts.sellers,
      desc: 'MSME Sellers & Suppliers'
    },
    {
      key: 'SHG_ONLY',
      label: 'SHG Clusters Only',
      count: counts.shg,
      desc: 'Women & Artisan SHGs'
    },
    {
      key: 'BUYERS_ONLY',
      label: 'Buyers Only',
      count: counts.buyers,
      desc: 'Govt Depts & Buyers'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-modal-title"
    >
      <FocusTrap active={open}>
        <div
          ref={modalRef}
          className="relative flex h-full max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-200/90 px-6 py-4 bg-[#0c2340] text-white">
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
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Target Audience Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Target Audience Selection *
                </label>
                <span className="text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Targeting: {getActiveAudienceCount()} verified accounts
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {audienceOptions.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setAudience(opt.key)}
                    className={cn(
                      'flex flex-col text-left p-3 rounded-xl border transition-all relative',
                      audience === opt.key
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    )}
                  >
                    <span className="text-xs font-bold text-slate-900 leading-tight">{opt.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{opt.desc}</span>
                    <span className="mt-2 text-xs font-black text-blue-700">
                      {countsLoading ? '...' : `${opt.count} Users`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Dispatch Channels & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
              {/* Channels */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  2. Dispatch Channels *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={channels.in_app}
                      onChange={e => setChannels(c => ({ ...c, in_app: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Center Screen Pop-up Modal (In-App)</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={channels.email}
                      onChange={e => setChannels(c => ({ ...c, email: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Government-Grade HTML Email</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={channels.sms}
                      onChange={e => setChannels(c => ({ ...c, sms: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>SMS Alert Message (Urgent)</span>
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
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    Urgent
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  {priority === 'urgent' && 'Urgent notices highlight with emergency red badges and audio alert.'}
                  {priority === 'high' && 'High priority notices appear with warning amber badges.'}
                  {priority === 'medium' && 'Normal notices appear with standard administrative navy styling.'}
                </p>
              </div>
            </div>

            {/* 3. Notice Reference and Title */}
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
                  className="w-full text-xs font-mono rounded-lg border border-slate-200 px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="JSG/CIRCULAR/2026/09/..."
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
                  className="w-full text-xs font-medium rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Revised MSME Procurement Policy & Catalog Upload Deadline"
                  required
                />
              </div>
            </div>

            {/* 4. Detailed Message Directive */}
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
                className="w-full text-xs rounded-lg border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
                placeholder="Type the complete official directive, instructions, guidelines, and compliance requirements here..."
                required
              />
            </div>

            {/* 5. Optional Portal Resource Link */}
            <div>
              <label htmlFor="notice-link" className="text-xs font-bold text-slate-700 block mb-1">
                Optional Direct Portal Link (Resource / Policy Page)
              </label>
              <div className="flex items-center rounded-lg border border-slate-200 px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
                <LinkIcon className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                <input
                  id="notice-link"
                  type="text"
                  value={actionUrl}
                  onChange={e => setActionUrl(e.target.value)}
                  className="w-full text-xs border-0 p-0 focus:outline-none focus:ring-0"
                  placeholder="e.g. /seller/catalogue or /procurement or https://..."
                />
              </div>
            </div>

            {/* 6. Live Preview Drawer Toggle */}
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
                    <span className="uppercase text-amber-400 font-bold">{priority} PRIORITY</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{title || 'Notice Subject Preview'}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {message || 'The full message directive will appear here in the centered user screen pop-up and official HTML email.'}
                  </p>
                  <div className="pt-2 text-[10px] text-slate-400 italic">
                    Audience: {getAudienceLabel()} ({getActiveAudienceCount()} users)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Broadcasting to <strong className="text-slate-800">{getActiveAudienceCount()}</strong> recipients
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
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
}
